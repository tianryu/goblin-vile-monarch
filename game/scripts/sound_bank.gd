extends Node

var model
var streams={}
var voices=[]
var cursor=0
var next_step=0.0
var next_battle=0.0
var prior_gold=-1
var prior_kills=0

func _ready():
	for key in ["click","back","confirm","error","coin","chop","arrow","cage","hoof"]:streams[key]=load("res://game/audio/"+key+".ogg")
	for i in range(4):
		var p=AudioStreamPlayer.new();p.volume_db=-17;add_child(p);voices.append(p)

func play(key,volume=-17.0):
	if model==null or not model.global_data.settings.sound or not streams.has(key) or voices.is_empty():return
	var p=voices[cursor%voices.size()];cursor+=1;p.set_meta("world",false);p.stream=streams[key];p.volume_db=volume;p.play()

func _process(delta):
	if model==null:return
	if model.paused():
		for v in voices:
			if v.playing and v.get_meta("world",false):v.stop()
		return
	next_step-=delta;next_battle-=delta
	if abs(model.input_axis)>0.1 and next_step<=0 and model.state.hero.fly<3:
		play("hoof",-27);voices[(cursor-1)%voices.size()].set_meta("world",true);next_step=0.3 if model.input_run else 0.48
	if prior_gold>=0 and model.state.gold>prior_gold:play("coin",-23)
	prior_gold=model.state.gold
	if model.state.kills>prior_kills:play("chop",-25)
	prior_kills=model.state.kills
	if not model.state.shots.is_empty() and next_battle<=0:
		play("arrow",-29);next_battle=0.3
