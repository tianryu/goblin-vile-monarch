"""V8动画输入整理。只裁切/统一缩放已批准位图，不合成任何动作。"""
from pathlib import Path
from PIL import Image
from datetime import datetime, timezone
import hashlib, json, argparse, shutil

ROOT=Path(__file__).resolve().parents[1]
BASE=ROOT/'artifacts/animation-v8'
COMFY=Path('C:/AI/H3/ComfyUI/input')

def prepare(name, action, version='v01',background_color='white',prompt_override=None,reference_limits=None):
    """共享画布与脚点固定，输入源及实际提示都冻结在任务目录。"""
    manifest=json.loads((ROOT/'game/art/runtime/manifest.json').read_text('utf-8'))
    frame=manifest['frames'][name]
    source=Image.open(ROOT/'game/art/runtime'/frame['sheet']).convert('RGBA').crop((frame['x'],frame['y'],frame['x']+frame['w'],frame['y']+frame['h']))
    folder=BASE/f'{name}-{action}-{version}'
    if (folder/'input.json').exists():
        raise FileExistsError('Frozen animation input already exists: '+str(folder))
    folder.mkdir(parents=True,exist_ok=True)
    (folder/'source').mkdir(exist_ok=True)
    source.save(folder/'source/original.png')
    # 蝙蝠下拍占用额外高度；沿用旧脚点会在原片底边裁掉翼尖。
    max_height,max_width,foot=(220,330,350) if name=='rider_bat' else (360,600,470)
    if reference_limits is not None:max_height,max_width,foot=reference_limits
    scale=min(max_height/source.height,max_width/source.width)
    scaled=source.resize((round(source.width*scale),round(source.height*scale)),Image.Resampling.LANCZOS)
    canvas=Image.new('RGB',(1024,576),background_color)
    left=round(512-scaled.width*float(frame.get('pivot_x',.5)))
    canvas.paste(scaled,(left,foot-scaled.height),scaled)
    canvas.save(folder/'source/input.png')
    relative=f'MonarchV8/{folder.name}/input.png'
    destination=COMFY/relative;destination.parent.mkdir(parents=True,exist_ok=True)
    shutil.copy2(folder/'source/input.png',destination)
    common=('A flat hand-painted 2D cutout animation on a completely blank pure white page. '
            'The white page background remains unchanged. The exact single reference subject only. '
            'Fixed side view, constant size and position, same painted contours, colors and details. '
            'Full subject, every limb and attachment stays complete and inside the image. ')
    motions={
      'walk':'Walk in place continuously through two complete natural gait cycles. Clear alternating foot contacts, opposite arm motion, passing poses, small vertical body movement only. Neither foot drags. Return seamlessly to the opening stance. ',
      'run':'Run in place with clear alternating strides and a short airborne phase. Two complete cycles. Rider remains seated firmly in the saddle and moves together with the mount. Legs of the mount remain four distinct attached legs. Rider never floats or slides away. Cloak follows the motion. ',
      'idle':'A restrained seamless idle loop: gentle breathing, one blink, a tiny sly head glance then back to the exact original orientation. Feet remain planted and the silhouette does not scale. ',
      'work':'Two deliberate work cycles, lifting the held hammer slightly back, striking down in front, then recovering. Hammer always stays in the original hand attached to the same shoulder. Other hand never holds the hammer. Feet planted. No generated target object. ',
      'attack':'Two complete attacks with the original held weapon, with anticipation, contact, follow-through and recovery. Original weapon remains in the same screen-space hand. Shield if present stays in the other hand. No duplication or swapping. Feet planted, no target or effects. ',
      'shoot':'Two complete bow shots: draw the existing bow, release, and return to ready. Bow stays attached to the same hand and drawing hand stays the drawing hand. No extra weapon, no target, no visible flying arrow. Feet stay planted. ',
      'trade':'A subtle loop of rubbing hands greedily, counting the original coins or pouch, looking to the side then returning. Preserve original bare head, medieval pullover tunic and trousers. No modern clothes or hat. Feet planted. ',
      'wind':'Gentle wind loop. Only existing leaves, flexible branch tips, fabric and hanging parts move. Rigid wood, stone, roots, frame and base remain fixed in exact reference coordinates. A coherent slow breeze passes, then the flexible parts return. Do not bend or wobble the entire object. No new leaves, no debris. ',
      'flame':'Seamless flame loop. Only the existing flame flickers, elongates, divides and rejoins subtly. The wooden torch handle and base remain perfectly stationary. Warm hand-painted flame shapes, no smoke or sparks outside the flame. ',
      'struggle':'A living wounded captive makes two small attempts to rise, head and free hand moving slightly, then settles back down. Remains lying down, same equipment, no new wounds or gore. No standing up. '
      ,'hit':'A short flinch and recovery in place. Shoulders recoil, head dips, knees flex, then return to the original ready pose. Every original limb, costume part and held item remains attached, unchanged and complete. No new wounds or effects. Feet remain planted. '
      ,'fall':'One non-looping fall: the character loses balance, knees buckle, falls onto the side and settles on the same foot line. Remain lying still at the end. Same full body, same costume and equipment. No blood, no transformation, no return to standing. '
      ,'getup':'From the existing lying pose, roll onto one knee, plant a foot and rise naturally into the exact original standing reference. Keep every original limb and item attached in its original hand. One complete non-looping recovery, then stand still. '
      ,'whip':'The goblin RIDER performs ONE clear arm gesture while seated. His original foreground hand lets go of the reins, his elbow lifts back, then the same arm reaches forward at chest height and returns to the reins. The other hand holds the reins throughout. The mount remains standing still with all four feet planted. The short red cloak stays hanging BEHIND his back; it never stretches into a long strip or passes in front of the boar. Animate the rider arm, not the cloak. No weapon, rope, whip, trail, spark, impact or new object. '
      ,'life':'A restrained seamless idle loop for this exact building. Only existing fabric, flags and hanging signs respond to a gentle breeze. Every wall, post, roof support and foundation remains perfectly fixed. Do not generate or animate fire, flame, sparks or smoke. Preserve the empty display surfaces. No new people, no seller, no stock, no new decorations or background. '
    }
    if action not in motions:raise ValueError(action)
    if name.startswith('rider_'):
        common+='The crowned goblin and his mount are one complete inseparable subject. Crown only on rider. Original saddle, reins and cloak remain attached. '
    if name=='rider_bat' and action in ['walk','run']:
        motions[action]='The existing bat mount beats its TWO original wings through a complete smooth upstroke and downstroke cycle in place. Use compact wing strokes; both complete wingtips stay in the central safe area with a broad white margin below, above and to the sides. Only its TWO original hind legs stay tucked below the body. Rider stays seated and attached. No walking legs, no extra wings, no new limbs. Repeat continuously, same position. '
    if name.startswith(('hunter','elf')) and action=='walk':
        motions[action]='Walk in place through two complete alternating-leg gait cycles. Preserve the exact bow and drawing-hand ownership; upper body holds the weapon steadily in front, small shoulder motion only. Do not swing the bow into another hand or introduce another weapon. Same fixed foot line and position. '
    if name.startswith('thief') and action=='work':
        motions[action]='A furtive stealing loop: bend forward slightly, curl the fingers of the two original empty hands, glance sideways, then return. Both hands remain empty as in the reference. Feet fixed. '
    if name=='thief_2' and action=='work':
        motions[action]='The existing hand holding the bent metal lockpick reaches forward a few centimeters, turns the same rigid lockpick slightly with the wrist, then returns to ready. Other hand stays near the belt. Small sly head glance and shoulder hunch. Both boots planted. Keep the original lockpick shape and grip throughout. The white page stays empty. '
    if name=='thief_3' and action=='work':
        motions[action]='The existing hand keeps holding the original keyring, turns the wrist a little so those same keys sway, then returns. The other hand and original belt equipment stay unchanged. A tiny sly forward hunch, then back. Both boots planted. The same complete keyring stays attached to its original holding hand throughout. Empty white page remains unchanged. '
    if version!='v01' and name=='thief' and action=='work':
        motions[action]='The exact hooded goblin makes one small furtive lean, curls the fingers of both original empty hands near his own belt, looks sideways and returns. Both hands remain empty. Only fingers, head and shoulders move. Planted boots, fixed silhouette size. The page stays entirely empty around him. '
    if version!='v01' and name=='brute' and action=='attack':
        motions[action]='One short downward swing of the EXISTING wooden club, then return to the exact initial stance. The original club stays attached to the original foreground hand throughout. The OTHER hand remains EMPTY, fingers visible. Preserve the reference with no shield. Anticipation, swing down in empty air, recover. All feet stay fixed. The rest of the white page remains completely empty throughout. '
    if version!='v01' and name in ['brute_2','brute_3'] and action=='attack':
        motions[action]='Only the original weapon arm moves: lift the existing weapon above the shoulder, lower it forward through empty air, then return to the original hip position. The original other hand keeps the same shield absolutely still in front of the chest. Grip ownership, weapon length and shield shape stay unchanged. Both feet remain fixed. Nothing else appears on the unchanged white page. '
    if version=='v03' and name=='thief' and action=='work':
        motions[action]='A small shoulder lean, one sly sideways glance, and a tiny curl of the existing empty hand fingers, then return to the exact opening stance. Both original hands remain empty. Feet planted. Only head, shoulders and the fingers move. The white page remains empty. '
    if version!='v01' and name in ['human','trader'] and action=='walk':
        motions[action]='Walk in place through two complete alternating-leg gait cycles. The original upper body, hands and every held item stay nearly motionless in the exact original pose. Only legs and a very small shoulder breath move. Preserve the exact costume and all equipment without rotation or swapping. The surrounding pure white page stays completely empty and unchanged in every frame. '
    if version!='v01' and name.startswith('worker') and action=='work':
        motions[action]='One compact tool-hand motion in place: lift the existing hammer just behind the shoulder, lower the same hammer down through EMPTY AIR in front, then return to the original hip position. Hammer remains gripped in its original hand continuously. The tool never touches anything. The other hand stays open, both boots planted. All costume and headgear stay attached and unchanged. Nothing happens on the empty white page around the character. '
    if version!='v01' and action=='idle':
        motions[action]='Only one quiet blink and a very small chest breath, then return to the exact opening pose. Every held item stays still in the same hand. Both feet remain fixed. The whole original subject remains the same size and position on a pure white unchanged empty page in every frame. '
    if name.startswith('captive_') and action=='idle':
        motions[action]='Only the existing single person on the unchanged empty white page. A small shoulder breath and one blink, then return. His existing hands keep their exact original position and attachments behind his body. His legs and feet stay perfectly still. Keep the entire original compact silhouette. Nothing else appears. '
    if version!='v01' and name=='trader' and action=='trade':
        motions[action]='The existing bareheaded medieval merchant rubs his thumb and index finger quietly near his own closed pouch, glances sideways, then returns to the exact original pose. The pouch stays closed and attached to the belt. No coins leave it. No arm extension, no loose object. Both shoes remain planted. The white page stays empty. '
    if version=='v03' and name=='trader' and action=='trade':
        motions[action]='The merchant lifts the original tied bag a few centimeters with its original holding hand, glances at it, and lowers it to the exact opening position. The same bag keeps its closed shape and tied drawstring throughout. His other hand keeps the original book fixed against his chest. Subtle breathing and one blink. Same bare head, clothes and planted shoes. Unchanged empty white page. '
    if version!='v01' and name=='tribal_banner' and action=='wind':
        motions[action]='Only this exact existing banner on the unchanged blank white page. The original flag fabric softly ripples and returns, attached to the same top edge. Keep the original wooden pole, ropes, stones and base perfectly fixed in the exact initial coordinates. Only the cloth moves. Nothing else appears anywhere on the page. '
    prompt=common+motions[action]+'Crisp painted edges. The page stays flat, solid white and empty outside the exact original subject. Fixed camera, fixed side view. Silent.'
    if prompt_override is not None:prompt=prompt_override
    (folder/'prompt.txt').write_text(prompt,encoding='utf-8')
    metadata={'asset':name,'action':action,'version':version,'created_utc':datetime.now(timezone.utc).isoformat(),
              'source_frame':frame,'reference_scale':scale,'reference_left':left,'reference_foot':foot,
              'input_relative':relative,'input_sha256':hashlib.sha256((folder/'source/input.png').read_bytes()).hexdigest(),
              'coordinate_space':'screen','direction':'reference-facing','status':'prepared',
              'model_generated_motion':True,'source_art_unchanged':True,'background_color':background_color}
    (folder/'input.json').write_text(json.dumps(metadata,ensure_ascii=False,indent=2),encoding='utf-8')
    print(folder)

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('asset');p.add_argument('action');p.add_argument('--version',default='v01');a=p.parse_args()
    prepare(a.asset,a.action,a.version)
