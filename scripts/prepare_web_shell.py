"""Apply the same generated bitmap skin to the Web boot and error screens."""
from pathlib import Path
import re,shutil,sys,json,struct
root=Path(__file__).resolve().parents[1]
web=root/sys.argv[1];page=web/'index.html';s=page.read_text(encoding='utf-8')
assets=[]
manifest=json.loads((root/'game/art/runtime/manifest.json').read_text(encoding='utf-8'))
revision=manifest.get('revision',5)
for name in ['ui_logo','ui_bar','ui_bar_fill','ui_button','ui_back','sky_base']:
    from PIL import Image
    frame=manifest['frames'][{'ui_button':'ui_button_primary','ui_back':'ui_button'}.get(name,name)] if name!='ui_back' else manifest['frames']['ui_button']
    region=[frame[k] for k in ['x','y','w','h']]
    if name=='sky_base':
        # Pre-render of the normal independently generated scene, used only by the loader.
        # This is not a baked replacement for the live sky or world layers.
        poster=root/('art/design/world-v7/world-base.png' if revision>=7 else 'art/design/interaction-v5/world-base.png')
        shutil.copyfile(poster,web/('boot-'+name+'.png'))
    else:
        with Image.open(root/'game/art/runtime'/frame['sheet']) as bitmap:
            bitmap.crop((region[0],region[1],region[0]+region[2],region[1]+region[3])).save(web/('boot-'+name+'.png'))
    d=(web/('boot-'+name+'.png')).read_bytes();w,h=struct.unpack('>II',d[16:24]);assets.append({'asset':name,'width':w,'height':h,'rgba_bytes':w*h*4})
obsolete=web/'boot-ui_panel.png'
if obsolete.exists():obsolete.unlink()
shutil.copyfile(root/'game/fonts/GoblinHand-game.ttf',web/'boot-font.ttf')
skin='''<style id="goblin-boot-skin">
@font-face{font-family:GoblinBrush;src:url('boot-font.ttf') format('truetype');font-display:swap}
#status{background:#202c26 url('boot-sky_base.png') center/cover no-repeat!important}
#boot-frame{width:100%;height:100%;padding:20px 38px;box-sizing:border-box;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;background:#14241c99}
#status-splash{position:static!important;width:min(38vw,310px)!important;height:auto!important;max-height:52vh;object-fit:contain;margin:0!important;image-rendering:auto!important}
#boot-caption,#status-notice{font-family:GoblinBrush,sans-serif;font-size:21px;color:#f5e9cd;line-height:1.4;text-align:center}
#status-progress{position:static!important;appearance:none;-webkit-appearance:none;display:none;width:75%;height:12px;margin:0;border:0;background:transparent}
#status-progress::-webkit-progress-bar{background:url('boot-ui_bar.png') center/100% 100% no-repeat}
#status-progress::-webkit-progress-value{background:url('boot-ui_bar_fill.png') center/100% 100% no-repeat}
#status-progress::-moz-progress-bar{background:url('boot-ui_bar_fill.png') center/100% 100% no-repeat}
#status-notice{background:none;border:0;border-radius:0;padding:0;margin:0}
#boot-retry{display:none;position:absolute;bottom:max(22px,env(safe-area-inset-bottom));right:max(24px,env(safe-area-inset-right));border:0;background:url('boot-ui_button.png') center/100% 100% no-repeat;color:#f5e9cd;font:22px GoblinBrush,sans-serif;min-height:64px;min-width:220px;padding:8px 24px;cursor:pointer}
:root{--u:1}
#status-splash{position:absolute!important;left:50%;top:calc(46px * var(--u));width:calc(360px * var(--u))!important;height:calc(248px * var(--u))!important;max-height:none;transform:translateX(-50%)}
#boot-caption,#status-notice{position:absolute;left:5%;right:5%;top:calc(302px * var(--u));font-size:clamp(18px,calc(24px * var(--u)),30px)}
#status-progress{position:absolute!important;top:calc(348px * var(--u));left:50%;width:calc(420px * var(--u));height:calc(14px * var(--u));transform:translateX(-50%)}
#boot-retry,#boot-help{position:absolute;bottom:max(calc(22px * var(--u)),env(safe-area-inset-bottom));height:calc(64px * var(--u));min-height:48px;padding:4px 12px;font-size:clamp(18px,calc(22px * var(--u)),28px)}
#boot-retry{right:max(calc(24px * var(--u)),env(safe-area-inset-right));width:calc(220px * var(--u));min-width:180px}
#boot-help{display:none;left:max(calc(24px * var(--u)),env(safe-area-inset-left));width:calc(140px * var(--u));min-width:120px;border:0;background:url('boot-ui_back.png') center/100% 100% no-repeat;color:#f5e9cd;font-family:GoblinBrush,sans-serif;cursor:pointer}
</style>'''
s=s.replace('</head>',skin+'\n</head>')
# Godot 4.7.2 maps both touchend and touchcancel to the release callback.
# Preserve cancellation identifiers before the engine's bubbling listener runs.
input_bridge='''<script id="goblin-input-cancel-bridge">
function sizeGoblinBoot(){document.documentElement.style.setProperty('--u',Math.min(innerWidth/960,innerHeight/480))}sizeGoblinBoot();window.addEventListener('resize',sizeGoblinBoot);
window.GoblinInputCancelled=new Set();
document.addEventListener('touchcancel',event=>{for(const touch of event.changedTouches)window.GoblinInputCancelled.add(touch.identifier)},{capture:true,passive:true});
document.addEventListener('touchstart',event=>{for(const touch of event.changedTouches)window.GoblinInputCancelled.delete(touch.identifier)},{capture:true,passive:true});
</script>'''
s=s.replace('</head>',input_bridge+'\n</head>')
s=re.sub(r'<div id="status">.*?<div id="status-notice"></div>\s*</div>', '''<div id="status"><div id="boot-frame">
<img id="status-splash" src="boot-ui_logo.png" alt="我是哥布林：君主">
<div id="boot-caption">正在召集爪牙</div>
<progress id="status-progress"></progress><div id="status-notice"></div>
<button id="boot-retry" type="button" onclick="location.reload()">重新搭建营地</button>
<button id="boot-help" type="button" onclick="document.getElementById('status-notice').textContent='请检查网络连接，更新浏览器后再重试。'">查看帮助</button>
</div></div>''',s,flags=re.S)
s=s.replace("statusMode = mode;", "statusMode = mode;\n\t\t\tdocument.getElementById('boot-caption').style.display=mode==='notice'?'none':'block';\n\t\t\tdocument.getElementById('boot-retry').style.display=mode==='notice'?'block':'none';\n\t\t\tdocument.getElementById('boot-help').style.display=mode==='notice'?'block':'none';")
s=s.replace('Your browser does not support JavaScript.','请启用JavaScript后进入部落。')
s=s.replace("setStatusNotice(err.message);","setStatusNotice('营地暂时没搭起来，请刷新后重试。');")
s=s.replace("setStatusNotice(err);","setStatusNotice('营地暂时没搭起来，请刷新后重试。');")
s=s.replace("setStatusNotice('An unknown error occurred.');","setStatusNotice('营地暂时没搭起来，请刷新后重试。');")
s=s.replace('<html lang="en">','<html lang="zh-CN">')
if revision>=7:
    s=s.replace('正在召集爪牙','').replace('营地暂时没搭起来，请刷新后重试。','无法启动')
    s=s.replace('重新搭建营地','重试')
    s=s.replace("document.getElementById('boot-help').style.display=mode==='notice'?'block':'none';", "document.getElementById('boot-help').style.display='none';")
    # 先关闭热区，再淡出启动层；移除DOM不能抢在透明度过渡之前。
    s=s.replace('statusOverlay.remove();',"statusOverlay.style.opacity='0';statusOverlay.style.pointerEvents='none';setTimeout(()=>statusOverlay.remove(),220);")
    s=s.replace("statusOverlay.style.visibility = 'visible';", "statusOverlay.style.visibility = 'visible';statusOverlay.dataset.mode=mode;")
    s=s.replace('onclick="location.reload()"','onclick="this.disabled=true;document.getElementById(\'status\').style.opacity=0;setTimeout(()=>location.reload(),180)"')
    motion='''<style id="goblin-visibility-transitions">
@keyframes goblin-appear{from{opacity:0}to{opacity:1}}
#status{transition:opacity 220ms ease;animation:goblin-appear 180ms ease both}
#status[data-mode]{animation-fill-mode:backwards}
#status-progress,#status-notice,#boot-retry{display:block!important;opacity:0;visibility:hidden;transition:opacity 180ms ease,visibility 0s linear 220ms}
#status-progress{pointer-events:none}
#boot-retry{pointer-events:none}
#status[data-mode=progress] #status-progress,#status[data-mode=notice] #status-notice,#status[data-mode=notice] #boot-retry{opacity:1;visibility:visible;transition-delay:0s}
#status[data-mode=notice] #boot-retry{pointer-events:auto}
#boot-help{display:none!important}
</style>'''
    s=s.replace('</head>',motion+'\n</head>')
page.write_text(s,encoding='utf-8')
revision=manifest.get('revision',5)
runtime=json.loads((root/f'qa/godot/v{revision}-asset-audit.json').read_text(encoding='utf-8'))['rgba_bytes']
audit={'scope':'One decoded RGBA copy per runtime and boot PNG. Not process or GPU measurement.','assets':assets,'boot_rgba_bytes':sum(a['rgba_bytes'] for a in assets),'conservative_runtime_plus_boot_rgba_bytes':runtime+sum(a['rgba_bytes'] for a in assets)}
audit['budget_paused_by_user']=revision>=7
(root/'qa/godot/boot-asset-audit.json').write_text(json.dumps(audit,indent=2),encoding='utf-8')
