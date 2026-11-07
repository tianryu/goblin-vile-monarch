"""Aggregate current V6 evidence. File estimates are not phone memory measurements."""
from pathlib import Path
from PIL import Image
from fontTools.ttLib import TTFont
import hashlib,json,zipfile
R=Path(__file__).resolve().parents[1]
def read(p):return json.loads((R/p).read_text(encoding='utf-8-sig'))
checks=[];fails=[];reports={}
def check(label,ok):(checks if ok else fails).append(label)
for name in ['model-tests','finishing-model-tests','interaction-model-tests','world-v6-model-tests','ui-native-v5-tests','world-v6-browser-tests','world-v6-regression-tests','boot-audio-tests']:
    d=read('qa/godot/'+name+'.json');reports[name]={'passes':len(d['passes']),'failures':d.get('failures',[]),'errors':d.get('errors',[])}
    check(name+' current run passes',bool(d['passes']) and not d.get('failures') and not d.get('errors') and not d.get('exception'))
d=read('qa/godot/release-smoke.json');check('Production export smoke passes',all(d['tests'].values()) and not d.get('errors'));reports['release-smoke']={'passes':sum(d['tests'].values())}
manifest=read('game/art/runtime/manifest.json');frames=manifest['frames'];sheets=manifest['sheets']
check('Current manifest is V6',manifest.get('revision')==6)
check('Every sprite fits its atlas',all(0<=f['x'] and 0<=f['y'] and f['x']+f['w']<=sheets[f['sheet']]['width'] and f['y']+f['h']<=sheets[f['sheet']]['height'] for f in frames.values()))
check('All twelve new assets share the architecture atlas',len({frames[n]['sheet'] for n in ['build_site_sign','tool_worker','tool_hunter','tool_brute','tool_thief','market_gold','market_army','market_mount','thieves_den','battlefield_wreck','hall_ruin','heart_icon']})==1)
source=R/'game/art/source/world-v6';metadata=[read(str(p.relative_to(R))) for p in source.glob('*.source.json')]
check('Twelve independent assets have accepted reviews and prompts',len(metadata)==12 and all(m.get('prompt') and m.get('review','').startswith('accepted') for m in metadata))
check('Transparent environment strips preserve vertical layout offsets',all(frames[n].get('layer_span',1)<1 and frames[n].get('layer_top',-1)>=0 and frames[n]['layer_top']+frames[n]['layer_span']<=1 for n in ['far','middle','land','foreground']))
copy_files=list((R/'game/scripts').glob('*.gd'))+list((R/'docs').glob('*.md'))+[R/'AGENTS.md',R/'art/design/world-v6/index.html']
check('Current first-party copy avoids middle dot separators',all(chr(183) not in p.read_text(encoding='utf-8-sig') for p in copy_files))
cjk={c for p in (R/'game/scripts').glob('*.gd') for c in p.read_text(encoding='utf-8-sig') if '\u3400'<=c<='\u9fff'}
font=TTFont(R/'game/fonts/GoblinHand-game.ttf');cmap={chr(k) for k in font.getBestCmap()}
check('All gameplay Chinese has glyphs in bundled font',cjk.issubset(cmap))
names={r.toUnicode() for r in font['name'].names if r.nameID in [1,4,6,16]};check('Modified font family remains renamed',all('LXGW' not in n and '霞鹜' not in n for n in names))
boot=read('qa/godot/boot-asset-audit.json');graphics=boot['conservative_runtime_plus_boot_rgba_bytes']+128*128*4
check('Runtime loader and splash RGBA stays inside 24 MiB file budget',graphics<=24*1024*1024)
campaign=read('qa/godot/world-v6-campaign-bot.json');check('Three normal economy campaigns win without ads',len(campaign['runs'])==3 and all(r['stats']['status']=='won' and r['receipts']==0 and r['stats']['hero_hp']>0 for r in campaign['runs']))
pkg=read('qa/godot/release-package.json');zp=R/'release/goblin-monarch-web.zip';check('ZIP hash matches current production package',hashlib.sha256(zp.read_bytes()).hexdigest()==pkg['zip_sha256'])
with zipfile.ZipFile(zp) as z:check('ZIP is intact with a single root',z.testzip() is None and {n.split('/')[0] for n in z.namelist()}=={'goblin-monarch'})
stress=read('qa/godot/stress-browser-v6.json');check('Five-minute native-DPR2 stress has no runtime errors',stress['duration_seconds']>=300 and not stress['errors'])
report={'scope':'V6 current local model, browser, export and file-budget evidence. No phone or live TapTap approval claims.','checks':checks,'failures':fails,'reports':reports,'scenario_assertion_count':sum(d['passes'] for d in reports.values()),'campaigns':campaign['runs'],'frames':len(frames),'textures':len(sheets),'runtime_rgba_bytes':read('qa/godot/v6-asset-audit.json')['rgba_bytes'],'runtime_boot_splash_rgba_bytes':graphics,'package':pkg,'stress':{'duration_seconds':stress['duration_seconds'],'frame_interval_ms':stress['frame_interval_ms'],'software_dpr2_p95_target_ms':40,'software_dpr2_p95_target_met':stress['frame_interval_ms']['p95']<=40},'visual_review':'Actual V6 screenshots manually inspected for signs, ghosts, ground contact, cage containment, anchors, taller silhouettes and UI. No invented perceptual score.','visual_similarity_percent':None,'unverified':['Physical Android/iOS and low-end performance','TapTap host and real rewarded SDK','Independent 90 percent perceptual score','Platform release']}
(R/'qa/godot/v6-acceptance.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8');print(json.dumps({'build_checks':len(checks),'failures':fails,'scenario_assertions':report['scenario_assertion_count'],'graphics_rgba_bytes':graphics,'stress':report['stress']}));raise SystemExit(bool(fails))
