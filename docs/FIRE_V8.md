# 实时手绘火焰

2026年11月1日，用户要求火把和篝火使用程序化火焰，替代序列帧方案。其他人物和环境动画继续。

参考[patch-gg/pixelfx](https://github.com/patch-gg/pixelfx)的fire/torch、fire/campfire及分层火舌、上升余烬、确定性时钟和独立灯光结构。项目实现为Godot小范围四边形着色器，不复制像素格、像素字体、木柄或营火造型。保留MIT通知game/licenses/PixelFX-MIT.txt。

火焰为三个错相火舌、暖橙外层、金色内层和少量余烬；轮廓抗锯齿，色块保持平面哑光，不用序列图。每个火源使用稳定种子和游戏时钟，暂停冻结，重复绘制不改变随机数、战斗或金币。低特效关闭余烬与倒影，保留主火焰。火把随夜色平滑点燃，篝火日夜燃烧，局部灯光沿同一闪烁节奏变化。

木柄使用原torch_unlit贴图，日夜不换尺寸。一级主厅的旧火焰通过内置image_gen局部编辑移除，原图和提示归档game/art/source/animation-v8/hall1-no-flame，石圈和木柴保留。运行普通裁切缩放为hall1-no-flame-v8.png。旧torch-flame-v01只作弃用序列候选，不接入火焰播放。

源代码：game/shaders/painted_fire.gdshader、game/scripts/fire_field.gd。火源增删沿用0.18/0.22秒显隐，快速反向从当前alpha接续。纹理主体与业务不产生额外结算。

本轮已执行：昼夜实际截图、火把顶端及木柴对齐、静态火焰清除、真实火形变化、暂停冻结、熄灭/点燃渐变和升级拆除。qa/fire-v8/acceptance.json为9项桌面Edge软件WebGL检查；day.png、night.png为当前实机。第一轮发现QuadMesh的UV纵向与纹理矩形相反，火焰倒置，已修复并保留day-round1-inverted.png。旧120毫秒QA采样会漏掉淡出过程，测试改为逐渲染帧采集并开启16毫秒观测，不修改游戏显隐时长来凑断言。

发布包本地启动、操作、存档、嵌套路径、无QA入口与素材打包13项通过，证据qa/godot/v8-release-tests.json。当前试玩42820和release/goblin-monarch-web.zip已更新。本轮没有真实手机或TapTap宿主测试，没有上传发布。低特效已接入关闭余烬和倒影，但本轮未单列实体设备性能或低特效画面验收。
