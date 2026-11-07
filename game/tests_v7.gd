extends SceneTree
const Model=preload("res://game/scripts/model.gd")
var passes=[]
var failures=[]
func check(label,ok):
	if ok:passes.append(label)
	else:failures.append(label);push_error(label)
func clean(seed_value=777):
	var m=Model.new(seed_value);m.state.units.clear();m.state.enemies.clear();return m
func advance(m,seconds):
	for i in range(int(seconds/0.05)):m.tick(0.05)
func _initialize():
	var m=Model.new(7)
	check("single coin currency and 50 carried capacity",not m.state.has("scrap") and m.BAG_MAX==50)
	check("far asymmetric human command camps",m.outpost(-1).x<-7500 and m.outpost(1).x>7500 and m.outpost(-1).x!=-m.outpost(1).x)
	check("rank one hides higher tier construction targets",not m.unlocked(m.building("prison")) and not m.unlocked(m.tool_stall("brute")) and m.targets_for(m.building("den")).is_empty())
	var radius=m.territory_radius();m.hall().level=2
	check("rank two expands territory and opens prison brute production",m.territory_radius()>radius and m.unlocked(m.building("prison")) and m.unlocked(m.tool_stall("brute")) and m.unlocked(m.building("farm")) and not m.unlocked(m.building("mine")))
	m.hall().level=3;check("rank three opens thief mine and den",m.unlocked(m.tool_stall("thief")) and m.unlocked(m.building("mine")) and m.unlocked(m.building("den")))
	m=clean();m.state.gold=48;m.deposit(10);check("overflow goes to hall instead of disappearing",m.state.gold==50 and m.state.vault==8)
	m.deposit(30,true);check("reward overflow keeps exact advertised value",m.state.gold==50 and m.global_data.reserve==30 and m.treasury_gold()==38)
	m.state.gold=0;check("construction cannot remotely spend treasury",m.total_gold()==0 and not m.spend(1) and m.treasury_gold()==38)
	check("manual withdrawal moves five coins out of hall",m.withdraw()==5 and m.state.gold==5 and m.treasury_gold()==33)
	m.state.gold=49;check("withdrawal respects final bag slot",m.withdraw()==1 and m.state.gold==50)
	m=clean();m.state.gold=10;var stall=m.tool_stall("worker");m.state.hero.x=stall.x
	var t=m.find_target();m.contribute(t)
	check("one of two tool coins stays in escrow",m.state.gold==9 and m.state.payment.paid==1 and m.state.tool_stock.worker==0)
	m.contribute(t);check("second coin directly hangs tool without shop or worker job",m.state.tool_stock.worker==1 and m.state.payment.is_empty() and stall.job.is_empty())
	var idle=m.add_unit("idle",stall.x+60);advance(m,2)
	check("idle goblin physically claims stocked tool once",idle.role=="worker" and m.state.tool_stock.worker==0)
	m=clean();m.state.gold=20;m.state.hero.x=1770;var wall=m.find_target();m.contribute(wall);m.contribute(wall);var money=m.wealth();m.state.hero.x=1842;advance(m,0.05)
	check("leaving exactly 72 returns partial money",m.state.payment.is_empty() and m.wealth()==money+2 and m.state.gold==20)
	m.state.hero.x=1770;m.contribute();m.state.gold=50;var before=m.wealth();m.cancel_payment()
	check("refund at capacity deposits surplus into hall without loss",m.state.gold==50 and m.wealth()==before+1)
	m=clean();m.state.gold=3;var u=m.add_unit("worker",m.state.hero.x+18);u.hidden=6;var r=m.whip(u.id)
	check("whip drops exact real hidden gold instead of instant wallet income",r.ok and u.hidden==0 and m.state.gold==3 and m.state.drops[0].amount==6)
	u.lash_cooldown=0;m.whip(u.id);check("empty pockets give temporary action speed",m.efficiency(u)>1.0 and u.whip_boost>0)
	u.whip_boost=0;u.whip_age=5000;check("neglected goblin efficiency bottoms at 80 percent",is_equal_approx(m.efficiency(u),0.8))
	u.lash_heat=0
	for i in range(4):u.lash_cooldown=0;m.whip(u.id)
	check("repeated whipping stuns goblin without killing it",u.stun>0 and u.hp>0 and m.efficiency(u)==0)
	u.hidden=0;var start=u.x;advance(m,2);check("stunned goblin stops work and movement",u.x==start and u.stun>0)
	advance(m,7);check("stunned goblin recovers",u.stun==0)
	m=clean();m.state.time=59.8;advance(m,0.1);check("no new invasion before noon",m.state.wave_day==0)
	advance(m,0.2);check("noon launches daytime invasion",m.state.wave_day==1 and not m.night() and m.state.enemies.size()>0)
	var count=m.state.enemies.size();m.state.time=160;advance(m,0.1);check("night does not create another daily invasion",m.state.enemies.size()==count and m.state.wave_day==1)
	m=clean();m.state.time=190;var foe=m.spawn_enemy("human",1,600);m.state.hero.x=760;advance(m,0.1)
	check("enemy pursues nearby chief at night instead of blindly charging hall",foe.x>600)
	m.state.hero.x=760;var closer=m.add_unit("worker",foe.x-20);var hp=closer.hp;foe.cooldown=0;foe.x=600;advance(m,0.1)
	check("enemy attacks nearest goblin before farther chief",closer.hp<hp and m.state.hero.hp==100)
	m=clean();var guard=m.spawn_enemy("human",1,7800);guard.guard=true;guard.home=7800;m.state.hero.x=7890;m.state.time=190;advance(m,0.1)
	check("camp guard aggro remains active all day and night",guard.x>7800)
	m=clean();var down=m._spawn_downed("human",200,100);check("fresh wounded is not implicitly net trapped",down.mode=="downed" and not down.get("trapped",false))
	var dead=m.spawn_enemy("dwarf",1,500);dead.mode="dead";dead.hp=0;var x=dead.x;advance(m,2);check("dead enemy remains a still corpse",dead.x==x and dead.mode=="dead")
	m=clean();m.hall().level=2;m.building("prison").level=1;m._spawn_downed("human",1600,100);m.add_unit("worker",0);advance(m,50)
	check("one worker captures only after physical travel",m.state.captives.size()==1 and not m.state.units.any(func(a):return a.cargo.get("kind","")=="captive"))
	m=clean();var hunter=m.add_unit("hunter",0);hunter.carry=3;advance(m,0.1);check("hunter income reaches hall treasury rather than nearby chief",m.state.vault==3 and m.state.gold==18)
	m=clean();m.hall().level=2;var farm=m.building("farm");farm.level=1;m.add_unit("worker",farm.x);advance(m,50)
	check("production building makes actual banked coins",m.state.vault>=3)
	m=clean();var wreck=m.building("wreck");wreck.job={"mode":"salvage","left":0,"total":6};m._finish_job(wreck)
	check("salvaging wreck yields only coins",not m.state.has("scrap") and m.state.drops[0].kind=="gold" and m.state.drops[0].amount==12)
	m=clean();m.state.gold=50;m.state.hero.x=0;var gold=m.wealth();var e=m.spawn_enemy("human",1,15);m._hit_hero(e)
	check("chief still takes health damage rather than spending coins",m.state.hero.hp==90 and m.wealth()==gold)
	m.state.enemies.clear();advance(m,1);check("safe hall heals chief",m.state.hero.hp>90)
	m.state.hero.hp=0;advance(m,0.1);check("chief death ends run",m.state.status=="lost")
	m.new_campaign(8);check("free restart restores living chief",m.state.status=="playing" and m.state.hero.hp==100)
	m=clean();m.state.gold=45;m.grant_reward("gold","v7-ad");var funds=m.wealth();check("duplicate receipt never grants twice",not m.grant_reward("gold","v7-ad") and m.wealth()==funds)
	for i in range(10):m.grant_reward("worker","v7-workers-"+str(i))
	check("repeat rewarded workers have no watch count restriction",m.global_data.pending.worker==20)
	var saved=m.snapshot();var restored=Model.new(9);check("JSON roundtrip keeps bank and new world",restored.restore(JSON.parse_string(JSON.stringify(saved))) and restored.wealth()==m.wealth() and restored.state.rules_version==7)
	saved=m.snapshot();saved.state.rules_version=6;saved.state.world_layout=6;saved.state.scrap=11;saved.state.erase("vault");var original_wealth=saved.state.gold+saved.global.reserve
	check("old scrap becomes coins exactly once",restored.restore(saved) and restored.state.vault==11 and restored.wealth()==original_wealth+11 and not restored.state.has("scrap"))
	var again=restored.snapshot();check("migration is idempotent",Model.new(10).restore(again) and restored.state.buildings.size()==again.state.buildings.size())
	saved=m.snapshot();saved.state.rules_version=6;saved.state.world_layout=6
	for b in saved.state.buildings:
		if b.kind=="prison":b.level=1
	check("paid old prison stays visible while free advanced stalls remain gated",restored.restore(saved) and restored.unlocked(restored.building("prison")) and not restored.unlocked(restored.tool_stall("thief")))
	var f=FileAccess.open("res://qa/godot/v7-model-tests.json",FileAccess.WRITE);f.store_string(JSON.stringify({"scope":"V7 headless game rules, not phone or live SDK evidence","passes":passes,"failures":failures},"\t"));f.close();print("MODEL_V7 "+str(passes.size())+" passed, "+str(failures.size())+" failed");quit(0 if failures.is_empty() else 1)
