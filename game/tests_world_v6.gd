extends SceneTree
const Model=preload("res://game/scripts/model.gd")
var passes=[]
var failures=[]
func check(label,ok):
	if ok:passes.append(label)
	else:failures.append(label);push_error(label)
func fixture():
	var m=Model.new(616);m.state.units.clear();m.state.enemies.clear();m.state.gold=30;m.state.scrap=50;m.state.hero.x=-1540
	return m
func _initialize():
	var m=fixture()
	check("fresh chief has 100 health and no crown mechanic",m.state.hero.hp==100 and not m.state.has("crown"))
	var before=m.snapshot();m.contribute();m.state.hero.x=-1611.99;m.tick(0.01)
	check("within 72 retains payment and coin target",m.state.payment.paid==1 and m.find_target().kind=="wall")
	m.state.hero.x=-1612;m.tick(0.01)
	check("exact 72 boundary returns every coin immediately",m.state.gold==30 and m.state.payment.is_empty())
	check("outside radius cannot pay old target",not m.contribute(m.describe_building(m.by_id(m.state.buildings,before.state.buildings.filter(func(b):return b.kind=="wall" and b.x==-1540)[0].id))).ok)
	m=fixture();m.state.gold=3;m.state.ad_in_bag=1;m.global_data.reserve=20
	for i in range(3):m.contribute()
	m.deposit(50);var reserve=m.global_data.reserve;m.cancel_payment()
	check("full wallet refunds escrow even above capacity",m.state.gold==53 and m.state.ad_in_bag==1 and m.global_data.reserve==reserve)
	var carrier=m.add_unit("hunter",m.state.hero.x);carrier.carry=3;m.tick(0.01)
	check("overflow refund never causes negative hunter handoff",m.state.gold==53 and carrier.carry==3)
	var total=m.total_gold();m.cancel_payment();check("repeated cancellation cannot duplicate refund",m.total_gold()==total)
	m=fixture();m.state.gold=1;m.state.ad_in_bag=1;m.global_data.reserve=20
	for i in range(3):m.contribute()
	m.cancel_payment();check("reserve and rewarded bag refund to original accounts",m.state.gold==1 and m.state.ad_in_bag==1 and m.global_data.reserve==20)
	m=fixture()
	check("four distinct profession stalls exist",m.state.buildings.filter(func(b):return b.kind=="tools").size()==4)
	for role in ["worker","hunter","brute","thief"]:
		var stall=m.tool_stall(role);var idle=m.add_unit("idle",stall.x-100)
		m.buy_tool(role)
		check(role+" purchase stocks only its own stall",idle.role=="idle" and m.state.tool_stock[role]==1)
		for i in range(40):m.tick(0.05)
		check(role+" physically walks to its own tools",idle.role==role and m.state.tool_stock[role]==0 and abs(idle.x-stall.x)<65)
		m.state.units.clear()
	m=fixture();m.state.hero.x=m.hall().x;m.state.hero.hp=40;m.tick(0.1)
	check("safe daytime hall restores eight health per second",is_equal_approx(m.state.hero.hp,40.8))
	m.state.time=130;m.tick(0.1);check("dusk does not heal chief",is_equal_approx(m.state.hero.hp,40.8))
	m.state.time=35;m.hall().hp=0;m.tick(0.1)
	check("ruined hall cannot heal or end campaign",m.state.status=="playing" and is_equal_approx(m.state.hero.hp,40.8))
	var repair=m.describe_building(m.hall());check("ruined hall remains repairable",repair.cost==2 and "修复" in repair.label and not repair.disabled)
	m.contribute(repair);m.contribute(repair);m.add_unit("worker",m.hall().x)
	for i in range(120):m.tick(0.05)
	check("worker repairs ruins and restores healing",m.hall().hp==m.hall().max_hp and m.state.hero.hp>40.8)
	var enemy=m.spawn_enemy("human",1,m.state.hero.x+10);enemy.cooldown=0;m.state.hero.hurt=0;var hp=m.state.hero.hp;var money=m.total_gold();m._hit_hero(enemy)
	check("enemy attack damages chief regardless of coins",is_equal_approx(m.state.hero.hp,hp-10) and m.total_gold()==money and m.state.drops.is_empty())
	m._hit_hero(enemy);check("hurt grace prevents simultaneous damage pileup",is_equal_approx(m.state.hero.hp,hp-10))
	m.hall().hp=0;m.state.units.clear();m.state.hero.x=m.hall().x+300;enemy.x=m.hall().x;m._enemy(enemy,0.1)
	check("enemy leaves hall ruins to pursue living chief",enemy.x>m.hall().x and m.state.status=="playing")
	m.state.flags.left=true;m.state.flags.right=true;m.state.hero.hp=0;m.tick(0.01)
	check("dead chief cannot win on simultaneous flag arrival",m.state.status=="lost" and m.global_data.wins==0)
	m.new_campaign(6);check("free restart restores chief health",m.state.status=="playing" and m.state.hero.hp==100)
	m=fixture();m._drop("flag",3700,1,{"side":1});var courier=m.add_unit("worker",m.hall().x)
	for i in range(2700):
		m.tick(0.05)
		if m.state.flags.right:break
	check("distant dropped objective flag remains recoverable",m.state.flags.right and m.state.drops.is_empty() and courier.cargo.is_empty())
	m=fixture();m.building("prison").level=1;m._spawn_downed("human",1900,90);m.add_unit("worker",m.hall().x)
	for i in range(1500):m.tick(0.05)
	check("expanded east battlefield captives can reach prison",m.state.captives.size()==1)
	m=fixture();var defender=m.add_unit("hunter",1440);var side=-1 if defender.id%2==0 else 1
	for b in m.state.buildings:
		if b.kind=="tower" and b.x==1440*side:b.level=1;defender.x=b.x
		if b.kind=="wall" and b.x==1540*side:b.level=1;b.hp=120;b.max_hp=120
	m.spawn_enemy("human",side,1700*side);m.state.time=35;m.tick(0.05)
	check("hunters keep defending after dawn while attackers remain",defender.on_tower>0)
	m=fixture();var saved=m.snapshot();saved.state.erase("world_layout");saved.state.erase("rules_version");saved.state.hero.erase("hp");saved.state.hero.erase("max_hp");saved.state.status="lost";saved.state.crown={"x":500,"delay":0}
	saved.state.buildings=saved.state.buildings.filter(func(b):return b.kind!="tools" or b.get("role","")=="worker")
	for b in saved.state.buildings:
		if b.kind=="hall":b.x=-650;b.level=2;b.hp=0;b.max_hp=420
		elif b.kind=="tools":b.x=-465;b.erase("role")
	saved.state.tool_stock.thief=3;saved.state.gold=17;saved.global.reserve=29
	var restored=Model.new(9);check("old crown failure save migrates without losing resources",restored.restore(saved) and restored.state.status=="playing" and restored.state.hero.hp==100 and restored.state.gold==17 and restored.global_data.reserve==29)
	check("migration preserves hall ruin rank and tool inventory",restored.hall().level==2 and restored.hall().hp==0 and restored.state.tool_stock.thief==3)
	check("migration adds missing stalls without duplicate IDs",restored.state.buildings.filter(func(b):return b.kind=="tools").size()==4 and restored.state.buildings.map(func(b):return b.id).size()==restored.state.buildings.reduce(func(a,b):a[b.id]=true;return a,{}).size())
	var twice=Model.new(8);check("second restore keeps migration idempotent",twice.restore(restored.snapshot()) and twice.state.buildings.size()==restored.state.buildings.size() and twice.tool_stall("hunter").x==restored.tool_stall("hunter").x)
	saved=restored.snapshot();saved.state.status="won";saved.state.hero.erase("hp");var won_save=Model.new(4);check("old won campaign stays won",won_save.restore(saved) and won_save.state.status=="won")
	saved=restored.snapshot();saved.state.hero.hp="broken";check("invalid health save rejected safely",not Model.new(3).restore(saved))
	var f=FileAccess.open("res://qa/godot/world-v6-model-tests.json",FileAccess.WRITE);f.store_string(JSON.stringify({"scope":"V6 headless model assertions, not phone or live TapTap evidence","passes":passes,"failures":failures},"\t"));f.close()
	print("WORLD_V6 "+str(passes.size())+" passed, "+str(failures.size())+" failed");quit(0 if failures.is_empty() else 1)
