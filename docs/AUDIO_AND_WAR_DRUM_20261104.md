# 音景与出征战鼓

最新本地试玩为 `drum-cart-20261104`，沿用 42828 与原存档键。旧音景固定包保留。

`cave-audio-20261104` 将鸟鸣、虫鸣、溪水、火声和施工敲击的增益调到约一半。建造完成改用 `build_complete.ogg`，由同一份 CC0 木材素材里的 `impactwood03` 和 `impactwood09` 剪成半秒双木击。旧的确认音仍用于招募和占营。

`bottom-rewards-20261104` 将建造完成换成原抽鞭子的 `chop.ogg`。攻城木桩的 `wall_thud.ogg` 使用 Kenney 的短落物录音叠加低频，重劈 `sword_heavy.ogg` 使用 StarNinjas 剑声并加重落点，抽鞭 `whip_snap.ogg` 使用 Kenney 布料声配短促鞭响。试听在 `qa/cocos/bottom-rewards-20261104/audio`。

`construction-audio-20261104` 将 `chop.ogg` 改用于施工中的敲击。完工使用 `construction_done.ogg`，选自 Kenney Interface Sounds 的 `confirmation_003.ogg`，裁短并软化高频。两段试听在 `qa/cocos/construction-audio-20261104/audio`。

`construction-impact-20261104` 将完工音效改为单次重物落地。用 Kenney RPG Audio 的 `dropLeather.ogg` 与 `bookPlace3.ogg` 制作撞击声，并补足低频余响。试听在 `qa/cocos/construction-impact-20261104/audio`。

- 步行使用经过低通软化的原蹄声，播放增益由 .16 降到 .06，奔跑为 .085。按坐骑实际位移触发，原地顶墙和低空飞行没有蹄声。
- 白天以风和鸟鸣为底，轻放《The Bard’s Tale》。傍晚淡入《Forest Whisper Theme》，夜里以虫鸣为主。小溪、火炬和篝火声按距离渐变，来袭时用远号并降低配乐。
- 战斗增加木墙受撞、倒塌、箭中盾和近战命中。营地增加敲锤、开箱、入牢插销和笼车起步。招募、首领重伤及通关有短提示。远处声音衰减，相同事件限频，优先播放关键反馈。
- 主屋升到二级自动出现战鼓，位于最外侧完好墙旁。第一道墙未完成时在预定防线旁。三枚金币预留两名空闲苦工，鼓手六击集结，随后一人站在板车上敲鼓，一人拉车。所有猎手、恶霸加入队伍。每辆器械另需两名空闲苦工，缺人时该器械留守。首领跑远时部队等车与器械跟上。
- 集结用单击鼓样，敲击动作分为举锤、挥落、砸鼓和回弹。行军用循环鼓乐，贴纸动作和鼓乐采用同一节拍。攻城开始，鼓车停在阵后，行军乐淡出。
- 攻城时靠近停下的鼓车投三枚金币，全军撤回，活着的鼓车苦工带车一起走。未投完离开、攻破营地或发生溃败时退还部分投币。全体剩余战士进入逃跑状态或全军覆没时，苦工逃跑，鼓车留在原地。夺下普通营地后，部队与车一同回营。夺船沿用立即结算和终章对白。下次出征从防线重新召集。
- 鼓车用原有战鼓、板车和木轮独立位图组装，沿用苦工关节贴纸动作。旧存档已经在攻城的部队按原编制续打，下一次召集启用鼓车。

上一版的 19 个音频已通过解码检查，新增压缩成品约 1.47 MB。本版隔离模型覆盖鼓车与器械用人分开、六击集结、行军等待、驻车、存档、付币撤退、未完成投币退款、胜利带车回家和溃败弃车。桌面浏览器检查鼓车、挥锤姿势和前线撤退入口，并以触摸和鼠标检查浮动摇杆。真实手机外放、混音听感和完整战役待试玩。

## 素材和许可

下列声音的发布页标注 CC0。游戏只分发压缩后的选段，新增来源随包保留。

- 白天音乐和结算选段由 RandomMind 创作。[The Bard’s Tale](https://opengameart.org/content/medieval-the-bards-tale)
- 傍晚音乐由 Cleyton Kauffman 创作。[Forest Whisper Theme](https://opengameart.org/content/forest-whisper-theme)
- 行军鼓乐及单击取自 William Hector 的循环。[Horde War Drums loop](https://opengameart.org/content/horde-war-drums-loop)
- 环境录音来自 Félix Blume、OwlStorm、loudernoises 与 yaros_nov。[林间鸟鸣](https://freesound.org/people/felix.blume/sounds/414098/)、[夜虫](https://freesound.org/people/OwlStorm/sounds/320145/)、[小溪](https://freesound.org/people/loudernoises/sounds/696686/)、[营火](https://freesound.org/people/yaros_nov/sounds/434026/)
- 剑击与格挡来自 StarNinjas，木材撞击与断裂来自 Independent.nu，门轴和插销使用 Kenney。[剑击](https://opengameart.org/content/20-sword-sound-effects-attacks-and-clashes)、[木材](https://lpc.opengameart.org/content/35-wooden-crackshitsdestructions)、[Kenney RPG Audio](https://kenney.nl/assets/rpg-audio)
- 来袭号角来自 DeVern，低血提示来自 KaBlazik_Samples。[Distant War Horn](https://freesound.org/people/DeVern/sounds/512490/)、[KB Heartbeat](https://freesound.org/people/KaBlazik_Samples/sounds/588575/)

## 战鼓原画

内置 imagegen 生成，原画保存在 `cocos/art/source/war_drum.png`，运行贴图为 `cocos/assets/resources/art/war_drum.png`。装备改造台作为风格参考。提示词如下。

> Create one new standalone war drum world sprite for Goblin Monarch. Use the attached forge only as a painting-style reference. A squat medieval goblin war drum, large stretched ochre hide with an oval opening seen from very slightly above, weathered warm brown stave body, dark cherry-red cloth band, three rough rope lashings, low wooden four-leg trestle with all feet aligned on a single flat horizontal baseline. Readable striking surface at standing goblin waist height. Flat 2D side-on hand-painted matte game prop, similar warm brown blocks and simple uneven soft painterly polygon contours as reference, very little dimensional shading, restrained desaturated warm palette. A tight restrained continuous pale beige sticker silhouette edge, matching existing interactable buildings. Fully transparent background with genuine RGBA, no scenery, no ground or shadow, no characters, no mallet, no text, no other props. Single clean silhouette centered with safe transparent padding. Maintain readable visual at about 100 pixels tall.
