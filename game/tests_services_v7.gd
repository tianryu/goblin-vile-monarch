extends SceneTree
const Model=preload("res://game/scripts/model.gd")
var passes=[]
var failures=[]
func check(n,c):
	if c:passes.append(n)
	else:failures.append(n);push_error(n)
func clean():
	var m=Model.new(37);m.state.enemies.clear();m.state.units.clear();m.state.wave_day=m.state.day;m.hall().level=3;return m
func advance(m,seconds):
	for i in range(int(seconds/0.05)):m.state.wave_day=m.state.day;m.tick(0.05)
func _initialize():
	var m=clean();m.state.gold=20;m.state.hero.x=9000
	check("empty ground action never spends",not m.act().ok and m.state.gold==20)
	check("every paid target uses the coin action icon",m.state.buildings.all(func(b):return m.targets_for(b).all(func(t):return t.cost<=0 or t.icon=="coin")))
	for task in ["arrows","wheel","pay","keys"]:
		m=clean();m.state.gold=20;m.building("den").level=1;m.state.explored.min=-9200
		var target={}
		for b in m.state.buildings:
			if b.kind=="supply" and b.side==-1 and b.task==task:target=b
		var thief=m.add_unit("thief",target.x);var started=m.start_theft(target.id)
		check(task+" supply persists while assigned thief has not worked",started and target.ready_day==m.state.day and target.assigned==thief.id)
		advance(m,4)
		check(task+" does not apply its effect before return",not m.state.steal_effects.left.get(task,false))
		advance(m,155)
		check(task+" physically returns and applies effect",thief.mission.is_empty() and m.state.steal_effects.left.get(task,false))
		check(task+" supply cannot be immediately reused",not m.start_theft(target.id))
		if task=="arrows":
			m.state.day=5;m.spawn_wave();check("arrow theft reduces next left elves to two shots",m.state.enemies.any(func(e):return e.type=="elf" and e.side<0 and e.ammo==2))
		if task=="wheel":
			m.state.day=5;m.spawn_wave();check("wheel theft suppresses left siege while right siege remains",not m.state.enemies.any(func(e):return e.type=="siege" and e.side<0) and m.state.enemies.any(func(e):return e.type=="siege" and e.side>0))
		if task=="pay":
			check("stolen payroll goes to treasury instead of carried purse",m.state.vault==15 and m.state.gold==17)
			m.state.day=5;m.spawn_wave();check("pay theft removes two next-wave mercenaries",m.state.enemies.filter(func(e):return e.side<0 and e.type!="siege").size()+2==m.state.enemies.filter(func(e):return e.side>0 and e.type!="siege").size())
		if task=="keys":check("key theft frees two real goblins",m.state.units.filter(func(u):return u.role=="idle").size()==2)
	m=clean();m.building("prison").level=1
	for i in range(6):m.add_unit("worker",m.building("prison").x)
	for i in range(5):m._spawn_downed("human",m.building("prison").x,100)
	advance(m,3)
	check("six haulers never overbook three prison places",m.state.captives.size()==3 and not m.state.units.any(func(u):return u.cargo.get("kind","")=="captive"))
	check("full prison leaves surplus wounded on ground",m.state.enemies.filter(func(e):return e.mode=="downed").size()==2)
	m=clean();m.building("prison").level=1;m.state.captives=[{"id":9001,"type":"human"},{"id":9002,"type":"elf"}];m.state.trader.phase="staying";m.state.trader.x=1860
	check("sale transfers two captive bodies into trader cart",m.sell_captives()==2 and m.state.captives.is_empty() and m.state.trader.cargo.size()==2)
	check("sale drops fourteen coins once",m.state.drops.size()==1 and m.state.drops[0].amount==14 and m.sell_captives()==0)
	m=clean();var trap=m.building("net");trap.level=1;trap.charges=1;var foe=m.spawn_enemy("human",1,trap.x);m.tick(0.05)
	check("actual net trap is the only automatic netted capture",foe.mode=="downed" and foe.trapped and trap.charges==0)
	m.state.enemies.clear();m.add_unit("worker",trap.x);advance(m,0.1);check("worker physically reloads spent trap",trap.charges==1)
	m=clean();m.state.gold=20
	for i in range(8):m.add_unit("hunter",-600)
	var brute=m.add_unit("brute",-600)
	check("rally finds late recruited leader",m.rally(-1) and not brute.mission.is_empty())
	check("rally takes six and retains defenders",m.state.units.filter(func(u):return not u.mission.is_empty()).size()==6 and m.state.units.size()==9)
	m=clean();m.global_data.mounts.append("bat");m.equip_mount("bat");m.state.hero.fly=44;m.input_run=true;var hp=m.state.hero.hp
	m.spawn_enemy("human",1,m.state.hero.x).cooldown=0;m.tick(0.05);check("flight avoids ground melee",m.state.hero.hp==hp)
	m.spawn_enemy("elf",1,m.state.hero.x+150).cooldown=0;m.tick(0.05);check("elven arrows can hit flight",m.state.hero.hp==hp-8)
	m=clean();m.grant_reward("bat","unlock");m.grant_reward("bat","boost");m.equip_mount("boar");m.tick(0.1)
	check("unused mount boost does not drain",m.global_data.boosts.bat==300)
	m.new_campaign(51);check("free restart preserves unused rewarded mount and boost","bat" in m.global_data.mounts and m.global_data.boosts.bat==300)
	var saved=m.snapshot();saved.state.units[0].erase("cooldown");check("incomplete unit save is rejected safely",not Model.new(2).restore(saved))
	var f=FileAccess.open("res://qa/godot/v7-advanced-tests.json",FileAccess.WRITE);f.store_string(JSON.stringify({"scope":"V7 retained advanced gameplay in controlled headless scenarios, not live phone or SDK evidence","passes":passes,"failures":failures},"\t"));f.close();print("ADVANCED_V7 "+str(passes.size())+" passed, "+str(failures.size())+" failed");quit(0 if failures.is_empty() else 1)
