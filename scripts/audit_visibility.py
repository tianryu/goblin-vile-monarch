"""Current batch only: verify evidence, geometry assets, skill archive and local package."""
from pathlib import Path
from fontTools.ttLib import TTFont
from PIL import Image
import json,zipfile,hashlib,re
R=Path(__file__).resolve().parents[1]
def read(p):return json.loads((R/p).read_text(encoding='utf-8-sig'))
passed=[];failed=[];reports={}
def check(n,ok):(passed if ok else failed).append(n)
for n in ['v7-model-tests','v7-advanced-tests','v7-native-tests','visibility-model-tests','visibility-browser-tests','v7-browser-tests','v7-service-tests','v7-release-tests','v7-boot-tests']:
 d=read('qa/godot/'+n+'.json');reports[n]={'passes':len(d['passes']),'failures':d.get('failures',[]),'errors':d.get('errors',[])};check(n+' current checks pass',bool(d['passes']) and not d.get('failures') and not d.get('errors') and not d.get('exception'))
m=read('game/art/runtime/manifest.json');check('All sprite regions and outline padding stay in their atlas',all(f['x']>=f.get('padding',0) and f['y']>=f.get('padding',0) and f['x']+f['w']+f.get('padding',0)<=m['sheets'][f['sheet']]['width'] and f['y']+f['h']+f.get('padding',0)<=m['sheets'][f['sheet']]['height'] for f in m['frames'].values()))
actors=['idle','worker','hunter','brute','thief','monarch','trader','human','elf','dwarf','captive_human','captive_elf','captive_dwarf','rider_boar','rider_lizard','rider_wolf','rider_bat']
check('Both factions, trader, prisoners and complete riders have outline padding',all(m['frames'][n].get('outline') and m['frames'][n].get('padding',0)>=8 for n in actors))
check('Normal maps align with active diffuse sheets',bool(m['normals']) and all(Image.open(R/'game/art/runtime'/n).size==Image.open(R/'game/art/runtime'/d).size for d,n in m['normals'].items()))
check('Ground contact metadata follows the original land width',len(m['frames']['land'].get('ground_profile',[]))==960)
world=(R/'game/scripts/world.gd').read_text(encoding='utf-8');check('Repeated planted prices are no longer rendered','func _price_sign' not in world and 'sprite("price_board"' not in world)
copy=list((R/'game/scripts').glob('*.gd'))+list((R/'docs').glob('*.md'))+[R/'AGENTS.md',Path(r'C:/Users/田煜/.codex/AGENTS.md')]
check('Current first-party copy avoids middle dot separators',all(chr(183) not in p.read_text(encoding='utf-8-sig') for p in copy))
hud=(R/'game/scripts/minimal_hud.gd').read_text(encoding='utf-8');visible=''.join(re.findall(r'"([^"\n]*)"',hud))+'无法启动重试我是哥布林君主';chars={c for c in visible if '\u3400'<=c<='\u9fff'};font=TTFont(R/'game/fonts/GoblinHand-game.ttf');check('Bundled font contains current visible Chinese labels',chars.issubset({chr(c) for c in font.getBestCmap()}))
base=Path(r'C:/Users/田煜/Desktop/Godot/Games/soushen/outputs/tianryu_game_development_skill_20261031');skill=base/'tianruy游戏开发规范.skill';installed=Path(r'C:/Users/田煜/.codex/skills/tianruy-game-development-standards')
with zipfile.ZipFile(skill) as z:
 check('Renamed skill archive is intact and has the requested root',z.testzip() is None and {n.split('/')[0] for n in z.namelist()}=={'tianruy-game-development-standards'})
 check('Installed skill exactly matches the distribution files',all((installed/Path(n).relative_to('tianruy-game-development-standards')).read_bytes()==z.read(n) for n in z.namelist()))
 check('Skill contains the global transition reference',any(n.endswith('/references/visibility-transitions.md') for n in z.namelist()))
with zipfile.ZipFile(base/'_history/tianryu游戏开发规范.original.skill') as z:check('Original skill remains recoverable',z.testzip() is None)
pkg=read('qa/godot/release-package.json');pack=R/'release/goblin-monarch-web.zip';check('Production ZIP matches the recorded digest',hashlib.sha256(pack.read_bytes()).hexdigest()==pkg['zip_sha256'])
with zipfile.ZipFile(pack) as z:check('Production ZIP is intact with one root',z.testzip() is None and {n.split('/')[0] for n in z.namelist()}=={'goblin-monarch'})
files=list((R/'game/scripts').glob('*.gd'))+list((R/'game/shaders').glob('*.gdshader'))+[R/'scripts/prepare_v7_assets.py',R/'scripts/prepare_web_shell.py'];hashes={str(p.relative_to(R)):hashlib.sha256(p.read_bytes()).hexdigest() for p in files}
report={'scope':'Current display/grounding/outline/skill batch with local model, native, desktop browser and Web export evidence. No full campaign, live ads or physical phone claims.','checks':passed,'failures':failed,'reports':reports,'scenario_assertions':sum(r['passes'] for r in reports.values()),'source_sha256':hashes,'active_frames':len(m['frames']),'diffuse_sheets':len(m['sheets']),'normal_sheets':len(m['normals']),'asset_audit':read('qa/godot/v7-asset-audit.json'),'boot_audit':read('qa/godot/boot-asset-audit.json'),'short_frame_diagnostic':read('qa/godot/visibility-browser-tests.json')['short_frame_diagnostic'],'package':pkg,'skill':{'package':str(skill),'sha256':hashlib.sha256(skill.read_bytes()).hexdigest(),'installed':str(installed),'format_validator':'quick_validate.py succeeded with UTF-8 mode and existing local PyYAML dependency'},'visual_review':'Actual captures reviewed for opacity stages, grounding, wide bottom coin pile, transparent purse, two-line captions, role outlines, cage containment and glow occlusion. No independent perceptual percentage.','unverified':['Physical Android/iOS and low-end performance','TapTap host and real advertisement SDK','Independent 90 percent visual similarity','Five-minute stress on this revised renderer','Platform release']}
(R/'qa/godot/visibility-acceptance.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8');print(json.dumps({'checks':len(passed),'failures':failed,'scenario_assertions':report['scenario_assertions'],'skill_sha256':report['skill']['sha256'],'package_sha256':pkg['zip_sha256']}));raise SystemExit(bool(failed))
