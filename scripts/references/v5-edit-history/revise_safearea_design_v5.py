from pathlib import Path
p=Path('art/design/interaction-v5/prototype.html');s=p.read_text(encoding='utf-8')
q=p.with_name('prototype-before-safearea-review.html')
if not q.exists():q.write_text(s,encoding='utf-8')
s=s.replace("el('art','',card).append(sprite(image,100));","const picture=el('art','',card);picture.append(sprite(image,86));if(page.id==='prison'){let front=sprite(image.replace('back','front'),86);front.style.position='absolute';front.style.left='50%';front.style.transform='translateX(-50%)';picture.append(front)}")
s=s.replace('</style>',""".card{display:block;padding:0}.card .art{position:absolute;left:12px;right:12px;top:12px;height:86px}.card h3{position:absolute;left:10px;right:10px;top:102px;height:31px;line-height:31px}.card .detail{position:absolute;left:10px;right:10px;top:136px;height:49px;line-height:23px}.card .price{position:absolute;left:0;right:0;top:191px;height:30px;margin:0}
</style>""")
p.write_text(s,encoding='utf-8')

