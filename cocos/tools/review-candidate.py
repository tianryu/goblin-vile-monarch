"""把候选按真实alpha和游戏大小与旧资源比较，绝不修绘素材。"""
from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
import sys,json
ROOT=Path(__file__).resolve().parents[2];OUT=ROOT/'qa/cocos/style-audit';name=sys.argv[1]
spec=json.loads((ROOT/'cocos/art/source'/f'{name}.pending.json').read_text(encoding='utf8'))
im=Image.open(spec['generatedPath']).convert('RGBA');a=im.getchannel('A');bbox=a.point(lambda v:255 if v>16 else 0).getbbox();im=im.crop(bbox)
board=Image.new('RGBA',(1024,650),'#53655b');d=ImageDraw.Draw(board);font=ImageFont.truetype(str(ROOT/'game/fonts/WenKai-source.ttf'),18)
refs=Image.open(OUT/('character-style.jpg' if spec.get('edge') in ('ally','enemy','merchant') else 'wood-style.jpg')).convert('RGBA')
refs.thumbnail((1024,300));board.alpha_composite(refs,(0,0))
d.text((15,310),name+'  new candidate',font=font,fill='#fff1ca')
large=im.copy();large.thumbnail((560,280),Image.Resampling.LANCZOS);board.alpha_composite(large,(25,350))
small=im.copy();h=78 if spec.get('edge')=='merchant' else 74 if spec.get('edge') in ('ally','enemy') else 128;small=small.resize((round(small.width*h/small.height),h),Image.Resampling.LANCZOS)
board.alpha_composite(small,(650,490))
d.text((650,440),str(h)+'px game-size',font=font,fill='#fff1ca')
board.convert('RGB').save(OUT/(name+'-corrected.jpg'),quality=95)
print(json.dumps({'image':str(OUT/(name+'-corrected.jpg')),'alphaExtrema':a.getextrema(),'contentBounds':bbox,'opaquePixels':a.histogram()[255],'faintPixels':sum(a.histogram()[1:16])}))
