"""Pack independent AI architecture, trim transparent layer storage with layout preserved."""
from pathlib import Path
import json, math
from PIL import Image

def export_v6(root):
    out=root/'game/art/runtime';source=root/'game/art/source/world-v6'
    path=out/'manifest.json';data=json.loads(path.read_text(encoding='utf-8'))
    layers=[];assets=[];packed=[]
    for name in ['far','middle','land','foreground']:
        f=data['frames'][name];p=out/f['sheet'];im=Image.open(p).convert('RGBA')
        if f.get('layer_span') is not None:continue
        box=im.getchannel('A').getbbox()
        if not box:raise ValueError('Empty layer '+name)
        trimmed=im.crop((0,box[1],im.width,box[3]));trimmed.save(p,optimize=True)
        layers.append({'name':name,'before':[im.width,im.height],'after':list(trimmed.size),'row_offset':box[1]})
        f.update({'x':0,'y':0,'w':trimmed.width,'h':trimmed.height,'layer_top':box[1]/im.height,'layer_span':trimmed.height/im.height})
        data['sheets'][f['sheet']]={'width':trimmed.width,'height':trimmed.height}
    for p in sorted(source.glob('*.png')):
        metadata=json.loads(p.with_suffix('.source.json').read_text(encoding='utf-8'))
        if not metadata.get('review','').startswith('accepted'):raise ValueError('Unreviewed '+p.name)
        im=Image.open(p).convert('RGBA');bounds=im.getchannel('A').point(lambda n:255 if n>24 else 0).getbbox()
        if not bounds:raise ValueError('Empty '+p.name)
        im=im.crop(bounds)
        size=(256,220)
        if p.stem=='build_site_sign':size=(80,112)
        elif p.stem=='heart_icon':size=(48,48)
        elif p.stem in ['battlefield_wreck','hall_ruin']:size=(300,160)
        im.thumbnail(size,Image.Resampling.LANCZOS);packed.append((p.stem,im))
        assets.append({'name':p.stem,'source':str(p.relative_to(root)),'runtime_size':list(im.size),'review':metadata['review']})
    atlas=Image.new('RGBA',(1024,2048));x=y=2;rowh=0
    for name,im in sorted(packed,key=lambda item:-item[1].height):
        if x+im.width+2>1024:x=2;y+=rowh+4;rowh=0
        if y+im.height+2>2048:raise ValueError('Architecture atlas overflow')
        atlas.alpha_composite(im,(x,y));data['frames'][name]={'sheet':'world-v6.png','x':x,'y':y,'w':im.width,'h':im.height}
        x+=im.width+4;rowh=max(rowh,im.height)
    h=math.ceil((y+rowh+2)/64)*64;atlas=atlas.crop((0,0,1024,h));atlas.save(out/'world-v6.png',optimize=True)
    data['sheets']['world-v6.png']={'width':1024,'height':h}
    data['revision']=6;path.write_text(json.dumps(data,ensure_ascii=False,indent=2),encoding='utf-8')
    report={'revision':6,'assets':assets,'trimmed_layers':layers,'frames':len(data['frames']),'rgba_bytes':sum(s['width']*s['height']*4 for s in data['sheets'].values()),'textures':len(data['sheets']),'no_procedural_bitmap_art':True}
    (root/'qa/godot/v6-asset-audit.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps(report,ensure_ascii=False))
    return report

if __name__=='__main__':export_v6(Path(__file__).resolve().parents[1])
