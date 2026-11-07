"""候选帧的透明、裁切、冻结哈希和同坐标源RGB核对；不代替轮廓观看。"""
from pathlib import Path
from PIL import Image
import numpy as np,json,argparse,hashlib,subprocess,sys,gzip,shutil
ROOT=Path(__file__).resolve().parents[1]

def audit(folder,compact_source=False):
    folder=Path(folder).resolve();m=json.loads((folder/'manifest.json').read_text('utf-8'))
    failures=[];checks=[];full=folder/'audit-source-rgba';full.mkdir(exist_ok=True)
    for i,index in enumerate(m['source_indices']):
        name=f'frame_{index:03d}.png';raw=Image.open(folder/'raw'/name).convert('RGB');alpha=Image.open(folder/'masks'/name).convert('L')
        rgba=raw.convert('RGBA');rgba.putalpha(alpha);rgba.save(full/name)
        output=Image.open(folder/'frames'/f'frame_{i:03d}.png').convert('RGBA')
        if output.size!=(m['width'],m['height']):failures.append('Canvas mismatch '+name)
        a=np.asarray(output)[:,:,3]
        if np.any(a[0,:]) or np.any(a[-1,:]) or np.any(a[:,0]) or np.any(a[:,-1]):failures.append('Visible pixels reach frame edge '+name)
        if m.get('png_sha256',{}).get(f'frame_{i:03d}.png') not in [None,hashlib.sha256((folder/'frames'/f'frame_{i:03d}.png').read_bytes()).hexdigest()]:failures.append('Frozen PNG changed '+name)
    tool=Path.home()/'.codex/skills/game-sprite-animation/scripts/sprite_assets.py'
    # 全局工具会输出逐像素坐标，完整证据写文件，避免将GB级报告重复驻留内存。
    evidence=folder/'source-rgb-audit.json'
    if compact_source:
        from audit_animation_source_v8 import audit_source
        source_report,source_path=audit_source(folder,m)
        checks.append({'name':'Full original-video RGB, shared RGBA transform and atlas pixel audit','passed':source_report['passed']})
        failures+=source_report['failures']
    else:
        with (folder/'source-rgb-tool.log').open('w',encoding='utf-8') as log:
            result=subprocess.run([sys.executable,'-X','utf8',str(tool),'audit','--before',str(folder/'raw'),'--after',str(full),'--mode','source-rgb','--report',str(evidence)],stdout=subprocess.DEVNULL,stderr=log)
        checks.append({'name':'Global sprite tool same-coordinate RGB audit','passed':result.returncode==0})
        if result.returncode:failures.append('Global audit failed; see source-rgb-tool.log and full report')
    # 无损压缩保留完整原报告。校验解压后哈希一致，才替换本次生成的大文件。
    evidence_record={}
    if compact_source:evidence_record={'file':source_path.name,'sha256':hashlib.sha256(source_path.read_bytes()).hexdigest(),'bytes':source_path.stat().st_size}
    if evidence.exists() and evidence.stat().st_size>10*1024*1024:
        digest=hashlib.file_digest(evidence.open('rb'),'sha256').hexdigest()
        packed=evidence.with_suffix('.json.gz')
        with evidence.open('rb') as src,gzip.open(packed,'wb',compresslevel=1) as dst:shutil.copyfileobj(src,dst)
        with gzip.open(packed,'rb') as src:restored=hashlib.file_digest(src,'sha256').hexdigest()
        if restored!=digest:raise ValueError('Audit archive verification failed')
        evidence_record={'file':packed.name,'uncompressed_sha256':digest,'uncompressed_bytes':evidence.stat().st_size}
        evidence.unlink()
    if m['asset']=='hunter' and m['action']=='shoot':
        a=np.asarray(Image.open(folder/'masks/frame_015.png'));passed=not np.any(a[260:380,900:1280])
        checks.append({'name':'Detached release arrow has zero visible alpha','passed':bool(passed)})
        if not passed:failures.append('Detached arrow remains')
        body=[(560,370),(580,255),(470,560),(685,560)]
        passed=all(a[y,x]>250 for x,y in body);checks.append({'name':'Release retains independent head torso and boot probes','passed':bool(passed)})
        if not passed:failures.append('Body foreground missing')
        bad=np.asarray(Image.open(folder.parent/'matte-v01/masks/frame_015.png'))
        checks.append({'name':'Known bad matte fails the same foreground check','passed':bool(any(bad[y,x]<250 for x,y in body))})
        for index in [36,37]:
            a=np.asarray(Image.open(folder/'masks'/f'frame_{index:03d}.png'));passed=np.count_nonzero(a[300:370,870:1040])>500
            checks.append({'name':f'Nocked arrow remains complete in source frame {index}','passed':bool(passed)})
            if not passed:failures.append('Nocked arrow clipped '+str(index))
    report={'scope':'Technical source RGB, alpha and crop checks. Sparse foreground probes do not prove all contours; source and three-background visual review remains required.',
            'frames':len(m['source_indices']),'checks':checks,'source_evidence':evidence_record,'failures':failures,'passed':not failures and all(c['passed'] for c in checks)}
    (folder/'technical-audit.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps(report));return 0 if report['passed'] else 1

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('folder');p.add_argument('--compact-source',action='store_true');a=p.parse_args();sys.exit(audit(a.folder,a.compact_source))
