from pathlib import Path
from PIL import Image, ImageOps
import json
import uuid

root = Path(__file__).resolve().parents[3]
source = root / 'cocos/non-export/20261104-store/source'
art = root / 'cocos/assets/resources/art'
out = root / 'release/taptap-20261104-r1/materials'
out.mkdir(parents=True, exist_ok=True)

title = Image.open(source / 'title-stacked.png').convert('RGBA')
title = title.crop(title.getchannel('A').point(lambda a: 255 if a > 16 else 0).getbbox())
title = ImageOps.expand(title, border=12, fill=(0, 0, 0, 0))
logo = ImageOps.contain(title, (1800, 980), Image.Resampling.LANCZOS)
logo.save(out / 'windows-logo.png', optimize=True)
small = ImageOps.contain(title, (768, 256), Image.Resampling.LANCZOS)
runtime = art / 'title_wordmark.png'
small.save(runtime, optimize=True)
meta = runtime.with_suffix('.png.meta')
if not meta.exists():
    info = {'ver': '1.0.27', 'importer': 'image', 'imported': False,
            'uuid': str(uuid.uuid4()), 'files': [], 'subMetas': {},
            'userData': {'type': 'sprite-frame', 'fixAlphaTransparencyArtifacts': False}}
    meta.write_text(json.dumps(info, indent=2) + '\n', encoding='utf-8')
catalog = art / 'catalog.json'
entries = json.loads(catalog.read_text(encoding='utf-8-sig'))
entries['title_wordmark'] = {'width': small.width, 'height': small.height,
    'contentHeight': small.height, 'anchorX': .5, 'anchorY': .5, 'facing': 1,
    'source': 'cocos/non-export/20261104-store/source/title.png'}
catalog.write_text(json.dumps(entries, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

icon = Image.open(source / 'icon.png').convert('RGB')
ImageOps.fit(icon, (1024, 1024), Image.Resampling.LANCZOS).save(out / 'icon-1024.png', optimize=True)
key = Image.open(source / 'key-art.png').convert('RGB')

def export(name, size, logo_width=0, top=.13, center=(.49,.51)):
    canvas = ImageOps.fit(key, size, Image.Resampling.LANCZOS, centering=center).convert('RGBA')
    if logo_width:
        word = ImageOps.contain(logo, (round(size[0]*logo_width), size[1]), Image.Resampling.LANCZOS)
        canvas.alpha_composite(word, (round((size[0]-word.width)/2), round(size[1]*top)))
    canvas.convert('RGB').save(out / name, quality=92, optimize=True, subsampling=0)

export('promo-16x9.jpg', (1920,1080), .34, .07)
export('promo-1x1.jpg', (1440,1440), .46, .10)
export('windows-cover-landscape.jpg', (460,215), .35, .035)
export('windows-cover-portrait.jpg', (600,900), .65, .09)
export('windows-promo-landscape-no-logo.jpg', (1920,1080))
export('windows-promo-portrait-no-logo.jpg', (720,1080))
export('windows-library-background.jpg', (3840,1240), center=(.50,.74))
export('editorial-1920x1280-review-only.jpg', (1920,1280), .32, .075)
