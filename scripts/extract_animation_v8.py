"""从纯色原片整理真实序列。只移除有连通背景证据的像素，不生成动作。"""
from pathlib import Path
from PIL import Image,ImageDraw
import numpy as np
from scipy.ndimage import binary_propagation
import imageio_ffmpeg,argparse,json,hashlib

def extract(folder,indices,version,background='white',alpha_dir=None,background_regions=None,foreground_regions=None,exclude_regions=None,background_threshold=220,runtime_reference_height=None,output_padding=0):
    folder=Path(folder).resolve();target=folder/version
    if alpha_dir:
        audit=Path(alpha_dir).parent/'matte.json'
        if audit.exists() and json.loads(audit.read_text('utf-8')).get('status','').startswith('failed'):
            raise ValueError('Failed source contour checks; do not package this mask')
    if target.exists():raise FileExistsError(target)
    target.mkdir();(target/'raw').mkdir();(target/'frames').mkdir();(target/'masks').mkdir()
    metadata=json.loads((folder/'input.json').read_text('utf-8'));reader=imageio_ffmpeg.read_frames(str(folder/'source/video.mp4'),pix_fmt='rgb24');meta=next(reader);w,h=meta['size'];rgba=[];checks=[]
    for index,data in enumerate(reader):
        if index not in indices:continue
        rgb=np.frombuffer(data,np.uint8).reshape(h,w,3).copy()
        # 白色仅作为背景候选，边界连通判断保留被人物黑线包住的眼白/牙齿。
        candidate=rgb.min(axis=2)>background_threshold if background=='white' else ((rgb[:,:,0]>190)&(rgb[:,:,1]<75)&(rgb[:,:,2]>190))
        seeds=np.zeros((h,w),bool);seeds[0,:]=candidate[0,:];seeds[-1,:]=candidate[-1,:];seeds[:,0]=candidate[:,0];seeds[:,-1]=candidate[:,-1]
        bg=binary_propagation(seeds,mask=candidate)
        alpha=np.where(bg,0,255).astype(np.uint8)
        if alpha_dir:
            alpha=np.asarray(Image.open(Path(alpha_dir)/f'frame_{index:03d}.png').convert('L')).copy()
            if alpha.shape!=(h,w):raise ValueError('Mask is not in original source coordinates')
            # 模型蒙版后只移除明确背景证据，不膨胀/补洞/保留最大连通区。
            if background=='white':alpha[bg]=0
            elif background=='magenta':alpha[candidate]=0
        if background_regions:
            # 原片独立确认的封闭空隙；不删除眼白/牙齿，也不自动按连通域大小猜人物。
            regions=background_regions.get('per_frame',{}).get(str(index),background_regions.get('default',[])) if isinstance(background_regions,dict) else background_regions
            for region in regions:
                x0,y0,x1,y1=region['rect'] if isinstance(region,dict) else region
                threshold=region.get('background_threshold',background_threshold) if isinstance(region,dict) else background_threshold
                paper=rgb[y0:y1,x0:x1].min(axis=2)>threshold if background=='white' else candidate[y0:y1,x0:x1]
                area=alpha[y0:y1,x0:x1];area[paper]=0
        if foreground_regions:
            # 原片中明确可见的细弓弦/木弓恢复，同坐标取像素，不画新线也不改形状。
            regions=foreground_regions.get('per_frame',{}).get(str(index),foreground_regions.get('default',[])) if isinstance(foreground_regions,dict) else foreground_regions
            for region in regions:
                x0,y0,x1,y1=region['rect'] if isinstance(region,dict) else region
                threshold=region.get('background_threshold',180) if isinstance(region,dict) else 180
                area=alpha[y0:y1,x0:x1];area[rgb[y0:y1,x0:x1].min(axis=2)<threshold]=255
        if exclude_regions:
            # 用户明确要求拆出的离弦投射物，不随人物序列打包。
            regions=exclude_regions.get('per_frame',{}).get(str(index),exclude_regions.get('default',[])) if isinstance(exclude_regions,dict) else exclude_regions
            for x0,y0,x1,y1 in regions:alpha[y0:y1,x0:x1]=0
        frame=np.dstack((rgb,alpha));rgba.append(Image.fromarray(frame))
        Image.fromarray(rgb).save(target/'raw'/f'frame_{index:03d}.png');Image.fromarray(alpha).save(target/'masks'/f'frame_{index:03d}.png')
        checks.append({'source_index':index,'source_rgb_equal_before_shared_resize':True,'background_fraction':float(bg.mean())})
    reader.close()
    # 所有帧共享一次联合裁切，保留动作的真实位置与大小。
    boxes=[im.getchannel('A').getbbox() for im in rgba]
    if any(box is None for box in boxes):raise ValueError('Empty frame')
    crop=(max(0,min(b[0] for b in boxes)-32),max(0,min(b[1] for b in boxes)-32),min(w,max(b[2] for b in boxes)+32),min(h,max(b[3] for b in boxes)+32))
    original=json.loads((folder/'input.json').read_text('utf-8'))
    original_height=float(original['source_frame']['h'])*float(original['reference_scale'])*h/576
    target_height=min(420,int(original['source_frame']['h'])) if runtime_reference_height is None else int(runtime_reference_height)
    if target_height<=0:raise ValueError('Reference height must be positive')
    scale=target_height/original_height
    size=(round((crop[2]-crop[0])*scale),round((crop[3]-crop[1])*scale))
    resize_size=size;pad=int(output_padding)
    if pad<0:raise ValueError('Transparent padding cannot be negative')
    size=(size[0]+pad*2,size[1]+pad*2)
    output=[]
    for i,im in enumerate(rgba):
        frame=im.crop(crop).resize(resize_size,Image.Resampling.LANCZOS)
        if pad:
            padded=Image.new('RGBA',size);padded.paste(frame,(pad,pad));frame=padded
        frame.save(target/'frames'/f'frame_{i:03d}.png');output.append(frame)
    # 三底逐帧诊断图与真实时间预览，显示网格不进入交付帧。
    for style,color in [('light','#eee9da'),('dark','#1b292d'),('check','#777777')]:
        tilew=max(220,size[0]+10);tileh=max(230,size[1]+28);sheet=Image.new('RGB',(tilew*4,tileh*((len(output)+3)//4)),color);draw=ImageDraw.Draw(sheet)
        if style=='check':
            for y in range(0,sheet.height,12):
                for x in range(0,sheet.width,12):
                    if (x//12+y//12)%2==0:draw.rectangle((x,y,x+11,y+11),fill='#999999')
        for i,im in enumerate(output):
            x=i%4*tilew+(tilew-im.width)//2;y=i//4*tileh+26;sheet.paste(im,(x,y),im);draw.text((i%4*tilew+6,i//4*tileh+5),str(indices[i]),fill='white' if style=='dark' else 'black')
        sheet.save(target/f'contact-{style}.png')
    # 最后一个采样只能保持到真实原片末尾，不能多加半帧造成循环停顿。
    boundaries=indices+[min(index+1,indices[-1]+float(np.median(np.diff(indices))))]
    times=[round((index-indices[0])/meta['fps']*1000) for index in boundaries]
    durations=[times[i+1]-times[i] for i in range(len(indices))]
    output[0].save(target/'candidate.webp',save_all=True,append_images=output[1:],duration=durations,loop=0,lossless=True)
    atlas=Image.new('RGBA',(size[0]*4,size[1]*((len(output)+3)//4)))
    for i,im in enumerate(output):atlas.alpha_composite(im,(i%4*size[0],i//4*size[1]))
    atlas.save(target/'spritesheet.png',optimize=True)
    info={'asset':original['asset'],'action':original['action'],'status':'candidate-needs-multi-round-review',
          'source_sha256':hashlib.sha256((folder/'source/video.mp4').read_bytes()).hexdigest(),
          'source_indices':indices,'source_fps':meta['fps'],'source_crop':list(crop),'shared_scale':scale,
          'width':size[0],'height':size[1],'reference_height':original_height*scale,'resize_size':list(resize_size),'output_padding':pad,
          'anchor_x':(512*w/1024-crop[0])*scale+pad,'anchor_y':(original['reference_foot']*h/576-crop[1])*scale+pad,
          'durations_ms':durations,'checks':checks,'background':background,'background_threshold':background_threshold,'model_generated_motion':True,
          'postprocess':'SAM2 alpha plus independently identifiable pure-background deletion' if alpha_dir else 'Border-connected pure background alpha only',
          'alpha_source':str(alpha_dir) if alpha_dir else None,
          'independently_reviewed_background_regions':background_regions,
          'independently_reviewed_foreground_regions':foreground_regions,'excluded_detached_object_regions':exclude_regions,
          'rounds':[]}
    (target/'manifest.json').write_text(json.dumps(info,ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps({'folder':str(target),'size':size,'frames':len(output),'duration_ms':sum(durations),'source_crop':crop}))

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('folder');p.add_argument('--indices',required=True);p.add_argument('--version',default='extracted-v01');p.add_argument('--background',default='white');p.add_argument('--alpha-dir');p.add_argument('--background-regions');p.add_argument('--foreground-regions');p.add_argument('--exclude-regions');a=p.parse_args()
    read_regions=lambda value:json.loads(value) if value else None
    extract(a.folder,[int(i) for i in a.indices.split(',')],a.version,a.background,a.alpha_dir,read_regions(a.background_regions),read_regions(a.foreground_regions),read_regions(a.exclude_regions))
