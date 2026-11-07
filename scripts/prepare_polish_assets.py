"""Export independently generated UI and complete riding sprites using ordinary bitmap operations."""
from pathlib import Path
import json,math
from PIL import Image

def export_polish(root):
    source=root/'game/art/source/polish-v4';out=root/'game/art/runtime'
    path=out/'manifest.json';manifest=json.loads(path.read_text(encoding='utf-8'))
    report=[]
    for p in sorted(source.glob('*.png')):
        name=p.stem
        if not (name.startswith('ui_') or name.startswith('rider_')):continue
        image=Image.open(p).convert('RGBA');bounds=image.getchannel('A').point(lambda v:255 if v>24 else 0).getbbox()
        if not bounds:raise ValueError('Empty generated asset: '+name)
        if name.endswith('_bare'):
            crowned=Image.open(source/(name[:-5]+'.png')).convert('RGBA')
            if image.size!=crowned.size:image=image.resize(crowned.size,Image.Resampling.LANCZOS)
            bounds=crowned.getchannel('A').point(lambda v:255 if v>24 else 0).getbbox()
        image=image.crop(bounds)
        if name.startswith('rider_'):maximum=(288,192)
        elif name=='ui_panel':maximum=(768,512)
        elif name=='ui_logo':maximum=(600,260)
        elif name in ['ui_button','ui_button_primary']:maximum=(512,128)
        elif name in ['ui_hud','ui_context']:maximum=(560,112)
        elif name in ['ui_bar','ui_bar_fill']:maximum=(512,38)
        elif name=='ui_joystick_base':maximum=(256,128)
        else:maximum=(160,160)
        image.thumbnail(maximum,Image.Resampling.LANCZOS)
        file=name+'.png';image.save(out/file,optimize=True)
        manifest['sheets'][file]={'width':image.width,'height':image.height}
        manifest['frames'][name]={'sheet':file,'x':0,'y':0,'w':image.width,'h':image.height}
        report.append({'asset':name,'source':str(p.relative_to(root)),'width':image.width,'height':image.height,'rgba_bytes':image.width*image.height*4})
    path.write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf-8')
    required=['ui_panel','ui_button','ui_button_primary','ui_hud','ui_context','ui_joystick_base','ui_joystick_knob','ui_run_control','ui_action_control','ui_pause_control','ui_bar','ui_bar_fill','ui_logo']
    required += ['rider_'+n+s for n in ['boar','lizard','wolf','bat'] for s in ['','_bare']]
    missing=[n for n in required if n not in manifest['frames']]
    if missing:raise ValueError('Missing finishing assets: '+','.join(missing))
    data={'assets':report,'rgba_bytes':sum(v['width']*v['height']*4 for v in manifest['sheets'].values()),'source_art_only':True}
    (root/'qa/godot/polish-asset-audit.json').write_text(json.dumps(data,ensure_ascii=False,indent=2),encoding='utf-8')
    if data['rgba_bytes']>24*1024*1024:raise ValueError('Production bitmap RGBA exceeds internal 24 MiB budget')
    return data

if __name__=='__main__':print(json.dumps(export_polish(Path(__file__).resolve().parents[1]),ensure_ascii=False))
