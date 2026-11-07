extends Control
const Model=preload("res://game/scripts/model.gd")
const Art=preload("res://game/scripts/art_bank.gd")
const Store=preload("res://game/scripts/save_store.gd")
const World=preload("res://game/scripts/world.gd")
const Hud=preload("res://game/scripts/minimal_hud.gd")
const Joystick=preload("res://game/scripts/horizontal_joystick.gd")
var model=Model.new()
var art=Art.new()
var store=Store.new()
var world
var sound
var hud
var joystick
var safe=Vector4.ZERO
var rects={}
var modal=""
var portrait=false
var joystick_finger=-999
var run_finger=-999
var action_finger=-999
var key_action_held=false
var action_interval=0.0
var action_consumed=false
var target_lock={}
var pending_ad={}
var accumulator=0.0
var autosave=0.0
var feedback_until=0
var ad_inflight=false
var ad_requested_kind=""
var ad_callback
var ad_request_serial=0
var ad_deadline=0
var qa_callback
var qa_stress_mode=false
var qa_last_publish=0
var scene_veil=0.0
var restart_stage=""
var qa_motion=false

func _ready():
	store.read_into(model)
	sound=load("res://game/scripts/sound_bank.gd").new();sound.model=model;add_child(sound)
	world=World.new();world.model=model;world.art=art;add_child(world)
	var layer=CanvasLayer.new();layer.layer=10;add_child(layer)
	hud=Hud.new();hud.game=self;hud.mouse_filter=Control.MOUSE_FILTER_IGNORE;layer.add_child(hud)
	joystick=Joystick.new();joystick.base=art.texture("ui_joystick_base");joystick.knob=art.texture("ui_joystick_knob");joystick.mouse_filter=Control.MOUSE_FILTER_IGNORE;hud.add_child(joystick)
	get_viewport().size_changed.connect(_layout);_layout();_setup_qa()
	if model.state.status!="playing":modal="result"

func _exit_tree():
	art.animations.shutdown()

func _layout():
	var s=get_viewport_rect().size;safe=Vector4.ZERO
	if OS.has_feature("web"):
		var raw=JavaScriptBridge.eval("(()=>{let e=document.getElementById('goblin-safe-area');if(!e){e=document.createElement('div');e.id='goblin-safe-area';e.style.cssText='position:fixed;visibility:hidden;pointer-events:none;padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)';document.body.appendChild(e)}let c=getComputedStyle(e);return JSON.stringify([parseFloat(c.paddingLeft)||0,parseFloat(c.paddingTop)||0,parseFloat(c.paddingRight)||0,parseFloat(c.paddingBottom)||0,parseFloat(c.paddingLeft)||0,innerHeight])})()",true)
		var v=JSON.parse_string(str(raw))
		if v is Array and v.size()==6:
			var ratio=s.y/maxf(1,float(v[5]));safe=Vector4(v[0]*ratio,v[1]*ratio,v[2]*ratio,v[3]*ratio)
	var left=24+safe.x;var right=s.x-24-safe.z;var bottom=s.y-safe.w
	rects={"joystick":Rect2(left,bottom-112,164,88),"run":Rect2(right-260,bottom-110,78,78),"action":Rect2(right-112,bottom-130,104,104),"whip":Rect2(right-214,bottom-190,66,66),"pause":Rect2(right-60,14+safe.y,60,60),"restart":Rect2(right-140,14+safe.y,60,60),"new_campaign":Rect2(right-108,bottom-126,104,104)}
	joystick.position=rects.joystick.position;joystick.size=rects.joystick.size;portrait=s.x<s.y;model.pause("portrait",portrait);_clear_input()

func _clear_input():
	joystick_finger=-999;run_finger=-999;action_finger=-999;key_action_held=false;target_lock={};pending_ad={};action_consumed=false;model.input_axis=0;model.input_run=false;model.cancel_payment()
	if joystick!=null:joystick.set_axis(0)

func _notification(what):
	if what==NOTIFICATION_APPLICATION_FOCUS_OUT or what==NOTIFICATION_APPLICATION_PAUSED:
		if model!=null:model.pause("background",true);store.write(model)
		_clear_input()
	elif what==NOTIFICATION_APPLICATION_FOCUS_IN or what==NOTIFICATION_APPLICATION_RESUMED:
		if model!=null:model.pause("background",false)
		_clear_input()

func _input(e):
	if restart_stage!="":return
	if e is InputEventMouse and e.device==InputEvent.DEVICE_ID_EMULATION:return
	if e is InputEventKey and not e.echo:
		if e.pressed and e.keycode==KEY_ESCAPE and modal=="":_toggle_pause()
		if e.keycode in [KEY_E,KEY_SPACE]:
			if e.pressed and modal=="" and not model.paused():key_action_held=true;_begin_action()
			elif not e.pressed:key_action_held=false;target_lock={};action_consumed=false;_finish_ad(false)
	if portrait:return
	if e is InputEventScreenTouch:
		if e.pressed and not e.canceled:_press_touch(e.index,e.position)
		else:
			var canceled=e.canceled
			if OS.has_feature("web"):canceled=canceled or bool(JavaScriptBridge.eval("(()=>{let s=window.GoblinInputCancelled;if(!s)return false;let id="+str(e.index)+";let hit=s.has(id);s.delete(id);return hit})()",true))
			_release_touch(e.index,canceled)
	elif e is InputEventScreenDrag:
		if e.index==joystick_finger:_drag(e.position)
	elif e is InputEventMouseButton and e.button_index==MOUSE_BUTTON_LEFT:
		if e.pressed:_press_touch(-1,e.position)
		else:_release_touch(-1)
	elif e is InputEventMouseMotion and joystick_finger==-1:_drag(e.position)

func _press_touch(finger,pos):
	if ad_inflight or restart_stage!="":return
	if modal=="result":
		if rects.new_campaign.has_point(pos) and hud.accepts("new_campaign"):_request_restart()
		return
	if rects.pause.has_point(pos) and hud.accepts("pause"):_toggle_pause();return
	if model.pause_reasons.has("manual"):
		if rects.restart.has_point(pos) and hud.accepts("restart"):_request_restart()
		return
	if model.paused():return
	if rects.whip.has_point(pos) and action_finger==-999 and model.find_target().get("mode","")!="whip" and hud.accepts("whip"):action_finger=finger;_begin_action(model.find_whip_target());return
	if rects.joystick.has_point(pos) and joystick_finger==-999 and joystick.presence>0.12:joystick_finger=finger;_drag(pos)
	elif rects.run.has_point(pos) and run_finger==-999 and hud.accepts("run"):run_finger=finger;model.input_run=true
	elif rects.action.has_point(pos) and action_finger==-999 and hud.accepts("action"):action_finger=finger;_begin_action()

func _release_touch(finger,canceled=false):
	if finger==joystick_finger:joystick_finger=-999;model.input_axis=0;joystick.set_axis(0)
	if finger==run_finger:run_finger=-999;model.input_run=false
	if finger==action_finger:action_finger=-999;target_lock={};action_consumed=false;_finish_ad(canceled)
	if canceled:model.cancel_payment()

func _drag(pos):
	var dx=(pos.x-rects.joystick.get_center().x)/40.0;model.input_axis=0.0 if abs(dx)<0.18 else clampf(dx,-1,1);joystick.set_axis(model.input_axis)

func _begin_action(target={}):
	target_lock=(model.find_target() if target.is_empty() else target).duplicate(true);action_interval=0.18;action_consumed=false;_do_action()
func _do_action():
	if model.paused() or action_consumed or target_lock.is_empty():return
	if target_lock.kind=="whip":
		var u=model.by_id(model.state.units,target_lock.object_id)
		if u.is_empty() or abs(u.x-model.state.hero.x)>=model.INTERACT_RADIUS:action_consumed=true;return
		target_lock.x=u.x
	var result=model.contribute(target_lock)
	if result.has("ad"):pending_ad={"kind":result.ad,"target":target_lock.duplicate(true)};action_consumed=true
	elif result.get("payment",false):
		sound.play("coin",-19)
		if result.get("completed",false):action_consumed=true
	elif result.get("repeat",false):action_interval=0.55 if target_lock.kind=="whip" else 0.16
	else:action_consumed=true
	if not result.get("ok",false):feedback_until=Time.get_ticks_msec()+650
	_save()
func _finish_ad(canceled):
	if pending_ad.is_empty():return
	var action=pending_ad.duplicate(true);pending_ad={}
	if not canceled and abs(action.target.x-model.state.hero.x)<model.INTERACT_RADIUS:request_ad(action.kind)
func _toggle_pause():
	if ad_inflight or modal!="":return
	var enabled=not model.pause_reasons.has("manual");_clear_input();model.pause("manual",enabled);_save()
func _new_campaign():model.new_campaign();modal="";_clear_input();world.camera_x=model.state.hero.x;world.previous={};world.effects.clear();_save()

func _request_restart():
	if restart_stage!="":return
	_clear_input();model.pause("transition",true);restart_stage="out"

func _advance_restart(delta):
	if restart_stage=="out":
		scene_veil=move_toward(scene_veil,1.0,delta/0.18)
		if scene_veil>=1:
			_new_campaign();art.transitions.clear();world.clear_glows();model.pause("transition",true);restart_stage="in"
	elif restart_stage=="in":
		scene_veil=move_toward(scene_veil,0.0,delta/0.22)
		if scene_veil<=0:restart_stage="";model.pause("transition",false)

func _process(delta):
	art.transitions.advance(delta);_advance_restart(delta)
	if ad_inflight and Time.get_ticks_msec()>ad_deadline:_on_ad_result([],ad_request_serial)
	if joystick_finger==-999 and not model.paused() and modal=="":model.input_axis=float(int(Input.is_physical_key_pressed(KEY_D) or Input.is_physical_key_pressed(KEY_RIGHT))-int(Input.is_physical_key_pressed(KEY_A) or Input.is_physical_key_pressed(KEY_LEFT)))
	if run_finger==-999 and modal=="" and not model.paused():model.input_run=Input.is_physical_key_pressed(KEY_SHIFT)
	if (action_finger!=-999 or key_action_held) and not action_consumed and modal=="":
		action_interval-=delta
		if action_interval<=0:action_interval=0.18;_do_action()
	accumulator+=minf(delta,0.1)
	while accumulator>=1.0/30.0:world.capture_previous();model.tick(1.0/30.0);accumulator-=1.0/30.0
	world.interpolation=accumulator*30.0
	if model.state.status!="playing" and modal!="result":_clear_input();modal="result";model.pause("result",true);_save()
	joystick.set_target_visible(hud.content_enabled and modal=="" and not portrait and (not model.paused() or model.pause_reasons.keys()==["qa"]));hud.queue_redraw();autosave+=delta
	if autosave>=5 and model.dirty:_save();autosave=0
	if OS.has_feature("web") and OS.is_debug_build() and Time.get_ticks_msec()-qa_last_publish>(500 if qa_stress_mode else (16 if qa_motion else 120)):_publish_qa();qa_last_publish=Time.get_ticks_msec()
func _save():
	if store.write(model):model.dirty=false

func request_ad(kind):
	if ad_inflight:return
	if not OS.has_feature("web") or not JavaScriptBridge.eval("typeof window.GoblinRewardedAds==='object'&&window.GoblinRewardedAds.ready===true",true):feedback_until=Time.get_ticks_msec()+900;return
	ad_inflight=true;ad_requested_kind=kind;ad_request_serial+=1;ad_deadline=Time.get_ticks_msec()+180000;_clear_input();model.pause("ad",true)
	ad_callback=JavaScriptBridge.create_callback(_on_ad_result.bind(ad_request_serial));JavaScriptBridge.get_interface("window").goblinAdResult=ad_callback
	JavaScriptBridge.eval("try{window.GoblinRewardedAds.show("+JSON.stringify(kind)+",window.goblinAdResult)}catch(e){window.goblinAdResult(JSON.stringify({completed:false}))}",true)
func _on_ad_result(args,serial=-1):
	if not ad_inflight or serial!=ad_request_serial:return
	ad_inflight=false;model.pause("ad",false);var value=null
	if args.size()>0:value=JSON.parse_string(str(args[0]))
	if value is Dictionary and value.get("completed",false) and value.get("receipt","")!="" and value.get("kind","")==ad_requested_kind:model.grant_reward(ad_requested_kind,value.receipt)
	else:feedback_until=Time.get_ticks_msec()+800
	ad_requested_kind="";_save()

func _setup_qa():
	if not OS.has_feature("web") or not OS.is_debug_build():return
	qa_callback=JavaScriptBridge.create_callback(_qa_command);JavaScriptBridge.get_interface("window").goblinQaCommand=qa_callback
func _qa_command(args):
	if args.is_empty():return
	var c=JSON.parse_string(str(args[0]))
	if not c is Dictionary:return
	match c.get("op",""):
		"motion_probe":qa_motion=bool(c.get("enabled",true))
		"new":qa_stress_mode=false;model.new_campaign(int(c.get("seed",42)),false);modal="";world.camera_x=model.state.hero.x;_clear_input()
		"move":model.state.hero.x=float(c.x);world.camera_x=model.state.hero.x;world.previous={}
		"time":model.state.time=float(c.value);model.state.wave_day=model.state.day if c.get("quiet",true) else 0
		"resources":model.state.gold=clampi(int(c.get("gold",50)),0,50);model.state.vault=int(c.get("vault",0));model.state.ad_in_bag=0
		"freeze":model.pause("qa",bool(c.get("value",true)))
		"unfreeze":model.pause("qa",false)
		"levels":
			model.hall().level=clampi(int(c.get("rank",2)),1,3)
			for u in model.state.units:
				if u.role!="idle":model.promote_unit(u,int(model.hall().level))
			if c.get("built",false):
				for b in model.state.buildings:
					if model.unlocked(b) and b.kind in ["prison","den","farm","woodcut","mine","wall","tower","net","rock"]:b.level=1;b.charges=1;b.hp=120;b.max_hp=120
		"advance":
			var paused=model.pause_reasons.duplicate();model.pause_reasons.clear()
			var remaining=maxf(0,float(c.get("seconds",1)))
			while remaining>0.000001:
				var step=minf(0.05,remaining);model.tick(step);remaining-=step
			model.pause_reasons=paused
		"spawn":
			var e=model.spawn_enemy(c.get("type","human"),int(c.get("side",1)),float(c.get("x",model.state.hero.x+40)))
			if c.has("hp"):e.hp=float(c.hp);e.max_hp=e.hp
			if c.has("ammo"):e.ammo=clampi(int(c.ammo),0,6)
			if c.has("cooldown"):e.cooldown=clampf(float(c.cooldown),0,2)
			if c.get("guard",false):e.guard=true;e.home=e.x
		"fall":
			var e=model._spawn_downed(c.get("type","human"),float(c.get("x",model.state.hero.x+80)),100);e.mode="dead" if c.get("dead",false) else "downed"
		"chief_hp":model.state.hero.hp=float(c.get("value",100))
		"hall_ruin":model.hall().hp=0
		"unit":
			var u=model.add_unit(c.get("role","worker"),float(c.get("x",model.state.hero.x+25)));u.hidden=int(c.get("hidden",0));u.whip_age=float(c.get("age",0))
			if c.has("hp"):u.hp=float(c.hp)
			if c.has("rank"):model.promote_unit(u,int(c.rank))
		"clear":model.state.units.clear();model.state.enemies.clear();model.state.drops.clear()
		"clear_enemies":model.state.enemies.clear()
		"gold_drop":model._drop("gold",float(c.get("x",model.state.hero.x+100)),int(c.get("amount",8)))
		# 仅调试导出可用，设置就近的商人起点后仍由真实到站/离开逻辑推进。
		"trader":
			var t=model.state.trader;t.phase=c.get("phase","arriving");t.x=float(c.get("x",MonarchModel.CORE_SITES.trader_stop+620));t.until=model.state.total+float(c.get("stay",110));t.last_day=model.state.day
		"mount":
			if not c.mount in model.global_data.mounts:model.global_data.mounts.append(c.mount)
			model.equip_mount(c.mount);model.state.hero.face=int(c.get("face",1))
		"scene":
			model.new_campaign(724,false);modal="";model.hall().level=3;model.state.enemies.clear();model.state.hero.x=120;world.camera_x=120;model.state.vault=85
			for u in model.state.units:
				if u.role!="idle":model.promote_unit(u,3)
			for b in model.state.buildings:
				if b.kind in ["prison","den","farm","woodcut","mine"]:b.level=1
			model.state.captives=[{"id":9901,"type":"human"},{"id":9902,"type":"elf"}];model.state.time=float(c.get("time",185));model.pause("qa",true)
			if c.get("all_captives",false):model.state.captives.append({"id":9903,"type":"dwarf"})
		"outcome":model.state.status="won" if c.get("win",true) else "lost";modal="result";model.pause("result",true)
		"save":_save()
		"photo":hud.content_enabled=not bool(c.get("hide",true))
		"render_probe":
			world.set_meta("probe_directional",bool(c.get("directional",true)));world.set_meta("probe_local",bool(c.get("local",true)));world.surface.set_meta("use_normals",bool(c.get("normals",true)));model.global_data.settings.low_fx=bool(c.get("no_reflections",false))
			world.fast_lighting=not bool(c.get("native",false));world.lit_material.shader=load("res://game/shaders/world_light_fast.gdshader" if world.fast_lighting else "res://game/shaders/world_light.gdshader")
		"soak":
			qa_stress_mode=true;model.new_campaign(777,false);modal="";model.hall().level=3;model.state.hero.x=0;world.camera_x=0;model.state.hero.hurt=1000000;model.hall().hp=1000000;model.hall().max_hp=1000000
			for b in model.state.buildings:
				if b.kind in ["prison","den","farm","woodcut","mine"]:b.level=1
			while model.state.units.size()<18:model.add_unit("hunter" if model.state.units.size()%2 else "worker",randf_range(-320,320))
			for u in model.state.units:u.hp=1000000
			for i in range(20):
				var e=model.spawn_enemy(["human","elf","dwarf"][i%3],-1 if i%2 else 1,randf_range(-330,330));e.hp=1000000;e.max_hp=1000000
	_publish_qa()

func _publish_qa():
	var d=model.stats();d.modal=modal;d.paused=model.paused();d.axis=model.input_axis;d.run=model.input_run;d.mount=model.state.hero.mount;d.fly=model.state.hero.fly;d.hero_face=model.state.hero.face;d.version=7;d.visible_objects=world.visible_objects;d.decoded_art_bytes=art.decoded_bytes
	d.engine_static_bytes=Performance.get_monitor(Performance.MEMORY_STATIC);d.engine_process_seconds=Performance.get_monitor(Performance.TIME_PROCESS);d.engine_draw_calls=Performance.get_monitor(Performance.RENDER_TOTAL_DRAW_CALLS_IN_FRAME)
	d.target=model.find_target();d.payment=model.state.payment.duplicate();d.rects={};d.tool_stock=model.state.tool_stock.duplicate();d.viewport=[get_viewport_rect().size.x,get_viewport_rect().size.y];d.portrait=portrait;d.ad_inflight=ad_inflight;d.roles={};d.units=[];d.enemies=[];d.sites=[];d.boosts=model.global_data.boosts.duplicate();d.mounts=model.global_data.mounts.duplicate()
	for key in rects:
		if key=="whip" and (model.find_whip_target().is_empty() or modal!="" or model.find_target().get("mode","")=="whip"):continue
		if key=="action" and (model.find_target().is_empty() or modal!=""):continue
		if key=="restart" and not model.pause_reasons.has("manual"):continue
		if key=="new_campaign" and modal!="result":continue
		var r=rects[key];d.rects[key]=[r.position.x,r.position.y,r.size.x,r.size.y]
	for u in model.state.units:d.roles[u.role]=int(d.roles.get(u.role,0))+1;d.units.append({"id":u.id,"x":u.x,"hp":u.hp,"role":u.role,"hidden":u.hidden,"stun":u.get("stun",0),"efficiency":model.efficiency(u),"carry":u.carry,"cooldown":u.cooldown,"face":u.face,"shot_pose":u.get("shot_pose",0),"hit_pose":u.get("hit_pose",0),"lash_heat":u.get("lash_heat",0),"lash_cooldown":u.get("lash_cooldown",0),"stun_age":u.get("stun_age",0),"mission":u.mission.duplicate(true)})
	for e in model.state.enemies:d.enemies.append({"id":e.id,"x":e.x,"type":e.type,"mode":e.mode,"hp":e.hp,"face":e.get("face",-int(e.side)),"moving":e.get("moving",false),"attack_pose":e.get("attack_pose",0),"cooldown":e.cooldown,"ammo":e.ammo})
	for b in model.state.buildings:d.sites.append({"id":b.id,"x":b.x,"kind":b.kind,"role":b.get("role",""),"level":b.level,"requires":b.get("requires",1),"visible":model.unlocked(b),"job":b.job,"hp":b.get("hp",0),"task":b.get("task",""),"ready_day":b.get("ready_day",0),"assigned":b.get("assigned",0)})
	d.coin_slots=world.slot_count;d.ghost_key=world.ghost_key;d.water_time=world.elapsed;d.daylight=world.daylight;d.sun=[world.sun_position.x,world.sun_position.y];d.moon=[world.moon_position.x,world.moon_position.y];d.moon_visible=world.moon_visible;d.torches=world.torch_points.size();d.active_torch_lights=world.torch_lights.filter(func(l):return l.enabled).size();d.normal_sheets=art.lit_sheets.size();d.fast_normal_lighting=world.fast_lighting;d.render_order=world.rendered_order;d.glow=is_instance_valid(world.glow_sprite) and world.glow_sprite.visible;d.hero_anchor=[world.sx(model.state.hero.x),world.hero_visual_foot()+world.ground_offset(model.state.hero.x)];d.explanatory_ui=true;d.building_caption_enabled=true;d.actor_outline=art.actor_sheets.has("actors-ink.png")
	d.animation={"clips":art.animations.clips.keys(),"loaded":art.animations.cache.size(),"pending":art.animations.pending.size(),"decoded_bytes":art.animations.decoded_bytes}
	d.trader=model.state.trader.duplicate(true);d.bodies=model.state.bodies.duplicate(true)
	d.hero_whip_pose=model.state.hero.get("whip_pose",0);d.hero_hover=world.hero_hover()
	d.drops=model.state.drops.duplicate(true)
	d.shots=model.state.shots.duplicate(true)
	d.fire=world.fire_field.states;d.fire_mode="procedural-handpainted"
	if qa_motion:d.motion={"surface":art.transitions.snapshot(world.surface),"actors":art.transitions.snapshot(world.actors_surface),"overlay":art.transitions.snapshot(world.overlay),"hud":art.transitions.snapshot(hud),"glow_nodes":world.glow_entries.size(),"veil":scene_veil,"restart":restart_stage,"joystick":joystick.presence}
	JavaScriptBridge.eval("window.__goblinState="+JSON.stringify(d),true)
