"""Aggregate only current v5 evidence; never treat file budgets as phone measurements."""
from pathlib import Path
import json,hashlib,zipfile,re
from PIL import Image
from fontTools.ttLib import TTFont
R=Path(__file__).resolve().parents[1]
def read(p):return json.loads((R/p).read_text(encoding='utf-8-sig'))
checks=[];fails=[]
def check(name,ok): (checks if ok else fails).append(name)
reports={}
for name in ['model-tests','finishing-model-tests','interaction-model-tests','ui-native-v5-tests','interaction-browser-tests','mobile-layout-v5-tests','boot-audio-tests']:
    d=read('qa/godot/'+name+'.json');reports[name]={'passes':len(d['passes']),'failures':d.get('failures',[]),'errors':d.get('errors',d.get('console',[]))}
    check(name+' accepted',not d.get('failures') and not d.get('errors') and not d.get('exception') and len(d['passes'])>0)
smoke=read('qa/godot/release-smoke.json');check('Release smoke accepted',all(smoke['tests'].values()) and not smoke.get('errors'))
reports['release-smoke']={'passes':sum(smoke['tests'].values())}
manifest=read('game/art/runtime/manifest.json');frames=manifest['frames']
rank_names=[r+'_'+str(i) for r in ['worker','hunter','brute','thief'] for i in [2,3]]
check('All eight gear images share one atlas',len({frames[n]['sheet'] for n in rank_names})==1)
check('Every frame fits its atlas',all(f['x']>=0 and f['y']>=0 and f['x']+f['w']<=manifest['sheets'][f['sheet']]['width'] and f['y']+f['h']<=manifest['sheets'][f['sheet']]['height'] for f in frames.values()))
design=read('art/design/interaction-v5/design-manifest.json')
check('23 independent layout page images are present',len(design['pages'])==23 and all((R/'art/design/interaction-v5'/ (p['id']+'.png')).exists() for p in design['pages']) and not design['errors'])
check('23 design images have the intended landscape size',all(Image.open(R/'art/design/interaction-v5'/(p['id']+'.png')).size==(960,480) for p in design['pages']))
mapping={'world':'coin-ghost-empty','loading':'release-loading','error':'release-error','rotate':'rotate','victory':'960-victory','defeat':'960-defeat','guide-1':'960-guide'}
for n in range(2,5):mapping['guide-'+str(n)]='960-guide-'+str(n)
check('Every design page has a corresponding actual screenshot',all((R/'qa/interaction-v5'/(mapping.get(p['id'],'960-'+p['id'])+'.png')).exists() for p in design['pages']))
copy_files=list((R/'game/scripts').glob('*.gd'))+list((R/'game/data').glob('*.json'))+list((R/'docs').glob('*.md'))+list((R/'art/design/interaction-v5').glob('*.html'))+[R/'art/design/interaction-v5/layouts.js']
check('First-party current copy avoids the prohibited separator',all(chr(183) not in p.read_text(encoding='utf-8-sig') for p in copy_files))
cjk=set()
for p in (R/'game/scripts').glob('*.gd'):
    cjk.update(c for c in p.read_text(encoding='utf-8-sig') if '\u3400'<=c<='\u9fff')
font=TTFont(R/'game/fonts/GoblinHand-game.ttf')
check('All CJK source copy has glyphs in the bundled subset',cjk.issubset(set(chr(k) for k in font.getBestCmap())))
names={r.toUnicode() for r in font['name'].names if r.nameID in [1,4,6,16]}
check('Modified font family is renamed',all('LXGW' not in s and '霞鹜' not in s for s in names))
boot=read('qa/godot/boot-asset-audit.json');icon_bytes=128*128*4
graphics=boot['conservative_runtime_plus_boot_rgba_bytes']+icon_bytes
check('Runtime plus loader and splash image stay inside 24 MiB',graphics<=24*1024*1024)
campaign=read('qa/godot/interaction-campaign-bot.json')
check('All three actual coin-contribution campaigns win without ads',len(campaign['runs'])==3 and all(r['stats']['status']=='won' and r['receipts']==0 for r in campaign['runs']))
package=read('qa/godot/release-package.json');zpath=R/'release/goblin-monarch-web.zip'
check('Release ZIP matches its recorded hash',hashlib.sha256(zpath.read_bytes()).hexdigest()==package['zip_sha256'])
with zipfile.ZipFile(zpath) as z:
    check('Release ZIP has one root and valid members',z.testzip() is None and {n.split('/')[0] for n in z.namelist()}=={'goblin-monarch'})
performance=read('qa/godot/stress-browser-v5.json')
check('Final high-DPI stress completes without runtime errors',performance['duration_seconds']>=300 and not performance['errors'])
check('Stress includes the intended sixty friendly units',all(s['state']['population']==60 for s in performance['samples']))
report={'scope':'V5 local model/browser/export acceptance. Not phone, live TapTap SDK or platform approval.',
        'checks':checks,'failures':fails,'reports':reports,'scenario_assertion_count':sum(r['passes'] for r in reports.values()),
        'graphics_single_copy_bytes_including_boot_and_splash':graphics,'frames':len(frames),'texture_sheets':len(manifest['sheets']),
        'package':package,'stress':{'duration_seconds':performance['duration_seconds'],'frame_interval_ms':performance['frame_interval_ms'],'software_dpr2_p95_target_ms':40,'software_dpr2_p95_target_met':performance['frame_interval_ms']['p95']<=40},
        'visual_similarity_percent':None,'visual_review':'23 separately saved layout prototypes paired with real runtime scenes; manual page and pose review. No fabricated perceptual percentage.',
        'unverified':['Physical Android and iOS performance and thumb reach','TapTap host and real rewarded SDK','Independent perceptual 90 percent score and platform release']}
(R/'qa/godot/v5-acceptance.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({'checks':len(checks),'failures':fails,'scenario_assertions':report['scenario_assertion_count'],'bitmap_bytes':graphics,'software_dpr2_p95':report['stress']['frame_interval_ms']['p95']}))
raise SystemExit(bool(fails))

