"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GameModel = void 0;
const Rules_1 = require("./Rules");
const WorldUpgrade_1 = require("./WorldUpgrade");
const PrisonLayout_1 = require("./PrisonLayout");
const Progression_1 = require("./Progression");
const CampaignRules_1 = require("./CampaignRules");
const CampaignUpgrade_1 = require("./CampaignUpgrade");
/** 引擎无关的权威状态。动画、镜头和异步平台回调不能自行结算金币或伤害。 */
class GameModel {
    tell(text) { this.notice = { text, until: this.state.elapsed + 1.8 }; }
    isWhipTarget(id) { return this.whipFocused === id && this.state.elapsed < this.whipFocusUntil; }
    get nearbyTargets() { return this.candidates.length + (this.selected !== 0 && !this.candidates.some(c => c.id === this.selected) ? 1 : 0); }
    /** 密集营地允许用底部图标切换附近目标，仍然不直接点击世界对象。 */
    cycleTarget() {
        this.context();
        if (!this.candidates.length)
            return;
        const list = this.candidates.slice().sort((a, b) => a.x - b.x || a.id - b.id);
        const index = list.findIndex(c => c.id === this.selected);
        this.manualTarget = list[(index + 1) % list.length].id;
    }
    constructor(saved, seed = 731) {
        var _a, _b;
        this.safeCorpses = null;
        this.input = { axis: 0, run: false };
        this.pauses = new Set();
        this.dirty = true;
        this.events = [];
        this.selected = 0;
        this.whipFocused = 0;
        this.whipFocusUntil = 0;
        this.manualTarget = 0;
        this.candidates = [];
        this.selectionX = NaN;
        this.towerClock = 0;
        this.notice = null;
        this.mountChoice = 1;
        this.state = saved && saved.version === Rules_1.RULES.saveVersion ? saved : this.createState(seed);
        const oldRevision = this.state.revision || 0;
        (0, WorldUpgrade_1.upgradeWorld)(this.state);
        (0, Progression_1.upgradeProgression)(this.state);
        (0, CampaignUpgrade_1.upgradeCampaign)(this.state, oldRevision < 10);
        this.initializeCampaign();
        // 旧档的夜袭撤退指令在本轮废止，逃狱与巡逻回营仍走各自状态。
        for (const c of this.state.companies)
            c.retreating = false;
        // 飞行、按键与广告不是持久动作；读档不延续正在按住的交互。
        this.state.player.prevX = this.state.player.x;
        this.state.player.whip = 0;
        this.cancelPledge();
        // 开局赠送招募盘；旧档未开工的补齐，已付款施工和更高等级保留，读档不重复赠币。
        const starterLure = this.state.buildings.find(b => b.kind === 'lure');
        if (starterLure && starterLure.level === 0 && !starterLure.job)
            Object.assign(starterLure, { level: 1, hp: 100, maxHp: 100 });
        for (const n of this.state.goblins)
            n.prevX = n.x;
        for (const e of this.state.enemies) {
            e.prevX = e.x;
            (_a = e.ammo) !== null && _a !== void 0 ? _a : (e.ammo = 12);
            (_b = e.atPrison) !== null && _b !== void 0 ? _b : (e.atPrison = e.state === 'captured' || e.state === 'bound' && !e.hauler && Math.abs(e.x - this.prison.x) < 250);
        }
        for (const m of this.state.machines)
            m.prevX = m.x;
        for (const c of this.state.camps)
            if (!c.reserve) {
                const spec = Rules_1.RULES.camps[c.index], existing = this.state.enemies.filter(e => e.camp === c.index && !e.company).length;
                c.reserve = c.defeated ? [] : Array.from({ length: Math.max(0, spec.total - existing) }, (_, i) => spec.guard[i % spec.guard.length]);
                c.heroesPending = c.defeated ? [] : spec.heroes.slice();
                c.reinforcementClock = 3;
                this.createFortifications(c);
            }
    }
    createState(seed) {
        const s = {
            version: 9, revision: 12, seed, nextId: 1, elapsed: 0, time: 18, day: 1, status: 'playing', gold: 32, treasury: 8, battleCoinProgress: 0,
            gearStock: 0, equipmentStock: 0, populationPending: { hunter: 0, worker: 0 },
            player: { x: 400, prevX: 400, face: 1, hp: 100, stamina: 100, mount: 'boar', fly: 0, hurt: 0, whip: 0 },
            goblins: [], enemies: [], camps: [], companies: [], machines: [], buildings: [], coins: [], animals: [], shots: [], effects: [], gearDrops: [], fortifications: [], recruitment: { start: 0, limit: 1, count: 0, next: 130 },
            pledge: null, expedition: { state: 'home', camp: 0 }, unlockedMounts: ['boar'], mountBoost: {}, adReceipts: [],
            trader: { x: 2600, prevX: 2600, present: false, timer: 100, phase: 'away' }, raids: 0, kills: 0, sold: 0, spent: 0,
        };
        const add = (kind, x, level = 0, region = -1) => {
            var _a, _b;
            const hp = (_b = (_a = Rules_1.BUILDINGS[kind].hp) === null || _a === void 0 ? void 0 : _a[level]) !== null && _b !== void 0 ? _b : (level ? 100 : 0);
            s.buildings.push({ id: s.nextId++, kind, x, level, hp, maxHp: hp, region, stock: 0, timer: 0 });
        };
        add('treasury', 220, 1);
        add('hall', 400, 1);
        add('prison', 700, 1);
        add('gear', 910, 1);
        add('worker', 1200, 1);
        add('hunter', 1345, 1);
        add('brute', 1490, 1);
        add('lure', 1640, 1);
        add('flag', 970);
        add('forge', 1050);
        add('repair', 2550);
        add('goldMerchant', -130, 1);
        add('armyMerchant', -300, 1);
        add('mountMerchant', 50, 1);
        // 基础生产在首道墙内，不能把首个生产点放到联军必经的墙外。
        add('wall', 2100);
        add('tower', 2000);
        add('net', 2200);
        add('rock', 2300);
        add('farm', 1800);
        for (let i = 0; i < Rules_1.RULES.camps.length; i++) {
            const c = Rules_1.RULES.camps[i];
            s.camps.push({ id: s.nextId++, index: i, x: c.x, hp: c.hp, maxHp: c.hp, defeated: false, claimed: false, rewarded: false, rebuild: 0 });
            const extension = [780, 880, 940, 1000, -185][i];
            add('wall', c.x + extension, 0, i);
            add('tower', c.x + extension - 100, 0, i);
            if (i < 4) {
                add(i % 2 ? 'mine' : 'wood', c.x + 320 + i * 30, 0, i);
                add('farm', c.x + 490 + i * 40, 0, i);
            }
        }
        this.state = s;
        add('wall', 3250, 0, -2);
        add('tower', 3150, 0, -2);
        add('wood', 2760, 0, -2);
        add('farm', 2980, 0, -2);
        add('wall', 4250, 0, -2);
        add('tower', 4150, 0, -2);
        add('mine', 3700, 0, -2);
        for (let i = 0; i < 4; i++)
            s.goblins.push(this.makeGoblin('idle', 280 + i * 85));
        s.goblins[2].hidden = 2;
        for (const c of s.camps)
            this.spawnGuards(c);
        for (let i = 0; i < 32; i++) {
            const x = 1830 + i * ((Rules_1.RULES.shoreX - 2200) / 32);
            s.animals.push({ id: s.nextId++, kind: i % 4 ? 'rabbit' : 'deer', x, home: x, hp: i % 4 ? 8 : 17, face: i % 2 ? 1 : -1, moving: false, timer: i % 5 });
        }
        this.initializeCampaign();
        return s;
    }
    id() { return this.state.nextId++; }
    rand() { this.state.seed = (Math.imul(1664525, this.state.seed) + 1013904223) >>> 0; return this.state.seed / 4294967296; }
    get hall() { return this.state.buildings.find(b => b.kind === 'hall'); }
    get flag() { return this.state.buildings.find(b => b.kind === 'flag'); }
    get prison() { return this.state.buildings.find(b => b.kind === 'prison'); }
    get forge() { return this.state.buildings.find(b => b.kind === 'forge'); }
    get population() { return this.state.goblins.filter(n => !n.dead).length; }
    get populationLimit() { return Rules_1.RULES.population[this.hall.level || 1]; }
    get night() { return this.state.time >= 120; }
    get frontier() {
        const walls = this.state.buildings.filter(b => b.kind === 'wall' && b.hp > 0 && b.level > 0);
        return Math.max(1550, ...walls.map(b => b.x));
    }
    get flagUsed() { return this.state.goblins.filter(n => !n.dead && n.order !== 'home').length; }
    get flagCapacity() { return Rules_1.RULES.flagCapacity[this.flag.level] || 0; }
    get nearestCamp() { return this.state.camps.find(c => !c.defeated); }
    towerPosition(n) { const b = this.state.buildings.find(b => b.id === n.towerId); if (!b)
        return { x: n.x, height: 0 }; const line = this.state.goblins.filter(q => !q.dead && q.towerId === b.id).sort((a, b) => a.id - b.id), spot = (0, Progression_1.towerSpot)(b.level, Math.max(0, line.findIndex(q => q.id === n.id))); return { x: b.x + spot.x, height: spot.height }; }
    rebuildDuration(c) { return Rules_1.RULES.rebuildSeconds + c.index * Rules_1.RULES.rebuildPerRegion; }
    makeGoblin(role, x) {
        var _a;
        const hp = Rules_1.RULES.role[role].hp * Rules_1.RULES.hallFactor[((_a = this.hall) === null || _a === void 0 ? void 0 : _a.level) || 1];
        return { id: this.id(), role, x, prevX: x, face: 1, hp, maxHp: hp, cooldown: 0, timer: 0, targetX: x, moving: false, speed: 0,
            carry: 0, hidden: 0, lastWhip: this.state.elapsed, hit: 0, stunned: 0, strikes: 0, strikeAt: -10, gear: 0, loot: 0,
            order: 'home', task: '', targetId: 0, dead: false };
    }
    stats(n) {
        const base = Rules_1.RULES.role[n.role], hallFactor = Rules_1.RULES.hallFactor[Math.max(1, this.hall.level)];
        const factor = hallFactor * (1 + Rules_1.RULES.equipmentBonus[n.gear]);
        return { hp: base.hp * factor, attack: base.attack * factor, defense: base.defense * factor };
    }
    updateStats() {
        for (const n of this.state.goblins) {
            const old = n.maxHp;
            n.maxHp = this.stats(n).hp;
            if (!n.dead)
                n.hp = Math.min(n.maxHp, n.hp * n.maxHp / Math.max(1, old));
        }
    }
    efficiency(n) { return n.stunned > 0 ? 0 : this.state.elapsed - n.lastWhip < 45 ? 1.25 : Math.max(.8, 1 - (this.state.elapsed - n.lastWhip - 45) / 600); }
    logisticsFactor() { return 1 + (Math.max(1, this.hall.level) - 1) * .35; }
    visible(b) {
        if (b.level || b.job)
            return true;
        const def = Rules_1.BUILDINGS[b.kind];
        if (this.hall.level < def.hall)
            return false;
        if (b.region === -2 && !b.discovered)
            return false;
        if (b.kind === 'forge' && b.level === 0 && this.state.gearStock === 0)
            return this.hall.level >= 2;
        if (b.region >= 0 && !this.state.camps[b.region].defeated)
            return false;
        if (b.kind === 'repair' && !this.state.camps[1].rewarded)
            return false;
        return true;
    }
    context() {
        var _a;
        const p = this.state.player;
        const contexts = [];
        for (const b of this.state.buildings)
            if (this.visible(b) && Math.abs(b.x - p.x) < Rules_1.RULES.interactRange)
                contexts.push(this.buildingContext(b));
        for (const n of this.state.goblins)
            if (!n.dead && Math.abs(n.x - p.x) < Rules_1.RULES.interactRange) {
                const actions = [{ key: `whip:${n.id}`, targetId: n.id, type: 'whip', cost: 0, icon: 'icon_whip' }];
                if (this.flag.level && (n.role === 'hunter' || n.role === 'brute') && n.stunned <= 0)
                    actions.push({ key: `recruit:${n.id}`, targetId: n.id, type: 'recruit', cost: 0, icon: 'flag' });
                contexts.push({ id: n.id, kind: 'goblin', x: n.x, name: Rules_1.RULES.role[n.role].name, description: '', actions });
            }
        if (this.state.trader.present && this.state.trader.phase === 'trading' && Math.abs(this.state.trader.x - p.x) < Rules_1.RULES.interactRange) {
            const available = this.state.enemies.some(e => e.state === 'captured' || e.state === 'bound' && e.atPrison && !e.hauler);
            contexts.push({ id: -100, kind: 'trader', x: this.state.trader.x, name: '俘虏商人', description: '售出关押的俘虏', actions: [{ key: 'sell:trader', targetId: -100, type: 'sell', cost: 0, icon: 'coin', disabled: !available }] });
        }
        for (const m of this.state.machines)
            if (m.owner === 'goblin' && Math.abs(m.x - p.x) < Rules_1.RULES.interactRange + 20) {
                const name = { ram: '破门冲车', catapult: '缴获投石车', firecatapult: '火焰投石车' }[m.kind];
                const actions = [];
                if (m.order === 'park') {
                    if (m.hp < m.maxHp)
                        actions.push({ key: `repairMachine:${m.id}`, targetId: m.id, type: 'repairMachine', cost: Math.max(1, 4 - Math.ceil((((_a = this.state.buildings.find(b => b.kind === 'repair')) === null || _a === void 0 ? void 0 : _a.level) || 0) / 2)), icon: 'coin' });
                    else
                        actions.push({ key: `crew:${m.id}`, targetId: m.id, type: 'crew', cost: 2, icon: 'coin' });
                }
                contexts.push({ id: m.id, kind: 'machine', x: m.x, name, description: '征召两名苦力，推往出征旗帜', actions });
            }
        const standing = Number.isFinite(this.selectionX) && Math.abs(p.x - this.selectionX) < 7;
        contexts.sort((a, b) => {
            // 投币中保持目标，受击冷却不取消高亮；附近路过的爪牙不抢走建筑。
            const weight = (c) => {
                var _a;
                return Math.abs(c.x - p.x) + (c.kind === 'goblin' && Math.abs(c.x - p.x) > 14 ? 12 : 0) - (c.id === this.selected && c.kind !== 'goblin' ? 6 : 0) - (c.id === ((_a = this.state.pledge) === null || _a === void 0 ? void 0 : _a.targetId) ? 40 : 0)
                    - (standing && c.id === this.selected ? 1000 : 0) - (c.id === this.manualTarget ? 2000 : 0);
            };
            return weight(a) - weight(b);
        });
        this.candidates = contexts;
        if (!contexts.some(c => c.id === this.manualTarget))
            this.manualTarget = 0;
        // 原对象自行走远或离场时只收起操作，站定不把同一个按键悄悄转交别人。
        const lostStationaryTarget = standing && this.selected !== 0 && !this.manualTarget && !contexts.some(c => c.id === this.selected);
        const chosen = lostStationaryTarget ? undefined : contexts[0];
        // 建筑旁的哥布林仍能挨鞭子；按下后焦点移到挨打者，冷却不熄灭其光边。
        if (chosen && chosen.kind !== 'goblin' && chosen.actions.length < 3) {
            const near = contexts.filter(c => c.kind === 'goblin').sort((a, b) => Math.abs(a.x - p.x) - Math.abs(b.x - p.x))[0];
            if (near)
                chosen.actions.push(near.actions[0]);
        }
        if (chosen || !standing)
            this.selected = (chosen === null || chosen === void 0 ? void 0 : chosen.id) || 0;
        if (!standing || !Number.isFinite(this.selectionX))
            this.selectionX = p.x;
        return chosen || null;
    }
    buildingContext(b) {
        var _a, _b;
        const def = Rules_1.BUILDINGS[b.kind], actions = [];
        const push = (type, cost, icon = 'coin', variant, disabled = false) => actions.push({ key: `${type}:${b.id}:${variant || ''}`, targetId: b.id, type, cost, icon, variant, disabled });
        if (!b.job) {
            if (b.kind === 'treasury')
                push('withdraw', 0, 'chest', undefined, this.state.treasury <= 0 || this.state.gold >= 50);
            else if (b.kind === 'gear') {
                if (this.state.gearStock)
                    push('scrapGear', 0, 'coin');
            }
            else if (b.kind === 'goldMerchant')
                push('ad', 0, 'icon_play', 'gold');
            else if (b.kind === 'armyMerchant') {
                push('ad', 0, 'bow', 'hunter');
                push('ad', 0, 'hammer', 'worker');
            }
            else if (b.kind === 'mountMerchant') {
                const mount = this.nextMount();
                if (this.state.unlockedMounts.includes(mount))
                    push('mount', 0, mount, mount);
                else if (mount === 'lizard')
                    push('buyMount', 24, 'coin', mount);
                else
                    push('ad', 0, 'icon_play', mount);
                push('cycleMount', 0, 'icon_rotate');
                if ((mount === 'wolf' || mount === 'bat') && this.state.unlockedMounts.includes(mount))
                    push('ad', 0, 'icon_play', mount);
            }
            else if (b.level === 0 || b.hp <= 0 && b.maxHp > 0)
                push('build', b.level ? 2 : def.costs[0]);
            else {
                if (['worker', 'hunter', 'brute'].includes(b.kind))
                    push('tool', def.costs[0], 'coin', undefined, b.stock >= Rules_1.RULES.toolCapacity[b.level]);
                else if (b.kind === 'lure')
                    push('bait', 2, 'coin', undefined, b.stock >= b.level * 3 || this.population >= this.populationLimit);
                else if (b.kind === 'forge')
                    push('craft', Rules_1.RULES.equipmentPrice[b.level], 'coin', undefined, this.state.gearStock < 2 || this.state.equipmentStock >= 6);
                else if (b.kind === 'flag') {
                    if (this.state.expedition.state === 'hold')
                        push('dispatch', 3, 'coin', undefined, !this.canDispatch());
                    if (['march', 'hold', 'return'].includes(this.state.expedition.state))
                        push('recall', 0, 'icon_rotate');
                    else
                        push('dispatch', 3, 'coin', undefined, !this.canDispatch());
                }
                if (b.level < def.maxLevel && (0, Progression_1.upgradeAllowed)(this.state, b))
                    push('upgrade', def.costs[b.level], 'hammer');
                if (b.maxHp > 0 && b.hp < b.maxHp)
                    push('repairBuilding', 2, 'hammer');
            }
        }
        let description = b.job ? '苦力正在施工' : def.description;
        let name = def.name;
        if (b.level && def.maxLevel > 1) {
            name += ' ' + ['', 'I', 'II', 'III', 'IV', 'V'][b.level];
            if (!b.job && b.kind === 'hall')
                description = b.level >= 5 ? '部落已达巅峰' : (0, Progression_1.upgradeAllowed)(this.state, b) ? `人口 ${this.population}/${this.populationLimit}` : `攻下${((_a = Rules_1.RULES.camps[b.level - 2]) === null || _a === void 0 ? void 0 : _a.name) || '敌营'}后可扩建`;
            if (!b.job && b.kind === 'prison')
                description = `关押 ${this.state.enemies.filter(e => e.state === 'captured').length}/${Rules_1.RULES.prisonCapacity[b.level]}`;
            if (!b.job && b.kind === 'tower')
                description = `驻守猎手 ${this.state.goblins.filter(n => !n.dead && n.towerId === b.id).length}/${Rules_1.RULES.towerSlots[b.level]}`;
            if (!b.job && b.kind === 'forge')
                description = `猎手装备 增幅${Math.round(Rules_1.RULES.equipmentBonus[b.level] * 100)}%`;
        }
        if (b.kind === 'flag' && b.level) {
            const phase = ((_b = this.state.pledge) === null || _b === void 0 ? void 0 : _b.action.type) === 'dispatch' ? '出征' : ({ home: '集结', gather: '集结', march: '出征', hold: '驻守', return: '回撤' }[this.state.expedition.state]);
            name = phase + '旗帜';
            description = phase === '集结' ? `${this.flagUsed}/${this.flagCapacity}` : phase === '驻守' ? '守住战场，等待下一次命令' : phase === '回撤' ? '返回当前防线' : '军队自主进攻';
        }
        if (b.kind === 'treasury')
            description = '';
        if (b.kind === 'gear')
            description = `缴获装备 ${this.state.gearStock}`;
        if (b.kind === 'mountMerchant')
            description = Rules_1.RULES.mount[this.nextMount()].name;
        if (b.kind === 'goldMerchant')
            description = `观看广告，领取${this.adGoldReward}枚金币`;
        return { id: b.id, kind: b.kind, x: b.x, name, description, actions, level: b.level, amount: b.kind === 'treasury' ? this.state.treasury : undefined };
    }
    nextMount() { return ['boar', 'lizard', 'wolf', 'bat'][this.mountChoice % 4]; }
    /** 每次只投一枚；只有筹满才提交，离开或切换操作按原账户退还未提交款。 */
    act(action) {
        var _a;
        if (this.pauses.size || this.state.status !== 'playing' || action.disabled)
            return 'none';
        const context = this.context(), live = context === null || context === void 0 ? void 0 : context.actions.find(a => a.key === action.key);
        if (!live || live.disabled)
            return 'none';
        if (action.type === 'ad')
            return 'ad';
        if (!this.canCommit(action))
            return 'none';
        if (action.cost > 0) {
            if (((_a = this.state.pledge) === null || _a === void 0 ? void 0 : _a.key) !== action.key) {
                this.cancelPledge();
                this.state.pledge = { key: action.key, targetId: action.targetId, action: Object.assign({}, action), paid: 0, x: context.x };
            }
            if (this.state.gold <= 0)
                return 'none';
            this.state.gold--;
            this.state.pledge.paid++;
            this.events.push({ kind: 'coin', x: context.x });
            this.dirty = true;
            if (this.state.pledge.paid < action.cost)
                return 'done';
            this.state.spent += action.cost;
            this.state.pledge = null;
        }
        else if (this.state.pledge)
            this.cancelPledge();
        this.commit(action);
        this.dirty = true;
        return 'done';
    }
    canCommit(a) {
        if (a.type === 'crew') {
            const m = this.state.machines.find(m => m.id === a.targetId);
            if (this.flagCapacity - this.flagUsed < 2) {
                this.tell('集结已满');
                return false;
            }
            return !!m && m.order === 'park' && this.flag.level > 0 && this.flagCapacity - this.flagUsed >= 2 && this.availableWorkers().length >= 2;
        }
        if (a.type === 'dispatch')
            return this.canDispatch();
        if (a.type === 'tool') {
            const b = this.state.buildings.find(b => b.id === a.targetId);
            return !!b && b.stock < Rules_1.RULES.toolCapacity[b.level];
        }
        if (a.type === 'craft')
            return this.state.gearStock >= 2;
        return true;
    }
    /** 继续出征使用原驻守队，仍须主动投币；不按天数硬锁，也不自动连续攻营。 */
    canDispatch() { return !!this.nearestCamp && this.state.goblins.some(n => !n.dead && (n.order === 'gather' && Math.abs(n.x - this.gatherSpot(n)) < 80 || this.state.expedition.state === 'hold' && n.order === 'expedition')); }
    /** 旗后展开集结，避免八个人重叠或站到城墙外；苦力站在器械位置。 */
    gatherSpot(n) {
        const line = this.state.goblins.filter(g => !g.dead && g.order === 'gather' && g.role !== 'worker').sort((a, b) => (a.role === 'brute' ? 0 : 1) - (b.role === 'brute' ? 0 : 1) || a.id - b.id);
        return this.flag.x - 25 - Math.max(0, line.findIndex(g => g.id === n.id)) * 42;
    }
    cancelPledge() {
        if (!this.state.pledge)
            return;
        this.gain(this.state.pledge.paid); // 收到别的金币后再退款，超出钱袋的部分仍归主厅，不吞币也不突破上限。
        this.events.push({ kind: 'refund', x: this.state.pledge.x });
        this.state.pledge = null;
        this.dirty = true;
    }
    commit(a) {
        const s = this.state, b = s.buildings.find(b => b.id === a.targetId), n = s.goblins.find(n => n.id === a.targetId), m = s.machines.find(m => m.id === a.targetId);
        if (a.type === 'whip' && n) {
            this.whip(n);
            return;
        }
        if (a.type === 'recruit' && n) {
            if (n.order === 'home' && this.flagUsed >= this.flagCapacity) {
                this.tell('集结已满');
                return;
            }
            if (n.order === 'home' && this.flagUsed < this.flagCapacity && s.expedition.state !== 'march') {
                n.order = 'gather';
                n.task = '';
                s.expedition.state = 'gather';
            }
            else if (n.order === 'gather')
                n.order = 'home';
            return;
        }
        if (a.type === 'crew' && m) {
            const crew = this.availableWorkers().slice(0, 2);
            m.crew = crew.map(n => n.id);
            m.order = 'gather';
            for (const worker of crew) {
                worker.order = 'gather';
                worker.task = 'machine';
                worker.targetId = m.id;
            }
            s.expedition.state = 'gather';
            return;
        }
        if (a.type === 'repairMachine' && m) {
            m.hp = m.maxHp;
            return;
        }
        if (a.type === 'sell' && a.targetId === -100) {
            if (s.trader.present && s.trader.phase === 'trading')
                this.sellCaptives();
            return;
        }
        if (!b)
            return;
        switch (a.type) {
            case 'withdraw':
                if (s.treasury > 0 && s.gold < 50) {
                    s.treasury--;
                    s.gold++;
                    this.events.push({ kind: 'coin', x: b.x });
                }
                break;
            case 'scrapGear':
                if (s.gearStock) {
                    s.gearStock--;
                    this.gain(2);
                }
                break;
            case 'tool':
                b.stock++;
                break;
            case 'bait':
                if (!b.stock)
                    this.state.recruitment.next = Math.max(this.state.recruitment.next, s.elapsed + 50);
                b.stock++;
                break;
            case 'craft':
                s.gearStock -= 2;
                s.equipmentStock++;
                break;
            case 'cycleMount':
                this.mountChoice++;
                break;
            case 'buyMount':
                s.unlockedMounts.push(a.variant);
                s.player.mount = a.variant;
                break;
            case 'mount':
                s.player.mount = a.variant;
                break;
            case 'dispatch': {
                const camp = this.nearestCamp;
                if (!camp) {
                    if (s.camps.every(c => c.defeated))
                        this.finish('won');
                    break;
                }
                s.expedition = { state: 'march', camp: camp.index };
                for (const unit of s.goblins)
                    if (unit.order === 'gather')
                        unit.order = 'expedition';
                for (const machine of s.machines)
                    if (machine.order === 'gather')
                        machine.order = 'expedition';
                break;
            }
            case 'recall':
                s.expedition.state = 'return';
                for (const unit of s.goblins)
                    if (unit.order !== 'home')
                        unit.order = 'return';
                for (const machine of s.machines)
                    if (machine.order === 'expedition' || machine.order === 'gather')
                        machine.order = 'return';
                break;
            case 'upgrade':
            case 'build':
            case 'repairBuilding': {
                const repair = a.type === 'repairBuilding' || a.type === 'build' && b.level > 0;
                b.job = { left: Rules_1.RULES.constructionSeconds + b.level * 6, total: Rules_1.RULES.constructionSeconds + b.level * 6, next: repair ? b.level : b.level + 1, repair };
                // 玩家付币施工优先于搜尸和运货，明确预约一名苦力，避免大地图物流拖垮建设。
                const builder = s.goblins.filter(n => !n.dead && n.role === 'worker' && n.order === 'home' && !['machine', 'construction', 'haul', 'lootReturn'].includes(n.task) && n.loot === 0).sort((n, q) => Math.abs(n.x - b.x) - Math.abs(q.x - b.x))[0];
                if (builder) {
                    if (builder.task === 'salvageMachine') {
                        const m = s.machines.find(m => m.id === builder.targetId);
                        if (m)
                            m.crew = [];
                    }
                    builder.task = 'construction';
                    builder.targetId = b.id;
                }
                break;
            }
        }
    }
    availableWorkers() { return this.state.goblins.filter(n => !n.dead && n.role === 'worker' && n.order === 'home' && n.stunned <= 0 && !n.task); }
    whip(n) {
        const s = this.state;
        if (n.hit > .38 || n.dead)
            return;
        n.hit = .62;
        n.lastWhip = s.elapsed;
        this.manualTarget = 0;
        this.whipFocused = n.id;
        this.whipFocusUntil = s.elapsed + 1;
        n.strikes = s.elapsed - n.strikeAt < 4 ? n.strikes + 1 : 1;
        n.strikeAt = s.elapsed;
        // 私藏和准备上交的金币同样是实物，先清空携带再掉落，后续入库不能再结算。
        const coins = n.hidden + n.carry;
        n.hidden = 0;
        n.carry = 0;
        if (coins)
            this.drop(n.x + Math.sign(n.x - s.player.x || s.player.face) * 24, coins);
        if (n.loot > 0) {
            this.state.gearDrops.push({ id: this.id(), x: n.x + 25 * s.player.face, amount: n.loot, age: 0 });
            n.loot = 0;
            if (n.task === 'lootReturn')
                n.task = '';
        }
        if (n.strikes >= 4) {
            n.stunned = 8;
            n.strikes = 0;
        }
        s.player.face = n.x < s.player.x ? -1 : 1;
        s.player.whip = .45;
        this.effect('hit', n.x, .45);
        this.events.push({ kind: 'whip', x: n.x });
    }
    gain(amount) {
        const fit = Math.max(0, Math.min(amount, 50 - this.state.gold));
        this.state.gold += fit;
        this.state.treasury += amount - fit;
        this.dirty = true;
    }
    drop(x, value) {
        if (value <= 0)
            return;
        const c = this.state.coins.find(c => Math.abs(c.x - x) < 18);
        if (c)
            c.value += value;
        else
            this.state.coins.push({ id: this.id(), x, value, age: 0 });
    }
    effect(kind, x, life = .5, size = 1) {
        if (this.state.effects.length > 100)
            this.state.effects.shift();
        this.state.effects.push({ id: this.id(), kind, x, age: 0, life, size });
    }
    /** 仅真实平台完成回调可调用；去重收据与奖励一起进入存档。 */
    get adGoldReward() { return 9 + Math.max(1, this.state.day); }
    grantAdReward(kind, receipt) {
        const s = this.state;
        if (!receipt || s.adReceipts.includes(receipt) || !['gold', 'hunter', 'worker', 'wolf', 'bat'].includes(kind))
            return false;
        if (kind === 'gold')
            this.gain(this.adGoldReward);
        else if (kind === 'hunter' || kind === 'worker') {
            s.populationPending[kind] += 2;
            this.fillPending();
        }
        else {
            const mount = kind;
            if (!s.unlockedMounts.includes(mount))
                s.unlockedMounts.push(mount);
            else
                s.mountBoost[mount] = (s.mountBoost[mount] || 0) + 300;
            s.player.mount = mount;
        }
        s.adReceipts.push(receipt);
        this.dirty = true;
        return true;
    }
    fillPending() {
        for (const role of ['hunter', 'worker'])
            while (this.state.populationPending[role] > 0 && this.population < this.populationLimit) {
                this.state.populationPending[role]--;
                this.state.goblins.push(this.makeGoblin(role, 500));
            }
    }
    finishJob(b) {
        var _a, _b;
        if (!b.job)
            return;
        for (const n of this.state.goblins)
            if (!n.dead && n.task === 'construction' && n.targetId === b.id)
                n.buildRestUntil = this.state.elapsed + 18;
        const upgrade = !b.job.repair;
        b.level = b.job.next;
        b.job = undefined;
        b.maxHp = (_b = (_a = Rules_1.BUILDINGS[b.kind].hp) === null || _a === void 0 ? void 0 : _a[b.level]) !== null && _b !== void 0 ? _b : 100;
        b.hp = b.maxHp;
        if (b.kind === 'hall')
            this.updateStats();
        if (b.kind === 'forge' && upgrade) {
            for (const n of this.state.goblins)
                if (n.gear && !n.dead)
                    n.gear = b.level;
            this.updateStats();
        }
        if (b.kind === 'wall' && b.region >= 0) {
            const c = this.state.camps[b.region];
            c.claimed = c.defeated;
            c.rebuild = 0;
        }
        if ((b.kind === 'wall' || b.kind === 'flag') && this.flag.level && b.hp > 0)
            this.relocateFlag();
        this.effect('smoke', b.x, .7, 2);
        this.events.push({ kind: 'build', x: b.x });
        this.dirty = true;
    }
    /** 防线失守也要回退旗帜，不能把唯一重新集结入口遗留在复建的敌营后方。 */
    relocateFlag() {
        const wall = this.state.buildings.filter(w => w.kind === 'wall' && w.level && w.hp > 0).sort((a, b) => b.x - a.x)[0];
        this.flag.x = wall ? wall.x - 270 : 970;
    }
    sellCaptives() {
        var _a;
        const s = this.state;
        if (!s.trader.present || s.trader.phase !== 'trading')
            return;
        let income = 0;
        for (const e of s.enemies)
            if (e.state === 'captured' || e.state === 'bound' && !e.hauler && Math.abs(e.x - this.prison.x) < 250) {
                e.state = 'sold';
                e.timer = 0;
                s.sold++;
                income += e.hero ? (((_a = Rules_1.HEROES[e.hero]) === null || _a === void 0 ? void 0 : _a.boss) ? 24 : 12) : Rules_1.RULES.enemy[e.kind].value;
            }
        // 当面交易先给钱袋，溢出照常入库；钱袋金币落入动画与到账同步。
        if (income) {
            this.gain(income);
            this.effect('coin', s.trader.x, .8);
            this.events.push({ kind: 'coin', x: s.trader.x });
            this.dirty = true;
        }
    }
    finish(status) { this.cancelPledge(); this.state.status = status; this.input.axis = 0; this.input.run = false; this.dirty = true; }
    restart() {
        const mounts = this.state.unlockedMounts, receipts = this.state.adReceipts, pending = this.state.populationPending;
        this.state = this.createState(this.state.seed);
        this.state.unlockedMounts = mounts;
        this.state.adReceipts = receipts;
        this.state.populationPending = pending;
        this.selected = 0;
        this.manualTarget = 0;
        this.selectionX = NaN;
        this.notice = null;
        this.pauses.clear();
        this.input = { axis: 0, run: false };
        this.dirty = true;
    }
    snapshot() { return JSON.parse(JSON.stringify(this.state)); }
    pause(key, enabled) {
        if (enabled)
            this.pauses.add(key);
        else
            this.pauses.delete(key);
        this.input.axis = 0;
        this.input.run = false;
    }
    // 模拟和AI实现接续在下方，固定步长由控制器提供。
    tick(dt) { this.advance(dt); }
    advance(dt) {
        var _a, _b, _c, _d, _e;
        if (this.pauses.size || this.state.status !== 'playing')
            return;
        dt = (0, Rules_1.clamp)(dt, 0, .1);
        const s = this.state, p = s.player, before = s.time;
        if (p.hp <= 0) {
            this.finish('lost');
            return;
        }
        s.elapsed += dt;
        s.time += dt;
        if (s.time >= Rules_1.RULES.daySeconds) {
            s.time -= Rules_1.RULES.daySeconds;
            s.day++;
            this.campaignDay();
            this.dirty = true;
        }
        if (before < Rules_1.RULES.raidAt && s.time >= Rules_1.RULES.raidAt)
            this.spawnRaid();
        p.prevX = p.x;
        p.hurt = Math.max(0, p.hurt - dt);
        p.whip = Math.max(0, p.whip - dt);
        const moving = Math.abs(this.input.axis) > .14, mount = Rules_1.RULES.mount[p.mount];
        const boosted = (s.mountBoost[p.mount] || 0) > 0;
        if (p.stamina <= 1)
            p.exhausted = true;
        if (p.stamina >= 30)
            p.exhausted = false;
        const run = moving && this.input.run && (!p.exhausted && p.stamina > 1 || boosted);
        if (moving) {
            p.face = Math.sign(this.input.axis);
            const next = (0, Rules_1.clamp)(p.x + p.face * mount.speed * (run ? 1.75 : 1) * (boosted ? 1.2 : 1) * dt, Rules_1.RULES.worldMin + 95, Rules_1.RULES.worldMax);
            p.x = this.stopAtEnemyWall(p.x, next);
            p.whip = 0;
        }
        p.stamina = (0, Rules_1.clamp)(p.stamina + (run && !boosted ? -19 : moving ? 7 : 22) * dt, 0, mount.stamina);
        const flight = p.mount === 'bat' && run ? 42 : 0;
        p.fly += (flight - p.fly) * Math.min(1, dt * 6);
        if (Math.abs(p.x - this.hall.x) < 150 && this.hall.hp > 0 && !this.activeEnemies().some(e => Math.abs(e.x - p.x) < 250))
            p.hp = Math.min(100, p.hp + dt * 8);
        if (s.pledge && (Math.abs(p.x - s.pledge.x) > Rules_1.RULES.cancelRange || !((_a = this.context()) === null || _a === void 0 ? void 0 : _a.actions.some(a => a.key === s.pledge.key))))
            this.cancelPledge();
        for (const n of s.goblins) {
            n.prevX = n.x;
            n.moving = false;
            n.speed = 0;
        }
        for (const e of s.enemies) {
            e.prevX = e.x;
            e.moving = false;
        }
        for (const m of s.machines) {
            m.prevX = m.x;
            m.moving = false;
        }
        this.updateRaidQueue(dt);
        this.updateDayPatrols();
        this.updateBuildings(dt);
        this.updateGarrisons(dt);
        this.updateGoblins(dt);
        this.updateEnemies(dt);
        this.updateMachines(dt);
        this.updateAnimals(dt);
        this.updateShots(dt);
        this.updatePrison(dt);
        this.updateCampaign(dt);
        for (const c of s.coins) {
            c.age += dt;
            if (Math.abs(c.x - p.x) < 38 && p.fly < 12) {
                this.gain(c.value);
                c.value = 0;
                this.events.push({ kind: 'coin', x: c.x });
            }
        }
        s.coins = s.coins.filter(c => c.value > 0);
        for (const item of s.gearDrops) {
            item.age += dt;
            if (item.age > .7 && Math.abs(item.x - p.x) < 42) {
                s.gearStock += item.amount;
                item.amount = 0;
                this.events.push({ kind: 'coin', x: item.x });
                this.dirty = true;
            }
        }
        s.gearDrops = s.gearDrops.filter(item => item.amount > 0);
        for (const f of s.effects) {
            f.age += dt;
            if (f.kind === 'warning' && !f.fired && f.age >= f.life - .05) {
                f.fired = true;
                this.blast(f.x, 55 * f.size, (_b = f.damage) !== null && _b !== void 0 ? _b : 16, false);
                this.effect('fire', f.x, 4, f.size);
                s.effects[s.effects.length - 1].tickDamage = (_c = f.tickDamage) !== null && _c !== void 0 ? _c : 4;
            }
            if (f.kind === 'fire' && f.age > (f.nextTick || .8)) {
                f.nextTick = (f.nextTick || .8) + .8;
                this.blast(f.x, 38 * f.size, (_d = f.tickDamage) !== null && _d !== void 0 ? _d : 4, true);
                this.blast(f.x, 38 * f.size, (_e = f.tickDamage) !== null && _e !== void 0 ? _e : 4, false);
            }
        }
        s.effects = s.effects.filter(f => f.age < f.life);
        for (const k of Object.keys(s.mountBoost))
            s.mountBoost[k] = Math.max(0, s.mountBoost[k] - dt);
        this.fillPending();
        if (p.hp <= 0)
            this.finish('lost');
    }
    activeEnemies() { return this.state.enemies.filter(e => e.state === 'active' || e.state === 'escaping'); }
    /** 扫过整段位移，奔跑、低飞和低帧率都不能越过尚未拆毁的敌墙。 */
    stopAtEnemyWall(from, to) {
        const direction = Math.sign(to - from) || 1;
        const gates = this.state.fortifications.filter(f => f.kind === 'gate' && f.hp > 0).sort((a, b) => direction * (a.x - b.x));
        for (const gate of gates) {
            const pad = Rules_1.RULES.enemyWallClearance[(0, Rules_1.clamp)((gate.rank || 2) - 2, 0, 3)];
            if (Math.abs(from - gate.x) < pad)
                return gate.x + (from < gate.x ? -pad : from > gate.x ? pad : -direction * pad);
            if (direction > 0 && from <= gate.x - pad && to > gate.x - pad)
                return gate.x - pad;
            if (direction < 0 && from >= gate.x + pad && to < gate.x + pad)
                return gate.x + pad;
        }
        return to;
    }
    get daytimeRoaming() { return this.state.time >= 16 && this.state.time < Rules_1.RULES.patrolRecall; }
    /** 外出止于敌营外围，未征召的居民不擅自攻城。 */
    roamLimit() {
        var _a;
        const camp = this.nearestCamp;
        if (!camp)
            return Math.min(Rules_1.RULES.worldMax - 200, this.frontier + Rules_1.RULES.patrolReach);
        const gate = this.state.fortifications.filter(f => f.camp === camp.index && f.kind === 'gate' && f.hp > 0).sort((a, b) => a.x - b.x)[0];
        return Math.max(this.frontier, Math.min(this.frontier + Rules_1.RULES.patrolReach, ((_a = gate === null || gate === void 0 ? void 0 : gate.x) !== null && _a !== void 0 ? _a : camp.x - Rules_1.RULES.camps[camp.index].width * .5) - 240));
    }
    /** 每营每天一队2至3名普通外征兵，使用真实储备ID；不借走守备或当晚预留编制。 */
    updateDayPatrols() {
        var _a, _b, _c;
        const s = this.state;
        if (!this.daytimeRoaming)
            return;
        (_a = s.patrolDays) !== null && _a !== void 0 ? _a : (s.patrolDays = []);
        for (const camp of s.camps) {
            if (camp.defeated || s.time < Rules_1.RULES.patrolStart + camp.index * 5 || s.patrolDays[camp.index] === s.day)
                continue;
            if (s.enemies.some(e => e.patrol && e.camp === camp.index && e.state === 'active'))
                continue;
            s.patrolDays[camp.index] = s.day;
            const front = camp.index === ((_c = (_b = this.nearestCamp) === null || _b === void 0 ? void 0 : _b.index) !== null && _c !== void 0 ? _c : -1), edge = camp.x - Rules_1.RULES.camps[camp.index].width * .52;
            const destination = front ? Math.max(this.frontier + 220, Math.min(edge - 200, this.frontier + 650)) : edge - 650;
            const choices = (0, CampaignRules_1.expandRoster)(CampaignRules_1.GUARD_ROSTERS[camp.index]).filter(u => !u.hero);
            for (let i = 0; i < 2 + (s.day + camp.index) % 2; i++) {
                const spec = choices[(s.day + i * 7) % choices.length];
                let index = s.army.reserve.findIndex(n => n.kind === spec.kind && !n.hero && (n.readyAt || 0) <= s.elapsed);
                if (index < 0) {
                    s.army.reserve.push(this.soldier(spec, camp.index));
                    s.army.recruited++;
                    index = s.army.reserve.length - 1;
                }
                const unit = s.army.reserve.splice(index, 1)[0], e = this.makeEnemy(unit.kind, edge - i * 34, camp.index, 0, unit);
                e.force = 'field';
                e.patrol = true;
                e.roamX = destination + i * 45;
            }
            this.dirty = true;
        }
    }
    /** 局部人数只计算能够参战的活单位，逃跑者和高塔射手不虚增野外兵力。 */
    localNumbers(x) {
        const radius = Rules_1.RULES.patrolRadius, s = this.state;
        return { goblins: s.goblins.filter(n => !n.dead && n.stunned <= 0 && !n.towerId && (n.role === 'hunter' || n.role === 'brute') && Math.abs(n.x - x) <= radius).length,
            enemies: s.enemies.filter(e => e.state === 'active' && !e.towerId && Math.abs(e.x - x) <= radius).length };
    }
    /** 按基础模板计算一次，移除旧按营地额外增加血量的隐藏系数。 */
    enemyStats(e) {
        var _a, _b;
        const h = Rules_1.HEROES[e.hero || ''], base = Rules_1.RULES.enemy[e.kind], scale = (_a = e.scale) !== null && _a !== void 0 ? _a : (0, CampaignRules_1.enemyFactor)(this.state.day);
        return { hp: ((h === null || h === void 0 ? void 0 : h.hp) || base.hp) * scale, attack: ((h === null || h === void 0 ? void 0 : h.attack) || base.attack) * scale, defense: ((_b = h === null || h === void 0 ? void 0 : h.defense) !== null && _b !== void 0 ? _b : base.defense) * scale, range: (h === null || h === void 0 ? void 0 : h.skill) === 'volley' ? 330 : (h === null || h === void 0 ? void 0 : h.skill) === 'meteor' ? 370 : base.range, speed: base.speed };
    }
    makeEnemy(kind, x, camp, company = 0, soldier) {
        var _a, _b, _c;
        const e = { id: (_a = soldier === null || soldier === void 0 ? void 0 : soldier.id) !== null && _a !== void 0 ? _a : this.id(), kind, x, prevX: x, face: -1, hp: 1, maxHp: 1, cooldown: .4, company, camp, state: 'active', timer: 0,
            moving: false, hit: 0, stripped: false, counted: false, hauler: 0, prisonSlot: -1, snared: 0, spells: 6, ammo: 12, atPrison: false,
            force: company ? 'field' : 'guard', scale: (0, CampaignRules_1.enemyFactor)(this.state.day), hero: soldier === null || soldier === void 0 ? void 0 : soldier.hero, sourceCamp: (_b = soldier === null || soldier === void 0 ? void 0 : soldier.sourceCamp) !== null && _b !== void 0 ? _b : camp };
        const h = Rules_1.HEROES[e.hero || ''];
        if (h)
            e.bodyHeight = h.height;
        e.maxHp = this.enemyStats(e).hp;
        e.hp = e.maxHp * ((_c = soldier === null || soldier === void 0 ? void 0 : soldier.hpRatio) !== null && _c !== void 0 ? _c : 1);
        this.state.enemies.push(e);
        return e;
    }
    soldier(spec, sourceCamp) { return { id: this.id(), kind: spec.kind, hero: spec.hero, sourceCamp }; }
    initializeCampaign() {
        var _a, _b, _c, _d;
        const s = this.state;
        for (const c of s.camps) {
            if (!c.guardQueue)
                c.guardQueue = [...(c.heroesPending || []).map(hero => ({ kind: Rules_1.HEROES[hero].kind, hero })), ...(c.reserve || []).map(kind => ({ kind }))].map(u => this.soldier(u, c.index));
            c.reserve = [];
            c.heroesPending = [];
            (_a = c.lastReinforcedDay) !== null && _a !== void 0 ? _a : (c.lastReinforcedDay = s.day);
        }
        for (const e of s.enemies) {
            (_b = e.force) !== null && _b !== void 0 ? _b : (e.force = e.company ? 'field' : 'guard');
            if (e.scale === undefined) {
                const ratio = e.hp / Math.max(1, e.maxHp);
                e.scale = (0, CampaignRules_1.enemyFactor)(s.day);
                if (e.state === 'active' || e.state === 'escaping') {
                    e.maxHp = this.enemyStats(e).hp;
                    e.hp = e.maxHp * ratio;
                }
            }
        }
        if (!s.army) {
            const reserve = [].concat(...CampaignRules_1.OPENING_FIELD.map((r, i) => (0, CampaignRules_1.expandRoster)(r).map(u => this.soldier(u, i))));
            for (const c of s.companies)
                for (const p of c.pending || []) {
                    (_c = p.id) !== null && _c !== void 0 ? _c : (p.id = this.id());
                    (_d = p.sourceCamp) !== null && _d !== void 0 ? _d : (p.sourceCamp = c.camp);
                }
            s.army = { reserve, initial: reserve.length + s.companies.reduce((n, c) => { var _a; return n + (((_a = c.pending) === null || _a === void 0 ? void 0 : _a.length) || 0); }, 0) + s.enemies.filter(e => e.company && !e.counted && (e.state === 'active' || e.state === 'escaping')).length, recruited: 0, lost: 0, recovered: 0, retired: 0, transferred: 0, returned: 0, guardInitial: s.camps.reduce((n, c) => n + this.campRemaining(c), 0), guardRecruited: 0, guardLost: 0, guardRecovered: 0, guardTransferred: 0, enginesBuilt: 0 };
            // 迁移只替换防线布局，已有敌方设施按原损伤比保留，不借更新免费修好。
            const old = s.fortifications || [];
            s.fortifications = [];
            for (const c of s.camps) {
                this.createFortifications(c);
                for (const kind of ['gate', 'tower']) {
                    const before = old.filter(f => f.camp === c.index && f.kind === kind), after = s.fortifications.filter(f => f.camp === c.index && f.kind === kind);
                    for (let i = 0; i < Math.min(before.length, after.length); i++)
                        after[i].hp = after[i].maxHp * before[i].hp / Math.max(1, before[i].maxHp);
                }
            }
        }
        if (!s.raidPrep && !s.companies.some(c => c.day === s.day || c.day === undefined && s.time >= Rules_1.RULES.raidAt && s.elapsed - c.spawnedAt < Rules_1.RULES.daySeconds))
            this.prepareRaid(s.day);
    }
    spawnGuards(c) {
        const s = this.state, initial = !c.guardQueue;
        if (initial)
            c.guardQueue = (0, CampaignRules_1.guardSpecs)(c.index).map(u => this.soldier(u, c.index));
        else {
            // 复建使用新的实际调拨，绝不复活被俘或死去的原驻军。
            const desired = (0, CampaignRules_1.guardSpecs)(c.index);
            for (const u of desired) {
                let i = s.army.reserve.findIndex(n => n.kind === u.kind && n.hero === u.hero);
                if (i < 0) {
                    s.army.reserve.push(this.soldier(u, 4));
                    s.army.recruited++;
                    i = s.army.reserve.length - 1;
                }
                c.guardQueue.push(s.army.reserve.splice(i, 1)[0]);
                s.army.transferred++;
                s.army.guardTransferred++;
            }
        }
        c.reserve = [];
        c.heroesPending = [];
        c.reinforcementClock = 3;
        c.lastReinforcedDay = s.day;
        for (const f of s.fortifications || [])
            if (f.camp === c.index) {
                f.hp = f.maxHp;
                f.cooldown = 2;
            }
        this.createFortifications(c);
        for (let i = 0; i < 6 && c.guardQueue.length; i++) {
            const soldier = c.guardQueue.shift();
            this.makeEnemy(soldier.kind, c.x - Rules_1.RULES.camps[c.index].width * .25 + i * 35, c.index, 0, soldier);
        }
    }
    createFortifications(c) {
        const s = this.state, spec = CampaignRules_1.FORTS[c.index];
        if (c.defeated || s.fortifications.some(f => f.camp === c.index))
            return;
        const width = Rules_1.RULES.camps[c.index].width;
        const gates = spec.walls === 3 ? [-.48, -.08, .29] : spec.walls === 2 ? [-.47, .22] : spec.walls === 1 ? [-.45] : [];
        for (let i = 0; i < gates.length; i++) {
            const hp = 160 + c.index * 75 + i * 35;
            s.fortifications.push({ id: this.id(), camp: c.index, kind: 'gate', x: c.x + width * gates[i], hp, maxHp: hp, cooldown: 2, rank: Math.min(5, 2 + i + c.index - 2) });
        }
        const offsets = spec.levels.length === 4 ? [-.35, -.10, .15, .37] : spec.levels.length === 3 ? [-.32, .02, .34] : [-.24, .30];
        for (let i = 0; i < spec.levels.length; i++) {
            const hp = 90 + c.index * 40;
            s.fortifications.push({ id: this.id(), camp: c.index, kind: 'tower', x: c.x + width * offsets[i], hp, maxHp: hp, cooldown: 2, levels: spec.levels[i], rank: spec.levels[i] === 3 ? 5 : spec.levels[i] === 2 ? 3 : 1 });
        }
    }
    /** 新一天仅按日期成长，现有血量比例和被俘状态保持。 */
    campaignDay() {
        const s = this.state, scale = (0, CampaignRules_1.enemyFactor)(s.day);
        for (const e of s.enemies)
            if (e.state === 'active' || e.state === 'escaping') {
                const ratio = e.hp / Math.max(1, e.maxHp);
                e.scale = scale;
                e.maxHp = this.enemyStats(e).hp;
                e.hp = e.maxHp * ratio;
            }
        for (const m of s.machines)
            if (m.owner === 'enemy' && m.hp > 0) {
                const ratio = m.hp / m.maxHp;
                m.scale = scale;
                m.maxHp = 130 * scale;
                m.hp = m.maxHp * ratio;
            }
        for (const c of s.camps)
            if (c.lastReinforcedDay !== s.day) {
                c.lastReinforcedDay = s.day;
                if (c.defeated || c.hp <= 0)
                    continue;
                const slots = Math.min([1, 2, 2, 3, 2][c.index], (0, CampaignRules_1.guardCapacity)(c.index, s.day) - this.campRemaining(c));
                const ordinary = (0, CampaignRules_1.expandRoster)(CampaignRules_1.GUARD_ROSTERS[c.index]).filter(u => !u.hero);
                for (let i = 0; i < slots; i++) {
                    c.guardQueue.push(this.soldier(ordinary[(s.day + i) % ordinary.length], c.index));
                    s.army.guardRecruited++;
                }
            }
        this.prepareRaid(s.day);
    }
    /** 船队真实补员并预留当日编制，局部初始库存不能成为阶段锁。 */
    prepareRaid(day) {
        var _a, _b;
        const s = this.state;
        if (!s.army || ((_a = s.raidPrep) === null || _a === void 0 ? void 0 : _a.day) === day)
            return;
        if (s.raidPrep)
            s.army.reserve.push(...s.raidPrep.units);
        const plan = (0, CampaignRules_1.raidPlan)(day), units = [];
        for (const u of plan.units) {
            const index = s.army.reserve.findIndex(n => n.kind === u.kind && n.hero === u.hero && (n.readyAt || 0) <= s.elapsed);
            let n;
            if (index >= 0)
                n = s.army.reserve.splice(index, 1)[0];
            else {
                n = this.soldier(u, 4);
                s.army.recruited++;
            }
            units.push(n);
        }
        const engines = [];
        for (const kind of plan.engines) {
            let m = s.machines.find(m => m.kind === kind && m.owner === 'enemy' && m.order === 'reserve' && m.hp > 0);
            if (!m) {
                const scale = (0, CampaignRules_1.enemyFactor)(day);
                m = { id: this.id(), kind, x: Math.min(Rules_1.RULES.worldMax - 100, (((_b = this.nearestCamp) === null || _b === void 0 ? void 0 : _b.x) || Rules_1.RULES.camps[4].x) + 260), prevX: 0, hp: 130 * scale, maxHp: 130 * scale, owner: 'enemy', company: 0, crew: [], order: 'reserve', cooldown: 5, moving: false, scale };
                m.prevX = m.x;
                s.machines.push(m);
                s.army.enginesBuilt++;
            }
            engines.push(m.id);
            m.company = -day;
        }
        s.raidPrep = { day, units, engines, eliteBudget: plan.eliteBudget };
        // 退役过时的在营外征普通兵，记录转出而非死亡；不驱逐正在交战或刚预留的士兵。
        const cap = 122 + (0, CampaignRules_1.raidPlan)(day).units.length * 2;
        while (s.army.reserve.length > cap) {
            s.army.reserve.shift();
            s.army.retired++;
        }
    }
    enemyTowerPosition(e) {
        const f = this.state.fortifications.find(f => f.id === e.towerId && f.hp > 0);
        if (!f)
            return { x: e.x, height: 0 };
        const crew = this.state.enemies.filter(n => n.state === 'active' && n.towerId === f.id).sort((a, b) => a.id - b.id), rank = Math.max(0, crew.findIndex(n => n.id === e.id)), spot = (0, Progression_1.towerSpot)((f.levels || 1) === 3 ? 5 : (f.levels || 1) === 2 ? 3 : 1, rank);
        return { x: f.x + spot.x, height: spot.height };
    }
    updateGarrisons(dt) {
        var _a, _b;
        const s = this.state;
        for (const c of s.camps) {
            if (c.defeated)
                continue;
            const near = Math.abs(s.player.x - c.x) < 2400 || s.goblins.some(n => !n.dead && Math.abs(n.x - c.x) < 2100);
            if (!near)
                continue;
            c.reinforcementClock = ((_a = c.reinforcementClock) !== null && _a !== void 0 ? _a : 3) - dt;
            if (c.reinforcementClock > 0)
                continue;
            c.reinforcementClock = 4.5;
            let active = s.enemies.filter(e => e.camp === c.index && e.force !== 'field' && !e.company && e.state === 'active').length;
            for (let i = 0; i < 3 && active < (c.index === 0 ? 10 : Rules_1.RULES.maxGarrisonActive + CampaignRules_1.FORTS[c.index].levels.reduce((a, b) => a + b, 0)) && ((_b = c.guardQueue) === null || _b === void 0 ? void 0 : _b.length); i++, active++) {
                const soldier = c.guardQueue.shift();
                this.makeEnemy(soldier.kind, c.x - Rules_1.RULES.camps[c.index].width * .25 + (active % 6) * 38, c.index, 0, soldier);
            }
        }
        for (const e of s.enemies)
            if (e.towerId && !s.fortifications.some(f => f.id === e.towerId && f.hp > 0)) {
                e.towerId = undefined;
            }
        for (const f of s.fortifications) {
            if (f.hp <= 0 || f.kind !== 'tower' || s.camps[f.camp].defeated)
                continue;
            let crew = s.enemies.filter(e => e.state === 'active' && e.towerId === f.id);
            while (crew.length < (f.levels || 1)) {
                const e = s.enemies.filter(e => e.state === 'active' && e.force !== 'field' && !e.company && e.camp === f.camp && e.kind === 'elf' && !e.hero && !e.towerId).sort((a, b) => Math.abs(a.x - f.x) - Math.abs(b.x - f.x))[0];
                if (!e)
                    break;
                e.towerId = f.id;
                crew.push(e);
            }
            for (const e of crew) {
                const spot = this.enemyTowerPosition(e);
                e.x = e.prevX = spot.x;
                e.moving = false;
            }
            f.cooldown -= dt;
            if (f.cooldown > 0 || !crew.length)
                continue;
            const targets = [{ id: -1, x: s.player.x }, ...s.goblins.filter(n => !n.dead).map(n => ({ id: n.id, x: n.x }))].sort((a, b) => Math.abs(a.x - f.x) - Math.abs(b.x - f.x));
            const target = targets[0];
            if (target && Math.abs(target.x - f.x) < 350) {
                f.cooldown = 2.3;
                for (const e of crew) {
                    e.face = Math.sign(target.x - e.x) || -1;
                    this.shoot(e.x, target.x, target.id, this.enemyStats(e).attack, false, 'arrow');
                    s.shots[s.shots.length - 1].fromY = 46 + this.enemyTowerPosition(e).height;
                }
            }
        }
    }
    campRemaining(c) { var _a, _b, _c, _d; return ((_b = (_a = c.guardQueue) === null || _a === void 0 ? void 0 : _a.length) !== null && _b !== void 0 ? _b : ((((_c = c.reserve) === null || _c === void 0 ? void 0 : _c.length) || 0) + (((_d = c.heroesPending) === null || _d === void 0 ? void 0 : _d.length) || 0))) + this.state.enemies.filter(e => e.camp === c.index && e.force !== 'field' && !e.company && e.state === 'active').length; }
    damageFort(id, amount) { const f = this.state.fortifications.find(f => f.id === id && f.hp > 0); if (f) {
        f.hp = Math.max(0, f.hp - amount);
        this.effect('smoke', f.x, .4);
        this.dirty = true;
    } }
    spawnRaid() { var _a; if (!this.nearestCamp)
        return; ((_a = this.state).raidsWaiting || (_a.raidsWaiting = [])).push(this.state.day); this.updateRaidQueue(0); this.dirty = true; }
    updateRaidQueue(dt) {
        var _a, _b, _c;
        const s = this.state, c = this.nearestCamp;
        if (c && ((_a = s.raidsWaiting) === null || _a === void 0 ? void 0 : _a.length)) {
            const day = s.raidsWaiting.shift();
            this.prepareRaid(day);
            const prep = s.raidPrep;
            const group = { id: this.id(), initial: prep.units.length, lost: 0, retreating: false, camp: c.index, spawnedAt: s.elapsed, pending: prep.units, launchClock: 0, launchX: c.x - 120, eliteBudget: prep.eliteBudget, day };
            s.companies.push(group);
            s.raids++;
            for (const id of prep.engines) {
                const m = s.machines.find(m => m.id === id);
                m.company = group.id;
                m.order = 'attack';
                m.x = m.prevX = c.x + 260;
            }
            s.raidPrep = undefined;
            this.events.push({ kind: 'raid', x: c.x });
        }
        for (const group of s.companies.slice().sort((a, b) => (b.day || 0) - (a.day || 0))) {
            // 夜袭不再因损失或天亮撤回，旧档标志也不取消尚未入场的兵。
            group.retreating = false;
            group.launchClock = (group.launchClock || 0) - dt;
            if (group.launchClock > 0 || !((_b = group.pending) === null || _b === void 0 ? void 0 : _b.length))
                continue;
            // 拥堵只延迟普通补入，每个新夜首批仍入场，不能让旧队吞掉日期到来的Boss。
            if (group.pending.length !== group.initial && this.state.enemies.filter(e => e.company && e.state === 'active').length >= 96)
                continue;
            group.launchClock = 4;
            for (let i = 0; i < 6 && group.pending.length; i++) {
                const n = group.pending.shift();
                this.makeEnemy(n.kind, ((_c = group.launchX) !== null && _c !== void 0 ? _c : s.camps[group.camp].x) + i * 40, group.camp, group.id, n);
            }
        }
    }
    /** 活着撤回才回到储备，保留伤势并休整，不在下令撤退瞬间复制回营。 */
    returnEnemy(e) {
        var _a;
        const s = this.state, escaping = e.state === 'escaping';
        if (e.force === 'field' || e.company) {
            if (escaping && e.counted)
                s.army.recovered++;
            s.army.returned++;
            s.army.reserve.push({ id: e.id, kind: e.kind, hero: e.hero, sourceCamp: (_a = e.sourceCamp) !== null && _a !== void 0 ? _a : e.camp, hpRatio: e.hp / Math.max(1, e.maxHp), readyAt: s.elapsed + 60 });
        }
        else {
            const c = s.camps.find(c => c.index === e.camp && !c.defeated) || this.nearestCamp;
            if (c) {
                c.guardQueue.push({ id: e.id, kind: e.kind, hero: e.hero, sourceCamp: e.camp, hpRatio: e.hp / Math.max(1, e.maxHp) });
                s.army.guardRecovered++;
            }
        }
        e.returned = true;
        e.state = 'gone';
        e.timer = 0;
    }
    move(n, x, speed, dt) {
        const distance = x - n.x;
        if (Math.abs(distance) < 3)
            return;
        const amount = Math.min(Math.abs(distance), Math.max(0, speed) * dt);
        n.x += Math.sign(distance) * amount;
        n.moving = amount > .01;
        if (n.face !== undefined)
            n.face = Math.sign(distance);
        if (n.speed !== undefined)
            n.speed = speed;
    }
    updateBuildings(dt) {
        var _a;
        const s = this.state;
        const r = s.recruitment;
        if (s.elapsed - r.start >= Rules_1.RULES.recruitmentWindow) {
            r.start += Math.floor((s.elapsed - r.start) / Rules_1.RULES.recruitmentWindow) * Rules_1.RULES.recruitmentWindow;
            const level = ((_a = s.buildings.find(b => b.kind === 'lure')) === null || _a === void 0 ? void 0 : _a.level) || 1;
            r.limit = level >= 4 ? 2 : level >= 2 && this.rand() > .5 ? 2 : 1;
            r.count = 0;
            r.next = r.start + 120 + this.rand() * 30;
        }
        for (const b of s.buildings) {
            b.timer += dt;
            if (b.region === -2 && !b.discovered && Math.abs(b.x - s.player.x) < 760 && b.x < this.frontier + 1600) {
                b.discovered = true;
                this.dirty = true;
            }
            if (b.kind === 'lure' && b.level && b.stock && r.count < r.limit && s.elapsed >= r.next && this.population < this.populationLimit) {
                // 到访才消耗预存金币，人口满时原样保留。
                b.timer = 0;
                b.stock--;
                const unit = this.makeGoblin('idle', b.x + 360);
                unit.task = 'joining';
                unit.targetX = b.x;
                r.count++;
                r.next = s.elapsed + 120 + this.rand() * 15;
                s.goblins.push(unit);
                this.dirty = true;
            }
            if ((b.kind === 'net' || b.kind === 'rock') && b.level && b.hp > 0 && b.timer > (b.kind === 'net' ? 12 : 10)) {
                const e = this.activeEnemies().find(e => Math.abs(e.x - b.x) < 65);
                if (e) {
                    b.timer = 0;
                    if (b.kind === 'net') {
                        e.snared = 4 + b.level;
                        this.effect('star', e.x, .5);
                    }
                    else {
                        this.blast(e.x, 70, 24 * b.level, true);
                        this.effect('smoke', e.x, .6, 2);
                    }
                }
            }
        }
        this.towerClock -= dt;
        if (this.towerClock <= 0) {
            this.towerClock = .75;
            this.assignTowers();
        }
    }
    /** 箭台占用真实猎手，征召、阵亡或倒地立即释放站位。 */
    assignTowers() {
        const s = this.state;
        for (const n of s.goblins)
            if (n.towerId && (n.dead || n.stunned > 0 || !s.buildings.some(b => b.id === n.towerId && b.hp > 0 && this.canHoldTower(n, b)))) {
                n.towerId = undefined;
                if (n.task === 'tower')
                    n.task = '';
            }
        const towers = s.buildings.filter(b => b.kind === 'tower' && b.level && b.hp > 0 && b.x <= this.frontier + 100).sort((a, b) => b.x - a.x);
        for (const b of towers) {
            const occupants = s.goblins.filter(n => !n.dead && n.towerId === b.id);
            for (let i = occupants.length; i < Rules_1.RULES.towerSlots[b.level]; i++) {
                const n = s.goblins.filter(n => !n.dead && this.canHoldTower(n, b) && !n.task && !n.towerId && n.stunned <= 0 && n.carry === 0 && Math.abs(n.x - b.x) < 1600).sort((a, c) => Math.abs(a.x - b.x) - Math.abs(c.x - b.x))[0];
                if (!n)
                    break;
                n.towerId = b.id;
                n.task = 'tower';
            }
        }
    }
    /** 出征队占领后就地驻塔，接到下一次出征命令再归队，不凭空生成守军。 */
    canHoldTower(n, b) { var _a; return n.role === 'hunter' && (n.order === 'home' || n.order === 'expedition' && !!((_a = this.state.camps[this.state.expedition.camp]) === null || _a === void 0 ? void 0 : _a.defeated) && b.region === this.state.expedition.camp); }
    updateGoblins(dt) {
        var _a, _b, _c, _d, _e, _f;
        this.safeCorpses = null;
        const s = this.state, enemies = this.activeEnemies(), stationUsers = new Map();
        for (const n of s.goblins) {
            const previousStation = n.workAt;
            n.workAt = undefined;
            n.working = false;
            n.hit = Math.max(0, n.hit - dt);
            n.stunned = Math.max(0, n.stunned - dt);
            n.cooldown = Math.max(0, n.cooldown - dt);
            n.timer += dt;
            if (n.dead || n.stunned > 0 || n.hit > .18)
                continue;
            if (n.towerId && !s.buildings.some(b => b.id === n.towerId && this.canHoldTower(n, b))) {
                n.towerId = undefined;
                if (n.task === 'tower')
                    n.task = '';
            }
            const eff = this.efficiency(n), civilian = n.role === 'worker' || n.role === 'idle';
            const hazards = s.effects.filter(f => f.kind === 'warning' || f.kind === 'fire').sort((a, b) => a.x - b.x);
            const fire = hazards.find(f => Math.abs(f.x - n.x) < 62);
            if (fire && n.task !== 'machine') {
                // 连续火雨按整片危险区避让，不能在相邻落点之间来回抖动。
                let left = fire.x - 64, right = fire.x + 64;
                for (let pass = 0; pass < 2; pass++)
                    for (const f of hazards)
                        if (f.x + 64 >= left && f.x - 64 <= right) {
                            left = Math.min(left, f.x - 64);
                            right = Math.max(right, f.x + 64);
                        }
                this.move(n, n.x - left <= right - n.x ? left - 12 : right + 12, 185, dt);
                continue;
            }
            if (!civilian && n.order === 'home' && !n.towerId && this.daytimeRoaming && n.x > this.frontier + 30) {
                const threat = enemies.find(e => e.state === 'active' && Math.abs(e.x - n.x) <= Rules_1.RULES.patrolRadius);
                if (threat && this.localNumbers(n.x).goblins < this.localNumbers(n.x).enemies) {
                    n.fleeUntil = s.elapsed + 2;
                    n.fleeFrom = threat.x;
                }
                if ((n.fleeUntil || 0) > s.elapsed) {
                    const away = Math.sign(n.x - ((_a = n.fleeFrom) !== null && _a !== void 0 ? _a : n.x + 1)) || -1;
                    this.move(n, (0, Rules_1.clamp)(n.x + away * 260, Rules_1.RULES.worldMin + 95, Rules_1.RULES.worldMax - 95), 178, dt);
                    continue;
                }
            }
            const danger = enemies.filter(e => !(n.order === 'expedition' && s.companies.some(c => c.id === e.company && c.retreating) && e.x > n.x + Rules_1.RULES.role[n.role].range) && (Math.abs(e.x - n.x) < (civilian ? 350 : 430) || !civilian && e.state === 'escaping' && e.x < this.frontier + 300
                || !civilian && n.order === 'home' && e.state === 'active' && e.x < this.frontier) && (!civilian || !s.buildings.some(w => w.kind === 'wall' && w.level && w.hp > 0 && (w.x - e.x) * (w.x - n.x) <= 0))).sort((a, b) => Math.abs(a.x - n.x) - Math.abs(b.x - n.x))[0];
            // 低人口慢补员依靠保住成长，而非让近战每波必定战死；撤离仍会被追击与远程命中。
            if (!civilian && n.hp < n.maxHp * .3 && danger && n.task !== 'recover') {
                const away = Math.sign(n.x - danger.x) || -1;
                n.task = 'recover';
                n.recoverX = (0, Rules_1.clamp)(n.x + away * 440, Rules_1.RULES.worldMin + 95, Rules_1.RULES.worldMax - 95);
            }
            if (n.task === 'recover') {
                const pursuer = enemies.slice().sort((a, b) => Math.abs(a.x - n.x) - Math.abs(b.x - n.x))[0];
                const covered = pursuer && s.buildings.some(w => w.kind === 'wall' && w.hp > 0 && w.level && (w.x - pursuer.x) * (w.x - n.x) <= 0);
                if (pursuer && !covered && Math.abs(pursuer.x - n.x) < 380)
                    n.recoverX = (0, Rules_1.clamp)(n.x + (Math.sign(n.x - pursuer.x) || -1) * 180, Rules_1.RULES.worldMin + 95, Rules_1.RULES.worldMax - 95);
                this.move(n, (_b = n.recoverX) !== null && _b !== void 0 ? _b : this.frontier - 400, 172, dt);
                if (covered || !enemies.some(e => Math.abs(e.x - n.x) < 330))
                    n.hp = Math.min(n.maxHp, n.hp + dt * (.8 + n.maxHp * .006));
                if (n.hp >= n.maxHp * .7) {
                    n.task = '';
                    n.recoverX = undefined;
                }
                continue;
            }
            if (civilian && danger && (n.task !== 'machine' || Math.abs(danger.x - n.x) < 115)) {
                const away = Math.sign(n.x - danger.x) || -1;
                this.move(n, (0, Rules_1.clamp)(n.x + away * 300, Rules_1.RULES.worldMin + 95, Rules_1.RULES.worldMax - 95), 188, dt);
                if (n.task === 'haul') {
                    const captive = s.enemies.find(e => e.id === n.targetId);
                    if (captive) {
                        captive.hauler = 0;
                        captive.state = 'bound';
                    }
                    n.task = '';
                }
                if (n.task === 'salvageMachine') {
                    const m = s.machines.find(m => m.id === n.targetId);
                    if (m)
                        m.crew = m.crew.filter(id => id !== n.id);
                    n.task = '';
                }
                continue;
            }
            if (!civilian && n.order === 'home' && !n.towerId && !this.daytimeRoaming && n.x > this.frontier + 15) {
                this.move(n, this.frontier - (n.role === 'hunter' ? 110 : 40), 176, dt);
                continue;
            }
            if (!civilian && danger) {
                this.fightGoblin(n, danger, dt);
                continue;
            }
            // 安全时缓慢恢复；轻伤不再令守军跑回几千单位外的洞穴、留下空墙。
            if ((n.order === 'home' || n.order === 'expedition' && ((_c = s.camps[s.expedition.camp]) === null || _c === void 0 ? void 0 : _c.defeated)) && n.hp < n.maxHp && !enemies.some(e => Math.abs(e.x - n.x) < 420))
                n.hp = Math.min(n.maxHp, n.hp + dt * (Math.abs(n.x - this.hall.x) < 180 ? 4 : .7));
            if (n.task === 'construction') {
                const job = s.buildings.find(b => b.id === n.targetId && b.job);
                if (!job) {
                    n.task = '';
                    continue;
                }
                this.move(n, job.kind === 'wall' ? job.x - 24 : job.x, 102 * eff * this.logisticsFactor(), dt);
                if (Math.abs(n.x - job.x) < 40 && job.job) {
                    n.working = !n.moving;
                    job.job.left -= dt * eff;
                    if (job.job.left <= 0) {
                        this.finishJob(job);
                        n.task = '';
                        n.working = false;
                    }
                }
                continue;
            }
            if (n.role === 'worker' && (n.buildRestUntil || 0) > s.elapsed && !s.buildings.some(b => b.job && Math.abs(b.x - n.x) < 800))
                continue;
            if (n.task === 'joining') {
                this.move(n, n.targetX, 94, dt);
                if (Math.abs(n.x - n.targetX) < 10) {
                    n.task = '';
                    this.effect('star', n.x, .6);
                }
                continue;
            }
            if (n.task === 'salvageMachine') {
                const m = s.machines.find(m => m.id === n.targetId && m.owner === 'abandoned' && m.hp > 0);
                if (!m) {
                    n.task = '';
                    continue;
                }
                this.move(n, m.x - 65, 112, dt);
                if (Math.abs(n.x - m.x) < 85) {
                    m.owner = 'goblin';
                    m.order = 'return';
                    n.task = 'machine';
                    this.dirty = true;
                }
                continue;
            }
            if (n.task === 'machine') {
                const machine = s.machines.find(m => m.id === n.targetId && m.hp > 0);
                if (machine && machine.owner === 'goblin') {
                    this.move(n, machine.x - 70 - machine.crew.indexOf(n.id) * 35, 130, dt);
                    continue;
                }
                n.task = '';
                n.order = 'home';
            }
            if (n.task === 'haul') {
                this.haul(n, dt);
                continue;
            }
            if (n.task === 'lootReturn' || n.loot > 0) {
                const gearX = s.buildings.find(b => b.kind === 'gear').x;
                this.move(n, gearX, 95 * eff * this.logisticsFactor(), dt);
                if (Math.abs(n.x - gearX) < 22) {
                    s.gearStock += n.loot;
                    n.loot = 0;
                    n.task = '';
                    this.dirty = true;
                }
                continue;
            }
            if (n.order === 'return') {
                const defense = this.frontier - (n.role === 'hunter' ? 100 : 60) - n.id % 3 * 18;
                this.move(n, defense, 138, dt);
                if (Math.abs(n.x - defense) < 30)
                    n.order = 'home';
                continue;
            }
            // 新征召的猎手经过后勤区时先领已付款的装备，再去集结；在前线的老兵不擅自离队。
            const equipmentPoint = this.flag.level ? this.flag.x : this.forge.x;
            if (n.role === 'hunter' && !n.gear && s.equipmentStock > 0 && this.forge.level && (n.order !== 'expedition' || ((_d = s.camps[s.expedition.camp]) === null || _d === void 0 ? void 0 : _d.defeated))) {
                this.move(n, equipmentPoint, 130 * this.logisticsFactor(), dt);
                if (Math.abs(n.x - equipmentPoint) < 35) {
                    s.equipmentStock--;
                    n.gear = this.forge.level;
                    this.updateStats();
                    this.effect('star', n.x, .8);
                    this.dirty = true;
                }
                continue;
            }
            if (n.order === 'gather') {
                this.move(n, this.gatherSpot(n), 124, dt);
                continue;
            }
            if (n.order === 'expedition' && n.task === 'tower' && n.towerId && ((_e = s.camps[s.expedition.camp]) === null || _e === void 0 ? void 0 : _e.defeated)) {
                this.move(n, this.towerPosition(n).x, 110, dt);
                continue;
            }
            if (n.order === 'expedition') {
                this.expeditionGoblin(n, dt);
                continue;
            }
            if (n.task === 'tower' && n.towerId) {
                const tower = s.buildings.find(b => b.id === n.towerId && b.hp > 0);
                if (tower) {
                    this.move(n, this.towerPosition(n).x, 100, dt);
                    continue;
                }
                n.task = '';
                n.towerId = undefined;
            }
            if (n.carry >= 3 || n.carry > 0 && (n.role === 'idle' || n.timer > 90)) {
                this.move(n, this.hall.x, 95 * eff * this.logisticsFactor(), dt);
                if (Math.abs(n.x - this.hall.x) < 35) {
                    if (this.rand() < .16 && n.hidden < 3 && n.carry > 1) {
                        n.hidden++;
                        n.carry--;
                    }
                    s.treasury += n.carry;
                    n.carry = 0;
                    this.effect('coin', this.hall.x, .5);
                    this.dirty = true;
                }
                continue;
            }
            if (n.role === 'idle') {
                const stall = s.buildings.filter(b => ['worker', 'hunter', 'brute'].includes(b.kind) && b.stock > 0).sort((a, b) => Math.abs(a.x - n.x) - Math.abs(b.x - n.x))[0];
                if (stall) {
                    this.move(n, stall.x, 100 * eff, dt);
                    if (Math.abs(n.x - stall.x) < 25 && stall.stock > 0) {
                        stall.stock--;
                        n.role = stall.kind;
                        n.maxHp = this.stats(n).hp;
                        n.hp = n.maxHp;
                        n.timer = 0;
                        this.effect('star', n.x, .7);
                        this.dirty = true;
                    }
                    continue;
                }
            }
            const buildLimit = Math.max(this.frontier + 650, ...s.camps.filter(c => c.defeated).map(c => c.x + 1150));
            // 慢补员下不能让所有苦力无限绑运，至少留一半人手处理生产与维修。
            const workers = s.goblins.filter(q => !q.dead && q.role === 'worker'), logistics = workers.filter(q => q.task === 'haul' || q.task === 'lootReturn' || q.loot > 0).length;
            if ((n.role === 'idle' || n.role === 'worker' && !s.goblins.some(q => !q.dead && q.role === 'idle') && logistics < Math.max(1, Math.floor(workers.length / 2)) && !s.buildings.some(b => b.job && b.x < buildLimit)) && this.corpseTask(n, dt))
                continue;
            if (n.role === 'worker') {
                const safeBuildLimit = Math.max(this.frontier + 650, ...s.camps.filter(c => c.defeated).map(c => c.x + 1150));
                const jobs = s.buildings.filter(b => b.job && b.x < safeBuildLimit && s.goblins.filter(q => !q.dead && q.task === 'construction' && q.targetId === b.id).length < 1).sort((a, b) => Math.abs(a.x - n.x) - Math.abs(b.x - n.x));
                if (jobs.length) {
                    const b = jobs[0];
                    n.task = 'construction';
                    n.targetId = b.id;
                    continue;
                }
                const broken = s.buildings.filter(b => b.hp > 0 && b.hp < b.maxHp && b.x <= this.frontier).sort((a, b) => Math.abs(a.x - n.x) - Math.abs(b.x - n.x))[0];
                if (broken) {
                    this.move(n, broken.x, 100 * eff, dt);
                    if (Math.abs(n.x - broken.x) < 40) {
                        n.working = !n.moving;
                        broken.hp = Math.min(broken.maxHp, broken.hp + dt * (7 + (((_f = s.buildings.find(b => b.kind === 'repair')) === null || _f === void 0 ? void 0 : _f.level) || 0) * 2) * eff);
                    }
                    continue;
                }
                const stations = s.buildings.filter(b => ['farm', 'mine', 'wood'].includes(b.kind) && b.level > 0 && b.x < this.frontier + 500);
                if (stations.length) {
                    const open = stations.filter(b => (stationUsers.get(b.id) || 0) < Rules_1.RULES.productionSlots[b.level]);
                    const b = open.find(b => b.id === previousStation) || open.sort((a, b) => Math.abs(a.x - n.x) - Math.abs(b.x - n.x))[0];
                    if (!b) {
                        this.move(n, this.hall.x + 70 + n.id % 4 * 26, 65, dt);
                        continue;
                    }
                    stationUsers.set(b.id, (stationUsers.get(b.id) || 0) + 1);
                    this.move(n, b.x + (n.id % 3 - 1) * 22, 86 * eff * this.logisticsFactor(), dt);
                    if (Math.abs(n.x - b.x) < 60) {
                        // 工时仅在同一真实岗位连续累积，跑路、拖俘或换岗都不能预存产量。
                        if (previousStation !== b.id)
                            n.workTime = 0;
                        n.workAt = b.id;
                        n.working = !n.moving;
                        n.workTime = (n.workTime || 0) + dt * eff;
                        if (n.workTime >= Rules_1.RULES.productionCycle[b.level]) {
                            n.workTime -= Rules_1.RULES.productionCycle[b.level];
                            n.timer = 0;
                            n.carry += (b.kind === 'mine' ? Rules_1.RULES.mineYield : Rules_1.RULES.productionYield)[b.level];
                            this.effect('coin', n.x, .4);
                            this.dirty = true;
                        }
                    }
                    continue;
                }
            }
            if (n.role === 'hunter') {
                if (s.equipmentStock > 0 && !n.gear && this.forge.level > 0) {
                    this.move(n, equipmentPoint, 130 * this.logisticsFactor(), dt);
                    if (Math.abs(n.x - equipmentPoint) < 35) {
                        s.equipmentStock--;
                        n.gear = this.forge.level;
                        this.updateStats();
                        this.effect('star', n.x, .8);
                        this.dirty = true;
                    }
                    continue;
                }
                const dropped = s.coins.filter(c => c.value > 0 && c.age > .45 && Math.abs(c.x - n.x) < 360).sort((a, b) => Math.abs(a.x - n.x) - Math.abs(b.x - n.x))[0];
                if (dropped) {
                    this.move(n, dropped.x, 112 * eff, dt);
                    if (Math.abs(n.x - dropped.x) < 22) {
                        n.carry += dropped.value;
                        dropped.value = 0;
                    }
                    continue;
                }
                const prey = s.animals.filter(a => a.hp > 0 && a.x < this.roamLimit() && a.x > 1450).sort((a, b) => Math.abs(a.x - n.x) - Math.abs(b.x - n.x))[0];
                if (prey && this.daytimeRoaming) {
                    if (Math.abs(n.x - prey.x) > 210)
                        this.move(n, prey.x, 104 * eff, dt);
                    else if (n.cooldown <= 0) {
                        n.face = Math.sign(prey.x - n.x);
                        n.cooldown = 1.1 / eff;
                        this.shoot(n.x, prey.x, prey.id, 9, true, 'arrow');
                    }
                    continue;
                }
                if (this.daytimeRoaming)
                    this.roamGoblin(n, dt);
                else
                    this.move(n, this.frontier - 95 - n.id % 3 * 27, 146, dt);
            }
            else if (n.role === 'brute') {
                if (this.daytimeRoaming)
                    this.roamGoblin(n, dt);
                else
                    this.move(n, this.frontier - 45 - n.id % 2 * 40, 142, dt);
            }
            else {
                const coin = s.coins.filter(c => c.age > 1 && Math.abs(c.x - n.x) < 600).sort((a, b) => Math.abs(a.x - n.x) - Math.abs(b.x - n.x))[0];
                if (coin) {
                    this.move(n, coin.x, 88 * eff, dt);
                    if (Math.abs(n.x - coin.x) < 22) {
                        n.carry += coin.value;
                        coin.value = 0;
                    }
                }
                else {
                    if (n.timer > 4 + n.id % 5) {
                        n.targetX = 180 + this.rand() * Math.max(450, Math.min(1100, this.frontier - 350));
                        n.timer = 0;
                    }
                    this.move(n, n.targetX, 47 * eff, dt);
                }
            }
        }
    }
    /** 普通地面守军白天在前沿分散巡游，短暂停步仍使用逻辑时钟，暂停不晃动。 */
    roamGoblin(n, dt) {
        const end = this.roamLimit(), start = Math.min(end, this.frontier + 160);
        if (n.roamX === undefined || n.roamX < start || n.roamX > end || this.state.elapsed >= (n.roamWait || 0) && Math.abs(n.x - n.roamX) < 12) {
            n.roamX = start + this.rand() * Math.max(0, end - start);
            n.roamWait = this.state.elapsed + 2 + n.id % 3;
        }
        this.move(n, n.roamX, 100 * this.efficiency(n), dt);
    }
    fightGoblin(n, e, dt) {
        var _a;
        // 近战先拆高塔，不能站在塔脚隔空砍到上层射手。
        if (n.role !== 'hunter' && e.towerId && this.state.fortifications.some(f => f.id === e.towerId && f.hp > 0)) {
            this.fightFort(n, e.towerId, dt);
            return;
        }
        const tower = n.towerId ? this.state.buildings.find(b => b.id === n.towerId && b.hp > 0) : undefined;
        const def = Rules_1.RULES.role[n.role], range = def.range + (n.role === 'hunter' && tower ? Rules_1.RULES.towerRange[tower.level] : 0), d = Math.abs(n.x - e.x);
        const gate = this.state.fortifications.filter(f => f.kind === 'gate' && f.hp > 0 && (f.x - n.x) * (f.x - e.x) < 0).sort((a, b) => Math.abs(a.x - n.x) - Math.abs(b.x - n.x))[0];
        if (gate && (n.role !== 'hunter' || d > range)) {
            this.fightFort(n, gate.id, dt);
            return;
        }
        n.face = Math.sign(e.x - n.x) || n.face;
        if (d > range) {
            if (tower) {
                this.move(n, this.towerPosition(n).x, 100, dt);
                return;
            }
            const retreating = this.state.companies.some(c => c.id === e.company && c.retreating);
            const roaming = n.order === 'home' && this.daytimeRoaming && !tower;
            const limit = n.order === 'home' ? roaming ? this.roamLimit() : this.frontier + (retreating ? 180 : 500) : Infinity;
            if (e.x > limit) {
                this.move(n, roaming ? limit - 70 : this.frontier - 80, 120, dt);
                return;
            }
            const escort = n.order === 'expedition' ? this.state.machines.filter(m => m.order === 'expedition' && m.owner === 'goblin') : [];
            const escortLimit = escort.length ? Math.min(...escort.map(m => m.x)) + 230 : Infinity;
            let destination = Math.min(e.x - n.face * (range - 8), escortLimit);
            // 守军利用桩墙阻挡，不能为了追前排主动跑出墙外送掉整条防线。
            const holding = n.order === 'home' && !this.daytimeRoaming || n.order === 'expedition' && ((_a = this.state.camps[this.state.expedition.camp]) === null || _a === void 0 ? void 0 : _a.defeated);
            if (holding) {
                const cover = this.state.buildings.filter(b => b.kind === 'wall' && b.hp > 0 && b.level > 0 && b.x < e.x && Math.abs(n.x - b.x) < 500).sort((a, b) => Math.abs(a.x - n.x) - Math.abs(b.x - n.x))[0];
                const counterRanged = cover && n.role === 'brute' && (e.kind === 'elf' || e.kind === 'mage') && !this.activeEnemies().some(other => other.id !== e.id && other.x > cover.x && other.x < e.x && other.kind !== 'elf' && other.kind !== 'mage');
                if (cover && !counterRanged)
                    destination = Math.min(destination, cover.x - (n.role === 'hunter' ? 35 : 12));
            }
            this.move(n, destination, 145 * this.efficiency(n), dt);
            return;
        }
        if (n.cooldown > 0)
            return;
        n.cooldown = (n.role === 'hunter' ? 1 : .9) / this.efficiency(n);
        if (n.role === 'hunter') {
            this.shoot(n.x, e.x, e.id, this.stats(n).attack, true, 'arrow');
            if (tower) {
                const shot = this.state.shots[this.state.shots.length - 1];
                shot.fromY = 46 + this.towerPosition(n).height;
                shot.targetY = 46;
            }
        }
        else {
            this.hitEnemy(e, this.stats(n).attack, n.x, false);
            this.effect('hit', e.x, .25);
        }
    }
    nearTower(n) { return this.state.buildings.some(b => b.kind === 'tower' && b.level > 0 && b.hp > 0 && Math.abs(b.x - n.x) < 65); }
    fightFort(n, id, dt) {
        const f = this.state.fortifications.find(f => f.id === id && f.hp > 0);
        if (!f)
            return;
        const range = Rules_1.RULES.role[n.role].range, dir = Math.sign(f.x - n.x) || 1;
        n.face = dir;
        if (Math.abs(n.x - f.x) > range) {
            const escorts = n.order === 'expedition' ? this.state.machines.filter(m => m.owner === 'goblin' && m.order === 'expedition') : [];
            const limit = escorts.length ? Math.min(...escorts.map(m => m.x)) + 190 : Infinity;
            this.move(n, Math.min(f.x - dir * (range - 8), limit), escorts.length ? 63 : 140, dt);
            return;
        }
        if (n.cooldown > 0)
            return;
        n.cooldown = n.role === 'hunter' ? 1.05 : .9;
        if (n.role === 'hunter')
            this.shoot(n.x, f.x, f.id, this.stats(n).attack, true, 'arrow');
        else
            this.damageFort(f.id, this.stats(n).attack);
    }
    expeditionGoblin(n, dt) {
        const s = this.state, camp = s.camps[s.expedition.camp];
        if (!camp) {
            n.order = 'return';
            return;
        }
        const machines = s.machines.filter(m => m.order === 'expedition' && m.owner === 'goblin');
        if (camp.defeated) {
            const wall = s.buildings.find(b => b.kind === 'wall' && b.region === camp.index);
            const guard = wall && (wall.job || wall.level) ? wall.x - 80 : camp.x + 320;
            this.move(n, guard - (n.role === 'hunter' ? 100 : 0) - n.id % 3 * 20, 116, dt);
            s.expedition.state = 'hold';
            return;
        }
        const fort = s.fortifications.filter(f => f.camp === camp.index && f.hp > 0).sort((a, b) => Math.abs(a.x - n.x) - Math.abs(b.x - n.x))[0];
        if (fort) {
            this.fightFort(n, fort.id, dt);
            return;
        }
        const anchor = machines.length ? Math.min(...machines.map(m => m.x)) : camp.x - 90;
        const target = machines.length ? Math.min(camp.x - 65, anchor + (n.role === 'brute' ? 120 : 15) + n.id % 3 * 15) : camp.x - (n.role === 'brute' ? 48 : 180);
        this.move(n, target, machines.length ? 62 : 142, dt);
        if (!camp.defeated && Math.abs(n.x - camp.x) < Rules_1.RULES.role[n.role].range + 20 && n.cooldown <= 0) {
            n.face = 1;
            n.cooldown = n.role === 'hunter' ? 1.05 : .9;
            if (n.role === 'hunter')
                this.shoot(n.x, camp.x, camp.id, this.stats(n).attack, true, 'arrow');
            else
                this.damageCamp(camp, this.stats(n).attack);
        }
        if (camp.defeated)
            s.expedition.state = 'hold';
    }
    corpseTask(n, dt) {
        const s = this.state;
        const gear = s.gearDrops.filter(item => item.amount > 0 && item.age > .7 && Math.abs(item.x - n.x) < 650).sort((a, b) => Math.abs(a.x - n.x) - Math.abs(b.x - n.x))[0];
        if (gear) {
            this.move(n, gear.x, 95 * this.efficiency(n) * this.logisticsFactor(), dt);
            if (Math.abs(n.x - gear.x) < 24) {
                n.loot += gear.amount;
                gear.amount = 0;
                n.task = 'lootReturn';
            }
            return true;
        }
        if (!this.safeCorpses) {
            // 每个逻辑帧只检查一次安全战场，不能为每个闲置单位对每具遗体重新遍历整支联军。
            const limit = Math.max(this.frontier + 1000, ...s.camps.filter(c => c.defeated).map(c => c.x + 600));
            const foes = this.activeEnemies().map(e => e.x).sort((a, b) => a - b);
            let j = 0;
            const candidates = s.enemies.filter(e => (e.state === 'wounded' || e.state === 'bound' && !e.atPrison || e.state === 'dead' && !e.stripped) && e.x < limit).sort((a, b) => a.x - b.x);
            this.safeCorpses = candidates.filter(e => { while (j < foes.length && foes[j] < e.x - 210)
                j++; return j === foes.length || foes[j] > e.x + 210; });
        }
        let corpse;
        for (const e of this.safeCorpses)
            if (!e.hauler && ((e.state === 'wounded' || e.state === 'bound' && !e.atPrison) || e.state === 'dead' && !e.stripped) && (!corpse || Math.abs(e.x - n.x) < Math.abs(corpse.x - n.x)))
                corpse = e;
        if (!corpse)
            return false;
        this.move(n, corpse.x, 95 * this.efficiency(n) * this.logisticsFactor(), dt);
        if (Math.abs(n.x - corpse.x) < 32) {
            if (!corpse.stripped) {
                corpse.stripped = true;
                n.loot++;
                this.dirty = true;
            }
            if (corpse.state !== 'dead') {
                corpse.state = 'bound';
                corpse.hauler = n.id;
                corpse.atPrison = false;
                n.task = 'haul';
                n.targetId = corpse.id;
            }
            else
                n.task = 'lootReturn';
        }
        return true;
    }
    haul(n, dt) {
        const e = this.state.enemies.find(e => e.id === n.targetId && e.hauler === n.id);
        if (!e) {
            n.task = '';
            return;
        }
        this.move(n, this.prison.x, 64 * this.efficiency(n) * this.logisticsFactor(), dt);
        e.x = n.x + 48;
        e.face = -1;
        if (Math.abs(n.x - this.prison.x) < 30) {
            e.hauler = 0;
            n.task = '';
            e.timer = 0;
            e.atPrison = true;
            const inside = this.state.enemies.filter(e => e.state === 'captured').length;
            const capacity = this.prison.hp > 0 ? Rules_1.RULES.prisonCapacity[this.prison.level] : 0;
            e.state = inside < capacity ? 'captured' : 'bound';
            e.prisonSlot = inside;
            e.x = e.state === 'captured' ? this.prison.x - 28 + inside % 4 * 18 : this.prison.x + 85 + inside % 4 * 20;
            this.state.gearStock += n.loot;
            n.loot = 0;
            this.dirty = true;
        }
    }
    updateEnemies(dt) {
        var _a, _b, _c, _d, _e, _f, _g;
        const s = this.state;
        const fronts = new Map(), positions = new Map([[-1, s.player.x], ...s.goblins.filter(n => !n.dead).map(n => [n.id, n.x]), ...s.buildings.map(b => [b.id, b.x])]);
        for (const e of s.enemies)
            if (e.state === 'active' && e.meleeTarget !== undefined && !e.jump) {
                const line = fronts.get(e.meleeTarget) || [];
                line.push(e);
                fronts.set(e.meleeTarget, line);
            }
        for (const [id, line] of fronts) {
            const x = positions.get(id) || 0;
            line.sort((a, b) => Math.abs(a.x - x) - Math.abs(b.x - x) || a.id - b.id);
        }
        for (const e of s.enemies) {
            e.timer += dt;
            e.hit = Math.max(0, e.hit - dt);
            e.snared = Math.max(0, e.snared - dt);
            e.cooldown = Math.max(0, e.cooldown - dt);
            e.spells -= dt;
            if (e.state !== 'active' && e.state !== 'escaping')
                continue;
            const company = s.companies.find(c => c.id === e.company), camp = s.camps[e.camp];
            if (e.state === 'escaping') {
                e.windup = undefined;
                e.jump = undefined;
                const home = s.camps.find(c => c.index >= e.camp && !c.defeated) || this.nearestCamp;
                if (!home) {
                    if (!e.counted && e.force === 'field')
                        s.army.retired++;
                    e.state = 'gone';
                    e.returned = true;
                    continue;
                }
                this.move(e, home.x + 700, 172, dt);
                if (e.x > home.x + 600)
                    this.returnEnemy(e);
                continue;
            }
            if (e.patrol) {
                if (!this.daytimeRoaming || camp.defeated)
                    e.patrolReturn = true;
                if (e.patrolReturn) {
                    const home = s.camps.find(c => c.index >= e.camp && !c.defeated) || this.nearestCamp;
                    if (!home) {
                        s.army.retired++;
                        e.returned = true;
                        e.state = 'gone';
                        continue;
                    }
                    const destination = home.x - Rules_1.RULES.camps[home.index].width * .25;
                    this.move(e, destination, 156, dt);
                    if (Math.abs(e.x - destination) < 28)
                        this.returnEnemy(e);
                    continue;
                }
                const threat = s.goblins.filter(n => !n.dead && !n.towerId && (n.role === 'hunter' || n.role === 'brute') && Math.abs(n.x - e.x) <= Rules_1.RULES.patrolRadius).sort((a, b) => Math.abs(a.x - e.x) - Math.abs(b.x - e.x))[0];
                const numbers = this.localNumbers(e.x);
                if (threat && numbers.enemies < numbers.goblins) {
                    e.fleeUntil = s.elapsed + 2;
                    e.fleeFrom = threat.x;
                }
                if ((e.fleeUntil || 0) > s.elapsed) {
                    const away = Math.sign(e.x - ((_a = e.fleeFrom) !== null && _a !== void 0 ? _a : e.x - 1)) || 1;
                    this.move(e, (0, Rules_1.clamp)(e.x + away * 260, Rules_1.RULES.worldMin + 95, Rules_1.RULES.worldMax - 95), 174, dt);
                    continue;
                }
            }
            if (e.towerId && s.fortifications.some(f => f.id === e.towerId && f.hp > 0))
                continue;
            if (e.jump) {
                e.jump.left = Math.max(0, e.jump.left - dt);
                const t = 1 - e.jump.left / e.jump.total;
                e.x = e.jump.from + (e.jump.to - e.jump.from) * t;
                e.moving = true;
                if (!e.jump.left)
                    e.jump = undefined;
                continue;
            }
            if (e.windup) {
                const w = e.windup;
                w.left -= dt;
                if (w.left <= 0) {
                    if (w.kind === 'jump') {
                        const obstacle = s.buildings.find(b => b.id === w.targetId);
                        if (obstacle && obstacle.hp > 0 && obstacle.level <= 2)
                            e.jump = { from: e.x, to: w.targetX, left: .75, total: .75 };
                        e.spells = 9;
                    }
                    else {
                        const h = Rules_1.HEROES[e.hero || ''];
                        this.blast(w.targetX, (h === null || h === void 0 ? void 0 : h.boss) ? 100 : 70, this.enemyStats(e).attack * 1.5, false);
                        this.effect('hit', w.targetX, .4, 2);
                        e.spells = 7;
                        e.cooldown = 1.2;
                    }
                    e.windup = undefined;
                }
                continue;
            }
            if (e.snared > 0 || e.hit > .16)
                continue;
            let aiDt = dt;
            if (!e.company && Math.abs(e.x - s.player.x) > 1800 && !s.goblins.some(n => !n.dead && Math.abs(n.x - e.x) < 1700)) {
                e.aiClock = (e.aiClock || 0) + dt;
                if (e.aiClock < .4)
                    continue;
                aiDt = e.aiClock;
                e.aiClock = 0;
            }
            const hero = Rules_1.HEROES[e.hero || ''];
            const def = e.kind === 'elf' && e.ammo <= 0 && !hero ? Object.assign(Object.assign({}, this.enemyStats(e)), { range: 43, attack: 4 * ((_b = e.scale) !== null && _b !== void 0 ? _b : (0, CampaignRules_1.enemyFactor)(s.day)) }) : this.enemyStats(e);
            if (hero && e.spells <= 0) {
                if (hero.skill === 'engineer') {
                    e.spells = 8;
                    for (const f of s.fortifications)
                        if (f.camp === e.camp && f.hp > 0)
                            f.hp = Math.min(f.maxHp, f.hp + 14);
                    for (const m of s.machines)
                        if (m.owner === 'enemy' && Math.abs(m.x - e.x) < 500)
                            m.hp = Math.min(m.maxHp, m.hp + 18);
                    this.effect('star', e.x, .7);
                }
                if (hero.skill === 'charge') {
                    e.spells = 10;
                    e.boostedUntil = s.elapsed + 1.8;
                }
            }
            const targets = s.goblins.filter(n => !n.dead && (def.range >= 100 || this.hitElevation(n.id) <= 80)).map(n => ({ id: n.id, x: n.x, kind: 'goblin', object: n }));
            if (def.range < 100)
                for (const tower of s.buildings)
                    if (tower.kind === 'tower' && tower.hp > 0 && s.goblins.some(n => !n.dead && n.towerId === tower.id))
                        targets.push({ id: tower.id, x: tower.x, kind: 'building', object: tower });
            targets.push({ id: -1, x: s.player.x, kind: 'player', object: s.player });
            for (const m of s.machines)
                if (m.owner === 'goblin' && m.hp > 0)
                    targets.push({ id: m.id, x: m.x, kind: 'machine', object: m });
            targets.sort((a, b) => Math.abs(a.x - e.x) - Math.abs(b.x - e.x));
            let target = targets[0];
            const alert = s.fortifications.some(f => f.camp === e.camp && f.hp < f.maxHp);
            const sheltered = target && s.buildings.some(w => w.kind === 'wall' && w.level && w.hp > 0 && (w.x - target.x) * (w.x - e.x) < 0);
            if (e.patrol && (!target || Math.abs(target.x - e.x) > 500 || sheltered)) {
                if (Math.abs(e.x - ((_c = e.roamX) !== null && _c !== void 0 ? _c : e.x)) < 25 && e.timer > 3) {
                    e.timer = 0;
                    const first = e.camp === ((_e = (_d = this.nearestCamp) === null || _d === void 0 ? void 0 : _d.index) !== null && _e !== void 0 ? _e : -1);
                    e.roamX = first ? Math.max(this.frontier + 210, Math.min(camp.x - 450, this.frontier + 400 + this.rand() * 450)) : camp.x - Rules_1.RULES.camps[e.camp].width * .55 - 200 - this.rand() * 400;
                }
                this.move(e, (_f = e.roamX) !== null && _f !== void 0 ? _f : camp.x - 550, this.enemyStats(e).speed, aiDt);
                continue;
            }
            if (!e.company && !e.patrol && (!target || Math.abs(target.x - camp.x) > Rules_1.RULES.camps[e.camp].width * .7 + 260 || Math.abs(e.x - camp.x) > Rules_1.RULES.camps[e.camp].width * .8 + 300 || Math.abs(target.x - e.x) > (alert ? 1100 : 460))) {
                if (e.timer > 5) {
                    e.timer = 0;
                    e.face = this.rand() > .5 ? 1 : -1;
                }
                this.move(e, camp.x - Rules_1.RULES.camps[e.camp].width * .25 + (e.id % 6) * 38, 75, aiDt);
                continue;
            }
            if (!target)
                continue;
            const wall = s.buildings.filter(b => b.hp > 0 && b.level > 0 && b.kind === 'wall' && (b.x - e.x) * (b.x - target.x) < 0)
                .sort((a, b) => Math.abs(a.x - e.x) - Math.abs(b.x - e.x))[0];
            if (e.kind === 'jumper' && wall && wall.level <= 2 && Math.abs(wall.x - e.x) < 145 && e.spells <= 0) {
                e.windup = { kind: 'jump', left: .65, total: .65, targetId: wall.id, targetX: wall.x + Math.sign(target.x - e.x) * 100 };
                e.cooldown = 1;
                this.effect('star', e.x, .65);
                continue;
            }
            if (wall)
                target = { id: wall.id, x: wall.x, kind: 'building', object: wall };
            const distance = Math.abs(target.x - e.x), face = Math.sign(target.x - e.x) || -1;
            e.face = face;
            // 一条横路只有有限接敌面，后排近战排队推进，不能叠成一团同时穿模围殴。
            if (def.range < 100) {
                if (e.meleeTarget !== target.id) {
                    const previous = fronts.get(e.meleeTarget);
                    if (previous) {
                        const index = previous.indexOf(e);
                        if (index >= 0)
                            previous.splice(index, 1);
                    }
                }
                e.meleeTarget = target.id;
                const line = fronts.get(target.id) || [];
                if (!line.includes(e))
                    line.push(e);
                fronts.set(target.id, line);
                const rank = line.indexOf(e);
                if (rank >= 3) {
                    this.move(e, target.x - face * (def.range - 5 + (rank - 2) * 32), def.speed * 1.3, aiDt);
                    continue;
                }
            }
            else
                e.meleeTarget = undefined;
            if (distance > def.range + (target.kind === 'player' ? 24 : 0)) {
                this.move(e, target.x - face * (def.range - 5), def.speed * ((hero === null || hero === void 0 ? void 0 : hero.skill) === 'charge' && s.elapsed < (e.boostedUntil || 0) ? 2.1 : 1.3), aiDt);
                continue;
            }
            if (e.cooldown > 0)
                continue;
            if ((hero === null || hero === void 0 ? void 0 : hero.skill) === 'slam' && e.spells <= 0) {
                e.windup = { kind: 'slam', left: 1.1, total: 1.1, targetId: target.id, targetX: target.x };
                this.effect('warning', target.x, 1.1, hero.boss ? 1.5 : 1);
                s.effects[s.effects.length - 1].fired = true;
                continue;
            }
            if ((hero === null || hero === void 0 ? void 0 : hero.skill) === 'volley' && e.spells <= 0) {
                e.spells = 9;
                e.cooldown = 1.6;
                for (const t of (wall ? [target] : targets.filter(t => Math.abs(t.x - e.x) <= def.range).slice(0, 3)))
                    this.shoot(e.x, t.x, t.id, def.attack, false, 'arrow');
                continue;
            }
            e.cooldown = e.kind === 'mage' ? 2.5 : e.kind === 'elf' ? 1.4 : 1.15;
            if (e.kind === 'elf' && (e.ammo > 0 || !!hero) || e.kind === 'mage') {
                this.shoot(e.x, target.x, target.id, def.attack * (s.elapsed < (e.boostedUntil || 0) ? 1.25 : 1), false, e.kind === 'mage' ? 'fireball' : 'arrow');
                if (e.kind === 'elf' && !hero)
                    e.ammo--;
                if (e.kind === 'mage' && e.spells <= 0) {
                    e.spells = 11;
                    for (let i = -1; i <= ((hero === null || hero === void 0 ? void 0 : hero.skill) === 'meteor' ? 2 : 1); i++) {
                        this.effect('warning', target.x + i * 65, 1.7, .8);
                        const f = s.effects[s.effects.length - 1];
                        f.damage = def.attack;
                        f.tickDamage = 4 * ((_g = e.scale) !== null && _g !== void 0 ? _g : 1);
                    }
                }
            }
            else
                this.hurtTarget(target.id, def.attack * (s.elapsed < (e.boostedUntil || 0) ? 1.25 : 1), e.x);
        }
    }
    hurtTarget(id, damage, fromX) {
        const s = this.state;
        if (id === -1) {
            if (s.player.hurt > 0)
                return;
            s.player.hp = Math.max(0, s.player.hp - damage);
            s.player.hurt = 1.2;
            this.effect('hit', s.player.x, .45);
            return;
        }
        const n = s.goblins.find(n => n.id === id && !n.dead);
        if (n) {
            n.hp -= Math.max(1, damage - this.stats(n).defense);
            n.hit = .38;
            if (n.hp <= 0) {
                if (n.task === 'haul') {
                    const captive = s.enemies.find(e => e.hauler === n.id);
                    if (captive) {
                        captive.hauler = 0;
                        captive.state = 'bound';
                    }
                }
                n.dead = true;
                n.task = '';
                n.order = 'home';
                n.timer = 0;
                this.drop(n.x, n.carry + n.hidden);
                n.carry = 0;
                n.hidden = 0;
                if (n.loot > 0) {
                    s.gearDrops.push({ id: this.id(), x: n.x, amount: n.loot, age: 0 });
                    n.loot = 0;
                }
            }
            this.effect('hit', n.x, .3);
            this.dirty = true;
            return;
        }
        const b = s.buildings.find(b => b.id === id && b.hp > 0);
        if (b) {
            b.hp = Math.max(0, b.hp - damage);
            if (b.hp <= 0 && b.kind === 'wall') {
                if (b.region >= 0) {
                    s.camps[b.region].claimed = false;
                    s.camps[b.region].rebuild = 0;
                }
                if (this.flag.level)
                    this.relocateFlag();
            }
            this.effect('smoke', b.x, .4);
            this.dirty = true;
        }
        const m = s.machines.find(m => m.id === id && m.owner === 'goblin' && m.hp > 0);
        if (m) {
            m.hp = Math.max(0, m.hp - damage);
            if (m.hp === 0) {
                for (const unit of s.goblins)
                    if (m.crew.includes(unit.id)) {
                        unit.task = '';
                        unit.order = 'home';
                    }
                m.crew = [];
            }
            this.effect('smoke', m.x, .4);
            this.dirty = true;
        }
    }
    hitEnemy(e, damage, fromX, arrow = false) {
        var _a;
        if (e.state !== 'active' && e.state !== 'escaping')
            return;
        const frontal = Math.sign(fromX - e.x) === e.face;
        if (arrow && !e.stripped && e.kind === 'shield' && frontal && e.cooldown < .8)
            damage *= .22;
        if (arrow && ((_a = Rules_1.HEROES[e.hero || '']) === null || _a === void 0 ? void 0 : _a.skill) === 'armor')
            damage *= .55;
        if (this.state.enemies.some(n => { var _a; return n.state === 'active' && ((_a = Rules_1.HEROES[n.hero || '']) === null || _a === void 0 ? void 0 : _a.skill) === 'ward' && Math.abs(n.x - e.x) < 220; }))
            damage *= .75;
        e.hp -= Math.max(1, damage - this.enemyStats(e).defense);
        e.hit = .32;
        if (e.hp <= 0) {
            e.windup = undefined;
            e.jump = undefined;
            e.meleeTarget = undefined;
            e.towerId = undefined;
            e.state = this.rand() < .64 ? 'wounded' : 'dead';
            e.timer = 0;
            this.state.kills++;
            if (!e.counted) {
                e.counted = true;
                if (this.state.army) {
                    if ((e.force || (e.company ? 'field' : 'guard')) === 'field') {
                        this.state.army.lost++;
                        this.state.camps[e.camp].fieldLosses = (this.state.camps[e.camp].fieldLosses || 0) + 1;
                    }
                    else
                        this.state.army.guardLost++;
                }
                const company = this.state.companies.find(c => c.id === e.company);
                if (company) {
                    company.lost++;
                    if (company.lost >= company.initial) {
                        // 攻城队战至全部倒地才丢下器械，不因半数伤亡或天亮逃离。
                        for (const machine of this.state.machines)
                            if (machine.company === company.id && machine.owner === 'enemy') {
                                machine.owner = 'abandoned';
                                machine.order = 'park';
                            }
                    }
                }
                // 更大军队不能变成更多自动金币，只累计真实倒地，不含撤退与待出发人员。
                this.state.battleCoinProgress = (this.state.battleCoinProgress || 0) + 1;
                if (this.state.battleCoinProgress >= 3) {
                    this.state.battleCoinProgress -= 3;
                    this.drop(e.x, 1);
                }
            }
            this.dirty = true;
        }
    }
    damageCamp(c, damage) {
        if (c.defeated)
            return;
        c.hp = Math.max(0, c.hp - damage);
        if (c.hp <= 0 && this.campRemaining(c) === 0 && !this.state.fortifications.some(f => f.camp === c.index && f.hp > 0))
            this.clearCamp(c);
    }
    clearCamp(c) {
        if (!c.defeated) {
            c.defeated = true;
            c.rebuild = 0;
            c.claimed = this.state.buildings.some(b => b.kind === 'wall' && b.region === c.index && b.level > 0 && b.hp > 0);
            const next = this.state.camps[c.index + 1];
            if (next)
                next.frontierSince = this.state.day;
            if (!c.rewarded) {
                c.rewarded = true;
                this.drop(c.x, 50);
            }
            this.effect('smoke', c.x, 1.4, 3);
            this.events.push({ kind: 'camp', x: c.x });
            if (this.state.camps.every(c => c.defeated))
                this.finish('won');
            this.dirty = true;
        }
    }
    updateMachines(dt) {
        var _a, _b, _c, _d, _e;
        const s = this.state;
        for (const m of s.machines) {
            m.cooldown = Math.max(0, m.cooldown - dt);
            if (m.hp <= 0 || m.order === 'reserve')
                continue;
            if (m.owner === 'abandoned') {
                m.crew = m.crew.filter(id => s.goblins.some(n => n.id === id && !n.dead && n.task === 'salvageMachine' && n.targetId === m.id));
                if (!m.crew.length && !s.buildings.some(b => b.job) && !this.activeEnemies().some(e => Math.abs(e.x - m.x) < 250)) {
                    const worker = this.availableWorkers().sort((a, b) => Math.abs(a.x - m.x) - Math.abs(b.x - m.x))[0];
                    if (worker) {
                        m.crew = [worker.id];
                        worker.task = 'salvageMachine';
                        worker.targetId = m.id;
                    }
                }
                continue;
            }
            if (m.owner === 'goblin') {
                const crew = m.crew.map(id => s.goblins.find(n => n.id === id && !n.dead)).filter(Boolean);
                if (crew.length < m.crew.length) {
                    for (const n of crew) {
                        n.task = '';
                        n.order = 'home';
                    }
                    m.crew = [];
                    m.order = 'park';
                    this.dirty = true;
                }
                const canMove = crew.length === (m.order === 'return' ? Math.max(1, m.crew.length) : 2) && crew.every(n => n.stunned <= 0 && Math.abs(n.x - m.x) < 150);
                if (m.order === 'gather') {
                    if (canMove)
                        this.move(m, this.flag.x + 120, 56, dt);
                }
                else if (m.order === 'return') {
                    if (canMove)
                        this.move(m, Math.max(1100, this.frontier - 210), 54, dt);
                    if (Math.abs(m.x - Math.max(1100, this.frontier - 210)) < 12) {
                        m.order = 'park';
                        for (const n of crew) {
                            n.task = '';
                            n.order = 'home';
                        }
                        m.crew = [];
                    }
                }
                else if (m.order === 'expedition') {
                    const c = s.camps[s.expedition.camp];
                    if (!c || c.defeated)
                        continue;
                    const target = this.activeEnemies().filter(e => e.x > m.x).sort((a, b) => a.x - b.x)[0];
                    const fort = s.fortifications.filter(f => f.camp === c.index && f.hp > 0).sort((a, b) => Math.abs(a.x - m.x) - Math.abs(b.x - m.x))[0];
                    const destination = (_a = fort === null || fort === void 0 ? void 0 : fort.x) !== null && _a !== void 0 ? _a : c.x, targetEnemy = target && target.x < destination ? target : undefined;
                    const targetX = (_b = targetEnemy === null || targetEnemy === void 0 ? void 0 : targetEnemy.x) !== null && _b !== void 0 ? _b : destination, targetId = (_d = (_c = targetEnemy === null || targetEnemy === void 0 ? void 0 : targetEnemy.id) !== null && _c !== void 0 ? _c : fort === null || fort === void 0 ? void 0 : fort.id) !== null && _d !== void 0 ? _d : c.id;
                    const range = m.kind === 'ram' ? 85 : 430;
                    if (Math.abs(m.x - targetX) > range && canMove)
                        this.move(m, targetX - range + 5, 54, dt);
                    else if (canMove && m.cooldown <= 0) {
                        m.cooldown = m.kind === 'ram' ? 3 : 5;
                        if (m.kind === 'ram') {
                            if (targetEnemy)
                                this.hitEnemy(targetEnemy, 38 * (m.scale || 1), m.x);
                            else if (fort)
                                this.damageFort(fort.id, 46 * (m.scale || 1));
                            else
                                this.damageCamp(c, 46 * (m.scale || 1));
                        }
                        else
                            this.shoot(m.x, targetX, targetId, 38 * (m.scale || 1), true, m.kind === 'firecatapult' ? 'fire' : 'stone');
                    }
                }
            }
            else {
                const wall = s.buildings.filter(b => b.kind === 'wall' && b.hp > 0 && b.x < m.x).sort((a, b) => b.x - a.x)[0];
                const targetX = (_e = wall === null || wall === void 0 ? void 0 : wall.x) !== null && _e !== void 0 ? _e : s.player.x, distance = m.x - targetX, range = m.kind === 'ram' ? 85 : 420;
                if (distance > range)
                    this.move(m, targetX + range - 8, 46, dt);
                else if (m.cooldown <= 0) {
                    m.cooldown = m.kind === 'ram' ? 3.2 : 6;
                    if (m.kind === 'ram')
                        this.hurtTarget((wall === null || wall === void 0 ? void 0 : wall.id) || -1, 36 * (m.scale || 1), m.x);
                    else
                        this.shoot(m.x, targetX, (wall === null || wall === void 0 ? void 0 : wall.id) || -1, 30 * (m.scale || 1), false, m.kind === 'firecatapult' ? 'fire' : 'stone');
                }
            }
        }
    }
    updateAnimals(dt) {
        for (const a of this.state.animals) {
            a.timer += dt;
            a.moving = false;
            if (a.hp <= 0) {
                if (a.timer > 95) {
                    a.hp = a.kind === 'deer' ? 17 : 8;
                    a.x = a.home;
                    a.timer = 0;
                }
                continue;
            }
            const threat = this.activeEnemies().find(e => Math.abs(e.x - a.x) < 130) || this.state.goblins.find(n => !n.dead && n.role === 'hunter' && Math.abs(n.x - a.x) < 105);
            if (threat)
                this.move(a, (0, Rules_1.clamp)(a.x + Math.sign(a.x - threat.x) * 150, a.home - 240, a.home + 260), a.kind === 'deer' ? 146 : 118, dt);
            else if (a.timer > 3) {
                a.face = a.timer % 9 < 4 ? -1 : 1;
                this.move(a, a.home + a.face * 60, 22, dt);
                if (a.timer > 9)
                    a.timer = 0;
            }
        }
    }
    /** 使用真实站位高度，箭台和飞行不会只改变画面而仍在地面挨箭。 */
    hitElevation(id) {
        if (id === -1)
            return 46 + this.state.player.fly;
        const e = this.state.enemies.find(e => e.id === id && e.state === 'active');
        if (e === null || e === void 0 ? void 0 : e.towerId)
            return 46 + this.enemyTowerPosition(e).height;
        const n = this.state.goblins.find(n => n.id === id && !n.dead);
        const tower = (n === null || n === void 0 ? void 0 : n.towerId) ? this.state.buildings.find(b => b.id === n.towerId && b.hp > 0) : undefined;
        return tower && Math.abs(n.x - tower.x) < 55 ? 46 + this.towerPosition(n).height : 46;
    }
    shoot(x, targetX, targetId, damage, friendly, kind) {
        const duration = kind === 'stone' || kind === 'fire' ? 1.15 : Math.max(.15, Math.abs(targetX - x) / 650);
        const targetY = (kind === 'arrow' || kind === 'fireball') ? this.hitElevation(targetId) : undefined;
        this.state.shots.push({ id: this.id(), kind, fromX: x, x, targetX, targetId, friendly, damage, age: 0, duration, hit: false, fromY: kind === 'arrow' ? 46 : 70, targetY });
        this.events.push({ kind: kind === 'arrow' ? 'arrow' : 'throw', x });
    }
    updateShots(dt) {
        var _a, _b;
        const s = this.state;
        for (const shot of s.shots) {
            shot.age += dt;
            shot.x = shot.fromX + (shot.targetX - shot.fromX) * Math.min(1, shot.age / shot.duration);
            if (shot.hit || shot.age < shot.duration)
                continue;
            shot.hit = true;
            if (shot.kind === 'stone' || shot.kind === 'fire') {
                this.blast(shot.targetX, 72, shot.damage, shot.friendly);
                this.effect(shot.kind === 'fire' ? 'fire' : 'smoke', shot.targetX, shot.kind === 'fire' ? 4 : .7, 1.3);
                if (shot.kind === 'fire')
                    s.effects[s.effects.length - 1].tickDamage = 4 * shot.damage / (shot.friendly ? 38 : 30);
            }
            else if (shot.friendly) {
                const enemy = s.enemies.find(e => e.id === shot.targetId);
                if (enemy && Math.abs(enemy.x - shot.targetX) < 65 && Math.abs(this.hitElevation(enemy.id) - ((_a = shot.targetY) !== null && _a !== void 0 ? _a : 46)) <= 32)
                    this.hitEnemy(enemy, shot.damage, shot.fromX, true);
                const animal = s.animals.find(a => a.id === shot.targetId);
                if (animal && animal.hp > 0 && Math.abs(animal.x - shot.targetX) < 70) {
                    animal.hp -= shot.damage;
                    if (animal.hp <= 0) {
                        animal.timer = 0;
                        this.drop(animal.x, animal.kind === 'deer' ? 2 : 1);
                        this.effect('smoke', animal.x, .5);
                    }
                }
                const camp = s.camps.find(c => c.id === shot.targetId);
                if (camp)
                    this.damageCamp(camp, shot.damage);
                this.damageFort(shot.targetId, shot.damage);
            }
            else {
                // 敌方弹道与友方一样按真实落点命中，移动躲开不能继续按ID扣血。
                const target = shot.targetId === -1 ? s.player : s.goblins.find(n => n.id === shot.targetId && !n.dead) || s.buildings.find(b => b.id === shot.targetId && b.hp > 0) || s.machines.find(m => m.id === shot.targetId && m.hp > 0 && m.owner === 'goblin');
                const radius = shot.targetId === -1 ? 42 : target && 'kind' in target ? 42 : 26;
                if (target && Math.abs(target.x - shot.targetX) <= radius && Math.abs(this.hitElevation(shot.targetId) - ((_b = shot.targetY) !== null && _b !== void 0 ? _b : 46)) <= 32)
                    this.hurtTarget(shot.targetId, shot.damage, shot.fromX);
            }
        }
        s.shots = s.shots.filter(shot => shot.age < shot.duration + .18);
    }
    blast(x, radius, damage, friendly) {
        if (friendly) {
            for (const e of this.activeEnemies())
                if (Math.abs(e.x - x) < radius)
                    this.hitEnemy(e, damage, x);
            for (const c of this.state.camps)
                if (Math.abs(c.x - x) < radius + 40)
                    this.damageCamp(c, damage);
            for (const f of this.state.fortifications)
                if (f.hp > 0 && Math.abs(f.x - x) < radius)
                    this.damageFort(f.id, damage);
        }
        else {
            if (Math.abs(this.state.player.x - x) < radius)
                this.hurtTarget(-1, damage, x);
            for (const n of this.state.goblins)
                if (!n.dead && Math.abs(n.x - x) < radius)
                    this.hurtTarget(n.id, damage, x);
            for (const b of this.state.buildings)
                if (b.hp > 0 && Math.abs(b.x - x) < radius)
                    this.hurtTarget(b.id, damage, x);
        }
    }
    updatePrison(dt) {
        const s = this.state, t = s.trader;
        t.prevX = t.x;
        if (t.phase === 'away') {
            t.present = false;
            t.timer -= dt;
            if (t.timer <= 0) {
                t.x = 2600;
                t.phase = 'arriving';
            }
        }
        else if (t.phase === 'arriving') {
            const destination = this.prison.x + 205;
            t.x = Math.max(destination, t.x - 88 * dt);
            if (t.x === destination) {
                t.phase = 'trading';
                t.present = true;
                t.timer = 65;
            }
        }
        else if (t.phase === 'trading') {
            t.present = true;
            t.timer -= dt;
            if (t.timer <= 0) {
                t.present = false;
                t.phase = 'leaving';
            }
        }
        else {
            t.present = false;
            t.x += 88 * dt;
            if (t.x > 2650) {
                t.phase = 'away';
                t.timer = 175;
            }
        }
        const capacity = this.prison.hp > 0 ? Rules_1.RULES.prisonCapacity[this.prison.level] : 0;
        let occupied = 0;
        for (const e of s.enemies)
            if (e.state === 'captured') {
                if (occupied < capacity)
                    occupied++;
                else {
                    e.state = 'bound';
                    e.atPrison = true;
                    e.hauler = 0;
                }
            }
        // 先按整座监牢计算空位，再提升牢旁俘虏，不能依赖数组先后顺序。
        for (const e of s.enemies)
            if (e.state === 'bound' && !e.hauler && e.atPrison && occupied < capacity) {
                e.state = 'captured';
                occupied++;
            }
        for (const e of s.enemies)
            if (e.state === 'bound' && e.hauler) {
                const carrier = s.goblins.find(n => n.id === e.hauler && !n.dead && n.task === 'haul' && n.targetId === e.id);
                if (carrier) {
                    e.x = carrier.x - carrier.face * 48;
                    e.face = carrier.face;
                }
                else
                    e.hauler = 0;
            }
        const layout = (0, PrisonLayout_1.prisonLayout)(this.prison.level, s.enemies.filter(e => e.state === 'captured'));
        let inside = 0, outside = 0;
        for (const e of s.enemies) {
            if (e.state === 'captured') {
                e.prisonSlot = inside++;
                e.x = this.prison.x + layout.slotX(e.prisonSlot);
            }
            if (e.state === 'bound' && !e.hauler && e.atPrison) {
                e.x = this.prison.x + 90 + outside++ * 22;
            }
            if ((e.state === 'captured' || e.state === 'bound' && !e.hauler) && e.timer > 22) {
                e.timer = 0;
                const chance = e.state === 'bound' ? .26 : [0, .10, .06, .035, .02, .01][this.prison.level];
                if (this.rand() < chance) {
                    e.state = 'escaping';
                    e.atPrison = false;
                    e.hp = e.maxHp * .4;
                    e.timer = 0;
                    this.effect('star', e.x, .7);
                    this.dirty = true;
                }
            }
            // 长地图仍要给正常步行绑运留出时间，不能让远营所有活口在搬运者到达前必死。
            if (e.state === 'wounded' && e.timer > 160 + Math.max(0, e.x - this.prison.x) / 110) {
                e.state = 'dead';
                e.timer = 0;
            }
            if (e.state === 'dead' && e.stripped && e.timer > 90) {
                e.state = 'gone';
                e.timer = 0;
            }
        }
        s.enemies = s.enemies.filter(e => !e.returned && (!['gone', 'sold'].includes(e.state) || e.timer < 2));
    }
    updateCampaign(dt) {
        const s = this.state;
        for (const c of s.camps) {
            if (c.hp <= 0 && !c.defeated && this.campRemaining(c) === 0 && !s.fortifications.some(f => f.camp === c.index && f.hp > 0))
                this.clearCamp(c);
            if (!c.defeated || c.claimed)
                continue;
            c.rebuild += dt;
            if (c.rebuild >= this.rebuildDuration(c)) {
                // 墙必须完工有效，投第一枚或施工虚影不构成巩固。
                const wall = s.buildings.find(b => b.kind === 'wall' && b.region === c.index && b.level && b.hp > 0);
                if (wall) {
                    c.claimed = true;
                    continue;
                }
                c.defeated = false;
                c.hp = c.maxHp;
                c.rebuild = 0;
                this.spawnGuards(c);
                this.effect('smoke', c.x, 1, 2);
                this.dirty = true;
            }
        }
        // 全军覆没后释放出征状态，幸存居民仍可重新征召；不复活、不退款或补发奖励。
        if ((s.expedition.state === 'march' || s.expedition.state === 'hold' || s.expedition.state === 'gather') && this.flagUsed === 0) {
            s.expedition.state = 'home';
            this.dirty = true;
        }
        if (s.expedition.state === 'return' && !s.goblins.some(n => !n.dead && n.order === 'return'))
            s.expedition.state = 'home';
        if (s.elapsed % 6 < dt)
            this.dirty = true;
    }
}
exports.GameModel = GameModel;
