"""按本轮真实证据更新问题状态；V11设计与未测项不冒充完成。"""
from pathlib import Path
import json,hashlib
ROOT=Path(__file__).resolve().parents[2]
reports={key:json.loads((ROOT/path).read_text(encoding='utf8')) for key,path in {
 'browser':'qa/cocos/v10-browser/report.json','armor':'qa/cocos/armor-v10/report.json','presentation':'qa/cocos/v10-presentation/report.json','stress':'qa/cocos/v10-stress-model.json'}.items()}
assert reports['browser']['passed']==11 and reports['browser']['failed']==0 and not reports['browser']['errors']
assert len(reports['armor']['checks'])==2 and not reports['armor']['errors']
assert reports['presentation']['passed']==4 and not reports['presentation']['errors']
states={1:'边界浏览器通过，洞口地层接缝待精修',2:'连点浏览器通过，长按边界待补',3:'已实现27像素，待专门掉落场景复核',5:'77像素与八人笼图形检查通过',6:'浏览器通过',7:'浏览器通过，待用户体验',8:'64像素图形检查通过',10:'V10窗口模型通过，V11更慢到访待实施',11:'已实现地面27/头顶23像素，待专门掉落复核',12:'模型通过',13:'模型与钱箱连点通过',14:'模型与浏览器通过',15:'键鼠与合成双指通过，真机未测',16:'缩摊与独立库存图形通过，细部待精修',17:'V10减产与慢施工模型通过，V11再调',18:'迁移模型与营地图形通过',19:'独立装备堆与白边已接入，待用户体验',20:'模型通过',21:'来去及交易模型通过，拉杆与手的衔接待精修',22:'已实现，待专门集结图形复核',23:'模型通过，提示体验待复核',24:'已实现，待各状态图形复核',25:'浏览器通过',26:'鼠标与合成双指浏览器通过',27:'当前行为已确认，通关驻守图形待补',28:'数量守恒模型通过',29:'真实猎手驻塔模型通过，五级配表待V11',30:'模型通过',32:'路标已接入，巩固/失守图形待补，风险说明已记录',33:'数量/营防模型与桌面压力通过，英雄按V11重设计',35:'V11节奏设计已记录，尚未整局验证',36:'营防模型与浏览器渲染通过',37:'10套分件动作已接入，其他角色仍整体贴纸，待继续精修',38:'实际74像素及横屏缩图通过，待用户体验',39:'78像素绿色宽边与受击金边图形检查通过'}
p=ROOT/'docs/PLAYTEST_FEEDBACK_V10_20261102.md';lines=p.read_text(encoding='utf8').splitlines()
for i,line in enumerate(lines):
 if not line.startswith('| '):continue
 fields=line.split('|')
 try:key=int(fields[1].strip().split()[0])
 except (ValueError,IndexError):continue
 if key in states:fields[3]=' '+states[key]+' ';lines[i]='|'.join(fields)
p.write_text('\n'.join(lines)+'\n',encoding='utf8')
sources={str(p.relative_to(ROOT)).replace('\\','/'):hashlib.sha256(p.read_bytes()).hexdigest() for p in (ROOT/'cocos/assets/scripts').rglob('*.ts')}
result={'checkpoint':'V10 functional and art before V11 balance design','modelChecks':41,'browserChecks':11,'armorRenderChecks':2,'presentationChecks':4,'realPhone':False,'TapTapHost':False,'realAds':False,'normalEconomyFullCampaignPassed':False,'fiveLevelBalanceImplemented':False,'V11Design':'docs/BALANCE_GROWTH_V11_20261102.md','preview':'http://127.0.0.1:42823/','oldStablePreviewPreserved':'http://127.0.0.1:42821/','buildLog':'qa/cocos/build-v10-round4.log','sources':sources,'pending':['V11 early pressure, hero schedule, bosses and five-level buildings','cave ground vertical join','trader hand/cart shaft attachment','additional held-pose motion and art review','elf hero zero-ammo ranged branch','normal-campaign, phone and platform acceptance'],'testIncident':'Concurrent browser runs logged resource connection errors; original reports retained. Sequential reruns passed without ignoring errors; underlying cause not proven.'}
(ROOT/'qa/cocos/v10-checkpoint.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
print(json.dumps({key:value for key,value in result.items() if key!='sources'},ensure_ascii=False))
