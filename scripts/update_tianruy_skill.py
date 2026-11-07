"""Update the user's named local skill, with a recoverable original archive."""
from pathlib import Path
import shutil,zipfile,json,hashlib

base=Path(r'C:/Users/田煜/Desktop/Godot/Games/soushen/outputs/tianryu_game_development_skill_20261031').resolve()
old=base/'tianryu-game-development-standards';new=base/'tianruy-game-development-standards'
if old.exists():
    assert old.resolve().parent==base and new.resolve().parent==base and not new.exists()
    old.rename(new)
assert (new/'SKILL.md').exists()
for p in [new/'SKILL.md',new/'agents/openai.yaml']:
    p.write_text(p.read_text(encoding='utf-8').replace('tianryu','tianruy'),encoding='utf-8')
entry=new/'SKILL.md';text=entry.read_text(encoding='utf-8')
rule='- 全局动效默认：游戏里所有内容的出现和消失都要渐入渐出，包括提示、金币虚影、建筑虚影、按钮、窗口、角色/物件、状态替换和特效。只有用户明确要求某处不做时才例外；呼吸、位移或缩放不能替代显隐渐变。实现及验收见[显隐动画规范](references/visibility-transitions.md)。\n'
if rule not in text:text=text.replace('## 4. 验证范围与证据',rule+'\n## 4. 验证范围与证据')
entry.write_text(text,encoding='utf-8')
(new/'references/visibility-transitions.md').write_text('''# 显隐动画规范

本规范持有者的全局游戏偏好：所有出现和消失的效果默认渐入渐出。只有用户明确要求某处不做时才省略，例外应注明具体对象及依据，不擅自给战斗、触控或性能场景增加例外。

- 覆盖提示、逐枚金币虚影、建筑/升级虚影、建造牌、价格与状态、按钮、窗口、遮罩、旋屏提示、角色和物件生成/移除、贴图状态替换、金币掉落/拾取、特效、环境元素与启动/场景切换。原有呼吸、位移、缩放或帧动画继续保留，但不能代替透明度渐变。
- 相同职责复用统一组件或参数。常规界面可从约120到240毫秒起调，世界对象可从约160到280毫秒起调；短特效按实际生命周期缩短。时间是建议，不是所有项目固定数值。根据屏幕与节奏实际看图、操作验收。
- 快速靠近、离开、折返、切换目标时从当前透明度继续，不能每次归零、闪跳、积累Tween或让上一个目标瞬移到新目标。多个金币按同一目标和独立槽位保持稳定身份。
- 淡出保留足够的显示快照，不能先hide、visible=false、display:none、queue_free或删掉绘制条件，导致淡出根本看不见。完成后及时回收，保持原来的遮挡次序、位置锚点、裁剪和相机关系。
- 视觉过渡不延迟必要的业务校验：目标失效、离开、取消时立刻停用旧热区、扣费或输入；已扣但未提交的款项按游戏规则退款。动画完成不能再次提交、发奖、退款或消耗随机数。
- 暂停和结算仍能完成界面渐变。连续点击、退出重进、旋转、窗口失焦及场景重建不得留下透明但可点击的控件、旧提示或无法恢复的遮罩。整场景可用遮罩交接，清理发生在画面已完全遮住后。
- 按实际显隐入口检查中间帧，而非只看最终截图：入场0到部分到完整，退场完整到部分到0；快速逆转连续；切换目标时旧新各自过渡；淡出热区失效；暂停/结算完成；反复操作后缓存与临时节点回收。图形后端与实际操作分别取证，不能仅用无头测试宣称视觉完成。
''',encoding='utf-8')
# 保留用户提供的原始归档，不修改其他游戏源码。
archive=base/'tianryu游戏开发规范.skill';history=base/'_history';history.mkdir(exist_ok=True)
if archive.exists():
    backup=history/'tianryu游戏开发规范.original.skill'
    if not backup.exists():shutil.copy2(archive,backup)
target=base/'tianruy游戏开发规范.skill'
with zipfile.ZipFile(target,'w',zipfile.ZIP_DEFLATED) as z:
    for p in sorted(new.rglob('*')):
        if p.is_file():z.write(p,new.name+'/'+p.relative_to(new).as_posix())
with zipfile.ZipFile(target) as z:
    assert z.testzip() is None
    assert all('tianryu' not in n for n in z.namelist())
    assert all(chr(65533) not in z.read(n).decode('utf-8') for n in z.namelist())
if archive.exists():archive.unlink() # 完整原始归档已复制并验证目标归档可读。
global_skill=Path(r'C:/Users/田煜/.codex/skills/tianruy-game-development-standards')
assert not global_skill.exists() or (global_skill/'SKILL.md').read_text(encoding='utf-8').splitlines()[1]=='name: tianruy-game-development-standards'
shutil.copytree(new,global_skill,dirs_exist_ok=True)
report={'name':'tianruy游戏开发规范','source':str(new),'installed':str(global_skill),'package':str(target),'original_backup':str(history/'tianryu游戏开发规范.original.skill'),'sha256':hashlib.sha256(target.read_bytes()).hexdigest()}
(base/'validation.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(report,ensure_ascii=False))
