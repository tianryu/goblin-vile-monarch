"""从已人工核对的首帧蒙版跟踪同一主体。仅生成alpha，逐帧同坐标保留原RGB。"""
from pathlib import Path
import argparse,hashlib,json,time
import numpy as np
from PIL import Image
import imageio_ffmpeg

def matte_video(folder,seed_mask,indices,version):
    import torch
    from transformers import Sam2VideoModel,Sam2VideoProcessor
    torch.set_num_threads(6)
    folder=Path(folder).resolve();seed_mask=Path(seed_mask).resolve();target=folder/version
    if target.exists():raise FileExistsError(target)
    target.mkdir()
    for name in ['raw','masks','frames']:(target/name).mkdir()
    started=time.time();reader=imageio_ffmpeg.read_frames(str(folder/'source/video.mp4'),pix_fmt='rgb24');metadata=next(reader);w,h=metadata['size']
    frames=[Image.fromarray(np.frombuffer(raw,np.uint8).reshape(h,w,3).copy()) for raw in reader];reader.close()
    mask=np.asarray(Image.open(seed_mask).convert('L'))>128
    if mask.shape!=(h,w):raise ValueError('Reviewed first mask must be in original video coordinates')
    # 复用本机官方权重，独立CPU推理，不占用H3的共享GPU。
    name='facebook/sam2.1-hiera-tiny'
    model=Sam2VideoModel.from_pretrained(name,trust_remote_code=False,local_files_only=True).to('cpu').eval()
    processor=Sam2VideoProcessor.from_pretrained(name,trust_remote_code=False,local_files_only=True)
    session=processor.init_video_session(video=frames,inference_device='cpu',inference_state_device='cpu',video_storage_device='cpu',dtype=torch.float32)
    processor.add_inputs_to_inference_session(inference_session=session,frame_idx=0,obj_ids=[1],input_masks=mask)
    rows=[]
    with torch.inference_mode():
        for output in model.propagate_in_video_iterator(session,start_frame_idx=0):
            i=output.frame_idx
            if i>max(indices):break
            if i not in indices:continue
            # 首帧也使用模型返回的alpha，不能以参考剪影复制后续姿势。
            masks=processor.post_process_masks([output.pred_masks],original_sizes=[[h,w]],binarize=False)[0]
            alpha=(masks[0,0].cpu().numpy()>0).astype(np.uint8)*255
            rgb=np.asarray(frames[i]);rgba=np.dstack((rgb,alpha));filename=f'frame_{i:03d}.png'
            frames[i].save(target/'raw'/filename);Image.fromarray(alpha).save(target/'masks'/filename);Image.fromarray(rgba).save(target/'frames'/filename)
            rows.append({'source_index':i,'foreground_pixels':int((alpha>0).sum()),'rgb_equal':True});print('tracked',i,flush=True)
    report={'model':name,'mode':'SAM2Video temporal mask tracking on CPU','device':'cpu','status':'candidate-needs-source-contour-review','source_sha256':hashlib.sha256((folder/'source/video.mp4').read_bytes()).hexdigest(),'seed_mask':str(seed_mask),'seed_mask_sha256':hashlib.sha256(seed_mask.read_bytes()).hexdigest(),'frames':rows,'seconds':time.time()-started,'same_coordinate_rgb':True,'reference':'https://huggingface.co/docs/transformers/v5.19.0/model_doc/sam2_video'}
    (target/'matte.json').write_text(json.dumps(report,indent=2),encoding='utf-8')

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('folder');p.add_argument('--seed-mask',required=True);p.add_argument('--indices',required=True);p.add_argument('--version',required=True);a=p.parse_args();matte_video(a.folder,a.seed_mask,[int(v) for v in a.indices.split(',')],a.version)
