from pathlib import Path
p=Path('scripts/prepare_godot_assets.py');s=p.read_text(encoding='utf-8')
a=s.index("text=''.join(");b=s.index("icon=Image.open",a)
s=s[:a]+'# The active renamed WenKai subset is produced by prepare_v5_assets only.\n'+s[b:]
p.write_text(s,encoding='utf-8')
p=Path('game/scripts/world.gd');s=p.read_text(encoding='utf-8')
a=s.index('\t\tvar next=int(b.level)+1;var tint=');b=s.index('\n\tvar paid=',a)
s=s[:a]+'''\t\tif not ("修复" in target.label or "补充" in target.label):ghost_key=_ghost_building(b,int(b.level)+1,Color(0.96,0.98,0.80,0.48+0.035*sin(elapsed*2.6)))'''+s[b:]
s=s.replace('\tif reflecting:return\n\tif not b.job.is_empty():','\tif reflecting:return\n\tif not b.job.is_empty():\n\t\tif b.job.mode=="upgrade":_ghost_building(b,int(b.level)+1,Color(light.r,light.g,light.b,0.38))')
idx=s.index('\nfunc _push_effect')
helper='''
func _ghost_building(b,next,tint):
	var key="";var h=65.0
	if b.kind=="hall":key="hall"+str(mini(3,next));h=94
	elif b.kind=="wall":key="wall"+str(mini(3,next));h=37+mini(3,next)*8
	elif b.kind=="tower":key="tower"+("2" if next>=2 else "");h=74 if next>=2 else 67
	elif b.kind=="prison":key="prison_back"+("" if next==2 else str(mini(3,next)));h=72
	elif b.kind=="den":key="hall1";h=48
	elif b.kind in ["net","rock"]:key=("net_trap" if b.kind=="net" else "rock_trap")+("2" if next>=2 else "");h=54
	if key!="":
		var width=170.0+float(next-1)*20 if b.kind=="prison" else 0.0
		sprite(key,b.x,ground,h,1,tint,width)
		if b.kind=="prison":sprite(key.replace("back","front"),b.x,ground,h,1,tint,width)
	return key
'''
s=s[:idx]+helper+s[idx:];p.write_text(s,encoding='utf-8')

