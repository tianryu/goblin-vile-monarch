"""Write current evidence at the top of historical project documents."""
from pathlib import Path
import json
R=Path(__file__).resolve().parents[1]
def read(p):return json.loads((R/p).read_text(encoding='utf-8-sig'))
a=read('qa/godot/v5-acceptance.json');p=a['package'];st=a['stress'];g=a['graphics_single_copy_bytes_including_boot_and_splash'];art=read('qa/godot/v5-asset-audit.json')
def save(name,text): (R/name).write_text(text,encoding='utf-8')
def prepend(name,heading,body):
    path=R/name;s=path.read_text(encoding='utf-8')
    title,rest=s.split('\n',1)
    if heading in rest:
        begin=rest.index(heading);end=rest.find('\n## ',begin+3)
        rest=rest[:begin]+(rest[end:] if end>=0 else '')
    save(name,title+'\n\n'+heading+'\n\n'+body.strip()+'\n'+rest)
count=a['scenario_assertion_count'];fps=st['frame_interval_ms']
summary=f"""本轮客户端布局与交互整改已完成本地验收。23张逐页布局设计图在art/design/interaction-v5，按同一设计实现的运行截图在qa/interaction-v5。对照页为http://127.0.0.1:42817/art/design/interaction-v5/index.html，正式试玩http://127.0.0.1:42820/，已有页面需要刷新。

现行实现：独立AI纸卡、布幅按钮、底部返回与确认、商品先选择再购买，四页手册、暂停、账本、胜败、启动、错误帮助和竖屏提示。常用按钮落在底部两侧，最短测试横屏740x360上保持至少约48CSS像素触控高度。准确安全区仍需实际手机复核。

投币逐枚实付，可分次轻触或按住。未提交的钱在离开、暂停、后台、失效或取消触摸时按资金来源退款；收齐后才提交废铁与施工。靠近显示对应金币虚影与下一等级建筑虚影，施工虚影在角色后方保留。商店在交互指松开后打开，不穿透购买；Web侧保留touchcancel标识，避免被引擎当成普通松手。

四职业三阶装备随大厅成长；箭台、吊网、落石架第二等级有独立图。角色与坐骑继续用完整静态图，转向以鞍座锚点翻转。世界直接原生绘制，背景循环镜像并裁掉透明范围，水纹理用UV流动、轻微波浪和随时间变化的倒影。短特效采用少量哑光笔触与弧线，借鉴pixelfx的确定性与分阶段时间曲线。角色帧动画仍延后。

本轮{count}项本地断言通过，分组证据见qa/godot/v5-acceptance.json，不能称为真机认证。三条逐枚投币、无广告与无资源注入的逻辑征程全部取得双旗。原模型43项、整改模型35项、新投币/成长32项、原生UI{a['reports']['ui-native-v5-tests']['passes']}项、浏览器99项、DPR2和模拟安全区{a['reports']['mobile-layout-v5-tests']['passes']}项、正式包9项、启动/音频9项。

生产{a['frames']}个部件，{a['texture_sheets']}张纹理。己方新装备统一图集，极限场景绘制批次从约143降至约35。运行、启动页与开场图单份RGBA保守合计{g}字节，约{g/1048576:.2f}MiB，未包含字体、引擎、GPU副本与进程总内存。

最终DPR2桌面Edge软件WebGL持续{st['duration_seconds']}秒压力结果：P50 {fps['p50']:.1f}ms，P95 {fps['p95']:.1f}ms，P99 {fps['p99']:.1f}ms，无脚本错误。该场景为60名己方加约40名高耐久敌人和后续波次。P95不超过40ms的内部压力目标{'达到' if st['software_dpr2_p95_target_met'] else '尚未达到'}，不能引用旧版本18.3ms，也不能据此声称低端手机已达标。报告stress-browser-v5.json保留真实结果；此前优化前报告保留对照。

正式Web目录{p['raw_bytes']}字节，ZIP {p['zip_bytes']}字节，约{p['zip_bytes']/1048576:.2f}MiB。独立Gzip总量{p['gzip_sum_bytes']}字节仅为估算。包路径release/goblin-monarch-web.zip，单根目录goblin-monarch。SHA256：{p['zip_sha256']}。

尚未验证：真实Android/iOS手机、TapTap宿主和真实广告SDK、平台发布身份与独立的90%感知相似度评分。23页设计和运行画面分别保存并人工检查，不伪造视觉百分比。未创建、修改、上传或发布平台应用，未下载付费Runway内容。"""
handoff=R/'docs/PROGRESS_HANDOFF.md';s=handoff.read_text(encoding='utf-8');start=s.index('## 横屏布局');end=s.index('\n## 成品整改检查点',start)
save('docs/PROGRESS_HANDOFF.md',s[:start]+'## 横屏布局与交互V5最终检查点 2026年10月31日\n\n'+summary+'\n\n以下为前版历史记录，不能覆盖本节。\n'+s[end:])
prepend('docs/GAME_DESIGN.md','## 横屏交互V5 现行执行规格 2026年10月31日',"""世界交互保留靠近加底部按键，金币动作改成逐枚投入与真实托管，按住可连续投入，普通松手保留，离开、取消、后台或打开菜单退回。金币虚影数量对应实际费用，建造或升级出现下一等级位图虚影，施工中继续保留。目标名称与废铁显示在交互键上方，投币进度在键下。

所有常用确认键在右下，返回在左下。商品卡仅选中，底部再执行购买、出售、派遣、装备或广告。金币、援军和坐骑仍为三个中央商人，广告自愿、无限、无观看冷却；没有SDK时不发虚假奖励。钱袋栏的加号表示另有储备，商人和账本显示储备数，避免无限储备挤压人口栏。

大厅升级使已有职业与之后分配的职业同步获得二/三阶装备、额外生命与职业效率/远程加成。工匠、猎手、打手、盗贼共八张新增静态装备图；只有君主戴王冠。箭台、吊网和落石架二级使用新外观，已有大厅、路障和监牢各级继续共用相同等级规则。

字体改为OFL许可的霞鹜文楷中等字重子集，修改后家族名Goblin Hand UI。六张新增AI界面素材形成纸卡、选中卡、底板、深色按钮、红色确认和窄资源栏，旧粗重窗框退出当前界面。动态文字仍由字体排版。

用户新增授权：可用程序化非像素特效和现有水纹理动画。环境仍是独立AI分层，不能将启动幕的预渲染静帧用作实时世界。帧动画继续延后。完整逐页稿、实际截图、验收和未验证范围见INTERACTION_REWORK_V5.md。""")
prepend('docs/PERFORMANCE_BUDGET.md','## V5原生画布与当前实测 2026年10月31日',f"""整层480高离屏放大已移除，人物、界面、环境与水均直接在原生2D画布绘制，固定30Hz模拟通过位置插值平滑。背景仅绘制实际有内容的竖向范围，镜头外对象不绘制；新职业统一纹理图集，特效笔触按颜色与阶段合批，短暂事件和粒子分别有上限。水面着色器只采样一次原纹理并乘以顶点调色，避免重复相乘变暗。曾试验的小水面缓存已撤回。

单份运行RGBA {art['rgba_bytes']}字节；加启动副本与128像素开场图保守合计{g}字节，约{g/1048576:.2f}MiB，低于24MiB文件预算。这不是GPU或进程总占用。启动幕仅使用正常AI场景的预渲染图，不替代动态天空、漂云、水和真实物体。

最终DPR2桌面软件WebGL压力{st['duration_seconds']}秒，rAF间隔P50 {fps['p50']:.1f}ms、P95 {fps['p95']:.1f}ms、P99 {fps['p99']:.1f}ms，无运行错误。60名己方、约40名高耐久敌人及追加波次。40ms内部P95目标{'达到' if st['software_dpr2_p95_target_met'] else '未达到'}，保持待改进状态。绘制批次下降不能等同于帧率目标通过；本轮没有用模糊人物或删减玩法来掩盖结果。

真实手机、TapTap宿主、完整Wasm/GPU/进程峰值未测。正式目录约{p['raw_bytes']/1048576:.2f}MiB，ZIP约{p['zip_bytes']/1048576:.2f}MiB，独立Gzip合计约{p['gzip_sum_bytes']/1048576:.2f}MiB只代表本地估算。旧版DPR1测试和18.3ms均是历史，不能直接与本轮DPR2成绩混用。""")
work=R/'docs/INTERACTION_REWORK_V5.md';s=work.read_text(encoding='utf-8')
s=s.replace('本轮任务仍在开发和验收中，上一轮181项是旧版本基线，不能当作本轮验收结果。','本轮客户端布局和交互已完成本地整改，验收与未验证项见下文。上一轮181项是历史基线，不能当作本轮证据。')
s=s.replace('验收待完成：每页最短横屏尺寸、底部安全区、卡片选中与底部确认、金币数量与资源对账、部分投币恢复/退款、错误和取消、低飞与转向、循环背景、水面/倒影动画、三阶外观，以及新版完整征程、压力测试与正式导出。实际手机和TapTap广告仍须真实环境，不作伪造。','')
s=s.split('\n## 本轮实现与验收结果')[0]
s+='\n## 本轮实现与验收结果\n\n'+summary
s+='''

## 自检发现并修复的具体问题

- 菜单控制器的临时实例被释放，卡片回调失效。改为界面持有一个控制器。
- 交互按下时立即开窗，后续鼠标模拟事件会按到购买键。改为对应手指松开后开启，并消费这一手势。
- Godot Web把取消触摸映射为释放，增加捕获阶段的取消标识。双指中另一指松开不打开商店，取消不打开也不扣钱。
- 九宫格进度条的上下切片大于5/7像素控件，产生越界碎片。改为适合细条的切片，并检查最小尺寸。
- 无限广告产生的长储备数字挤压钱袋与人口。钱袋使用简短加号，详情保留在金币商人和账本。
- 页面手册监牢插图过宽。设计原型按240像素包围盒缩放，实机同样约束长宽。
- 底部安全区压缩卡片后，库存和价格发生重叠。先修订布局稿，再让图片随可用高度收缩；名称、两行说明与价格预留独立区域。新增190像素内容区和DPR2下34CSS像素底部安全区复核，覆盖七类商店。
- 错误说明与重试键重叠。启动幕沿用横屏布局比例，说明与底部按键分区，增加可操作的帮助。
- 重新开始会让镜头从旧位置长距离滑过。新征程立即对齐君主。
- 新职业分散纹理导致混编队伍批次增加。八张独立源图合到共享图集，保留源图和出处。
- 字体每次重复导入不稳定。按字符集合缓存字体子集，导出前独立完成引擎导入。

23张布局原型及73张浏览器场景截图分别保存。逐页人工检查覆盖商人、监牢、盗贼、出征、暂停、四页手册、账本、重开、胜败、加载、错误与旋屏。八种坐骑戴冠/失冠状态分别检查两种朝向。受控广告提供方仅用于测试，不随正式包导出。

[Godot CanvasItem着色器文档](https://docs.godotengine.org/en/stable/tutorials/shaders/shader_reference/canvas_item_shader.html)说明片元COLOR包含默认纹理颜色，因此水面使用顶点调色varying，防止再次乘入原纹理。
'''
save('docs/INTERACTION_REWORK_V5.md',s)
run=R/'docs/GODOT_RUN_AND_HANDOFF.md';s=run.read_text(encoding='utf-8').replace('art/design/polish-v4/index.html','art/design/interaction-v5/index.html').replace('game/art/source/polish-v4','game/art/source/polish-v4和game/art/source/interaction-v5').replace('本轮UI/骑乘/玩法修复、迭代截图与证据见FINISHING_PASS.md','本轮逐页布局/投币/原生画布修复、迭代截图与证据见INTERACTION_REWORK_V5.md')
save('docs/GODOT_RUN_AND_HANDOFF.md',s)
print('Updated current design, performance, handoff, acceptance and run documents.')

