# 独立图片与分层素材生产

当前状态（2026年10月30日）：正式素材生产暂停，当前仅制作art/design/reboot-v1的新版整体设计稿。用户已要求从头重新设计，现行玩法见GAME_DESIGN.md、低内存规格见PERFORMANCE_BUDGET.md。以下是旧原型素材记录，不表示可以继续旧生产流程。

角色新方向为丑萌、贼兮兮的哥布林：大尖耳、歪鼻、小獠牙与紧凑轮廓，用低像素表达。整体设计图不得作为一张超大游戏背景交付，后续生产仍需独立分层场景与独立角色/建筑素材。

开发状态：游戏逻辑与初轮验收已跑通，但用户要求所有美术素材独立生成，正在替换旧的程序像素绘制；旧88%相似度不满足新90%门槛，不可按完成交付。

最新状态：37个基础图片均已生成、src/render.js已重写为图片渲染与多层视差/可见区块缓存。但用户否决四帧走路：姿势近似、无闭合、步兵剑盾同手。所有主动作改按ANIMATION_QA.md关键帧递归插帧，至少8个有效帧，逐项自检与循环预览，不能直接交付旧四帧。人类/精灵/矮人联军与偏邪恶哥布林的阵营设定已更新FEATURE_SPEC。最新分层实机与v2原图全尺寸SSIM仅57.70%，不达90；继续校准，不能伪称通过。source renderer已无程序化角色/建筑素材，旧代码仅在docs/render-procedural-retired.txt归档。

## 不可退回的约束
- 不用程序画角色、坐骑、敌人、建筑、物品或特效，不用随机噪声/几何拼块充当美术。
- 每类资产独立PNG；动画使用等格精灵表逐帧播放，可含同一对象的升级/动作帧。
- 天空、远景、中景、近景、地面、水面、最前草叶分层；不把单张完整环境画直接铺成整张地图。
- 世界坐标、镜头和区块加载独立于美术；只重用生成的图块，不程序生成地形纹理。
- 每层图透明区域必须真实alpha；入场前核验尺寸、alpha、内容边界和图格。
- 新交付视觉门槛为90%，同视角整帧SSIM；还要观察角色/建筑/UI区域，不能只靠背景掩盖差异。

## 已生成素材
- assets/forest-background.png：用于配色、构图与分层提取的参考，不作为最终完整场景层。
- assets/hall-stages.png：三阶大厅等格精灵表。
- assets/merchant-gold.png、merchant-mount.png：金币商人/坐骑商人独立摊位。
- assets/walls.png（三阶）、towers.png（两阶）、farms.png（两阶）。
- merchant-army生成曾因网络失败，需要重试。

## 仍需生成与接入
1. layer-sky、layer-far、layer-middle、layer-near、layer-ground、layer-water、layer-foreground。
2. merchant-army、camp、portal、tree、chest、tools、rally、fire/torch。
3. idle/worker/hunter/farmer/captain角色帧动画、骑乘君主帧动画。
4. boar/lizard/wolf/bat坐骑帧动画，small/heavy/ranged敌人帧动画。
5. coin/arrow/impact/crown物品特效帧图、UI图标。
6. 重写render.js为仅加载/裁切/变换/绘制生成图片，删除ASCII像素、建筑rect等美术生成逻辑。进度条/文字属于普通UI。
7. 更新构建、包预算、模型/浏览器回归，重新截图比较>=90，记录真实限制。

## 当前运行与验收资料
- 开发服务器 http://127.0.0.1:42817/ （端口4173与已有其他游戏冲突，不要用）。
- 可用Node、Python、Playwright/Edge：runtime包路径见会话工具输出；NODE_PATH为C:/Users/田煜/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules。
- node --test tests/model.test.mjs：上一轮26项通过；之后队长生命改为80，需复测。
- scripts/campaign-check.mjs：零广告自然收入通关，day3，318模拟秒；后续改图不应破坏。
- scripts/rewarded-campaign-check.mjs：测试provider18次收益，四坐骑、farms/守卫/胜利day8，1065模拟秒。不是平台广告实测。
- scripts/browser-check.cjs：20项上一轮通过（摇杆竖轴忽略、多指奔跑、情境主键、布局、存档、无异常）；图片替换后需复测。
- scripts/visual_compare.py：11x11 Gaussian RGB SSIM，不遮罩/调色/配准，旧最终截图88.48%；须把脚本实际阈值改为90并重新验收。
- TapTap应用1008093，上次广告状态未开通。不要编造SDK接入或拿旧应用ID。正式构建禁用DEVELOPMENT hook。还未输出正式dist。
