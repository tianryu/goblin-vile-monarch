extends SceneTree
const Model=preload("res://game/scripts/model.gd")
var passes=[]
var failures=[]
func check(label,ok):
	if ok:passes.append(label)
	else:failures.append(label);push_error(label)
func clean():
	var m=Model.new(911);m.state.units.clear();m.state.enemies.clear();m.state.time=30;m.state.wave_day=1;m.state.hero.x=0
	return m
func _initialize():
	for type in ["human","elf","dwarf"]:
		var m=clean();var e=m.spawn_enemy(type,1,1000);e.cooldown=0.8;m._enemy(e,0.05)
		check(type+": spawn cooldown is not a fake attack",e.attack_pose==0)
		m=clean();e=m.spawn_enemy(type,1,30);e.cooldown=0;m._enemy(e,0.05)
		check(type+": actual strike starts one display clock",e.attack_pose==1.1 and e.cooldown==1.1 and e.attack_face==-1)
		var hp=m.state.hero.hp;var money=m.wealth();m._enemy(e,0.1)
		check(type+": display clock advances without extra damage or money",is_equal_approx(e.attack_pose,1.0) and m.state.hero.hp==hp and m.wealth()==money)
		var clock=e.attack_pose;m.pause("qa",true);m.tick(0.5)
		check(type+": model pause freezes attack clock",e.attack_pose==clock)
	for side in [-1,1]:
		var m=clean();var e=m.spawn_enemy("human",side,side*140);e.cooldown=0
		for i in range(60):m._enemy(e,0.05)
		check(str(side)+": enemy contacts front of mount instead of its centre",abs(e.x-m.state.hero.x)>=60 and abs(e.x-m.state.hero.x)<=66 and m.state.hero.hp<100)
	var last=clean();var archer=last.spawn_enemy("elf",1,200);archer.ammo=1;archer.cooldown=0
	last._enemy(archer,0.05);var origin=archer.x
	for i in range(4):last._enemy(archer,0.05)
	check("Last arrow completes its release stance after ammo becomes zero",archer.ammo==0 and archer.x==origin and archer.attack_kind=="shoot")
	last._enemy(archer,0.2)
	check("Empty archer then approaches for melee without inventing another arrow",archer.x<origin and archer.ammo==0 and last.state.shots.size()==1)
	var hunter_model=clean();hunter_model.state.hero.x=1000;var hunter=hunter_model.add_unit("hunter",0);var target=hunter_model.spawn_enemy("human",1,160);target.hp=500
	# 记录真实出箭位置，允许猎手在首次发现敌人的本帧先完成正常移动。
	hunter_model.tick(0.05);var fired_hp=target.hp;var fired_x=hunter.x
	for i in range(7):hunter_model.tick(0.05)
	check("Hunter remains planted through the generated release pose",hunter.x==fired_x and hunter.shot_pose>0 and target.hp==fired_hp)
	for i in range(2):hunter_model.tick(0.05)
	check("Hunter resumes retreat after release without another damage settlement",hunter.x<0 and hunter.shot_pose==0 and target.hp==fired_hp)
	var immune=clean();immune.state.hero.hurt=1.0;var immune_elf=immune.spawn_enemy("elf",1,180);immune_elf.cooldown=0
	immune._enemy(immune_elf,0.05)
	check("Invulnerable chief still sees one arrow while taking no extra damage",immune.state.hero.hp==100 and immune.state.shots.size()==1 and immune_elf.ammo==5)
	check("Chief arrow records its actual target",immune.state.shots[0].target_hero and immune.state.shots[0].target_fly==0)
	var flight=clean();flight.state.hero.mount="bat";flight.state.hero.fly=44;var flier_elf=flight.spawn_enemy("elf",1,180);flier_elf.cooldown=0;flight._enemy(flier_elf,0.05)
	check("Arrow to a flying chief retains the actual launch height",flight.state.shots.size()==1 and flight.state.shots[0].target_hero and flight.state.shots[0].target_fly==44)
	var ground=clean();ground.state.hero.x=1000;ground.add_unit("worker",0);var ground_elf=ground.spawn_enemy("elf",1,180);ground_elf.cooldown=0;ground._enemy(ground_elf,0.05)
	check("Arrow to a worker does not inherit the chief height",ground.state.shots.size()==1 and not ground.state.shots[0].target_hero and ground.state.shots[0].target_fly==0)
	print("V8_ENEMY_POSE ",passes.size()," passed ",failures.size()," failed")
	FileAccess.open("res://qa/godot/v8-enemy-pose-native.json",FileAccess.WRITE).store_string(JSON.stringify({"passes":passes,"failures":failures},"  "))
	quit(1 if not failures.is_empty() else 0)
