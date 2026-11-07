# 通用协作规范

- 2026年11月7日用户要求：不要使用操控鼠标的方式测试本项目，采用代码、模拟输入和构建检查，实体设备结果单独记录。PC 手柄原生侧为项目本地 XInput 桥接，浏览器为标准 Gamepad API，均经 Cocos 正式事件；不能将浏览器通过称为 Windows 实体手柄通过。

- PC 0.12.1 手柄与商人 2026年11月7日：PC分支以docs/PC_CONTROLLER_MERCHANT_20261107.md覆盖旧坐骑面板。标准手柄与键鼠共用业务，菜单、帮助、提示、断开与长按隔离已接入；不把模拟输入当实体手柄通过。PC删除广告接口，拒绝广告奖励，旧兼容字段不发奖。坐骑商人第2天起每隔6天清晨来、傍晚离开，轮换不同坐骑，靠近逐币兑换，商品与成交状态随档保存。旧main手机基线和旧交付包保留。

- PC 分支 2026年11月7日：用户授权创建公开 GitHub 仓库并提交当前基线，再以 `codex/pc-desktop` 重构 Windows PC 版并增加中英文。`main` 基线提交 `49e1bc4`，仓库 https://github.com/tianryu/goblin-vile-monarch 。PC 分支优先读 docs/PC_DESIGN_20261107.md 和 docs/PC_DELIVERY_20261107.md，键鼠操作替代触屏区，PC 独立存档，简中/英语独立偏好，坐骑金币解锁，不展示手机广告与未接通平台菜单。旧手机设计、包和存档保留；手机性能问题不能继承 PC 验证结果。仅 GitHub 提交推送获授权，无商店上传或发布。

- 最新战鼓与后勤 2026年11月5日：当前 0.10.4，试玩 42832/?build=battle-economy-20261105，包 release/taptap-20261105-r4/game.zip。先读 docs/BATTLE_ECONOMY_20261105.md。地面鼓等于车上61，不做高架；鼓车主动按首领速度保持180距离、不限制全军，攻城停车继续敲鼓，鼓乐保持0.35。修正出征误用巡游少打多退避、升级建筑消失和血条消失。遗体普通1/精锐Boss2必得，俘虏4至6，装备1；坐骑加速，苦工分头优先救安全活口，塔箭提速增距跟踪移动目标。白天120秒夜晚80秒，revision23保留旧档夜晚比例与天数；生产工时缩短、苦工每晚送款一次。11项模型、5组桌面画面和ZIP校验通过，无完整战役/手机/TapTap宿主实测。三台手机首日转向问题仍待复测，不继承通过结论。旧包旧档保留，无上传发布和Git提交。

- 最新性能与音频 2026年11月5日：用户确认 Mate70、红米 K30、华为麦芒在 TapTap 宿主第一天转向就卡。已减重复节点变换、奔跑键缩放往返、地面遮罩重建及重叠余火。静止30帧缩放提交5010降为0、位置5490降为30。桌面密集组装改善，首日4倍CPU降速未证实稳定改善且有长帧，实机问题仍待复测，不能称已排除泄漏。主菜单静音，开始/继续预启并渐入，返回暂停音景，播放失败限频重试，配乐自然声鞭声增益上调。见docs/PERFORMANCE_RECHECK_20261105.md，TapTap本地包release/taptap-20261105-r3/game.zip，版本0.10.3。无平台发布。

- 最新音景和出征战鼓2026年11月4日：42828 对应 audio-mix-20261104。脚步降到 .06 并按实际位移；昼夜自然声、轻音乐、战斗与营地提示已接入。二级主屋自动在最外侧完好墙旁生成战鼓，三币叫苦工敲六下，猎手和恶霸一起随玩家。器械双苦工推动，落后等待、到齐再攻，行军鼓乐独立。19个音频解码、出征隔离模型、编译、构建、HTTP通过。浏览器混听、实体手机和完整战役留待试玩，旧包旧档保留。素材授权和战鼓原画见docs/AUDIO_AND_WAR_DRUM_20261104.md。

- 最新死亡结算试玩2026年11月4日：42828 对应 revive-result-20261104，固定包保留。死亡结算提供「看广告复活」「重新开始」，旧失败档可返回结算。完整观看后唯一回执才恢复本局，首领回主屋满血满体力并免伤3秒。当前真实广告位未配置，未查询、未接通、未实测广告，浏览器显示暂不可用，免费重开可用。编译、构建、HTTP核对，留给用户试玩。

- 最新守军试玩2026年11月4日：42828 对应 defense-rally-20261104，保留旧包旧档。破墙优先反击，地面守军稳阵6秒，重伤和持续压力触发延迟撤退，固定撤退与巡游落点，鞭打可停止撤退。夜袭结束恢复巡游，塔上可打猎。商人第3/5/7天清晨来、次日傍晚走，实际入牢后才引导。体力耗尽自动松开，改造台在外侧箭塔和第一道墙之间，金币数字移到钱袋口。仅编译、构建、HTTP核对，实机留给用户。见docs/OPENING_AND_DEFENSE_20261104.md。

- 最新开局试玩2026年11月4日：42828改为intro-grace-20261104，保留旧包与旧档。首日无敌方巡逻或夜袭，第二日起首袭3人，三四日5/7，第五天接原曲线。一级木墙80到120生命，防御按普通士兵2点作为基准设为3。改造台只介绍、招募等待期间继续引导、引导可跳过这步或全部、宝箱在主屋右侧、俘虏商人回监牢旁。编译、构建、HTTP已核对，留给用户试玩。守军撤退只出提案，待确认后再实施，见docs/OPENING_AND_DEFENSE_20261104.md。

- 最新洞口与笼车试玩2026年11月4日：42828已切换camp-update-20261104，原固定包保留。按docs/CAMP_UPDATE_20261104.md继续。独立笼车替换旧板车拼接，商人绕车掉头，俘虏在栏杆后。洞口一级箭塔、洞内左移、装备堆增距、拆卖金币音效、首领红边与受击闪红、奔跑状态、敌军分段攻击已落地。金币援助、部落援军、坐骑在左侧人口下方，旧场景广告摊废止。已解锁坐骑自由切换，锁定坐骑依赖真实激励广告，本地未接平台广告。旧未开打档补开场，已推进档保留。仅做编译、构建、资源及HTTP检查，待用户试玩。

- 最新第一章剧情2026年11月4日：用户授权实施《哥布林：卑劣君主》第1章「守住金币」。新局1苦工、1猎手、2空手爪牙，开场、商人、出征、中军对峙、夺船结尾五段正式对白，木锤/弓箭/城墙/箭塔四步，以及宝箱取币、私藏金币每档一次、设施/敌情首次提示。远处用虚线箭头，靠近后按实际按钮。完整台词与触发清单见docs/CHAPTER_ONE_IMPLEMENTED_20261104.md。TypeScript与Creator构建完成，试玩42829/?build=chapter1-20261104，固定包release/cocos-chapter1-20261104-r1。42828原试玩和该端口存档保留。按此前要求留给用户试玩，未运行全流程或性能测试。

- 最新实施2026年11月4日：用户授权第二轮数量战、R01至R14并明确恶霸也能穿甲。源码、编译、Creator构建和固定交付已完成，先读docs/HORDE_IMPLEMENTATION_20261104.md。当前试玩42828/?build=horde-20261104，固定目录release/cocos-horde-20261104-r1。猎手/恶霸共用三级护甲，生命攻击防御百分比增幅，主厅成长另算；敌方每5天5%封顶100%保留，日期人数6/10/14/24/33/54对应1/5/10/20/30/50天。反馈与性能优化已接入，全部待用户试玩。保留本批不测试要求，未运行模型、图形、浏览器或性能测试，不能继承旧通过或手机成绩。revision13保留财富、装备、伤势和已交战军队，旧档兵量不会凭空缩水。旧包保留，无平台发布和Git提交推送。下方只规划/待实施内容是历史。


- 最新数量战第二轮2026年11月4日：用户否决极少强敌，要求两军对垒规模，普通人类约45生命、基础属性约普通哥布林两倍，恶霸与人类相近。已修订docs/HORDE_REBALANCE_PROPOSAL_20261103.md，具体兵数/成长仍是配套提案，未改运行、未测试。废止首稿人类80生命、夜袭2起步/50天18人、极少驻军和对应收益加码。R01至R14仍待实施，当前试玩仍hanging-menu-20261103；保留夜袭只看日期、无夜袭撤退、守备外征分账、无日期出征硬锁、无祭坛实现和不测试要求。

- 最新数量战重策划2026年11月3日：用户要求设计弱小但数量多的哥布林、强大但人数少的联军，并提出14项功能/表现反馈。当前只核对代码和整理草案，未改运行、未测试。先读docs/HORDE_REBALANCE_PROPOSAL_20261103.md，R01至R14逐条记录待实施；数值表是首轮提案，不可称已生效。明确新增要求包括首领近敌自动鞭击（“猎手的2”暂按2倍假设）、玩家优先拾币、笼内不逃、招募180秒2人、广告金币/援军改到天数旁按钮、驻塔打猎、商人带俘虏离场、降低恶霸并增强重锤、修AI抖动和攻击姿态、局部建筑增距、强化晨暮表现。禁止遗漏旧未修项目；保留不测试要求、五天经济目标不硬锁、夜袭只看日期、留守与外征分账、无夜袭撤退、无祭坛实现。当前试玩仍hanging-menu-20261103。人口/公式/兵数/成长新表均待确认，不能把本稿写成已验收的新平衡。

- 最新吊牌菜单2026年11月3日：用户要求先调整给他试玩，本批停止自动测试、模型/图形检查与压测，只编译构建和交付。已原生接入hanging-menu-20261103，详见docs/HANGING_MENU_IMPLEMENTATION_20261103.md。主菜单和暂停共用顶部双绳底图，右侧布局，每项292x64、间距78，声音同尺寸；排行榜不显示生存天数小字，暂停末项只写主菜单。开始/恢复先上拉渐隐完整离屏，再让世界继续；快速切换接续当前姿态。暂停键W-310、Y60。声音实际接入并独立保存，排行/云存档未接服务而置灰。42828固定目录release/cocos-hanging-menu-20261103-r1，旧档旧包保留。未实测新菜单，不继承旧通过或性能结论，无平台发布。

- 最新开局与菜单要求2026年11月3日：开局赠送已建一级招募盘，只免建造，摆币与补员曲线不改。工匠只改显示名为苦力，worker ID及搬运职业分工不变，用户已撤销扩大搬运职业的提议。代码已接入starter-20261103，菜单仍审图，不称已经实现。菜单最新布局为标题与主菜单均靠右，继续游戏、新的征程、排行榜（生存天数）、云存档、声音开关；暂停弹出声音、排行榜、云存档、回到主菜单。取消旧系统设置页与音量/画质/帧率/震动控制，居中稿废止。详见docs/STARTER_AND_MENU_REVIEW_20261103.md。性能当前桌面软件WebGL短测纹理119至136 MiB、普通约30帧、24对96约26帧，逻辑p95约0.4/1.4毫秒，不能写成实体手机达标；以docs/PERFORMANCE_CURRENT_20261103.md为准。

- 最新试玩修复2026年11月3日：以docs/PLAYTEST_FOLLOWUP_20261103.md为准。已补鞭打携带金币、腰部钱袋、原位举锤及关节光边，去掉营地悬字，广告金币第一天10之后每天加1，监牢不售俘，只在商人交易且先给钱袋。白天闲置地面猎手/恶霸巡游，敌营每天派独立2至3人巡逻，600单位局部人数少者逃离，98秒回防。夜袭部队取消伤亡与天亮撤退，全部倒地才遗留器械，此条覆盖旧半数撤退规则。奔跑键下常显体力条；完整敌墙双向阻挡所有坐骑且按墙宽留身位。42828现服务release/cocos-patrol-20261103-r1，保留原档与旧包。18项新模型、6项关联回归、第6轮构建、9组浏览器通过；不继承旧通关或真人败率，不称手机/平台/广告已测。未生成新动作帧或平台操作。

- 当前日期难度实施2026年11月3日：用户已授权实施，按docs/CALENDAR_IMPLEMENTATION_20261103.md继续。日期唯一夜袭、每5天5%属性、20天后每日加3、真实守备/外征账、多层城防、长地图与相邻港口已落地。试玩42828，固定包release/cocos-calendar-20261103-r1，旧42826保留。102项模型与9组最终浏览器通过；普通经济第10天攻破首营，未跑完整新战役，不继承旧通关天数或真人败率。六并发加载复测通过但原资源失败保留，无手机/TapTap/广告验收与发布。下方未实施等为历史。

- 最新日期规则纠正：夜袭人数、普通兵比例、精锐/Boss、器械和属性全部只看全局天数，不看营地或玩家进度。旧按营地配置外征与取较高档位方案废止。每晚全联军合计N，不是每营各出N；12/20/30/40/20是旧开局库存提案，不限制波次。详见docs/RAID_CALENDAR_20261103.md，补员35%硬上限已取消，需按下一晚编制提前保障来源并守恒记账。用户新增后期多道墙与多层塔、中军和船紧挨；守备仅不因夜袭折损，主动攻营仍会减员。当前仅改策划与数据提案，未改运行和42826包。

- 最新逐营规划2026年11月3日：用户认可第二轮守备/外征与成长规则，要求五营守备及攻城兵种规划；最新要求斥候和先锋只有士兵帐篷，后续营地有墙塔。方案见docs/CAMP_ARMY_ROSTERS_20261103.md，具体阵容/器械/设施尚为提案，不是V11运行事实。两类兵力同账，核心与驻营Boss不派夜袭，塔上射手计入守备人数，末两营核心总数暂保持100。当前未实施、未换固定试玩包。

- 最新战役规划第二轮2026年11月3日：用户否决通过夜袭消耗把敌营守军耗空。设计改为同一账本中的核心守备和外征预备队，夜袭与后方调兵不抽核心守备，驻营Boss留守；主动攻营损失仍真实保留。全敌军改为每5天线性加5%属性，最多加100%；攻城人数第1至20天每天加2，第21天起每天加3，初拟最高80，不随营地重置。读docs/CAMPAIGN_PRESSURE_PLAN_20261103.md，旧统一抽空守军提案已归档废止。此轮仍只规划，代码和42826固定包尚未修改，预备队/补员/地图数值不是运行事实。

- 当前V11 2026年11月3日：用户要求的完整战役数值、五级常规建筑和新版大型强力单位已接入本地测试。高阶外观按木材、加固木材、砖石、铁件、金属结构演进，不能只放大。先读docs/V11_IMPLEMENTATION_20261103.md。83项模型及第5轮构建通过，八组浏览器通过，两种普通无广告战役通关，一个种子中军推进超时；不冒充真人败率、35至50分钟时长或手机验收。试玩42826，固定包release/cocos-v11-20261103-r1。下方旧“V11未实现”“暂停美术/开发”是历史，不覆盖本条。保留旧Godot/旧ZIP，无平台操作。

- 恢复2026年11月3日：用户已明确要求继续，撤销本批暂停。本轮修复已归档，先读docs/REPAIR_PASS_20261103.md和docs/PROGRESS_HANDOFF.md。第5轮Cocos构建及61项模型通过，试玩42824，固定包release/cocos-repair-20261103-r1。图形/输入证据按构建分列，不冒充最终版全量重跑。普通经济种子731第二营失败，完整战役与V11仍未完成；已修全军覆没状态不释放及失墙旗帜不回退。旧Godot与稳定包保留，无平台操作。

- 最新2026年11月3日：用户要求先修此前未完成的问题，按docs/REPAIR_PASS_20261103.md执行，再扩新内容。五天基础期是正常经济与成长速度的设计目标，不是天数硬锁；玩家有足够金币并完成升级就能提前出征，禁止增加day>=6之类条件。第5天强力单位攻城大考；跳跃兵是普通职业，不是英雄。所谓英雄是大型/强力单位，可驻营也可被俘，不必须是特定人物。祭坛强化首领和授予技能只记待办，当前禁止制作或实现。旧“第三天常规出征、大卫是跳跃英雄”的提案已废止。

- 最新V11设计要求：用户现在要求难度一起处理，提高袭击增兵速度、减人口/金币产出/补员速度，现有可升级项目扩展到五级。核心是期待感、及时反馈、成长感，不新增机制堆叠。读docs/BALANCE_GROWTH_V11_20261102.md，表中数值是设计稿，尚未写入运行或验证，不得称已完成五级；覆盖旧“难度以后再调”。装备品质按褐色、白铁色、蓝色，头盔与弓最醒目；人类俘虏商人用绿色宽边。旧暂停美术与错误持斧候选仍是历史，不可覆盖本轮新修正。

- V11补充：前期也要压力，削弱低木墙并提高敌军属性。第5天起有强力单位夜袭，每5天加一个名额；扩充大型/强力精锐与后期Boss，跃低墙另归普通职业。装备台是五级上限的明确例外：只三级，对应主屋1/3/5级开放褐色/白铁/蓝色。用户提出第5天后约一半单日战败风险，作为待测目标，不能声称已统计达成或用随机强制死亡实现。当前设计不等于运行事实。

- 最新V10反馈：用户新增35条反馈（原编号1至37，缺4/9），要求修输入、目标锁定、交易、300秒招募2至3人、扩图、阵营领地、驻塔、驻军英雄、角色美术和贴纸动作。按docs/PLAYTEST_FEEDBACK_V10_20261102.md逐条实施和记录；此要求覆盖上轮暂停美术。难度总调校与多人协作另列后续阶段，不能擅自声称完成。发布目标仍为TapTap小游戏，本地Web仅测试，不操作平台发布或广告查询。

- 最新优先级：用户要求暂停角色/建筑美术，先交付可玩Cocos功能测试版，用户测试期间再继续修角色。恶霸三级修正版斧子倒持未通过持握验收，不能直接采用。见docs/PLAYTEST_PRIORITY_20261102.md。没有新的生成或帧动画队列。

- 不使用中点字符（Unicode U+00B7）作为标题、文字、界面、列表项或状态信息的分隔符。根据语义改用空格、换行、逗号、冒号或自然语句；不要换成相似装饰圆点继续分隔。
- 这是用户要求的通用规范，适用于后续项目与文案。历史引用、专名原文和代码运算含义不属于装饰分隔，按必要性保留。

# Project context

- LATEST ART REVIEW 2026-11-02: user challenged style consistency of four new Cocos candidates. They are NOT style-approved: firecatapult (exec-9b16b308...), ship (exec-3918bb1f...), ram (exec-ffe281a9...), hunter_2 (exec-a1fbaac4...). Structural/alpha checks were incorrectly conflated with style acceptance. All four are now style-rejected and quarantined from Cocos runtime/catalog, source retained. Do not adopt them, hide drift by outlines, or redefine the target style around them. New art generation pauses for calibration against existing actual Godot art; keep development task active. Read qa/cocos/style-review-20261102/rejection.json and docs/COCOS_REFACTOR_WORKLOG_20261102.md. No existing Godot art was changed. Remaining new candidates require style review; do not claim their structural checks prove style consistency.

- CURRENT COCOS IMPLEMENTATION 2026-11-02: user explicitly requested a new Cocos project and implementation of all discussed visual/gameplay changes. Independent cocos/ project now exists, Creator 3.8.8 loads the project-local official TapTap 1.2.2 extension, and the new V9 game has actually rendered in editor preview. Read docs/COCOS_REFACTOR_WORKLOG_20261102.md for current evidence and outstanding work before continuing. The older “not yet created” descriptions below are historical. Preserve Godot and old ZIPs. Do not stop at the current runnable slice or mark all 25 issues solved: asset replacement, UI/visual testing, ordinary campaign and actual TapTap package remain in progress. No new sprite sequences/H3, no platform publication, no ad-status polling.

- LATEST ENGINE AND TARGET 2026-11-02: user chose pale-beige outlines for interactable buildings and authorized implementation. The proposed Cocos migration targets genuine TapTap minigames, NOT an ordinary H5/Web Mobile release. Cocos Creator 3.8.8 is locally installed; TapTap's official 1.2.2 extension supports this version and converts a Cocos wechatgame intermediate build into build/TapBuild/game.zip. Read docs/COCOS_TAPTAP_TARGET.md before migration/build work. Preserve the existing Godot project, preview and release ZIPs as the historical baseline. The new Cocos implementation is not yet created or validated; do not claim the engine migration is complete. Earlier design-only and building-outline-choice-pending statements are superseded. App 1018356 remains the user's target; the shared MCP connection was found on old Magus 1007996 again, so never inherit its miniapp/ad settings. No upload, metadata change or publication is authorized.

- LATEST MOTION DIRECTION 2026-11-02: user requests future animation in a held-pose sticker/cutout style, no new frame-sequence or video-extraction production. This supersedes earlier V8 frame-generation authorization for future work. Preserve existing runtime clips until a replacement is explicitly developed and checked; do not restart old H3 queues. This turn is terminology, outline samples and documentation only. See docs/STICKER_MOTION_V9.md. Scene outlines are hierarchical: ordinary interactable buildings need visible pale-beige silhouette edges, selected buildings gold, foreground scenery darker/subdued, characters white/pink trial. Do not mistake the weak dark-building-edge rejected sample for the intended effect.

- LATEST DELIVERY AND APP 2026-11-01: user chose local delivery first and then explicitly supplied new app1018356. It is the selected non-level app《我是哥布林：君主》under developer510750; old1008093 is historical and must not be used. Current check_ads_status returns0, not activated, with no ad-space ID; wait for the user to activate and explicitly request a refresh, never poll or reuse another app's ID. No app metadata edits, uploads or publication are authorized. Local delivery has88 accepted runtime clips covering70 required core character states, with one same-sheet bat idle reuse. Scenery production is deferred. See docs/LOCAL_DELIVERY_20261101.md and qa/godot/local-delivery-validation.json; do not resume old animation queues or claim all optional per-rank reaction variants, phone performance or real ads are complete.

- LATEST USER SCOPE 2026-11-01: finish the game first. Finish necessary character animations, but defer further scenery/environment frame animation production and polish. Existing accepted scenery stays. Do not restart the old mixed cohort-30 queue; see artifacts/animation-v8/scope-20261101-characters-only.json. In-flight bird was submitted before this override and must only be recorded to terminal state, not adopted or expanded.

- LATEST FIRE OVERRIDE 2026-11-01: torch and campfire FLAMES must be procedural real-time effects, not frame animations. Reference patch-gg/pixelfx fire structure, adapt to the current non-pixel matte hand-painted style. Static handles, logs and building artwork remain original AI bitmaps. Remove baked static flames before overlaying procedural fire. Other approved character/environment animation work continues.

- LATEST V8 USER OVERRIDE 2026-10-31: character and environment frame animation production is now authorized. Read docs/ANIMATION_V8.md. Use the global game-sprite-animation and minimax-h3-local shared-lock workflow. Every sequence needs repeated source/alpha/loop/engine inspection before runtime adoption. Earlier static-only/deferred statements below are historical for this batch. Preserve existing approved non-pixel art identity. Stabilize the walk plane instead of following decorative grass bumps.

Read `docs/GAME_DESIGN.md`, `docs/PERFORMANCE_BUDGET.md`, and `docs/PROGRESS_HANDOFF.md` before planning or changing this game. `docs/GAME_DESIGN.md` is the current gameplay and scene specification, replacing the old Kingdom-style reskin baseline.

- Mobile landscape TapTap minigame is the primary target for the Cocos migration. Preserve content; reduce resident graphics, unnecessary rendering and update cost instead. Ordinary H5 is the historical Godot delivery route, not the new requested deliverable.
- Current authorization: implementation may proceed, including local Cocos migration preparation, while preserving the Godot baseline. User creates/manages the TapTap platform app themselves; do not create, modify or publish an app. project.godot remains the existing runnable implementation until its replacement passes acceptance.
- Original separately AI-generated bitmap art only. No procedural substitute sprites, buildings, textures or effects. Normal bitmap cropping, atlasing, transforms and frame playback are the asset pipeline, not creative asset generation.
- Environment update: sky must not have a fixed baked sunset/sun/clouds. Use separately generated static sky, sun/moon and cloud textures; time-based sun motion, sky tint changes and drifting clouds are required and do not mean generating frame animations. Foreground water and middle-ground land are separate assets/layers. Reject the old combined terrain and baked-sunset source as production inputs.
- Goblins must be ugly-cute and visibly sly: big pointed ears, crooked protruding nose, tiny uneven tusks, squinting smug grin, hunched compact silhouette and little round belly. Neither generic friendly green boys nor horror monsters. Only the monarch wears a crown; stolen-coin pockets remain distinguishable from the normal belly.
- LATEST ART DECISION: user explicitly adopted the newly generated NON-PIXEL flat hand-painted cartoon characters for the ENTIRE game. All characters, mounts, buildings, props, environment and UI art must share this new style. The pixel human source exec-e31868b5-2976-42e5-abe1-fe47a48d281d.png is rejected and must be regenerated. References are game/art/source/worker.png, hunter.png, monarch.png and trader.png. Earlier low-pixel goals and screenshot art style are superseded. Use clean irregular painted contours, broad matte close-valued color patches and little volume, no pixel blocks/stair-stepped edges/nearest-neighbor styling, no diffuse halos. Entire setting remains medieval fantasy. Human trader is bareheaded in a rough belted pullover tunic, cloth trousers and worn shoes, with coin pouch/ledger; no modern jacket or hat.
- All imprisoned characters must be fully inside the cage: render rear cage, prisoners, then front bars/frame, with heads/limbs/feet inside its bounds. One goblin alone drags each net-wrapped captive, leading toward the prison with a continuous rope; remove the old two-hauler rule. Check reflections for leftover hats or extra haulers.
- Every generated image requires inspection. CURRENT SCOPE: STATIC TEXTURES ONLY, no frame animation generation or production this round. Keep useful pose/weapon/alpha checks. The older eight-frame workflow is deferred until a later user request. Sword and shield must be in separate hands.
- All world interaction uses proximity plus a bottom contextual button. Left joystick moves horizontally only. No direct tapping world NPCs/buildings.
- Keep rewarded ads voluntary, unlimited and without watch cooldowns, at the three central merchants. Free restart. Reinforcements are two hunters OR two workers. Never invent ad success or TapTap IDs.
- Before any platform release work, read docs/TAPTAP_RELEASE_FINDINGS.md and recheck the actually selected app. A unique app ID does not prove non-level independent publication: current MCP create_app uses a level creation endpoint; Monarch 1008093 was also reported as a level game. Do not promise removal of testing/workshop/parent-collection labels or migration support without platform verification. Never operate on Magus 1007996 when intending Monarch 1008093.
- Save design decisions and review status in the project documents. Distinguish budget/estimates, desktop tests, real phone tests, and actual TapTap tests. Never report a target as measured performance.
- All visible copy, documentation, design images, labels and buttons must avoid the U+00B7 middle-dot separator. Use spaces, colons or line breaks instead. Check generated image text as well as source text.
- The former 12-hour requirement is a user constraint, not evidence of feasibility or completion. Scope changed substantially; do not claim the new systems already exist or pass old tests.

- LATEST V7 USER OVERRIDES 2026-10-31: read docs/WORLD_REWORK_V7.md. Prioritize gameplay and presentation over package budget. Currency is coins only with a 50-coin carried purse and manual hall treasury withdrawal. No dialogs except victory/defeat results; no player-facing explanatory copy. Direct proximity icon interactions and in-world price signs replace shop menus. Tool stalls have no sellers. Daylight noon attacks, always-active nearest-target enemy AI, tier-gated construction/territory, richer asymmetric forests/streams/production, living wounded versus still corpses, whip any goblin for hidden coins or temporary productivity with overstun. User explicitly permits procedural breathing glows, lights and richer environmental effects. Original AI bitmap artwork and deferred character frame animations remain.

- 全局显隐规范：所有出现与消失默认渐入渐出，包括金币槽、建筑虚影、提示、按钮、结算、角色/物件、状态替换和特效；只有用户明确要求某处不做才例外。使用统一过渡，快速折返从当前透明度接续，退场立刻停止交互，不让动画再次扣费、退款或发奖。遵循全局tianruy游戏开发规范及docs/VISIBILITY_TRANSITIONS.md。

- 最新UI与可读性决定：用户明确允许并要求靠近建筑时在屏幕上方用现有美术底板显示两行，大字建筑名、小字简短作用；这替代此前禁止所有说明文字的相关限制，其余仍无教程与商店弹窗。删除重复插地价格牌，保留费用金币虚影与远处未建造木牌。人物使用实心主体与清晰描边，交互对象用更宽、更亮的呼吸光边。建筑、树木与金币堆须实际贴合地面，钱袋袋身透明、每枚金币错落落入。
