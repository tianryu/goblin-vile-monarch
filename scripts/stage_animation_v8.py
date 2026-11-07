"""把已经逐帧人工检查的候选放入引擎预览，正式验收状态仍独立记录。"""
from pathlib import Path
from PIL import Image
import json,argparse,hashlib,shutil
ROOT=Path(__file__).resolve().parents[1]

def stage(folder):
    folder=Path(folder).resolve();m=json.loads((folder/'manifest.json').read_text('utf-8'))
    if m.get('status') not in ['visual-approved-engine-pending','accepted']:
        raise ValueError('Explicit visual review is required before staging')
    for name,digest in m.get('png_sha256',{}).items():
        if hashlib.sha256((folder/'frames'/name).read_bytes()).hexdigest()!=digest:raise ValueError('Frozen PNG changed: '+name)
    out=ROOT/'game/art/animation';out.mkdir(parents=True,exist_ok=True)
    manifest=out/'manifest.json';data=json.loads(manifest.read_text('utf-8')) if manifest.exists() else {'revision':8,'clips':{}}
    name=m['asset']+'-'+m['action']+'.png';shutil.copy2(folder/'spritesheet.png',out/name)
    width,height=m['width'],m['height'];durations=m['durations_ms']
    frames=[{'x':i%4*width,'y':i//4*height,'seconds':value/1000} for i,value in enumerate(durations)]
    clip={key:m[key] for key in ['asset','action','width','height','reference_height','anchor_x','anchor_y']}
    clip.update(sheet=name,frames=frames,duration=sum(durations)/1000,loop=m.get('loop',True),
                provenance=str(folder.relative_to(ROOT)).replace('\\','/'),review=m['status'],
                sha256=hashlib.sha256((out/name).read_bytes()).hexdigest())
    data['clips'][m['asset']+'/'+m['action']]=clip
    manifest.write_text(json.dumps(data,ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps({'staged':m['asset']+'/'+m['action'],'frames':len(frames),'review':m['status']}))

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('folder');a=p.parse_args();stage(a.folder)
