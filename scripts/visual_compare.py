"""Compare a real browser screenshot with the approved mockup, no masks/registration.
SSIM: 11x11 Gaussian window, sigma1.5, population covariance, RGB channel mean.
The score is structural image similarity, not a claim of universal perceptual accuracy.
"""
from PIL import Image,ImageDraw,ImageFont
import numpy as np,json,pathlib,sys
root=pathlib.Path(__file__).resolve().parents[1]
reference=root/'art/design/goblin-monarch-gameplay-v2.png'
runtime=root/(sys.argv[1] if len(sys.argv)>1 else 'art/design/runtime-first.png')
out=root/'qa';out.mkdir(exist_ok=True)
a=Image.open(reference).convert('RGB');b=Image.open(runtime).convert('RGB')
if a.size!=b.size: raise ValueError(f'Screenshots must have identical dimensions, got {a.size} and {b.size}')
x=np.asarray(a,dtype=np.float64);y=np.asarray(b,dtype=np.float64)
w=np.exp(-np.arange(-5,6,dtype=float)**2/(2*1.5**2));w/=w.sum()
def blur(z):
    h,wd=z.shape[:2];p=np.pad(z,((0,0),(5,5),(0,0)),mode='reflect');v=sum(w[i]*p[:,i:i+wd] for i in range(11));p=np.pad(v,((5,5),(0,0),(0,0)),mode='reflect');return sum(w[i]*p[i:i+h] for i in range(11))
ux,uy=blur(x),blur(y);vx=np.maximum(0,blur(x*x)-ux*ux);vy=np.maximum(0,blur(y*y)-uy*uy);cov=blur(x*y)-ux*uy
ssim=((2*ux*uy+(.01*255)**2)*(2*cov+(.03*255)**2))/((ux**2+uy**2+(.01*255)**2)*(vx+vy+(.03*255)**2))
score=float(ssim[5:-5,5:-5].mean());mae=float(np.abs(x-y).mean());report={'reference':str(reference),'runtime':str(runtime),'dimensions':a.size,'metric':'RGB SSIM, Gaussian 11x11 sigma 1.5, population covariance','whole_frame_ssim':score,'similarity_percent':round(score*100,2),'threshold_percent':90,'passed':score>=.90,'mean_absolute_rgb_error':round(mae,3),'normalization':'No alignment, color correction, mask, region weighting or content removal. Original identical-size whole frames. Only 5px mathematical window border omitted.','limitations':'Same scene/time/view comparison, not cross-scene similarity or device FPS evidence. Joystick intentionally differs from approved two-arrow mockup. Environment is derived from the approved art; dynamic sprites/UI are implemented separately.'}
(out/'visual-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
fontpath='C:/Windows/Fonts/msyh.ttc'
font=ImageFont.truetype(fontpath,23);small=ImageFont.truetype(fontpath,17)
thumb=(887,444);sheet=Image.new('RGB',(1806,550),'#132737');d=ImageDraw.Draw(sheet)
d.text((16,12),'设计基准 v2',font=font,fill='#e5d1a5');d.text((919,12),'实际运行截图　左下已改水平摇杆',font=font,fill='#e5d1a5');sheet.paste(a.resize(thumb),(16,54));sheet.paste(b.resize(thumb),(919,54))
d.text((16,511),f'整帧 RGB SSIM：{score*100:.2f}%   /   验收阈值：90%   /   不遮罩、不调色、不对齐',font=small,fill='#d9e1d2');sheet.save(out/'visual-comparison.png')
print(json.dumps(report,ensure_ascii=False,indent=2))
if score<.90:sys.exit(2)
