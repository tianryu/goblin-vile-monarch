class_name MonarchFireField
extends Node2D

# 火焰只有显示职责。每个火源复用小四边形，不载入序列图，也不创建逐帧Tween。
# 借鉴pixelfx的确定时间、分层火舌、余烬和独立灯光；许可见game/licenses/PixelFX-MIT.txt。
const FIRE_SHADER=preload("res://game/shaders/painted_fire.gdshader")
const ENTER=0.18
const EXIT=0.22
var entries={}
var states=[]

func _new_mesh(parent,shader_material):
	var node=MeshInstance2D.new();node.mesh=QuadMesh.new();node.material=shader_material;node.z_index=3;parent.add_child(node)
	return node

# 火源先按稳定ID更新，消失后保持原位置淡出；折返沿用当前透明度。
func sync(sources,seconds,delta,canvas_size,ground,scale_value,drift,low_fx):
	var wanted={};states=[]
	for source in sources:
		var key=str(source.id);wanted[key]=true
		if not entries.has(key):
			var mat=ShaderMaterial.new();mat.shader=FIRE_SHADER
			var node=_new_mesh(self,mat);var mirror=_new_mesh(self,mat);mirror.z_index=11
			entries[key]={"node":node,"mirror":mirror,"material":mat,"p":0.0,"point":source.point,"source":source}
		entries[key].point=source.point;entries[key].source=source
	for key in entries.keys():
		var row=entries[key];var live=wanted.has(key)
		row.p=move_toward(float(row.p),1.0 if live else 0.0,delta/(ENTER if live else EXIT))
		if not live:row.point+=drift
		if row.p<=0 and not live:
			row.node.queue_free();row.mirror.queue_free();entries.erase(key);continue
		var source=row.source;var h=float(source.height)*scale_value;var w=float(source.width)*scale_value
		var mesh_size=Vector2(w*2.5,h*1.65)
		row.node.mesh.size=mesh_size;row.mirror.mesh.size=mesh_size
		var center=row.point+Vector2(0,-h*0.725)
		row.node.position=center;row.node.modulate=Color.WHITE
		row.mirror.position=Vector2(center.x+sin(seconds*0.7)*1.3*scale_value,canvas_size.y*0.77+ground*0.38+sin(seconds)*0.6*scale_value-center.y*0.38)
		row.mirror.scale=Vector2(1,-0.38);row.mirror.modulate=Color(0.46,0.62,0.77,0.17);row.mirror.visible=not low_fx
		var mat=row.material;mat.set_shader_parameter("fire_time",seconds);mat.set_shader_parameter("fire_seed",float(source.seed))
		mat.set_shader_parameter("presence",smoothstep(0.0,1.0,row.p));mat.set_shader_parameter("strength",float(source.strength))
		mat.set_shader_parameter("campfire",source.kind=="campfire");mat.set_shader_parameter("low_effects",low_fx)
		states.append({"id":key,"kind":source.kind,"alpha":smoothstep(0.0,1.0,row.p)*float(source.strength),"point":[row.point.x,row.point.y],"time":seconds,"live":live})

# 火形与周围灯光使用相同连续节奏，避免火在动而照明完全不同步。
static func flicker(seconds,seed_value):
	return 0.94+0.045*sin(seconds*5.1+seed_value+4.1)+0.025*sin(seconds*8.3+(seed_value+4.1)*2.3)
