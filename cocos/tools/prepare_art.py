"""只裁切已有原创AI位图并制作技术描边，绝不生成替代角色/建筑。"""
from pathlib import Path
import json, shutil, hashlib, math
from PIL import Image, ImageFilter, ImageChops, ImageDraw, ImageFont
from fontTools import subset
from alpha_cleanup import clean_detached_alpha

PROJECT = Path(__file__).resolve().parents[1]
ROOT = PROJECT.parent
OUT = PROJECT / 'assets/resources/art'
OUT.mkdir(parents=True, exist_ok=True)
OLD = ROOT / 'game/art/runtime'
manifest = json.loads((OLD / 'manifest.json').read_text(encoding='utf8'))['frames']
candidate_path=PROJECT/'art/source/manifest.json'
candidates=json.loads(candidate_path.read_text(encoding='utf8')) if candidate_path.exists() else {}
rejected={name for name,spec in candidates.items() if spec.get('styleRejected')}
sources = {}
frames = {}
ALLY = {'idle', 'worker', 'hunter', 'brute', 'monarch', 'rider_boar', 'rider_lizard', 'rider_wolf', 'rider_bat'}
ENEMY = {'human', 'elf', 'dwarf', 'elf_melee', 'human_wounded', 'elf_wounded', 'dwarf_wounded', 'human_dead', 'elf_dead', 'dwarf_dead'}
BUILDING = {'hall1', 'hall2', 'hall3', 'wall1', 'wall2', 'wall3', 'tower', 'tower2', 'net_trap', 'net_trap2', 'rock_trap', 'rock_trap2', 'outpost', 'market_gold', 'market_mount', 'market_army', 'empty_tool_worker', 'empty_tool_hunter', 'empty_tool_brute', 'mushroom_farm', 'woodcut_camp', 'gold_mine', 'prison_front1', 'prison_front', 'prison_front3', 'build_site_sign', 'chest', 'flag', 'tribal_banner'}
SKIP = {'thief', 'tool_thief', 'empty_tool_thief', 'thieves_den', 'thief_2', 'thief_3', 'scrap', 'key', 'hood'}

def output(name, im, edge=None, pivot=.5, padding=0, source='', facing=1):
    im = im.convert('RGBA')
    max_size = (480, 320) if edge in ('ally', 'enemy','merchant') else (1024, 640)
    if im.width > max_size[0] or im.height > max_size[1]:
        im.thumbnail(max_size, Image.Resampling.LANCZOS)
    # 描边在完整alpha之外扩张，保留主体不透明，不在人物内部覆半透明白层。
    a = im.getchannel('A'); bbox = a.point(lambda v:255 if v>16 else 0).getbbox() or (0, 0, im.width, im.height)
    original_w, original_h = im.size
    special_height={'open_chest':70,'lure':110,'forge':125,'repair':158,'gear_pile':44,'ship':312,'catapult':128,'firecatapult':128,'ram':105}
    reference_height = special_height.get(name,34 if edge=='item' else 101 if name.startswith('rider_') else 74 if edge in ('ally','enemy','merchant') else 180 if name in BUILDING else 125)
    radius = max(2, math.ceil((bbox[3]-bbox[1]) * (2.8 if edge in ('ally','enemy','merchant') else 2.2) / reference_height))
    glow_radius = radius + max(2, math.ceil((bbox[3]-bbox[1]) * 2.8/reference_height))
    margin = glow_radius + 2 if edge else 0
    if edge:
        padded = Image.new('RGBA', (im.width + 2*margin, im.height + 2*margin))
        padded.alpha_composite(im, (margin, margin))
        alpha = padded.getchannel('A')
        dilation = alpha.filter(ImageFilter.MaxFilter(radius*2+1))
        color = (244, 224, 172) if edge == 'building' else (153,236,135) if edge=='merchant' else (255, 249, 231) if edge in ('ally','item') else (249, 200, 207)
        base = Image.new('RGBA', padded.size, color + (0,)); base.putalpha(dilation)
        base.alpha_composite(padded); im = base
        # 选中金边单独做技术蒙版，呼吸只调金边强度，不能让对象主体闪烁消失。
        wide = alpha.filter(ImageFilter.MaxFilter(glow_radius*2+1))
        rim = ImageChops.subtract(wide, dilation)
        glow = Image.new('RGBA', im.size, (255, 212, 94, 0)); glow.putalpha(rim)
        glow.save(OUT / (name + '__glow.png'), optimize=True)
    im.save(OUT / (name + '.png'), optimize=True)
    bottom = bbox[3] + margin
    frames[name] = {'width': im.width, 'height': im.height, 'anchorX': (original_w*pivot+margin)/im.width,
                    'anchorY': (im.height-bottom)/im.height, 'contentHeight': bbox[3]-bbox[1], 'source': source, 'facing': facing}
    if edge: frames[name+'__glow'] = {**frames[name], 'source': 'technical alpha dilation'}

for name, frame in manifest.items():
    if name in SKIP or name in rejected: continue
    path = OLD / frame['sheet']
    if path not in sources: sources[path] = Image.open(path).convert('RGBA')
    im = sources[path].crop((frame['x'], frame['y'], frame['x']+frame['w'], frame['y']+frame['h']))
    edge = 'merchant' if name=='trader' else 'item' if name in ('hammer','bow','club','coin') else 'ally' if name in ALLY or name.startswith(('worker_', 'hunter_', 'brute_', 'rider_')) else 'enemy' if name in ENEMY or name.startswith('captive_') else 'building' if name in BUILDING else None
    output(name, im, edge, frame.get('pivot_x', .5), frame.get('padding', 0), str(path.relative_to(ROOT)).replace('\\','/'), facing=-1 if name in ('human','elf','dwarf','elf_melee','trader') else 1)

# 新素材独立生成后放此目录；元数据只指定用途，不凭空重绘图案。
new_manifest = PROJECT / 'art/source/manifest.json'
if new_manifest.exists():
    for name, spec in json.loads(new_manifest.read_text(encoding='utf8')).items():
        if spec.get('styleRejected'):
            print('Skipped style-rejected candidate: '+name)
            continue
        path = PROJECT / 'art/source' / spec['file']
        im = Image.open(path).convert('RGBA')
        if name.startswith(('hunter','worker','brute','trader')) or name in ('forge','gear_pile','territory_marker','cave_floor'):im=clean_detached_alpha(im)
        bbox = im.getchannel('A').point(lambda v:255 if v>16 else 0).getbbox()
        if spec.get('trim', True) and bbox: im = im.crop(bbox)
        # 整体、描边与分件共用脚下转身点，不能各围绕图片包围盒中心翻转。
        pivot=spec.get('pivot',.43 if name.startswith('hunter') else .55 if name.startswith(('worker','brute')) else .5)
        output(name, im, 'merchant' if name=='trader' else spec.get('edge'), pivot, source=str(path.relative_to(ROOT)).replace('\\','/'), facing=spec.get('facing',1))
        if name == 'open_chest':
            # 只裁切同一箱体的低前沿，遮住金币底部，避免金币在箱外悬空。
            bottom = im.crop((0, int(im.height*.66), im.width, im.height))
            output('chest_front', bottom, None, source=str(path.relative_to(ROOT)).replace('\\','/'))
        if name == 'forge':
            armor=im.crop((int(im.width*.46),int(im.height*.26),int(im.width*.66),int(im.height*.51)))
            output('armor_item',armor,'item',source=str(path.relative_to(ROOT)).replace('\\','/'))
        if name=='cave':
            floor=im.crop((int(im.width*.08),int(im.height*.81),int(im.width*.72),int(im.height*.96)))
            output('cave_floor',floor,None,source='technical crop from '+str(path.relative_to(ROOT)).replace('\\','/'))

# 沿既有AI物件取部件，不重新绘制贴图。箭台夹层沿用原笼子的横梁。
f=manifest['prison_front3'];im=Image.open(OLD/f['sheet']).convert('RGBA').crop((f['x'],f['y'],f['x']+f['w'],f['y']+f['h']))
output('cage_divider',im.crop((0,int(im.height*.84),im.width,im.height)),None,source='technical cage-floor crop')
f=manifest['battlefield_wreck'];im=Image.open(OLD/f['sheet']).convert('RGBA').crop((f['x'],f['y'],f['x']+f['w'],f['y']+f['h']))
if 'gear_pile' not in frames:output('gear_pile',im,'item',source='existing AI battlefield wreck, provisional until dedicated pile')

(OUT/'catalog.json').write_text(json.dumps(frames, ensure_ascii=False, indent=2)+'\n',encoding='utf8')
text = ''.join(p.read_text(encoding='utf8') for p in (PROJECT/'assets/scripts').rglob('*.ts'))
chars = set(text) | set(chr(i) for i in range(32, 127)) | set('日金币击倒售出名俘虏运兵船归哥布林首领下了')
font = subset.load_font(str(ROOT/'game/fonts/WenKai-source.ttf'), subset.Options())
subsetter = subset.Subsetter(options=subset.Options()); subsetter.populate(text=''.join(chars)); subsetter.subset(font)
for record in font['name'].names:
    if record.nameID in (1, 4, 6, 16):
        renamed = 'Goblin Hand Cocos' if record.nameID != 6 else 'GoblinHandCocos'
        record.string = renamed.encode(record.getEncoding(), errors='replace')
font.save(PROJECT/'assets/resources/fonts/GoblinHand.ttf')
for p in (ROOT/'game/licenses').glob('*.txt'): shutil.copy2(p, PROJECT/'assets/resources/fonts'/p.name)
audio = ROOT/'game/audio'
if audio.exists():
    for p in audio.iterdir():
        if p.suffix in ['.wav', '.ogg', '.mp3']: shutil.copy2(p, PROJECT/'assets/resources/audio'/p.name)

# 检查用联系表不是游戏资源。
review = ROOT/'qa/cocos'; review.mkdir(parents=True,exist_ok=True)
names = [n for n in frames if not n.endswith('__glow')]
sheet = Image.new('RGB', (1100, ((len(names)+7)//8)*125), '#45554c'); draw=ImageDraw.Draw(sheet)
for i,name in enumerate(names):
    im=Image.open(OUT/(name+'.png')); im.thumbnail((125,96),Image.Resampling.LANCZOS)
    x=(i%8)*137; y=(i//8)*125
    sheet.paste(im,(x+(130-im.width)//2,y),im)
    draw.text((x+3,y+100),name[:22],fill='#fff0ce')
sheet.save(review/'static-art-contact.png')
print(json.dumps({'images': len(frames), 'catalog': str(OUT/'catalog.json'), 'source': 'existing AI bitmaps plus technical outlines'}))
