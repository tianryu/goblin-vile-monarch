class_name MonarchModel
extends RefCounted

const DAY = 240.0
const WORLD_EDGE = 9200.0
const INTERACT_RADIUS = 72.0
const HERO_MAX_HP = 100.0
const REACTION_TIME = 0.4
const RECOVERY_TIME = 1.2
const WHIP_POSE_TIME = 0.48
const CORE_SITES = {"hall":0.0,"den":-2560.0,"prison":620.0,"trader_stop":1860.0,"merchant_gold":-570.0,"merchant_army":870.0,"merchant_mount":-950.0}
const TOOL_SITES = {"worker":-255.0,"hunter":310.0,"brute":1360.0,"thief":-2980.0}
const SIDE_SITES = {"wall":[1770,3480,5060],"tower":[1640,3330,4900],"net":[1960,3660],"rock":[5250],"rally":[1110],"camp":[2260,5640],"wreck":[4390],"chest":[6020],"outpost":[7840],"supply":[7020,7160,7350,7540]}
const WEST_SITES = {"wall":[1550,3220,4820],"tower":[1430,3090,4670],"net":[1790,3410],"rock":[5010],"rally":[1240],"camp":[2350,5870],"wreck":[4110],"chest":[6350],"outpost":[8120],"supply":[7220,7400,7590,7790]}
const BAG_MAX = 50
const ROLE_COSTS = {"worker":2,"hunter":2,"brute":4,"thief":5}
const ROLE_NAMES = {"idle":"流浪哥布林","worker":"工匠","hunter":"猎手","brute":"打手","thief":"盗贼"}
const MOUNTS = {
	"boar":{"name":"獠牙野猪","speed":94.0,"run":155.0,"stamina":100.0},
	"lizard":{"name":"洞穴蜥蜴","speed":100.0,"run":170.0,"stamina":165.0},
	"wolf":{"name":"掠夺座狼","speed":112.0,"run":205.0,"stamina":100.0},
	"bat":{"name":"巨耳蝙蝠","speed":102.0,"run":180.0,"stamina":85.0}
}
const ENEMY_NAMES = {"human":"人类步兵","dwarf":"矮人破城兵","elf":"精灵游侠","siege":"矮人攻城车"}
const SELL_PRICES = {"human":6,"dwarf":10,"elf":8,"siege":12}

var rng = RandomNumberGenerator.new()
var state = {}
var global_data = {}
var input_axis = 0.0
var input_run = false
var pause_reasons = {}
var events = []
var dirty = false
var next_id = 1
var ai_timer = 0.0
var event_sequence=0
var visual_events=[]
var visual_sequence=0
var upgrade_focus_id=0
var active_fronts={-1:false,1:false}

func _init(seed_value = 42):
	rng.seed = seed_value
	global_data = default_global()
	new_campaign(seed_value, false)

func default_global():
	return {"schema":3,"reserve":0,"mounts":["boar"],"boosts":{"wolf":0.0,"bat":0.0},"pending":{"hunter":0,"worker":0},"receipts":[],"settings":{"sound":true,"low_fx":false},"wins":0}

func new_campaign(seed_value=0,refund_unspent=true):
	cancel_payment()
	if refund_unspent and not state.is_empty():global_data.reserve+=int(state.get("ad_in_bag",0))
	if seed_value==0:seed_value=int(Time.get_unix_time_from_system())
	rng.seed=seed_value;next_id=1;visual_events.clear();active_fronts={-1:false,1:false};upgrade_focus_id=0
	state={"schema":3,"rules_version":7,"world_layout":7,"seed":seed_value,"day":1,"time":12.0,"total":0.0,"status":"playing","gold":18,"vault":0,"ad_in_bag":0,"kills":0,"recruited":6,"wave_day":0,"buildings":[],"units":[],"enemies":[],"drops":[],"shots":[],"effects":[],"bodies":[],"captives":[],"flags":{"left":false,"right":false},"trader":{"phase":"away","x":WORLD_EDGE,"until":0.0,"last_day":0,"cargo":[]},"steal_effects":{"left":{},"right":{}},"hero":{"x":-80.0,"face":1,"mount":"boar","stamina":100.0,"fly":0.0,"hurt":0.0,"hp":HERO_MAX_HP,"max_hp":HERO_MAX_HP},"tutorial":1,"loot_total":0,"explored":{"min":-1900.0,"max":1900.0},"pending_rescue":0,"payment":{},"tool_stock":{"worker":0,"hunter":0,"brute":0,"thief":0}}
	pause_reasons.clear();input_axis=0;input_run=false
	_create_map()
	for i in range(2):add_unit("worker",-100+i*40)
	for i in range(3):add_unit("hunter",170+i*42)
	add_unit("idle",-200)
	for side in [-1,1]:
		var x=outpost(side).x
		for i in range(4):
			var e=spawn_enemy(["human","elf","human","dwarf"][i],side,x-side*(90+i*86));e.guard=true;e.home=e.x
	dirty=true

func _create_map():
	_build("hall",CORE_SITES.hall,1,{"hp":320.0,"max_hp":320.0,"requires":1})
	for role in TOOL_SITES:_build("tools",TOOL_SITES[role],1,{"role":role,"requires":1 if role in ["worker","hunter"] else (2 if role=="brute" else 3)})
	for kind in CORE_SITES:
		if kind=="hall":continue
		_build(kind,CORE_SITES[kind],0 if kind in ["den","prison"] else 1,{"requires":3 if kind=="den" else (1 if kind=="merchant_gold" else 2)})
	for side in [-1,1]:
		var sites=WEST_SITES if side<0 else SIDE_SITES
		for kind in ["wall","tower","net","rock"]:
			for i in range(sites[kind].size()):
				var tier=i+1 if kind in ["wall","tower"] else (i+2 if kind=="net" else 3)
				_build(kind,sites[kind][i]*side,0,{"side":side,"hp":0.0,"max_hp":0.0,"charges":0,"requires":mini(tier,3)})
		_build("rally",sites.rally[0]*side,1,{"side":side,"requires":2})
		for x in sites.camp:_build("camp",x*side,1,{"side":side,"stock":3,"refresh":0.0})
		_build("wreck",sites.wreck[0]*side,1,{"side":side})
		_build("chest",sites.chest[0]*side,1,{"side":side})
		_build("outpost",sites.outpost[0]*side,1,{"side":side,"hp":260.0,"max_hp":260.0})
		for i in range(4):_build("supply",sites.supply[i]*side,1,{"side":side,"task":["arrows","wheel","pay","keys"][i],"ready_day":1})
	_build("woodcut",-2080,0,{"requires":2,"staff":0,"work":0.0})
	_build("farm",2500,0,{"requires":2,"staff":0,"work":0.0})
	_build("farm",-3670,0,{"requires":3,"staff":0,"work":0.0})
	_build("mine",-4240,0,{"requires":3,"staff":0,"work":0.0})

func outpost(side):
	for b in state.buildings:
		if b.kind=="outpost" and b.side==side:return b
	return {}

func territory_radius():return [1900.0,3750.0,5500.0][clampi(int(hall().level)-1,0,2)]
func unlocked(b):return b.get("legacy_open",false) or int(b.get("requires",1))<=int(hall().level)

func _id():
	var value = next_id
	next_id += 1
	return value

func _build(kind,x,level,extra = {}):
	var b = {"id":_id(),"kind":kind,"x":float(x),"level":level,"job":{},"side":0,"charges":0}
	b.merge(extra,true)
	state.buildings.append(b)
	return b

func add_unit(role,x):
	var u = {"id":_id(),"role":role,"x":float(x),"face":1,"hp":36.0 if role=="brute" else 18.0,"mode":"idle","target":float(x),"timer":rng.randf_range(0,4),"cooldown":0.0,"hidden":0,"carry":0,"cargo":{},"job_id":0,"side":0,"fear":0.0,"mission":{},"moving":false}
	state.units.append(u)
	u.rank=1
	if role!="idle":promote_unit(u,int(hall().level))
	return u

func promote_unit(u,rank):
	var prior=int(u.get("rank",1));u.rank=clampi(rank,1,3)
	if u.rank>prior:u.hp+=6*(u.rank-prior)

func visual(kind,data={}):
	visual_sequence+=1
	var event=data.duplicate();event.kind=kind;event.serial=visual_sequence
	visual_events.append(event)
	if visual_events.size()>96:visual_events.pop_front()

func building(kind):
	for b in state.buildings:
		if b.kind == kind: return b
	return {}

func by_id(items,ident):
	for item in items:
		if item.id == ident: return item
	return {}

func hall(): return building("hall")
func tool_stall(role):
	for b in state.buildings:
		if b.kind=="tools" and b.get("role","worker")==role:return b
	return {}

func tower_stand_height(level):return 70.0+12.0*maxi(0,int(level)-1)
func phase():return "夜晚" if night() else ("正午" if abs(state.time-60)<15 else "白天")

func night():return state.time>=120

func capacity(): return [20,40,60][clampi(int(hall().level)-1,0,2)]
func prison_capacity(): return [0,3,6,10][clampi(int(building("prison").level),0,3)]
func paused(): return not pause_reasons.is_empty()
func total_gold():return int(state.gold)
func treasury_gold():return int(state.get("vault",0))+int(global_data.reserve)
func wealth():return int(state.gold)+treasury_gold()

func pause(reason,enabled):
	if enabled:
		cancel_payment()
		pause_reasons[reason] = true
	else: pause_reasons.erase(reason)
	input_axis = 0.0
	input_run = false

func notify(message):
	event_sequence+=1
	events.append({"id":event_sequence,"text":message,"at":state.get("total",0.0)})
	if events.size()>8: events.pop_front()

func spend(gold,_unused=0):
	if gold<0 or state.gold<gold:return false
	var normal=int(state.gold)-int(state.ad_in_bag)
	state.ad_in_bag-=maxi(0,int(gold)-normal);state.gold-=int(gold);dirty=true
	return true

func deposit(amount,ad_reward=false):
	amount=maxi(0,int(amount));var n=mini(amount,maxi(0,BAG_MAX-int(state.gold)))
	state.gold+=n
	if ad_reward:state.ad_in_bag+=n;global_data.reserve+=amount-n
	else:state.vault=int(state.get("vault",0))+amount-n
	dirty=true;return n

func bank_income(amount,from_x):
	state.vault+=maxi(0,int(amount));visual("bank_deposit",{"x":float(from_x),"to":hall().x+90,"count":amount});dirty=true

func withdraw():
	var n=mini(5,mini(maxi(0,BAG_MAX-int(state.gold)),treasury_gold()))
	if n<=0:return 0
	var normal=mini(n,int(state.vault));state.vault-=normal
	var ad=n-normal;global_data.reserve-=ad;state.ad_in_bag+=ad;state.gold+=n
	visual("coin_take",{"x":hall().x+90,"to":state.hero.x,"count":n});dirty=true;return n

func _drop(kind,x,amount,extra = {}):
	if amount<=0: return
	for d in state.drops:
		if d.kind==kind and abs(d.x-x)<28 and kind in ["gold","scrap"]:
			d.amount += amount
			return
	var d = {"id":_id(),"kind":kind,"x":float(x),"amount":amount,"age":0.0}
	d.merge(extra,true)
	state.drops.append(d)

func upgrade_info(b):
	var level=int(b.level)
	match b.kind:
		"hall":return {"gold":[16,30][mini(level-1,1)],"max":3,"name":"主厅"}
		"wall":return {"gold":[4,8,14][mini(level,2)],"max":3,"name":"路障"}
		"tower":return {"gold":[6,11][mini(level,1)],"max":2,"name":"箭台"}
		"net":return {"gold":[6,11][mini(level,1)],"max":2,"name":"绊索吊网"}
		"rock":return {"gold":[8,13][mini(level,1)],"max":2,"name":"落石架"}
		"prison":return {"gold":[8,14,24][mini(level,2)],"max":3,"name":"监牢"}
		"den":return {"gold":10,"max":1,"name":"盗贼窝"}
		"farm","woodcut","mine":return {"gold":{"farm":10,"woodcut":8,"mine":16}[b.kind],"max":1,"name":b.kind}
	return {}

func describe_building(b):
	if not unlocked(b):return {}
	var t={"id":"b"+str(b.id),"object_id":b.id,"x":b.x,"kind":b.kind,"mode":"build","cost":0,"icon":"coin","label":b.kind,"disabled":false,"shop":"","scrap":0}
	match b.kind:
		"tools":t.cost=ROLE_COSTS[b.role];t.mode="tool";t.role=b.role
		"merchant_gold":t.mode="ad";t.reward="gold";t.icon="icon_play"
		"merchant_army":t.mode="ad";t.reward="hunter";t.icon="icon_play"
		"merchant_mount":return {}
		"trader_stop":
			t.mode="sell";t.icon="coin";t.x=state.trader.x;t.disabled=not state.trader.phase in ["arriving","staying"] or state.captives.is_empty()
		"camp":t.mode="recruit";t.cost=1;t.disabled=b.stock<=0 or state.units.size()>=capacity()
		"wreck":t.cost=1;t.disabled=b.level<=0
		"chest":t.mode="loot";t.icon="coin";t.disabled=b.level<=0
		"rally":t.mode="rally";t.cost=5;t.side=b.side;t.disabled=state.flags["left" if b.side<0 else "right"]
		"supply","outpost":return {}
		_:
			var info=upgrade_info(b)
			if info.is_empty():return {}
			if not b.job.is_empty():t.disabled=true
			elif b.kind in ["hall","wall"] and b.level>0 and b.hp<b.max_hp:t.cost=2;t.mode="repair"
			elif b.kind in ["net","rock"] and b.level>0 and b.charges<=0:t.cost=2;t.mode="reload"
			elif b.level>=info.max:return {}
			elif b.kind not in ["hall","prison","den","farm","woodcut","mine"] and b.level>=hall().level:t.disabled=true
			else:t.cost=info.gold
	if b.kind=="hall":t.x=b.x-75
	return t

func targets_for(b):
	if not unlocked(b):return []
	var list=[];var standard=describe_building(b)
	if not standard.is_empty() and b.kind!="merchant_army":list.append(standard)
	if b.kind=="hall":list.append({"id":"vault","object_id":b.id,"x":b.x+95,"kind":"hall","mode":"withdraw","cost":0,"icon":"purse","label":"","disabled":treasury_gold()<=0 or state.gold>=BAG_MAX,"shop":"","scrap":0})
	if b.kind=="merchant_army":
		for role in ["worker","hunter"]:list.append({"id":"army_"+role,"object_id":b.id,"x":b.x+(-58 if role=="worker" else 58),"kind":b.kind,"mode":"ad","reward":role,"icon":"icon_play","cost":0,"label":"","disabled":false,"shop":"","scrap":0})
	if b.kind=="merchant_mount":
		for i in range(4):
			var mount=["boar","lizard","wolf","bat"][i];var owned=mount in global_data.mounts
			var offer={"id":"mount_"+mount,"object_id":b.id,"x":b.x-145+i*105,"kind":b.kind,"mode":"equip" if owned else ("lizard" if mount=="lizard" else "ad"),"mount":mount,"reward":mount,"cost":40 if mount=="lizard" and not owned else 0,"icon":"icon_play" if not owned and mount in ["wolf","bat"] else ("coin" if not owned else mount),"disabled":owned and state.hero.mount==mount,"label":"","shop":"","scrap":0}
			if owned and state.hero.mount==mount and mount in ["wolf","bat"]:offer.mode="ad";offer.icon="icon_play";offer.disabled=false
			list.append(offer)
	if b.kind=="den" and b.level>0:
		for i in range(4):
			var task=["arrows","wheel","pay","keys"][i];var side=state.hero.face;var supply={}
			for other in state.buildings:
				if other.kind=="supply" and other.side==side and other.task==task:supply=other
			var known=not supply.is_empty() and supply.x>=state.explored.min and supply.x<=state.explored.max
			list.append({"id":"theft_"+task,"object_id":b.id,"supply_id":supply.get("id",0),"x":b.x-114+i*76,"kind":"den","mode":"theft","cost":3,"icon":"coin","task":task,"disabled":not known or supply.get("assigned",0)>0 or supply.get("ready_day",1)>state.day,"label":"","shop":"","scrap":0})
	return list

func target_by_id(ident):
	for b in state.buildings:
		for t in targets_for(b):
			if t.id==ident:return t
	return {}

func find_target():
	if state.hero.fly>3:return {}
	if not state.payment.is_empty():
		var t=target_by_id(state.payment.target_id)
		if not t.is_empty() and abs(t.x-state.hero.x)<INTERACT_RADIUS:return t
	var best={};var distance=INTERACT_RADIUS
	for b in state.buildings:
		for t in targets_for(b):
			var d=abs(float(t.x)-state.hero.x)+(20 if t.disabled else 0)
			if abs(t.x-state.hero.x)<INTERACT_RADIUS and d<distance:best=t;distance=d
	for u in state.units:
		var d=abs(u.x-state.hero.x)
		if d<60 and d+12<distance:
			best={"id":"u"+str(u.id),"object_id":u.id,"kind":"whip","mode":"whip","cost":0,"x":u.x,"icon":"icon_whip","disabled":u.get("lash_cooldown",0)>0,"label":"","shop":"","scrap":0};distance=d+12
	return best

func find_whip_target():
	var closest={};var distance=60.0
	if state.hero.fly>3:return closest
	for u in state.units:
		var d=abs(u.x-state.hero.x)
		if d<distance:
			distance=d;closest={"id":"u"+str(u.id),"object_id":u.id,"kind":"whip","mode":"whip","cost":0,"x":u.x,"icon":"icon_whip","disabled":u.get("lash_cooldown",0)>0,"label":"","shop":"","scrap":0}
	return closest

func payment_signature(b,t):return str(b.id)+":"+str(b.level)+":"+str(t.get("id",""))+":"+str(t.get("mode",""))

func focus_prison_upgrade():
	var b=building("prison")
	if abs(b.x-state.hero.x)>=INTERACT_RADIUS or b.level>=3 or not b.job.is_empty():return false
	upgrade_focus_id=b.id
	return true

func contribution_target(b,_forced=false):return describe_building(b)

func contribute(target={}):
	if paused() or state.status!="playing":return {"ok":false}
	if target.is_empty():target=find_target()
	if target.is_empty() or target.get("disabled",false) or state.hero.fly>3 or abs(target.x-state.hero.x)>=INTERACT_RADIUS:return {"ok":false}
	if target.get("cost",0)<=0:return act(target)
	var b=by_id(state.buildings,target.object_id);var live=target_by_id(target.id)
	if b.is_empty() or live.is_empty() or live.disabled:return {"ok":false}
	var signature=payment_signature(b,live)
	if not state.payment.is_empty() and state.payment.signature!=signature:cancel_payment()
	if state.gold<1:return {"ok":false}
	if state.payment.is_empty():state.payment={"target_id":live.id,"object_id":b.id,"x":live.x,"signature":signature,"cost":int(live.cost),"scrap":0,"paid":0,"normal_paid":0,"ad_paid":0,"reserve_paid":0}
	var ad=int(state.ad_in_bag);spend(1)
	state.payment.paid+=1;state.payment.ad_paid+=ad-int(state.ad_in_bag);state.payment.normal_paid+=1-(ad-int(state.ad_in_bag))
	visual("coin_pay",{"x":state.hero.x,"to":live.x,"index":state.payment.paid-1,"cost":live.cost,"object_id":b.id})
	var complete=state.payment.paid>=state.payment.cost
	if complete:
		var success=_commit(live,b)
		if not success:cancel_payment();return {"ok":false}
		state.payment={};visual("funded",{"x":live.x,"object_id":b.id,"cost":live.cost})
	dirty=true;return {"ok":true,"payment":true,"completed":complete}

func _commit(t,b):
	match t.mode:
		"tool":state.tool_stock[t.role]+=1
		"recruit":
			if b.stock<=0 or state.units.size()>=capacity():return false
			b.stock-=1;add_unit("idle",b.x);state.recruited+=1
		"lizard":global_data.mounts.append("lizard");equip_mount("lizard")
		"rally":return rally(t.side,true)
		"theft":return start_theft(t.supply_id,true)
		_:return start_build(b,false,true).ok
	return true

func cancel_payment():
	var p=state.get("payment",{})
	if p.is_empty():return 0
	state.payment={}
	global_data.reserve+=int(p.get("reserve_paid",0))
	deposit(int(p.get("normal_paid",0)));deposit(int(p.get("ad_paid",0)),true)
	visual("coin_return",{"x":float(p.x),"to":state.hero.x,"count":int(p.paid)})
	dirty=true;return int(p.paid)

func act(target={}):
	if target.is_empty():target=find_target()
	if paused() or state.status!="playing" or target.is_empty() or target.get("disabled",false) or abs(float(target.x)-state.hero.x)>=INTERACT_RADIUS:return {"ok":false}
	match target.get("mode",""):
		"whip":return whip(target.object_id)
		"withdraw":return {"ok":withdraw()>0,"repeat":true}
		"ad":return {"ok":true,"ad":target.reward,"target":target.id}
		"equip":return {"ok":equip_mount(target.mount)}
		"sell":return {"ok":sell_captives()>0}
		"loot":
			var b=by_id(state.buildings,target.object_id)
			if b.is_empty() or b.level==0:return {"ok":false}
			b.level=0;_drop("gold",b.x,12);dirty=true;return {"ok":true}
	return {"ok":false}

func efficiency(u):
	if u.get("stun",0)>0:return 0.0
	return clampf(1.0-maxf(0,float(u.get("whip_age",0))-60)/900,0.8,1.0)+(0.3 if u.get("whip_boost",0)>0 else 0.0)

func whip(ident):
	var u=by_id(state.units,ident)
	if u.is_empty() or u.get("lash_cooldown",0)>0:return {"ok":false}
	state.hero.whip_pose=WHIP_POSE_TIME
	if absf(u.x-state.hero.x)>0.1:state.hero.face=1 if u.x>state.hero.x else -1
	u.whip_age=0.0;u.lash_cooldown=0.48;u.lash_heat=float(u.get("lash_heat",0))+1
	u.hit_pose=REACTION_TIME
	var amount=int(u.hidden)
	if amount>0:_drop("gold",u.x,amount);u.hidden=0
	else:u.whip_boost=18.0
	if u.lash_heat>=3.5:
		if u.get("stun",0)<=0:u.stun_age=0.0
		u.stun=8.0;u.lash_heat=0.0
	visual("whip",{"x":u.x,"from":state.hero.x,"face":state.hero.face});dirty=true
	return {"ok":true,"repeat":true,"amount":amount}

func start_build(b,_force=false,prepaid=false):
	if not unlocked(b) or not b.job.is_empty():return {"ok":false}
	var t=describe_building(b)
	if t.is_empty() or t.disabled:return {"ok":false}
	var mode="salvage" if b.kind=="wreck" else t.mode
	if mode=="build":mode="upgrade"
	if not prepaid and not spend(t.cost):return {"ok":false}
	var time=6.0 if mode!="upgrade" else 8.0+3*b.level
	b.job={"mode":mode,"left":time,"total":time};dirty=true;return {"ok":true}

func buy_tool(role):
	if not ROLE_COSTS.has(role) or tool_stall(role).is_empty():return false
	if not spend(ROLE_COSTS[role]):notify("金币不足");return false
	state.tool_stock[role]+=1;notify(ROLE_NAMES[role]+"工具已挂在专属摊位，空闲爪牙会来领取");dirty=true
	return true

func buy_lizard():
	if "lizard" in global_data.mounts:return false
	if not spend(40):notify("需要40枚金币");return false
	global_data.mounts.append("lizard");notify("永久获得洞穴蜥蜴");dirty=true
	return true

func equip_mount(name):
	if not name in global_data.mounts:return false
	state.hero.mount=name;state.hero.stamina=minf(state.hero.stamina,MOUNTS[name].stamina);state.hero.fly=0.0;state.hero.exhausted=false;dirty=true
	return true

func grant_reward(kind,receipt):
	if receipt=="" or receipt in global_data.receipts:return false
	if not kind in ["gold","hunter","worker","wolf","bat"]:return false
	global_data.receipts.append(receipt)
	match kind:
		"gold":deposit(30,true);notify("广告奖励 +30金币")
		"hunter","worker":global_data.pending[kind]+=2;notify("已获得2名"+ROLE_NAMES[kind]+"，满员时在候补队列等待")
		"wolf","bat":
			if not kind in global_data.mounts:global_data.mounts.append(kind);notify("永久解锁"+MOUNTS[kind].name)
			else:global_data.boosts[kind]+=300.0;notify("骑乘强化 +5分钟，可继续叠加")
	dirty=true
	return true

func sell_captives(kind="all",_unused=false):
	if not state.trader.phase in ["arriving","staying"]:return 0
	var sold=[];var coins=0
	for c in state.captives:
		if kind=="all" or c.type==kind:sold.append(c);coins+=int(SELL_PRICES.get(c.type,6))
	for c in sold:state.captives.erase(c);state.trader.cargo.append(c.type)
	if coins>0:_drop("gold",state.trader.x,coins);dirty=true
	return sold.size()

func task_name(kind):return {"arrows":"偷箭袋","wheel":"偷车轮","pay":"偷军饷","keys":"偷钥匙"}.get(kind,"偷补给")

func start_theft(ident,prepaid=false):
	var b=by_id(state.buildings,ident)
	if b.is_empty() or b.kind!="supply" or b.ready_day>state.day or b.get("assigned",0)>0:return false
	if b.x<state.explored.min or b.x>state.explored.max:notify("先骑乘侦察这处补给点");return false
	if building("den").level==0:notify("先建造盗贼窝");return false
	var thief={}
	for u in state.units:
		if u.role=="thief" and u.mission.is_empty() and u.cargo.is_empty():thief=u;break
	if thief.is_empty():notify("需要一名空闲盗贼");return false
	if not prepaid and not spend(3):return false
	b.assigned=thief.id
	thief.mission={"building_id":b.id,"stage":"out","kind":b.task,"side":b.side,"work":6.0};thief.mode="mission"
	notify(task_name(b.task)+"开始，接应回程能保护赃物");dirty=true
	return true

func rally(side,prepaid=false):
	var outpost={}
	for b in state.buildings:
		if b.kind=="outpost" and b.side==side:outpost=b
	if outpost.is_empty() or outpost.hp<=0:notify("这侧指挥营已被摧毁");return false
	var party=[];var brutes=0
	# Pick a leader first, even when hunters were recruited earlier.
	for u in state.units:
		if u.role=="brute" and u.mission.is_empty() and u.cargo.is_empty():party.append(u);brutes=1;break
	for u in state.units:
		if u.role in ["brute","hunter"] and u.mission.is_empty() and u.cargo.is_empty() and not u in party:
			party.append(u)
			if u.role=="brute":brutes+=1
			if party.size()>=6:break
	if party.size()<2 or brutes==0:notify("出征至少需要1名打手和1名其他战士");return false
	if not prepaid and not spend(5):return false
	for u in party:u.mission={"stage":"sortie","side":side,"building_id":outpost.id}
	notify(("西" if side<0 else "东")+"侧小队出征，家里记得留守");dirty=true
	return true

func _move(u,to,speed,dt):
	# 放箭短暂站稳并面对目标；不让同一模拟步的回撤覆盖瞄准朝向。
	if u.get("shot_pose",0)>0:u.moving=false;u.face=u.get("attack_face",u.face);return false
	var dx=float(to)-u.x
	u.moving=abs(dx)>2
	if abs(dx)>1:u.face=1 if dx>0 else -1
	u.x=move_toward(float(u.x),float(to),speed*dt)
	return abs(u.x-float(to))<4

func _safe(x,radius=110):
	for e in state.enemies:
		var danger=maxf(float(radius),245.0 if e.type=="elf" and e.ammo>0 else float(radius))
		if e.mode=="active" and abs(e.x-x)<danger:return false
	return true

func _nearest_enemy(x,reach):
	var best={};var distance=reach
	for e in state.enemies:
		if e.mode!="active":continue
		var d=abs(e.x-x)
		if d<distance:best=e;distance=d
	return best

func _front(side):
	var position=hall().x
	for b in state.buildings:
		if b.kind=="wall" and unlocked(b) and b.side==side and b.level>0 and b.hp>0:
			if side<0:position=minf(position,b.x)
			else:position=maxf(position,b.x)
	return position

func _finish_job(b):
	var mode=b.job.mode
	if mode=="salvage":b.level=0;_drop("gold",b.x,12)
	elif mode=="repair":b.hp=b.max_hp
	elif mode=="reload":b.charges=1
	else:
		b.level+=1
		if b.kind=="hall":b.max_hp=320.0+120*b.level;b.hp=b.max_hp
		if b.kind=="hall":
			for u in state.units:
				if u.role!="idle":promote_unit(u,int(b.level))
		if b.kind=="wall":b.max_hp=[0.0,120.0,240.0,410.0][b.level];b.hp=b.max_hp
		if b.kind in ["net","rock"]:b.charges=1
		notify(upgrade_info(b).get("name","设施")+"完成")
	visual("build_complete",{"x":b.x,"object_id":b.id})
	b.job={};dirty=true

func _worker(u,dt):
	if not _safe(u.x,100):u.mode="retreating";_move(u,hall().x,96,dt);return
	if not u.cargo.is_empty():
		var home=building("prison").x if u.cargo.kind=="captive" else hall().x
		if _move(u,home,70,dt):
			if u.cargo.kind=="captive":
				if state.captives.size()<prison_capacity():state.captives.append({"id":_id(),"type":u.cargo.type})
				else:_spawn_downed(u.cargo.type,u.x,25)
			elif u.cargo.kind=="flag":state.flags["left" if u.cargo.side<0 else "right"]=true
			u.cargo={};dirty=true
		return
	if u.carry>0:
		if _move(u,hall().x+60,85,dt):bank_income(u.carry,u.x);u.carry=0
		return
	var job={};var score=INF
	for b in state.buildings:
		if not b.job.is_empty() and _safe(b.x,130):
			var d=abs(b.x-u.x)-(20000 if b.job.mode=="repair" else 0)
			if d<score:job=b;score=d
	if not job.is_empty():
		u.mode="building";u.job_id=job.id
		if _move(u,job.x,90,dt):
			job.job.left-=dt*(1+0.15*(int(u.rank)-1))
			if job.job.left<=0:_finish_job(job)
		return
	var hauling=state.units.filter(func(other):return other.cargo.get("kind","")=="captive").size()
	if prison_capacity()>state.captives.size()+hauling:
		var choice={};var distance=INF
		for e in state.enemies:
			if e.mode=="downed" and abs(e.x-u.x)<distance and abs(e.x-u.x)/86<e.ttl and _safe(e.x):choice=e;distance=abs(e.x-u.x)
		if not choice.is_empty():
			u.mode="hauling"
			if _move(u,choice.x,86,dt):u.cargo={"kind":"captive","type":choice.type};choice.mode="removed";dirty=true
			return
	for d in state.drops:
		if d.kind=="flag" and _safe(d.x):
			if _move(u,d.x,90,dt):u.cargo={"kind":"flag","side":d.side};state.drops.erase(d)
			return
	for b in state.buildings:
		if b.kind in ["net","rock"] and unlocked(b) and b.level>0 and b.charges==0 and b.job.is_empty() and _safe(b.x,180):
			if _move(u,b.x,85,dt):b.charges=1;dirty=true
			return
	for d in state.drops:
		if d.kind=="gold" and abs(d.x-u.x)<1700 and _safe(d.x):
			if _move(u,d.x,82,dt):u.carry+=int(d.amount);state.drops.erase(d)
			return
	for b in state.buildings:
		if not b.kind in ["farm","woodcut","mine"] or b.level<=0 or not unlocked(b):continue
		var staff=by_id(state.units,b.get("staff",0))
		if not staff.is_empty() and staff.id!=u.id:continue
		b.staff=u.id;u.mode="harvesting"
		if _move(u,b.x,84,dt):
			b.work=float(b.get("work",0))+dt
			var period={"farm":12.0,"woodcut":10.0,"mine":15.0}[b.kind]
			if b.work>=period:b.work-=period;u.carry+={"farm":3,"woodcut":2,"mine":5}[b.kind];dirty=true
		return
	u.mode="idle";_move(u,hall().x+float(u.id%5)*22,62,dt)

func _hunter(u,dt):
	u.timer-=dt
	var side=-1 if u.id%2==0 else 1
	if active_fronts.get(side,false):
		var rank=0
		for other in state.units:
			if other.id==u.id:break
			if other.role=="hunter" and other.mission.is_empty() and (-1 if other.id%2==0 else 1)==side:rank+=1
		var home=_front(side)-side*(40+rank*24)
		var tower={}
		for b in state.buildings:
			if b.kind=="tower" and b.side==side and b.level>rank and abs(b.x-_front(side))<180:
				if tower.is_empty() or abs(b.x-_front(side))<abs(tower.x-_front(side)):tower=b
		var bonus=0
		if not tower.is_empty():home=tower.x+float(rank*2-1)*9;bonus=int(tower.level)
		if abs(u.x-home)>30:bonus=0
		if bonus>0:u.on_tower=tower.id
		var foe=_nearest_enemy(u.x,270+bonus*60)
		if not foe.is_empty() and u.cooldown<=0:
			_shoot(u,foe,11.0+bonus*2);u.cooldown=1.15
		if not _safe(u.x,42):home=hall().x;u.fear=1.0
		if _move(u,home,85,dt) and bonus>0 and abs(u.x-tower.x)<30:u.on_tower=tower.id
	else:
		if u.carry>=3:
			if _move(u,hall().x,76,dt):
				bank_income(u.carry,u.x);u.carry=0
		else:
			var forage=hall().x+(-1 if u.id%2==0 else 1)*(180+u.id%4*58)
			_move(u,forage,65,dt)
			if u.timer<=0:
				u.timer=8.0+rng.randf_range(0,3)
				if u.hidden<7 and rng.randf()<0.28:u.hidden+=1
				else:u.carry+=1
		var foe=_nearest_enemy(u.x,250)
		if not foe.is_empty() and u.cooldown<=0:_shoot(u,foe,11.0);u.cooldown=1.15

func _brute(u,dt):
	var enemy=_nearest_enemy(u.x,160)
	var side=-1 if u.id%2==0 else 1
	var home=_front(side)-side*12
	if not enemy.is_empty():
		var friends=0
		for other in state.units:
			if other.role=="brute" and abs(other.x-u.x)<130:friends+=1
		if friends<2 and abs(u.x-_front(side))>70 and u.hp<18:u.fear=1.0;_move(u,home-side*60,90,dt)
		else:
			_approach_melee(u,enemy,75,dt)
			if abs(u.x-enemy.x)<35 and u.cooldown<=0:damage_enemy(enemy,13);u.cooldown=0.95
	else:_move(u,home,72,dt)

# 近战停在接战距离内，避免走进对方中心并一直用走路盖住挥击姿势。
# 只调整站位；伤害、冷却和战利品仍在原有单次攻击分支结算。
func _approach_melee(u,enemy,speed,dt):
	var direction=1 if enemy.x>=u.x else -1
	if abs(u.x-enemy.x)>34:_move(u,enemy.x-direction*32,speed,dt)
	if abs(u.x-enemy.x)<=34:u.moving=false
	u.face=direction

func _shoot(u,e,damage):
	# 保留至实际松弦和短暂回弹，不能让走路在松弦帧之前覆盖射箭。
	u.attack_face=1 if e.x>=u.x else -1;u.face=u.attack_face;u.shot_pose=0.36;u.moving=false
	damage*=1+0.12*(int(u.get("rank",1))-1)
	var tower=by_id(state.buildings,u.get("on_tower",0))
	state.shots.append({"x":u.x,"to":e.x,"left":0.24,"total":0.24,"enemy":false,"lift":tower_stand_height(tower.level) if not tower.is_empty() else 0})
	damage_enemy(e,damage)

func _mission(u,dt):
	var m=u.mission
	if m.stage=="out":
		var b=by_id(state.buildings,m.building_id)
		if b.is_empty():u.mission={};return
		if _move(u,b.x,104,dt):m.stage="work"
	elif m.stage=="work":
		u.moving=false;m.work-=dt*(1+0.15*(int(u.get("rank",1))-1))
		if m.work<=0:
			var b=by_id(state.buildings,m.building_id)
			if not b.is_empty():b.ready_day=state.day+2;b.assigned=0
			m.stage="return";notify(task_name(m.kind)+"到手，撤回部落！")
	elif m.stage=="return":
		if _move(u,hall().x,91,dt):
			var effects=state.steal_effects["left" if m.side<0 else "right"]
			effects[m.kind]=true
			match m.kind:
				"arrows":bank_income(5,u.x)
				"wheel":bank_income(7,u.x)
				"pay":bank_income(15,u.x);notify("偷到军饷 +15金币，部分雇佣兵离营")
				"keys":
					for i in range(2):
						if state.units.size()<capacity():add_unit("idle",hall().x+30+i*20);state.recruited+=1
						else:state.pending_rescue+=1
					notify("两名同族逃回部落")
			u.mission={};dirty=true
	elif m.stage=="sortie":
		var b=by_id(state.buildings,m.building_id)
		if b.is_empty() or b.hp<=0:m.stage="home";return
		var enemy=_nearest_enemy(u.x,260 if u.role=="hunter" else 80)
		if not enemy.is_empty():
			if u.role=="hunter":
				if u.cooldown<=0:_shoot(u,enemy,11);u.cooldown=1.15
			else:
				_approach_melee(u,enemy,83,dt)
				if abs(u.x-enemy.x)<35 and u.cooldown<=0:damage_enemy(enemy,13);u.cooldown=0.95
		else:
			var range_to_camp=175 if u.role=="hunter" else 35
			if abs(u.x-b.x)>range_to_camp:_move(u,b.x-m.side*range_to_camp,85,dt)
			elif u.cooldown<=0:
				u.moving=false;b.hp-=11 if u.role=="hunter" else 15;u.cooldown=1.0
				if b.hp<=0:
					b.hp=0;b.level=0;u.cargo={"kind":"flag","side":m.side,"amount":1};m.stage="flag_home";notify("指挥营倒了，把军旗带回家！");dirty=true
	elif m.stage=="flag_home":
		if _move(u,hall().x,72,dt):state.flags["left" if m.side<0 else "right"]=true;u.cargo={};u.mission={};notify("军旗已运回部落");dirty=true
	elif m.stage=="home":
		if _move(u,hall().x,85,dt):u.mission={}

func spawn_enemy(kind,side,x = 99999.0):
	var hp={"human":28.0,"dwarf":68.0,"elf":25.0,"siege":120.0}[kind]
	var e={"id":_id(),"type":kind,"side":side,"face":-side,"moving":false,"attack_pose":0.0,"x":float((WORLD_EDGE-100)*side if x==99999.0 else x),"hp":hp,"max_hp":hp,"mode":"active","cooldown":rng.randf(),"ttl":80.0,"ammo":6,"looted":false}
	state.enemies.append(e)
	return e

func spawn_wave():
	for side in [-1,1]:
		if outpost(side).hp<=0:continue
		var fx=state.steal_effects["left" if side<0 else "right"]
		var count=2+mini(state.day,7)
		if fx.get("pay",false):count=maxi(1,count-2)
		var staging=maxf(3900,abs(_front(side))+900)*side
		for i in range(count):
			var kind="human"
			if state.day>=2 and i%4==3:kind="elf"
			if state.day>=3 and i%5==4:kind="dwarf"
			var e=spawn_enemy(kind,side,staging+i*side*62)
			if kind=="elf" and fx.get("arrows",false):e.ammo=2
		if state.day>=5 and not fx.get("wheel",false):spawn_enemy("siege",side,staging+side*240)
		fx.clear()
	state.wave_day=state.day;visual("invasion",{"x":state.hero.x})

func _spawn_downed(kind,x,ttl=80):
	var e=spawn_enemy(kind,1,x);e.mode="downed";e.hp=0;e.ttl=ttl;e.looted=true
	return e

func damage_enemy(e,amount):
	if e.mode!="active":return
	if e.type=="dwarf":amount*=0.8
	e.hp-=amount;visual("hit",{"x":e.x,"heavy":amount>=25})
	if e.hp>0:return
	state.kills+=1
	if not e.looted:e.looted=true;_drop("gold",e.x,3 if e.type!="siege" else 8)
	if e.type!="siege" and rng.randf()<0.55:e.mode="downed";e.ttl=110.0;e.trapped=false
	else:e.mode="dead";e.ttl=105.0
	dirty=true

func _enemy(e,dt):
	# 显示朝向跟随当前目标和真实移动，出生阵营只决定撤离方向。
	e.moving=false
	e.attack_pose=maxf(0,float(e.get("attack_pose",0))-dt)
	if e.mode=="removed":return
	if e.mode in ["downed","dead"]:
		e.ttl-=dt
		if e.ttl<=0:e.mode="escaping" if e.mode=="downed" else "removed"
		return
	if e.mode=="escaping":
		e.face=e.side;e.moving=true;e.x+=e.side*100*dt
		if abs(e.x)>WORLD_EDGE:e.mode="removed"
		return
	e.cooldown=maxf(0,e.cooldown-dt)
	var guard=e.get("guard",false)
	if guard and outpost(e.side).hp<=0:e.mode="escaping";return
	# 最后一箭也保留松弦站姿，再换近战武器，避免减弹药的同一帧吞掉出招。
	var release_hold=e.type=="elf" and e.get("attack_kind","")=="shoot" and float(e.get("attack_pose",0))>0.74
	var ranged=e.type=="elf" and (e.ammo>0 or release_hold)
	var reach=225.0 if ranged else (45.0 if e.type=="siege" else 34.0)
	var victim={};var victim_hero=false;var distance=440.0 if guard else 360.0
	if (state.hero.fly<=3 or ranged) and abs(state.hero.x-e.x)<distance:distance=abs(state.hero.x-e.x);victim=state.hero;victim_hero=true
	for u in state.units:
		var d=abs(u.x-e.x)
		if d<distance:distance=d;victim=u;victim_hero=false
	var barrier={};var destination=state.hero.x if hall().hp<=0 else hall().x
	if not victim.is_empty():destination=victim.x
	elif guard:destination=e.home+sin(state.total*0.12+e.id)*55
	for b in state.buildings:
		if b.kind=="wall" and unlocked(b) and b.level>0 and b.hp>0 and (e.x-b.x)*(destination-b.x)<=0:
			if barrier.is_empty() or abs(b.x-e.x)<abs(barrier.x-e.x):barrier=b
	if not barrier.is_empty() and not ranged:destination=barrier.x+signf(e.x-barrier.x)*24
	if abs(destination-e.x)>1:e.face=1 if destination>e.x else -1
	var speed={"human":65.0,"dwarf":53.0,"elf":64.0,"siege":44.0}[e.type]
	# 骑乘首领占据更宽的接触范围，敌兵在坐骑前方接战，避免走进坐骑身体。
	var contact_reach=reach+32.0 if victim_hero and not ranged else reach
	if not victim.is_empty() and distance<=contact_reach and (ranged or barrier.is_empty()):
		if e.cooldown<=0:
			e.attack_pose=1.1;e.attack_kind="shoot" if ranged else "attack";e.attack_face=e.face
			# 射向首领和部下走同一条发箭路径；受伤无敌只免伤，不吞掉箭和弹药。
			if ranged:e.ammo-=1;state.shots.append({"x":e.x,"to":victim.x,"left":0.3,"total":0.3,"enemy":true,"target_hero":victim_hero,"target_fly":state.hero.fly if victim_hero else 0.0})
			if victim_hero:_hit_hero(e)
			else:
				_hurt_unit(victim,9 if e.type!="siege" else 16)
			e.cooldown=1.1
	elif abs(e.x-destination)>27:e.moving=true;e.x=move_toward(e.x,destination,speed*dt)
	elif e.cooldown<=0 and not guard:
		if not barrier.is_empty():
			barrier.hp=maxf(0,barrier.hp-(18 if e.type in ["dwarf","siege"] else 7));e.attack_pose=1.1;e.attack_kind="attack";e.attack_face=e.face
		elif victim.is_empty() and hall().hp>0:
			hall().hp=maxf(0,hall().hp-(18 if e.type in ["dwarf","siege"] else 7));e.attack_pose=1.1;e.attack_kind="attack";e.attack_face=e.face
		e.cooldown=1.1
	for b in state.buildings:
		if not unlocked(b) or b.level<=0 or b.charges<=0 or abs(b.x-e.x)>24:continue
		if b.kind=="net" and e.type!="siege":
			b.charges=0
			if e.type=="dwarf" and b.level<2:damage_enemy(e,15)
			else:e.mode="downed";e.ttl=100.0;e.trapped=true
			break
		if b.kind=="rock":
			b.charges=0
			for other in state.enemies:
				if other.mode=="active" and abs(other.x-b.x)<100:damage_enemy(other,35+18*(b.level-1))
			break
	if building("prison").level>0 and not state.captives.is_empty() and abs(e.x-building("prison").x)<40 and e.cooldown<=0:
		var freed=state.captives.pop_back();var escape=spawn_enemy(freed.type,e.side,e.x);escape.mode="escaping";e.cooldown=1.0

func _garrison(e,dt):_enemy(e,dt)

# 受击与显示计时只在真实命中时提交一次，动画播放不能再次扣血。
func _hurt_unit(unit,amount):
	unit.hp-=amount
	if unit.hp>0:unit.hit_pose=REACTION_TIME

func _hit_hero(e):
	var p=state.hero
	if p.hurt>0:return
	cancel_payment()
	p.hurt=1.3
	p.hp=maxf(0,p.hp-float({"human":10,"elf":8,"dwarf":14,"siege":20}.get(e.type,10)))
	dirty=true

func _trader(dt):
	var t=state.trader
	if t.phase=="away" and state.day%2==0 and t.last_day!=state.day:
		t.phase="arriving";t.x=WORLD_EDGE;t.last_day=state.day;t.cargo=[];notify("人类奴隶商人赶着囚车来了")
	elif t.phase=="arriving":
		t.x=move_toward(t.x,CORE_SITES.trader_stop,170*dt)
		if t.x==CORE_SITES.trader_stop:t.phase="staying";t.until=state.total+110;notify("商人已到部落，趁现在交易")
	elif t.phase=="staying" and state.total>=t.until:t.phase="leaving";notify("商人准备离开，下次偶数日再来")
	elif t.phase=="leaving":
		t.x+=170*dt
		if t.x>WORLD_EDGE:t.phase="away"

func tick(dt):
	if paused() or state.status!="playing":return
	dt=clampf(dt,0,0.1);state.total+=dt;state.time+=dt
	if state.time>=DAY:state.time-=DAY;state.day+=1;dirty=true
	if state.time>=60 and state.wave_day!=state.day:spawn_wave()
	var p=state.hero;var mount=MOUNTS[p.mount];p.hurt=maxf(0,p.hurt-dt)
	p.whip_pose=maxf(0,float(p.get("whip_pose",0))-dt) if absf(input_axis)<=0.1 else 0.0
	if not input_run:p.exhausted=false
	if p.stamina<=0.5:p.exhausted=true
	var running=input_run and not p.get("exhausted",false) and p.stamina>0.5 and abs(input_axis)>0.1
	var boosted=p.mount in ["wolf","bat"] and global_data.boosts.get(p.mount,0)>0
	var speed=mount.run if running else mount.speed
	if boosted and p.mount=="wolf" and running:speed*=1.35
	var velocity=move_toward(float(p.get("velocity",0)),input_axis*speed,1100*dt) if abs(input_axis)>0.1 else 0.0
	p.velocity=velocity;p.x=clampf(p.x+velocity*dt,-WORLD_EDGE+25,WORLD_EDGE-25)
	if abs(velocity)>6:p.face=1 if velocity>0 else -1;dirty=true
	state.explored.min=minf(state.explored.min,p.x-250);state.explored.max=maxf(state.explored.max,p.x+250)
	if p.mount=="bat" and input_run and not p.get("exhausted",false) and p.stamina>0.5:p.fly=move_toward(p.fly,44,90*dt);running=true
	else:p.fly=move_toward(p.fly,0,100*dt)
	if not state.payment.is_empty():
		var live=target_by_id(state.payment.get("target_id",""))
		if live.is_empty() or live.disabled or abs(p.x-state.payment.x)>=INTERACT_RADIUS or p.fly>3:cancel_payment()
	if running and not boosted:p.stamina=maxf(0,p.stamina-22*dt)
	elif not running:p.stamina=minf(mount.stamina,p.stamina+16*dt)
	if boosted:global_data.boosts[p.mount]=maxf(0,global_data.boosts[p.mount]-dt)
	if p.hp<HERO_MAX_HP and p.hp>0 and hall().hp>0 and abs(p.x-hall().x)<110 and _safe(p.x,180):p.hp=minf(HERO_MAX_HP,p.hp+8*dt);dirty=true
	for d in state.drops.duplicate():
		d.age+=dt
		if d.kind=="gold" and abs(d.x-p.x)<31:
			deposit(d.amount);state.loot_total+=int(d.amount);visual("pickup",{"x":d.x,"to":p.x});state.drops.erase(d)
	active_fronts={-1:false,1:false}
	for e in state.enemies:
		if e.mode=="active" and not e.get("guard",false):active_fronts[int(e.side)]=true
	for u in state.units.duplicate():
		if u.get("stun",0)>0:u.stun_age=float(u.get("stun_age",0))+dt
		u.whip_age=float(u.get("whip_age",0))+dt;u.whip_boost=maxf(0,float(u.get("whip_boost",0))-dt);u.stun=maxf(0,float(u.get("stun",0))-dt);u.lash_heat=maxf(0,float(u.get("lash_heat",0))-dt/8);u.lash_cooldown=maxf(0,float(u.get("lash_cooldown",0))-dt)
		u.cooldown=maxf(0,u.cooldown-dt*maxf(0.8,efficiency(u)));u.fear=maxf(0,u.fear-dt);u.moving=false;u.on_tower=0
		u.shot_pose=maxf(0,float(u.get("shot_pose",0))-dt)
		u.hit_pose=maxf(0,float(u.get("hit_pose",0))-dt)
		if u.hp<=0:
			# 已经被抽倒的活口死亡时延续倒地进度，不能重新站起再摔一次。
			var fall_age=float(u.get("stun_age",0)) if u.get("stun",0)>0 else 0.0
			_drop("gold",u.x,int(u.hidden)+int(u.carry));state.bodies.append({"id":u.id,"role":u.role,"rank":u.rank,"x":u.x,"face":u.face,"ttl":70.0,"fallen_age":fall_age})
			if not u.cargo.is_empty():
				if u.cargo.kind=="flag":_drop("flag",u.x,1,{"side":u.cargo.side})
				elif u.cargo.kind=="captive":_spawn_downed(u.cargo.type,u.x,50)
			if not u.mission.is_empty():
				var source=by_id(state.buildings,u.mission.get("building_id",0))
				if not source.is_empty() and source.get("assigned",0)==u.id:source.assigned=0
			state.units.erase(u);dirty=true;continue
		# 短暂站稳再恢复行动，避免受击姿势脚底不动而整个人滑行。
		if u.stun>0 or u.hit_pose>0:continue
		var work_dt=dt*efficiency(u)
		if not u.mission.is_empty():_mission(u,work_dt)
		elif u.role=="worker":_worker(u,work_dt)
		elif u.role=="hunter":_hunter(u,work_dt)
		elif u.role=="brute":_brute(u,work_dt)
		elif u.role=="idle":
			var available="";var distance=INF
			for role in TOOL_SITES:
				var stall=tool_stall(role)
				if unlocked(stall) and state.tool_stock[role]>0 and abs(stall.x-u.x)<distance:available=role;distance=abs(stall.x-u.x)
			if available!="":
				if _move(u,tool_stall(available).x,75,work_dt):state.tool_stock[available]-=1;u.role=available;u.hp=36.0 if available=="brute" else 18.0;u.rank=1;promote_unit(u,int(hall().level));dirty=true
			else:_move(u,hall().x+120+u.id%7*18,50,work_dt)
		else:_move(u,building("den").x+35+u.id%3*16,62,work_dt)
	for e in state.enemies.duplicate():_enemy(e,dt)
	state.enemies=state.enemies.filter(func(e):return e.mode!="removed")
	for body in state.bodies:body.ttl-=dt;body.fallen_age=float(body.get("fallen_age",0))+dt
	state.bodies=state.bodies.filter(func(body):return body.ttl>0)
	for shot in state.shots:shot.left-=dt
	state.shots=state.shots.filter(func(shot):return shot.left>0)
	for b in state.buildings:
		if b.kind=="camp":
			b.refresh+=dt
			if b.refresh>65:b.refresh=0;b.stock=mini(3,b.stock+1)
	for role in ["worker","hunter"]:
		while global_data.pending[role]>0 and state.units.size()<capacity():global_data.pending[role]-=1;add_unit(role,hall().x+40);state.recruited+=1;dirty=true
	while state.pending_rescue>0 and state.units.size()<capacity():state.pending_rescue-=1;add_unit("idle",hall().x+50);state.recruited+=1;dirty=true
	_trader(dt)
	if p.hp<=0:state.status="lost";state.loss_reason="首领阵亡";dirty=true
	elif state.flags.left and state.flags.right:state.status="won";global_data.wins+=1;dirty=true
	if state.status!="playing":cancel_payment()

func snapshot():
	return {"state":state.duplicate(true),"global":global_data.duplicate(true),"next_id":next_id,"rng_state":str(rng.state)}

func restore(data):
	if not data is Dictionary or not data.has("state") or not data.has("global"):return false
	var incoming=data.state
	if not incoming is Dictionary or not data.global is Dictionary or int(incoming.get("schema",0))!=3:return false
	for key in ["hero","flags","trader","steal_effects"]:
		if not incoming.get(key) is Dictionary:return false
	for key in ["buildings","units","enemies","drops","shots","captives"]:
		if not incoming.get(key) is Array:return false
	for key in ["seed","day","time","gold","total"]:
		if not typeof(incoming.get(key)) in [TYPE_INT,TYPE_FLOAT]:return false
	if not MOUNTS.has(incoming.hero.get("mount","")) or not incoming.hero.has("x"):return false
	if not incoming.hero.has_all(["face","stamina","fly","hurt"]):return false
	if not incoming.trader.has_all(["phase","x","until","last_day"]):return false
	if incoming.hero.has("hp") and (not typeof(incoming.hero.hp) in [TYPE_INT,TYPE_FLOAT] or not is_finite(float(incoming.hero.hp))):return false
	for b in incoming.buildings:
		if not b is Dictionary or not b.has_all(["id","kind","x","level","job"]):return false
		if not b.job is Dictionary:return false
		if not b.job.is_empty() and not b.job.has_all(["left","total","mode"]):return false
	for u in incoming.units:
		if not u is Dictionary or not u.has_all(["id","role","x","hp","hidden","mission","cargo"]):return false
		if not ROLE_NAMES.has(u.role):return false
		if not u.has_all(["face","mode","timer","cooldown","carry","job_id","fear"]):return false
		if not u.mission is Dictionary or not u.cargo is Dictionary:return false
		if not u.mission.is_empty() and not u.mission.has_all(["stage","building_id"]):return false
	for e in incoming.enemies:
		if not e is Dictionary or not e.has_all(["id","type","side","x","hp","max_hp","mode","cooldown","ttl","ammo","looted"]):return false
		if not ENEMY_NAMES.has(e.type) or e.get("guard",false) and not e.has("home"):return false
	for d in incoming.drops:
		if not d is Dictionary or not d.has_all(["id","kind","x","amount","age"]):return false
	for shot in incoming.shots:
		if not shot is Dictionary or not shot.has_all(["x","to","left","total"]):return false
	if not incoming.buildings.any(func(b):return b.kind=="hall") or not incoming.buildings.any(func(b):return b.kind=="prison"):return false
	for key in ["mounts","receipts"]:
		if data.global.has(key) and not data.global[key] is Array:return false
	for key in ["boosts","pending","settings"]:
		if data.global.has(key) and not data.global[key] is Dictionary:return false
	var pending_payment=incoming.get("payment",{})
	if not pending_payment is Dictionary:return false
	if not pending_payment.is_empty():
		if not pending_payment.has_all(["object_id","x","signature","cost","scrap","paid","normal_paid","ad_paid","reserve_paid"]):return false
		for key in ["cost","scrap","paid","normal_paid","ad_paid","reserve_paid"]:
			if not typeof(pending_payment[key]) in [TYPE_INT,TYPE_FLOAT] or float(pending_payment[key])<0 or float(pending_payment[key])!=int(pending_payment[key]):return false
		if int(pending_payment.paid)<0 or int(pending_payment.paid)>int(pending_payment.cost):return false
		if int(pending_payment.normal_paid)+int(pending_payment.ad_paid)+int(pending_payment.reserve_paid)!=int(pending_payment.paid):return false
	state=incoming.duplicate(true);global_data=default_global();global_data.merge(data.global,true)
	if not state.get("payment") is Dictionary:state.payment={}
	for section in ["boosts","pending","settings"]:
		var defaults=default_global()[section];defaults.merge(global_data[section],true);global_data[section]=defaults
	if not state.trader.get("cargo") is Array:state.trader.cargo=[]
	if not state.has("explored"):state.explored={"min":-720.0,"max":720.0}
	state.pending_rescue=int(state.get("pending_rescue",0))+int(global_data.pending.get("idle",0));global_data.pending.erase("idle")
	if not state.get("tool_stock") is Dictionary:state.tool_stock={}
	for role in ["worker","hunter","brute","thief"]:state.tool_stock[role]=maxi(0,int(state.tool_stock.get(role,0)))
	for role in ["worker","hunter"]:global_data.pending[role]=maxi(0,int(global_data.pending.get(role,0)))
	if not "boar" in global_data.mounts:global_data.mounts.append("boar")
	# JSON numbers are doubles. Normalize integer counters and IDs once on load.
	for key in ["seed","day","gold","ad_in_bag","kills","recruited","wave_day","tutorial","loot_total"]:
		state[key]=int(state.get(key,0))
	for u in state.units:
		u.rank=clampi(int(u.get("rank",1)),1,3)
		if u.role!="idle":promote_unit(u,int(hall().level))
		for key in ["id","face","hidden","carry","job_id","side"]:u[key]=int(u.get(key,0))
	for b in state.buildings:
		for key in ["id","level","side","charges"]:b[key]=int(b.get(key,0))
		for key in ["stock","ready_day"]:
			if b.has(key):b[key]=int(b[key])
	for e in state.enemies:
		for key in ["id","side","ammo"]:e[key]=int(e.get(key,0))
	for d in state.drops:
		for key in ["id","amount"]:d[key]=int(d.get(key,0))
	for key in ["reserve","wins"]:global_data[key]=int(global_data.get(key,0))
	for key in global_data.pending:global_data.pending[key]=int(global_data.pending[key])
	next_id=int(data.get("next_id",10000));rng.seed=int(state.seed);rng.state=int(data.get("rng_state",rng.state))
	cancel_payment()
	_migrate_v7()
	pause_reasons.clear();input_axis=0;input_run=false;dirty=false
	return true

func _migrate_v7():
	state.hero.hp=clampf(float(state.hero.get("hp",HERO_MAX_HP)),0,HERO_MAX_HP);state.hero.max_hp=HERO_MAX_HP
	state.erase("crown")
	for e in state.enemies:e.erase("crown")
	state.vault=maxi(0,int(state.get("vault",0)))
	if not state.get("bodies") is Array:state.bodies=[]
	if int(state.get("rules_version",0))<7:
		state.vault+=maxi(0,int(state.get("scrap",0)));state.erase("scrap")
		for d in state.drops:
			if d.kind=="scrap":d.kind="gold"
		var saved=state.buildings.duplicate(true);var old_hall=hall().x
		for collection in [state.buildings,state.units,state.enemies,state.drops]:
			for item in collection:next_id=maxi(next_id,int(item.get("id",0))+1)
		state.buildings=[];_create_map()
		var used={}
		for b in state.buildings:
			for old in saved:
				if used.has(old.id) or old.kind!=b.kind:continue
				if b.kind=="tools" and old.get("role","worker")!=b.role:continue
				if old.get("side",0)!=b.get("side",0):continue
				var x=b.x;var required=b.get("requires",1);b.merge(old,true);b.x=x;b.requires=required
				if b.kind in ["den","prison","wall","tower","net","rock","farm","woodcut","mine"] and (b.level>0 or not b.job.is_empty()):b.legacy_open=true
				used[old.id]=true;break
		for u in state.units:u.x=clampf(u.x-old_hall,-WORLD_EDGE+100,WORLD_EDGE-100)
		state.hero.x=clampf(state.hero.x-old_hall,-WORLD_EDGE+100,WORLD_EDGE-100)
		for e in state.enemies:
			if e.get("guard",false):e.home=outpost(e.side).x-e.side*(90+e.id%4*86);e.x=e.home
		if state.trader.phase=="staying":state.trader.x=CORE_SITES.trader_stop
		state.time=fposmod(float(state.time)/180.0*DAY,DAY);state.world_layout=7
	state.erase("scrap");state.rules_version=7
	if state.gold>BAG_MAX:
		var ad_over=mini(int(state.ad_in_bag),int(state.gold)-BAG_MAX);global_data.reserve+=ad_over;state.ad_in_bag-=ad_over;state.vault+=int(state.gold)-BAG_MAX-ad_over;state.gold=BAG_MAX

func stats():
	return {"day":state.day,"time":state.time,"phase":phase(),"gold":state.gold,"vault":treasury_gold(),"reserve":global_data.reserve,"population":state.units.size(),"capacity":capacity(),"captives":state.captives.size(),"prison_capacity":prison_capacity(),"enemies":state.enemies.size(),"status":state.status,"kills":state.kills,"hero_x":state.hero.x,"hero_hp":state.hero.hp,"hero_max_hp":HERO_MAX_HP,"territory":territory_radius(),"flags":state.flags.duplicate()}

