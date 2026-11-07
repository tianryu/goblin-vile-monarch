from pathlib import Path
import html,json,shutil
ROOT=Path(__file__).resolve().parents[1]
out=ROOT/'art/design/flat-v3';out.mkdir(parents=True,exist_ok=True)
groups=[('人物',['monarch','worker','hunter','brute','thief','idle','human','dwarf','elf','trader','captives']),('坐骑',['boar','lizard','wolf','bat']),('建筑和设施',['hall','stall-final','prison_back1','prison_front1','prison_back','prison_front','prison_back3','prison_front3','wall','tower','net_trap','rock_trap','outpost','wagon-square']),('场景独立图层',['sky_base','celestial','far','middle','land','water','foreground']),('道具',['loot','torch'])]
names={'monarch':'哥布林君主','worker':'工匠','hunter':'猎手','brute':'打手','thief':'盗贼','idle':'空闲爪牙','human':'人类步兵 重做版','dwarf':'矮人破城兵','elf':'精灵游侠','trader':'人类商人','captives':'联军俘虏','boar':'野猪','lizard':'蜥蜴','wolf':'座狼','bat':'蝙蝠','hall':'大厅三级形态','stall-final':'商人摊位','prison_back':'监牢后部','prison_front':'监牢前栏','wall':'路障三级形态','tower':'箭台','net_trap':'捕网架','rock_trap':'落石架','outpost':'联军指挥营','wagon-square':'独立车身 不含车轮','sky_base':'可变色天空底图','celestial':'太阳 月亮 云','far':'远景','middle':'中景森林','land':'独立陆地','water':'独立水面','foreground':'前景草丛','loot':'独立道具图集','torch':'静态火把'}
names.update({'prison_back1':'一级木笼 后部','prison_front1':'一级木笼 前栏','prison_back3':'三级石牢 后部','prison_front3':'三级石牢 前栏'})
parts=['''<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>君主 新手绘美术</title><style>*{box-sizing:border-box}body{margin:0;background:#25372f;color:#e9e3cb;font:16px/1.7 system-ui,"Microsoft YaHei",sans-serif}main{max-width:1280px;margin:auto;padding:26px}h1{margin:0;font-size:28px}p{color:#c6cbb9}a{color:#e6bc73}nav{display:flex;gap:24px;flex-wrap:wrap}section{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:16px}figure{margin:0;background:#617264;border:1px solid #7b8b76;border-radius:8px;overflow:hidden}figure img{width:100%;height:220px;object-fit:contain;image-rendering:auto;display:block;padding:14px}figcaption{background:#34473b;padding:10px 14px}.wide{grid-column:1/-1}.wide img{height:auto;max-height:420px}.runtime{width:100%;height:auto;display:block;border:1px solid #72816b}h2{margin-top:32px}small{color:#c6cbb9}footer{margin:36px 0;color:#bec7b5}</style><main><h1>我是哥布林：君主</h1><p>最新美术标准：整套非像素平面手绘卡通。人物、坐骑、建筑、道具和场景使用同一组参考。下方是独立生成的静态素材，历史像素版本和带光晕的候选不再接入。</p><nav><a href="http://127.0.0.1:42819/" target="_blank">打开Godot试玩</a><a href="../../../docs/GAME_DESIGN.md">完整设计记录</a><a href="../reboot-v1/index-legacy.html">查看历史设计</a></nav><h2>Godot运行检查图</h2><p>浏览器真实渲染的测试布置，用于检查独立图层、监牢遮挡和单人拖运；并非自然通关截图，也不代表90%视觉验收通过。</p><img class="runtime" src="../../../qa/godot/runtime-prison.png" alt="Godot监牢场景检查截图">''']
for title,items in groups:
    parts.append('<h2>'+title+'</h2><section>')
    for name in items:
        if not (ROOT/f'game/art/source/flat-v3/{name}.png').exists():continue
        wide=' class="wide"' if name in ['hall','wall','prison_back','prison_front','sky_base','far','middle','land','water','foreground','loot','captives','celestial'] else ''
        path='../../../game/art/source/flat-v3/'+name+'.png'
        parts.append(f'<figure{wide}><a href="{path}" target="_blank"><img src="{path}" alt="{names[name]}" loading="lazy"></a><figcaption>{names[name]}</figcaption></figure>')
    parts.append('</section>')
parts.append('<footer>静态贴图版本，帧动画后续制作。水面与陆地分开，天空、太阳、云可独立移动和变色。每张源图与提示词、来源记录保存在工程中。</footer></main></html>')
(out/'index.html').write_text(''.join(parts).replace('http://127.0.0.1:42819/','http://127.0.0.1:42820/'),encoding='utf-8')
old=ROOT/'art/design/reboot-v1/index.html';archive=old.with_name('index-legacy.html')
if not archive.exists():shutil.copy2(old,archive)
old.write_text('<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta http-equiv="refresh" content="0;url=../flat-v3/index.html"><title>新手绘美术</title><a href="../flat-v3/index.html">查看当前统一手绘美术</a><p><a href="index-legacy.html">历史设计记录</a></p></html>',encoding='utf-8')
print('Art review generated')
