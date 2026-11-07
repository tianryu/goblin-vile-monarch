"""归档已完成的第一章本地试玩构建。"""
from pathlib import Path
import hashlib
import json
import re
import shutil
import zipfile

root = Path(__file__).resolve().parents[2]
qa = root / 'qa/cocos/chapter1-20261104'
dest = root / 'release/cocos-chapter1-20261104-r1'
archive = dest.with_suffix('.zip')
url = 'http://127.0.0.1:42829/?build=chapter1-20261104'

if dest.exists() or archive.exists():
    raise RuntimeError('保留已有固定交付包')
if (qa / 'compile.log').read_text(encoding='utf-8').strip():
    raise RuntimeError('先处理编译输出')
if 'build Task (functional-preview-chapter1) Finished in' not in (qa / 'build-final.log').read_text(encoding='utf-8'):
    raise RuntimeError('缺少Creator构建完成记录')

shutil.copytree(root / 'cocos/build/functional-preview-chapter1', dest)
previous = root / 'release/cocos-horde-20261104-r1'
shutil.copytree(previous / 'licenses', dest / 'licenses')
for name in ('launch-local.ps1', 'serve-local.py'):
    shutil.copy2(previous / name, dest / name)
launcher = dest / 'launch-local.ps1'
launcher.write_text(launcher.read_text(encoding='utf-8-sig').replace('42828', '42829'), encoding='utf-8')
index = dest / 'index.html'
index.write_text(re.sub(r'<title>.*?</title>', '<title>哥布林：卑劣君主</title>', index.read_text(encoding='utf-8'), count=1), encoding='utf-8')
shutil.copy2(root / 'docs/CHAPTER_ONE_IMPLEMENTED_20261104.md', dest / 'CHAPTER_ONE.md')
(dest / 'README.txt').write_text(f'''哥布林：卑劣君主 第1章 守住金币

试玩 {url}
选「新的征程」体验开场与新编制。
虚线箭头和摇杆提示去向。走近并选中后，金环指向实际按键。
逐字对白与全部引导点见CHAPTER_ONE.md。
已完成编译与构建，按此前要求留给用户试玩。
''', encoding='utf-8')


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


sources = sorted((root / 'cocos/assets/scripts').rglob('*.ts')) + [
    root / 'cocos/config/build-chapter1.json',
    root / 'cocos/assets/resources/fonts/GoblinHand.ttf',
]
report = {
    'checkpoint': 'chapter1-20261104',
    'title': '哥布林：卑劣君主',
    'chapter': '第1章 守住金币',
    'url': url,
    'dialogues': ['opening', 'trader', 'expedition', 'general', 'ending'],
    'routeStyle': 'dashed',
    'typecheckCompleted': True,
    'creatorBuildCompleted': True,
    'gameplayTested': False,
    'browserTested': False,
    'performanceTested': False,
    'notTapTapUploadPackage': True,
    'published': False,
    'sourceHashes': {p.relative_to(root).as_posix(): digest(p) for p in sources},
    'evidence': ['qa/cocos/chapter1-20261104/compile.log', 'qa/cocos/chapter1-20261104/build-final.log'],
}
(dest / 'CHECKPOINT.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
with zipfile.ZipFile(archive, 'w', zipfile.ZIP_DEFLATED, compresslevel=6) as output:
    for file in sorted(dest.rglob('*')):
        if file.is_file():
            output.write(file, file.relative_to(dest.parent).as_posix())
report.update(archive=str(archive), archiveBytes=archive.stat().st_size, archiveSha256=digest(archive))
(qa / 'delivery.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
print(json.dumps({key: report[key] for key in ('checkpoint', 'archiveBytes', 'archiveSha256')}))
