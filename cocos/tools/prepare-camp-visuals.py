"""裁切已审过的敌军动作帧，并导入单独生成的笼车原画。"""
from pathlib import Path
from PIL import Image
import json
import sys

root = Path(__file__).resolve().parents[2]
resources = root / 'cocos/assets/resources'
art = resources / 'art'
catalog_path = art / 'catalog.json'
catalog = json.loads(catalog_path.read_text(encoding='utf-8'))

source = Path(sys.argv[1])
cart = Image.open(source).convert('RGBA')
# 清掉透明窗中的低覆盖率像素，画面的木纹、轮轴和拉杆使用原画。
alpha = cart.getchannel('A').point(lambda n: 0 if n < 66 else n)
cart.putalpha(alpha)
left, top, right, bottom = cart.crop((40, 70, 1700, 880)).getbbox()
left, top, right, bottom = left + 40, top + 70, right + 40, bottom + 70
cart = cart.crop((left, top, right, bottom))
cart.thumbnail((512, 256), Image.Resampling.LANCZOS)
cart.save(art / 'prison_cart.png', optimize=True)
catalog['prison_cart'] = {
    'width': cart.width, 'height': cart.height, 'contentHeight': cart.height,
    'anchorX': (1050 - left) / (right - left), 'anchorY': 0,
    'source': 'cocos/art/source/prison_cart.png', 'facing': -1,
}
catalog_path.write_text(json.dumps(catalog, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

source_anim = root / 'game/art/animation'
manifest = json.loads((source_anim / 'manifest.json').read_text(encoding='utf-8'))['clips']
selections = {
    'human/attack': [3, 6, 8, 13, 14, 17],
    'dwarf/attack': [2, 5, 8, 12, 14, 17],
    'elf/shoot': [0, 1, 3, 4, 8, 13],
    'elf_melee/attack': [4, 6, 9, 17, 17, 0],
}
cell_w, cell_h = 150, 144
atlas = Image.new('RGBA', (cell_w * 6, cell_h * 4))
frames = {}
for row, (clip_id, indexes) in enumerate(selections.items()):
    clip = manifest[clip_id]
    sheet = Image.open(source_anim / clip['sheet']).convert('RGBA')
    width, height = clip['width'], clip['height']
    scale = 98 / clip['reference_height']
    for col, index in enumerate(indexes):
        frame = clip['frames'][index]
        image = sheet.crop((frame['x'], frame['y'], frame['x'] + width, frame['y'] + height))
        image = image.resize((round(width * scale), round(height * scale)), Image.Resampling.LANCZOS)
        x, y = col * cell_w + 2, row * cell_h + 2
        atlas.alpha_composite(image, (x, y))
        frames[f'enemyPose:{clip["asset"]}:{col}'] = {
            'rect': [x, y, image.width, image.height],
            'width': image.width, 'height': image.height, 'contentHeight': 98,
            'anchorX': clip['anchor_x'] / width,
            'anchorY': 1 - clip['anchor_y'] / height,
            'facing': -1, 'source': f'game/art/animation/{clip["sheet"]}',
        }
atlas.save(resources / 'rigs/enemy_attacks.png', optimize=True)
(resources / 'rigs/enemy_attack_frames.json').write_text(json.dumps(frames, ensure_ascii=False, indent=2), encoding='utf-8')
print(f'Prepared prison cart {cart.width}x{cart.height} and {len(frames)} selected action poses in {atlas.width}x{atlas.height}')
