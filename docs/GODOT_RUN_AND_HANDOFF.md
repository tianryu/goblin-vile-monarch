# Godot试玩与交付

当前主工程：project.godot。使用Godot4.7.2打开，F5运行项目。入口为game/scenes/main.tscn，GDScript实现，Compatibility渲染，静态贴图，帧动画延后。

## 本地入口

- 正式Web试玩：http://127.0.0.1:42820/
- 本轮真实截图审阅：http://127.0.0.1:42817/art/design/visibility/index.html
- Web导出目录：build/release-web
- 单目录压缩包：release/goblin-monarch-web.zip
- 原始大图及来源：game/art/source各阶段目录，当前新增素材在world-v7
- 生产图集与区域元数据：game/art/runtime

页面需通过HTTP访问，不能直接双击index.html。预览服务停止后，在工程目录运行node scripts/serve_godot.mjs build/release-web 42820。构建为powershell -NoProfile -ExecutionPolicy Bypass -File scripts/build_godot.ps1 -Release；其他机器可通过GODOT_CONSOLE和GAME_PYTHON环境变量指定引擎与含Pillow/fontTools的Python。

手机采用左侧水平摇杆，右侧奔跑及靠近交互。键盘为A/D或方向键、Shift奔跑、E交互、Escape暂停。失败免费重开。工具可提前购买，爪牙自动领取；没有强制广告门槛。存档在当前浏览器本地，按征程与永久奖励分别保存，暂停和关闭不推进战斗。

## 平台边界

用户自行创建正式独立应用，未执行平台创建、修改、上传、审核或发布。旧1007996/1008093不作为新配置。游戏中的广告入口与奖励记账已实现，真实TapTap SDK尚未接通；未配置时只给简短图形反馈，不弹解释窗口，也不发虚假奖励。正式导出没有测试广告提供方，也不注册浏览器QA指令。

接通真实SDK前须按官方工具重新核对新应用、开通状态、真实广告位和H5指南。后续平台适配必须把完成、取消、错误和唯一奖励事务回传到现有接口，不能把关闭回调当成功。当前包可正常无广告游玩，不能标注广告已实测。

完整玩法见GAME_DESIGN.md顶部。当前显隐、两行建筑说明、人物描边、地面贴合与透明钱袋看VISIBILITY_TRANSITIONS.md，验收以qa/godot/visibility-acceptance.json为准。基础世界规则仍见WORLD_REWORK_V7.md，旧报告只保留历史。真机、平台广告与独立90%视觉一致度均未判通过，不能把此包描述为已经全部上线验收完成。
