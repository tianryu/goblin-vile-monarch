"""逐项保存人工风格结论，提供只引用实际旧位图的比对板。"""
from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
import json
ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'qa/cocos/style-audit'; OLD=ROOT/'game/art/runtime'
inventory=json.loads((OUT/'inventory.json').read_text(encoding='utf8'))
manifest=json.loads((OLD/'manifest.json').read_text(encoding='utf8'))['frames']
replace_old={
 'worker':'改为白衣大锤职业外观，使用同身份局部修改版本。',
 'hunter':'改为红衣职业外观，移除握弓姿势内烘焙箭矢。',
 'brute':'强化厚血近战的盾斧轮廓，保留原脸型与哑光画法。',
 'worker_2':'旧棕色装备不符合白衣职业识别，铠甲划痕太密。',
 'worker_3':'旧棕色装备不符合白衣职业识别，铠甲材质过重。',
 'hunter_2':'旧装棕色且带烘焙箭，盔甲磨损过密。',
 'hunter_3':'旧装棕色且带烘焙箭，盔甲磨损过密。',
 'brute_2':'铠甲划痕过密，统一成几块哑光面。',
 'brute_3':'铠甲划痕过密，统一成几块哑光面。',
 'tribal_banner':'黑色漫画轮廓过重，重做为工具摊布条的平面画法。',
 'captive_human':'战俘还保留头盔，不符合扒除装备。'}
reject_new={
 'open_chest':'粗黑边、亮边与强立体木纹偏图标，需贴近旧chest与wheel。',
 'shield':'粗黑漫画线和密集斑驳铁盔，需贴近现有人类兵。',
 'mage':'粗黑漫画线与高反差色边，需贴近现有人类兵。',
 'hunter_2':'身体平涂与写实磨损金属混用。',
 'catapult':'黑边、木纹刻画和亮金属使画法偏厚重图标。',
 'ram':'厚重装备图标画法，纹理和体积比旧木器强。',
 'firecatapult':'材质、亮边与立体明暗太重。',
 'ship':'绳索密集、线条过于规整，偏矢量插画。',
 'forge':'外圈黑线偏漫画，阴影反差比旧工具摊高。'}
accept_new={
 'worker':'原脸型、破边轮廓和哑光色块延续旧worker，白衣大锤符合职业要求。',
 'hunter':'红衣配色符合要求，身体和木弓为大色块，未烘焙箭，须结合实际尺寸复核。',
 'brute':'盾斧分手，紧凑厚实轮廓，金属为少数哑光块，无密集纹理。',
 'cave':'蓝灰大块低反差岩层，与远景和主厅可共处。',
 'rabbit':'无黑漫画边的哑光灰褐色块，轮廓清楚。',
 'deer':'少量平面褐色块，造型与现有坐骑同属卡通。',
 'lure':'粗木和破布为低反差色块，无粗黑漫画线。'}
for item in inventory['assets']:
 name=item['asset']; base=name.removeprefix('new:')
 if name.startswith('new:'):
  status='replace' if base in reject_new else 'approved-source'
  reason=reject_new.get(base,accept_new.get(base,''))
 elif item['group']=='historical-unused':
  status='archived-unused';reason='旧方案、旧UI或已取消玩法，不进入Cocos资源清单，原文件保留。'
 elif base in replace_old:status='superseded';reason=replace_old[base]
 elif base=='wall2':status='repair-crop';reason='画法可保留，右侧邻帧残片应技术裁切清理。'
 elif base=='torch':status='archived-unused';reason='火焰改实时程序效果，保留torch_unlit柄体。'
 elif base in ('human_wounded','human_dead','dwarf_wounded','dwarf_dead','elf_wounded','elf_dead'):
  status='archived-unused';reason='画法接近但携带完整装备，V9已扒装状态不采用该旧贴图。'
 else:status='approved-source';reason='同底色对照已查看，保持哑光近色块与不规则边缘；不是像素或3D图标画法。'
 item.update(reviewStatus=status,reviewReason=reason)
(OUT/'reviews.json').write_text(json.dumps(inventory,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
font=ImageFont.truetype(str(ROOT/'game/fonts/WenKai-source.ttf'),18)
for group,names in {'wood-style':['wheel','chest','rock_trap','empty_tool_worker'],
                    'character-style':['worker','hunter','human','brute']}.items():
 board=Image.new('RGBA',(1024,420),'#53655b');d=ImageDraw.Draw(board)
 for i,name in enumerate(names):
  f=manifest[name];im=Image.open(OLD/f['sheet']).convert('RGBA').crop((f['x'],f['y'],f['x']+f['w'],f['y']+f['h']))
  box=im.getchannel('A').point(lambda v:255 if v>16 else 0).getbbox();im=im.crop(box)
  # References never scale down further than necessary and contain no new drawing.
  im.thumbnail((244,340),Image.Resampling.LANCZOS)
  d.text((i*256+10,10),name,font=font,fill='#fff1ca')
  board.alpha_composite(im,(i*256+128-im.width//2,225-im.height//2))
 board.convert('RGB').save(OUT/(group+'.jpg'),quality=96)
from collections import Counter
print(json.dumps(dict(Counter(i['reviewStatus'] for i in inventory['assets'])),ensure_ascii=False))
