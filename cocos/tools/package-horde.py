"""归档本轮本地试玩构建；不启动游戏、执行自动测试或触碰平台。"""
from pathlib import Path
import hashlib,json,shutil,zipfile

root=Path(__file__).resolve().parents[2]
qa=root/'qa/cocos/horde-20261104'
dest=root/'release/cocos-horde-20261104-r1'
archive=dest.with_suffix('.zip')
if dest.exists() or archive.exists():
    raise RuntimeError('保留已有固定交付包，必须换检查点目录')
if 'Finished in' not in (qa/'build-delivery.log').read_text(encoding='utf8'):
    raise RuntimeError('缺最终构建完成记录')
if (qa/'compile.log').read_text(encoding='utf8').strip():
    raise RuntimeError('编译输出需先处理')
shutil.copytree(root/'cocos/build/functional-preview-horde',dest)
old=root/'release/cocos-hanging-menu-20261103-r1'
shutil.copytree(old/'licenses',dest/'licenses')
for name in ['launch-local.ps1','serve-local.py']:
    shutil.copy2(old/name,dest/name)
(dest/'README.txt').write_text('''我是哥布林：君主 数量战调整版 2026年11月4日

本地试玩 http://127.0.0.1:42828/?build=horde-20261104
本批数值、R01至R14和恶霸护甲已接入，详细说明见工程docs/HORDE_IMPLEMENTATION_20261104.md。
猎手与恶霸都可领护甲，主厅1/3/5对应三级品质，装备台升级同步升级已穿戴护甲。
敌军每5天增加5%属性，最多增加100%；夜袭人数随天数增长，器械与强力单位也按日期出现。
玩家靠近敌人自动鞭击，金币优先给玩家；笼内不逃；塔手白天打猎；招募180秒内分时2人。
金币与援军广告按钮在天数旁，实际服务未配置时不能领取，不模拟广告成功。
商人成交后载俘离场，晨暮色彩加强，防御建筑拉开，目标与站位稳定处理。

按用户要求先调整后试玩：本批只完成TypeScript编译与Creator构建。
未运行模型、浏览器、图形、性能或手机测试，不继承旧版通过结论。
旧存档自动迁移，保留财富、职业、装备、占领与伤势比例；正在交战的旧队伍不凭空删兵。
完整新人数编制以新局最清楚，可继续旧档，不会替用户清档。
A/D或方向键移动，Shift奔跑，E交互，Q抽打己方，R征召；手机用摇杆和图标。
通过launch-local.ps1启动本地服务，不能直接双击HTML。
本包是本地Web试玩包，不是TapTap上传包，没有上传或发布。
排行榜和云存档服务仍未接入，祭坛与联机仍为待办，无新帧动画生产。
''',encoding='utf8')

def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
sources=list((root/'cocos/assets/scripts').rglob('*.ts'))+list((root/'cocos/assets/resources/materials').glob('*.effect'))+[root/'cocos/assets/resources/fonts/GoblinHand.ttf',root/'cocos/config/build-horde.json']
report={
    'checkpoint':'horde-20261104','url':'http://127.0.0.1:42828/?build=horde-20261104',
    'notTapTapUploadPackage':True,'published':False,'realAds':False,'rankingReady':False,'cloudSaveReady':False,
    'typecheckCompleted':True,'creatorBuildCompleted':True,'testingSkippedByUser':True,
    'gameplayTested':False,'browserTested':False,'graphicsTested':False,'performanceTested':False,'phoneTested':False,
    'fixesImplemented':['R%02d'%i for i in range(1,16)],'fixesValidated':[],
    'sourceHashes':{p.relative_to(root).as_posix():sha(p) for p in sources},
    'evidence':['qa/cocos/horde-20261104/compile.log','qa/cocos/horde-20261104/build-delivery.log'],
    'retainedFailures':['qa/cocos/horde-20261104/build.log','qa/cocos/horde-20261104/build-stderr.log'],
    'notes':['首次准备脚本缺fontTools，创建构建配置前失败；依赖补齐后独立重建。','Creator脚本成功后可能有worker SIGTERM调试信息，原日志保留，未声称运行无错误。'],
}
(dest/'CHECKPOINT.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf8')
(dest/'CHECKSUMS.json').write_text(json.dumps([{'file':p.relative_to(dest).as_posix(),'bytes':p.stat().st_size,'sha256':sha(p)} for p in sorted(dest.rglob('*')) if p.is_file()],ensure_ascii=False,indent=2),encoding='utf8')
with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED,compresslevel=6)as z:
    for p in dest.rglob('*'):
        if p.is_file():z.write(p,p.relative_to(dest.parent).as_posix())
report.update(archive=str(archive),archiveBytes=archive.stat().st_size,archiveSha256=sha(archive))
(root/'qa/cocos/horde-delivery.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf8')
print(json.dumps({k:report[k] for k in ['checkpoint','archiveBytes','archiveSha256','testingSkippedByUser']}))
