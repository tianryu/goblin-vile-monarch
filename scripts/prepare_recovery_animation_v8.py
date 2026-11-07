"""以已核对的倒地原片姿势作为起身首帧，独立站姿作为尾帧；不倒放、不伪造过渡动作。"""
from pathlib import Path
from PIL import Image
import json,hashlib,shutil,argparse
from prepare_animation_v8 import prepare,COMFY

def prepare_recovery(fall_folder,source_index,version='v01'):
    fall=Path(fall_folder).resolve();m=json.loads((fall/'manifest.json').read_text('utf-8'))
    if m['action']!='fall' or m['status'] not in ['visual-approved-engine-pending','accepted']:
        raise ValueError('Reviewed complete falling pose is required')
    asset=m['asset'];folder=fall.parent.parent/f'{asset}-getup-{version}'
    prompt=('The exact single flat hand-painted goblin from the first image is lying on his side. '
            'One natural recovery: roll toward the ground, push up with the original empty hand, plant one original foot, rise to the exact final standing reference, then remain standing. '
            'The existing hammer remains continuously gripped in its original hand. Same red headband, large ears, sly face, brown vest, belt and bare green feet. '
            'Every original limb and held item remains complete and attached. Same body size, fixed side-view camera and unchanged pure white paper. The rest of the page stays empty.')
    prepare(asset,'getup',version,prompt_override=prompt)
    metadata=json.loads((folder/'input.json').read_text('utf-8'))
    shutil.copy2(folder/'source/input.png',folder/'source/end-standing.png')
    raw=fall/'raw'/f'frame_{source_index:03d}.png';mask=fall/'masks'/raw.name
    rgba=Image.open(raw).convert('RGBA');rgba.putalpha(Image.open(mask).convert('L'))
    # 原视频本身就是固定世界坐标画布，整幅缩回模型输入，绝不另行居中或变形。
    rgba=rgba.resize((1024,576),Image.Resampling.LANCZOS)
    first=Image.new('RGB',(1024,576),'white');first.paste(rgba,(0,0),rgba);first.save(folder/'source/input.png')
    end_relative=f'MonarchV8/{folder.name}/end.png'
    for source,relative in [(folder/'source/input.png',metadata['input_relative']),(folder/'source/end-standing.png',end_relative)]:
        destination=COMFY/relative;destination.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(source,destination)
    metadata.update(input_sha256=hashlib.sha256((folder/'source/input.png').read_bytes()).hexdigest(),end_frame_relative=end_relative,
        end_frame_sha256=hashlib.sha256((folder/'source/end-standing.png').read_bytes()).hexdigest(),
        first_frame_from_reviewed_fall={'folder':str(fall),'source_index':source_index,'source_video_sha256':m['source_sha256'],'raw_png_sha256':hashlib.sha256(raw.read_bytes()).hexdigest(),'alpha_png_sha256':hashlib.sha256(mask.read_bytes()).hexdigest(),'coordinate_policy':'Whole source canvas resize only, no recentering, reflection, reversal or pose interpolation'})
    (folder/'input.json').write_text(json.dumps(metadata,ensure_ascii=False,indent=2),encoding='utf-8')
    return folder

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('fall_folder');p.add_argument('--frame',type=int,required=True);p.add_argument('--version',default='v01');a=p.parse_args();print(prepare_recovery(a.fall_folder,a.frame,a.version))
