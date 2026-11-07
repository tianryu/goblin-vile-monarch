"""生成完整美术复核联系表和逐项清单，不修改原始位图。"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import hashlib,json
ROOT=Path(__file__).resolve().parents[2]
OLD=ROOT/'game/art/runtime';PROJECT=ROOT/'cocos';OUT=ROOT/'qa/cocos/style-audit';OUT.mkdir(parents=True,exist_ok=True)
old=json.loads((OLD/'manifest.json').read_text(encoding='utf8'))['frames']
new=json.loads((PROJECT/'art/source/manifest.json').read_text(encoding='utf8'))
font=ImageFont.truetype(str(ROOT/'game/fonts/WenKai-source.ttf'),18)
characters=set('monarch worker worker_2 worker_3 hunter hunter_2 hunter_3 brute brute_2 brute_3 idle human elf dwarf elf_melee captive_human captive_elf captive_dwarf human_wounded human_dead elf_wounded elf_dead dwarf_wounded dwarf_dead trader rider_boar rider_lizard rider_wolf rider_bat boar lizard wolf bat'.split())
environment=set('far sky_base land water middle foreground sun moon cloud tree_pine tree_willow tree_oak forest_shrub stream_crossing forest_bird butterfly'.split())
buildings=set('hall1 hall2 hall3 wall1 wall2 wall3 tower tower2 net_trap net_trap2 rock_trap rock_trap2 outpost market_gold market_army market_mount empty_tool_worker empty_tool_hunter empty_tool_brute prison_back1 prison_back prison_back3 prison_front1 prison_front prison_front3 mushroom_farm woodcut_camp gold_mine battlefield_wreck build_site_sign hall_ruin tribal_banner'.split())
unused=set('thief thief_2 thief_3 tool_thief empty_tool_thief thieves_den scrap key hood rider_boar_bare rider_lizard_bare rider_wolf_bare rider_bat_bare tool_worker tool_hunter tool_brute stall price_board ui_action_control ui_button ui_button_primary ui_context ui_hud ui_panel ui_button_v5 ui_card_selected_v5 ui_card_v5 ui_primary_v5 ui_run_control'.split())
groups={};records=[]
def read_old(name,f):
 im=Image.open(OLD/f['sheet']).convert('RGBA');return im.crop((f['x'],f['y'],f['x']+f['w'],f['y']+f['h']))
def add(name,im,group,source,status):
 records.append({'asset':name,'group':group,'source':source,'sha256':hashlib.sha256(im.tobytes()).hexdigest(),'reviewStatus':status})
 groups.setdefault(group,[]).append((name,im))
for name,f in old.items():
 group='historical-unused' if name in unused else 'characters' if name in characters else 'environment' if name in environment else 'buildings' if name in buildings else 'props-ui'
 add(name,read_old(name,f),group,'game/art/runtime/'+f['sheet'],'pending-comparison')
for name,spec in new.items():
 add('new:'+name,Image.open(PROJECT/'art/source'/spec['file']).convert('RGBA'),'new-candidates','cocos/art/source/'+spec['file'],'rejected-style' if spec.get('styleRejected') else 'pending-comparison')
pages=[]
for group,items in groups.items():
 for page in range((len(items)+11)//12):
  subset=items[page*12:(page+1)*12];board=Image.new('RGBA',(1280,900),'#53655b');d=ImageDraw.Draw(board)
  for i,(name,im) in enumerate(subset):
   box=im.getchannel('A').point(lambda v:255 if v>16 else 0).getbbox();im=im.crop(box) if box else im
   im.thumbnail((290,240),Image.Resampling.LANCZOS)
   x=i%4*320;y=i//4*300;d.text((x+12,y+10),name,fill='#fff1ca',font=font);board.alpha_composite(im,(x+160-im.width//2,y+55+(240-im.height)//2))
  file=OUT/(group+'-'+str(page+1)+'.jpg');board.convert('RGB').save(file,quality=94);pages.append(str(file.relative_to(ROOT)))
(OUT/'inventory.json').write_text(json.dumps({'count':len(records),'assets':records,'pages':pages},ensure_ascii=False,indent=2)+'\n',encoding='utf8')
print(json.dumps({'count':len(records),'groups':{k:len(v) for k,v in groups.items()},'pages':pages},ensure_ascii=False))
