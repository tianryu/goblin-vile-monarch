from pathlib import Path
p=Path('game/scripts/world.gd');s=p.read_text(encoding='utf-8')
s=s.replace('\tfor d in s.drops:\n','\t_focused_ghost()\n\tfor d in s.drops:\n',1)
s=s.replace('\tslot_count=0;ghost_key=""','\tslot_count=0')
a=s.index('\tvar b=model.by_id(model.state.buildings,target.get("object_id",0))',s.index('func _interaction_preview'))
b=s.index('\n\tvar paid=',a)
ghost=s[a:b];s=s[:a]+s[b:]
idx=s.index('\nfunc _ghost_building')
s=s[:idx]+'''
func _focused_ghost():
	ghost_key=""
	var target=model.find_target()
	if target.is_empty() or target.get("disabled",false) or target.get("cost",0)<=0 or target.get("shop","")!="":return
'''+ghost+'\n'+s[idx:]
p.write_text(s,encoding='utf-8')

