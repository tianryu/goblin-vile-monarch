from pathlib import Path
from hashlib import sha256
import json
import re
import shutil

project = Path(__file__).resolve().parents[3] / 'cocos'
assets = project / 'assets'
resources = assets / 'resources'
archive = project / 'non-export/20261104-store/retired-resources'
code = '\n'.join(p.read_text(encoding='utf-8-sig') for p in assets.rglob('*.ts'))
entries = resources / 'art/catalog.json'
catalog = json.loads(entries.read_text(encoding='utf-8-sig'))

# 逐项核对渲染、关节、等级组合、受击动作和 UI 后确认退役的素材。
retired = '''arrows butterfly crown forest_bird icon_restart market_army market_gold market_mount monarch
rider_bat_bare rider_boar_bare rider_lizard_bare rider_wolf_bare stall tool_brute tool_hunter tool_worker
torch ui_action_control ui_button ui_button_primary ui_card_selected_v5 ui_card_v5 ui_context ui_hud
ui_logo ui_panel ui_primary_v5 ui_run_control reward_sign'''.split()
audio = 'build_complete cage click error sword_hit wood_hit'.split()
files = []
for name in retired:
    assert not re.search(rf"['\x22]{re.escape(name)}['\x22]", code), name
    for stem in (name, name+'__glow'):
        files.append(Path('art') / (stem + '.png'))
        catalog.pop(stem, None)
for name in audio:
    assert f"clip: '{name}'" not in code and f".get('{name}')" not in code
    files.append(Path('audio') / (name + '.ogg'))

# 引擎、历史字体和参考项目授权归档在非导出目录。现用 WenKai OFL 留在包内。
for name in ('Godot-MIT','Kenney-CC0','MaShanZheng-OFL','NotoSansSC-OFL','PixelFX-MIT'):
    files.append(Path('fonts') / (name + '.txt'))

report = []
for relative in files:
    source = resources / relative
    dest = archive / relative
    for src,target in ((source,dest),(Path(str(source)+'.meta'),Path(str(dest)+'.meta'))):
        if src.is_file():
            target.parent.mkdir(parents=True,exist_ok=True)
            if target.exists():
                raise FileExistsError(target)
            shutil.move(src, target)
    if dest.is_file():
        report.append({'resource':relative.as_posix(), 'bytes':dest.stat().st_size,
            'sha256':sha256(dest.read_bytes()).hexdigest()})
entries.write_text(json.dumps(catalog, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
(archive/'inventory.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8')
print(len(report), sum(r['bytes'] for r in report))
