"""One-time scoped patch of the current renderer; never a production dependency."""
from pathlib import Path
p=Path(__file__).resolve().parents[1]/'game/scripts/world.gd';s=p.read_text(encoding='utf-8')
def replace(old,new,count=1):
 global s
 assert s.count(old)==count,(old[:100],s.count(old),count)
 s=s.replace(old,new)
replace('var fast_lighting=true','var fast_lighting=true\nvar last_camera_x=-80.0\nvar draw_drift=Vector2.ZERO\nvar glow_entries={}\nvar effect_id=0')
replace('func _update_glow():\n\tglow_sprite.hide()','func _update_glow(delta):\n\tvar active_key=""')
start=s.index('func _update_glow(delta):');end=s.index('\nfunc _process(delta):',start)
old=s[start:end]
info=old[old.index('\tvar info={}'):old.index('\tvar f=art.frames[info.key]')]
info=info.replace('if focus_target.kind=="whip":','if not focus_target.is_empty() and not focus_target.get("disabled",false) and focus_target.kind=="whip":').replace('\n\telse:\n','\n\telif not focus_target.is_empty() and not focus_target.get("disabled",false):\n',1).replace('\n\tif info.is_empty() or not art.frames.has(info.key):return','')
config=old[old.index('\tvar f=art.frames[info.key]'):].replace('glow_sprite','node').replace('glow_material','mat').replace(';node.show()','')
s=s[:start]+'''# 呼吸与显隐分开：失效目标保留旧轮廓淡出，不把旧纹理瞬移给新目标。
func _update_glow(delta):
'''+info+'''
	var active_key=str(focus_target.get("id","")) if not info.is_empty() else ""
	if active_key!="":
		if not glow_entries.has(active_key):
			var node=Sprite2D.new();var mat=ShaderMaterial.new();mat.shader=load("res://game/shaders/proximity_glow.gdshader");node.material=mat;add_child(node);move_child(node,overlay.get_index());glow_entries[active_key]={"node":node,"p":0.0}
		var entry=glow_entries[active_key];_configure_glow(entry.node,entry.node.material,info);glow_sprite=entry.node
	for key in glow_entries.keys():
		var entry=glow_entries[key];entry.p=move_toward(float(entry.p),1.0 if key==active_key else 0.0,delta/(0.18 if key==active_key else 0.22))
		if key!=active_key:entry.node.position+=draw_drift
		entry.node.material.set_shader_parameter("glow_color",Color(0.91,0.85,0.48,smoothstep(0,1,entry.p)))
		if key!=active_key and entry.p<=0:entry.node.hide();entry.node.queue_free();glow_entries.erase(key)
	if not is_instance_valid(glow_sprite):glow_sprite=Sprite2D.new();add_child(glow_sprite);glow_sprite.hide()

func _configure_glow(node,mat,info):
'''+config+'''

func clear_glows():
	for entry in glow_entries.values():entry.node.hide();entry.node.queue_free()
	glow_entries.clear()

func _scope(key,depth=-1.0):
	art.scope(canvas,("reflection/" if reflecting else "world/")+str(key))
	if depth>=0:art.layer(canvas,110+depth/1000.0 if reflecting else depth)
'''+s[end:]
replace('\t_celestial();focus_target=model.find_target();_update_glow()','\tdraw_drift=Vector2((last_camera_x-camera_x)*scale_factor,0);last_camera_x=camera_x\n\t_celestial();focus_target=model.find_target();_update_glow(delta)')
replace('\tcanvas=self\n','\tcanvas=self;art.begin(canvas,draw_drift);_scope("sky",0)\n')
replace('\tif night_amount>0.03:\n\t\tfor i in range(40):','\tif night_amount>0.03:\n\t\tfor i in range(40):\n\t\t\t_scope("star/"+str(i),1)')
replace('\tif moon_visible:\n\t\t_light_blob','\t_scope("celestial",2)\n\tif moon_visible:\n\t\t_light_blob')
replace('\tfor i in range(6):\n\t\tvar x=','\tfor i in range(6):\n\t\t_scope("cloud/"+str(i),3)\n\t\tvar x=')
replace('\tlayer("far",0.10,far_light);layer("middle",0.32,Color(0.25,0.38,0.56).lerp(Color.WHITE,daylight))','\t_scope("forest",4);layer("far",0.10,far_light);layer("middle",0.32,Color(0.25,0.38,0.56).lerp(Color.WHITE,daylight))')
replace('\t\tfor i in range(3):\n\t\t\tvar x=fposmod(elapsed*(20+i*5)','\t\tfor i in range(3):\n\t\t\t_scope("bird/"+str(i),5)\n\t\t\tvar x=fposmod(elapsed*(20+i*5)')
replace('\nfunc _light_blob(', '\n\tart.finish(canvas)\n\nfunc _light_blob(')
replace('canvas.draw_texture_rect(glow_texture,Rect2(point-Vector2.ONE*radius,Vector2.ONE*radius*2),false,color)','art.bitmap(canvas,"glow",glow_texture,Rect2(point-Vector2.ONE*radius,Vector2.ONE*radius*2),color)')
replace('\tcanvas=target_canvas;visible_objects=0','\tcanvas=target_canvas;art.begin(canvas,draw_drift);visible_objects=0;_scope("land",0)')
replace('\t\tsprite(item.key,item.x,','\t\t_scope("decor/"+str(item.x),10)\n\t\tsprite(item.key,item.x,')
replace('\t\tif visible(x,210):sprite("stream_crossing",x,ground+82*scale_factor,160,1,Color.WHITE,295)','\t\t_scope("stream/"+str(x),12)\n\t\tif visible(x,210):sprite("stream_crossing",x,ground+82*scale_factor,160,1,Color.WHITE,295)')
replace('\t\tif model.unlocked(b) and visible(b.x,230):_building(b,Color.WHITE);visible_objects+=1','\t\t_scope("building/"+str(b.id),20)\n\t\tif model.unlocked(b) and visible(b.x,230):_building(b,Color.WHITE);visible_objects+=1')
replace('\t_focused_ghost()\n\t_draw_treasury','\t_scope("ghost",25);_focused_ghost()\n\t_scope("treasury",30);_draw_treasury')
replace('\tfor point in torch_points:sprite("torch" if night_amount>0.15 else "torch_unlit",point.x,ground,51 if night_amount>0.15 else 34,1,Color.WHITE)','\tfor point in torch_points:\n\t\t_scope("torch/"+str(point.x),35);sprite("torch" if night_amount>0.15 else "torch_unlit",point.x,ground,51 if night_amount>0.15 else 34,1,Color.WHITE)')
replace('\t\tif visible(x):sprite("tribal_banner",x,ground,55)','\t\t_scope("boundary/"+str(x),35)\n\t\tif visible(x):sprite("tribal_banner",x,ground,55)')
replace('\t\tif not visible(d.x):continue\n\t\tif d.kind=="gold":','\t\tif not visible(d.x):continue\n\t\t_scope("drop/"+str(d.id),40)\n\t\tif d.kind=="gold":')
replace('\t\tif visible(body.x):_fallen_goblin(body,Color(0.72,0.76,0.78))','\t\t_scope("body/"+str(body.get("id",body.x)),60)\n\t\tif visible(body.x):_fallen_goblin(body,Color(0.72,0.76,0.78))')
replace('\tif trader.phase!="away" and visible(trader.x):','\t_scope("trader",85)\n\tif trader.phase!="away" and visible(trader.x):')
replace('\tfor shot in model.state.shots:\n\t\tvar x=','\tfor shot in model.state.shots:\n\t\t_scope("shot/"+str(shot.get("visual_id",0)),200)\n\t\tvar x=')
replace('\tlayer("foreground",1.15,Color(0.35,0.49,0.69).lerp(Color.WHITE,daylight))','\t_scope("foreground",120);layer("foreground",1.15,Color(0.35,0.49,0.69).lerp(Color.WHITE,daylight));art.finish(canvas)')
# 原生绘制变换也进入快照，保证倒地旋转与水中倒影的退场位置正确。
s=s.replace('canvas.draw_set_transform(', 'art.set_transform(canvas,')
replace('func _hero(light):\n','func _hero(light):\n\t_scope("hero",50)\n')
replace('func _unit(u,light):\n','func _unit(u,light):\n\t_scope("unit/"+str(u.id),70)\n')
replace('func _enemy(e,light):\n','func _enemy(e,light):\n\t_scope("enemy/"+str(e.id),80)\n')
replace('\t\t\t\tvar c=model.state.captives[i]\n','\t\t\t\tvar c=model.state.captives[i]\n') if False else None
replace('\t\t\t\t\tvar c=model.state.captives[i]','\t\t\t\t\tvar c=model.state.captives[i];_scope("building/"+str(b.id)+"/captive/"+str(c.id),20.1)')
replace('\t\t\t\tsprite("prison_front"+suffix,','\t\t\t\t_scope("building/"+str(b.id)+"/front",20.2)\n\t\t\t\tsprite("prison_front"+suffix,')
replace('\tfor b in model.state.buildings:\n\t\tif visible(b.x):_building(b,tint)','\tfor b in model.state.buildings:\n\t\t_scope("building/"+str(b.id),20)\n\t\tif visible(b.x):_building(b,tint)')
replace('\tif t.phase!="away" and visible(t.x):','\t_scope("trader",85)\n\tif t.phase!="away" and visible(t.x):')
replace('\tvar target=focus_target\n\tif target.is_empty() or target.get("disabled",false) or target.get("cost",0)<=0 or target.get("shop","")!="":return','\tvar target=focus_target\n\t_scope("ghost/"+str(target.get("id","")),25)\n\tif target.is_empty() or target.get("disabled",false) or target.get("cost",0)<=0 or target.get("shop","")!="":return')
replace('\tvar paid=int(model.state.get("payment",{}).get("paid",0));slot_count=cost','\t_scope("slots/"+str(target.id),50)\n\tvar paid=int(model.state.get("payment",{}).get("paid",0));slot_count=cost')
replace('\te.born=elapsed;effects.append(e)','\te.born=elapsed;effect_id+=1;e.visual_id=effect_id;effects.append(e)')
replace('\tfor e in effects:\n\t\tvar age=','\tfor e in effects:\n\t\t_scope("effect/"+str(e.visual_id),200)\n\t\tvar age=')
replace('canvas.draw_polyline(points,Color(0.58,0.39,0.20,1-t),1.6*scale_factor,true)','art.lines(canvas,"whip",points,Color(0.58,0.39,0.20,1-t),1.6*scale_factor)')
replace('\tfor batch in stroke_batches.values():canvas.draw_multiline(batch.points,batch.tone,2*scale_factor,true)','\tfor key in stroke_batches:\n\t\t_scope("stroke/"+str(key),200);var batch=stroke_batches[key];art.lines(canvas,"stroke",batch.points,batch.tone,2*scale_factor,true)')
replace('\tcanvas=target_canvas\n\tvar whip_target','\tcanvas=target_canvas;art.begin(canvas,draw_drift);_scope("whip_hint",5)\n\tvar whip_target')
replace('\tfor d in model.state.drops:\n\t\tif d.kind=="gold" and visible(d.x):','\tfor d in model.state.drops:\n\t\t_scope("coin_glow/"+str(d.id),6)\n\t\tif d.kind=="gold" and visible(d.x):')
replace('\tfor u in model.state.units:\n\t\tif u.get("stun",0)>0','\tfor u in model.state.units:\n\t\t_scope("stun/"+str(u.id),7)\n\t\tif u.get("stun",0)>0')
replace('\t\tvar pos=Vector2(sx(anchor)', '\t\tvar pos=Vector2(sx(anchor)') if False else None
replace('\t\t\tvar pos=Vector2(sx(anchor)','\t\t\t_scope("firefly/"+str(anchor),25)\n\t\t\tvar pos=Vector2(sx(anchor)')
replace('\t\tfor point in torch_points:_light_blob','\t\tfor point in torch_points:\n\t\t\t_scope("torch_glow/"+str(point.x),26);_light_blob')
replace('\t\t\tvar x=camera_x-350+i*160','\t\t\t_scope("butterfly/"+str(i),25)\n\t\t\tvar x=camera_x-350+i*160')
replace('\t\tfor i in range(3):canvas.draw_texture_rect(glow_texture,Rect2(fposmod(elapsed*6+i*size.x*0.4,size.x+300)-150,ground-36*scale_factor,420*scale_factor,50*scale_factor),false,Color(0.78,0.85,0.82,(1-model.state.time/25.0)*0.09))','\t\t_scope("mist",27)\n\t\tfor i in range(3):art.bitmap(canvas,"mist",glow_texture,Rect2(fposmod(elapsed*6+i*size.x*0.4,size.x+300)-150,ground-36*scale_factor,420*scale_factor,50*scale_factor),Color(0.78,0.85,0.82,(1-model.state.time/25.0)*0.09))')
replace('\t_interaction_preview();_draw_effects()','\t_interaction_preview();_draw_effects();art.finish(canvas)')
replace('canvas.draw_string(font,position-Vector2(width/2,0),value,HORIZONTAL_ALIGNMENT_LEFT,-1,pixels,color)','art.text(canvas,font,value,position-Vector2(width/2,0),pixels,color)')
replace('func _price_sign(b,target):\n','func _price_sign(b,target):\n\t_scope("price/"+str(target.id),15)\n')
# 仅显示态编号，不能消费模型ID或随机源。
replace('\t_collect_effects();effects=effects.filter', '\tfor shot in model.state.shots:\n\t\tif not shot.has("visual_id"):effect_id+=1;shot.visual_id=effect_id\n\t_collect_effects();effects=effects.filter')
p.write_text(s,encoding='utf-8')
print('scoped bitmap, text, glow and effect transitions connected')
