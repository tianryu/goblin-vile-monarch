from pathlib import Path
p=Path('scripts/test_godot_mobile_v5.cjs');s=p.read_text(encoding='utf-8')
s=s.replace("(s.viewport[1]-b[1]-b[3])*ratio>=30&&back[0]*ratio>=45","(s.viewport[1]-b[1]-b[3])*ratio>=12+22*ratio-0.75&&back[0]*ratio>=24+24*ratio-0.75")
p.write_text(s,encoding='utf-8')

