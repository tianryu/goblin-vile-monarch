"""Freeze short, existing-part-only inputs; generation and approval stay separate."""
from pathlib import Path
import json
from prepare_animation_v8 import prepare

ROOT = Path(__file__).resolve().parents[1]
COMMON = ('The exact original flat hand-painted subject on the same completely empty solid white page. '
          'Fixed side camera, identical costume, colors, proportions and size. ')
TASKS = [
    ('elf_melee', 'attack', 'v02', False,
     'His original dagger hand bends the elbow, bringing that same rigid dagger beside his chest. '
     'Then the same elbow straightens forward to the left and returns to the initial pose. '
     'The other original hand stays empty beside his chest. Both original boots remain planted. '
     'Only that forearm moves through the unchanged empty white page.'),
    ('elf', 'idle', 'v02', True,
     'One small blink and quiet chest breath, then return. The original bow, thin bowstring, '
     'arrow and both original holding hands remain in exactly their initial positions. '
     'Both original boots remain planted. The white page stays unchanged.'),
    ('forest_bird', 'idle', 'v01', True,
     'The two original pointed wings lift, fold slightly, open and lower through two complete '
     'wingbeat cycles. The same single swallow body and forked tail stay at the original center. '
     'Every wingtip stays inside the white page. Return to the exact opening wing pose.'),
    ('rider_bat', 'idle', 'v01', True,
     'One small blink from the seated original goblin rider and a quiet chest breath. '
     'His original bat remains in the exact initial pose with its two original wings spread '
     'and its two original hind claws tucked. Rider, saddle and bat remain attached as one '
     'subject. All wing tips and original feet stay at their opening coordinates. Return.'),
    ('rider_bat', 'walk', 'v03', True,
     'A compact low-gliding loop. The two original bat wings gently lift and return to the '
     'original outspread position twice. Wing tips stay above the original two tucked hind '
     'claws throughout. The same single bat body stays at the exact opening center and height. '
     'The crowned original rider stays attached in the saddle with original reins and cloak. '
     'Return to the exact opening pose. The white page stays unchanged.'),
    ('mushroom_farm', 'wind', 'v01', True,
     'Only the existing blue and cream cloth awning and its original short cloth ties ripple '
     'gently and return in a soft breeze. All original posts, mushroom sign, mushrooms, '
     'baskets and ground contact remain perfectly fixed at the original coordinates.'),
    ('woodcut_camp', 'wind', 'v01', True,
     'Only the loose tips of the existing leafy green roof softly sway and return in a breeze. '
     'All original wooden posts, crossed axes, logs, stump and base stay perfectly fixed '
     'at their exact original coordinates. The white page stays unchanged.'),
    ('gold_mine', 'wind', 'v01', True,
     'Only the original hanging lantern and its short attached chain make one very small '
     'pendulum sway and return. The existing rock, posts, cage, cart, rails, gold and base '
     'remain perfectly fixed at the exact original coordinates. The white page stays unchanged.'),
]

plan = ROOT / 'artifacts/animation-v8/cohort-29.json'
if plan.exists():
    raise FileExistsError(plan)
tasks = []
for i, (asset, action, version, loop, motion) in enumerate(TASKS):
    prepare(asset, action, version, prompt_override=COMMON + motion + ' Silent.')
    tasks.append(dict(asset=asset, action=action, version=version, seconds=2,
                      seed=741400+i, loop=loop, unload_idle=True))
plan.write_text(json.dumps({'purpose': 'Existing-part-only second passes and remaining environment representatives; every output remains unreviewed.',
                            'tasks': tasks}, ensure_ascii=False, indent=2), encoding='utf-8')
print(plan)
