class_name MonarchArt
extends RefCounted

var frames = {}
var sheets = {}
var decoded_bytes = 0
var texture_cache={}
var lit_sheets={}
var actor_sheets={}
var flat_sheets={}
var actor_marker
var plain_marker
var animations=preload("res://game/scripts/animation_bank.gd").new()
var transitions=preload("res://game/scripts/visual_transitions.gd").new()

func begin(canvas,drift=Vector2.ZERO):transitions.begin(canvas,drift)
func finish(canvas):transitions.finish(canvas)
func scope(canvas,key):transitions.scope(canvas,key)
func layer(canvas,value):transitions.layer(canvas,value)
func set_transform(canvas,position,rotation=0.0,scale_value=Vector2.ONE):transitions.transform(canvas,Transform2D(rotation,scale_value,0,position))
func bitmap(canvas,key,texture,rect,tint):transitions.submit(canvas,key,{"kind":"texture","texture":texture,"rect":rect,"tint":tint})
func text(canvas,font,value,position,height,tint):transitions.submit(canvas,"text/"+value,{"kind":"text","font":font,"text":value,"position":position,"height":height,"tint":tint})
func rectangle(canvas,key,rect,tint):transitions.submit(canvas,key,{"kind":"rect","rect":rect,"tint":tint})
func lines(canvas,key,points,tint,width,multi=false):transitions.submit(canvas,key,{"kind":"multiline" if multi else "polyline","points":points,"tint":tint,"width":width})

func _init():
	# 单像素分类数据，不是美术素材。明确绑定纹理，避免默认高光值误判前景。
	var mask=Image.create(1,1,false,Image.FORMAT_RGBA8);mask.fill(Color.BLACK);plain_marker=ImageTexture.create_from_image(mask)
	mask=Image.create(1,1,false,Image.FORMAT_RGBA8);mask.fill(Color.WHITE);actor_marker=ImageTexture.create_from_image(mask)
	animations.actor_marker=actor_marker;animations.plain_marker=plain_marker
	var path="res://game/art/runtime/manifest.json"
	if not FileAccess.file_exists(path):return
	var data=JSON.parse_string(FileAccess.get_file_as_string(path))
	if not data is Dictionary:return
	frames=data.get("frames",{})
	for name in data.get("sheets",{}):
		var t=load("res://game/art/runtime/"+name)
		if t is Texture2D:
			sheets[name]=t
			var flat=CanvasTexture.new();flat.diffuse_texture=t;flat.specular_texture=plain_marker;flat.specular_color=Color.WHITE;flat_sheets[name]=flat
			decoded_bytes+=t.get_width()*t.get_height()*4
	for name in data.get("normals",{}):
		if not sheets.has(name):continue
		var normal=load("res://game/art/runtime/"+data.normals[name])
		if normal is Texture2D:
			var paired=CanvasTexture.new();paired.diffuse_texture=sheets[name];paired.normal_texture=normal;paired.specular_texture=plain_marker;paired.specular_color=Color.WHITE;lit_sheets[name]=paired
			decoded_bytes+=normal.get_width()*normal.get_height()*4
			var ink=CanvasTexture.new();ink.diffuse_texture=sheets[name];ink.normal_texture=normal;ink.specular_texture=actor_marker;ink.specular_color=Color.WHITE;actor_sheets[name]=ink

func sheet_for(canvas,name,actor=false):
	if canvas.get_meta("use_normals",false) and lit_sheets.has(name):return actor_sheets[name] if actor else lit_sheets[name]
	if canvas.get_meta("use_normals",false):return flat_sheets[name]
	return sheets[name]

func has_asset(name):return frames.has(name)

func texture(name):
	if texture_cache.has(name):return texture_cache[name]
	if not frames.has(name):return null
	var f=frames[name]
	var t=AtlasTexture.new();t.atlas=sheets[f.sheet];t.region=Rect2(f.x,f.y,f.w,f.h)
	texture_cache[name]=t
	return t

func draw(canvas,name,rect,tint=Color.WHITE,flip=false,identity="",actor_anchor=Vector2.ZERO):
	if not frames.has(name):return
	var f=frames[name]
	if not sheets.has(f.sheet):return
	var dest=rect
	var source=Rect2(f.x,f.y,f.w,f.h);var actor=f.get("outline",false) and canvas.get_meta("use_normals",false)
	if actor:
		var pad=float(f.padding);var extra=Vector2(rect.size.x/f.w,rect.size.y/f.h)*pad
		dest.position-=extra;dest.size+=extra*2;source=source.grow(pad)
	# Godot keeps the rect origin when a negative width requests a flip.
	if flip:dest.size.x=-dest.size.x
	var command={"kind":"region","texture":sheet_for(canvas,f.sheet,actor),"rect":dest,"source":source,"tint":tint}
	if not identity.is_empty():command.exclusive_variant=name;command.actor_anchor=actor_anchor
	transitions.submit(canvas,name if identity.is_empty() else identity,command)

func at(canvas,name,x,foot,height,flip=false,tint=Color.WHITE,width_override=0.0,identity=""):
	if not frames.has(name):return
	var f=frames[name]
	var width=height*float(f.w)/maxf(1,float(f.h)) if width_override<=0 else width_override
	var pivot=float(f.get("pivot_x",0.5))
	var left=x-width*((1.0-pivot) if flip else pivot)
	draw(canvas,name,Rect2(left,foot-height,width,height),tint,flip,identity,Vector2(x,foot))

# 连续姿势保持同一人物身份，防止站立/射箭之间叠出第二个身体或一支旧箭。
# 人物新增、死亡与等级贴图更换仍由外层稳定ID执行全局显隐过渡。
func animated_at(canvas,name,action,seconds,x,foot,height,flip=false,tint=Color.WHITE,phase=0.0,identity=""):
	var pose=animations.pose(name,action,seconds,phase)
	if pose.is_empty():return false
	var clip=pose.clip;var ratio=height/float(clip.reference_height)
	var anchor=float(clip.width)-float(clip.anchor_x) if flip else float(clip.anchor_x)
	var dest=Rect2(x-anchor*ratio,foot-float(clip.anchor_y)*ratio,float(clip.width)*ratio,float(clip.height)*ratio)
	if flip:dest.size.x=-dest.size.x
	var actor=frames.get(name,{}).get("outline",false)
	var texture=animations.lit_texture(clip,actor) if canvas.get_meta("use_normals",false) else pose.texture
	var command={"kind":"region","texture":texture,"rect":dest,"source":pose.source,"tint":tint,"animation":pose.id}
	if not identity.is_empty():command.exclusive_variant=name;command.actor_anchor=Vector2(x,foot)
	transitions.submit(canvas,name if identity.is_empty() else identity,command)
	return true

func draw_band(canvas,name,rect,top,bottom,tint=Color.WHITE,flip=false):
	if not frames.has(name):return
	var f=frames[name]
	if not sheets.has(f.sheet):return
	if f.has("layer_top"):
		var trimmed=Rect2(rect.position+Vector2(0,rect.size.y*float(f.layer_top)),Vector2(rect.size.x,rect.size.y*float(f.layer_span)))
		if flip:trimmed.size.x=-trimmed.size.x
		transitions.submit(canvas,name,{"kind":"region","texture":sheet_for(canvas,f.sheet),"rect":trimmed,"source":Rect2(f.x,f.y,f.w,f.h),"tint":tint})
		return
	var dest=Rect2(rect.position+Vector2(0,rect.size.y*top),Vector2(rect.size.x,rect.size.y*(bottom-top)))
	if flip:dest.size.x=-dest.size.x
	transitions.submit(canvas,name,{"kind":"region","texture":sheet_for(canvas,f.sheet),"rect":dest,"source":Rect2(f.x,f.y+f.h*top,f.w,f.h*(bottom-top)),"tint":tint})
