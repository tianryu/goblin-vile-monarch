"""整理 Windows 便携包，仅复制正式资源和依赖 DLL，不打包编译缓存与静态库。"""
from pathlib import Path
import hashlib
import json
import os
import re
import shutil
import subprocess
import zipfile

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'cocos/build/pc-windows-20261107/proj/Release'
DEST = ROOT / 'release/windows-pc-20261107-six-day-trader/GoblinVileMonarch'
VERSION = json.loads((ROOT / 'cocos/package.json').read_text(encoding='utf-8-sig'))['version']
EXE = 'GoblinVileMonarch.exe'
assert (SOURCE / EXE).is_file() and (SOURCE / 'Resources/main.js').is_file(), 'Build the Windows target first'
vs = Path(os.environ.get('ProgramFiles', 'C:/Program Files')) / 'Microsoft Visual Studio/2022/Community/VC'
dumpbin = next(iter(sorted(vs.glob('Tools/MSVC/*/bin/Hostx64/x64/dumpbin.exe'), reverse=True)), None)
assert dumpbin, 'Visual Studio C++ dumpbin is required for the dependency audit'
redist = next(iter(sorted(vs.glob('Redist/MSVC/14.*/x64/Microsoft.VC143.CRT'), reverse=True)), None)
assert redist, 'Visual C++ x64 redistributable files are required'

DEST.mkdir(parents=True, exist_ok=True)
shutil.copy2(SOURCE / EXE, DEST / EXE)
shutil.copytree(SOURCE / 'Resources', DEST / 'Resources', dirs_exist_ok=True)
(DEST / 'Fonts').mkdir(exist_ok=True)
shutil.copy2(ROOT / 'cocos/assets/resources/fonts/GoblinHand.ttf', DEST / 'Fonts/GoblinHand.ttf')
available = {p.name.lower(): p for p in SOURCE.glob('*.dll')}
# 使用当前 C++ 工具链配套的可再发行运行库，避免旧 SDK 的 CRT 缺少新导出。
available.update({p.name.lower(): p for p in redist.glob('*.dll')})
pending = [SOURCE / EXE]
# ANGLE 图形库与崩溃诊断由引擎动态加载，不会出现在可执行文件的普通导入表中。
pending += [available[name] for name in ['libegl.dll', 'libglesv2.dll', 'libgles_cm.dll', 'dbghelp.dll', 'dbgcore.dll', 'dbgeng.dll'] if name in available]
visited = set()
system = set()
while pending:
    file = pending.pop()
    name = file.name.lower()
    if name in visited:
        continue
    visited.add(name)
    if file.suffix.lower() == '.dll':
        shutil.copy2(file, DEST / file.name)
    result = subprocess.run([str(dumpbin), '/DEPENDENTS', str(file)], capture_output=True, check=True, text=True)
    for dependency in re.findall(r'^\s+([A-Za-z0-9_.-]+\.dll)\s*$', result.stdout, re.MULTILINE):
        key = dependency.lower()
        if key in available:
            pending.append(available[key])
        else:
            system.add(dependency)

licenses = DEST / 'licenses'
licenses.mkdir(exist_ok=True)
for folder in [ROOT / 'cocos/assets/resources/licenses', ROOT / 'game/licenses']:
    for file in folder.glob('*.txt'):
        shutil.copy2(file, licenses / file.name)
(DEST / 'README.txt').write_text('''哥布林：卑劣君主 Windows PC 本地试玩版 __VERSION__
解压整个文件夹，运行 GoblinVileMonarch.exe。请勿单独移动 EXE。
Windows 10/11 x64，支持简体中文与英语。语言和声音开关位于主菜单及暂停菜单。
A/D 或左右方向键移动，Shift 奔跑，E 交互和连续投币，Q 抽鞭，R 第二项操作。
Tab 切换附近目标，H 回洞，F1 操作说明，Esc 暂停，Enter 推进对白。
底部图标支持鼠标点击。关闭窗口会保存。PC 存档与手机版隔离。
手柄支持 Windows XInput：左摇杆或方向键移动，A 交互，B 抽鞭，X 第二操作，Y 切换，LB 奔跑，RT 回洞，Start 暂停，Back 操作说明。
坐骑商人从第2天起每隔6天清晨到访，傍晚离开；靠近后投币兑换当期坐骑。

Goblin: Vile Monarch, Windows PC local build __VERSION__
Extract the complete folder, then launch GoblinVileMonarch.exe.
Windows 10/11 x64. Switch Simplified Chinese and English in either menu.
A/D or arrows: move. Hold Shift: sprint. E: interact/pay. Q: whip. R: secondary action.
Tab: next target. H: return home. F1: controls. Esc: pause. Enter: next dialogue.
Windows XInput gamepad: LS/D-pad move, A interact, B whip, X secondary, Y next target, LB sprint, RT home, Start pause, Back controls.
A mount trader visits every six days from day 2 and leaves at dusk. Approach to trade.
Keep the Resources folder and DLLs beside the executable. Local saves are separate from the mobile version.

Third-party notices are in licenses. Images were generated with OpenAI ImageGen.
'''.replace('__VERSION__',VERSION), encoding='utf-8')
manifest = {'version': VERSION, 'platform': 'windows-x64', 'debug': False,
            'languages': ['zh-CN', 'en'], 'dlls': sorted(x for x in visited if x.endswith('.dll')),
            'systemImports': sorted(system), 'exeSha256': hashlib.sha256((DEST / EXE).read_bytes()).hexdigest()}
(DEST / 'manifest.json').write_text(json.dumps(manifest, indent=2), encoding='utf-8')
archive = DEST.parent / 'GoblinVileMonarch-Windows-x64.zip'
with zipfile.ZipFile(archive, 'w', zipfile.ZIP_DEFLATED, compresslevel=6) as package:
    for file in sorted(DEST.rglob('*')):
        if file.is_file():
            package.write(file, file.relative_to(DEST.parent).as_posix())
print(json.dumps({'directory': str(DEST), 'zip': str(archive), 'dllCount': len(manifest['dlls']), 'zipBytes': archive.stat().st_size}, ensure_ascii=False))
