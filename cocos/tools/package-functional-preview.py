"""固定本地功能测试检查点；不创建、上传或发布TapTap应用。"""
from pathlib import Path
import json,shutil,hashlib,zipfile
ROOT=Path(__file__).resolve().parents[2]
build=ROOT/'cocos/build/functional-preview';dest=ROOT/'release/cocos-functional-20261102-r2'
report=json.loads((ROOT/'qa/cocos/playtest/report.json').read_text(encoding='utf8'))
assert report['passed']==15 and report['failed']==0 and not report['logs']
assert not dest.exists(),'检查点目录已存在，不覆盖'
shutil.copytree(build,dest)
(dest/'README.txt').write_text('我是哥布林：君主 Cocos功能测试版\n\n本地试玩入口：http://127.0.0.1:42821/\n离线包请用本地HTTP服务打开，不能直接双击index.html。Windows可以运行launch-local.ps1。\n\n电脑：A/D或方向键移动，Shift奔跑，E交互，Q鞭打，R征召，Esc暂停。\n触屏：左侧横向摇杆，右侧奔跑和情境图标。投币按钮可按住，没投完离开会退回。\n自动存档使用独立Cocos键，不覆盖旧Godot档。\n\n25项模型检查、15项浏览器检查通过，含横屏触控、自动存档读回、支付退款和胜负重开。后期胜利使用测试夹具验证，普通经济完整战役的自动策略仍未通过，后期防线与补给节奏继续调整。\n人物和建筑美术精修暂缓，恶霸持斧朝向待修。广告未接入真实配置，当前不可用。\n本包是本地功能测试版，不是TapTap上传包，未上传或发布。\n',encoding='utf8')
launcher=r'''$ErrorActionPreference='Stop'
$taskRoot=$PSScriptRoot
$taskPort=42822
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
'''
(dest/'launch-local.ps1').write_text(launcher,encoding='utf-8-sig')
files=[]
for p in dest.rglob('*'):
 if p.is_file():files.append({'file':p.relative_to(dest).as_posix(),'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()})
(dest/'CHECKSUMS.json').write_text(json.dumps(files,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
archive=ROOT/'release/cocos-functional-20261102-r2.zip'
with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED,compresslevel=6) as z:
 for p in dest.rglob('*'):
  if p.is_file():z.write(p,p.relative_to(dest.parent).as_posix())
with zipfile.ZipFile(archive) as z:assert z.testzip() is None
result={'target':'local-functional-preview','notTapTapUploadPackage':True,'directory':str(dest),'url':'http://127.0.0.1:42821/','archive':str(archive),'bytes':archive.stat().st_size,'sha256':hashlib.sha256(archive.read_bytes()).hexdigest(),'fileCount':len(files)+1,'modelChecks':25,'browserChecks':report['passed'],'realPhone':False,'realAds':False,'fullNormalEconomyCampaignPassed':False,'sourceBuildLog':'qa/cocos/build-functional-round2.log','deferred':['character/building art polish','brute axe orientation','normal-economy full-campaign strategy and balance']}
(ROOT/'qa/cocos/functional-delivery.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
print(json.dumps(result,ensure_ascii=False))
