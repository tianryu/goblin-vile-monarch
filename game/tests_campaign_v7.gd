extends SceneTree
const Model=preload("res://game/scripts/model.gd")
var m
var destination={}
var role="hunter"
var cooldown=0.0
var running=true
func count(kind):return m.state.units.filter(func(u):return u.role==kind).size()
func job(b):return {"kind":"pay","id":b.id,"x":m.describe_building(b).get("x",b.x)}
func choose():
 var gold=int(m.state.gold)
 if m.state.hero.hp<65:return {"kind":"heal","x":0.0}
 if gold<12 and m.treasury_gold()>0:return {"kind":"withdraw","x":95.0}
 for b in m.state.buildings:
  if b.kind=="wall" and b.get("requires",1)==1:
   if b.job.is_empty() and (b.level==0 or b.hp<b.max_hp*.45) and gold>=m.describe_building(b).get("cost",999):return job(b)
 var idle=count("idle")
 if idle>0:
  role="worker" if count("worker")<3 else ("brute" if count("brute")<2 and m.hall().level>=2 else "hunter")
  if m.state.tool_stock[role]<idle:
   if gold>=m.ROLE_COSTS[role]:return job(m.tool_stall(role))
   if m.treasury_gold()>0:return {"kind":"withdraw","x":95.0}
 var hall=m.hall()
 if hall.level<2 and hall.job.is_empty() and gold>=16:return job(hall)
 if m.hall().level>=2:
  for b in m.state.buildings:
   if b.kind=="wall" and b.get("requires",0)==1 and b.level==1 and b.job.is_empty() and gold>=m.describe_building(b).get("cost",999):return job(b)
 for b in m.state.buildings:
  if b.kind=="tower" and b.get("requires",0)==1 and b.level==0 and b.job.is_empty() and gold>=6:return job(b)
 if m.state.units.size()<18 and gold>=3:
  var nearest={};var distance=INF
  for b in m.state.buildings:
   if b.kind=="camp" and b.stock>0 and abs(b.x-m.state.hero.x)<distance:nearest=b;distance=abs(b.x-m.state.hero.x)
  if not nearest.is_empty():return job(nearest)
 if hall.level==2 and count("hunter")>=8 and hall.job.is_empty() and gold>=30:return job(hall)
 var deployed=m.state.units.any(func(u):return not u.mission.is_empty() and u.mission.stage in ["sortie","flag_home"])
 if not deployed and count("brute")>=2 and count("hunter")>=8:
  for side in [-1,1]:
   if not m.state.flags["left" if side<0 else "right"] and m.outpost(side).hp>0 and gold>=5:
    for b in m.state.buildings:
     if b.kind=="rally" and b.side==side:return job(b)
 if m.state.units.size()>=16 and gold>=12:
  for b in m.state.buildings:
   if b.kind=="prison" and m.unlocked(b) and b.level==0 and b.job.is_empty():return job(b)
 for u in m.state.units:
  if u.hidden>0:return {"kind":"whip","id":u.id,"x":u.x}
 if gold<40 and m.treasury_gold()>0:return {"kind":"withdraw","x":95.0}
 if m.state.trader.phase=="staying" and not m.state.captives.is_empty():return {"kind":"sell","x":m.state.trader.x}
 return {"kind":"wait","x":0.0}

func _initialize():
    var reports=[]
    for seed_value in [731,123,55]:
        m=Model.new(seed_value);destination={};cooldown=0;running=true
        for step in range(36000):
            if m.state.status!="playing":break
            if m.state.hero.hp<40 and destination.get("kind","")!="heal":m.cancel_payment();destination={"kind":"heal","x":0.0}
            if destination.get("kind","")=="heal" and m.state.hero.hp>=95:destination={}
            if destination.is_empty() or (step%100==0 and m.state.payment.is_empty() and destination.kind!="heal"):destination=choose()
            var dx=float(destination.x)-m.state.hero.x
            m.input_axis=signf(dx) if abs(dx)>12 else 0.0
            if m.state.hero.stamina<15:running=false
            elif m.state.hero.stamina>75:running=true
            m.input_run=running and abs(dx)>20
            if abs(dx)<15:
                cooldown-=.1
                if cooldown<=0:
                    cooldown=.22
                    match destination.kind:
                        "pay":
                            var b=m.by_id(m.state.buildings,destination.id);var result=m.contribute(m.describe_building(b))
                            if not result.get("ok",false) or result.get("completed",false):destination={}
                        "withdraw":m.withdraw();destination={}
                        "sell":m.sell_captives();destination={}
                        "whip":
                            var u=m.by_id(m.state.units,destination.id)
                            if not u.is_empty() and abs(u.x-m.state.hero.x)<44:m.whip(u.id)
                            destination={}
            m.tick(.1)
        var roles={}
        for u in m.state.units:roles[u.role]=int(roles.get(u.role,0))+1
        var run={"seed":seed_value,"stats":m.stats(),"roles":roles,"receipts":m.global_data.receipts.size(),"destination":destination};reports.append(run);print("CAMPAIGN_V7 "+JSON.stringify(run))
    var f=FileAccess.open("res://qa/godot/v7-campaigns.json",FileAccess.WRITE);f.store_string(JSON.stringify({"scope":"Headless ordinary economy player using carried coins and physical hall withdrawals, no ads or injected resources","runs":reports},"\t"));f.close();quit(0 if reports.all(func(r):return r.stats.status=="won" and r.receipts==0) else 1)
