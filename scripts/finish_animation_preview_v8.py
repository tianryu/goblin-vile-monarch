"""保留PNG与alpha不变，生成柔边APNG/WebP并冻结文件哈希。"""
from pathlib import Path
from PIL import Image
import json,argparse,hashlib

def finish(folder,durations=None):
    folder=Path(folder).resolve();path=folder/'manifest.json';m=json.loads(path.read_text('utf-8'))
    files=sorted((folder/'frames').glob('*.png'));frames=[Image.open(p).convert('RGBA') for p in files]
    if durations is not None:
        if len(durations)!=len(frames) or min(durations)<10:raise ValueError('One valid frame hold per original PNG')
        m['source_durations_ms']=m['durations_ms'];m['durations_ms']=durations
        m['timing_note']='Source poses unchanged; explicit per-frame holds preserve the selected complete cycle.'
    durations=m['durations_ms']
    frames[0].save(folder/'animation.apng',save_all=True,append_images=frames[1:],duration=durations,loop=0,disposal=0,blend=0)
    frames[0].save(folder/'preview.webp',save_all=True,append_images=frames[1:],duration=durations,loop=0,lossless=True)
    m['png_sha256']={p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in files}
    m['duration_ms']=sum(durations);m['soft_alpha_preserved']=True
    m['gif_note']='No GIF conversion in production: APNG and lossless WebP preserve this non-pixel illustration alpha.'
    path.write_text(json.dumps(m,ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps({'frames':len(frames),'duration_ms':sum(durations),'png_unchanged':True}))

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('folder');p.add_argument('--durations');a=p.parse_args();finish(a.folder,[int(v) for v in a.durations.split(',')] if a.durations else None)
