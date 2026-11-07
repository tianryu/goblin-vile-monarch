"""归档本轮本地试玩检查点，保留历史交付，不执行任何平台操作。"""
from pathlib import Path
import hashlib,json,shutil,zipfile
ROOT=Path(__file__).resolve().parents[2]
qa=ROOT/'qa/cocos/repair-20261103'
build=ROOT/'cocos/build/functional-preview-r11'
dest=ROOT/'release/cocos-repair-20261103-r1'
archive=dest.with_suffix('.zip')
assert not dest.exists() and not archive.exists(),'不得覆盖已有检查点'
inputs=json.loads((qa/'round3-input/report.json').read_text(encoding='utf8'))
focused=json.loads((qa/'round4-focused/report.json').read_text(encoding='utf8'))
recovery=json.loads((qa/'round5-recovery/report.json').read_text(encoding='utf8'))
assert inputs['passed']==11 and not inputs['errors'] and not inputs['failedRequests']
assert focused['passed']==5 and not focused['errors'] and not focused.get('failure')
assert recovery['passed']==3 and not recovery['errors'] and not recovery.get('failure')
assert 'tests 61' in (qa/'model-final.log').read_text(encoding='utf8')
assert 'fail 0' in (qa/'model-final.log').read_text(encoding='utf8')
assert 'Finished in' in (ROOT/'qa/cocos/build-repair-20261103-round5.log').read_text(encoding='utf8')
shutil.copytree(build,dest)
readme='''我是哥布林：君主 本地修复试玩版 2026年11月3日

本包是Cocos本地功能预览，不是TapTap可上传包，未上传、审核或发布。
请用HTTP服务打开目录，不能直接双击index.html。当前开发服务为http://127.0.0.1:42824/。
电脑：A/D或方向键移动，Shift奔跑，E交互，Q鞭打，R征召，Esc暂停。
触屏：左侧横向摇杆，右侧奔跑和情境图标，投币和取钱可按住。
没有投完离开会退款。出征不设日期门槛，条件满足即可出发。

本轮61项模型检查通过。定向浏览器证据覆盖11组原输入检查与8组修复表现检查；
它们分属第3、4、5轮对应源码，详细证据见CHECKPOINT.json。
普通经济整局的自动策略在推进第二营时失败，整局平衡未通过。
五级建筑、新难度、普通跃墙兵和强力单位重设计仍待实现，祭坛仅记录。
手机性能、TapTap宿主和真实广告均未验收。广告不可用时不伪造奖励。
旧Godot、稳定Cocos包和旧ZIP均保留，不被本检查点替换。
'''
(dest/'README.txt').write_text(readme,encoding='utf8')
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
sources={str(p.relative_to(ROOT)).replace('\\','/'):sha(p) for p in (ROOT/'cocos/assets/scripts').rglob('*.ts')}
report={'date':'2026-11-03','kind':'local-functional-repair-preview','url':'http://127.0.0.1:42824/',
 'notTapTapUploadPackage':True,'published':False,'realPhone':False,'realAds':False,'fullNormalEconomyCampaignPassed':False,
 'modelChecks':61,'inputGroups':11,'focusedGroups':8,
 'evidence':['qa/cocos/repair-20261103/model-final.log','qa/cocos/repair-20261103/round3-input/report.json','qa/cocos/repair-20261103/round4-focused/report.json','qa/cocos/repair-20261103/round5-recovery/report.json'],
 'scopeNotes':'输入检查为第3轮，表现为第4轮，战役状态及旗帜回退在第5轮复测；不拼成全部路径均在最终版重新验收的结论。',
 'sourceHashes':sources,'deferred':['普通经济战役与难度','五级建筑配套','普通跃墙兵与强力单位重设计','部分人物和建筑美术精修','手机与TapTap验收']}
(dest/'CHECKPOINT.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
manifest=[{'file':str(p.relative_to(dest)).replace('\\','/'),'bytes':p.stat().st_size,'sha256':sha(p)}for p in sorted(dest.rglob('*'))if p.is_file()]
(dest/'CHECKSUMS.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED,compresslevel=6)as z:
 for p in dest.rglob('*'):
  if p.is_file():z.write(p,p.relative_to(dest.parent).as_posix())
with zipfile.ZipFile(archive)as z:assert z.testzip() is None
report.update(directory=str(dest),archive=str(archive),archiveBytes=archive.stat().st_size,archiveSha256=sha(archive))
(qa/'checkpoint.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
print(json.dumps({k:v for k,v in report.items()if k!='sourceHashes'},ensure_ascii=False,indent=2))
