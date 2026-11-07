"""从现有关节贴纸的alpha派生选中光边，不重画角色，不生产序列帧。"""
from pathlib import Path
from PIL import Image,ImageFilter
import json
root=Path(__file__).resolve().parents[1]
rigdir=root/'assets/resources/rigs';out=rigdir/'focus';out.mkdir(exist_ok=True)
source=json.loads((rigdir/'catalog.json').read_text(encoding='utf8'))['rigs'];catalog={}
for name,rig in source.items():
    atlas=Image.open(rigdir/(rig['atlas']+'.png')).convert('RGBA')
    sheet=Image.new('RGBA',(512,1024));x=y=row=0;parts=[];pad=12
    for part in rig['parts']:
        rx,ry,w,h=part['rect'];alpha=atlas.crop((rx,ry,rx+w,ry+h)).getchannel('A')
        padded=Image.new('L',(w+pad*2,h+pad*2));padded.paste(alpha,(pad,pad))
        glow=Image.new('RGBA',padded.size,(255,212,94,0));glow.putalpha(padded.filter(ImageFilter.MaxFilter(pad*2+1)))
        pw,ph=glow.size
        if x+pw>512:x=0;y+=row+2;row=0
        assert y+ph<=1024,name
        sheet.paste(glow,(x,y))
        parts.append({**part,'rect':[x,y,pw,ph],'width':pw,'height':ph,'anchorX':(part['anchorX']*w+pad)/pw,'anchorY':(part['anchorY']*h+pad)/ph})
        x+=pw+2;row=max(row,ph)
    sheet=sheet.crop((0,0,512,y+row));sheet.save(out/(name+'.png'),optimize=True)
    catalog[name]={**rig,'parts':parts}
(out/'catalog.json').write_text(json.dumps({'rigs':catalog},ensure_ascii=False,separators=(',',':')),encoding='utf8')
print('Prepared joint-following technical focus masks:',len(catalog))
