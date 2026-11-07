"""Export original AI sprites and aligned technical normal maps, without redrawing diffuse art."""
from pathlib import Path
from PIL import Image,ImageFilter
import json,math
import numpy as np

def export_v7(root):
 out=root/'game/art/runtime';source=root/'game/art/source/world-v7';path=out/'manifest.json';m=json.loads(path.read_text(encoding='utf-8'));items=[];review=[]
 for p in sorted(source.glob('*.png')):
  meta=json.loads(p.with_suffix('.source.json').read_text(encoding='utf-8'))
  if not meta.get('review','').startswith('accepted'):raise ValueError('Unreviewed '+p.name)
  im=Image.open(p).convert('RGBA');box=im.getchannel('A').point(lambda x:255 if x>24 else 0).getbbox();im=im.crop(box)
  bounds=(320,320)
  if p.stem.startswith('tree_'):bounds=(480,560)
  elif p.stem in ['mushroom_farm','woodcut_camp','gold_mine','stream_crossing']:bounds=(420,300)
  elif p.stem.endswith(('_dead','_wounded')):bounds=(210,110)
  elif p.stem in ['forest_bird','butterfly']:bounds=(96,96)
  elif p.stem=='forest_shrub':bounds=(240,150)
  elif p.stem=='price_board':bounds=(100,100)
  im.thumbnail(bounds,Image.Resampling.LANCZOS);items.append((p.stem,im));review.append({'name':p.stem,'source':str(p.relative_to(root)),'size':list(im.size),'review':meta['review']})
 atlas=Image.new('RGBA',(2048,4096));x=y=4;row=0
 for name,im in sorted(items,key=lambda v:-v[1].height):
  if x+im.width+4>2048:x=4;y+=row+8;row=0
  if y+im.height+4>4096:raise ValueError('V7 atlas overflow')
  atlas.alpha_composite(im,(x,y));m['frames'][name]={'sheet':'world-v7.png','x':x,'y':y,'w':im.width,'h':im.height};x+=im.width+8;row=max(row,im.height)
 h=math.ceil((y+row+4)/64)*64;atlas=atlas.crop((0,0,2048,h));atlas.save(out/'world-v7.png',optimize=True);m['sheets']['world-v7.png']={'width':2048,'height':h}
 # 原AI人物普通重打包，给实时描边留透明边距，不代画任何角色。
 actor_names=[key for key in m['frames'] if key in ['idle','monarch','trader','human','elf','dwarf','boar','wolf','bat','lizard'] or key.startswith(('worker','hunter','brute','thief','captive_','rider_')) or key.endswith(('_wounded','_dead'))]
 actor_names=[key for key in actor_names if key!='thieves_den']
 actor_atlas=Image.new('RGBA',(2048,2048));ax=ay=8;row_h=0
 for key in sorted(actor_names):
  f=m['frames'][key];im=Image.open(out/f['sheet']).convert('RGBA').crop((f['x'],f['y'],f['x']+f['w'],f['y']+f['h']))
  if ax+im.width+16>2048:ax=8;ay+=row_h+20;row_h=0
  actor_atlas.alpha_composite(im,(ax+8,ay+8));f.update(sheet='actors-ink.png',x=ax+8,y=ay+8,outline=True,padding=8);ax+=im.width+20;row_h=max(row_h,im.height)
 actor_atlas=actor_atlas.crop((0,0,2048,math.ceil((ay+row_h+20)/64)*64));actor_atlas.save(out/'actors-ink.png',optimize=True);m['sheets']['actors-ink.png']={'width':actor_atlas.width,'height':actor_atlas.height}
 # 地面采样使用连续不透明区，避开草尖；位置属于几何元数据。
 f=m['frames']['land'];land=np.asarray(Image.open(out/f['sheet']).convert('RGBA'))[:,:,3];profile=[]
 for column in range(land.shape[1]):
  runs=np.convolve((land[:,column]>220).astype(int),np.ones(7,dtype=int),'valid');hits=np.flatnonzero(runs==7);profile.append(int(hits[0] if len(hits) else 16)+2)
 f['ground_profile']=[round(float(np.median(profile[max(0,i-12):min(len(profile),i+13)])),2) for i in range(len(profile))]
 purse=m['frames']['purse'];m['frames']['purse_rim']=dict(purse);m['frames']['purse_rim']['h']=round(purse['h']*0.40)
 used={f['sheet'] for f in m['frames'].values()};m['sheets']={key:value for key,value in m['sheets'].items() if key in used}
 # Technical normal baking: original alpha and low-frequency diffuse luminance only.
 # Each frame is baked independently, preserving exact atlas coordinates and silhouettes.
 normals={};normal_bytes=0
 world_sheets={f['sheet'] for key,f in m['frames'].items() if not key.startswith('ui_') and key not in ['sky_base','sun','moon','cloud','water','far','middle','foreground','purse','cycle_dial']}
 for name in sorted(world_sheets):
  color=Image.open(out/name).convert('RGBA');normal=Image.new('RGB',color.size,(128,128,255))
  done=set()
  for key,f in m['frames'].items():
   coords=(f['x'],f['y'],f['w'],f['h'])
   if f['sheet']!=name or coords in done:continue
   done.add(coords);im=color.crop((f['x'],f['y'],f['x']+f['w'],f['y']+f['h']))
   rgba=np.asarray(im,dtype=np.float32)/255;alpha=rgba[:,:,3]
   lum=np.asarray(im.convert('L').filter(ImageFilter.GaussianBlur(3)),dtype=np.float32)/255
   smooth=np.asarray(im.getchannel('A').filter(ImageFilter.GaussianBlur(4)),dtype=np.float32)/255
   height=lum*.14+smooth*.55;gy,gx=np.gradient(height)
   nx=-gx*3.2;ny=gy*3.2;nz=np.ones_like(nx);length=np.sqrt(nx*nx+ny*ny+nz*nz)
   rgb=np.stack(((nx/length*.5+.5)*255,(ny/length*.5+.5)*255,(nz/length*.5+.5)*255),axis=-1).astype(np.uint8);rgb[alpha<.02]=(128,128,255)
   normal.paste(Image.fromarray(rgb),(f['x'],f['y']))
  filename='normal-'+name;normal.save(out/filename,optimize=True);normals[name]=filename;normal_bytes+=normal.width*normal.height*4
 torch=m['frames']['torch'];m['frames']['torch_unlit']=dict(torch);m['frames']['torch_unlit']['y']+=round(torch['h']*.33);m['frames']['torch_unlit']['h']=round(torch['h']*.67)
 m['normals']=normals;m['revision']=7;path.write_text(json.dumps(m,ensure_ascii=False,indent=2),encoding='utf-8')
 rgba=sum(v['width']*v['height']*4 for v in m['sheets'].values())
 report={'revision':7,'assets':review,'frames':len(m['frames']),'textures':len(m['sheets']),'normal_maps':normals,'normal_bake':'Aligned diffuse/alpha-derived technical normals, broad matte relief, no new diffuse artwork.','diffuse_rgba_bytes':rgba,'normal_rgba_bytes':normal_bytes,'rgba_bytes':rgba+normal_bytes,'package_budget_paused_by_user':True}
 (root/'qa/godot/v7-asset-audit.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8');print(json.dumps({'v7_frames':len(m['frames']),'rgba_bytes':report['rgba_bytes'],'normal_maps':len(normals)}));return report

if __name__=='__main__':export_v7(Path(__file__).resolve().parents[1])
