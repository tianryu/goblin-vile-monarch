from pathlib import Path
p=Path('game/scripts/main.gd')
s=p.read_text(encoding='utf-8-sig')
def replace_func(name,source):
    global s
    start=s.index('func '+name+'(')
    end=s.find('\nfunc ',start+5)
    if end<0:end=len(s)
    s=s[:start]+source.strip()+'\n'+s[end:]
replace_func('_input','''func _input(event):
	if event is InputEventMouse and event.device==InputEvent.DEVICE_ID_EMULATION:return
	if event is InputEventKey and not event.echo:
		if event.pressed and event.keycode==KEY_ESCAPE:
			if modal!="":handle_back()
			else:open_panel("pause")
		if event.keycode in [KEY_E,KEY_SPACE]:
			if event.pressed and modal=="":key_action_held=true;_begin_action()
			elif not event.pressed:key_action_held=false;target_lock={};action_consumed=false
	if modal!="" or rotate_cover.visible:return
	if event is InputEventScreenTouch:
		if event.pressed and not event.canceled:_press_touch(event.index,event.position)
		else:
			_release_touch(event.index)
			if event.canceled:model.cancel_payment()
	elif event is InputEventScreenDrag:
		if event.index==joystick_finger:_drag_joystick(event.position)
	elif event is InputEventMouseButton and event.button_index==MOUSE_BUTTON_LEFT:
		if event.pressed:_press_touch(-1,event.position)
		else:_release_touch(-1)
	elif event is InputEventMouseMotion and joystick_finger==-1:_drag_joystick(event.position)''')
replace_func('_press_touch','''func _press_touch(finger,pos):
	if joystick.get_global_rect().has_point(pos) and joystick_finger==-999:
		joystick_finger=finger;_drag_joystick(pos)
	elif run_button.get_global_rect().has_point(pos) and run_finger==-999:run_finger=finger;model.input_run=true
	elif action_button.is_visible_in_tree() and action_button.get_global_rect().has_point(pos) and action_finger==-999:
		action_finger=finger;_begin_action()''')
replace_func('_release_touch','''func _release_touch(finger):
	if finger==joystick_finger:joystick_finger=-999;model.input_axis=0;joystick.set_axis(0)
	if finger==run_finger:run_finger=-999;model.input_run=false
	if finger==action_finger:action_finger=-999;target_lock={};action_consumed=false

func _begin_action():
	target_lock=model.find_target().duplicate(true);action_interval=0.18;action_consumed=false
	if target_lock.is_empty():action_consumed=true;return
	_do_action()''')
replace_func('_do_action','''func _do_action():
	if model.paused() or action_consumed:return
	var result=model.contribute(target_lock)
	if result.get("shop","")!="":open_panel(result.shop,result.get("object_id",0))
	if not result.get("payment",false) or result.get("completed",false) or not result.get("ok",false):action_consumed=true
	_save();_refresh()''')
replace_func('_process','''func _process(delta):
	if ad_inflight and Time.get_ticks_msec()>ad_deadline:_on_ad_result([],ad_request_serial)
	if joystick_finger==-999 and modal=="" and not model.paused():
		model.input_axis=float(int(Input.is_physical_key_pressed(KEY_D) or Input.is_physical_key_pressed(KEY_RIGHT))-int(Input.is_physical_key_pressed(KEY_A) or Input.is_physical_key_pressed(KEY_LEFT)))
	if run_finger==-999 and modal=="":model.input_run=Input.is_physical_key_pressed(KEY_SHIFT)
	if (action_finger!=-999 or key_action_held) and not action_consumed and modal=="":
		action_interval-=delta
		if action_interval<=0:_do_action();action_interval=0.18
	accumulator+=minf(delta,0.1)
	while accumulator>=1.0/30.0:
		world.capture_previous();model.tick(1.0/30.0);accumulator-=1.0/30.0
	world.interpolation=accumulator*30.0
	for b in [action_button,run_button]:
		var pressed=(action_finger!=-999 or key_action_held) if b==action_button else model.input_run
		b.scale=b.scale.lerp(Vector2.ONE*(0.94 if pressed else 1.0),1-exp(-delta*22))
	autosave+=delta;refresh_timer+=delta
	if autosave>=5 and model.dirty:_save();autosave=0
	if refresh_timer>0.08:
		_refresh();refresh_timer=0
		if OS.has_feature("web") and OS.is_debug_build():_publish_qa()
	if model.state.status!="playing" and modal not in ["result","ledger","guide","credits"]:open_panel("result")''')
replace_func('_refresh','''func _refresh():
	hud.visible=modal==""
	coins.text=short_number(model.state.gold)+(" +"+short_number(model.global_data.reserve) if model.global_data.reserve>0 else "")
	population.text=str(model.state.units.size())+"/"+str(model.capacity())
	clock.text="第"+str(model.state.day)+"日  "+model.phase();day_progress.value=model.state.time
	var target=model.find_target();var available=not target.is_empty()
	action_button.visible=available;action_caption.visible=available;hint.visible=available
	action_caption.text=target.get("action","投币");action_button.disabled=target.get("disabled",false)
	hint.text=target.get("label","")
	if target.get("cost",0)>0:
		var paid=int(model.state.get("payment",{}).get("paid",0))
		hint.text=str(paid)+" / "+str(target.cost)+" 金币"+("  "+str(target.scrap)+"废铁" if target.get("scrap",0)>0 else "")
	toast.text=""
	if not model.events.is_empty():
		var latest=model.events[-1];var key=str(latest.get("id",latest.at))+latest.text
		if key!=toast_key:
			toast_key=key;toast_deadline=Time.get_ticks_msec()+3800
			if "不足" in latest.text or "需要" in latest.text:sound.play("error",-22)
			elif "监牢" in latest.text or "活口已" in latest.text:sound.play("cage",-23)
			elif "完成" in latest.text or "到手" in latest.text or "军旗" in latest.text:sound.play("confirm",-24)
		if Time.get_ticks_msec()<toast_deadline:toast.text=latest.text
	toast_bg.visible=toast.text!="" and modal=="";toast.visible=toast_bg.visible
	panel_feedback.text="广告播放中，完成后领取奖励" if ad_inflight else toast.text
	if modal in ["welcome","result","guide","credits"]:panel_feedback.text=""
	stamina.max_value=model.MOUNTS[model.state.hero.mount].stamina;stamina.value=model.state.hero.stamina
	if not store.last_error.is_empty():
		if modal=="":toast.text=store.last_error;toast_bg.show();toast.show()
		else:panel_feedback.text=store.last_error''')
replace_func('close_panel','''func close_panel():
	if ad_inflight:return
	if modal=="welcome":model.state.tutorial=1
	modal="";panel_layer.hide();model.pause("panel",false);_clear_input();_save();_refresh()

func handle_back():
	if ad_inflight:return
	if modal=="welcome":guide_page=0;guide_return="welcome";open_panel("guide")
	elif modal=="guide":open_panel(guide_return)
	elif modal=="result":open_panel("ledger")
	elif modal=="credits":open_panel("pause")
	elif modal=="ledger" and model.state.status!="playing":open_panel("result")
	else:close_panel()''')
replace_func('open_panel','''func open_panel(kind,object_id=0):
	if kind=="guide" and modal!="guide":guide_return=modal if modal!="" else "pause";guide_page=0
	_clear_input();modal=kind;modal_object=object_id;model.pause("panel",true);panel_layer.show()
	_save()
	for child in panel_content.get_children():panel_content.remove_child(child);child.queue_free()
	mobile.clear_actions();Menus.new(self).populate(kind,object_id)
	if ad_inflight:
		var controls=[];_append_controls(panel_layer,controls)
		for c in controls:
			if c is Button:c.disabled=true
	_refresh()''')
s=s.replace('''		var notice=panel_content.get_node_or_null("AdNotice")
		if notice==null:notice=paragraph("广告暂时不可用，请稍后再试。你可以继续游玩。");notice.name="AdNotice"''','''		model.notify("广告暂时不可用，可以继续游玩。");_refresh()''')
s=s.replace('_append_controls(panel_box,pending_controls)','_append_controls(panel_layer,pending_controls)')
s=s.replace('_append_controls(panel_box,controls)','_append_controls(panel_layer,controls)')
s=s.replace('data.tool_stock=model.state.tool_stock.duplicate();data.roles={};data.ui=[]','''data.payment=model.state.get("payment",{}).duplicate();data.hero_x=model.state.hero.x;data.hero_face=model.state.hero.face
	data.effects=world.effects.size();data.coin_slots=world.slot_count;data.ghost_key=world.ghost_key;data.native_canvas=true
	data.tool_stock=model.state.tool_stock.duplicate();data.roles={};data.ui=[]''')
s=s.replace('"disabled":c.disabled,"rect"','"disabled":c.disabled,"footer":c.has_meta("footer_slot") or c==panel_close,"rect"')
s=s.replace('data.viewport=[get_viewport_rect().size.x,get_viewport_rect().size.y]','''data.viewport=[get_viewport_rect().size.x,get_viewport_rect().size.y]
	data.hero_anchor=[world.sx(model.state.hero.x),world.ground+6-float(model.state.hero.fly)*world.scale_factor]
	data.daylight=world.daylight;data.water_time=world.elapsed''')
p.write_text(s,encoding='utf-8')
