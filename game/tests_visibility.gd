extends SceneTree
const Motion=preload("res://game/scripts/visual_transitions.gd")
const Purse=preload("res://game/scripts/purse_coins.gd")
var passes=[]
var failures=[]
func check(n,ok):
	if ok:passes.append(n)
	else:failures.append(n);push_error(n)
func draw(m,c,wanted=true,scope="slot",drift=Vector2.ZERO):
	m.advance(0.06);m.begin(c,drift);m.scope(c,scope)
	if wanted:m.submit(c,"coin",{"kind":"rect","rect":Rect2(20,30,8,8),"tint":Color.WHITE})
	return m.finish(c,false)

# 只驱动显示层，检查同一身体换装的渐出、折返和脚点跟随。
func equipment(m,c,variant,x=0.0):
	m.advance(0.05);m.begin(c);m.scope(c,"enemy/1")
	m.submit(c,"body",{"kind":"rect","rect":Rect2(x,20,8,8),"tint":Color.WHITE,"exclusive_variant":variant,"actor_anchor":Vector2(x,28)})
	return m.finish(c,false)
func _initialize():
	var m=Motion.new();var c=Node2D.new();var rows=draw(m,c)
	check("first appearance starts transparent",rows.size()==1 and rows[0].tint.a==0)
	rows=draw(m,c);check("entry has a real intermediate opacity",rows[0].tint.a>0.1 and rows[0].tint.a<0.9)
	for i in range(5):rows=draw(m,c)
	check("entry reaches full opacity",is_equal_approx(rows[0].tint.a,1))
	rows=draw(m,c,false);var leaving=rows[0].tint.a;check("removed hint retains a partial exit snapshot",leaving>0 and leaving<1)
	rows=draw(m,c,true);check("quick reversal resumes instead of resetting",rows[0].tint.a>leaving)
	rows=draw(m,c,false,"new",Vector2(-5,0));check("retiring snapshot follows camera drift",rows.size()==1 and rows[0].matrix.origin.x==-5)
	for i in range(6):rows=draw(m,c,false)
	check("fully faded snapshots are reclaimed",rows.is_empty() and m.snapshot(c).is_empty())
	m.begin(c);m.scope(c,"captive");m.layer(c,20.1);m.submit(c,"body",{"kind":"rect","rect":Rect2(0,0,8,8),"tint":Color.WHITE});m.scope(c,"bars");m.layer(c,20.2);m.submit(c,"bars",{"kind":"rect","rect":Rect2(0,0,8,8),"tint":Color.WHITE});m.finish(c,false)
	m.begin(c);m.scope(c,"bars");m.layer(c,20.2);m.submit(c,"bars",{"kind":"rect","rect":Rect2(0,0,8,8),"tint":Color.WHITE});rows=m.finish(c,false)
	check("fading prisoners remain behind cage bars",rows.back().layer==20.2)
	for i in range(100):draw(m,c,i%2==0,"target"+str(i%3))
	for i in range(8):draw(m,c,false)
	check("repeated transitions do not leak entries",m.snapshot(c).is_empty())
	var gear=Motion.new()
	for i in range(6):equipment(gear,c,"bow")
	var swap=equipment(gear,c,"dagger",10)
	check("equipment change fades old body without a duplicate",swap.size()==1 and swap[0].exclusive_variant=="bow" and swap[0].tint.a>0 and swap[0].tint.a<1)
	check("retiring equipment body follows the current foot anchor",swap[0].rect.position.x==10)
	var before=swap[0].tint.a;swap=equipment(gear,c,"bow",11)
	check("equipment reversal resumes the visible old body",swap.size()==1 and swap[0].exclusive_variant=="bow" and swap[0].tint.a>before)
	for i in range(6):swap=equipment(gear,c,"dagger",12)
	check("replacement starts fading in only after previous body exits",swap.size()==1 and swap[0].exclusive_variant=="dagger" and swap[0].tint.a>0 and swap[0].tint.a<1)
	for i in range(5):swap=equipment(gear,c,"dagger",12)
	check("replacement reaches full opacity with one retained identity",swap.size()==1 and swap[0].tint.a==1 and gear.snapshot(c).size()==1)
	var purse=Purse.new();purse.update(0.05,50);check("purse represents every carried coin",purse.coins.size()==50)
	var xs={};var angles={}
	for token in purse.coins:xs[str(token.x)]=true;angles[str(token.angle)]=true
	check("coins have irregular positions and rotations",xs.size()>40 and angles.size()>40)
	for i in range(30):purse.update(0.05,50)
	check("settled purse coins stay within bag interior",purse.coins.all(func(t):var q=purse.pose(t);return q.x>=15 and q.x<=78 and q.y>=40 and q.y<=73))
	purse.update(0.05,17);check("spending removes exactly the corresponding coins",purse.coins.size()==17)
	purse.update(0.05,-2);check("invalid visual count cannot loop on an empty purse",purse.coins.is_empty())
	var art=preload("res://game/scripts/art_bank.gd").new();c.set_meta("use_normals",true)
	check("only actor texture pairs carry the outline marker",art.sheet_for(c,"actors-ink.png",true).specular_texture.get_image().get_pixel(0,0).r==1 and art.sheet_for(c,"actors-ink.png",false).specular_texture.get_image().get_pixel(0,0).r==0)
	check("unlit foreground is explicitly excluded from actor outline",art.sheet_for(c,art.frames.foreground.sheet).specular_texture.get_image().get_pixel(0,0).r==0)
	c.free();var f=FileAccess.open("res://qa/godot/visibility-model-tests.json",FileAccess.WRITE);f.store_string(JSON.stringify({"scope":"Pure display transition and purse behavior, no business state or actual device claims","passes":passes,"failures":failures},"\t"));f.close();print("VISIBILITY "+str(passes.size())+" passed, "+str(failures.size())+" failed");quit(0 if failures.is_empty() else 1)
