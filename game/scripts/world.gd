extends Node2D

var model
var art
var camera_x=-300.0
var elapsed=0.0
var effect_elapsed=0.0
var visible_objects=0
var scale_factor=0.533333
var size=Vector2(512,256)
var ground=166.4
var font
var reflecting=false
var canvas
var surface
var actors_surface
var water_node
var water_material
var daylight=1.0
var interpolation=1.0
var previous={}
var effects=[]
var last_visual=0
var slot_count=0
var ghost_key=""
var focus_target={}
var overlay
var lit_material
var sunlight
var moonlight
var torch_lights=[]
var light_texture
var glow_texture
var glow_sprite
var glow_material
var decor=[]
var torch_points=[]
var sun_position=Vector2.ZERO
var moon_position=Vector2.ZERO
var phase_progress=0.0
var night_amount=0.0
var ambient=Color.WHITE
var moon_visible=false
var rendered_order=["buildings","hero","goblins","enemies"]
var fast_lighting=true
var last_camera_x=-80.0
var draw_drift=Vector2.ZERO
var glow_entries={}
var glow_fallback
var effect_id=0
var world_presence=0.0
var lamp_entries={}
var interaction_visible=true
var fire_field
var fire_sources=[]

func capture_previous():
	previous={"hero":float(model.state.hero.x),"trader":float(model.state.trader.x)}
	for u in model.state.units:previous[u.id]=float(u.x)
	for e in model.state.enemies:previous[e.id]=float(e.x)

func render_x(key,current):
	var before=float(previous.get(key,current))
	if model.paused() or abs(before-current)>80:return float(current)
	return lerpf(before,float(current),interpolation)

func _ready():
	texture_filter=CanvasItem.TEXTURE_FILTER_LINEAR;canvas=self;font=load("res://game/fonts/GoblinHand-game.ttf")
	var unlit=CanvasItemMaterial.new();unlit.light_mode=CanvasItemMaterial.LIGHT_MODE_UNSHADED;material=unlit
	water_node=TextureRect.new();water_node.texture=art.texture("water");water_node.expand_mode=TextureRect.EXPAND_IGNORE_SIZE;water_node.mouse_filter=Control.MOUSE_FILTER_IGNORE
	water_material=ShaderMaterial.new();water_material.shader=load("res://game/shaders/water_flow.gdshader");water_node.material=water_material;add_child(water_node)
	surface=load("res://game/scripts/world_surface.gd").new();surface.world=self;surface.set_meta("use_normals",true)
	lit_material=ShaderMaterial.new();lit_material.shader=load("res://game/shaders/world_light_fast.gdshader");surface.material=lit_material;add_child(surface)
	actors_surface=load("res://game/scripts/world_surface.gd").new();actors_surface.world=self;actors_surface.actors=true;actors_surface.z_index=10;actors_surface.set_meta("use_normals",true);actors_surface.material=lit_material;add_child(actors_surface)
	light_texture=GradientTexture2D.new();light_texture.width=256;light_texture.height=256;light_texture.fill=GradientTexture2D.FILL_RADIAL;light_texture.fill_from=Vector2(0.5,0.5);light_texture.fill_to=Vector2(1,0.5)
	var gradient=Gradient.new();gradient.offsets=PackedFloat32Array([0.0,0.25,0.7,1.0]);gradient.colors=PackedColorArray([Color.WHITE,Color(0.82,0.82,0.82),Color(0.18,0.18,0.18),Color.BLACK]);light_texture.gradient=gradient
	glow_texture=GradientTexture2D.new();glow_texture.width=256;glow_texture.height=256;glow_texture.fill=GradientTexture2D.FILL_RADIAL;glow_texture.fill_from=Vector2(0.5,0.5);glow_texture.fill_to=Vector2(1,0.5)
	var fade=Gradient.new();fade.offsets=PackedFloat32Array([0.0,0.25,0.7,1.0]);fade.colors=PackedColorArray([Color.WHITE,Color(1,1,1,0.65),Color(1,1,1,0.1),Color(1,1,1,0)]);glow_texture.gradient=fade
	sunlight=DirectionalLight2D.new();sunlight.height=0.75;sunlight.color=Color(1.0,0.88,0.66);add_child(sunlight)
	moonlight=DirectionalLight2D.new();moonlight.height=0.65;moonlight.color=Color(0.52,0.7,1.0);add_child(moonlight)
	for i in range(8):
		var light=PointLight2D.new();light.texture=light_texture;light.color=Color(1.0,0.57,0.22);light.height=65;light.shadow_enabled=false;add_child(light);torch_lights.append(light)
	glow_sprite=Sprite2D.new();glow_material=ShaderMaterial.new();glow_material.shader=load("res://game/shaders/proximity_glow.gdshader");glow_sprite.material=glow_material;add_child(glow_sprite);glow_sprite.hide();glow_fallback=glow_sprite
	overlay=load("res://game/scripts/world_overlay.gd").new();overlay.world=self;overlay.z_index=30;overlay.material=unlit;add_child(overlay)
	fire_field=preload("res://game/scripts/fire_field.gd").new();add_child(fire_field)
	_build_decor()
	camera_x=model.state.hero.x

func _build_decor():
	decor.clear();var random=RandomNumberGenerator.new();random.seed=71337
	for side in [-1,1]:
		for center in [520,1110,2020,2920,3950,4470,5730,6250,6880,8560]:
			var count=2 if center<1800 else (5 if center in [3950,6250] else 3)
			for i in range(count):
				var x=(center+random.randf_range(-160,160)+i*67)*side
				var key=["tree_oak","tree_willow","tree_pine"][random.randi_range(0,2)]
				decor.append({"key":key,"x":x,"h":random.randf_range(155,280),"face":side})
				decor.append({"key":"forest_shrub","x":x+random.randf_range(-60,70),"h":random.randf_range(20,34),"face":side})

func _celestial(delta):
	var t=float(model.state.time);moon_visible=t>=120;phase_progress=fposmod(t,120)/120.0
	var arc=sin(phase_progress*PI)
	daylight=0.0 if moon_visible else pow(maxf(0,arc),0.4)
	night_amount=1.0-smoothstep(0.03,0.46,daylight)
	var point=Vector2(size.x*(0.04+phase_progress*0.92),size.y*(0.68-arc*0.57))
	sun_position=point if not moon_visible else Vector2(-200,size.y)
	moon_position=point if moon_visible else Vector2(-200,size.y)
	ambient=Color(0.27,0.37,0.55).lerp(Color(0.73,0.76,0.70),daylight)
	lit_material.set_shader_parameter("ambient_color",Vector3(ambient.r,ambient.g,ambient.b))
	sunlight.enabled=not moon_visible and daylight>0.001 and get_meta("probe_directional",true)
	moonlight.enabled=moon_visible and arc>0.001 and get_meta("probe_directional",true)
	sunlight.energy=0.32*daylight;sunlight.rotation=lerpf(-0.9,0.9,phase_progress);sunlight.height=0.35+0.5*arc
	moonlight.energy=0.24*sqrt(maxf(0,arc)) if moon_visible else 0.0;moonlight.rotation=lerpf(-0.75,0.75,phase_progress)
	torch_points=[]
	for b in model.state.buildings:
		if not model.unlocked(b) or b.level<=0 or not visible(b.x,230):continue
		if b.kind in ["hall","tools","prison","den","woodcut","farm","mine","outpost"]:torch_points.append({"x":b.x+55,"y":ground+ground_offset(b.x+55)-31*scale_factor})
	# 木柄整天固定，夜色平滑点火；篝火白天仍燃烧，火形和照明共用相位。
	fire_sources=[];var lamp_sources=[]
	for flame_point in torch_points:
		var source={"id":"torch/"+str(flame_point.x),"kind":"torch","point":Vector2(sx(flame_point.x)+4.1*scale_factor,flame_point.y-2.0*scale_factor),"width":11.5,"height":21.0,"seed":fposmod(float(flame_point.x)*0.13,50),"strength":night_amount}
		if night_amount>0.001:fire_sources.append(source)
		if night_amount>0.001:lamp_sources.append({"id":source.id,"x":flame_point.x+4.1,"y":source.point.y-8*scale_factor,"seed":source.seed,"strength":night_amount})
	for b in model.state.buildings:
		if not model.unlocked(b) or not visible(b.x,230) or not (b.kind=="camp" or (b.kind=="hall" and b.level==1 and b.hp>0)):continue
		var h=building_height(b);var width=h*265.0/180.0;var ratio=h/130.0;var fx=b.x-width*0.118;var fy=ground+ground_offset(fx)-h*0.089*scale_factor
		var seed_value=fposmod(float(b.id)*0.87,50)
		fire_sources.append({"id":"campfire/"+str(b.id),"kind":"campfire","point":Vector2(sx(fx),fy),"width":23*ratio,"height":32*ratio,"seed":seed_value,"strength":1.0})
		lamp_sources.append({"id":"campfire/"+str(b.id),"x":fx,"y":fy-13*ratio*scale_factor,"seed":seed_value,"strength":lerpf(0.22,1.0,night_amount)})
	var wanted={}
	for lamp_point in lamp_sources:
		var key=lamp_point.id;wanted[key]=true
		if not lamp_entries.has(key):lamp_entries[key]={"p":0.0}
		for field in ["x","y","seed","strength"]:lamp_entries[key][field]=lamp_point[field]
	for key in lamp_entries.keys():
		var entry=lamp_entries[key];entry.p=move_toward(float(entry.p),1.0 if wanted.has(key) else 0.0,delta/(0.18 if wanted.has(key) else 0.22))
		if entry.p<=0 and not wanted.has(key):lamp_entries.erase(key)
	var lamps=lamp_entries.values()
	lamps.sort_custom(func(a,b):return absf(a.x-camera_x)<absf(b.x-camera_x))
	for i in range(torch_lights.size()):
		var lamp=torch_lights[i];lamp.enabled=i<lamps.size() and get_meta("probe_local",true)
		if lamp.enabled:
			lamp.position=Vector2(sx(lamps[i].x),lamps[i].y);lamp.texture_scale=1.45*scale_factor;lamp.height=70*scale_factor;lamp.energy=float(lamps[i].strength)*smoothstep(0,1,lamps[i].p)*1.4*fire_field.flicker(elapsed,float(lamps[i].seed))
	if fast_lighting:
		var direction=moonlight if moon_visible else sunlight
		var vector=Vector3(sin(direction.rotation)*0.6,-cos(direction.rotation)*0.45,direction.height).normalized()
		var energy=direction.energy if direction.enabled else 0.0
		lit_material.set_shader_parameter("directional_vector",vector)
		lit_material.set_shader_parameter("directional_color",Vector3(direction.color.r,direction.color.g,direction.color.b)*energy)
		var points=PackedVector4Array()
		for lamp in torch_lights:
			if lamp.enabled:points.append(Vector4(lamp.position.x,lamp.position.y,128*lamp.texture_scale,lamp.energy))
		var count=points.size()
		while points.size()<8:points.append(Vector4.ZERO)
		lit_material.set_shader_parameter("torches",points);lit_material.set_shader_parameter("torch_count",count);lit_material.set_shader_parameter("torch_height",70*scale_factor)

# 呼吸与显隐分开：失效目标保留旧轮廓淡出，不把旧纹理瞬移给新目标。
func _update_glow(delta):
	var info={}
	if not focus_target.is_empty() and not focus_target.get("disabled",false) and focus_target.kind=="whip":
		var u=model.by_id(model.state.units,focus_target.object_id)
		if not u.is_empty():info=unit_visual(u)
	elif not focus_target.is_empty() and not focus_target.get("disabled",false):
		var b=model.by_id(model.state.buildings,focus_target.get("object_id",0))
		if not b.is_empty():info=building_visual(b)

	var active_key=str(focus_target.get("id","")) if not info.is_empty() else ""
	if active_key!="":
		if not glow_entries.has(active_key):
			var node=Sprite2D.new();var mat=ShaderMaterial.new();mat.shader=load("res://game/shaders/proximity_glow.gdshader");node.material=mat;add_child(node);glow_entries[active_key]={"node":node,"p":0.0}
		var entry=glow_entries[active_key];_configure_glow(entry.node,entry.node.material,info);glow_sprite=entry.node
		# 建筑光边处在首领后方，不能透过实体人物；单位光边在人物层。
		entry.node.z_index=20 if focus_target.kind=="whip" else 5
	for key in glow_entries.keys():
		var entry=glow_entries[key];entry.p=move_toward(float(entry.p),1.0 if key==active_key else 0.0,delta/(0.18 if key==active_key else 0.22))
		if key!=active_key:entry.node.position+=draw_drift
		entry.node.material.set_shader_parameter("glow_color",Color(0.98,0.87,0.40,smoothstep(0,1,entry.p)))
		if key!=active_key and entry.p<=0:entry.node.hide();entry.node.queue_free();glow_entries.erase(key)
	if active_key=="":glow_sprite=glow_fallback

func _configure_glow(node,mat,info):
	var action=info.get("action","");var seconds=float(info.get("seconds",elapsed));var phase=float(info.get("phase",float(info.x)*0.003))
	if action.is_empty():
		for candidate in ["wind","flame","idle"]:
			if art.animations.has_clip(info.key,candidate):action=candidate;break
	var pose=art.animations.pose(info.key,action,seconds,phase) if action!="" else {}
	if not pose.is_empty():
		var clip=pose.clip;var ratio=float(info.height)*scale_factor/float(clip.reference_height);var sign_value=-1.0 if info.face<0 else 1.0
		node.texture=art.animations.atlas_texture(pose);node.flip_h=info.face<0;node.scale=Vector2.ONE*ratio
		node.position=Vector2(sx(info.x)+sign_value*(float(clip.width)*0.5-float(clip.anchor_x))*ratio,info.foot+ground_offset(info.x)+(float(clip.height)*0.5-float(clip.anchor_y))*ratio)
		var source=pose.source;var sheet=pose.texture
		mat.set_shader_parameter("outline_width",3.0*float(clip.reference_height)/info.height)
		mat.set_shader_parameter("region",Vector4(source.position.x/sheet.get_width(),source.position.y/sheet.get_height(),source.size.x/sheet.get_width(),source.size.y/sheet.get_height()))
		mat.set_shader_parameter("source_pixel",Vector2(1.0/sheet.get_width(),1.0/sheet.get_height()));mat.set_shader_parameter("glow_time",elapsed)
		return
	var f=art.frames[info.key];var sheet=art.sheets[f.sheet]
	node.texture=art.texture(info.key);node.flip_h=info.face<0
	var h=info.height*scale_factor;var w=h*float(f.w)/float(f.h) if info.width<=0 else info.width*scale_factor
	node.scale=Vector2(w/float(f.w),h/float(f.h));node.position=Vector2(sx(info.x),info.foot+ground_offset(info.x)-h/2)
	mat.set_shader_parameter("outline_width",3.0*float(f.h)/info.height)
	mat.set_shader_parameter("region",Vector4(float(f.x)/sheet.get_width(),float(f.y)/sheet.get_height(),float(f.w)/sheet.get_width(),float(f.h)/sheet.get_height()))
	mat.set_shader_parameter("source_pixel",Vector2(1.0/sheet.get_width(),1.0/sheet.get_height()));mat.set_shader_parameter("glow_time",elapsed)


func clear_glows():
	for entry in glow_entries.values():entry.node.hide();entry.node.queue_free()
	glow_entries.clear()
	glow_sprite=glow_fallback

func _scope(key,depth=-1.0):
	art.scope(canvas,("reflection/" if reflecting else "world/")+str(key))
	if depth>=0:art.layer(canvas,110+depth/1000.0 if reflecting else depth)

func _process(delta):
	if model==null:return
	effect_elapsed+=minf(delta,0.1)
	art.animations.update(delta)
	if not model.paused():
		elapsed+=minf(delta,0.1)
		camera_x=lerpf(camera_x,render_x("hero",model.state.hero.x),1-exp(-delta*6))
	size=get_viewport_rect().size;scale_factor=size.y/480.0;ground=roundf(size.y*0.65)
	draw_drift=Vector2((last_camera_x-camera_x)*scale_factor,0);last_camera_x=camera_x
	interaction_visible=model.state.status=="playing" and model.pause_reasons.keys().all(func(key):return key=="qa")
	_celestial(delta);focus_target=model.find_target() if interaction_visible else {};_update_glow(delta)
	fire_field.sync(fire_sources,elapsed,delta,size,ground,scale_factor,draw_drift,model.global_data.settings.get("low_fx",false))
	water_node.position=Vector2(0,size.y*0.72);water_node.size=Vector2(size.x,size.y*0.28)
	water_material.set_shader_parameter("flow_time",elapsed);water_node.modulate=Color(0.29,0.43,0.65).lerp(Color(0.9,0.98,1.0),daylight)
	world_presence=move_toward(world_presence,1.0,delta/0.18);water_node.modulate.a=smoothstep(0,1,world_presence)
	_collect_effects();effects=effects.filter(func(e):return effect_elapsed-float(e.born)<float(e.duration))
	queue_redraw();surface.queue_redraw();actors_surface.queue_redraw();overlay.queue_redraw()

func sx(x):return (float(x)-camera_x)*scale_factor+size.x/2
func visible(x,margin=180):return abs(float(x)-camera_x)<size.x/scale_factor/2+margin
func actor_foot():return ground+1.5*scale_factor

# V8行走平面已在原地面纹理中统一校正，不再追随装饰草边上下弹跳。
# 仍保留同一脚线给建筑、树根、倒影与金币，避免各自使用不同的地面高度。
func ground_offset(x):
	var frame=art.frames.get("land",{});var profile=frame.get("ground_profile",[])
	if profile.is_empty():return 6.0*scale_factor
	var tile=int(floor(float(x)/960.0));var u=fposmod(float(x),960.0)
	if posmod(tile,2)==1:u=959-u
	var index=clampi(int(floor(u)),0,profile.size()-1)
	var y=lerpf(float(profile[index]),float(profile[mini(index+1,profile.size()-1)]),fposmod(u,1.0))
	return float(frame.layer_top)*size.y+(y+1.5)*scale_factor-ground

func _contact(key,x,width):
	if art.frames.has(key):art.at(canvas,key,sx(x),ground+ground_offset(x)+3*scale_factor,4*scale_factor,false,Color(0.12,0.15,0.10,0.21),width*scale_factor)

func _land_lip():
	var f=art.frames.land;var width=960*scale_factor;var shift=size.x/2-camera_x*scale_factor;var first=int(floor(-shift/width))
	for i in range(first,first+int(ceil(size.x/width))+1):
		var rect=Rect2(shift+i*width,float(f.layer_top)*size.y,width+0.5,21*scale_factor)
		if posmod(i,2)==1:rect.size.x=-rect.size.x
		art.transitions.submit(canvas,"land_lip",{"kind":"region","texture":art.sheet_for(canvas,f.sheet),"rect":rect,"source":Rect2(f.x,f.y,f.w,21),"tint":Color.WHITE})

func layer(name,parallax,tint=Color.WHITE,offset=0.0):
	var width=960.0*scale_factor
	var shift=-camera_x*scale_factor*parallax+offset
	if name=="land":shift+=size.x/2
	var first=int(floor(-shift/width))
	var count=int(ceil(size.x/width))+1
	var band={"far":Vector2(0.295,0.655),"middle":Vector2(0,0.655),"land":Vector2(0.625,0.775),"foreground":Vector2(0.845,1.0)}.get(name,Vector2(0,1))
	for i in range(first,first+count):
		# Alternate normal/mirrored source tiles: matching border pixels at every join.
		art.draw_band(canvas,name,Rect2(shift+i*width,0,width+0.5,size.y),band.x,band.y,tint,posmod(i,2)==1)

func sprite(name,x,foot,height,face=1,tint=Color.WHITE,width=0.0,action="",phase=0.0,seconds=-1.0,identity=""):
	if action.is_empty():
		for candidate in ["wind","flame","idle"]:
			if art.animations.has_clip(name,candidate):action=candidate;phase=float(x)*0.003;break
	if not action.is_empty() and art.animated_at(canvas,name,action,elapsed if seconds<0 else seconds,sx(x),foot+ground_offset(x),height*scale_factor,face<0,tint,phase,identity):return
	art.at(canvas,name,sx(x),foot+ground_offset(x),height*scale_factor,face<0,tint,width*scale_factor,identity)

func _draw():
	if model==null or art==null:return
	canvas=self;art.begin(canvas,draw_drift);_scope("sky",0)
	var sky=Color(0.11,0.18,0.34).lerp(Color(0.89,0.95,0.98),daylight)
	if not moon_visible and daylight<0.6:sky=sky.lerp(Color(0.93,0.67,0.46),daylight*0.65)
	art.draw(canvas,"sky_base",Rect2(Vector2.ZERO,size),sky)
	if night_amount>0.03:
		for i in range(40):
			_scope("star/"+str(i),1)
			var point=Vector2(fposmod(i*137.27+41,size.x),size.y*(0.07+fposmod(i*0.137,0.34)))
			_light_blob(point,2.2*scale_factor,Color(0.65,0.79,1.0,(0.28+0.15*sin(elapsed*0.8+i))*night_amount))
	_scope("celestial",2)
	if moon_visible:
		_scope("celestial/moon",2)
		_light_blob(moon_position,80*scale_factor,Color(0.63,0.76,1.0,0.10));art.at(canvas,"moon",moon_position.x,moon_position.y+28*scale_factor,56*scale_factor)
	else:
		_scope("celestial/sun",2)
		_light_blob(sun_position,94*scale_factor,Color(1.0,0.76,0.30,0.15));art.at(canvas,"sun",sun_position.x,sun_position.y+32*scale_factor,66*scale_factor)
	for i in range(6):
		_scope("cloud/"+str(i),3)
		var x=fposmod(i*size.x*0.27+elapsed*(1.2+i*0.13),size.x+180)-90
		art.at(canvas,"cloud",x,size.y*(0.18+0.08*(i%3)),(24+i%2*13)*scale_factor,false,Color(0.64,0.73,0.88,0.30).lerp(Color(1,0.96,0.86,0.7),daylight))
	var far_light=Color(0.28,0.42,0.66).lerp(Color(0.92,0.96,0.9),daylight)
	_scope("forest",4);layer("far",0.10,far_light);layer("middle",0.32,Color(0.25,0.38,0.56).lerp(Color.WHITE,daylight))
	if daylight>0.35:
		for i in range(3):
			_scope("bird/"+str(i),5)
			var x=fposmod(elapsed*(20+i*5)+i*size.x*0.38,size.x+100)-50
			art.at(canvas,"forest_bird",x,size.y*(0.19+i*0.045)+sin(elapsed+i)*5*scale_factor,(9+i%2*3)*scale_factor,i%2==0,Color(0.66,0.71,0.72,0.85))

	art.finish(canvas)

func _light_blob(point,radius,color):
	if glow_texture!=null:art.bitmap(canvas,"glow",glow_texture,Rect2(point-Vector2.ONE*radius,Vector2.ONE*radius*2),color)

func draw_surface(target_canvas,actors=false):
	if actors:
		canvas=target_canvas;art.begin(canvas,draw_drift);_draw_actors();return
	canvas=target_canvas;art.begin(canvas,draw_drift);visible_objects=0;_scope("land",0)
	layer("land",1.0)
	for item in decor:
		if not visible(item.x,250):continue
		_scope("decor_contact/"+str(item.x),9);_contact(item.key,item.x,item.h*0.5)
		_scope("decor/"+str(item.x),10)
		sprite(item.key,item.x,ground+(4 if item.key=="forest_shrub" else 0)*scale_factor,item.h,item.face);visible_objects+=1
	for x in [-3620,2850]:
		_scope("stream/"+str(x),12)
		if visible(x,210):sprite("stream_crossing",x,ground+82*scale_factor,160,1,Color.WHITE,295)
	for b in model.state.buildings:
		if model.unlocked(b) and b.level>0 and visible(b.x,230):
			var visual=building_visual(b);_scope("contact/"+str(b.id),19);_contact(visual.key,b.x,minf(230,visual.height*1.3))
		_scope("building/"+str(b.id),20)
		if model.unlocked(b) and visible(b.x,230):_building(b,Color.WHITE);visible_objects+=1
	_scope("ghost",25);_focused_ghost()
	_scope("ground_lip",28);_land_lip()
	_scope("treasury",30);_draw_treasury(Color.WHITE)
	for point in torch_points:
		_scope("torch/"+str(point.x),35);sprite("torch_unlit",point.x,ground,34,1,Color.WHITE)
	for x in [-model.territory_radius(),model.territory_radius()]:
		_scope("boundary/"+str(x),35)
		if visible(x):sprite("tribal_banner",x,ground,76)
	for d in model.state.drops:
		if not visible(d.x):continue
		_scope("drop/"+str(d.id),40)
		if d.kind=="gold":
			for i in range(mini(7,int(d.amount))):sprite("coin",d.x+(i%4-1.5)*6,ground+2-(i/4)*4*scale_factor,10,1,Color(1,0.94,0.7))
		else:sprite("flag",d.x,ground+2,25)
		visible_objects+=1
	art.finish(canvas)

func _draw_actors():
	_hero(Color.WHITE)
	for body in model.state.bodies:
		# 新尸体延续原单位的身体身份与脚点，倒地时不交叉叠出两个身体。
		_scope("unit/"+str(body.id) if body.has("id") else "body/"+str(body.x),70)
		if visible(body.x):_fallen_goblin(body,Color(0.72,0.76,0.78))
	for u in model.state.units:
		if visible(u.x):_unit(u,Color.WHITE);visible_objects+=1
	for e in model.state.enemies:
		if visible(e.x):_enemy(e,Color.WHITE);visible_objects+=1
	var trader=model.state.trader
	_scope("trader",85)
	if trader.phase!="away" and visible(trader.x):_prison_cart(trader.x+65,Color.WHITE);sprite("trader",trader.x,ground+3,42,-1 if trader.phase=="leaving" else 1,Color.WHITE,0,"trade" if trader.phase=="staying" else "walk")
	for shot in model.state.shots:
		_scope("shot/"+str(snappedf(model.state.total+shot.left,0.001))+"/"+str(shot.x)+"/"+str(shot.to),200)
		var x=lerpf(float(shot.x),float(shot.to),1-float(shot.left)/float(shot.total));var elevation=20+float(shot.get("lift",0))*float(shot.left)/float(shot.total)
		if shot.get("target_hero",false):elevation+=(hero_hover()+float(shot.get("target_fly",0)))*(1-float(shot.left)/float(shot.total))
		if visible(x):sprite("arrow",x,ground-elevation*scale_factor,5,1 if shot.to>shot.x else -1)
	if not model.global_data.settings.get("low_fx",false):_reflections(Color(0.35,0.48,0.68).lerp(Color.WHITE,daylight))
	_scope("foreground",120);layer("foreground",1.15,Color(0.35,0.49,0.69).lerp(Color.WHITE,daylight));art.finish(canvas)

func _draw_treasury(light):
	var amount=model.treasury_gold()
	if amount<=0:return
	var count=mini(100,amount);var rows=int(ceil(sqrt(float(count))));var base_columns=rows*2-1
	var width=minf(130,18+sqrt(float(amount))*4);var spacing=width/maxi(1,base_columns-1);var remaining=count;var row=0
	while remaining>0:
		var columns=mini(remaining,maxi(1,base_columns-row*2))
		for j in range(columns):
			var x=model.hall().x+94+(j-(columns-1)*0.5)*spacing
			var foot=ground+2*scale_factor-row*4.1*scale_factor
			sprite("coin",x,foot,9,1,light)
		remaining-=columns;row+=1

func fallen_visual(body):
	var rank=int(body.get("rank",1));var key=body.role+("_"+str(rank) if rank>1 and body.role!="idle" else "")
	if not art.animations.has_clip(key,"fall"):return {}
	var action="fall";var seconds=float(body.get("stun_age",0)) if body.get("stun",0)>0 else float(body.get("fallen_age",99))
	if body.get("stun",0)>0 and float(body.stun)<=model.RECOVERY_TIME and art.animations.has_clip(key,"getup"):
		action="getup";seconds=(1-float(body.stun)/model.RECOVERY_TIME)*float(art.animations.clips[key+"/getup"].duration)
	return {"key":key,"x":render_x(body.get("id",body.x),body.x),"foot":actor_foot()+float(int(body.get("id",0))%3)*0.35*scale_factor,"height":38.0,"face":body.face,"width":0.0,"action":action,"seconds":seconds,"phase":0.0}

func _fallen_goblin(body,light):
	var pose=fallen_visual(body)
	if not pose.is_empty():
		sprite(pose.key,pose.x,pose.foot,pose.height,pose.face,light,0,pose.action,0,pose.seconds);return
	var key=body.role+("_"+str(int(body.rank)) if int(body.rank)>1 and body.role!="idle" else "")
	var outer=art.transitions.current_transform(canvas)
	art.transitions.transform(canvas,outer*Transform2D(-PI/2,Vector2(sx(body.x),ground+ground_offset(body.x))))
	art.at(canvas,key,17*scale_factor,11*scale_factor,34*scale_factor,body.face<0,light)
	art.transitions.transform(canvas,outer)

func _reflections(light):
	# Reflection is a normal transform of the original AI bitmaps, with no generated effects.
	reflecting=true
	art.set_transform(canvas,Vector2(sin(elapsed*0.7)*1.3*scale_factor,size.y*0.77+ground*0.38+sin(elapsed)*0.6*scale_factor),0,Vector2(1,-0.38+sin(elapsed*0.8)*0.002))
	var tint=Color(light.r*0.8,light.g*0.9,light.b,0.17)
	for b in model.state.buildings:
		_scope("building/"+str(b.id),20)
		if visible(b.x):_building(b,tint)
	for body in model.state.bodies:
		_scope("unit/"+str(body.id) if body.has("id") else "body/"+str(body.x),70)
		if visible(body.x):_fallen_goblin(body,tint)
	for u in model.state.units:
		if visible(u.x):_unit(u,tint)
	for e in model.state.enemies:
		if visible(e.x):_enemy(e,tint)
	_hero(tint)
	var t=model.state.trader
	_scope("trader",85)
	if t.phase!="away" and visible(t.x):_prison_cart(t.x+65,tint);sprite("trader",t.x,ground+2,41,-1 if t.phase=="leaving" else 1,tint,0,"trade" if t.phase=="staying" else "walk")
	art.set_transform(canvas,Vector2.ZERO,0,Vector2.ONE);reflecting=false

func hero_hover():
	if model.state.hero.mount!="bat":return 0.0
	return float(art.animations.clips.get("rider_bat/walk",{}).get("hover_offset",0))

func hero_visual_foot():
	return actor_foot()-(float(model.state.hero.fly)+hero_hover())*scale_factor

func _hero(light):
	_scope("hero",50)
	var p=model.state.hero
	if not reflecting and not model.find_whip_target().is_empty():art.animations.warm("rider_"+p.mount,"whip")
	var tint=light
	if not reflecting and p.hurt>0:tint=light.lerp(Color(1.0,0.65,0.58,light.a),0.35)
	var action="idle"
	if abs(float(p.get("velocity",0)))>6:action="run" if model.input_run and not p.get("exhausted",false) else "walk"
	if p.mount=="bat":
		# A fixed low hover clears the original wings. The large flight stroke
		# starts only once it has enough room, without changing damage rules.
		action="run" if float(p.fly)>16 else ("walk" if absf(float(p.get("velocity",0)))>6 or float(p.fly)>1 else "idle")
	var pose_time=-1.0
	if float(p.get("whip_pose",0))>0 and absf(float(p.get("velocity",0)))<=6 and art.animations.has_clip("rider_"+p.mount,"whip"):
		action="whip";pose_time=model.WHIP_POSE_TIME-float(p.whip_pose)
	sprite("rider_"+p.mount,render_x("hero",p.x),hero_visual_foot(),66,p.face,tint,0,action,0,pose_time)

func _bar(x,y,progress,tint=Color.WHITE):
	y+=ground_offset((x-size.x/2)/scale_factor+camera_x)
	art.draw(canvas,"ui_bar",Rect2(x-20,y,40,6),tint)
	if progress>0:art.draw(canvas,"ui_bar_fill",Rect2(x-18,y+2,36*clampf(progress,0,1),2),tint)

func building_height(b,level=-1):
	var rank=int(b.level) if level<0 else level
	match b.kind:
		"hall":return 145.0+10*maxi(0,rank-1)
		"tools":return 109.0
		"merchant_gold","merchant_army","merchant_mount":return 108.0
		"den":return 133.0
		"prison":return 98.0+8*maxi(0,rank-1)
		"wall":return 58.0+14*maxi(0,rank-1)
		"tower":return 112.0+12*maxi(0,rank-1)
		"net":return 80.0+8*maxi(0,rank-1)
		"rock":return 76.0+8*maxi(0,rank-1)
		"farm","woodcut","mine":return 105.0
		"camp":return 67.0
		"wreck":return 77.0
		"outpost":return 152.0
		# 旗面高于骑乘首领，靠近时仍能看见布面和目标光边。
		"rally":return 92.0
	return 45.0

func building_visual(b):
	var h=building_height(b);var key="";var width=0.0
	if b.kind=="prison":width=230.0+30*maxi(0,int(b.level)-1)
	if b.kind=="hall" and b.hp<=0:h=65
	if b.level==0:
		if not _site_ghost_active(b):key="build_site_sign";h=48
		else:
			key={"wall":"wall1","tower":"tower","net":"net_trap","rock":"rock_trap","prison":"prison_back1","den":"thieves_den","farm":"mushroom_farm","woodcut":"woodcut_camp","mine":"gold_mine"}.get(b.kind,"")
	else:
		match b.kind:
			"hall":key="hall_ruin" if b.hp<=0 else "hall"+str(b.level)
			"tools":key="empty_tool_"+b.role
			"merchant_gold","merchant_army","merchant_mount":key=b.kind.replace("merchant_","market_")
			"den":key="thieves_den"
			"prison":key="prison_back"+("" if b.level==2 else str(b.level));width=230+(b.level-1)*30
			"wall":key="wall"+str(b.level)
			"tower","net","rock":key={"tower":"tower","net":"net_trap","rock":"rock_trap"}[b.kind]+("2" if b.level>=2 else "")
			"farm":key="mushroom_farm"
			"woodcut":key="woodcut_camp"
			"mine":key="gold_mine"
			"wreck":key="battlefield_wreck"
			"camp":key="hall1"
			"chest":key="chest";h=22
			"rally":key="tribal_banner"
			"outpost":key="outpost"
	return {"key":key,"x":b.x,"foot":ground,"height":h,"face":1,"width":width}

func _site_ghost_active(b):
	var target=focus_target
	return target.get("object_id",0)==b.id and not target.get("disabled",false) and target.get("cost",0)>0 and target.get("shop","")==""

func _building(b,light):
	if not model.unlocked(b):return
	var x=b.x
	var height=building_height(b)
	if b.level==0 and b.kind in ["wall","tower","net","rock","prison","den","farm","woodcut","mine"]:
		if b.job.is_empty() and not _site_ghost_active(b):sprite("build_site_sign",x,ground,48,1,light)
		if not reflecting and not b.job.is_empty():
			_ghost_building(b,1,Color(light.r,light.g,light.b,0.5))
			_bar(sx(x),ground-(building_height(b,1)+14)*scale_factor,1-float(b.job.left)/float(b.job.total))
		return
	match b.kind:
		"hall":sprite("hall_ruin" if b.hp<=0 else "hall"+str(b.level),x,ground,65 if b.hp<=0 else height,1,light)
		"tools","merchant_gold","merchant_army","merchant_mount":
			var role=b.get("role","idle")
			if b.kind!="tools":sprite("idle",x-12,ground-20*scale_factor,38,1,light)
			var key="empty_tool_"+role if b.kind=="tools" else b.kind.replace("merchant_","market_")
			sprite(key,x,ground,height,1,light)
			if b.kind=="tools":
				for i in range(mini(8,int(model.state.tool_stock[role]))):sprite({"worker":"hammer","hunter":"bow","brute":"club","thief":"hood"}[role],x-29+(i%5)*14,ground-3*scale_factor-(i/5)*17*scale_factor,24,1,light)
			if b.kind=="merchant_mount":
				for i in range(4):sprite(["boar","lizard","wolf","bat"][i],x-145+i*105,ground+3,31,1,light)
			if b.kind=="merchant_army":
				for i in range(2):sprite("hammer" if i==0 else "bow",x-58+i*116,ground-26*scale_factor,22,1,light)
		"den":
			sprite("thieves_den",x,ground,height,1,light)
			for i in range(4):sprite(["arrows","wheel","coin","key"][i],x-114+i*76,ground-42*scale_factor,18,1,light)
		"prison":
			if b.level>0:
				var width=230.0+float(b.level-1)*30
				var suffix="" if b.level==2 else str(b.level)
				sprite("prison_back"+suffix,x,ground,height,1,light,width)
				var count=model.state.captives.size()
				for i in range(count):
					var c=model.state.captives[i];_scope("building/"+str(b.id)+"/captive/"+str(c.id),20.1)
					var cx=x-width*0.37+float(i+0.5)*width*0.74/maxi(1,count)
					# Feet, heads and limbs are kept inside the closed front-frame bounds.
					sprite("captive_"+c.type,cx,ground-7*scale_factor,35,1,light)
				_scope("building/"+str(b.id)+"/front",20.2)
				sprite("prison_front"+suffix,x,ground,height,1,light,width)
		"wall":
			sprite("wall"+str(b.level),x,ground,height,1,light)
		"tower","net","rock":
			sprite({"tower":"tower","net":"net_trap","rock":"rock_trap"}[b.kind]+("2" if b.level>=2 else ""),x,ground,height,1,light)
		"farm","woodcut","mine":
			sprite({"farm":"mushroom_farm","woodcut":"woodcut_camp","mine":"gold_mine"}[b.kind],x,ground,height,1,light)
		"camp":
			sprite("hall1",x,ground,height,1,light)
			for i in range(int(b.stock)):sprite("idle",x-24+i*22,ground+2,27,1,light)
		"wreck":
			if b.level>0:sprite("battlefield_wreck",x,ground,height,1,light)
		"chest":
			if b.level>0:sprite("chest",x,ground,18,1,light)
		"outpost":
			if b.hp>0:sprite("outpost",x,ground,height,-b.side,light)
		"rally":sprite("tribal_banner",x,ground,height,1,light)
		"supply":
			if b.task=="wheel":_cart(x,ground,light,b.ready_day<=model.state.day)
			elif b.task=="keys":
				sprite("prison_back",x,ground,43,1,light,79)
				if b.ready_day<=model.state.day:sprite("idle",x,ground-4*scale_factor,25,1,light)
				sprite("prison_front",x,ground,43,1,light,79)
			elif b.ready_day<=model.state.day:sprite("arrows" if b.task=="arrows" else "chest",x,ground,25,1,light)
		"trader_stop":return
	if reflecting:return
	if not b.job.is_empty():
		if b.job.mode=="upgrade":_ghost_building(b,int(b.level)+1,Color(light.r,light.g,light.b,0.38))
		var progress=1-float(b.job.left)/float(b.job.total)
		_bar(sx(x),ground-height*scale_factor-12,progress)
	elif b.has("hp") and b.hp<b.max_hp and b.level>0:
		_bar(sx(x),ground-(height+14)*scale_factor,b.hp/b.max_hp,Color(1,0.7,0.6))

func _cart(x,foot,light,wheels):
	sprite("wagon",x,foot+(-7 if wheels else 1)*scale_factor,35,1,light)
	if wheels:
		for dx in [-22,23]:sprite("wheel",x+dx,foot+1,19,1,light)

func _prison_cart(x,light):
	_cart(x,ground+3,light,true)
	var foot=ground-27*scale_factor
	sprite("prison_back1",x,foot,39,1,light,81)
	var cargo=model.state.trader.get("cargo",[])
	for i in range(mini(3,cargo.size())):
		sprite("captive_"+cargo[i],x-24+i*24,foot-5*scale_factor,25,1,light)
	sprite("prison_front1",x,foot,39,1,light,81)

# 角色和目标光边共享同一动作、脚点和时钟，避免高亮仍沿用站立轮廓。
func unit_visual(u):
	if u.get("stun",0)>0:
		var fallen=fallen_visual(u)
		if not fallen.is_empty():return fallen
	var y=actor_foot()+float(u.id%3)*0.35*scale_factor
	if u.get("on_tower",0)>0:
		var tower=model.by_id(model.state.buildings,u.on_tower)
		if not tower.is_empty():y-=model.tower_stand_height(tower.level)*scale_factor
	var action="walk" if u.moving else "idle";var seconds=elapsed;var phase=float(u.id)*0.137
	if not u.moving:
		if u.role=="worker" and u.mode in ["building","harvesting"]:action="work"
		elif u.role=="hunter" and u.cooldown>0.001:action="shoot"
		elif u.role=="brute" and u.cooldown>0.001:action="attack"
		elif u.role=="thief" and u.mission.get("stage","")=="work":action="work"
	var key=u.role+("_"+str(int(u.get("rank",1))) if int(u.get("rank",1))>1 and u.role!="idle" else "")
	if float(u.get("hit_pose",0))>0 and art.animations.has_clip(key,"hit"):
		action="hit";seconds=(1-float(u.hit_pose)/model.REACTION_TIME)*float(art.animations.clips[key+"/hit"].duration);phase=0.0
	if action in ["shoot","attack"] and art.animations.has_clip(key,action):
		var period=1.15 if action=="shoot" else 0.95
		seconds=clampf(1.0-float(u.cooldown)/period,0,0.99999)*float(art.animations.clips[key+"/"+action].duration);phase=0.0
	var visual_face=u.get("attack_face",u.face) if action=="shoot" else u.face
	return {"key":key,"x":render_x(u.id,u.x),"foot":y,"height":38.0,"face":visual_face,"width":0.0,"action":action,"seconds":seconds,"phase":phase}

func _unit(u,light):
	_scope("unit/"+str(u.id),70)
	# 仅在可能受鞭打或接战的附近单位预取反应，不一次载入全世界的状态图集。
	if not reflecting and (absf(u.x-model.state.hero.x)<240 or not model._safe(u.x,180)):
		var reaction_key=u.role+("_"+str(int(u.get("rank",1))) if int(u.get("rank",1))>1 and u.role!="idle" else "")
		for reaction in ["hit","fall","getup"]:art.animations.warm(reaction_key,reaction)
	if not reflecting and u.role in ["hunter","brute"]:
		var warm_key=u.role+("_"+str(int(u.get("rank",1))) if int(u.get("rank",1))>1 else "")
		art.animations.warm(warm_key,"shoot" if u.role=="hunter" else "attack")
	if u.get("stun",0)>0:
		if u.cargo.get("kind","")=="captive":
			sprite("captive_"+u.cargo.type,u.x-u.face*30,ground+3,21,1,light);sprite("net",u.x-u.face*30,ground+4,27,1,light)
		elif u.cargo.get("kind","")=="flag":sprite("flag",u.x-u.face*20,ground+3,23,1,light)
		_fallen_goblin(u,light)
		return
	var visual=unit_visual(u);var unit_x=visual.x;var y=visual.foot
	if not u.cargo.is_empty() and u.cargo.kind=="captive":
		var behind=unit_x-u.face*43
		# One hauler leads the net, connected by the separately generated rope bitmap.
		var hand=unit_x-u.face*9
		var attachment=behind+u.face*8
		art.draw(canvas,"rope",Rect2(minf(sx(hand),sx(attachment)),y+ground_offset(unit_x)-10*scale_factor,abs(sx(hand)-sx(attachment)),2*scale_factor),light,u.face<0)
		sprite("captive_"+u.cargo.type,behind,y,21,1,light)
		sprite("net",behind,y+1,26,1,light)
	sprite(visual.key,unit_x,y,38,visual.face,light,0,visual.action,visual.phase,visual.seconds)
	if u.carry>0:
		for i in range(mini(3,int(u.carry))):sprite("coin",unit_x-4+i*4,y-40*scale_factor,6,1,light)
	if u.hidden>0:
		sprite("pocket",unit_x-9*u.face,y-7*scale_factor,10+mini(4,u.hidden),u.face,light)
		if u.hidden>3:sprite("pocket",unit_x+9*u.face,y-8*scale_factor,12,u.face,light)
	if not u.cargo.is_empty() and u.cargo.kind!="captive":sprite("flag" if u.cargo.kind=="flag" else "coin",unit_x-10*u.face,y-12*scale_factor,21,u.face,light)
	if not u.mission.is_empty() and u.mission.stage=="return":
		if u.mission.kind=="wheel":sprite("wheel",unit_x+u.face*18,ground+3,24,u.face,light)
		elif u.mission.kind=="keys":
			for i in range(2):sprite("idle",unit_x-u.face*(29+22*i),ground+3,26,u.face,light)
			sprite("key",unit_x+u.face*10,y-11*scale_factor,10,u.face,light)
		else:sprite("arrows" if u.mission.kind=="arrows" else "chest",unit_x-14*u.face,y-12*scale_factor,20,u.face,light)

func _enemy(e,light):
	_scope("enemy/"+str(e.id),80)
	var x=render_x(e.id,e.x)
	if e.mode in ["downed","dead"]:
		var alive=e.mode=="downed"
		var has_struggle=alive and art.animations.has_clip(e.type+"_wounded","struggle")
		var wiggle=sin(elapsed*2.2+e.id)*0.65*scale_factor if alive and not has_struggle else 0.0
		if e.type=="siege":sprite("battlefield_wreck",x,ground,42,e.side,light)
		else:sprite(e.type+("_wounded" if alive else "_dead"),x,ground+2+wiggle,21 if e.type!="dwarf" else 19,e.side,light,0,"struggle" if has_struggle else "",float(e.id)*0.137)
		if alive and e.get("trapped",false):sprite("net",x,ground+4,29,e.side,light)
	elif e.type=="siege":_cart(x,ground,light,true);sprite("dwarf",x+38*e.side,ground,33,e.side,light)
	else:
		# 联军原画面向左，转换实际世界朝向后使用同一完整身体翻转。
		var last_arrow=e.get("attack_kind","")=="shoot" and float(e.get("attack_pose",0))>0.74
		var asset="elf_melee" if e.type=="elf" and e.ammo<=0 and not last_arrow else e.type
		var face=-int(e.get("face",-int(e.side)))
		var action="walk" if e.get("moving",false) else "idle";var seconds=elapsed;var phase=float(e.id)*0.137
		var attack=e.get("attack_kind","attack")
		if not reflecting:art.animations.warm(asset,"shoot" if asset=="elf" else "attack")
		if not e.get("moving",false) and float(e.get("attack_pose",0))>0 and art.animations.has_clip(asset,attack):
			action=attack;seconds=clampf(1.0-float(e.attack_pose)/1.1,0,0.99999)*float(art.animations.clips[asset+"/"+attack].duration);phase=0;face=-int(e.get("attack_face",e.face))
		sprite(asset,x,ground+2,37 if e.type!="dwarf" else 31,face,light,0,action,phase,seconds,"enemy-body")

func slot_position(x,cost,index):
	var columns=mini(10,cost);var row=int(index/columns);var in_row=mini(columns,cost-row*columns)
	var height=94.0
	var b=model.by_id(model.state.buildings,focus_target.get("object_id",0))
	if not b.is_empty():height=building_height(b,mini(int(b.level)+1,int(model.upgrade_info(b).get("max",b.level+1))))
	var rows=int(ceil(float(cost)/columns))
	var top=maxf(88*scale_factor,ground+ground_offset(x)-(height+24+(rows-1)*20)*scale_factor)
	return Vector2(sx(x)+(float(index%columns)-(in_row-1)*0.5)*19*scale_factor,top+row*20*scale_factor)

func _interaction_preview():
	slot_count=0;var target=focus_target
	if target.is_empty() or target.get("disabled",false):return
	var cost=int(target.get("cost",0))
	if cost<=0:return
	_scope("slots/"+str(target.id)+"/"+str(cost),50)
	var paid=int(model.state.get("payment",{}).get("paid",0));slot_count=cost
	for i in range(cost):
		var pos=slot_position(target.x,cost,i)
		art.at(canvas,"coin",pos.x,pos.y+7*scale_factor,13*scale_factor,false,Color(0.9,0.85,0.62,0.44) if i>=paid else Color(1.0,0.95,0.72))

func _focused_ghost():
	ghost_key=""
	var target=focus_target
	_scope("ghost/"+str(target.get("id","")),25)
	if target.is_empty() or target.get("disabled",false) or target.get("cost",0)<=0 or target.get("shop","")!="":return
	var b=model.by_id(model.state.buildings,target.get("object_id",0))
	if not b.is_empty() and b.kind in ["hall","wall","tower","prison","den","net","rock","farm","woodcut","mine"]:
		if target.get("mode","")=="build":ghost_key=_ghost_building(b,int(b.level)+1,Color(0.96,0.98,0.80,0.48+0.035*sin(elapsed*2.6)))

func _ghost_building(b,next,tint):
	var key="";var h=building_height(b,next)
	if b.kind=="hall":key="hall"+str(mini(3,next))
	elif b.kind=="wall":key="wall"+str(mini(3,next))
	elif b.kind=="tower":key="tower"+("2" if next>=2 else "")
	elif b.kind=="prison":key="prison_back"+("" if next==2 else str(mini(3,next)))
	elif b.kind=="den":key="thieves_den"
	elif b.kind in ["net","rock"]:key=("net_trap" if b.kind=="net" else "rock_trap")+("2" if next>=2 else "")
	if b.kind in ["farm","woodcut","mine"]:key={"farm":"mushroom_farm","woodcut":"woodcut_camp","mine":"gold_mine"}[b.kind]
	if key!="":
		var width=230.0+float(next-1)*30 if b.kind=="prison" else 0.0
		sprite(key,b.x,ground,h,1,tint,width)
		if b.kind=="prison":sprite(key.replace("back","front"),b.x,ground,h,1,tint,width)
	return key

func _push_effect(e):
	if e.kind=="coin":
		e.y+=ground_offset(e.x)/scale_factor
		if not e.get("absolute_target",false):e.to_y+=ground_offset(e.to)/scale_factor
	e.born=effect_elapsed;effect_id+=1;e.visual_id=effect_id;effects.append(e)
	if effects.size()>128:effects.pop_front()

func _collect_effects():
	if model.visual_events.is_empty() or int(model.visual_events[-1].serial)<=last_visual:return
	for e in model.visual_events:
		if int(e.serial)<=last_visual:continue
		last_visual=int(e.serial)
		if not visible(e.get("x",model.state.hero.x)):continue
		var rng=RandomNumberGenerator.new();rng.seed=int(e.serial)*7919+17
		match e.kind:
			"coin_pay":
				var slot=slot_position(e.to,e.cost,e.index)
				_push_effect({"kind":"coin","x":float(e.x),"y":-27.0,"to":float(e.to)+(slot.x-sx(e.to))/scale_factor,"to_y":(slot.y-ground)/scale_factor+7,"duration":0.32,"arc":28.0,"absolute_target":true})
			"coin_return":
				for i in range(mini(12,int(e.count))):
					_push_effect({"kind":"coin","x":float(e.x)+(i-6)*5,"y":-74.0,"to":float(e.to),"to_y":-25.0,"duration":0.42+i*0.012,"arc":24.0})
			"coin_take","bank_deposit":
				for i in range(mini(8,int(e.get("count",1)))):_push_effect({"kind":"coin","x":float(e.x),"y":-10.0,"to":float(e.to),"to_y":-24.0,"duration":0.4+i*0.02,"arc":25.0})
			"pickup":
				_push_effect({"kind":"coin","x":float(e.x),"y":-7.0,"to":float(model.state.hero.x),"to_y":-29.0-hero_hover()-float(model.state.hero.fly),"duration":0.28,"arc":16.0})
			"whip":
				_push_effect({"kind":"whip","x":float(e.from),"to":float(e.x),"duration":0.24,"face":int(e.face)})
			"hit","funded","recruit","build_complete":
				var amount=5 if e.kind=="hit" else 8
				for i in range(amount):
					_push_effect({"kind":"dash","x":float(e.x),"y":-19.0 if e.kind=="hit" else -7.0,"vx":rng.randf_range(-35,35),"vy":rng.randf_range(-55,-18),"duration":rng.randf_range(0.25,0.48),"tone":Color("d8b879") if e.kind=="funded" else Color("b8b493"),"length":rng.randf_range(2,5)})

func _draw_effects():
	var stroke_batches={}
	for e in effects:
		_scope("effect/"+str(e.visual_id),200)
		var age=effect_elapsed-float(e.born);var t=clampf(age/float(e.duration),0,1)
		if e.kind=="coin":
			var eased=1-pow(1-t,2)
			var x=lerpf(e.x,e.to,eased);var y=lerpf(e.y,e.to_y,eased)-sin(t*PI)*float(e.arc)
			art.at(canvas,"coin",sx(x),ground+y*scale_factor,12*scale_factor,false,Color(1,1,1,1-t*0.15))
		elif e.kind=="dash":
			var p=Vector2(sx(e.x+e.vx*age),ground+(e.y+e.vy*age+50*age*age)*scale_factor)
			var bucket=mini(3,int(t*4))+(4 if e.tone==Color("d8b879") else 0)
			if not stroke_batches.has(bucket):
				var tone=e.tone;tone.a=(1.0-float(bucket%4)*0.25-0.125)*0.8
				stroke_batches[bucket]={"points":PackedVector2Array(),"tone":tone}
			var points=stroke_batches[bucket].points;points.append(p);points.append(p+Vector2(e.length*scale_factor,-scale_factor));stroke_batches[bucket].points=points
		elif e.kind=="whip":
			var points=PackedVector2Array()
			for i in range(13):
				var f=i/12.0;points.append(Vector2(lerpf(sx(e.x),sx(e.to),f),ground+(-25-sin(f*PI)*18*sin(t*PI))*scale_factor))
			art.lines(canvas,"whip",points,Color(0.58,0.39,0.20,1-t),1.6*scale_factor)
	# At most eight painted-stroke batches instead of a draw command per particle.
	for key in stroke_batches:
		_scope("stroke/"+str(key),200);var batch=stroke_batches[key];art.lines(canvas,"stroke",batch.points,batch.tone,2*scale_factor,true)


func draw_overlay(target_canvas):
	canvas=target_canvas;art.begin(canvas,draw_drift);_scope("whip_hint",5)
	var whip_target=model.find_whip_target() if interaction_visible else {}
	if not whip_target.is_empty() and focus_target.get("mode","")!="whip":_light_blob(Vector2(sx(whip_target.x),ground+ground_offset(whip_target.x)-5*scale_factor),17*scale_factor,Color(0.6,0.86,0.7,0.10+0.06*sin(elapsed*3)))
	for d in model.state.drops:
		_scope("coin_glow/"+str(d.id),6)
		if d.kind=="gold" and visible(d.x):_light_blob(Vector2(sx(d.x),ground+ground_offset(d.x)-3*scale_factor),22*scale_factor,Color(1.0,0.72,0.18,0.15+0.07*sin(elapsed*3+d.id)))
	for u in model.state.units:
		_scope("stun/"+str(u.id),7)
		if u.get("stun",0)>0 and visible(u.x):
			for i in range(3):_light_blob(Vector2(sx(u.x)+cos(elapsed*2+i*TAU/3)*15*scale_factor,ground-17*scale_factor+sin(elapsed*2+i*TAU/3)*4*scale_factor),3*scale_factor,Color(1.0,0.88,0.46,0.85))
	var amount=model.treasury_gold()
	_scope("treasury_number",16)
	if amount>0 and visible(model.hall().x):_number(str(amount),Vector2(sx(model.hall().x+96),ground+ground_offset(model.hall().x+96)-45*scale_factor),15,Color(1,0.89,0.55))
	if night_amount>0.1:
		for i in range(32):
			var anchor=floor(camera_x/1200.0)*1200+(i*173)%2400-1000
			if not visible(anchor):continue
			_scope("firefly/"+str(anchor),25)
			var pos=Vector2(sx(anchor)+sin(elapsed*0.7+i)*22*scale_factor,ground-(14+posmod(i*37,85))*scale_factor+sin(elapsed*0.9+i)*13*scale_factor)
			_light_blob(pos,5*scale_factor,Color(0.66,1.0,0.39,night_amount*(0.25+0.2*sin(elapsed*2+i))))
		for point in torch_points:
			_scope("torch_glow/"+str(point.x),26);_light_blob(Vector2(sx(point.x),point.y),33*scale_factor,Color(1.0,0.57,0.2,night_amount*0.17))
	else:
		for i in range(5):
			_scope("butterfly/"+str(i),25)
			var x=camera_x-350+i*160+sin(elapsed*0.31+i)*85
			sprite("butterfly",x,ground-(35+sin(elapsed+i)*12+i%2*18)*scale_factor,8,1,Color(1,1,1,0.75))
	if model.state.time<25:
		_scope("mist",27)
		for i in range(3):art.bitmap(canvas,"mist",glow_texture,Rect2(fposmod(elapsed*6+i*size.x*0.4,size.x+300)-150,ground-36*scale_factor,420*scale_factor,50*scale_factor),Color(0.78,0.85,0.82,(1-model.state.time/25.0)*0.09))
	_interaction_preview();_draw_effects();art.finish(canvas)

func _number(value,position,height=15,color=Color.WHITE):
	if font==null:return
	var pixels=maxi(9,int(height*scale_factor));var width=font.get_string_size(value,HORIZONTAL_ALIGNMENT_LEFT,-1,pixels).x
	art.text(canvas,font,value,position-Vector2(width/2,0),pixels,color)

