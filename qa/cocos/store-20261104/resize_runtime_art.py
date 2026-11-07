from pathlib import Path
from PIL import Image
from io import BytesIO
import json
import shutil

project = Path(__file__).resolve().parents[3] / 'cocos'
assets = project / 'assets/resources/art'
originals = project / 'non-export/20261104-store/pre-resize-art'
originals.mkdir(parents=True, exist_ok=True)
index = assets / 'catalog.json'
catalog = json.loads(index.read_text(encoding='utf8'))
report = []
for path in sorted(assets.glob('*.png')):
    info = catalog.get(path.stem)
    if info is None or path.stat().st_size < 110_000 or max(info['width'], info['height']) <= 620:
        continue
    before = path.stat().st_size
    with Image.open(path) as im:
        height = im.height
        im.thumbnail((620,620), Image.Resampling.LANCZOS)
        result = BytesIO()
        im.save(result, format='PNG', optimize=True)
        if len(result.getbuffer()) >= before:
            continue
        saved = originals / path.name
        if not saved.exists():
            shutil.copy2(path, saved)
        path.write_bytes(result.getbuffer())
        info.update(width=im.width, height=im.height,
                    contentHeight=round(info['contentHeight']*im.height/height))
        report.append({'name': path.name, 'before': before, 'after':path.stat().st_size})
index.write_text(json.dumps(catalog,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
if report:
    (originals/'inventory.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf8')
print(f'{len(report)} textures, saved {sum(x["before"]-x["after"] for x in report)} bytes')
