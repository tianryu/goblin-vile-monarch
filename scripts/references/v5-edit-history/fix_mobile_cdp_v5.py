from pathlib import Path
p=Path('scripts/test_godot_mobile_v5.cjs');s=p.read_text(encoding='utf-8')
s=s.replace("type:'touchEnd',touchPoints:[{x:action.x,y:action.y,id:2}]","type:'touchEnd',touchPoints:[{x:joy.x,y:joy.y,id:1}]")
s=s.replace("await ctx.addInitScript(()=>{const get=","await ctx.addInitScript(()=>{window.__touchLog=[];for(let type of ['touchstart','touchend','touchcancel'])document.addEventListener(type,e=>window.__touchLog.push({type,ids:[...e.changedTouches].map(t=>t.identifier)}),true);const get=")
s=s.replace("await tap('action');s=await state();check('Opening merchant", "report.touch_events=await p.evaluate(()=>window.__touchLog);await tap('action');s=await state();check('Opening merchant")
p.write_text(s,encoding='utf-8')

