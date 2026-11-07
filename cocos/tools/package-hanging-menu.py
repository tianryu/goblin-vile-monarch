"""只归档本轮未试玩构建，不运行游戏或自动测试，不覆盖历史包。"""
from pathlib import Path
import json,hashlib,shutil,zipfile
root=Path(__file__).resolve().parents[2];qa=root/'qa/cocos'
dest=root/'release/cocos-hanging-menu-20261103-r1';archive=dest.with_suffix('.zip')
assert not dest.exists() and not archive.exists(),'保留固定交付包'
assert 'Finished in' in (qa/'build-hanging-menu-final.log').read_text(encoding='utf8')
assert not (qa/'hanging-menu-compile.log').read_text(encoding='utf8').strip()
shutil.copytree(root/'cocos/build/functional-preview-hanging-menu',dest)
shutil.copytree(root/'release/cocos-starter-20261103-r1/licenses',dest/'licenses')
for name in ['launch-local.ps1','serve-local.py']:shutil.copy2(root/'release/cocos-starter-20261103-r1'/name,dest/name)
(dest/'README.txt').write_text('''我是哥布林：君主 原生吊牌菜单调整版 2026年11月3日

本地试玩：http://127.0.0.1:42828/?build=hanging-menu-20261103
主菜单和暂停共用顶部双绳吊牌。所有项目同尺寸，排行不带小字，暂停末项是主菜单。
开始/恢复先让菜单上拉渐隐离屏，再让世界继续。暂停键左移，Esc也可暂停/恢复。
声音开关实际控制播放并独立保存。排行与云存档未接服务，按钮暂时置灰。
键盘A/D或方向键移动，Shift奔跑，E交互，Q鞭打，R征召。手机用摇杆及情境按钮。
新局仍赠送已建招募盘，苦力只改名，搬运职业规则保持当前实现。

用户明确要求本轮先不测试：只完成编译与构建，未运行模型、图形、浏览器或性能检查。
请由用户试玩反馈，不继承旧版通过结论或手机性能数据。
旧档与旧固定包保留。通过launch-local.ps1启动HTTP服务，不能直接双击HTML。
本包不是TapTap上传包，没有平台发布，真实广告未接入。
详见工程docs/HANGING_MENU_IMPLEMENTATION_20261103.md。
''',encoding='utf8')
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
report={'checkpoint':'hanging-menu-20261103','url':'http://127.0.0.1:42828/?build=hanging-menu-20261103','notTapTapUploadPackage':True,'published':False,'nativeCocosMenusImplemented':True,'rankingReady':False,'cloudSaveReady':False,'testingSkippedByUser':True,'gameplayTested':False,'browserTested':False,'phoneTested':False,'realAds':False,'typecheckCompleted':True,'creatorBuildCompleted':True,'sourceHashes':{p.relative_to(root).as_posix():sha(p) for p in (root/'cocos/assets/scripts').rglob('*.ts')},'evidence':['qa/cocos/hanging-menu-compile.log','qa/cocos/build-hanging-menu-final.log']}
(dest/'CHECKPOINT.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf8')
(dest/'CHECKSUMS.json').write_text(json.dumps([{'file':p.relative_to(dest).as_posix(),'bytes':p.stat().st_size,'sha256':sha(p)} for p in sorted(dest.rglob('*')) if p.is_file()],ensure_ascii=False,indent=2),encoding='utf8')
with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED,compresslevel=6)as z:
    for p in dest.rglob('*'):
        if p.is_file():z.write(p,p.relative_to(dest.parent).as_posix())
report.update(archive=str(archive),archiveBytes=archive.stat().st_size,archiveSha256=sha(archive))
(qa/'hanging-menu-delivery.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf8')
print(json.dumps({k:report[k]for k in ['checkpoint','archiveBytes','archiveSha256','testingSkippedByUser']},ensure_ascii=False))
