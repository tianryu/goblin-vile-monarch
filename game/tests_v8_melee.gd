extends SceneTree
const Model=preload("res://game/scripts/model.gd")
var passes=[]
var failures=[]
func check(label,condition):
	if condition:passes.append(label)
	else:failures.append(label);push_error(label)

# 高生命仅用于隔离夹具，真实AI及原有攻击结算继续执行。
func _initialize():
	for rank in [1,2,3]:
		for side in [-1,1]:
			for sortie in [false,true]:
				var m=Model.new(907);m.state.units.clear();m.state.enemies.clear();m.hall().level=rank;m.state.time=30;m.state.wave_day=m.state.day;m.state.hero.x=400-side*160
				var u=m.add_unit("brute",400);m.promote_unit(u,rank);u.hp=500
				var e=m.spawn_enemy("dwarf",side,400+side*30);e.hp=500;e.max_hp=500
				if sortie:u.mission={"stage":"sortie","building_id":m.outpost(side).id,"side":side}
				var spacing=true
				for i in range(80):
					m.tick(0.05)
					spacing=spacing and abs(u.x-e.x)>=24 and abs(u.x-e.x)<=35 and not u.moving and u.face==side
				var tag=str(rank)+"/"+str(side)+("/sortie" if sortie else "/defense")
				check(tag+": combatants keep visible contact spacing and face each other",spacing)
				check(tag+": four seconds settle exactly five original melee hits",is_equal_approx(e.hp,448.0))
				check(tag+": rendering stand-off has no coin or chief-health side effects",m.state.gold==18 and m.state.hero.hp==100 and m.state.drops.is_empty())
	var report={"scope":"Native isolated melee spacing and original settlement, 3 ranks, both directions, defense and sortie","passes":passes,"failures":failures}
	FileAccess.open("res://qa/godot/v8-melee-native.json",FileAccess.WRITE).store_string(JSON.stringify(report,"  "))
	print("V8_MELEE ",passes.size()," passed ",failures.size()," failed");quit(1 if not failures.is_empty() else 0)
