extends SceneTree
const Main=preload("res://game/scenes/main.tscn")
class MemoryStore:
	extends RefCounted
	func read_into(m):m.global_data.settings.sound=false;return false
	func write(_m):return true
var passed=[]
var failed=[]
func check(n,c):
	if c:passed.append(n)
	else:failed.append(n);push_error(n)
func _initialize():call_deferred("run")
func run():
	var ui=Main.instantiate();ui.store=MemoryStore.new();root.add_child(ui);await process_frame;await process_frame
	check("fresh game has no welcome dialog",ui.modal=="")
	check("normal map texture pairs are loaded",ui.art.lit_sheets.size()>5)
	ui.model.pause_reasons.clear();ui.model.state.hero.x=-75;ui.world._process(0.05)
	check("building selection glow is behind opaque actors",ui.world.glow_sprite.z_index<ui.world.actors_surface.z_index and ui.world.actors_surface.z_index>ui.world.surface.z_index)
	check("tools use direct payment actions",ui.model.describe_building(ui.model.tool_stall("worker")).mode=="tool")
	ui.model.state.hero.x=ui.model.tool_stall("worker").x;ui._begin_action();ui._release_touch(-999);await process_frame
	check("payment remains in world without a dialog",ui.modal=="" and not ui.model.state.payment.is_empty())
	ui._toggle_pause();check("pause is inline without modal",ui.modal=="" and ui.model.pause_reasons.has("manual"))
	ui._toggle_pause();check("resume clears manual pause",not ui.model.pause_reasons.has("manual"))
	ui.model.state.hero.hp=0;ui._process(0.1);await process_frame;check("only defeat opens result",ui.modal=="result")
	ui._new_campaign();check("result restart returns directly to game",ui.modal=="" and ui.model.state.hero.hp==100)
	ui._toggle_pause();var clock=ui.model.state.time
	ui.world._push_effect({"kind":"coin","x":0.0,"y":0.0,"to":0.0,"to_y":0.0,"duration":0.1,"arc":0.0})
	for i in range(10):ui.world._process(0.05)
	check("paused coin feedback still completes and is reclaimed",ui.world.effects.is_empty())
	check("visual feedback never advances paused business time",ui.model.state.time==clock)
	ui.queue_free();await process_frame
	var f=FileAccess.open("res://qa/godot/v7-native-tests.json",FileAccess.WRITE);f.store_string(JSON.stringify({"scope":"Native headless UI with memory save adapter","passes":passed,"failures":failed},"\t"));f.close();print("NATIVE_V7 "+str(passed.size())+" passed, "+str(failed.size())+" failed");quit(0 if failed.is_empty() else 1)
