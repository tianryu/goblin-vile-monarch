"""Ordinary crop/resize exports of independent v5 AI bitmaps, plus safe font subsetting."""
from pathlib import Path
import json,hashlib
from PIL import Image
from fontTools import subset

def export_v5(root):
    source=root/'game/art/source/interaction-v5';out=root/'game/art/runtime';path=out/'manifest.json'
    data=json.loads(path.read_text(encoding='utf-8'));exported=[];ranks=[]
    for p in sorted(source.glob('*.png')):
        if not p.with_suffix('.source.json').exists():continue
        im=Image.open(p).convert('RGBA');box=im.getchannel('A').point(lambda n:255 if n>24 else 0).getbbox()
        if not box:raise ValueError('Empty '+p.name)
        im=im.crop(box);name=p.stem
        size=(768,400) if name=='ui_panel_v5' else ((200,260) if 'card' in name else ((480,96) if name.startswith('ui_') else ((160,144) if name.split('_')[0] in ['worker','hunter','brute','thief'] else (300,192))))
        im.thumbnail(size,Image.Resampling.LANCZOS);im.save(out/p.name,optimize=True)
        data['sheets'][p.name]={'width':im.width,'height':im.height};data['frames'][name]={'sheet':p.name,'x':0,'y':0,'w':im.width,'h':im.height}
        if name.split('_')[0] in ['worker','hunter','brute','thief']:ranks.append((name,im.copy()))
        exported.append({'name':name,'source':str(p.relative_to(root)),'width':im.width,'height':im.height})
    # Mixed professions must share a texture, including in the reflection pass.
    # The independently generated sources remain separate; atlasing is ordinary packing.
    atlas=Image.new('RGBA',(512,512));x=y=2;rowh=0
    for name,im in sorted(ranks,key=lambda item:-item[1].height):
        if x+im.width+2>512:x=2;y+=rowh+3;rowh=0
        if y+im.height+2>512:raise ValueError('Rank atlas overflow')
        atlas.alpha_composite(im,(x,y));data['frames'][name]={'sheet':'ranks-v5.png','x':x,'y':y,'w':im.width,'h':im.height}
        x+=im.width+3;rowh=max(rowh,im.height)
    height=((y+rowh+17)//16)*16;atlas=atlas.crop((0,0,512,height));atlas.save(out/'ranks-v5.png',optimize=True)
    data['sheets']['ranks-v5.png']={'width':512,'height':height}
    aliases={'ui_panel':'ui_panel_v5','ui_button':'ui_button_v5','ui_button_primary':'ui_primary_v5','ui_hud':'ui_tag_v5','ui_context':'ui_panel_v5'}
    for old,new in aliases.items():
        if new in data['frames']:data['frames'][old]=data['frames'][new].copy()
    # Saddle/body landmarks, shared by crowned and crownless variants.
    for mount,pivot in {'boar':0.56,'lizard':0.58,'wolf':0.56,'bat':0.57}.items():
        for suffix in ['', '_bare']:data['frames']['rider_'+mount+suffix]['pivot_x']=pivot
    used={f['sheet'] for f in data['frames'].values()}
    for file in list(data['sheets']):
        if file not in used:
            del data['sheets'][file]
            for p in [out/file,out/(file+'.import')]:
                if p.exists():p.unlink()
    path.write_text(json.dumps(data,ensure_ascii=False,indent=2),encoding='utf-8')
    report={'assets':exported,'frames':len(data['frames']),'rgba_bytes':sum(s['width']*s['height']*4 for s in data['sheets'].values()),'no_procedural_bitmap_art':True}
    (root/'qa/godot/v5-asset-audit.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
    if report['rgba_bytes']>24*1024*1024:raise ValueError('v5 runtime graphics exceed 24MiB')
    text=''.join(p.read_text(encoding='utf-8') for p in (root/'game/scripts').glob('*.gd'))
    for p in [root/'scripts/prepare_web_shell.py',root/'art/design/interaction-v5/layouts.js']:
        if p.exists():text+=p.read_text(encoding='utf-8')
    text+=''.join(chr(i) for i in range(32,127))+'ⅠⅡⅢ一二三四五六七八九十阶，。！？：；（）【】《》「」“”'
    stamp=root/'qa/godot/v5-font-subset.sha256'
    digest=hashlib.sha256(('v5-renamed-medium'+''.join(sorted(set(text)))).encode('utf-8')).hexdigest()
    if (root/'game/fonts/GoblinHand-game.ttf').exists() and stamp.exists() and stamp.read_text()==digest:return report
    options=subset.Options();options.name_IDs=['*'];options.name_legacy=True
    font=subset.load_font(str(root/'game/fonts/WenKai-source.ttf'),options)
    sub=subset.Subsetter(options=options);sub.populate(text=text);sub.subset(font)
    # Rename the modified subset without upstream Reserved Font Names.
    for rec in font['name'].names:
        values={1:'Goblin Hand UI',2:'Medium',3:'GoblinHandUI-Game-1',4:'Goblin Hand UI Medium',6:'GoblinHandUI-Medium',16:'Goblin Hand UI',17:'Medium'}
        if rec.nameID in values:rec.string=values[rec.nameID].encode(rec.getEncoding(),errors='replace')
    subset.save_font(font,str(root/'game/fonts/GoblinHand-game.ttf'),options)
    stamp.write_text(digest)
    return report
if __name__=='__main__':print(json.dumps(export_v5(Path(__file__).resolve().parents[1]),ensure_ascii=False))
