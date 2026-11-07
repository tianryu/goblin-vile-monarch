extends SceneTree
const Model=preload("res://game/scripts/model.gd")
var passes=[]
var failures=[]
func check(label,ok):
	if ok:passes.append(label)
	else:failures.append(label);push_error(label)
func fixture():
	var m=Model.new(529);m.state.units.clear();m.state.enemies.clear();m.state.hero.x=-1540;m.state.gold=30;m.state.scrap=30
	return m
func _initialize():
	var m=fixture();var b=m.find_target();var wall=m.by_id(m.state.buildings,b.object_id);var result=m.contribute(b)
	check("first of four coins is real escrow without construction",result.ok and not result.completed and m.state.gold==29 and m.state.scrap==30 and wall.job.is_empty() and m.state.payment.paid==1)
	m.tick(0.1);check("ordinary delay retains partial payment",m.state.payment.paid==1)
	m.contribute(b);m.contribute(b);result=m.contribute(b)
	check("fourth coin commits once and queues worker construction",result.completed and m.state.gold==26 and m.state.payment.is_empty() and wall.job.mode=="upgrade")
	check("stale held target cannot pay a second time",not m.contribute(b).ok and m.state.gold==26)
	m=fixture();m.contribute();m.contribute();var refund=m.cancel_payment()
	check("explicit cancellation refunds exactly two and is idempotent",refund==2 and m.state.gold==30 and m.cancel_payment()==0 and m.state.gold==30)
	m=fixture();m.contribute();m.state.hero.x=-1620;m.tick(0.05)
	check("walking away refunds and clears escrow",m.state.gold==30 and m.state.payment.is_empty())
	m=fixture();m.contribute();m.pause("panel",true)
	check("opening any menu refunds before pause",m.state.gold==30 and m.state.payment.is_empty() and not m.contribute().ok)
	m=fixture();m.contribute();m.state.hero.fly=44;m.tick(0.05)
	check("taking off cancels ground payment",m.state.gold==30 and m.state.payment.is_empty())
	m=fixture();m.contribute();wall=m.by_id(m.state.buildings,m.state.payment.object_id);wall.job={"mode":"upgrade","left":8,"total":8};m.tick(0.05)
	check("external target invalidation cancels safely",m.state.gold==30 and m.state.payment.is_empty())
	m=fixture();m.state.gold=2;m.state.ad_in_bag=1;m.global_data.reserve=3
	for i in range(3):m.contribute()
	check("source ledger tracks bag normal ad and reserve individually",m.state.payment.normal_paid==1 and m.state.payment.ad_paid==1 and m.state.payment.reserve_paid==1)
	m.cancel_payment();check("refund restores original funding sources exactly",m.state.gold==2 and m.state.ad_in_bag==1 and m.global_data.reserve==3)
	m=fixture();m.state.gold=1;m.contribute();result=m.contribute()
	check("insufficient funds preserve prior contribution without phantom progress",not result.ok and m.state.payment.paid==1 and m.state.gold==0)
	m.cancel_payment();check("poor player can recover last coin",m.state.gold==1)
	m=fixture();m.state.hero.x=m.building("prison").x;m.state.scrap=2
	check("missing scrap blocks before taking first coin",not m.contribute().ok and m.state.gold==30 and m.state.payment.is_empty())
	m.state.scrap=30
	for i in range(8):m.contribute()
	check("last coin spends scrap exactly once",m.state.gold==22 and m.state.scrap==27 and m.building("prison").job.mode=="upgrade")
	m=fixture();var p=m.building("prison");p.level=1;m.state.hero.x=p.x
	check("built prison normally opens management",m.contribute().shop=="prison")
	check("upgrade management focuses world coins",m.focus_prison_upgrade() and m.find_target().cost==12 and m.find_target().shop=="")
	for i in range(12):m.contribute()
	check("focused prison upgrades rather than reopens",p.job.mode=="upgrade" and m.state.gold==18 and m.state.scrap==24 and m.upgrade_focus_id==0)
	m=fixture();m.state.hero.x=-1900;var recruits=m.state.recruited;result=m.contribute()
	check("one coin recruitment adds one actual unit exactly",result.completed and m.state.units.size()==1 and m.state.recruited==recruits+1 and m.state.gold==29)
	m=fixture();m.contribute();var saved=m.snapshot();var restored=Model.new(1)
	check("restore validates and refunds uncommitted escrow",restored.restore(saved) and restored.state.gold==30 and restored.state.payment.is_empty())
	saved.state.payment.normal_paid=-1;saved.state.payment.ad_paid=2
	check("negative source entries rejected before refund",not Model.new(1).restore(saved))
	saved=m.snapshot();saved.state.payment.normal_paid=2
	check("mismatched source totals rejected",not Model.new(1).restore(saved))
	m=fixture();m.state.gold=0;m.state.ad_in_bag=0;m.grant_reward("gold","escrow-restart")
	m.contribute();m.contribute();m.new_campaign(5)
	check("restart preserves unused rewarded coins including escrow",m.global_data.reserve==30 and m.state.gold==18)
	m=fixture();var u=m.add_unit("worker",-650);var idle=m.add_unit("idle",-650);var hp=u.hp;m.hall().job={"mode":"upgrade","left":0,"total":11};m._finish_job(m.hall())
	check("hall upgrade gears existing profession and preserves idle base",u.rank==2 and u.hp==hp+6 and idle.rank==1)
	m.promote_unit(u,2);check("reapplying rank does not heal or duplicate stats",u.hp==hp+6)
	var h=m.add_unit("hunter",-650);check("new recruits use current hall gear",h.rank==2 and h.hp==24)
	m.hall().job={"mode":"upgrade","left":0,"total":14};m._finish_job(m.hall())
	check("third hall tier upgrades all professions",u.rank==3 and h.rank==3 and u.hp==hp+12)
	m.state.gold=30;m.buy_tool("thief");idle.x=m.tool_stall("thief").x;m.tick(0.01);check("new profession starts at current gear tier",idle.role=="thief" and idle.rank==3)
	saved=m.snapshot();saved.state.units[0].erase("rank");restored=Model.new(1)
	check("legacy save gains missing hall-linked gear",restored.restore(saved) and restored.state.units[0].rank==3)
	m=fixture();var rng_before=m.rng.state
	for i in range(200):m.visual("funded",{"x":0})
	check("visual events bounded and do not consume gameplay RNG",m.visual_events.size()==96 and m.rng.state==rng_before)
	m=fixture();m.input_axis=1;m.tick(1.0/30)
	check("movement accelerates smoothly rather than teleports",m.state.hero.x>-1540 and m.state.hero.x<-1537)
	m.input_axis=0;m.tick(1.0/30);check("release stops without drifting",m.state.hero.velocity==0)
	var f=FileAccess.open("res://qa/godot/interaction-model-tests.json",FileAccess.WRITE);f.store_string(JSON.stringify({"scope":"New v5 model scenarios. No phone or live SDK claims.","passes":passes,"failures":failures},"\t"));f.close()
	print("INTERACTION_MODEL "+str(passes.size())+" passed, "+str(failures.size())+" failed");quit(0 if failures.is_empty() else 1)

