from pathlib import Path
p=Path('game/scripts/world.gd');s=p.read_text(encoding='utf-8')
s=s.replace('previous["u"+str(u.id)]=float(u.x)','previous[u.id]=float(u.x)').replace('previous["e"+str(e.id)]=float(e.x)','previous[e.id]=float(e.x)')
for name,prefix,varname,end in [('_unit','u','unit_x','_enemy'),('_enemy','e','enemy_x','slot_position')]:
    a=s.index('func '+name+'(');b=s.index('\nfunc '+end+'(',a)
    block=s[a:b]
    old=f'\t{prefix}={prefix}.duplicate();{prefix}.x=render_x("{prefix}"+str({prefix}.id),{prefix}.x)'
    assert old in block
    block=block.replace(old,'\tvar '+varname+'=render_x('+prefix+'.id,'+prefix+'.x)')
    first=block.index('\n',block.index('\tvar '+varname))
    block=block[:first]+block[first:].replace(prefix+'.x',varname)
    s=s[:a]+block+s[b:]
p.write_text(s,encoding='utf-8')

