"""Ordinary trimming, atlas packing and font subsetting. Does not generate art."""
from pathlib import Path
import json, math, re
import hashlib
from PIL import Image, ImageDraw
from fontTools import subset
from fontTools.varLib.instancer import instantiateVariableFont
from collections import deque

ROOT=Path(__file__).resolve().parents[1]
SOURCE=ROOT/'game/art/source/flat-v3'
OUTPUT=ROOT/'game/art/runtime'
OUTPUT.mkdir(parents=True,exist_ok=True)
jobs=json.loads((ROOT/'game/art/jobs.json').read_text(encoding='utf-8'))['jobs']
jobs=[{'name':'far','kind':'layer','transparent':True}]+jobs
frames={}; sheets={}; sprites=[]; report=[]; missing=[]
rename={'celestial':['sun','moon','cloud'],'captives':['captive_human','captive_dwarf','captive_elf'],
        'hall':['hall1','hall2','hall3'],'wall':['wall1','wall2','wall3'],
        'loot':['coin','scrap','arrow','wheel','key','chest','flag','net','rope','hammer','bow','club','crown','hood','pocket','arrows']}
overrides={'stall':'stall-final','wagon':'wagon-square'}

def connected_regions(image):
    """Find existing separated atlas objects; this only determines crop rectangles."""
    alpha=image.getchannel('A');width,height=image.size
    mask=bytearray(1 if v>24 else 0 for v in alpha.tobytes());regions=[]
    for index in range(width*height):
        if not mask[index]:continue
        mask[index]=0;queue=deque([index]);left=right=index%width;top=bottom=index//width;area=0
        while queue:
            p=queue.popleft();xx=p%width;yy=p//width;area+=1
            left=min(left,xx);right=max(right,xx);top=min(top,yy);bottom=max(bottom,yy)
            for neighbor in ([p-1] if xx>0 else [])+([p+1] if xx<width-1 else [])+([p-width] if yy>0 else [])+([p+width] if yy<height-1 else []):
                if mask[neighbor]:mask[neighbor]=0;queue.append(neighbor)
        if area>300:regions.append((area,(max(0,left-2),max(0,top-2),min(width,right+3),min(height,bottom+3))))
    regions=[r[1] for r in sorted(regions,reverse=True)[:16]]
    regions.sort(key=lambda b:(b[1]+b[3])/2)
    ordered=[]
    for row in range(4):ordered.extend(sorted(regions[row*4:row*4+4],key=lambda b:b[0]))
    return ordered if len(ordered)==16 else []
for job in jobs:
    name=job['name']; path=SOURCE/(overrides.get(name,name)+'.png')
    if not path.exists():
        if name in overrides and (SOURCE/(name+'.png')).exists():
            # Rejected candidates are intentionally not included.
            pass
        missing.append(name);continue
    image=Image.open(path).convert('RGBA');w,h=image.size
    a=image.getchannel('A'); hist=a.histogram()
    report.append({'name':name,'source':path.name,'width':w,'height':h,'transparent_fraction':hist[0]/(w*h),'partial_alpha_fraction':sum(hist[1:255])/(w*h)})
    if job['kind']=='layer':
        target=(512,256) if name=='water' else (960,480)
        slots={'far':(0.30,0.65),'middle':(0.00,0.65),'land':(0.63,0.77),'foreground':(0.85,1.0)}
        if name in slots:
            bounds=a.point(lambda v:255 if v>24 else 0).getbbox()
            top,bottom=slots[name]
            content=image.crop((0,bounds[1],w,bounds[3]))
            content=content.resize((target[0],round(target[1]*(bottom-top))),Image.Resampling.LANCZOS)
            image=Image.new('RGBA',target)
            image.alpha_composite(content,(0,round(target[1]*top)))
            report[-1]['layout_slot']=[top,bottom]
            report[-1]['source_vertical_bounds']=[bounds[1],bounds[3]]
        else:image=image.resize(target,Image.Resampling.LANCZOS)
        filename=name+'.png';image.save(OUTPUT/filename,optimize=True)
        sheets[filename]={'width':target[0],'height':target[1]}
        frames[name]={'sheet':filename,'x':0,'y':0,'w':target[0],'h':target[1]}
        continue
    count=3 if job['kind']=='atlas3' else (16 if job['kind']=='atlas4' else 1)
    cols=4 if count==16 else count;rows=4 if count==16 else 1
    column_regions=[]
    prop_regions=connected_regions(image) if count==16 else []
    if count==3:
        projection=[max(a.crop((xx,0,xx+1,h)).getdata())>24 for xx in range(w)]
        occupied=[];start=None
        for xx,value in enumerate(projection+[False]):
            if value and start is None:start=xx
            if not value and start is not None:occupied.append([start,xx]);start=None
        merged=[]
        for interval in occupied:
            if merged and interval[0]-merged[-1][1]<14:merged[-1][1]=interval[1]
            else:merged.append(interval)
        if len(merged)==3:column_regions=merged
    for i in range(count):
        box=prop_regions[i] if prop_regions else ((column_regions[i][0],0,column_regions[i][1],h) if column_regions else (round(i%cols*w/cols),round(i//cols*h/rows),round((i%cols+1)*w/cols),round((i//cols+1)*h/rows)))
        item=image.crop(box)
        bounds=item.getchannel('A').point(lambda v:255 if v>24 else 0).getbbox()
        if not bounds:missing.append(name+':empty');continue
        item=item.crop(bounds)
        max_h=128
        if name in ['hall','stall','wall','tower','net_trap','rock_trap','outpost','wagon'] or name.startswith('prison_'):max_h=180
        if name=='loot':max_h=96
        ratio=min(max_h/item.height,300/item.width,1)
        item=item.resize((max(1,round(item.width*ratio)),max(1,round(item.height*ratio))),Image.Resampling.LANCZOS)
        key=rename.get(name,[name])[i];sprites.append((key,item))
atlas=Image.new('RGBA',(1024,2048));x=y=2;rowh=0
for key,item in sorted(sprites,key=lambda p:-p[1].height):
    if x+item.width+2>1024:x=2;y+=rowh+3;rowh=0
    if y+item.height+2>2048:raise RuntimeError('Atlas exceeded2048')
    atlas.alpha_composite(item,(x,y));frames[key]={'sheet':'actors.png','x':x,'y':y,'w':item.width,'h':item.height}
    x+=item.width+3;rowh=max(rowh,item.height)
height=math.ceil(max(64,y+rowh+2)/64)*64
atlas=atlas.crop((0,0,1024,height));atlas.save(OUTPUT/'actors.png',optimize=True);sheets['actors.png']={'width':1024,'height':height}
manifest={'frames':frames,'sheets':sheets,'static_only':True}
(OUTPUT/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf-8')
qa=ROOT/'qa/godot';qa.mkdir(parents=True,exist_ok=True)
(qa/'asset-audit.json').write_text(json.dumps({'assets':report,'missing':missing,'frames':len(frames),'rgba_bytes':sum(v['width']*v['height']*4 for v in sheets.values()),'production_png_bytes':sum((OUTPUT/f).stat().st_size for f in sheets)},indent=2),encoding='utf-8')
# Review sheets display unchanged source imagery only, resized for inspection.
for start in range(0,len(report),8):
    page=Image.new('RGB',(1000,600),'#657269');draw=ImageDraw.Draw(page)
    for i,record in enumerate(report[start:start+8]):
        im=Image.open(SOURCE/record['source']).convert('RGBA');im.thumbnail((240,255),Image.Resampling.NEAREST)
        xx=(i%4)*250+(250-im.width)//2;yy=(i//4)*300+28
        page.paste(im,(xx,yy),im);draw.text(((i%4)*250+8,(i//4)*300+6),record['name'],fill='white')
    page.save(qa/f'assets-review-{start//8+1}.png')
# The active renamed WenKai subset is produced by prepare_v5_assets only.
icon=Image.open(SOURCE/'monarch.png').convert('RGBA');icon=icon.crop(icon.getchannel('A').getbbox());icon.thumbnail((128,128),Image.Resampling.LANCZOS)
icon_canvas=Image.new('RGBA',(128,128));icon_canvas.alpha_composite(icon,((128-icon.width)//2,(128-icon.height)//2));icon_canvas.save(OUTPUT/'app_icon.png')
print(json.dumps({'frames':len(frames),'missing':missing,'rgba_bytes':sum(v['width']*v['height']*4 for v in sheets.values()),'atlas_height':height}))
from prepare_polish_assets import export_polish
export_polish(ROOT)
from prepare_v5_assets import export_v5
export_v5(ROOT)
from prepare_v6_assets import export_v6
export_v6(ROOT)
from prepare_v7_assets import export_v7
export_v7(ROOT)
from prepare_v8_ground import export_ground
export_ground(ROOT)
from prepare_v8_fire_assets import export_fire_assets
export_fire_assets(ROOT)
