"""归档当前反馈修复本地包，不覆盖旧包，不访问平台。"""
from pathlib import Path
import hashlib,json,shutil,sys,zipfile
root=Path(__file__).resolve().parents[2];qa=root/'qa/cocos';dest=root/'release/cocos-patrol-20261103-r1';archive=dest.with_suffix('.zip')
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def dump(p,value):p.write_text(json.dumps(value,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
browser=json.loads((qa/'patrol-browser/final-build6/report.json').read_text(encoding='utf8'))
assert browser['passed']==9 and not browser['errors'] and not browser['failedRequests'] and not browser.get('failure')
assert 'pass 18' in (qa/'patrol-model-final.log').read_text(encoding='utf8')
assert 'pass 6' in (qa/'patrol-related-regression-final.log').read_text(encoding='utf8')
assert 'Finished in' in (qa/'build-patrol-round6.log').read_text(encoding='utf8')
if sys.argv[1]=='prepare':
    assert not dest.exists() and not archive.exists(),'保留已归档版本'
    shutil.copytree(root/'cocos/build/functional-preview-patrol',dest)
    shutil.copytree(root/'release/cocos-calendar-20261103-r1/licenses',dest/'licenses')
    shutil.copy2(root/'cocos/tools/serve-preview.py',dest/'serve-local.py')
    shutil.copy2(root/'release/cocos-calendar-20261103-r1/launch-local.ps1',dest/'launch-local.ps1')
    (dest/'README.txt').write_text('''我是哥布林：君主 巡游与试玩修复版 2026年11月3日

本地预览：http://127.0.0.1:42828/。使用launch-local.ps1或HTTP/1.1服务打开。
本包为本地功能预览，不是TapTap上传包，没有执行平台发布，真实广告未启用。
键盘：A/D或方向键移动，Shift奔跑，E交互，Q鞭打，R征召，Esc暂停。
手机界面：左侧横向摇杆，右侧奔跑和情境按钮。奔跑按钮下方绿色条是体力。

鞭打会掉出私藏金币、上交途中金币与携带的装备，钱袋挂在腰部。
工匠原地举锤后落锤，身体顿挫，选中光边随关节移动，不再留下静态姿势。
敌营不悬挂名字与兵力数量。广告金币为第一天10，此后每天加1，未模拟广告成功。
夜袭部队不因伤亡或天亮撤退，全部倒地后遗留工程器械。
监牢保留升级维修，只在人类商人处售俘，金币先进入钱袋，超过50存入主厅。
白天地面猎手狩猎、恶霸巡游护卫，敌营派2至3名普通外征巡逻兵。
约半屏600单位内比较双方战斗人员，较少的一方撤离，接近傍晚回防。
巡逻兵不抽驻军或当晚预留编制，不改变按日期计算的夜袭军队。
完好敌墙双向阻挡首领和所有坐骑，逐道拆毁后通过，按墙宽与坐骑身位留距离。

18项新模型与6项关联回归、类型检查、第6轮构建、9组桌面浏览器图形和输入通过。
不继承旧完整战役通关与真人胜率，不宣称实体手机、TapTap宿主或真实广告已验证。
详细修复台账位于项目docs/PLAYTEST_FOLLOWUP_20261103.md。
''',encoding='utf8')
    report={'checkpoint':'patrol-20261103','date':'2026-11-03','url':'http://127.0.0.1:42828/','modelChecks':18,'relatedRegressionChecks':6,'browserGroups':9,'realPhone':False,'realAds':False,'published':False,'notTapTapUploadPackage':True,'fullCampaignRerun':False,'sourceHashes':{p.relative_to(root).as_posix():sha(p) for p in (root/'cocos/assets/scripts').rglob('*.ts')},'evidence':['qa/cocos/patrol-model-final.log','qa/cocos/patrol-related-regression-final.log','qa/cocos/patrol-browser/final-build6/report.json','qa/cocos/build-patrol-round6.log']}
    dump(dest/'CHECKPOINT.json',report);print('Prepared '+str(dest))
elif sys.argv[1]=='finalize':
    assert not archive.exists()
    report=json.loads((dest/'CHECKPOINT.json').read_text(encoding='utf8'))
    assert all(sha(root/p)==value for p,value in report['sourceHashes'].items()),'源码已变，不能混用验收'
    smoke=json.loads((qa/'patrol-package-smoke.json').read_text(encoding='utf8'))
    assert smoke.get('started') and smoke.get('saveReload') and not smoke['errors'] and not smoke['failedRequests']
    report['packageSmoke']=smoke;report['evidence'].append('qa/cocos/patrol-package-smoke.json');dump(dest/'CHECKPOINT.json',report)
    dump(dest/'CHECKSUMS.json',[{'file':p.relative_to(dest).as_posix(),'bytes':p.stat().st_size,'sha256':sha(p)} for p in sorted(dest.rglob('*')) if p.is_file()])
    with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED,compresslevel=6)as z:
        for p in dest.rglob('*'):
            if p.is_file():z.write(p,p.relative_to(dest.parent).as_posix())
    with zipfile.ZipFile(archive)as z:assert z.testzip() is None
    report.update(directory=str(dest),archive=str(archive),archiveBytes=archive.stat().st_size,archiveSha256=sha(archive));dump(qa/'patrol-delivery.json',report)
    print(json.dumps({k:report[k] for k in ['url','archiveBytes','archiveSha256','modelChecks','relatedRegressionChecks','browserGroups']}))
else:raise ValueError('prepare or finalize')
