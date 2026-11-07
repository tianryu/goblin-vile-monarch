extends SceneTree

const Model = preload("res://game/scripts/model.gd")
var failures = []
var passes = []

func check(name,condition):
	if condition:passes.append(name)
	else:failures.append(name);push_error(name)

func _initialize():
	var m=Model.new(123)
	check("fresh campaign starts with six units",m.state.units.size()==6)
	check("bag and reserve combined can buy normal-coin lizard",m.state.gold==18 and m.total_gold()==18)
	m.state.gold=40
	check("lizard purchase works",m.buy_lizard() and "lizard" in m.global_data.mounts and m.state.gold==0)
	check("duplicate lizard purchase does not charge",not m.buy_lizard())
	check("first reward is accepted",m.grant_reward("gold","first"))
	check("duplicate reward is rejected",not m.grant_reward("gold","first") and m.state.gold==30)
	for i in range(100):m.grant_reward("hunter","army-"+str(i))
	check("unlimited advertisements queue all units",m.global_data.pending.hunter==200)
	m.tick(0.1)
	check("active capacity respected and surplus kept",m.state.units.size()==20 and m.global_data.pending.hunter==186)
	var greedy=m.state.units[0]
	greedy.hidden=5;m.state.hero.x=greedy.x
	var cash=m.total_gold()
	var outcome=m.act(m.find_target())
	check("whip returns exact hidden amount",outcome.get("amount",0)==5 and greedy.hidden==0 and m.total_gold()==cash+5)
	m.grant_reward("wolf","wolf-first");m.grant_reward("wolf","wolf-second");m.grant_reward("wolf","wolf-third")
	check("mount unlock and boost stack",m.global_data.boosts.wolf==600.0)
	m.equip_mount("wolf");m.pause("menu",true);m.tick(0.1)
	check("paused boost does not tick",m.global_data.boosts.wolf==600.0)
	m.pause("menu",false);m.tick(0.1)
	check("active equipped boost ticks",abs(m.global_data.boosts.wolf-599.9)<0.001)
	var save=m.snapshot();var restored=Model.new(2)
	check("save roundtrip",restored.restore(save) and restored.stats()==m.stats())
	var json_copy=JSON.parse_string(JSON.stringify(save))
	check("JSON save restores integer IDs and exact RNG state",restored.restore(json_copy) and typeof(restored.state.units[0].id)==TYPE_INT and restored.rng.state==m.rng.state)
	for i in range(100):restored.tick(0.1)
	check("restored JSON campaign continues simulating",restored.state.total>m.state.total)
	check("bad save rejected",not restored.restore({"state":{}}))
	var tools_test=Model.new(10);tools_test.state.units=tools_test.state.units.filter(func(u):return u.role!="idle")
	check("tools can be purchased before recruitment",tools_test.buy_tool("hunter") and tools_test.state.tool_stock.hunter==1)
	var recruit=tools_test.add_unit("idle",tools_test.tool_stall("hunter").x)
	tools_test.tick(0.05)
	check("new idle goblin claims stocked tool once",recruit.role=="hunter" and tools_test.state.tool_stock.hunter==0)
	check("schema matching but truncated JSON is rejected safely",not restored.restore({"state":{"schema":3,"hero":{},"buildings":[]},"global":{}}))
	var receipts=m.global_data.receipts.size();var boost=m.global_data.boosts.wolf
	m.new_campaign(55)
	check("free reset preserves mounts receipts and boost","wolf" in m.global_data.mounts and m.global_data.receipts.size()==receipts and m.global_data.boosts.wolf==boost)
	var prisoner=m.building("prison");prisoner.level=1
	check("prison capacities are 3 6 10",m.prison_capacity()==3)
	prisoner.level=2;check("level two prison",m.prison_capacity()==6)
	prisoner.level=3;check("level three prison",m.prison_capacity()==10)
	m.state.captives=[{"id":99,"type":"human"},{"id":100,"type":"dwarf"}]
	m.state.trader.phase="staying";var before=m.total_gold()
	check("captive sale exact",m.sell_captives("human")==1 and m.total_gold()==before+6 and m.state.captives.size()==1)
	check("no repeated sale",m.sell_captives("human")==0)
	m.state.gold=50;m.state.scrap=50
	var wall={}
	for b in m.state.buildings:
		if b.kind=="wall" and b.x<0:wall=b;break
	var worker=m.state.units[0];worker.x=wall.x
	check("build starts with payment",m.start_build(wall).ok and not wall.job.is_empty())
	for i in range(400):m.tick(0.05)
	check("worker actually completes building",wall.level==1 and wall.hp==wall.max_hp)
	var foe=m.spawn_enemy("human",-1,wall.x-10)
	m.damage_enemy(foe,100)
	check("equipment creates scrap once",m.state.drops.any(func(d):return d.kind=="scrap"))
	var total_scrap=0
	for d in m.state.drops:
		if d.kind=="scrap":total_scrap+=d.amount
	m.damage_enemy(foe,100)
	var after_scrap=0
	for d in m.state.drops:
		if d.kind=="scrap":after_scrap+=d.amount
	check("no repeated corpse loot",total_scrap==after_scrap)
	var mission=Model.new(321)
	mission.state.gold=50;mission.building("den").level=1
	var target={}
	for b in mission.state.buildings:
		if b.kind=="supply" and b.task=="wheel" and b.side==-1:target=b;break
	var thief=mission.add_unit("thief",target.x+10)
	check("unscouted theft is blocked without payment",not mission.start_theft(target.id) and mission.state.gold==50)
	mission.state.explored.min=-4200
	check("scouted theft starts with exact cost",mission.start_theft(target.id) and mission.state.gold==47)
	for i in range(1200):
		mission.tick(0.05)
		if thief.mission.is_empty():break
	check("thief physically returns with wheel",thief.mission.is_empty() and abs(thief.x-mission.hall().x)<=300 and mission.state.steal_effects.left.get("wheel",false))
	check("stolen wheel is material income",mission.state.scrap>=15)
	mission.state.day=5;mission.spawn_wave()
	check("wheel theft prevents corresponding next siege",not mission.state.enemies.any(func(e):return e.type=="siege" and e.side==-1) and mission.state.enemies.any(func(e):return e.type=="siege" and e.side==1))
	var capture=Model.new(971);capture.building("prison").level=1
	var down=capture._spawn_downed("human",-550,90)
	for i in range(500):capture.tick(0.05)
	check("one downed captive is delivered exactly once",capture.state.captives.size()==1 and capture.state.enemies.filter(func(e):return e.id==down.id).is_empty())
	check("no worker duplicates the captive cargo",capture.state.units.filter(func(u):return u.cargo.get("kind","")=="captive").is_empty())
	var battle=Model.new(89);battle.state.time=179.98;battle.state.wave_day=1
	var survivor=battle.spawn_enemy("human",1,1900);battle.tick(0.05)
	check("dawn does not erase attackers",battle.state.enemies.any(func(e):return e.id==survivor.id))
	battle.hall().hp=0;battle.tick(0.05);check("destroyed hall leaves chief alive and campaign playable",battle.state.status=="playing" and battle.state.hero.hp>0)
	var health_test=Model.new(9);health_test.state.gold=0;health_test.state.units.clear();health_test.state.enemies.clear()
	var attacker=health_test.spawn_enemy("human",1,health_test.state.hero.x+18)
	health_test._hit_hero(attacker)
	check("empty wallet loses health without crown state",health_test.state.hero.hp==90 and not health_test.state.has("crown"))
	health_test.state.gold=50;health_test.state.hero.hurt=0;health_test._hit_hero(attacker)
	check("full wallet does not shield health or spill coins",health_test.state.hero.hp==80 and health_test.state.gold==50 and health_test.state.drops.is_empty())
	health_test.state.hero.hp=0;health_test.tick(0.05);check("chief death loses campaign",health_test.state.status=="lost")
	var receipt_test=Model.new(8)
	for i in range(2100):receipt_test.grant_reward("gold","receipt-"+str(i))
	check("old reward receipts remain idempotent beyond 2000",not receipt_test.grant_reward("gold","receipt-0"))
	m.state.flags.left=true;m.state.flags.right=true;m.tick(0.01)
	check("two returned flags win",m.state.status=="won")
	var report={"scope":"Godot model tests, not phone or live advertisement evidence","passes":passes,"failures":failures}
	var file=FileAccess.open("res://qa/godot/model-tests.json",FileAccess.WRITE)
	file.store_string(JSON.stringify(report,"\t"));file.close()
	print("MODEL_TESTS "+str(passes.size())+" passed, "+str(failures.size())+" failed")
	quit(0 if failures.is_empty() else 1)
