"""把已有原创AI位图技术裁成关节贴纸，保留原像素；不重画、不生成动作帧。"""
from pathlib import Path
from PIL import Image,ImageDraw,ImageFilter,ImageChops,ImageOps
import json,math
from alpha_cleanup import clean_detached_alpha
ROOT=Path(__file__).resolve().parents[2];SRC=ROOT/'cocos/art/source';OUT=ROOT/'cocos/assets/resources/rigs';OUT.mkdir(parents=True,exist_ok=True)
new=json.loads((SRC/'manifest.json').read_text(encoding='utf8'));old=json.loads((ROOT/'game/art/runtime/manifest.json').read_text(encoding='utf8'))['frames']
# 多边形只定义原位图的裁切边界，转角和动作节拍由运行时提供。
templates={
 'idle':{'root':.5,'head':([(0,0),(1,0),(1,.40),(.4,.46),(.06,.34)],(.58,.39)),
 'legNear':([(.10,.73),(.51,.73),(.52,1),(.06,1)],(.36,.77)),
 'legFar':([(.52,.74),(.94,.74),(.98,1),(.51,1)],(.70,.78))},
 'trader':{'root':.58,'head':([(.23,0),(.9,0),(.9,.34),(.25,.38)],(.57,.32)),
 'legNear':([(.56,.73),(.96,.73),(1,1),(.50,1)],(.65,.76)),
 'legFar':([(.22,.73),(.53,.73),(.50,1),(.10,1)],(.40,.75))},
 'worker':{'root':.55,'head':([(.02,0),(1,0),(1,.38),(.55,.43),(.23,.34)],(.62,.37)),
 'armNear':([(0,.41),(.3,.4),(.42,.5),(.31,.61),(.57,.76),(.48,.92),(.06,.82),(0,.63)],(.30,.45)),
 'armFar':([(.72,.43),(.9,.46),(1,.58),(1,.79),(.77,.78),(.69,.59)],(.76,.48)),
 'legNear':([(.18,.78),(.58,.78),(.59,1),(.12,1)],(.43,.79)),
 'legFar':([(.59,.78),(.86,.78),(1,1),(.58,1)],(.70,.79))},
 'hunter':{'root':.43,'head':([(0,.1),(.64,.1),(.67,.4),(.36,.45),(.02,.35)],(.42,.4)),
 'armFar':([(.81,0),(1,0),(1,1),(.78,1),(.77,.59),(.5,.57),(.47,.44),(.81,.44)],(.5,.47)),
 'armNear':([(.28,.41),(.5,.4),(.59,.46),(.58,.57),(.28,.58),(.18,.51)],(.3,.44)),
 'legNear':([(.10,.75),(.43,.75),(.39,1),(.03,1)],(.29,.77)),
 'legFar':([(.44,.75),(.70,.75),(.79,1),(.40,1)],(.55,.77))},
 'brute':{'root':.55,'head':([(.27,0),(.89,0),(.91,.38),(.48,.43),(.29,.29)],(.66,.35)),
 'armNear':([(0,.03),(.25,.04),(.28,.24),(.47,.35),(.38,.5),(.20,.60),(.20,.78),(0,.78)],(.4,.34)),
 'armFar':([(.73,.31),(1,.28),(1,.90),(.71,.90),(.68,.60)],(.78,.42)),
 'legNear':([(.21,.77),(.57,.77),(.58,1),(.18,1)],(.42,.79)),
 'legFar':([(.58,.78),(.90,.78),(.94,1),(.57,1)],(.73,.81))}
}
catalog={'version':1,'sourcePolicy':'original AI pixels, technical masks, no frame sequences','rigs':{}}
for name in ['idle','worker','worker_2','worker_3','hunter','hunter_2','hunter_3','hunter_4','brute','brute_2','brute_3','trader_pull']:
 role=name.split('_')[0]
 if name not in new and name!='idle' or new.get(name,{}).get('styleRejected'):continue
 if name=='idle':
  f=old[name];im=Image.open(ROOT/'game/art/runtime'/f['sheet']).convert('RGBA').crop((f['x'],f['y'],f['x']+f['w'],f['y']+f['h']))
 else:im=Image.open(SRC/new[name]['file']).convert('RGBA')
 if name.startswith(('hunter','worker','brute','trader')):im=clean_detached_alpha(im)
 box=im.getchannel('A').point(lambda x:255 if x>16 else 0).getbbox();original_w=im.width;im=im.crop(box)
 if new.get(name,{}).get('facing',1)<0:im=ImageOps.mirror(im)
 resolution=128 if name=='idle' else 256
 im=im.resize((round(im.width*resolution/im.height),resolution),Image.Resampling.LANCZOS);w,h=im.size;a=im.getchannel('A');spec=dict(templates[role]);taken=Image.new('L',im.size);masks={}
 if name=='idle':spec['root']=(original_w*old[name].get('pivot_x',.5)-box[0])/(box[2]-box[0])
 for part in ['head','armFar','armNear','legFar','legNear']:
  if part not in spec:continue
  poly,pivot=spec[part];mask=Image.new('L',im.size);ImageDraw.Draw(mask).polygon([(round(x*w),round(y*h)) for x,y in poly],fill=255)
  mask=ImageChops.subtract(mask,taken);taken=ImageChops.lighter(taken,mask);masks[part]=(mask,pivot)
 masks['body']=(ImageChops.invert(taken),(spec['root'],.57))
 pieces=[];reconstructed=Image.new('RGBA',im.size)
 for part in ['armFar','legFar','legNear','body','armNear','head']:
  if part not in masks:continue
  mask,pivot=masks[part]
  # 在真实关节处保留少量同源像素重叠，防止转动露底；不涂补或臆造身体。
  overlap=mask.filter(ImageFilter.MaxFilter(5));pa=ImageChops.multiply(a,overlap)
  cut=im.copy();cut.putalpha(pa);reconstructed.alpha_composite(cut)
  radius=5 if resolution==128 else 8
  padded=Image.new('RGBA',(w+radius*2,h+radius*2));padded.alpha_composite(cut,(radius,radius))
  full=Image.new('L',padded.size);full.paste(a,(radius,radius));outline=ImageChops.subtract(padded.getchannel('A').filter(ImageFilter.MaxFilter(radius*2+1)),full)
  color=(153,236,135,0) if role=='trader' else (255,249,231,0)
  ink=Image.new('RGBA',padded.size,color);ink.putalpha(outline);ink.alpha_composite(padded)
  bb=ink.getchannel('A').point(lambda x:255 if x>12 else 0).getbbox()
  if not bb:continue
  cropped=ink.crop(bb);px=pivot[0]*w+radius-bb[0];py=pivot[1]*h+radius-bb[1]
  pieces.append((part,cropped,{'at':[(pivot[0]-spec['root'])*w,(pivot[1]-1)*h],
   'anchorX':px/cropped.width,'anchorY':1-py/cropped.height,'width':cropped.width,'height':cropped.height,'contentHeight':h,'facing':1}))
 atlas_size=256 if resolution==128 else 512
 atlas=Image.new('RGBA',(atlas_size,atlas_size));x=y=row=0;parts=[]
 for part,picture,meta in sorted(pieces,key=lambda item:item[1].height,reverse=True):
  if x+picture.width+2>atlas_size:x=0;y+=row+2;row=0
  assert y+picture.height<=atlas_size,(name,part,'atlas overflow')
  atlas.alpha_composite(picture,(x,y));parts.append({'name':part,'rect':[x,y,picture.width,picture.height],**meta});x+=picture.width+2;row=max(row,picture.height)
 atlas.save(OUT/(name+'.png'),optimize=True)
 # 静态重组必须覆盖原透明主体，没有人为缺像素。
 missing=ImageChops.subtract(a,reconstructed.getchannel('A'));assert sum(missing.histogram()[1:])==0,(name,'lost source pixels')
 order=['armFar','legFar','legNear','body','armNear','head'];parts.sort(key=lambda p:order.index(p['name']))
 catalog['rigs'][name]={'atlas':name,'height':h,'root':spec['root'],'parts':parts}
(OUT/'catalog.json').write_text(json.dumps(catalog,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
print(json.dumps({'rigs':list(catalog['rigs']),'mode':'cutout parts, original pixels, no generated frames'}))
