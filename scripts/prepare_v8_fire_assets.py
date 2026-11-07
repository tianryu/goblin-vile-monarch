"""导出经模型移除静态火焰的大厅。只裁切/缩放生成位图，不程序补画。"""
from pathlib import Path
from PIL import Image
import json,hashlib

def export_fire_assets(root):
    out=root/'game/art/runtime';source=root/'game/art/source/animation-v8/hall1-no-flame.png'
    meta=json.loads(source.with_suffix('.source.json').read_text('utf-8'))
    if not meta['review'].startswith('accepted'):raise ValueError('Fire base still needs visual review')
    im=Image.open(source).convert('RGBA');box=im.getchannel('A').point(lambda a:255 if a>24 else 0).getbbox();im=im.crop(box)
    # 保留批准的画风及透明边缘，原厅等级与玩法ID不改变。
    im.thumbnail((265,180),Image.Resampling.LANCZOS);im.save(out/'hall1-no-flame-v8.png',optimize=True)
    normal=Image.new('RGB',im.size,(128,128,255));normal.save(out/'normal-hall1-no-flame-v8.png')
    path=out/'manifest.json';m=json.loads(path.read_text('utf-8'));m['frames']['hall1']={'sheet':'hall1-no-flame-v8.png','x':0,'y':0,'w':im.width,'h':im.height}
    m['sheets']['hall1-no-flame-v8.png']={'width':im.width,'height':im.height};m['normals']['hall1-no-flame-v8.png']='normal-hall1-no-flame-v8.png'
    m['fire_mode']='procedural-handpainted';path.write_text(json.dumps(m,ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps({'hall1_no_baked_flame':True,'size':im.size,'source_sha256':hashlib.sha256(source.read_bytes()).hexdigest()}))

if __name__=='__main__':export_fire_assets(Path(__file__).resolve().parents[1])
