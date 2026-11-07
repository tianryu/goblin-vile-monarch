"""Package an existing release export. Does not publish or access TapTap."""
from pathlib import Path
import json,hashlib,zipfile,gzip,re,shutil
ROOT=Path(__file__).resolve().parents[1]
web=ROOT/'build/release-web'
index=web/'index.html'
text=index.read_text(encoding='utf-8')
text=text.replace('<html lang="en">','<html lang="zh-CN">')
text=re.sub(r'\s*<meta name="viewport" content="width=device-width, user-scalable=no, initial-scale=1.0">','',text)
text=text.replace("const missingMsg = 'Error\\nThe following features required to run Godot projects on the Web are missing:\\n';", "const missingMsg = '当前浏览器无法启动游戏，请更新浏览器后重试。\\n';")
text=text.replace("displayFailureNotice(missingMsg + missing.join('\\n'));", "displayFailureNotice(missingMsg);")
text=text.replace('Your browser does not support the canvas tag.','当前浏览器无法显示游戏画面。')
index.write_text(text,encoding='utf-8')
licenses='我是哥布林：君主\n\n本项目位图为独立AI生成并经裁切打包。\n\nGodot Engine MIT License\nSource: https://github.com/godotengine/godot/blob/4.7.2-stable/LICENSE.txt\n\n'
licenses+=(ROOT/'game/licenses/Godot-MIT.txt').read_text(encoding='utf-8')
licenses+='\n\nGoblin Hand UI Medium is a renamed subset of LXGW WenKai Medium.\nSIL Open Font License\nSource: https://github.com/lxgw/LxgwWenKai\n\n'
licenses+=(ROOT/'game/licenses/WenKai-OFL.txt').read_text(encoding='utf-8')
licenses+='\n\nPixelFX MIT License\nSource: https://github.com/patch-gg/pixelfx\n\n'
licenses+=(ROOT/'game/licenses/PixelFX-MIT.txt').read_text(encoding='utf-8')
licenses+='\n\nKenney CC0 Audio\n\n'+(ROOT/'game/licenses/Kenney-CC0.txt').read_text(encoding='utf-8')
(web/'LICENSES.txt').write_text(licenses,encoding='utf-8')
release=ROOT/'release';release.mkdir(exist_ok=True)
package=release/'goblin-monarch-web.zip'
files=[]
with zipfile.ZipFile(package,'w',compression=zipfile.ZIP_DEFLATED,compresslevel=9) as z:
    for p in sorted(web.iterdir()):
        if not p.is_file():continue
        data=p.read_bytes();z.writestr('goblin-monarch/'+p.name,data)
        files.append({'name':p.name,'bytes':len(data),'gzip_bytes':len(gzip.compress(data,compresslevel=9)),'sha256':hashlib.sha256(data).hexdigest()})
report={'scope':'Local release Web export only. No upload, platform submission, live ads or physical phone validation.','single_root_folder':'goblin-monarch','files':files,'raw_bytes':sum(f['bytes'] for f in files),'gzip_sum_bytes':sum(f['gzip_bytes'] for f in files),'zip_bytes':package.stat().st_size,'zip_sha256':hashlib.sha256(package.read_bytes()).hexdigest()}
(ROOT/'qa/godot/release-package.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({k:report[k] for k in ['raw_bytes','gzip_sum_bytes','zip_bytes','zip_sha256']}))
