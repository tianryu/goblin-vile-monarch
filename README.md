# 哥布林 卑劣君主

横向经营与攻防策略游戏。玩家管理哥布林部落、守住洞窟营地，并沿地图向联军营地和运兵船推进。

当前主要工程位于 `cocos/`，使用 Cocos Creator 3.8.8。`main` 保存手机小游戏基线，PC 重构使用 `codex/pc-desktop` 分支。此前的 Godot 工程保留于根目录和 `game/`。

## 开发入口

1. 使用 Cocos Creator 3.8.8 打开 `cocos/`。
2. 打开 `assets/scenes/Main.scene` 并预览。
3. 当前玩法以 `docs/GAME_DESIGN.md` 为准，开发交接见 `docs/PROGRESS_HANDOFF.md`。

`cocos/assets/` 包含正式运行代码与素材，`cocos/art/` 与 `art/` 保存原画和设计参考。`cocos/tools/`、`cocos/tests/` 和 `qa/` 保存处理工具、测试与相关记录。

编辑器缓存、依赖目录、动画制作中间文件、录屏和历史导出包保留在本地。克隆后由编辑器重新导入资源，正式导出可按 `cocos/config/` 的配置执行。

## 许可与素材

本仓库公开用于项目开发与版本管理，项目自身代码与美术的权利由原权利人保留。第三方引擎、字体和声音按各自许可使用，来源和声明见项目内的许可文件、音频说明与游戏鸣谢。公开仓库本身不授予这些素材的额外使用许可。
