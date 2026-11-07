"""在临时单帧夹具中故意损坏源图/交付帧/图集，确认审计能拒绝，不触碰生产素材。"""
from pathlib import Path
import tempfile,shutil,json
from PIL import Image
from audit_animation_source_v8 import audit_source

source=Path('artifacts/animation-v8/elf_melee-walk-v01/cycle-v02')
m=json.loads((source/'manifest.json').read_text('utf-8'));m['source_indices']=m['source_indices'][:1]
results=[]
with tempfile.TemporaryDirectory(prefix='source-audit-',dir='qa') as temporary:
    root=Path(temporary);folder=root/'clip';folder.mkdir();(root/'source').mkdir()
    assert root.resolve().is_relative_to(Path('qa').resolve())
    shutil.copy2(source.parent/'source/video.mp4',root/'source/video.mp4')
    name=f"frame_{m['source_indices'][0]:03d}.png"
    for part,file in [('raw',name),('masks',name),('frames','frame_000.png')]:
        (folder/part).mkdir();shutil.copy2(source/part/file,folder/part/file)
    shutil.copy2(source/'spritesheet.png',folder/'spritesheet.png')
    report,_=audit_source(folder,m);results.append({'case':'unchanged original sequence passes','passed':report['passed']})
    for part,file,label in [('raw',name,'original video mismatch'),('frames','frame_000.png','shared transform mismatch'),('', 'spritesheet.png','atlas mismatch')]:
        path=folder/part/file;original=path.read_bytes();im=Image.open(path).convert('RGBA' if part!='raw' else 'RGB')
        if part=='raw':x,y=0,0
        else:
            alpha=Image.open(folder/'frames/frame_000.png').getchannel('A');x,y=next((x,y) for y in range(alpha.height) for x in range(alpha.width) if alpha.getpixel((x,y))>250)
        pixel=list(im.getpixel((x,y)));pixel[0]=(pixel[0]+47)%256;im.putpixel((x,y),tuple(pixel));im.save(path)
        report,_=audit_source(folder,m);results.append({'case':label+' is rejected','passed':not report['passed']});path.write_bytes(original)
    # Padding is a zero-alpha packing margin. It must preserve every old RGBA
    # pixel exactly, and a single newly visible pixel must still be rejected.
    old=Image.open(folder/'frames/frame_000.png').convert('RGBA');pad=8
    padded=Image.new('RGBA',(old.width+16,old.height+16));padded.paste(old,(pad,pad));padded.save(folder/'frames/frame_000.png')
    atlas=Image.new('RGBA',(padded.width*4,padded.height));atlas.paste(padded,(0,0));atlas.save(folder/'spritesheet.png')
    m.update(resize_size=list(old.size),output_padding=pad,width=padded.width,height=padded.height)
    report,_=audit_source(folder,m);results.append({'case':'Whole-frame transparent padding preserves exact source pixels','passed':report['passed']})
    padded.putpixel((0,0),(255,255,255,1));padded.save(folder/'frames/frame_000.png')
    report,_=audit_source(folder,m);results.append({'case':'One stray visible padding pixel is rejected','passed':not report['passed']})
Path('qa/godot/v8-source-audit-negative.json').write_text(json.dumps({'scope':'Isolated deliberate pixel corruption, original assets unchanged','results':results},indent=2),encoding='utf-8')
print(json.dumps(results));raise SystemExit(0 if all(r['passed'] for r in results) else 1)
