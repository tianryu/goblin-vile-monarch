"""本地功能测试页处理，不触及TapTap发布目标。"""
from pathlib import Path
import re,sys
ROOT=Path(__file__).resolve().parents[1]
p=ROOT/'build'/(sys.argv[1] if len(sys.argv)>1 else 'functional-preview')/'index.html'
text=p.read_text(encoding='utf8')
text=text.replace('<head>','<head>\n<link rel="icon" href="data:,">',1)
text=re.sub(r'<title>.*?</title>','<title>我是哥布林：君主 功能测试</title>',text)
if 'id="functional-focus"' not in text:
 text=text.replace('</body>','<script id="functional-focus">document.getElementById("GameCanvas").focus();</script>\n</body>')
p.write_text(text,encoding='utf8')
print('Local functional preview shell ready')
