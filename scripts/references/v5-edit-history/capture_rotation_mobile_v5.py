from pathlib import Path
p=Path('scripts/test_godot_mobile_v5.cjs');s=p.read_text(encoding='utf-8')
s=s.replace("check('No DPR2 or safe-area script errors'","await p.setViewportSize({width:390,height:844});await p.waitForTimeout(300);await p.screenshot({path:'qa/interaction-v5/rotate.png'});check('Portrait guard pauses at native DPI',(await state()).paused);check('No DPR2 or safe-area script errors'")
p.write_text(s,encoding='utf-8')

