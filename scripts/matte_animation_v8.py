"""用SAM2得到蒙版候选。只复制原片同坐标RGB，不重画人物。"""
from pathlib import Path
import argparse,json,hashlib,time
import numpy as np
from PIL import Image,ImageDraw
import imageio_ffmpeg

def matte(folder,indices,version,reuse=None,refresh_indices=None):
    import torch
    from transformers import Sam2Model,Sam2Processor
    torch.set_num_threads(6)
    folder=Path(folder).resolve();target=folder/version
    if target.exists():raise FileExistsError(target)
    target.mkdir();(target/'frames').mkdir();(target/'raw').mkdir();(target/'masks').mkdir()
    started=time.time();model_name='facebook/sam2.1-hiera-tiny'
    # 独立CPU分割，不与H3争用显存；模型来自官方仓库，不加载远程自定义代码。
    model=Sam2Model.from_pretrained(model_name,trust_remote_code=False).to('cpu').eval()
    processor=Sam2Processor.from_pretrained(model_name,trust_remote_code=False)
    annotations=json.loads((folder/'sam-annotations.json').read_text('utf-8'))
    reader=imageio_ffmpeg.read_frames(str(folder/'source/video.mp4'),pix_fmt='rgb24');meta=next(reader);w,h=meta['size'];report=[]
    for index,raw in enumerate(reader):
        if index not in indices:continue
        rgb=np.frombuffer(raw,np.uint8).reshape(h,w,3).copy();im=Image.fromarray(rgb)
        name=f'frame_{index:03d}.png'
        row=annotations.get('per_frame',{}).get(str(index),annotations)
        if reuse and index not in (refresh_indices or []) and (Path(reuse)/'masks'/name).exists():
            import shutil
            old=np.asarray(Image.open(Path(reuse)/'raw'/name).convert('RGB'))
            if not np.array_equal(old,rgb):raise ValueError('Reuse source pixels changed')
            for kind in ['frames','raw','masks']:shutil.copy2(Path(reuse)/kind/name,target/kind/name)
            alpha=np.asarray(Image.open(target/'masks'/name))
            missing=[q for q in row.get('foreground_checks',[]) if alpha[q[1],q[0]]<250]
            report.append({'source_index':index,'foreground_pixels':int((alpha>0).sum()),'rgb_equal':True,'reused_from':str(reuse),'missing_foreground_checks':missing})
            print('reused',index,flush=True);continue
        # 标注从原视频独立给定，不把候选alpha反过来当作轮廓真值。
        points=[[row['points']]];labels=[[row['labels']]]
        inputs=processor(images=im,input_points=points,input_labels=labels,
                         input_boxes=[[row['box']]],return_tensors='pt')
        with torch.inference_mode():outputs=model(**inputs,multimask_output=False)
        masks=processor.post_process_masks(outputs.pred_masks,inputs['original_sizes'])[0]
        alpha=(masks[0,0].numpy()>0).astype(np.uint8)*255
        rgba=np.dstack((rgb,alpha));Image.fromarray(rgba).save(target/'frames'/f'frame_{index:03d}.png')
        im.save(target/'raw'/f'frame_{index:03d}.png');Image.fromarray(alpha).save(target/'masks'/f'frame_{index:03d}.png')
        failures=[]
        for x,y in row.get('foreground_checks',[]):
            if alpha[y,x]<250:failures.append([x,y])
        report.append({'source_index':index,'foreground_pixels':int((alpha>0).sum()),'rgb_equal':True,'missing_foreground_checks':failures})
        print('matted',index,flush=True)
    reader.close()
    sheet=Image.new('RGB',(1200,400*((len(indices)+3)//4)),'#eee9da');draw=ImageDraw.Draw(sheet)
    for i,row in enumerate(report):
        im=Image.open(target/'frames'/f"frame_{row['source_index']:03d}.png").crop((300,95,950,640));im.thumbnail((295,365),Image.Resampling.LANCZOS)
        x=i%4*300+(300-im.width)//2;y=i//4*400+24
        sheet.paste(im,(x,y),im);draw.text((i%4*300+6,i//4*400+4),str(row['source_index']),fill='#222222')
    sheet.save(target/'contact-light.png')
    info={'model':model_name,'source_sha256':hashlib.sha256((folder/'source/video.mp4').read_bytes()).hexdigest(),
          'status':'failed-contour-anchors' if any(r.get('missing_foreground_checks') for r in report) else 'candidate-needs-source-contour-review','frames':report,'seconds':time.time()-started,
          'same_coordinate_rgb':True,'device':'cpu'}
    (target/'matte.json').write_text(json.dumps(info,indent=2),encoding='utf-8')

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('folder');p.add_argument('--indices',default='15,18,21,24,27,30,33,36');p.add_argument('--version',default='matte-v01');p.add_argument('--reuse');p.add_argument('--refresh-indices',default='');a=p.parse_args()
    matte(a.folder,[int(i) for i in a.indices.split(',')],a.version,a.reuse,[int(i) for i in a.refresh_indices.split(',') if i])
