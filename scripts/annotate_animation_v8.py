"""从原始已批准alpha选择稳定提示点候选。候选须对照视频观看，不充当轮廓真值。"""
from pathlib import Path
from PIL import Image,ImageDraw
import numpy as np
from scipy.ndimage import distance_transform_edt
import json,argparse

def annotate(folder):
    folder=Path(folder).resolve();m=json.loads((folder/'input.json').read_text('utf-8'))
    alpha=np.asarray(Image.open(folder/'source/original.png').convert('RGBA'))[:,:,3]>240
    h,w=alpha.shape;name=m['asset'];zones=[(0,0,w,h*.36),(0,h*.36,w,h*.74)]
    if name.startswith('rider_'):zones[0]=(w*.35,0,w*.77,h*.35)
    if name.startswith(('tree_','tribal_','hall')) or name in ['torch','forest_shrub']:zones.append((0,h*.80,w,h))
    points=[]
    for x0,y0,x1,y1 in zones:
        x0,y0,x1,y1=map(int,[x0,y0,x1,y1]);region=alpha[y0:y1,x0:x1]
        if not region.any():continue
        d=distance_transform_edt(np.pad(region,1))[1:-1,1:-1];iy,ix=np.unravel_index(np.argmax(d),d.shape);x=x0+ix;y=y0+iy
        points.append([round((m['reference_left']+x*m['reference_scale'])*1.25),round((m['reference_foot']-h*m['reference_scale']+y*m['reference_scale'])*1.25)])
    input_im=Image.open(folder/'source/input.png').resize((1280,720),Image.Resampling.LANCZOS)
    a=np.asarray(Image.open(folder/'source/original.png').convert('RGBA'))[:,:,3];ys,xs=np.where(a>24)
    scale=m['reference_scale']*1.25;left=m['reference_left']*1.25;top=(m['reference_foot']-h*m['reference_scale'])*1.25
    box=[max(0,round(left+xs.min()*scale-80)),max(0,round(top+ys.min()*scale-80)),min(1280,round(left+(xs.max()+1)*scale+80)),min(720,round(top+(ys.max()+1)*scale+40))]
    result={'points':points,'labels':[1]*len(points),'box':box,'annotation_source':'Stable interior point candidates from original approved reference alpha; not from the output mask. Video validation still required.','reference_review':'candidate'}
    path=folder/'sam-annotations.json'
    if path.exists():
        previous=json.loads(path.read_text('utf-8'))
        if previous.get('reference_review')!='candidate':raise FileExistsError('Do not overwrite reviewed annotations '+str(path))
        path.with_name('sam-annotations.previous-candidate.json').write_text(json.dumps(previous,indent=2),encoding='utf-8')
    path.write_text(json.dumps(result,indent=2),encoding='utf-8')
    draw=ImageDraw.Draw(input_im)
    for i,(x,y) in enumerate(points):draw.ellipse((x-5,y-5,x+5,y+5),outline='red',width=2);draw.text((x+7,y),str(i),fill='red')
    input_im.save(folder/'source/annotation-candidates.png');print(folder.name,points)

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('folders',nargs='+');a=p.parse_args()
    for folder in a.folders:annotate(folder)
