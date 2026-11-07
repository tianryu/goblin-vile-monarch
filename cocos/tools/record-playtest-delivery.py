from pathlib import Path
import json
ROOT=Path(__file__).resolve().parents[2]
delivery=json.loads((ROOT/'qa/cocos/functional-delivery.json').read_text(encoding='utf8'))
statuses={
'R01':'已实现桌面锚点，视觉精修暂缓',
'R02':'已实现全职业反应和高亮分离，模型通过，动作视觉待修',
'R03':'已实现箱体、金币与取用，金额模型通过，视觉待修',
'R04':'已重排洞内外紧凑工作区，操作体验待用户测试',
'R05':'已修复，四爪牙与付币招募模型通过，浏览器开局通过',
'R06':'已接入职业配色，完整角色精修暂缓',
'R07':'已修复容量顺序和重复搬运，模型通过，场景遮挡待测',
'R08':'已实现洞内主厅和开局小笼，摆放视觉待用户测试',
'R09':'部分实现，职业有区分，无主形象和等级外观待修',
'R10':'已修复，游走与领取工具的模型检查通过',
'R11':'已实现冲锋、撤退和护械速度，体验待测',
'R12':'已接入阵营轮廓，完整视觉验收暂缓',
'R13':'已实现可见猎物与真实狩猎，模型检查通过',
'R14':'已修复，平民快速逃跑模型检查通过',
'N01':'已实现左洞穴单路地图，浏览器入口通过',
'N02':'已实现五营与伤亡撤退；后期夹具胜利通过，普通经济整局尚未通过',
'N03':'已实现三类分期器械；模型部分验证，整局与器械操控待测试',
'N04':'已实现盾兵与法师；正面减箭模型、后期战斗夹具通过',
'N05':'已实现原实体缴获和两工匠征召，名额原子结算模型通过，完整推械流程待测',
'N06':'已实现属性分工、昂贵制造及自动换级，模型检查通过，外观待修',
'N07':'已实现功能等级、施工维修和门槛，独立等级外观待修',
'N08':'已强化为84基础生命的恶霸并可征召，持斧朝向待修',
'N09':'已实现旗帜征召、自动行军和护械，模型部分通过，完整整局待测',
'N10':'新Cocos新局已移除盗贼系统，模型通过；旧Godot和旧档保留未导入',
'N11':'已实现本区完工墙巩固、失守复建与首次奖励去重，模型检查通过'}
p=ROOT/'docs/ISSUE_TRACKER_V9.md';text=p.read_text(encoding='utf8');lines=text.splitlines()
for i,line in enumerate(lines):
 if line.startswith('| '):
  cells=line.split('|');ident=cells[1].strip()
  if ident in statuses:cells[5]=' '+statuses[ident]+' ';lines[i]='|'.join(cells)
text='\n'.join(lines)+'\n'
text=text.replace('下方25项目前仍未完成本轮实现与验收，不能沿用旧Godot验收结论。','下方25项已按当前Cocos实现更新；模型检查、浏览器测试、视觉待修与整局未通过分别记录，不能沿用旧Godot验收结论。')
text=text.replace('当前统计：25项已记录，25项有处理方案或建议，0项完成本轮实现与验收。用户明确修正已更新原方案，不再把它们当成待确认；容量、费用等助手补充建议仍待定。删除偷窃目前只完成设计决定，不代表旧代码已移除。执行时在原行更新并链接证据，不另建一份相冲突的完成清单。','当前统计：25项均已逐项更新实施状态，不把“已有代码”视为全部验收通过。25项模型检查见qa/cocos/model-tests-functional.tap，15项浏览器检查见qa/cocos/playtest/report.json。普通经济完整战役自动策略仍未通过，后期战斗的胜利证据是隔离夹具，不能替代整局通关。角色、建筑美术按用户最新优先级暂缓；恶霸倒持斧子明确未通过，详见PLAYTEST_PRIORITY_20261102.md。')
p.write_text(text,encoding='utf8')
note='''# 当前功能测试交付 2026年11月2日

已建立并运行独立Cocos Creator3.8.8工程。当前本地功能测试入口：http://127.0.0.1:42821/，固定文件在release/cocos-functional-20261102-r2，备份ZIP同名。正式发布目标仍为TapTap小游戏，本地预览不构成平台上传、宿主验收或实体手机测试。

本轮25项模型检查和15项浏览器检查通过。检查包含键盘、双指摇杆与奔跑、逐枚投币及离开退款、工具购买与领取、建造、暂停、自动存档读回、昼间守卫反应、胜负重开；后期战斗使用隔离夹具。修复了UI吞掉摇杆拖动、监牢按数组顺序超额收人、守军无保护冲出墙、器械不会受敌方攻击、旧V9档新增字段等问题。证据qa/cocos/functional-delivery.json和qa/cocos/playtest/report.json。

普通经济完整战役的自动策略尚未通过：后期可能因前线失守、营地复建造成补给/施工路线反复，继续回归，不宣称整局平衡完成。广告未配置，不伪造成功。美术精修暂停，恶霸倒持斧子、各等级形象和建筑外观仍待修。用户当前要先玩功能测试版，再继续人物修复。160项美术检查与修正候选已留档，没有继续生成任务。

以下为此前历史检查点，涉及“未创建Cocos工程”等已被上段覆盖。

'''
for name in ['PROGRESS_HANDOFF.md','COCOS_REFACTOR_WORKLOG_20261102.md']:
 p=ROOT/'docs'/name;p.write_text(note+p.read_text(encoding='utf8'),encoding='utf8')
doc=f'''# Cocos功能试玩版

入口：[本机试玩](http://127.0.0.1:42821/)。固定文件目录release/cocos-functional-20261102-r2，ZIP为release/cocos-functional-20261102-r2.zip，大小{delivery['bytes']}字节，SHA256 {delivery['sha256']}。

电脑A/D或方向键移动，Shift奔跑，E交互，Q鞭打，R征召，Esc暂停。触屏使用左侧水平摇杆和右侧情境图标，可双指同时奔跑和移动。所有游戏内交互继续按靠近、图标和投币执行，无商店对话框。

25项模型检查、15项浏览器检查通过，无脚本或资源错误。浏览器检查覆盖1280x600及844x390触屏视口，属于桌面Edge模拟，不能外推真机帧率。浏览器隔离QA存档不覆盖用户存档，正式测试入口也不覆盖旧Godot键。

普通经济整局自动回归尚未通过；后期胜利结算用战斗夹具验证。前线补员、防线失守与营地重建节奏继续调整。人物与建筑视觉暂缓，持斧方向明确待修，不能把此版本当成最终美术验收版。广告当前不可用，未接入其他应用的ID。本地ZIP不是TapTap上传包，没有发布操作。

问题逐项状态见ISSUE_TRACKER_V9.md，证据见qa/cocos/functional-delivery.json和qa/cocos/playtest/report.json。
'''
(ROOT/'docs/PLAYTEST_DELIVERY_20261102.md').write_text(doc,encoding='utf8')
print('Updated 25 issue statuses, handoff, worklog and functional delivery record')
