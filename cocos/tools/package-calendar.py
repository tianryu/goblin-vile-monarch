"""本轮日期难度试玩归档，保留V11固定包，不执行平台操作。"""
from pathlib import Path
import json,hashlib,shutil,sys,zipfile
ROOT=Path(__file__).resolve().parents[2];qa=ROOT/'qa/cocos'
dest=ROOT/'release/cocos-calendar-20261103-r1';archive=dest.with_suffix('.zip')
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
browser=json.loads((qa/'calendar-browser/final-build5/report.json').read_text(encoding='utf8'))
assert browser['passed']==9 and not browser['errors'] and not browser['failedRequests'] and not browser.get('failure')
assert 'tests 102' in (qa/'calendar-model-final.log').read_text(encoding='utf8') and 'fail 0' in (qa/'calendar-model-final.log').read_text(encoding='utf8')
assert 'Finished in' in (qa/'build-calendar-round5.log').read_text(encoding='utf8')
if sys.argv[1]=='prepare':
 assert not dest.exists() and not archive.exists(),'不覆盖固定交付'
 shutil.copytree(ROOT/'cocos/build/functional-preview-calendar',dest)
 shutil.copytree(ROOT/'release/cocos-v11-20261103-r1/licenses',dest/'licenses')
 shutil.copy2(ROOT/'release/cocos-v11-20261103-r1/launch-local.ps1',dest/'launch-local.ps1')
 shutil.copy2(ROOT/'cocos/tools/serve-preview.py',dest/'serve-local.py')
 launcher=(dest/'launch-local.ps1').read_text(encoding='utf-8-sig')
 launcher=launcher.replace('$taskPort=42827','$taskPort=42828')
 launcher=launcher.replace("@('-m','http.server',\"$taskPort\",'--bind'", "@(('\"'+(Join-Path $taskRoot 'serve-local.py')+'\"'),'--port',\"$taskPort\",'--bind'")
 (dest/'launch-local.ps1').write_text(launcher,encoding='utf-8-sig')
 (dest/'README.txt').write_text('''我是哥布林：君主 日期难度调整试玩版 2026年11月3日

本地试玩：http://127.0.0.1:42828/。本包为本地Web功能预览，不是TapTap上传包，未发布。
使用HTTP服务或launch-local.ps1打开，不能直接双击HTML。
电脑：A/D或方向键左右移动，Shift奔跑，E交互，Q鞭打，R征召，Esc暂停。
手机触控：左横向摇杆，右侧奔跑和情境按钮。没投满离开退款，钱箱可按住取钱。

夜袭只按全局天数：第1/5/10/15/20/21/25/30/32天人数6/14/24/34/44/47/59/74/80。
全联军每晚一支，精锐与Boss计入人数，器械另计，与已攻下的营地无关。
第5天强力单位，第10天冲车，第15天投石车，第20天火焰投石车与夜袭Boss，第30天两辆器械。
所有敌方单位每5天增加5%基础生命、攻击、防御，最高加100%，不复利，不借强化回满血。
留守守备15/30/50/70/30，精锐Boss已包含；不被夜袭抽调，主动攻营仍真实死亡或被俘。
外征部队独立记账，伤亡、预留、撤回与新补员各算一次，回营保留伤势。
前两营仅士兵和帐篷，后期多道围墙、多层真射手箭塔。地图加长，中军与船紧挨。

102项模型检查、类型检查和最终第5轮构建通过；9组浏览器图形/输入通过。
普通经济保守策略已验证到首次攻破斥候营，未注入资源或广告奖励；本轮没有重新跑完整新战役。
固定中期防线对比检查出现破墙与猎手阵亡，属于夹具，不是普通经济胜率统计。
本轮不宣称50%真人败率、实体手机或TapTap宿主已验收。真实广告仍未接入。
试玩新端口与旧版42826存档互相隔离，旧Godot、Cocos固定包和ZIP均保留。
详见工程docs/CALENDAR_IMPLEMENTATION_20261103.md及CHECKPOINT.json。
''',encoding='utf8')
 report={'date':'2026-11-03','checkpoint':'calendar-20261103','kind':'local-functional-preview','url':'http://127.0.0.1:42828/','notTapTapUploadPackage':True,'published':False,'realPhone':False,'realAds':False,'modelChecks':102,'browserGroups':9,'fullNormalEconomyCampaignPassed':False,'ordinaryEconomyMilestone':'first scout conquest, seed731 day10, no ads or injected resources','sourceHashes':{p.relative_to(ROOT).as_posix():sha(p) for p in (ROOT/'cocos/assets/scripts').rglob('*.ts')},'evidence':['qa/cocos/calendar-model-final.log','qa/cocos/calendar-browser/final-build5/report.json','qa/cocos/calendar-battle-comparison.json','qa/cocos/calendar-early-economy/731-attempt1.json','qa/cocos/calendar-first-conquest.json','qa/cocos/build-calendar-round5.log'],'limits':['本轮未重跑普通经济完整新战役','真人败率未统计','手机与TapTap宿主未测','真实广告未接入']}
 (dest/'CHECKPOINT.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf8');print('Prepared '+str(dest))
elif sys.argv[1]=='finalize':
 smoke=json.loads((qa/'calendar-package-smoke.json').read_text(encoding='utf8'));assert smoke.get('started') and smoke.get('saveReload') and not smoke['errors'] and not smoke['failedRequests'];assert not archive.exists()
 report=json.loads((dest/'CHECKPOINT.json').read_text(encoding='utf8'));report['packageSmoke']=smoke
 cold=[json.loads((qa/f'calendar-http11-cold-start-{i}.json').read_text(encoding='utf8')) for i in range(1,4)]
 assert all(r.get('started') and r.get('movement') and r.get('saveReload') and not r['errors'] and not r['failedRequests'] for r in cold)
 assert all(sha(ROOT/p)==expected for p,expected in report['sourceHashes'].items()),'源码与受测构建检查点不一致'
 report['http11IndependentColdStarts']=cold
 report['evidence'] += [f'qa/cocos/calendar-http11-cold-start-{i}.json' for i in range(1,4)]
 report['previewServer']='HTTP/1.1 local server with keep-alive; prior HTTP/1.0 resource failure retained in QA'
 (dest/'CHECKPOINT.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
 files=[{'file':p.relative_to(dest).as_posix(),'bytes':p.stat().st_size,'sha256':sha(p)}for p in sorted(dest.rglob('*'))if p.is_file()]
 (dest/'CHECKSUMS.json').write_text(json.dumps(files,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
 with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED,compresslevel=6)as z:
  for p in dest.rglob('*'):
   if p.is_file():z.write(p,p.relative_to(dest.parent).as_posix())
 with zipfile.ZipFile(archive)as z:assert z.testzip() is None
 report.update(directory=str(dest),archive=str(archive),archiveBytes=archive.stat().st_size,archiveSha256=sha(archive))
 (qa/'calendar-delivery.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
 print(json.dumps({k:report[k]for k in ['url','archive','archiveBytes','archiveSha256','modelChecks','browserGroups']},ensure_ascii=False))
else:raise ValueError('prepare or finalize')
