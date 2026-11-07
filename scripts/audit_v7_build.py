"""Aggregate only current V7 evidence; never promote desktop checks to phone validation."""
from pathlib import Path
from PIL import Image
from fontTools.ttLib import TTFont
import json,hashlib,zipfile
R=Path(__file__).resolve().parents[1]
def read(path):return json.loads((R/path).read_text(encoding='utf-8-sig'))
checks=[];failures=[];reports={}
def check(name,ok):(checks if ok else failures).append(name)
for name in ['v7-model-tests','v7-advanced-tests','v7-native-tests','v7-browser-tests','v7-service-tests','v7-release-tests','v7-boot-tests']:
 d=read('qa/godot/'+name+'.json');reports[name]={'passes':len(d['passes']),'failures':d.get('failures',[]),'errors':d.get('errors',[])};check(name+' passes',bool(d['passes']) and not d.get('failures') and not d.get('errors') and not d.get('exception'))
m=read('game/art/runtime/manifest.json');frames=m['frames'];sheets=m['sheets'];a=read('qa/godot/v7-asset-audit.json')
check('V7 manifest and 30 individually reviewed independent sprites',m.get('revision')==7 and len(a['assets'])==30 and all(i['review'].startswith('accepted') for i in a['assets']))
check('Every sprite fits its own atlas',all(0<=f['x'] and 0<=f['y'] and f['x']+f['w']<=sheets[f['sheet']]['width'] and f['y']+f['h']<=sheets[f['sheet']]['height'] for f in frames.values()))
check('All 16 normal atlases match diffuse coordinates and dimensions',len(m['normals'])>=16 and all(Image.open(R/'game/art/runtime'/n).size==Image.open(R/'game/art/runtime'/d).size for d,n in m['normals'].items()))
normal=read('qa/godot/v7-normal-contribution.json');check('Normal maps visibly contribute to the lighting shader',normal['changed_pixels']>1000 and normal['max_channel_delta']>2)
copy=list((R/'game/scripts').glob('*.gd'))+list((R/'docs').glob('*.md'))+[R/'AGENTS.md',R/'art/design/world-v7/index.html']
check('First-party copy has no middle dot separator',all(chr(183) not in p.read_text(encoding='utf-8-sig') for p in copy))
cjk={c for p in (R/'game/scripts').glob('*.gd') for c in p.read_text(encoding='utf-8-sig') if '\u3400'<=c<='\u9fff'};font=TTFont(R/'game/fonts/GoblinHand-game.ttf');check('Bundled font covers active Chinese source copy',cjk.issubset({chr(k) for k in font.getBestCmap()}))
names={r.toUnicode() for r in font['name'].names if r.nameID in [1,4,6,16]};check('Modified OFL font has a renamed family',all('LXGW' not in n and '霞鹜' not in n for n in names))
main=(R/'game/scripts/main.gd').read_text(encoding='utf-8');check('Only result is a modal game state','open_panel' not in main and 'menu_controller' not in main and all(v in ['','result'] for v in __import__('re').findall(r'modal\s*=\s*"([^"]*)"',main)))
c=read('qa/godot/v7-campaigns.json');check('Three no-ad normal-economy campaigns achieve both flags',len(c['runs'])==3 and all(r['stats']['status']=='won' and r['receipts']==0 and r['stats']['hero_hp']>0 and all(r['stats']['flags'].values()) for r in c['runs']))
pkg=read('qa/godot/release-package.json');z=R/'release/goblin-monarch-web.zip';check('Current ZIP hash matches production export',hashlib.sha256(z.read_bytes()).hexdigest()==pkg['zip_sha256'])
with zipfile.ZipFile(z) as pack:
 check('ZIP is intact and has one root folder',pack.testzip() is None and {n.split('/')[0] for n in pack.namelist()}=={'goblin-monarch'})
 check('Package includes required licenses',any(n.endswith('/LICENSES.txt') for n in pack.namelist()))
s=read('qa/godot/v7-soak.json');check('Five-minute full day/night soak remains alive without runtime errors',s['duration_seconds']>=300 and not s['errors'] and s['all_alive'] and s['observed_night'] and s['observed_torches'])
b=read('qa/godot/boot-asset-audit.json');rgba=b['conservative_runtime_plus_boot_rgba_bytes']+128*128*4
report={'scope':'Current V7 model, desktop browser, local Web package and artifact checks. No actual phone, SDK or platform validation.','checks':checks,'failures':failures,'reports':reports,'scenario_assertion_count':sum(r['passes'] for r in reports.values()),'campaigns':c['runs'],'new_independent_assets':len(a['assets']),'frames':len(frames),'diffuse_sheets':len(sheets),'normal_sheets':len(m['normals']),'runtime_rgba_bytes':a['rgba_bytes'],'runtime_boot_splash_rgba_bytes':rgba,'budget_paused_by_user':True,'package':pkg,'stress':{'duration_seconds':s['duration_seconds'],'frame_interval_ms':s['frame_interval_ms'],'software_dpr2_p95_target_ms':40,'software_dpr2_p95_target_met':s['frame_interval_ms']['p95']<=40},'visual_review':'Actual V7 screenshots manually checked: flat style, normal-lit day/night, no tool sellers or explanatory dialogs, tool stock, price signs, treasury, bodies, depth, thumb controls and allowed results. Not an independent similarity score.','visual_similarity_percent':None,'unverified':['Physical Android/iOS and low-end device performance','Real TapTap host and rewarded advertisement SDK','Independent 90 percent visual similarity','Platform release']}
(R/'qa/godot/v7-acceptance.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8');print(json.dumps({'checks':len(checks),'failures':failures,'scenario_assertions':report['scenario_assertion_count'],'graphics_rgba_bytes':rgba,'stress':report['stress']}));raise SystemExit(bool(failures))
