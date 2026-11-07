"""固定本批可玩的本地预览，独立启动通过后再归档ZIP，旧交付保持原样。"""
from pathlib import Path
import json,hashlib,shutil,sys,zipfile
ROOT=Path(__file__).resolve().parents[2]
dest=ROOT/'release/cocos-v11-20261103-r1';archive=dest.with_suffix('.zip');qa=ROOT/'qa/cocos'
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
browser=json.loads((qa/'v11-browser/final/report.json').read_text(encoding='utf8'))
assert browser['passed']==8 and not browser['errors'] and not browser['failedRequests'] and not browser.get('failure')
assert 'tests 83' in (qa/'v11-model-final.log').read_text(encoding='utf8') and 'fail 0' in (qa/'v11-model-final.log').read_text(encoding='utf8')
assert 'Finished in' in (qa/'build-v11-round5.log').read_text(encoding='utf8')
if sys.argv[1]=='prepare':
 assert not dest.exists() and not archive.exists(),'不能覆盖旧交付'
 shutil.copytree(ROOT/'cocos/build/functional-preview-v11',dest)
 (dest/'README.txt').write_text('''我是哥布林：君主 V11 本地试玩版 2026年11月3日

本包用于本地测试，不是TapTap上传包，未发布。双击HTML不能运行，使用launch-local.ps1或任意HTTP服务。
当前试玩：http://127.0.0.1:42826/
电脑：A/D或方向键左右移动，Shift奔跑，E交互，Q鞭打，R征召，Esc暂停。
触屏：左摇杆，右侧奔跑和情境图标。投币和取钱可按住，未投满离开退回。

新增：常规五级建筑，木构逐渐改为砖石和铁制结构；装备仅三级，对应主屋1/3/5。
低人口经济、阶段增兵、第五天大型精锐、普通跃墙兵、六类精锐与三类Boss。
修前线领装备、真实驻塔、工匠墙后工作、远战场回收、重伤撤离、商人来回路线。
原有捕俘、缴械、装备改造、军旗集结/付币出征/驻守继续/回撤均保留。
新游戏默认四名爪牙；出征没有日期硬锁。祭坛和多人只待办。

83项模型、类型检查、八组浏览器图形及输入通过。
无广告普通策略两个种子通关，分别约147和173分钟；另一个种子中军推进超时。
不能据此认定真人败率或35至50分钟的时长目标达成，请重点体验成长等待和前线往返。
软件WebGL压力检查单列，实体手机、TapTap宿主与真实广告未测试。
广告未接入配置，不伪造观看完成。旧Godot与旧Cocos文件均保留。

完整玩法、材质表和验收见工程docs/V11_IMPLEMENTATION_20261103.md。
''',encoding='utf8')
 (dest/'launch-local.ps1').write_text(r'''$ErrorActionPreference='Stop'
$taskRoot=$PSScriptRoot
$taskPort=42827
while(Get-NetTCPConnection -State Listen -LocalPort $taskPort -ErrorAction SilentlyContinue){$taskPort++}
$taskPython=Join-Path $env:USERPROFILE '.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe'
$taskPrefix=@()
if(-not(Test-Path -LiteralPath $taskPython)){
 $taskCommand=Get-Command py -ErrorAction SilentlyContinue
 if($taskCommand){$taskPython=$taskCommand.Source;$taskPrefix=@('-3')}
 else{$taskPython=(Get-Command python -ErrorAction Stop).Source}
}
$taskArguments=$taskPrefix+@('-m','http.server',"$taskPort",'--bind','127.0.0.1','--directory',('"'+$taskRoot+'"'))
$taskServer=Start-Process -FilePath $taskPython -ArgumentList $taskArguments -WindowStyle Hidden -PassThru
$taskServer.Id | Set-Content -LiteralPath (Join-Path $taskRoot 'server.pid')
Start-Sleep -Milliseconds 500
Start-Process ("http://127.0.0.1:"+$taskPort+'/')
''',encoding='utf-8-sig')
 licenses=dest/'licenses';licenses.mkdir()
 for p in (ROOT/'game/licenses').glob('*.txt'):shutil.copy2(p,licenses/p.name)
 engine=Path('C:/Develop/Cocos/Creator/3.8.8/resources/resources/3d/engine')
 shutil.copy2(engine/'LICENSE.md',licenses/'Cocos-LICENSE.md')
 shutil.copytree(engine/'licenses',licenses/'Cocos-third-party')
 shutil.copy2(ROOT/'scripts/references/pixelfx/LICENSE',licenses/'pixelfx-MIT.txt')
 report={'date':'2026-11-03','checkpoint':'v11-20261103','kind':'local-cocos-functional-preview','url':'http://127.0.0.1:42826/','notTapTapUploadPackage':True,'published':False,'realPhone':False,'realAds':False,'modelChecks':83,'browserGroups':8,'normalEconomyWinningSeeds':[731,2026],'incompleteSeed':1103,'balanceLimits':'真人败率未测，保守控制器147至173分钟，第三种子中军推进超时','buildLog':'qa/cocos/build-v11-round5.log','sourceHashes':{p.relative_to(ROOT).as_posix():sha(p) for p in (ROOT/'cocos/assets/scripts').rglob('*.ts')},'evidence':['qa/cocos/v11-model-final.log','qa/cocos/v11-browser/final/report.json','qa/cocos/v11-diagnostics.json','qa/cocos/v11-render-stress.json','qa/cocos/v11-render-stress-first-failure.json'],'deferred':['真人乐趣与难度确认','手机与TapTap宿主','真实广告','祭坛和多人待办']}
 (dest/'CHECKPOINT.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
 print('Prepared immutable preview: '+str(dest))
elif sys.argv[1]=='finalize':
 smoke=json.loads((qa/'v11-package-smoke.json').read_text(encoding='utf8'))
 assert smoke.get('started') and smoke.get('movement') and smoke.get('saveReload') and not smoke['errors'] and not smoke['failedRequests']
 assert not archive.exists()
 report=json.loads((dest/'CHECKPOINT.json').read_text(encoding='utf8'));report['independentPackageSmoke']=smoke
 (dest/'CHECKPOINT.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
 manifest=[{'file':p.relative_to(dest).as_posix(),'bytes':p.stat().st_size,'sha256':sha(p)}for p in sorted(dest.rglob('*'))if p.is_file()]
 (dest/'CHECKSUMS.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
 with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED,compresslevel=6)as z:
  for p in dest.rglob('*'):
   if p.is_file():z.write(p,p.relative_to(dest.parent).as_posix())
 with zipfile.ZipFile(archive)as z:assert z.testzip() is None
 report.update(directory=str(dest),archive=str(archive),archiveBytes=archive.stat().st_size,archiveSha256=sha(archive))
 (qa/'v11-delivery.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
 print(json.dumps({k:v for k,v in report.items()if k not in ['sourceHashes','independentPackageSmoke']},ensure_ascii=False,indent=2))
else:raise ValueError('prepare or finalize')
