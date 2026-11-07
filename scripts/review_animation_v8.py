"""H3原片可视检查材料，不生成或插值动作。"""
from pathlib import Path
from PIL import Image,ImageDraw
import imageio_ffmpeg, numpy as np, json, shutil, argparse, hashlib

def review(folder,full=False):
    folder=Path(folder).resolve();job=json.loads((folder/'jobs/job.json').read_text('utf-8'))
    if job.get('state')!='execution_complete_unreviewed':raise ValueError('Job not complete')
    origin=Path(job['outputs'][0]['fullpath']);source=folder/'source/video.mp4'
    if not source.exists():shutil.copy2(origin,source)
    reader=imageio_ffmpeg.read_frames(str(source),pix_fmt='rgb24');meta=next(reader);w,h=meta['size'];frames=[]
    for raw in reader:frames.append(Image.fromarray(np.frombuffer(raw,np.uint8).reshape(h,w,3)))
    reader.close()
    diag=folder/'diagnostics';diag.mkdir(exist_ok=True)
    # 相同固定裁切用于原片时间轴，不能逐帧自动居中掩盖漂移。
    crop=(0,0,w,h) if full else (200,50,1050,660)
    for start in range(0,len(frames),24):
        sheet=Image.new('RGB',(1200,900),'#ddd5bc');draw=ImageDraw.Draw(sheet)
        for i,frame in enumerate(frames[start:start+24]):
            tile=frame.crop(crop);tile.thumbnail((290,194),Image.Resampling.LANCZOS)
            x=i%4*300+(300-tile.width)//2;y=i//4*150+20
            # 24帧分6行，保留原比例，显示高度以128为限。
            tile.thumbnail((290,128),Image.Resampling.LANCZOS)
            x=i%4*300+(300-tile.width)//2
            sheet.paste(tile,(x,y));draw.text((i%4*300+8,i//4*150+4),f'{start+i:03d}',fill='#191919')
        sheet.save(diag/f'{"full-" if full else ""}timeline-{start:03d}.png')
    summary={'video':str(source),'sha256':hashlib.sha256(source.read_bytes()).hexdigest(),
             'frames':len(frames),'size':list(meta['size']),'fps':meta['fps'],'duration':len(frames)/meta['fps'],
             'technical_decode':True,'visual_review':'pending','timeline_crop':list(crop)}
    (diag/('full-decode.json' if full else 'decode.json')).write_text(json.dumps(summary,indent=2),encoding='utf-8')
    print(json.dumps(summary))

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('folder');p.add_argument('--full',action='store_true');a=p.parse_args();review(a.folder,a.full)
