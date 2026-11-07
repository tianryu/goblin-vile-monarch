extends SceneTree
const Model=preload("res://game/scripts/model.gd")
var passes=[]
var failures=[]
func check(label,ok):
	if ok:passes.append(label)
	else:failures.append(label);push_error(label)
func _initialize():
	var m=Model.new(711)
	m.state.hero.x=4030;var funds=m.total_gold()
	check("empty ground action never spends a coin",not m.act().ok and m.total_gold()==funds)
	var thief=m.add_unit("thief",m.building("tools").x);m.state.tool_stock.hunter=1;m.tick(0.05)
	check("idle thief keeps profession when spare tools exist",thief.role=="thief")
	m=Model.new(12);m.state.units.clear();m.state.gold=10
	for i in range(8):m.add_unit("hunter",-600)
	var brute=m.add_unit("brute",-600)
	check("rally finds leader after more than six early hunters",m.rally(-1) and not brute.mission.is_empty())
	check("rally keeps team at six and leaves defenders",m.state.units.filter(func(u):return not u.mission.is_empty()).size()==6)
	m=Model.new(1);m.state.enemies.clear();m.state.units.clear();m.building("prison").level=1
	for i in range(6):m.add_unit("worker",m.building("prison").x)
	for i in range(5):m._spawn_downed("human",m.building("prison").x,90)
	for i in range(50):m.tick(0.05)
	check("prison never overbooks incoming single-worker hauls",m.state.captives.size()==3 and not m.state.units.any(func(u):return not u.cargo.is_empty()))
	check("full prison leaves remaining captives in world",m.state.enemies.filter(func(e):return e.mode=="downed").size()==2)
	m=Model.new(3);m.state.enemies.clear();m.state.units.clear();m.building("prison").level=1
	var w=m.add_unit("worker",-1540);var wall={}
	for b in m.state.buildings:
		if b.kind=="wall" and b.x==-1540:wall=b
	wall.level=1;wall.hp=20;wall.max_hp=120;m.start_build(wall);m._spawn_downed("human",-1520,90);m.tick(0.05)
	check("emergency repair wins over nearby captive hauling",w.mode=="building" and w.cargo.is_empty() and wall.job.left<5)
	var foe=m.spawn_enemy("human",-1,w.x-50);var old_x=w.x;m.tick(0.1)
	check("unarmed worker retreats from close enemy",w.mode=="retreating" and w.x>old_x)
	m=Model.new(4);m.global_data.mounts.append("bat");m.equip_mount("bat");m.state.hero.stamina=0.2;m.input_run=true
	for i in range(30):m.tick(0.05)
	check("exhausted bat lands without repeated hop jitter",m.state.hero.fly==0 and m.state.hero.exhausted)
	m.input_run=false;m.tick(0.1);m.input_run=true;m.tick(0.1)
	check("rested bat can take off after releasing run",m.state.hero.fly>0)
	m=Model.new(13);m.state.enemies.clear();m.state.units.clear();m.global_data.mounts.append("bat");m.equip_mount("bat");m.state.hero.fly=44;m.input_run=true
	var ground_foe=m.spawn_enemy("human",1,m.state.hero.x);ground_foe.cooldown=0;var flight_hp=m.state.hero.hp;m.tick(0.05)
	check("low flight avoids ground melee",m.state.hero.hp==flight_hp)
	var archer=m.spawn_enemy("elf",1,m.state.hero.x+150);archer.cooldown=0;m.tick(0.05)
	check("elf arrows still threaten low flight",m.state.hero.hp==flight_hp-8)
	var progress=[]
	for task in ["arrows","wheel","pay","keys"]:
		m=Model.new(37);m.state.enemies.clear();m.state.units.clear();m.state.gold=20;m.building("den").level=1;m.state.explored.min=-4200
		var target={}
		for b in m.state.buildings:
			if b.kind=="supply" and b.side==-1 and b.task==task:target=b
		var t=m.add_unit("thief",target.x);m.start_theft(target.id)
		check(task+" remains visible until thief actually works",target.ready_day==m.state.day and target.assigned==t.id)
		for i in range(1000):m.tick(0.05)
		check(task+" physically returns and applies effect",t.mission.is_empty() and m.state.steal_effects.left.get(task,false))
		check(task+" cannot be immediately stolen again",not m.start_theft(target.id))
		if task=="pay":check("stolen pay yields real fifteen coins",m.total_gold()==32)
		if task=="keys":check("stolen keys rescue two real idle goblins",m.state.units.filter(func(u):return u.role=="idle").size()==2)
		if task=="arrows":
			m.state.day=4;m.spawn_wave();check("arrow theft limits corresponding elven ammunition",m.state.enemies.any(func(e):return e.type=="elf" and e.side<0 and e.ammo==2))
	m=Model.new(47);var hp=m.hall().hp
	for i in range(600):m.tick(0.05)
	check("distant camp garrisons never damage hall remotely",m.hall().hp==hp and m.state.enemies.all(func(e):return abs(e.x)>2700))
	m=Model.new(8);m.state.units.clear();m.building("prison").level=1;m.state.captives=[{"id":1000,"type":"elf"}]
	var rescuer=m.spawn_enemy("human",1,m.building("prison").x);rescuer.cooldown=0;m.tick(0.05)
	check("breach frees prisoner as an escaping real enemy",m.state.captives.is_empty() and m.state.enemies.any(func(e):return e.type=="elf" and e.mode=="escaping"))
	m=Model.new(24);m.state.gold=49;m.grant_reward("gold","overflow")
	check("ad gold overflow is visible reserve without loss",m.state.gold==50 and m.global_data.reserve==29)
	m.grant_reward("worker","two-workers");m.tick(0.05)
	check("worker reinforcement grants exactly two workers",m.state.units.filter(func(u):return u.role=="worker").size()==4)
	var boosts=m.global_data.boosts.duplicate();m.grant_reward("bat","unlock-bat");m.grant_reward("bat","boost-bat");m.equip_mount("boar");m.tick(0.1)
	check("unequipped mount boost is preserved",m.global_data.boosts.bat==300)
	m.new_campaign(5);check("free restart preserves purchased mount and unused boost","bat" in m.global_data.mounts and m.global_data.boosts.bat==300)
	var broken=m.snapshot();broken.state.units[0].erase("cooldown")
	check("valid JSON with incomplete unit is rejected before simulation",not Model.new(1).restore(broken))
	var old=m.snapshot();old.global.settings={};old.global.boosts={}
	var upgraded=Model.new(2);check("older optional settings restore with complete defaults",upgraded.restore(old) and upgraded.global_data.settings.sound and upgraded.global_data.boosts.wolf==0)
	var f=FileAccess.open("res://qa/godot/finishing-model-tests.json",FileAccess.WRITE);f.store_string(JSON.stringify({"scope":"Headless model scenarios, not phone or real SDK validation","passes":passes,"failures":failures},"\t"));f.close()
	print("FINISHING_MODEL "+str(passes.size())+" passed, "+str(failures.size())+" failed");quit(0 if failures.is_empty() else 1)
