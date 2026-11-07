"""只取已有AI位图做拼接蒙版及石块裁切，不绘制替代美术。"""
from pathlib import Path
from PIL import Image,ImageChops
import json
ROOT=Path(__file__).resolve().parents[2];OUT=ROOT/'cocos/assets/resources/art'
catalog=json.loads((OUT/'catalog.json').read_text(encoding='utf8'))
land=Image.open(OUT/'land.png').convert('RGBA');w,h=land.size
strip=Image.new('RGBA',(w*2,h));strip.alpha_composite(land);strip.alpha_composite(land.transpose(Image.Transpose.FLIP_LEFT_RIGHT),(w,0))
# 世界800至1040的真实相邻瓦片采样，与常规地面在1040处对齐。
entry=strip.crop((round(w*.8),0,round(w*1.04),h));mask=Image.new('L',entry.size)
for x in range(entry.width):
 t=x/max(1,entry.width-1);mask.paste(round(255*t*t*(3-2*t)),(x,0,x+1,h))
entry.putalpha(ImageChops.multiply(entry.getchannel('A'),mask));entry.save(OUT/'land_entry.png')
catalog['land_entry']={**catalog['land'],'width':entry.width,'height':h,'source':'technical alpha join from original land bitmap'}
# 原落石架最上方的一块真实石头，用灰色区域蒙版去掉旁边木梁。
rock=Image.open(OUT/'rock_trap.png').convert('RGBA').crop((58,17,133,65));px=rock.load();alpha=rock.getchannel('A');a=alpha.load()
for y in range(rock.height):
 for x in range(rock.width):
  r,g,b,_=px[x,y]
  if not (abs(r-g)<19 and abs(g-b)<22 and 45<r<195):a[x,y]=0
rock.putalpha(alpha);bb=alpha.point(lambda n:255 if n>20 else 0).getbbox();rock=rock.crop(bb);rock.save(OUT/'stone_projectile.png')
catalog['stone_projectile']={'width':rock.width,'height':rock.height,'contentHeight':rock.height,'anchorX':.5,'anchorY':.5,'facing':1,'source':'technical stone crop from original rock trap'}
(OUT/'catalog.json').write_text(json.dumps(catalog,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
print(json.dumps({'landJoin':entry.size,'stoneCrop':rock.size,'source':'original AI pixels and alpha masks only'}))
