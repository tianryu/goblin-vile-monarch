"""只取回原片已有弓弦。检测结果须先按source-string-detectors.png逐帧确认。"""
from pathlib import Path
from PIL import Image
import numpy as np,json,shutil,hashlib

def restore(folder,source='matte-video-v01',version='matte-video-v03'):
    folder=Path(folder);target=folder/version
    if target.exists():raise FileExistsError(target)
    for name in ['raw','masks','frames']:(target/name).mkdir(parents=True,exist_ok=True)
    annotations=json.loads((folder/'diagnostics/source-string-detectors.json').read_text());rows=[]
    for row in annotations:
        name=row['frame'];rgb=np.array(Image.open(folder/source/'raw'/name));alpha=np.array(Image.open(folder/source/'masks'/name));gray=rgb.astype(float).mean(2);before=alpha.copy()
        for line in row['detected']:
            x1,y1,x2,y2=line['segment'];slope=(x2-x1)/(y2-y1)
            # 仅检查独立源图识别出的细线附近。实际像素还须比左右背景暗，
            # 不把整条数学直线填进alpha，不改RGB，也不外推新的动作或弓弦。
            first=max(125,min(y1,y2)-(40 if line['kind']=='top' else 5))
            last=min(510,max(y1,y2)+(5 if line['kind']=='top' else 24))
            for y in range(first,last+1):
                guess=x1+(y-y1)*slope;lo=max(5,int(guess)-3);hi=min(rgb.shape[1]-6,int(guess)+4)
                x=lo+int(np.argmin(gray[y,lo:hi]));background=min(gray[y,x-5],gray[y,x+5])
                for k in range(max(lo,x-1),min(hi,x+2)):
                    if background-gray[y,k]>14 and gray[y,k]<165:alpha[y,k]=255
        filename=target/'masks'/name;Image.fromarray(alpha).save(filename);Image.fromarray(np.dstack((rgb,alpha))).save(target/'frames'/name);shutil.copy2(folder/source/'raw'/name,target/'raw'/name)
        rows.append({'source_index':int(name[6:9]),'restored_original_source_pixels':int(((alpha>0)&(before==0)).sum()),'rgb_equal':True,'foreground_pixels':int((alpha>0).sum())})
    info=json.loads((folder/source/'matte.json').read_text());info.update(status='candidate-needs-source-contour-review',frames=rows,repair='Independent raw-source line detections reviewed across 28 frames. Restore only original darker narrow-line pixels adjacent to the detected original line. No RGB drawing or pose alteration.',source_annotation_sha256=hashlib.sha256((folder/'diagnostics/source-string-detectors.json').read_bytes()).hexdigest())
    (target/'matte.json').write_text(json.dumps(info,indent=2),encoding='utf-8');print('restored original pixels',sum(r['restored_original_source_pixels'] for r in rows))

if __name__=='__main__':restore(Path('artifacts/animation-v8/elf-walk-v02'))
