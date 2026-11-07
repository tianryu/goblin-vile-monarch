from pathlib import Path
import json,hashlib,shutil,subprocess,sys
ROOT=Path(__file__).resolve().parents[2];D=ROOT/'cocos/art/source';name=sys.argv[1]
spec=json.loads((D/(name+'.pending.json')).read_text(encoding='utf8'))
spec.update(reviewed=True,styleApproved=True,styleRejected=False,review=sys.argv[2],reviewStatus='approved-source-pending-engine')
# 原来源记录在替换前留存，避免把新提示词冒充旧记录。
old=D/(name+'.source.json')
if old.exists():
 archive=D/'variants-style-20261102';archive.mkdir(exist_ok=True)
 shutil.copy2(old,archive/(name+'-'+hashlib.sha256(old.read_bytes()).hexdigest()[:12]+'.source.json'))
old.write_text(json.dumps(spec,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
subprocess.run(['C:/Develop/Library/NVM/nodejs/node.exe',str(ROOT/'cocos/tools/adopt-art.cjs'),name],check=True)
