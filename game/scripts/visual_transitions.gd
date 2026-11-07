class_name MonarchTransitions
extends RefCounted

# 只保存显示快照，不读取或修改金币、任务、存档与随机源。
const ENTER=0.18
const EXIT=0.22
var delta=0.0
var canvases={}

func advance(seconds):delta=minf(maxf(seconds,0),0.1)

# 每个绘制层独立持有退场快照，旧对象随镜头平移而不漂在屏幕上。
func begin(canvas,drift=Vector2.ZERO):
	var id=canvas.get_instance_id()
	if not canvases.has(id):canvases[id]={"entries":{}}
	var frame=canvases[id]
	frame.scope="root";frame.counts={};frame.matrix=Transform2D.IDENTITY;frame.layer=0.0;frame.serial=0
	for row in frame.entries.values():row.seen=false;row.command.matrix.origin+=drift

func scope(canvas,key):
	if canvases.has(canvas.get_instance_id()):canvases[canvas.get_instance_id()].scope=str(key)
func layer(canvas,value):
	if canvases.has(canvas.get_instance_id()):canvases[canvas.get_instance_id()].layer=float(value)
func transform(canvas,matrix):
	if canvases.has(canvas.get_instance_id()):canvases[canvas.get_instance_id()].matrix=matrix
func current_transform(canvas):return canvases[canvas.get_instance_id()].matrix

func submit(canvas,identity,command):
	var frame=canvases[canvas.get_instance_id()];var base=frame.scope+"/"+str(identity)
	var index=int(frame.counts.get(base,0));frame.counts[base]=index+1
	var key=base+"/"+str(index);var fresh=not frame.entries.has(key)
	command.matrix=frame.matrix;command.layer=frame.layer;command.order=frame.serial;frame.serial+=1
	if fresh:frame.entries[key]={"p":0.0,"seen":true,"scope":frame.scope,"command":command}
	var row=frame.entries[key]
	# 同一身体的装备替换依次退场、进场，不能交叉叠成两个半透明人物。
	# 旧外观仍跟随当前脚点；快速切回旧装备则从现有透明度恢复。
	if not fresh and command.has("exclusive_variant") and row.command.get("exclusive_variant","")!=command.exclusive_variant:
		row.p=move_toward(float(row.p),0.0,delta/EXIT);row.seen=true
		if row.p>0:
			var previous=row.command.duplicate();previous.rect.position+=command.actor_anchor-previous.actor_anchor
			previous.actor_anchor=command.actor_anchor;previous.matrix=command.matrix;previous.order=command.order;previous.layer=command.layer
			row.command=previous;return
		row.command=command;return
	if not fresh:command.tint=row.command.tint.lerp(command.tint,1-exp(-delta*22))
	row.seen=true;row.command=command
	if not fresh:row.p=move_toward(float(row.p),1.0,delta/(0.045 if frame.layer>=200 and frame.layer<300 else ENTER))

# 先合成再绘制，淡出条目保留原层次；淡出结束立即回收，不创建逐帧Tween。
func finish(canvas,render=true):
	var frame=canvases[canvas.get_instance_id()];var output=[]
	for key in frame.entries.keys():
		var row=frame.entries[key]
		if not row.seen:row.p=move_toward(float(row.p),0.0,delta/(0.10 if row.command.layer>=200 and row.command.layer<300 else EXIT))
		if not row.seen and row.p<=0:frame.entries.erase(key);continue
		var command=row.command.duplicate();var color=command.tint;color.a*=smoothstep(0.0,1.0,row.p);command.tint=color;output.append(command)
	output.sort_custom(func(a,b):return a.layer<b.layer if a.layer!=b.layer else a.order<b.order)
	if render:
		for c in output:
			if c.tint.a<=0:continue
			canvas.draw_set_transform_matrix(c.matrix)
			match c.kind:
				"region":canvas.draw_texture_rect_region(c.texture,c.rect,c.source,c.tint)
				"texture":canvas.draw_texture_rect(c.texture,c.rect,false,c.tint)
				"text":canvas.draw_string(c.font,c.position,c.text,HORIZONTAL_ALIGNMENT_LEFT,-1,c.height,c.tint)
				"rect":canvas.draw_rect(c.rect,c.tint)
				"polyline":canvas.draw_polyline(c.points,c.tint,c.width,true)
				"multiline":canvas.draw_multiline(c.points,c.tint,c.width,true)
		canvas.draw_set_transform_matrix(Transform2D.IDENTITY)
	return output

func opacity(canvas,prefix):
	var result=0.0;var frame=canvases.get(canvas.get_instance_id(),{})
	for row in frame.get("entries",{}).values():
		if row.scope==prefix or row.scope.begins_with(prefix+"/"):result=maxf(result,smoothstep(0,1,row.p))
	return result

func snapshot(canvas):
	var rows=[]
	for key in canvases.get(canvas.get_instance_id(),{}).get("entries",{}):
		var r=canvases[canvas.get_instance_id()].entries[key]
		var sample={"key":key,"scope":r.scope,"alpha":smoothstep(0,1,r.p),"requested":r.seen,"tint_alpha":r.command.tint.a,"layer":r.command.layer,"origin":[r.command.matrix.origin.x,r.command.matrix.origin.y],"rotation":r.command.matrix.get_rotation()}
		if r.command.has("rect"):sample.rect=[r.command.rect.position.x,r.command.rect.position.y,r.command.rect.size.x,r.command.rect.size.y]
		if r.command.has("source"):sample.source=[r.command.source.position.x,r.command.source.position.y,r.command.source.size.x,r.command.source.size.y]
		if r.command.has("animation"):sample.animation=r.command.animation
		if r.command.has("exclusive_variant"):sample.asset=r.command.exclusive_variant
		rows.append(sample)
	return rows

# 场景重建仅在遮罩完全覆盖后清空；普通目标变更不能清空过渡。
func clear():canvases.clear()
