"""只选取已核对并冻结的原PNG姿势与保持时间，不重画、不插值、不移动。"""
from pathlib import Path
from PIL import Image,ImageDraw
import json,shutil,hashlib
from scripts.finish_animation_preview_v8 import finish

def select(source,indices,durations,version):
    source=Path(source);target=source.parent/version
    if target.exists():raise FileExistsError(target)
    m=json.loads((source/'manifest.json').read_text());target.mkdir()
    for part in ['frames','raw','masks']:(target/part).mkdir()
    frames=[]
    for i,index in enumerate(indices):
        old=m['source_indices'].index(index);name=f'frame_{old:03d}.png';p=source/'frames'/name
        assert hashlib.sha256(p.read_bytes()).hexdigest()==m['png_sha256'][name]
        shutil.copy2(p,target/'frames'/f'frame_{i:03d}.png');frames.append(Image.open(p).convert('RGBA'))
        for part in ['raw','masks']:shutil.copy2(source/part/f'frame_{index:03d}.png',target/part/f'frame_{index:03d}.png')
    w,h=m['width'],m['height'];atlas=Image.new('RGBA',(w*4,h*((len(frames)+3)//4)))
    for i,im in enumerate(frames):atlas.alpha_composite(im,(i%4*w,i//4*h))
    atlas.save(target/'spritesheet.png',optimize=True)
    for style,color in [('light','#eee9da'),('dark','#1b292d'),('check','#777777')]:
        tw=max(220,w+10);th=max(230,h+28);out=Image.new('RGB',(tw*4,th*((len(frames)+3)//4)),color);draw=ImageDraw.Draw(out)
        if style=='check':
            for y in range(0,out.height,12):
                for x in range(0,out.width,12):
                    if (x//12+y//12)%2==0:draw.rectangle((x,y,x+11,y+11),fill='#999999')
        for i,im in enumerate(frames):out.paste(im,(i%4*tw+(tw-w)//2,i//4*th+26),im);draw.text((i%4*tw+6,i//4*th+4),str(indices[i]),fill='white' if style=='dark' else 'black')
        out.save(target/f'contact-{style}.png')
    m.update(source_indices=indices,durations_ms=durations,status='candidate-needs-timing-engine-review',selection_from=str(source).replace('\\','/'),png_sha256={},rounds=[{'review':'Only already frozen whole poses selected. Shared canvas, source RGB and alpha unchanged. Review full motion phases and engine playback before adoption.'}])
    (target/'manifest.json').write_text(json.dumps(m,ensure_ascii=False,indent=2),encoding='utf-8');finish(target);return target
