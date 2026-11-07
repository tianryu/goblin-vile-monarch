"""只移除透明区中与主体分离的极小杂点，不涂补或改变原创AI主体。"""
from PIL import Image, ImageFilter
from collections import deque

def clean_detached_alpha(im):
    alpha=im.getchannel('A'); w,h=im.size
    pixels=bytearray(alpha.point(lambda value:255 if value>24 else 0).tobytes())
    keep=bytearray(w*h)
    # 八邻接保留细弓弦和斜线，面积门槛只针对大源图的孤立杂点。
    for start in range(w*h):
        if not pixels[start]:continue
        pixels[start]=0;queue=deque([start]);component=[]
        while queue:
            index=queue.popleft();component.append(index);x=index%w;y=index//w
            for yy in range(max(0,y-1),min(h,y+2)):
                for xx in range(max(0,x-1),min(w,x+2)):
                    nearby=yy*w+xx
                    if pixels[nearby]:pixels[nearby]=0;queue.append(nearby)
        if len(component)>=80:
            for index in component:keep[index]=255
    # 保留主体外侧两像素的原抗锯齿，不硬切轮廓。
    support=Image.frombytes('L',(w,h),bytes(keep)).filter(ImageFilter.MaxFilter(5))
    out=im.copy()
    from PIL import ImageChops
    out.putalpha(ImageChops.multiply(alpha,support))
    return out
