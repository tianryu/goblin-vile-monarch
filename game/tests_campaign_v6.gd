extends SceneTree
# A normal test player: invest in defense, keep reserves at home and heal when hurt.

const Model=preload("res://game/scripts/model.gd")
var m
var destination={}
var history=[]
var decisions=0
var recruits_role="hunter"
var payment_cooldown=0.0

func count_role(role):
	return m.state.units.filter(func(u):return u.role==role).size()

func choose():
	var gold=m.total_gold()
	if m.state.hero.hp<75:return {"kind":"heal","x":m.hall().x}
	# Maintain both defensive lines before spending on expansion.
	for b in m.state.buildings:
		if b.kind=="wall" and abs(b.x)==m.SIDE_SITES.wall[0]:
			if b.level==0 and b.job.is_empty() and gold>=4:return {"kind":"build","id":b.id,"x":b.x}
			if b.level>0 and b.hp<b.max_hp*0.6 and b.job.is_empty() and gold>=2:return {"kind":"build","id":b.id,"x":b.x}
			if b.level<m.hall().level and b.job.is_empty() and gold>=m.upgrade_info(b).gold and m.state.scrap>=m.upgrade_info(b).scrap:return {"kind":"build","id":b.id,"x":b.x}
	var idle=count_role("idle")
	if idle>0:
		recruits_role="worker" if count_role("worker")<3 else ("brute" if count_role("brute")<3 else ("thief" if count_role("thief")<1 and m.building("den").level>0 else "hunter"))
		if gold>=m.ROLE_COSTS[recruits_role] and m.state.tool_stock[recruits_role]<idle:return {"kind":"tool","x":m.tool_stall(recruits_role).x}
	for kind in ["prison","hall","den"]:
		var b=m.building(kind)
		var level=2 if kind=="hall" else 1
		if b.level<level and b.job.is_empty():
			var info=m.upgrade_info(b)
			if gold>=info.gold and m.state.scrap>=info.scrap:return {"kind":"build","id":b.id,"x":b.x}
			if m.state.scrap<info.scrap and gold>=1:
				for w in m.state.buildings:
					if w.kind=="wreck" and w.level>0 and w.job.is_empty():return {"kind":"build","id":w.id,"x":w.x}
	if m.state.trader.phase=="staying" and m.state.captives.size()>0:return {"kind":"sell","x":m.state.trader.x}
	var expedition=m.state.units.any(func(u):return not u.mission.is_empty() and u.mission.stage in ["sortie","flag_home"])
	if not expedition and count_role("brute")>=2 and count_role("hunter")>=8:
		for side in [-1,1]:
			if not m.state.flags["left" if side<0 else "right"] and gold>=5:return {"kind":"rally","side":side,"x":m.SIDE_SITES.rally[0]*side}
	if m.state.units.size()<min(m.capacity(),18) and gold>=3:
		var best={};var distance=99999.0
		for b in m.state.buildings:
			if b.kind=="camp" and b.stock>0 and abs(b.x-m.state.hero.x)<distance:best=b;distance=abs(b.x-m.state.hero.x)
		if not best.is_empty():return {"kind":"build","id":best.id,"x":best.x}
	for b in m.state.buildings:
		if b.kind in ["tower","net"] and abs(b.x)<1800 and b.level==0 and b.job.is_empty():
			var info=m.upgrade_info(b)
			if gold>=info.gold and m.state.scrap>=info.scrap:return {"kind":"build","id":b.id,"x":b.x}
	# Income is physically collected; the bot never injects money or ad receipts.
	var best={};var distance=99999.0
	for d in m.state.drops:
		if d.kind=="gold" and abs(d.x-m.state.hero.x)<distance:best=d;distance=abs(d.x-m.state.hero.x)
	if not best.is_empty() and m.state.gold<50:return {"kind":"collect","x":best.x}
	return {"kind":"wait","x":m.hall().x}

func _initialize():
	var reports=[]
	for seed_value in [731,123,55]:
		m=Model.new(seed_value);destination={};history=[];decisions=0
		var start=Time.get_ticks_msec()
		for step in range(18000):
			if m.state.status!="playing":break
			if m.state.hero.hp<55 and destination.get("kind","")!="heal":m.cancel_payment();destination={"kind":"heal","x":m.hall().x}
			if destination.get("kind","")=="heal" and m.state.hero.hp>=95:destination={}
			if destination.is_empty() or (step%100==0 and m.state.payment.is_empty() and destination.get("kind","")!="heal"):destination=choose();decisions+=1
			var dx=float(destination.x)-m.state.hero.x
			m.input_axis=signf(dx) if abs(dx)>20 else 0.0;m.input_run=abs(dx)>20
			if abs(dx)<=22:
				match destination.kind:
					"build":
						var b=m.by_id(m.state.buildings,destination.id)
						payment_cooldown-=0.1
						if payment_cooldown<=0:
							var r=m.contribute(m.describe_building(b));payment_cooldown=0.2
							if not r.get("ok",false) or r.get("completed",false):destination={}
					"tool":m.buy_tool(recruits_role)
					"sell":m.sell_captives()
					"rally":m.rally(destination.side)
				if not destination.is_empty() and destination.kind not in ["build","heal"]:destination={}
			m.tick(0.1)
			if step%600==0:history.append(m.stats())
		var roles={}
		for u in m.state.units:roles[u.role]=int(roles.get(u.role,0))+1
		var report={"seed":seed_value,"stats":m.stats(),"roles":roles,"tool_stock":m.state.tool_stock,"last_destination":destination,"hall_hp":m.hall().hp,"runtime_ms":Time.get_ticks_msec()-start,"history":history,"receipts":m.global_data.receipts.size(),"decisions":decisions}
		reports.append(report);print("CAMPAIGN "+str(seed_value)+" "+JSON.stringify(m.stats()))
	var f=FileAccess.open("res://qa/godot/world-v6-campaign-bot.json",FileAccess.WRITE);f.store_string(JSON.stringify({"scope":"Headless Godot model, real economy, one-coin contribution input every 0.2 seconds, no ads or resource injection. Bot is a test player, not browser/phone proof.","runs":reports},"\t"));f.close();quit(0 if reports.all(func(r):return r.stats.status=="won" and r.receipts==0) else 1)
