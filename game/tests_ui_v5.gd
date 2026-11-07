extends SceneTree
const MainScene=preload("res://game/scenes/main.tscn")
class MemoryStore:
	extends RefCounted
	var last_error=""
	func read_into(model):model.global_data.settings.sound=false;return false
	func write(_model):return true
var passes=[]
var failures=[]
func check(label,ok):
	if ok:passes.append(label)
	else:failures.append(label);push_error(label)
func _initialize():call_deferred("_run")
func _run():
	var ui=MainScene.instantiate();ui.store=MemoryStore.new();root.add_child(ui)
	await process_frame
	check("thin stamina bitmap style fits inside its real bar",ui.stamina.get_combined_minimum_size().y<=7)
	check("thin clock bitmap style fits inside its real bar",ui.day_progress.get_combined_minimum_size().y<=5)
	ui.model.state.gold=50;ui.model.global_data.reserve=999999;ui._refresh()
	check("unlimited reserve never overflows the compact purse HUD",ui.coins.get_combined_minimum_size().x<=78 and not ui.coins.text.is_empty())
	ui.panel_box.size.y=190;await process_frame;ui.open_panel("tools");await process_frame
	var separated=true
	for card in ui.panel_content.get_children():
		if card.has_meta("qa_card"):
			var detail=card.get_node("CardDetail").get_global_rect();var picture=card.get_node("CardArt").get_global_rect();var title=card.get_node("CardTitle").get_global_rect()
			separated=separated and picture.end.y<=title.position.y-3
			if card.has_node("CardPrice"):separated=separated and detail.end.y<=card.get_node("CardPrice").get_global_rect().position.y-4
	check("small safe-area cards separate picture text stock and price",separated)
	ui.close_panel();ui.model.state.hero.x=2600;ui.world.camera_x=2600
	ui.open_panel("result");ui.menu_controller.new_campaign()
	check("free restart centers camera immediately at the fresh monarch",abs(ui.world.camera_x-ui.model.state.hero.x)<0.01 and ui.modal=="" and ui.model.state.status=="playing")
	ui.queue_free();await process_frame
	var file=FileAccess.open("res://qa/godot/ui-native-v5-tests.json",FileAccess.WRITE);file.store_string(JSON.stringify({"scope":"Native headless UI integration with an in-memory save adapter. Does not overwrite native or browser saves.","passes":passes,"failures":failures},"\t"));file.close()
	print("NATIVE_UI "+str(passes.size())+" passed, "+str(failures.size())+" failed");quit(0 if failures.is_empty() else 1)

