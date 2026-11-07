"""对已经人工辨认的根部/地基区域检查原片锚点，不自动挑选容易通过的区域。"""
from pathlib import Path
from PIL import Image
import argparse,json,numpy as np
def audit_base(folder,below):
    folder=Path(folder);rows=[]
    for file in sorted((folder/'masks').glob('*.png')):
        alpha=np.asarray(Image.open(file).convert('L'));y,x=np.where((alpha>128)&(np.indices(alpha.shape)[0]>=below))
        if not len(x):raise ValueError('No reviewed base pixels: '+str(file))
        rows.append({'frame':file.stem,'left':int(x.min()),'right':int(x.max()),'bottom':int(y.max())})
    result={'scope':f'Original source base below y{below}; band selected from visual source review before measurement','samples':rows}
    for name in ['left','right','bottom']:result[name+'_range']=max(r[name] for r in rows)-min(r[name] for r in rows)
    (folder/'root-audit.json').write_text(json.dumps(result,indent=2),encoding='utf-8');return result
if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('folder');p.add_argument('--below',type=int,required=True);a=p.parse_args();r=audit_base(a.folder,a.below);print(json.dumps({k:v for k,v in r.items() if k!='samples'}))
