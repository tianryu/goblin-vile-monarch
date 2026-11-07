"""Collate existing local acceptance evidence and verify the delivered package."""
from pathlib import Path
import json,hashlib,zipfile
r=Path(__file__).resolve().parents[1];q=r/'qa/godot'
def read(name):return json.loads((q/(name+'.json')).read_text(encoding='utf-8'))
sources=['model-tests','finishing-model-tests','browser-tests','finishing-browser-tests','boot-audio-tests']
checks=[]
for source in sources:
    d=read(source)
    if d.get('exception') or d.get('failures'):raise SystemExit('Failed evidence: '+source)
    checks.append({'source':source+'.json','passed':len(d['passes'])})
release=read('release-smoke')
if not all(release['tests'].values()):raise SystemExit('Release smoke failed')
checks.append({'source':'release-smoke.json','passed':len(release['tests'])})
p=read('release-package');archive=r/'release/goblin-monarch-web.zip'
if hashlib.sha256(archive.read_bytes()).hexdigest()!=p['zip_sha256']:raise SystemExit('ZIP hash mismatch')
with zipfile.ZipFile(archive) as z:
    if z.testzip() is not None or not all(n.startswith('goblin-monarch/') for n in z.namelist()):raise SystemExit('Invalid archive')
stress=read('stress-browser');campaign=read('campaign-bot')
if stress['errors'] or not all(run['stats']['status']=='won' for run in campaign['runs']):raise SystemExit('Stress or campaign evidence failed')
raw=(r/'build/release-web/index.pck').read_bytes()
for excluded in ['game/art/source','res://qa/','res://build/','res://assets/','res://art/','NotoSansSC-source','MaShanZheng-source']:
    if excluded.encode() in raw:raise SystemExit('Unexpected resource in package: '+excluded)
data={'scope':'Local static-texture client acceptance only. Not platform certification.','checks':checks,'total_local_checks':sum(c['passed'] for c in checks),'campaigns_won':len(campaign['runs']),'stress_seconds':stress['duration_seconds'],'frame_interval_ms':stress['frame_interval_ms'],'runtime_bitmap_rgba_bytes':read('polish-asset-audit')['rgba_bytes'],'runtime_plus_boot_bitmap_rgba_bytes':read('boot-asset-audit')['conservative_runtime_plus_boot_rgba_bytes'],'zip_bytes':p['zip_bytes'],'zip_sha256':p['zip_sha256'],'deferred':['Character frame animations by user request'],'not_verified':['Physical Android/iOS phone and TapTap host','Live ads SDK and new platform application configuration','Platform app identity and release review','90 percent match against user-approved new same-view target art']}
(q/'final-acceptance.json').write_text(json.dumps(data,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({'local_checks':data['total_local_checks'],'campaigns_won':data['campaigns_won'],'zip_bytes':data['zip_bytes'],'zip_sha256':data['zip_sha256']}))
