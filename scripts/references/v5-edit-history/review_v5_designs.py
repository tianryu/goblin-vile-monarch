from pathlib import Path
p=Path('art/design/interaction-v5/prototype.html')
s=p.read_text(encoding='utf-8')
archive=p.parent/'prototype-before-review.html'
if not archive.exists():archive.write_text(s,encoding='utf-8')
s=s.replace("function sprite(name,h=90){","function sprite(name,h=90,maxWidth=Infinity){").replace("scale=h/f.h,d=document.createElement('div');","scale=Math.min(h/f.h,maxWidth/f.w),d=document.createElement('div');h=f.h*scale;")
s=s.replace("sprite(page.image,178)","sprite(page.image,178,240)")
p.write_text(s,encoding='utf-8')

