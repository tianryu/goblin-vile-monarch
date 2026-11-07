# Cocos 与 TapTap 小游戏目标

更新：2026年11月2日。

## 用户最新决定

- 可交互建筑采用浅米色描边，选中时保留金色呼吸光边。已允许开始修改，覆盖此前只讨论和等待米色/白色选择的限制。
- 用户提出改用 Cocos，并明确采用 Cocos 时交付 TapTap 小游戏，不导出普通 H5 版作为发行成品。
- 保持现有非像素平面手绘美术、角色阵营描边、贴纸剪纸动作方向、全局渐入渐出，以及 V9 单路洞穴战役方案。换引擎不构成重画风格或缩减玩法的授权。
- 不自动上传、修改应用资料、提审或发布。旧 Godot 工程和已交付 ZIP 保留，不覆盖成新小游戏包。

## 已核实的官方构建路线

依据 [TapTap Cocos 引擎适配文档](https://developer.taptap.cn/minigameapidoc/dev/engine/Cocos-Laya-Egret/)，小游戏运行环境不提供浏览器的 BOM/DOM，不能把普通网页包直接当小游戏包。

本地已安装 Cocos Creator 3.8.8，位置为 C:/Develop/Cocos/Creator/3.8.8/CocosCreator.exe。官方适配扩展要求 3.8.x 及以上；下载的 1.2.2 扩展 README 明确将 3.8.8 列为已测试版本。这是厂商兼容性声明，尚非本项目实测结果。

构建流程为 Cocos Creator 的 wechatgame 中间构建，启用 taptap-minigame-tools 扩展中的 enableTapConvert，再转换为 TapTap 小游戏。微信构建仅是适配链路的中间步骤，不是要求用户发布到微信。

官方最终输出为 build/TapBuild/game/ 与 build/TapBuild/game.zip。选用的构建配置、游戏入口、横屏方向和扩展转换结果必须一起核验。Web Mobile 导出、带 index.html 的旧网页 ZIP、Maker/UrhoX 作品均不代替此产物。

[TapTap 创建小游戏及包体管理文档](https://developer.taptap.cn/minigameapidoc/quick-start/guide/creation-improvement/)另说明小游戏包体上传和开发版本扫码测试流程。具体包体门槛、登录要求及平台能力在实际准备发行时再次核对，不能从旧 H5 验收继承。

## 官方扩展本地留存

- 下载来源：[官方适配页提供的 1.2.2 ZIP](https://app-res.tapimg.com/file/2026-04-14/67e7d94f5e586596dab061816d1c509d.zip)。
- 本地文件：tools/taptap/tap-minigame-ts-1.2.2.zip。
- 文件大小：13,755,538 字节。
- SHA256：6b8a9a3cc62b6c54cefab397097babb771d9d99f90442cddff06310a4c9ed73f。
- 已检查 package.json、README、builder.js、main.js、hooks.js 及转换器相关配置，未执行转换、安装全局扩展或修改引擎。
- 插件选项含 enableTapConvert、tapAppid、gameVersion 和 deleteWechatBuild。源代码核对发现该版本 hooks 未将 tapAppid 传给转换函数；不能只见编辑器输入框就声称产物已绑定应用。实际构建时应核对最终配置与平台身份，不自行猜测字段。

## 平台身份和接口边界

目标商店应用为用户指定的 1018356，开发者 510750。此次只读应用列表仍确认其为非关卡应用，但列表显示名为「五方」的游戏；不擅自修改名称。

此次强制刷新发现共享 MCP 连接实际选择了旧《我是哥布林：魔王》1007996。未切换共享连接，也未操作该应用。其小程序 ID、广告位和版本信息一律不得用于本项目。此前记录的新应用 miniapp_id 不可用，当前仍没有取得与 1018356 对应的小程序 ID。

商店数值 App ID、小游戏运行身份和广告位分别核对，不能互相代填。广告仍维持上次已知的未开通状态，未进行新查询；只在用户明确要求刷新时检查。正式 TapTap 登录、存档、广告和前后台生命周期需经目标宿主验证。浏览器开发预览只作为辅助，不计作小游戏验收。

## 实现与验收现状

本次完成目标纠正、官方适配路线核实和扩展下载留存，没有新建 Cocos 游戏工程，没有改游戏逻辑、Godot 正式资源、预览或旧交付包。新的 Cocos 迁移、米色描边实现、V9 玩法整改和实际小游戏包均未完成。

后续使用独立 Cocos 工程，复用已验收的原始 AI 位图、字体和音效；新增动作按贴纸剪纸方案实现，不恢复视频抽帧生产。必须分别验收项目导入、代码与资源构建、TapTap 转换产物、平台扫码运行、真机交互及性能。不能用空工程构建通过或旧 Godot 测试通过代替整款游戏迁移完成。

画面表现取决于素材、层级、描边、灯光、布局和动作实现，Cocos 不自动比 Godot 更好看或运行更快。性能、内存和视觉相似度沿用“目标与实测分开”的报告规范。
