"""从原片白底首帧和同位置参考透明空隙建立视频跟踪起点，不修改RGB。"""
from pathlib import Path
from PIL import Image
import numpy as np,imageio_ffmpeg,json,hashlib
from scipy.ndimage import binary_propagation

def seed(folder,version='seed-source-v02'):
    folder=Path(folder);target=folder/version
    if target.exists():raise FileExistsError(target)
    target.mkdir();m=json.loads((folder/'input.json').read_text(encoding='utf-8'));original=Image.open(folder/'source/original.png').convert('RGBA')
    size=(round(original.width*m['reference_scale']),round(original.height*m['reference_scale']))
    a=original.getchannel('A').resize(size,Image.Resampling.LANCZOS);reference=Image.new('L',(1024,576));reference.paste(a,(m['reference_left'],m['reference_foot']-size[1]));reference=reference.resize((1280,720),Image.Resampling.LANCZOS)
    rd=imageio_ffmpeg.read_frames(str(folder/'source/video.mp4'),pix_fmt='rgb24');metadata=next(rd);w,h=metadata['size'];rgb=np.frombuffer(next(rd),np.uint8).reshape(h,w,3).copy();rd.close()
    if (w,h)!=(1280,720):raise ValueError('Reference coordinates require the frozen 1280x720 route')
    chroma=m.get('background_color','white').lower()=='#ff00ff'
    white=((rgb[:,:,0]>190)&(rgb[:,:,1]<75)&(rgb[:,:,2]>190)) if chroma else rgb.min(2)>220
    edge=np.zeros((h,w),bool);edge[0,:]=white[0,:];edge[-1,:]=white[-1,:];edge[:,0]=white[:,0];edge[:,-1]=white[:,-1]
    connected=binary_propagation(edge,mask=white)
    # 原图完全透明的首帧空隙可去掉视频压缩后的近白纸色；眼白/牙齿在原图为实心，仍保留。
    neutral_paper=(rgb.min(2)>190)&((rgb.max(2).astype(int)-rgb.min(2).astype(int))<20)
    empty=white if chroma else (np.asarray(reference)==0)&neutral_paper
    alpha=np.where(connected|empty,0,255).astype(np.uint8)
    Image.fromarray(rgb).save(target/'frame_000.png');Image.fromarray(alpha).save(target/'mask_000.png');fg=Image.fromarray(np.dstack((rgb,alpha)));board=Image.new('RGB',(w*2,h),'#1b292d');board.paste(Image.fromarray(rgb),(0,0));board.paste(fg,(w,0),fg);board.save(target/'source-alpha-check.png')
    (target/'seed.json').write_text(json.dumps({'scope':'Candidate first-source alpha; complete source-alpha review required before tracking','raw_rgb_sha256':hashlib.sha256(rgb.tobytes()).hexdigest(),'mask_sha256':hashlib.sha256((target/'mask_000.png').read_bytes()).hexdigest(),'reference_voids_only_remove_existing_pure_white':True},indent=2),encoding='utf-8');return target/'mask_000.png'

if __name__=='__main__':
    import argparse
    p=argparse.ArgumentParser();p.add_argument('folder');a=p.parse_args();print(seed(a.folder))
