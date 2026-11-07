from pathlib import Path
p=Path('scripts/test_godot_stress_v5.cjs')
s=Path('scripts/test_godot_stress.cjs').read_text(encoding='utf-8')
s=s.replace("viewport:{width:844,height:390}","viewport:{width:844,height:390},deviceScaleFactor:2")
s=s.replace("qa/godot/stress-browser.json","qa/godot/stress-browser-v5.json").replace("qa/godot/stress.png","qa/interaction-v5/stress-dpr2.png")
s=s.replace("Five-minute desktop Edge software WebGL stress, 60 units and 40 durable enemies.","V5 five-minute desktop Edge software WebGL at DPR2, native canvas and 60 friendly units plus 40 durable enemies.")
p.write_text(s,encoding='utf-8')

