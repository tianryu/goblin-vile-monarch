from pathlib import Path
from PIL import Image,ImageChops,ImageStat
import json
root=Path('qa/interaction-v5')
a=Image.open(root/'water-flow-a.png').convert('RGB').crop((250,296,570,348))
b=Image.open(root/'water-flow-b.png').convert('RGB').crop((250,296,570,348))
d=ImageChops.difference(a,b);values=list(d.getdata())
report={'scope':'Difference of actual runtime screenshots in a clear water region 1.2 seconds apart. Sky and UI are excluded. Not a perceptual style score.','water_mean_abs_rgb':sum(ImageStat.Stat(d).mean)/3,'water_changed_fraction':sum(max(v)>3 for v in values)/len(values)}
(root/'visual-review.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
print(json.dumps(report))

