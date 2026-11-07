"""导出独立AI平整土路贴图，仅裁切/缩放，不逐列扭曲地层。"""
from pathlib import Path
from PIL import Image
import numpy as np
import json, hashlib

def export_ground(root):
    """行走基线与草尖分离，树根/建筑/角色共用同一稳定地面坐标。"""
    out=root/'game/art/runtime';path=out/'manifest.json'
    m=json.loads(path.read_text('utf-8'));f=m['frames']['land']
    source_path=root/'game/art/source/animation-v8/land-flat.png'
    source=Image.open(source_path).convert('RGBA')
    box=source.getchannel('A').point(lambda a:255 if a>24 else 0).getbbox()
    image=source.crop(box).resize((960,67),Image.Resampling.LANCZOS)
    alpha=np.asarray(image)[:,:,3];profile=[]
    for x in range(image.width):
        runs=np.convolve((alpha[:,x]>220).astype(int),np.ones(7,dtype=int),'valid')
        hits=np.flatnonzero(runs==7);profile.append(int(hits[0] if len(hits) else 10))
    baseline=round(float(np.median(profile)))
    filename='land-level-v8.png';image.save(out/filename,optimize=True)
    m['sheets'][filename]={'width':960,'height':67}
    # 正常草床位于世界65%地平线；零星草尖不参与角色高度采样。
    f.update(sheet=filename,x=0,y=0,w=960,h=67,layer_top=.65-baseline/480,
             layer_span=67/480,ground_profile=[baseline]*960,walk_plane='handpainted-flat-v8')
    normal='normal-'+filename;Image.new('RGB',image.size,(128,128,255)).save(out/normal,optimize=True)
    m['normals'][filename]=normal
    path.write_text(json.dumps(m,ensure_ascii=False,indent=2),encoding='utf-8')
    report={'source':str(source_path.relative_to(root)),'source_sha256':hashlib.sha256(source_path.read_bytes()).hexdigest(),
            'method':'Independent AI flat path; shared crop/resize only. No column warp.',
            'source_crop':list(box),'grass_edge_range':[min(profile),max(profile)],
            'constant_walk_height':baseline,'output':filename}
    (root/'qa/godot/v8-ground.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
    print(json.dumps({'v8_walk_plane':baseline,'grass_edge_range':[min(profile),max(profile)]}))

if __name__=='__main__':export_ground(Path(__file__).resolve().parents[1])
