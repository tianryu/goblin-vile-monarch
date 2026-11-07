"""导入独立AI近战精灵。仅规范alpha、共同缩放、脚点与图集，不绘制人物。"""
from pathlib import Path
import hashlib,json,shutil
import numpy as np
from PIL import Image
from scipy.ndimage import binary_erosion

ROOT=Path(__file__).resolve().parents[1]
GENERATED=Path('C:/Users/田煜/.codex/generated_images/01a185e2-9903-79b2-a07f-8952b848c1b3/exec-03b460bd-2065-4143-ab97-4b1fb2975be5.png')

def main():
    source=ROOT/'game/art/source/elf-melee-v01.png'
    source.parent.mkdir(parents=True,exist_ok=True)
    if source.exists():
        if source.read_bytes()!=GENERATED.read_bytes():raise ValueError('Existing source differs; create a new art version')
    else:shutil.copy2(GENERATED,source)
    original=np.asarray(Image.open(source).convert('RGBA'));rgba=original.copy();a=rgba[:,:,3]
    # 原生输出有alpha=1的空白噪声；可见主体核心约253。保持轮廓与RGB，仅规范透明度。
    visible=a>128;core=binary_erosion(visible,iterations=6)
    a[a<=1]=0;a[core]=255
    assert np.array_equal(rgba[:,:,:3],original[:,:,:3])
    im=Image.fromarray(rgba);box=im.getchannel('A').getbbox();cut=im.crop(box)
    # 角色实际显示约37个世界单位，192px参考保留足够采样，避免每段动作解码约20MiB。
    h=192;w=round(cut.width*h/cut.height);cut=cut.resize((w,h),Image.Resampling.LANCZOS)
    # 轴心取两个脚底的接触范围中点，不能取包含长匕首的整幅画布中心。
    y0=box[3]-round((box[3]-box[1])*.06);ys,xs=np.where((a>128)&(np.indices(a.shape)[0]>=y0))
    foot_x=(float(xs.min())+float(xs.max()))/2;pivot=(foot_x-box[0])/(box[2]-box[0]);padding=8
    sheet=Image.new('RGBA',(w+padding*2,h+padding*2));sheet.alpha_composite(cut,(padding,padding))
    runtime=ROOT/'game/art/runtime';name='elf-melee-v8.png';normal='normal-elf-melee-v8.png'
    sheet.save(runtime/name);Image.new('RGB',sheet.size,(128,128,255)).save(runtime/normal)
    path=runtime/'manifest.json';m=json.loads(path.read_text('utf-8'))
    if 'elf_melee' in m['frames'] and m['frames']['elf_melee']['sheet']!=name:raise ValueError('Existing frame belongs to another source')
    m['sheets'][name]={'width':sheet.width,'height':sheet.height};m['normals'][name]=normal
    m['frames']['elf_melee']={'sheet':name,'x':padding,'y':padding,'w':w,'h':h,'pivot_x':pivot,'outline':True,'padding':padding}
    path.write_text(json.dumps(m,ensure_ascii=False,indent=2),encoding='utf-8')
    report={'scope':'New built-in imagegen bitmap import, not procedural character generation','source':'game/art/source/elf-melee-v01.png','original_sha256':hashlib.sha256(source.read_bytes()).hexdigest(),'generated_original':str(GENERATED),'raw_rgb_unchanged_before_shared_resize':True,'alpha_noise_cutoff':1,'solid_core_opacity_normalization':'Six-pixel eroded existing visible subject core set to255, original edge alpha retained','crop':box,'shared_runtime_size':[w,h],'pivot_x':pivot,'foot_source_x':foot_x,'normal':'Technical flat normal data, no new painted detail','visual_review':'Native full character plus light/dark/grey inspected; empty quiver, one dagger in forward hand, other hand free, complete boots; engine review pending'}
    out=ROOT/'artifacts/animation-v8/elf-melee-static-v01';out.mkdir(exist_ok=True)
    (out/'import-review.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps(report))

if __name__=='__main__':main()
