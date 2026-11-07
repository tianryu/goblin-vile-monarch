from pathlib import Path
from PIL import Image,ImageDraw
root=Path('qa/interaction-v5')
files=[p for p in root.glob('960-*.png')]+[root/'tier3.png',root/'loaded-cart.png',root/'coin-ghost-empty.png',root/'water-flow-b.png',root/'rotate.png']
for start in range(0,len(files),6):
    canvas=Image.new('RGB',(960,810),'#25342e');d=ImageDraw.Draw(canvas)
    for i,p in enumerate(files[start:start+6]):
        im=Image.open(p).convert('RGB');im.thumbnail((480,240))
        x=i%2*480;y=i//2*270;canvas.paste(im,(x+(480-im.width)//2,y+24));d.text((x+10,y+5),p.stem,fill='#f3e8cd')
    canvas.save(root/f'review-pages-{start//6+1}.jpg')
files=sorted(root.glob('rider*.png'));canvas=Image.new('RGB',(840,600),'#25342e');d=ImageDraw.Draw(canvas)
for i,p in enumerate(files):
    im=Image.open(p).convert('RGB').crop((317,164,527,284))
    x=i%4*210;y=i//4*150;canvas.paste(im,(x,y+25));d.text((x+4,y+5),p.stem.replace('rider-',''),fill='#f3e8cd')
canvas.save(root/'review-riders.jpg')

