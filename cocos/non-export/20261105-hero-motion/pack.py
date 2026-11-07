"""Pack the reviewed ImageGen originals. Coordinates use source-space boot anchors."""
import json
from pathlib import Path

from PIL import Image, ImageChops, ImageFilter

SOURCE = Path(__file__).parent
RIGS = SOURCE.parents[1] / "assets/resources/rigs"
OUTLINE = (249, 200, 207, 255)
FRAME_ROWS = (
    ("elite_charger", (0, 710, 1410, 2172), ((450, 585), (1112, 585), (1921, 585)), .32, 128),
    ("fleet", (0, 724, 1448, 2172), ((455, 650), (1126, 649), (1905, 650)), .245, 115),
    ("elite_pyromancer", (0, 724, 1448, 2172), ((360, 670), (1098, 670), (1887, 670)), .22, 123),
    ("elite_longbow", (0, 724, 1448, 2172), ((389, 696), (1103, 696), (1820, 696)), .20, 132),
    ("elite_engineer", (0, 724, 1448, 2172), ((350, 672), (1127, 672), (1817, 672)), .21, 131),
)


def trim_alpha(image, threshold=18, clean=False):
    alpha = image.getchannel("A")
    alpha = alpha.point(lambda value: value if value >= threshold else 0)
    if clean:
        core = alpha.point(lambda value: 255 if value >= 180 else 0)
        alpha = ImageChops.multiply(alpha, core.filter(ImageFilter.MaxFilter(7)))
    image.putalpha(alpha)
    box = alpha.getbbox()
    return image.crop(box), box


def faction_outline(image, pixels):
    mask = image.getchannel("A").point(lambda value: min(255, value * 2))
    backing = Image.new("RGBA", image.size, OUTLINE)
    backing.putalpha(mask.filter(ImageFilter.MaxFilter(2 * pixels + 1)))
    return Image.alpha_composite(backing, image)


def row_frames():
    for actor, edges, feet, scale, height in FRAME_ROWS:
        source = SOURCE / f"{actor}.png"
        sheet = Image.open(source).convert("RGBA")
        row = []
        for index, (ax, ay) in enumerate(feet):
            x0, x1 = edges[index:index + 2]
            cell = sheet.crop((x0, 0, x1, sheet.height))
            pose, (left, top, _, _) = trim_alpha(cell, 70 if actor == "elite_charger" else 22,
                                                clean=actor == "elite_charger")
            pose = pose.resize((round(pose.width * scale), round(pose.height * scale)),
                               Image.Resampling.LANCZOS)
            padding = 6
            padded = Image.new("RGBA", (pose.width + padding * 2, pose.height + padding * 2))
            padded.paste(pose, (padding, padding))
            pose = faction_outline(padded, 4)
            foot_x = ((ax - x0 - left) * scale + padding) / pose.width
            foot_y = 1 - ((ay - top) * scale + padding) / pose.height
            row.append((f"enemyPose:{actor}:{index}", pose, height, foot_x, foot_y, -1, source))
        yield row


def effect_row():
    source = SOURCE / "attack-crack.png"
    crack, _ = trim_alpha(Image.open(source).convert("RGBA"), 24)
    crack.thumbnail((432, 90), Image.Resampling.LANCZOS)
    yield ("fxAttackCrack", crack, crack.height, .5, .5, 1, source)
    source = SOURCE / "skill-fx.png"
    sheet = Image.open(source).convert("RGBA")
    for i, key in enumerate(("fxWard", "fxRepair", "fxStaffFire")):
        art, _ = trim_alpha(sheet.crop((i * sheet.width // 3, 0, (i + 1) * sheet.width // 3, sheet.height)), 25)
        art.thumbnail((105, 105), Image.Resampling.LANCZOS)
        yield (key, art, art.height, .5, .5, 1, source)


old_atlas = Image.open(SOURCE / "previous-atlas.png").convert("RGBA")
catalog = json.loads((SOURCE / "previous-frames.json").read_text(encoding="utf-8"))
rows = [*row_frames(), list(effect_row())]
gap = 4
atlas = Image.new("RGBA", (old_atlas.width, old_atlas.height + gap +
                           sum(max(item[1].height for item in row) + gap for row in rows)))
atlas.paste(old_atlas, (0, 0))
for index in range(4):
    x, y, w, h = catalog[f"enemyPose:elite_heavy:{index}"]["rect"]
    rect = (x, y, x + w, y + h)
    atlas.paste(faction_outline(old_atlas.crop(rect), 4), (x, y))
y = old_atlas.height + gap
for row in rows:
    x = gap
    for name, art, height, ax, ay, facing, source in row:
        assert x + art.width + gap <= atlas.width, name
        assert 0 <= ax <= 1 and 0 <= ay <= 1, name
        atlas.paste(art, (x, y))
        catalog[name] = dict(rect=[x, y, art.width, art.height], width=art.width, height=art.height,
                             contentHeight=height, anchorX=ax, anchorY=ay, facing=facing,
                             source="cocos/non-export/20261105-hero-motion/" + source.name)
        x += art.width + gap
    y += max(item[1].height for item in row) + gap
atlas.save(RIGS / "enemy_attacks.png", optimize=True)
(RIGS / "enemy_attack_frames.json").write_text(json.dumps(catalog, indent=2) + "\n", encoding="utf-8")
print(f"{atlas.width}x{atlas.height}, {len(catalog)} frames")
