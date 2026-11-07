extends Control
var game
var font
var content_enabled=true
var purse=preload("res://game/scripts/purse_coins.gd").new()
func _process(delta):
	if game!=null:purse.update(delta,int(game.model.state.gold))
func _ready():font=load("res://game/fonts/GoblinHand-game.ttf")
func number(value,pos,height=21,color=Color("eee4c6"),center=false):
	if font==null:return
	var x=pos.x
	if center:x-=font.get_string_size(value,HORIZONTAL_ALIGNMENT_LEFT,-1,height).x/2
	game.art.text(self,font,value,Vector2(x,pos.y),height,color)
func picture(key,rect,tint=Color.WHITE):game.art.draw(self,key,rect,tint)
func icon(key,center,height,tint=Color.WHITE):game.art.at(self,key,center.x,center.y+height/2,height,false,tint)
func control(key,icon_key,pressed=false,identity=""):
	game.art.scope(self,"hud/control/"+key+("/"+identity if identity!="" else ""));game.art.layer(self,610 if key=="new_campaign" else 450)
	var r=game.rects[key];var tint=Color(0.8,0.74,0.6) if pressed else Color.WHITE
	picture("ui_action_ring",r,tint);icon(icon_key,r.get_center(),r.size.y*0.51,tint)
func roman(n):
	var v=n;var result=""
	for entry in [[100,"C"],[90,"XC"],[50,"L"],[40,"XL"],[10,"X"],[9,"IX"],[5,"V"],[4,"IV"],[1,"I"]]:
		while v>=entry[0]:result+=entry[1];v-=entry[0]
	return result
func _draw():
	if game==null:return
	game.art.begin(self)
	if content_enabled:_draw_content()
	game.art.finish(self)
	# 重开先用完整遮罩交接场景，清理旧快照时画面已经完全遮住。
	if game.scene_veil>0:draw_rect(Rect2(Vector2.ZERO,get_viewport_rect().size),Color(0.07,0.11,0.09,smoothstep(0,1,game.scene_veil)))

func accepts(key):
	var prefix="hud/control/"+key
	if key in ["action","whip"]:
		var target=game.model.find_target() if key=="action" else game.model.find_whip_target()
		if target.is_empty():return false
		prefix+="/"+str(target.id)
	return game.art.transitions.opacity(self,prefix)>0.12

func _draw_content():
	if game==null or game.rects.is_empty():return
	var s=get_viewport_rect().size;var left=24+game.safe.x;var top=game.safe.y;var m=game.model
	game.art.scope(self,"hud/portrait");game.art.layer(self,800)
	if game.portrait:game.art.rectangle(self,"shade",Rect2(Vector2.ZERO,s),Color(0.07,0.13,0.14,0.88));icon("icon_rotate",s/2,150);return
	if game.modal=="result":
		game.art.scope(self,"hud/result");game.art.layer(self,600)
		var panel_size=Vector2(minf(740,s.x-108),minf(350,s.y-150));var panel=Rect2(Vector2(s.x/2,s.y/2-24)-panel_size/2,panel_size)
		game.art.rectangle(self,"shade",Rect2(Vector2.ZERO,s),Color(0.06,0.10,0.09,0.72));picture("ui_panel",panel)
		var won=m.state.status=="won";number("森林归部落" if won else "首领阵亡",Vector2(s.x/2,panel.position.y+64),38,Color("443d2a"),true)
		icon("rider_"+m.state.hero.mount,Vector2(s.x/2-170,s.y/2),115);icon("flag" if won else "heart_icon",Vector2(s.x/2+60,s.y/2-18),45)
		number(roman(m.state.day),Vector2(s.x/2+122,s.y/2-4),30,Color("4f4532"));icon("human",Vector2(s.x/2+65,s.y/2+42),29);number(str(m.state.kills),Vector2(s.x/2+103,s.y/2+52),25,Color("4f4532"));control("new_campaign","icon_restart");return
	game.art.scope(self,"hud/status");game.art.layer(self,400)
	_draw_purse(Vector2(left+2,top+6))
	number(str(int(m.state.gold)),Vector2(left+51,top+92),19,Color("f2dc93"),true)
	icon("heart_icon",Vector2(left+121,top+31),24);number(str(int(ceil(m.state.hero.hp))),Vector2(left+139,top+40),22,Color("f19b80") if m.state.hero.hp<=30 else Color("f0e6cd"))
	icon("idle",Vector2(left+220,top+30),27);number(str(m.state.units.size())+"/"+str(m.capacity()),Vector2(left+241,top+40),21)
	game.art.scope(self,"hud/cycle")
	var dial=Rect2(s.x-game.safe.z-221,top+5,106,106);picture("cycle_dial",dial);var center=dial.get_center();var angle=-PI+float(m.state.time)/m.DAY*TAU
	icon("moon" if m.night() else "sun",center+Vector2(cos(angle),sin(angle))*35,18);number(roman(m.state.day),Vector2(center.x,center.y+11),28,Color("f3dfac"),true)
	_building_caption(s)
	control("pause","icon_play" if m.pause_reasons.has("manual") else "ui_pause_control")
	if m.pause_reasons.has("manual"):control("restart","icon_restart");return
	if game.ad_inflight:control("action","icon_play",true);return
	control("run","icon_run",m.input_run)
	game.art.scope(self,"hud/stamina")
	var r=game.rects.run;var progress=clampf(m.state.hero.stamina/m.MOUNTS[m.state.hero.mount].stamina,0,1)
	picture("ui_bar",Rect2(r.position+Vector2(4,r.size.y+4),Vector2(r.size.x-8,6)));picture("ui_bar_fill",Rect2(r.position+Vector2(6,r.size.y+6),Vector2((r.size.x-12)*progress,2)))
	var target=m.find_target()
	if not m.find_whip_target().is_empty() and target.get("mode","")!="whip":control("whip","icon_whip",false,str(m.find_whip_target().id))
	if not target.is_empty():
		control("action",target.get("icon","coin"),game.action_finger!=-999 or game.key_action_held,str(target.id))
		if Time.get_ticks_msec()<game.feedback_until:game.art.bitmap(self,"feedback",game.world.glow_texture,game.rects.action.grow(8),Color(0.75,0.1,0.05,0.28))

func _draw_purse(origin):
	game.art.scope(self,"hud/purse");game.art.layer(self,400)
	picture("purse",Rect2(origin,Vector2(98,76)),Color(1,1,1,0.20))
	picture("purse_rim",Rect2(origin,Vector2(98,76*0.40)))
	for c in purse.coins:
		if c.age<0:continue
		game.art.scope(self,"hud/purse_coin/"+str(c.id));game.art.layer(self,401)
		game.art.set_transform(self,origin+purse.pose(c),c.angle)
		icon("coin",Vector2.ZERO,8.5)
	game.art.set_transform(self,Vector2.ZERO)
	game.art.scope(self,"hud/purse_film");game.art.layer(self,402)
	picture("purse",Rect2(origin,Vector2(98,76)),Color(1,1,1,0.12))
	game.art.scope(self,"hud/status");game.art.layer(self,403)

# 最新要求仅对靠近的建筑给两行名称与作用，不恢复教程或对话框。
func _building_caption(s):
	if not game.world.interaction_visible:return
	var m=game.model;var target=m.find_target();var b=m.by_id(m.state.buildings,target.get("object_id",0));var distance=72.0
	if b.is_empty():
		for candidate in m.state.buildings:
			if not m.unlocked(candidate) or candidate.kind=="trader_stop" and m.state.trader.phase=="away":continue
			var d=abs(candidate.x-m.state.hero.x)
			if d<distance:b=candidate;distance=d
	if b.is_empty():return
	var labels={"hall":["哥布林主厅","升级拓展领地，存取金币"],"prison":["监牢","关押活口，升级增加容量"],"merchant_gold":["金币商人","看广告，获得30枚金币"],"merchant_army":["援军商人","看广告，召来2名猎手或工匠"],"merchant_mount":["坐骑商人","兑换坐骑，解锁疾跑与低飞"],"den":["盗贼窝","侦察敌营后，派盗贼偷取补给"],"trader_stop":["人类奴隶商人","出售俘虏，换取金币"],"wall":["部落围墙","阻挡联军，为猎手争取时间"],"tower":["箭台","猎手登台，扩大防守射程"],"farm":["蘑菇田","工匠采集，收入运回主厅"],"woodcut":["伐木营","工匠采伐，收入运回主厅"],"mine":["金币矿","工匠开采金币，运回主厅"],"net":["绊索吊网","捕获活口，工匠重新装填"],"rock":["落石架","砸伤成群联军，工匠重新装填"],"camp":["流浪营地","投币招募空闲爪牙"],"wreck":["战场遗物","工匠拆解残骸，搜出金币"],"chest":["遗落宝箱","拾取其中的金币"],"outpost":["联军指挥营","摧毁敌营，将军旗带回部落"],"supply":["联军补给","侦察后可派盗贼前来偷取"],"rally":["出征旗","派遣战士攻打这侧的敌营"]}
	var text=labels.get(b.kind,[])
	if b.kind=="merchant_army" and target.get("reward","") in ["worker","hunter"]:text=["援军商人","看广告，召来2名"+("工匠" if target.reward=="worker" else "猎手")]
	if b.kind=="tools":text={"worker":["工匠摊","投币挂出木槌，爪牙自动领取"],"hunter":["猎手摊","投币挂出弓箭，培养狩猎好手"],"brute":["打手摊","投币挂出战具，培养近战护卫"],"thief":["盗贼摊","投币挂出头巾，培养偷窃好手"]}.get(b.role,[])
	if text.is_empty():return
	game.art.scope(self,"hud/building_caption/"+str(b.id));game.art.layer(self,420)
	picture("ui_tag_v5",Rect2(s.x/2-143,10+game.safe.y,286,78),Color(1,1,1,0.96))
	number(text[0],Vector2(s.x/2,42+game.safe.y),25,Color("f6e2ad"),true)
	var small=15
	while font.get_string_size(text[1],HORIZONTAL_ALIGNMENT_LEFT,-1,small).x>260 and small>12:small-=1
	number(text[1],Vector2(s.x/2,67+game.safe.y),small,Color("ddd1b4"),true)
