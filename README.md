# 哥布林 卑劣君主

横向经营与攻防策略游戏。玩家管理哥布林部落、守住洞窟营地，并沿地图向联军营地和运兵船推进。

当前主要工程位于 `cocos/`，使用 Cocos Creator 3.8.8。`main` 保存手机小游戏基线，PC 重构使用 `codex/pc-desktop` 分支。此前的 Godot 工程保留于根目录和 `game/`。

## 开发入口

1. 使用 Cocos Creator 3.8.8 打开 `cocos/`。
2. 打开 `assets/scenes/Main.scene` 并预览。
3. PC 改造以 `docs/PC_DESIGN_20261107.md` 为准，原玩法见 `docs/GAME_DESIGN.md`，实际验证见 `docs/PC_DELIVERY_20261107.md`。

`cocos/assets/` 包含正式运行代码与素材，`cocos/art/` 与 `art/` 保存原画和设计参考。`cocos/tools/`、`cocos/tests/` 和 `qa/` 保存处理工具、测试与相关记录。

编辑器缓存、依赖目录、动画制作中间文件、录屏和历史导出包保留在本地。克隆后由编辑器重新导入资源，正式导出可按 `cocos/config/` 的配置执行。

## PC 分支

`codex/pc-desktop` 面向 Windows x64，使用原生 Cocos 运行时。保留第一章经营、防守和出征战役，界面改为键鼠操作，移除手机广告入口。主菜单和暂停菜单支持简体中文、英语即时切换。

操作：A/D 或左右键移动，Shift 奔跑，E 交互与连续投币，Q 抽鞭，R 第二项操作，Tab 切换附近目标，H 回洞，F1 操作说明，Esc 暂停，Enter 推进对白。底部操作图标也可用鼠标点击。

0.12.0接入标准手柄：左摇杆或十字键移动，A交互，B抽鞭，X第二操作，Y换目标，LB奔跑，RT回洞，Start暂停，Back操作说明。菜单支持手柄导航，提示随输入设备切换。坐骑改由第2天起每隔两天到访的商人提供，每次商品不同，靠近后投币兑换。详情与验证边界见 `docs/PC_CONTROLLER_MERCHANT_20261107.md`。

Windows 开发需要 Cocos Creator 3.8.8、Visual Studio 2022 的 C++ 桌面工具与 Windows SDK：

```powershell
./scripts/build_pc.ps1 -Target windows -Compile
```

桌面预览：`./scripts/build_pc.ps1 -Target preview`。默认构建位置为 `cocos/build/pc-windows-20261107` 和 `cocos/build/pc-preview-20261107`，不提交编译输出。构建配置在 `configs/`。

英文工作名称为 **Goblin: Vile Monarch**。显示词条位于 `cocos/assets/scripts/i18n/`，语言偏好与战役分离保存。原版手机存档不受 PC 版影响。完整 Steam 服务和发行尚不在本轮范围内。

## 许可与素材

本仓库公开用于项目开发与版本管理，项目自身代码与美术的权利由原权利人保留。第三方引擎、字体和声音按各自许可使用，来源和声明见项目内的许可文件、音频说明与游戏鸣谢。公开仓库本身不授予这些素材的额外使用许可。
