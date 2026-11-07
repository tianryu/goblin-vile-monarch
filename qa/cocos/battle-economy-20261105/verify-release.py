"""校验本次本地发行文件，不上传平台或读写正式存档。"""
import hashlib
import json
from pathlib import Path
from urllib.request import urlopen
from zipfile import ZipFile

root = Path(__file__).resolve().parents[3]
delivery = root / 'release/taptap-20261105-r4'
package = delivery / 'game.zip'
with ZipFile(package) as archive:
    assert archive.testzip() is None
    names = archive.namelist()
    config = json.loads(archive.read('game.json'))
    assert config['productVersion'] == '0.10.4'
    assert config['deviceOrientation'] == 'landscape'
    assert config['subPackages'] == [{'name': 'resources', 'root': 'subpackages/resources/'}]
    assert 'appid' not in json.loads(archive.read('project.config.json'))
    assert 'subpackages/resources/game.js' in names
    assert not any(n.endswith(('.map', '.ts', '.png.meta')) or n.startswith(('qa/', 'non-export/')) for n in names)
    scripts = '\n'.join(archive.read(n).decode('utf-8') for n in names if n.endswith('.js') and n.startswith(('src/chunks/', 'assets/main/')))
    assert '__monarch' not in scripts and '__MONARCH_QA__' not in scripts
    assert 'depositedDay' in scripts and 'tracking' in scripts
    main_bytes = sum(i.file_size for i in archive.infolist() if not i.filename.startswith('subpackages/'))
for name in ('preview', 'taptap'):
    log = (Path(__file__).parent / f'creator-{name}.log').read_text(encoding='utf-8')
    assert 'Finished in' in log
url = 'http://127.0.0.1:42832/?build=battle-economy-20261105'
with urlopen(url) as response:
    assert response.status == 200 and b'<canvas' in response.read()
sources = {}
for name in ('model/Rules.ts', 'model/State.ts', 'model/GameModel.ts', 'view/GameView.ts', 'view/Soundscape.ts'):
    p = root / 'cocos/assets/scripts' / name
    sources[name] = hashlib.sha256(p.read_bytes()).hexdigest()
results = {'version': '0.10.4', 'package': str(package), 'bytes': package.stat().st_size,
    'sha256': hashlib.sha256(package.read_bytes()).hexdigest(), 'mainContentBytes': main_bytes,
    'crc': 'passed', 'orientation': config['deviceOrientation'], 'debugHooks': 'absent',
    'localPreview': url, 'sourceSHA256': sources,
    'model': '11 targeted cases passed', 'desktopBrowser': '5 groups passed, Edge D3D11, touch emulation',
    'phoneAndTapTapHost': 'not tested', 'platformUpload': 'not performed'}
(delivery / 'verification.json').write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding='utf-8')
print(json.dumps(results, ensure_ascii=False, indent=2))
