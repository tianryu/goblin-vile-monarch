"""逐像素比对原视频、蒙版、共享变换和图集，报告只记录统计及哈希，内存不随帧数增长。"""
from pathlib import Path
from PIL import Image
import hashlib,json
import imageio_ffmpeg,numpy as np

def audit_source(folder,manifest):
    folder=Path(folder);m=manifest;video=folder.parent/'source/video.mp4'
    rows=[];failures=[]
    if hashlib.file_digest(video.open('rb'),'sha256').hexdigest()!=m['source_sha256']:
        failures.append('Frozen source video SHA256 mismatch')
    indices={source:i for i,source in enumerate(m['source_indices'])}
    reader=imageio_ffmpeg.read_frames(str(video),pix_fmt='rgb24');meta=next(reader);w,h=meta['size']
    atlas=Image.open(folder/'spritesheet.png').convert('RGBA')
    for source,raw in enumerate(reader):
        if source not in indices:continue
        i=indices[source];name=f'frame_{source:03d}.png';rgb=np.frombuffer(raw,np.uint8).reshape(h,w,3)
        stored=np.asarray(Image.open(folder/'raw'/name).convert('RGB'))
        alpha=np.asarray(Image.open(folder/'masks'/name).convert('L'))
        source_equal=stored.shape==rgb.shape and np.array_equal(stored,rgb)
        if alpha.shape!=(h,w):raise ValueError('Mask dimensions differ from original video')
        # 与制作阶段完全相同的单次共享裁切/缩放，不重新居中、不修画姿势。
        rgba=Image.fromarray(np.dstack((rgb,alpha)))
        expected=rgba.crop(tuple(m['source_crop'])).resize(tuple(m.get('resize_size',[m['width'],m['height']])),Image.Resampling.LANCZOS)
        pad=int(m.get('output_padding',0))
        if pad:
            padded=Image.new('RGBA',(m['width'],m['height']));padded.paste(expected,(pad,pad));expected=padded
        file=folder/'frames'/f'frame_{i:03d}.png';output=Image.open(file).convert('RGBA')
        transformed_equal=output.size==expected.size and np.array_equal(np.asarray(output),np.asarray(expected))
        tile=atlas.crop((i%4*m['width'],i//4*m['height'],(i%4+1)*m['width'],(i//4+1)*m['height']))
        a=np.asarray(output);b=np.asarray(tile);visible=a[:,:,3]>0
        atlas_equal=np.array_equal(a[:,:,3],b[:,:,3]) and np.array_equal(a[:,:,:3][visible],b[:,:,:3][visible])
        row={'source_index':source,'original_video_rgb_equal':bool(source_equal),'shared_transform_rgba_equal':bool(transformed_equal),'atlas_visible_pixels_equal':bool(atlas_equal),'source_rgb_sha256':hashlib.sha256(rgb.tobytes()).hexdigest(),'alpha_sha256':hashlib.sha256(alpha.tobytes()).hexdigest(),'output_png_sha256':hashlib.sha256(file.read_bytes()).hexdigest(),'compared_original_rgb_values':w*h*3}
        rows.append(row)
        if not(source_equal and transformed_equal and atlas_equal):failures.append('Source/transform/atlas mismatch '+str(source))
    reader.close()
    if len(rows)!=len(indices):failures.append('Missing requested source frames')
    report={'scope':'Full pixel equality, streamed original video to raw RGB and exact shared RGBA transform to frames and visible atlas. Hashes are evidence; this does not prove anatomy or alpha silhouette completeness.','passed':not failures,'failures':failures,'frames':rows}
    path=folder/'source-rgb-stream-audit.json';path.write_text(json.dumps(report,indent=2),encoding='utf-8')
    return report,path
