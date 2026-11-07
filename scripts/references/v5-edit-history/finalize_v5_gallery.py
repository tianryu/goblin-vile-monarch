from pathlib import Path
p=Path('art/design/reboot-v1/index.html');s=p.read_text(encoding='utf-8').replace('../polish-v4/index.html','../interaction-v5/index.html');p.write_text(s,encoding='utf-8')
p=Path('art/design/interaction-v5/index.html');s=p.read_text(encoding='utf-8').replace('height:auto;border:','height:auto;max-height:620px;object-fit:contain;border:');p.write_text(s,encoding='utf-8')
p=Path('scripts/write_v5_handoff.py');s=p.read_text(encoding='utf-8').replace("s.index('## 横屏布局重做V5检查点')","s.index('## 横屏布局')")
s=s.replace("s+='\\n## 本轮实现与验收结果", "s=s.split('\\n## 本轮实现与验收结果')[0]\ns+='\\n## 本轮实现与验收结果")
p.write_text(s,encoding='utf-8')

