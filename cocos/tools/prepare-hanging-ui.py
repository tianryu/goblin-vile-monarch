"""吊牌原画的常规缩放与目录登记，字体只补齐菜单字形，不重生成其他美术。"""
from pathlib import Path
from PIL import Image
from fontTools import subset
from fontTools.ttLib import TTFont
import json,shutil

root=Path(__file__).resolve().parents[2]
source=Path('C:/Users/田煜/.codex/generated_images/01a185e2-9903-79b2-a07f-8952b848c1b3/exec-8ecba122-6fae-4c46-aa32-4c2d3c5ce478.png')
original=root/'cocos/art/ui/hanging-menu.png';original.parent.mkdir(parents=True,exist_ok=True)
if not original.exists():shutil.copy2(source,original)
im=Image.open(original).convert('RGBA');im=im.resize((512,768),Image.Resampling.LANCZOS)
im.save(root/'cocos/assets/resources/art/hanging_menu.png',optimize=True)
catalog_path=root/'cocos/assets/resources/art/catalog.json'
catalog=json.loads(catalog_path.read_text(encoding='utf8'))
catalog['hanging_menu']={'width':512,'height':768,'contentHeight':768,'anchorX':.5,'anchorY':0,'source':'cocos/art/ui/hanging-menu.png','facing':1}
catalog_path.write_text(json.dumps(catalog,ensure_ascii=False,indent=2)+'\n',encoding='utf8')

# 保留原子集的全部码位，再从已经许可的完整字体加入新菜单文字。
font_path=root/'cocos/assets/resources/fonts/GoblinHand.ttf'
previous=TTFont(font_path);chars=set(previous.getBestCmap());previous.close()
chars.update(map(ord,'我是哥布林：君主继续游戏新的征程排行榜云存档声音开关暂停菜单'))
font=TTFont(root/'game/fonts/WenKai-source.ttf')
options=subset.Options();options.name_IDs=['*'];options.name_legacy=True;options.name_languages=['*']
subsetter=subset.Subsetter(options=options);subsetter.populate(unicodes=chars);subsetter.subset(font)
for record in font['name'].names:
    if record.nameID in [1,4,6,16]:
        name='GoblinHandCocos' if record.nameID==6 else 'Goblin Hand Cocos'
        record.string=name.encode(record.getEncoding(),errors='replace')
font.save(font_path)
print('Prepared shared hanging bitmap and menu font glyphs; no gameplay test executed.')
