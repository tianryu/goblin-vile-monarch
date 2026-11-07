extends SceneTree
const Model=preload("res://game/scripts/model.gd")
var passes=[]
var failures=[]
func check(label,ok):
	if ok:passes.append(label)
	else:failures.append(label);push_error(label)
func clean():
	var m=Model.new(945);m.state.units.clear();m.state.enemies.clear();m.state.hero.x=400;m.state.time=30;m.state.wave_day=1
	return m
func cash(m):
	var value=m.wealth()
	for drop in m.state.drops:
		if drop.kind=="gold":value+=drop.amount
	return value
func _initialize():
	var m=clean();var u=m.add_unit("worker",400);u.hidden=7
	check("New goblin has no false spawn flinch",u.get("hit_pose",0)==0 and u.get("stun",0)==0)
	var initial=cash(m);m.whip(u.id)
	check("Real lash starts one recoil and releases hidden coins once",u.hit_pose==Model.REACTION_TIME and u.hidden==0 and cash(m)==initial+7)
	check("Chief gesture starts on the same successful lash",m.state.hero.whip_pose==Model.WHIP_POSE_TIME)
	for i in range(4):m.tick(0.05)
	check("Flinch plants feet rather than sliding the static pose",u.x==400 and u.hit_pose>0)
	var clock=u.hit_pose;m.pause("qa",true);m.tick(0.1)
	check("Pause freezes reaction clock and coins",u.hit_pose==clock and cash(m)==initial+7)
	check("Pause also freezes the seated chief gesture",is_equal_approx(m.state.hero.whip_pose,Model.WHIP_POSE_TIME-0.2))
	m.pause("qa",false)
	for i in range(6):m.tick(0.05)
	check("Completed recoil resumes normal work without another coin drop",u.hit_pose==0 and u.x<400 and cash(m)==initial+7)
	u.x=390;u.lash_cooldown=0;m.whip(u.id)
	check("Chief turns toward the actual goblin being whipped",m.state.hero.face==-1)
	m.input_axis=1;m.tick(0.05)
	check("Horizontal movement interrupts the planted mount gesture",m.state.hero.whip_pose==0 and m.state.hero.velocity>0)
	# 四次真实鞭打并经过正常冷却，不能直接给眩晕状态冒充触发。
	m=clean();u=m.add_unit("worker",400)
	for lash in range(4):
		m.whip(u.id)
		if lash<3:
			for i in range(11):m.tick(0.05)
	check("Over-whipping starts the original eight-second stun",u.stun==8.0 and u.stun_age==0)
	var fall_x=u.x
	for i in range(25):m.tick(0.05)
	check("Stunned living goblin stays alive and planted through the fall",u.stun>6 and u.stun_age>=1.2 and u.x==fall_x and m.state.bodies.is_empty())
	var age=u.stun_age;m.pause("qa",true);m.tick(0.1)
	check("Pause freezes the full fall and recovery window",u.stun_age==age)
	m.pause("qa",false)
	for i in range(139):m.tick(0.05)
	check("Living goblin recovers once and remains the same unit",u.stun==0 and m.by_id(m.state.units,u.id)==u and m.state.bodies.is_empty())
	# 由敌兵的真实命中驱动反应和死亡，而非显示层自行修改生命。
	m=clean();m.state.hero.x=1000;u=m.add_unit("worker",0);var e=m.spawn_enemy("human",1,30);e.cooldown=0;m._enemy(e,0.05)
	check("Actual enemy hit starts recoil and charges health once",u.hp==9 and u.hit_pose==Model.REACTION_TIME)
	for i in range(10):m.tick(0.05)
	check("Repeated animation ticks do not charge extra damage",u.hp==9 and m.state.bodies.is_empty())
	u.hidden=4;u.carry=2;e.cooldown=0;m._enemy(e,0.05);initial=cash(m);var ident=u.id;m.tick(0.05)
	check("Death transfers one stable actor identity to its fallen body",m.by_id(m.state.units,ident).is_empty() and m.state.bodies.size()==1 and m.state.bodies[0].id==ident)
	check("Death drops carried and hidden coins exactly once",cash(m)==initial+6)
	var body=m.state.bodies[0]
	for i in range(25):m.tick(0.05)
	check("Fallen corpse advances one time then stays a corpse",body.fallen_age>=1.2 and m.state.bodies.size()==1 and cash(m)==initial+6)
	age=body.fallen_age;m.pause("qa",true);m.tick(0.1)
	check("Pause freezes corpse age as well as live reactions",body.fallen_age==age)
	m=clean();u=m.add_unit("worker",400);u.stun=4;u.stun_age=4;u.hp=0;m.tick(0.05)
	check("Death of an already fallen goblin does not restart a standing fall",m.state.bodies[0].fallen_age>=4)
	FileAccess.open("res://qa/godot/v8-reaction-states-native.json",FileAccess.WRITE).store_string(JSON.stringify({"passes":passes,"failures":failures},"  "))
	print("V8_REACTIONS ",passes.size()," passed ",failures.size()," failed");quit(1 if not failures.is_empty() else 0)
