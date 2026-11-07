import { BUILDINGS, RULES, HEROES, Role, EnemyKind, MachineKind, Mount, clamp } from './Rules';
import { Action, Animal, Building, Camp, Coin, Company, Context, Effect, Enemy, Goblin, Machine, Shot, State } from './State';
import { upgradeWorld } from './WorldUpgrade';
import {prisonLayout} from './PrisonLayout';
import {upgradeProgression,upgradeAllowed,towerSpot} from './Progression';
import {Soldier,UnitSpec,GUARD_ROSTERS,OPENING_FIELD,FORTS,expandRoster,guardSpecs,enemyFactor,guardCapacity,raidCount,raidPlan} from './CampaignRules';
import {upgradeCampaign} from './CampaignUpgrade';
import { newChapter, resumeChapter } from './ChapterProgress';
import {upgradeHorde,armoredDamage} from './HordeUpgrade';
import { CAVE_PRISON_X, CAVE_TOWER_REGION, REMOVED_STALLS, TRADER_CART_OFFSET, TRADER_STOP, upgradeBaseLayout, replaceCaveTower } from './BaseLayout';
import { ATTACK_LEAD, METEOR_DAMAGE_RADIUS } from './EnemyAttack';
import type { QueuedAttackStyle } from './EnemyAttack';

const AD_VARIANTS = ['gold', 'hunter', 'worker', 'lizard', 'wolf', 'bat', 'stamina'];

/** 取最近目标不排序或创建副本，密集战斗的查询保持线性。 */
function closest<T extends {x:number}>(items:readonly T[],x:number,valid:(item:T)=>boolean):T|undefined{
    let best:T|undefined,distance=Infinity;
    for(const item of items){const d=Math.abs(item.x-x);if(d<distance&&valid(item)){best=item;distance=d;}}
    return best;
}

/** 引擎无关的权威状态。动画、镜头和异步平台回调不能自行结算金币或伤害。 */
export class GameModel {
    state: State;
    private safeCorpses:Enemy[]|null=null;
    private corpseReservations = new Map<number, number>();
    input = { axis: 0, run: false };
    pauses = new Set<string>();
    dirty = true;
    events: { kind: string; x: number }[] = [];
    private selected = 0;
    private whipFocused = 0;
    private whipFocusUntil = 0;
    private manualTarget = 0;
    private candidates: Context[] = [];
    private selectionX=NaN;
    private towerClock=0;
    private liveEnemies:Enemy[]=[];
    private enemiesDirty=true;
    private enemyById=new Map<number,Enemy>();
    private towerPositions=new Map<number,{x:number;height:number}>();
    private enemyTowerPositions=new Map<number,{x:number;height:number}>();
    private threatCache=new Map<number,{goblins:number;enemies:number}>();
    private threatClock=0;
    private lastWithdrawal = -Infinity;
    private marchAnchor = 0;
    private escort: Machine[] = [];
    notice: {text:string;until:number}|null=null;
    tell(text:string):void{this.notice={text,until:this.state.elapsed+1.8};}
    isWhipTarget(id:number):boolean{return this.whipFocused===id&&this.state.elapsed<this.whipFocusUntil;}
    get nearbyTargets(): number { return this.candidates.length+(this.selected!==0&&!this.candidates.some(c=>c.id===this.selected)?1:0); }
    /** 密集营地允许用底部图标切换附近目标，仍然不直接点击世界对象。 */
    cycleTarget(): void {
        this.context();
        if (!this.candidates.length) return;
        const list = this.candidates.slice().sort((a,b)=>a.x-b.x || a.id-b.id);
        const index = list.findIndex(c=>c.id===this.selected);
        this.manualTarget = list[(index+1)%list.length].id;
    }
    constructor(saved?: State, seed = 731) {
        this.state = saved && saved.version === RULES.saveVersion ? saved : this.createState(seed);
        resumeChapter(this.state);
        const oldRevision=this.state.revision||0;
        upgradeWorld(this.state);
        upgradeProgression(this.state);
        upgradeCampaign(this.state,oldRevision<10);
        this.initializeCampaign();
        upgradeHorde(this.state);
        upgradeBaseLayout(this.state);
        replaceCaveTower(this.state);
        this.syncDrum();
        if (oldRevision < 17) {
            // 旧档已出发的队继续攻营，旧集结队回防后可从战鼓重新召集。
            if (this.state.expedition.state === 'march') this.state.expedition.state = 'assault';
            else if (this.state.expedition.state === 'gather') this.recallExpedition();
        }
        if (oldRevision < 22) {
            this.state.player.hp = this.state.player.hp / 100 * this.playerMaxHp;
            this.state.revision = 22;
        }
        if (oldRevision < 23) {
            // 缩短旧档的剩余夜晚，保留天数和战役绝对计时，不借更新跨日。
            const time = this.state.time;
            if (time >= RULES.daylightSeconds) this.state.time = RULES.daylightSeconds +
                (time - RULES.daylightSeconds) * (RULES.daySeconds - RULES.daylightSeconds) / 120;
            this.state.revision = 23;
        }
        const recruitment = this.state.recruitment!;
        recruitment.recent ??= Array(Math.min(2, recruitment.count || 0)).fill(this.state.elapsed);
        if (oldRevision < 21) recruitment.next = Math.min(recruitment.next, this.state.elapsed + 30);
        // 旧档未出发的旧编制归还储备，已经开始的战斗接续原进度。
        const prep = this.state.raidPrep;
        if (prep && prep.units.length !== raidCount(prep.day)) {
            this.state.army!.reserve.push(...prep.units);
            this.state.raidPrep = undefined;
        }
        if (this.state.raidsWaiting) this.state.raidsWaiting = this.state.raidsWaiting.filter(day => day >= RULES.enemySortieStartDay);
        this.prepareRaid(this.state.day);
        this.rebuildEnemyCache();
        // 旧档的夜袭撤退指令在本轮废止，逃狱与巡逻回营仍走各自状态。
        for(const c of this.state.companies)c.retreating=false;
        // 飞行、按键与广告不是持久动作；读档不延续正在按住的交互。
        this.state.player.prevX = this.state.player.x;
        if (this.state.drumCart) this.state.drumCart.prevX = this.state.drumCart.x;
        this.state.player.whip = 0;
        this.cancelPledge();
        // 开局赠送招募盘；旧档未开工的补齐，已付款施工和更高等级保留，读档不重复赠币。
        const starterLure=this.state.buildings.find(b=>b.kind==='lure');
        if(starterLure&&starterLure.level===0&&!starterLure.job)Object.assign(starterLure,{level:1,hp:100,maxHp:100});
        for (const n of this.state.goblins) n.prevX = n.x;
        for (const e of this.state.enemies) {
            e.prevX = e.x; e.ammo ??= 12;
            e.atPrison ??= e.state==='captured' || e.state==='bound' && !e.hauler && Math.abs(e.x-this.prison.x)<250;
            if (oldRevision === 21 && e.saleValue !== undefined) e.saleValue += 2;
            if (e.saleValue !== undefined) e.saleValue = clamp(e.saleValue, 4, 6);
            if (e.state === 'dead') e.coinLoot = this.corpseReward(e);
        }
        this.syncPrisonLocation();
        for (const m of this.state.machines) m.prevX = m.x;
        for(const c of this.state.camps)if(!c.reserve){
            const spec=RULES.camps[c.index],existing=this.state.enemies.filter(e=>e.camp===c.index&&!e.company).length;
            c.reserve=c.defeated?[]:Array.from({length:Math.max(0,spec.total-existing)},(_,i)=>spec.guard[i%spec.guard.length] as EnemyKind);
            c.heroesPending=c.defeated?[]:spec.heroes.slice();c.reinforcementClock=3;
            this.createFortifications(c);
        }
    }
    private createState(seed: number): State {
        const s: State = {
            version: 9, revision:12, seed, nextId: 1, elapsed: 0, time: 18, day: 1, status: 'playing', gold: 32, treasury: 8,battleCoinProgress:0,
            chapter: newChapter(),
            gearStock: 0, equipmentStock: 0, populationPending: { hunter: 0, worker: 0 },
            player: { x: 400, prevX: 400, face: 1, hp: 100, stamina: 100, mount: 'boar', fly: 0, hurt: 0, whip: 0 },
            goblins: [], enemies: [], camps: [], companies: [], machines: [], buildings: [], coins: [], animals: [], shots: [], effects: [],gearDrops:[],fortifications:[],recruitment:{start:0,limit:2,count:0,next:60},
            pledge: null, expedition: { state: 'home', camp: 0 }, unlockedMounts: ['boar'], mountBoost: {}, adReceipts: [],
            trader: { x: 2600, prevX:2600,present: false,phase:'away' }, raids: 0, kills: 0, sold: 0, spent: 0,
        };
        const add = (kind: string, x: number, level = 0, region = -1) => {
            const hp = BUILDINGS[kind].hp?.[level] ?? (level ? 100 : 0);
            s.buildings.push({ id: s.nextId++, kind, x, level, hp, maxHp: hp, region, stock: 0, timer: 0 });
        };
        add('treasury', 220, 1); add('hall', 400, 1); add('prison', 700, 1); add('gear', 910, 1);
        add('worker', 1200, 1); add('hunter', 1345, 1); add('brute', 1490, 1); add('lure', 1640, 1);
        add('flag', 970); add('forge', 1050); add('repair', 2550);
        // 基础生产在首道墙内，不能把首个生产点放到联军必经的墙外。
        add('wall', 2100); add('tower', 2000); add('net', 2200); add('rock', 2300); add('farm', 1800);
        for (let i = 0; i < RULES.camps.length; i++) {
            const c = RULES.camps[i];
            s.camps.push({ id: s.nextId++, index: i, x: c.x, hp: c.hp, maxHp: c.hp, defeated: false, claimed: false, rewarded: false, rebuild: 0 });
            const extension=[780,880,940,1000,-185][i];
            add('wall', c.x + extension, 0, i); add('tower', c.x + extension - 100, 0, i);
            if (i < 4) { add(i % 2 ? 'mine' : 'wood', c.x + 320 + i*30, 0, i); add('farm', c.x + 490 + i*40, 0, i); }
        }
        this.state = s;
        add('wall',3250,0,-2);add('tower',3150,0,-2);add('wood',2760,0,-2);add('farm',2980,0,-2);
        add('wall',4250,0,-2);add('tower',4150,0,-2);add('mine',3700,0,-2);
        const startingRoles = ['worker', 'hunter', 'idle', 'idle', 'idle', 'idle'] as const;
        startingRoles.forEach((role, i) => s.goblins.push(this.makeGoblin(role, 280 + i * 85)));
        s.goblins[2].hidden = 2;
        for (const c of s.camps) this.spawnGuards(c);
        for (let i = 0; i < 32; i++) {
            const x = 1830 + i * ((RULES.shoreX-2200)/32);
            s.animals.push({ id: s.nextId++, kind: i % 4 ? 'rabbit' : 'deer', x, home: x, hp: i % 4 ? 8 : 17, face: i % 2 ? 1 : -1, moving: false, timer: i % 5 });
        }
        upgradeHorde(s);
        upgradeBaseLayout(s);
        replaceCaveTower(s);
        s.recruitment = {start:0,limit:3,count:0,next:28,recent:[]};
        s.revision = 23;
        this.initializeCampaign();
        return s;
    }
    id(): number { return this.state.nextId++; }
    rand(): number { this.state.seed = (Math.imul(1664525, this.state.seed) + 1013904223) >>> 0; return this.state.seed / 4294967296; }
    get hall(): Building { return this.state.buildings.find(b => b.kind === 'hall')!; }
    get playerMaxHp(): number { return 100 * RULES.hallFactor[this.hall.level]; }
    get truceSeconds(): number { return Math.max(0, (this.state.truceUntil ?? 0) - this.state.elapsed); }
    get flag(): Building { return this.state.buildings.find(b => b.kind === 'flag')!; }
    get prison(): Building { return this.state.buildings.find(b => b.kind === 'prison')!; }
    get forge(): Building { return this.state.buildings.find(b => b.kind === 'forge')!; }
    get drumPlaying(): boolean {
        const { drumCart, expedition, goblins } = this.state;
        return !!drumCart && !drumCart.abandoned && (expedition.state === 'march' || expedition.state === 'assault') &&
            goblins.some(n => n.id === expedition.drummer && !n.dead && !n.retreat && n.stunned <= 0);
    }
    get population(): number { return this.state.goblins.filter(n => !n.dead).length; }
    get populationLimit(): number { return RULES.population[this.hall.level || 1]; }
    get night(): boolean { return this.state.time >= RULES.daylightSeconds; }
    get canSprint(): boolean {
        const { player, mountBoost } = this.state;
        return this.infiniteStaminaSeconds > 0 || mountBoost[player.mount] > 0 || (!player.exhausted && player.stamina > 1);
    }
    get infiniteStaminaSeconds(): number {
        return Math.max(0, (this.state.infiniteStaminaUntil ?? 0) - this.state.elapsed);
    }
    get frontier(): number {
        const walls = this.state.buildings.filter(b => b.kind === 'wall' && b.hp > 0 && b.level > 0);
        return Math.max(2300, ...walls.map(b => b.x));
    }
    get waitingForSiege(): boolean {
        return this.state.expedition.state === 'march' && this.escort.some(m => m.order === 'expedition' && m.hp > 0) &&
            this.marchAnchor < this.state.player.x - 35;
    }
    get nearestCamp(): Camp | undefined { return this.state.camps.find(c => !c.defeated); }
    towerPosition(n:Goblin):{x:number;height:number}{
        const cached=this.towerPositions.get(n.id);if(cached)return cached;
        const b=this.state.buildings.find(b=>b.id===n.towerId&&b.hp>0);if(!b)return{x:n.x,height:0};
        let rank=0;for(const q of this.state.goblins)if(!q.dead&&q.towerId===b.id&&q.id<n.id)rank++;
        const spot=towerSpot(b.level,rank),position={x:b.x+spot.x,height:spot.height};this.towerPositions.set(n.id,position);return position;
    }
    rebuildDuration(c: Camp): number { return RULES.rebuildSeconds + c.index * RULES.rebuildPerRegion; }
    makeGoblin(role: Role, x: number): Goblin {
        const hp = RULES.role[role].hp * RULES.hallFactor[this.hall?.level||1];
        return { id: this.id(), role, x, prevX: x, face: 1, hp, maxHp: hp, cooldown: 0, timer: 0, targetX: x, moving: false, speed: 0,
            carry: 0, hidden: 0, lastWhip: this.state.elapsed, hit: 0, stunned: 0, strikes: 0, strikeAt: -10, gear: 0, loot: 0,
            order: 'home', task: '', targetId: 0, dead: false };
    }
    stats(n: Goblin): { hp: number; attack: number; defense: number } {
        const base = RULES.role[n.role], hallFactor = RULES.hallFactor[Math.max(1, this.hall.level)];
        const factor = hallFactor * (1 + (RULES.equipmentBonus[n.gear]||0));
        return { hp: base.hp * factor, attack: base.attack * factor, defense: base.defense * factor };
    }
    private updateStats(): void {
        for (const n of this.state.goblins) {
            const old = n.maxHp; n.maxHp = this.stats(n).hp;
            if (!n.dead) n.hp = Math.min(n.maxHp, n.hp * n.maxHp / Math.max(1, old));
        }
    }
    efficiency(n: Goblin): number { return n.stunned > 0 ? 0 : this.state.elapsed - n.lastWhip < 45 ? 1.25 : Math.max(.8, 1 - (this.state.elapsed - n.lastWhip - 45) / 600); }
    private logisticsFactor():number{return 1+(Math.max(1,this.hall.level)-1)*.35;}
    private hallSpeed = 1;
    get returnHomeSeconds(): number { return Math.max(0, (this.state.returnHomeAt ?? 0) - this.state.elapsed); }
    get awayFromHome(): boolean { return Math.abs(this.state.player.x - this.hall.x) > 900; }
    get canReturnHome(): boolean {
        return this.awayFromHome && !this.returnHomeSeconds && this.hall.hp > 0 &&
            this.state.expedition.state === 'home';
    }
    /** 回洞与投币退款是一次操作，冷却用战役时间随档保存。 */
    returnHome(): boolean {
        const s = this.state, p = s.player;
        if (this.pauses.size || s.status !== 'playing' || p.hp <= 0 || !this.canReturnHome) return false;
        this.cancelPledge();
        p.x = p.prevX = this.hall.x - 90;
        p.fly = 0;
        s.returnHomeAt = s.elapsed + RULES.returnHomeCooldown;
        this.selected = this.manualTarget = 0;
        this.selectionX = NaN;
        this.effect('smoke', p.x, .65);
        this.dirty = true;
        return true;
    }
    visible(b: Building): boolean {
        if (REMOVED_STALLS.has(b.kind)) return false;
        if (b.kind === 'flag') return this.hall.level >= 2;
        if (b.level || b.job) return true;
        const def = BUILDINGS[b.kind];
        if (this.hall.level < def.hall) return false;
        if(b.region===-2&&!b.discovered)return false;
        if (b.region >= 0 && !this.state.camps[b.region].defeated) return false;
        if (b.kind === 'repair' && !this.state.camps[1].rewarded) return false;
        return true;
    }
    context(): Context | null {
        const p = this.state.player;
        const contexts: Context[] = [];
        for (const b of this.state.buildings) {
            if (!this.visible(b)) continue;
            const cart = b.kind === 'flag' && !this.state.drumCart?.abandoned ? this.state.drumCart : undefined;
            const x = cart?.x ?? b.x;
            if (Math.abs(x - p.x) < RULES.interactRange) contexts.push(this.buildingContext(b, x));
        }
        for (const n of this.state.goblins) if (!n.dead && Math.abs(n.x - p.x) < RULES.interactRange) {
            const actions: Action[] = [{ key: `whip:${n.id}`, targetId: n.id, type: 'whip', cost: 0, icon: 'icon_whip' }];
            contexts.push({ id: n.id, kind: 'goblin', x: n.x, name: RULES.role[n.role].name, description: '', actions });
        }
        for (const body of this.state.goblins) if (body.dead && Math.abs(body.x - p.x) < RULES.interactRange)
            contexts.push(this.corpseContext(body));
        for (const body of this.state.enemies) if (body.state === 'dead' && Math.abs(body.x - p.x) < RULES.interactRange)
            contexts.push(this.corpseContext(body));
        if(this.state.trader.present&&this.state.trader.phase==='trading'&&Math.abs(this.state.trader.x-p.x)<RULES.interactRange){
            const available=this.state.enemies.some(e=>e.state==='captured'||e.state==='bound'&&e.atPrison&&!e.hauler);
            contexts.push({id:-100,kind:'trader',x:this.state.trader.x,name:'俘虏商人',description:'售出关押的俘虏',actions:[{key:'sell:trader',targetId:-100,type:'sell',cost:0,icon:'coin',disabled:!available}]});
        }
        for (const m of this.state.machines) if (m.owner === 'goblin' && Math.abs(m.x - p.x) < RULES.interactRange+20) {
            const name = { ram: '破门冲车', catapult: '缴获投石车', firecatapult: '火焰投石车' }[m.kind];
            const actions: Action[] = [];
            if (m.order === 'park') {
                if (m.hp < m.maxHp) actions.push({ key: `repairMachine:${m.id}`, targetId: m.id, type: 'repairMachine', cost: Math.max(1,4-Math.ceil((this.state.buildings.find(b=>b.kind==='repair')?.level||0)/2)), icon: 'coin' });
            }
            contexts.push({ id: m.id, kind: 'machine', x: m.x, name, description: '敲响战鼓后由两名苦工推行', actions });
        }
        const standing=Number.isFinite(this.selectionX)&&Math.abs(p.x-this.selectionX)<7;
        contexts.sort((a, b) => {
            // 投币中保持目标，受击冷却不取消高亮；附近路过的爪牙不抢走建筑。
            const weight = (c: Context) => Math.abs(c.x - p.x) + (c.kind === 'goblin' && Math.abs(c.x-p.x)>14 ? 12 : 0) - (c.id === this.selected && c.kind !== 'goblin' ? 6 : 0) - (c.id === this.state.pledge?.targetId ? 40 : 0)
                - (standing&&c.id===this.selected?1000:0) - (c.id===this.manualTarget ? 2000 : 0);
            return weight(a) - weight(b);
        });
        this.candidates = contexts;
        if (!contexts.some(c=>c.id===this.manualTarget)) this.manualTarget=0;
        // 原对象自行走远或离场时只收起操作，站定不把同一个按键悄悄转交别人。
        const lostStationaryTarget=standing&&this.selected!==0&&!this.manualTarget&&!contexts.some(c=>c.id===this.selected);
        const chosen = lostStationaryTarget?undefined:contexts[0];
        // 建筑旁的哥布林仍能挨鞭子；按下后焦点移到挨打者，冷却不熄灭其光边。
        if (chosen && chosen.kind !== 'goblin' && chosen.actions.length < 3) {
            const near = contexts.filter(c => c.kind === 'goblin').sort((a,b) => Math.abs(a.x-p.x)-Math.abs(b.x-p.x))[0];
            if (near) chosen.actions.push(near.actions[0]);
        }
        if(chosen||!standing)this.selected = chosen?.id || 0;
        if(!standing||!Number.isFinite(this.selectionX))this.selectionX=p.x;
        return chosen || null;
    }
    private corpseContext(body: Goblin | Enemy): Context {
        const { id, x } = body;
        return { id, x, kind: 'corpse', name: '战场遗体', description: '回收遗体',
            actions: [{ key: `recover:${id}`, targetId: id, type: 'recover', cost: 0, icon: 'coin' }] };
    }
    private buildingContext(b: Building, x = b.x): Context {
        const def = BUILDINGS[b.kind], actions: Action[] = [];
        const push = (type: string, cost: number, icon = 'coin', variant?: string, disabled = false) => actions.push({ key: `${type}:${b.id}:${variant || ''}`, targetId: b.id, type, cost, icon, variant, disabled });
        if (!b.job) {
            if (b.kind === 'treasury') push('withdraw', 0, 'chest', undefined, this.state.treasury <= 0 || this.state.gold >= 50);
            else if (b.kind === 'gear') { if (this.state.gearStock) push('scrapGear', 0, 'coin'); }
            else if (b.kind === 'flag') {
                const phase = this.state.expedition.state;
                if (phase === 'home') push('dispatch', RULES.drumCost, 'coin', undefined, !this.canDispatch());
                else if (phase === 'assault') push('retreat', RULES.drumRetreatCost, 'icon_rotate');
                else if (phase === 'gather' || phase === 'march') push('recall', 0, 'icon_rotate');
            }
            else if (b.level === 0 || b.hp <= 0 && b.maxHp > 0) push('build', b.level ? 2 : def.costs[0]);
            else {
                if (['worker', 'hunter', 'brute'].includes(b.kind)) push('tool', def.costs[0], 'coin',undefined,b.stock>=RULES.toolCapacity[b.level]);
                else if (b.kind === 'lure') push('bait', 2, 'coin', undefined, b.stock >= b.level * 3 || this.population >= this.populationLimit);
                else if (b.kind === 'forge') push('craft', RULES.equipmentPrice[b.level], 'coin', undefined, this.state.gearStock < 2 || this.state.equipmentStock >= 6);
                if (b.level < def.maxLevel && upgradeAllowed(this.state,b)) push('upgrade', def.costs[b.level], 'hammer');
                if (b.maxHp > 0 && b.hp < b.maxHp) push('repairBuilding', 2, 'hammer');
            }
        }
        let description = b.job ? '苦工正在施工' : def.description;
        let name=b.region === CAVE_TOWER_REGION ? '洞口城墙' : def.name;
        if(b.level&&def.maxLevel>1){name+=' '+['','I','II','III','IV','V'][b.level];
            if(!b.job&&b.kind==='hall')description=b.level>=5?'部落已达巅峰':upgradeAllowed(this.state,b)?`人口 ${this.population}/${this.populationLimit}`:`攻下${RULES.camps[b.level-2]?.name||'敌营'}后可扩建`;
            if(!b.job&&b.kind==='prison')description=`关押 ${this.state.enemies.filter(e=>e.state==='captured').length}/${RULES.prisonCapacity[b.level]}`;
            if(!b.job&&b.kind==='tower')description=`驻守猎手 ${this.state.goblins.filter(n=>!n.dead&&n.towerId===b.id).length}/${RULES.towerSlots[b.level]}`;
            if(!b.job&&b.kind==='forge')description=`猎手与恶霸护甲 增幅${Math.round(RULES.equipmentBonus[b.level]*100)}%`;
        }
        if (b.kind === 'flag') {
            description = { home: def.description, gather: '苦工敲鼓，战士集结', march: '部队跟随首领',
                assault: '投币下令全军撤退', hold: '部队重新整队', return: '部队返回防线' }[this.state.expedition.state];
            if (this.state.expedition.state === 'home' && !this.canDispatch()) description = '需要两名空闲苦工和一名战士';
        }
        if (b.kind === 'treasury') description = '';
        if (b.kind === 'gear') description = `缴获装备 ${this.state.gearStock}`;
        return { id: b.id, kind: b.kind, x, name, description, actions, level: b.level, amount:b.kind==='treasury'?this.state.treasury:undefined };
    }
    /** 每次只投一枚；只有筹满才提交，离开或切换操作按原账户退还未提交款。 */
    act(action: Action): 'none' | 'ad' | 'done' {
        if (this.pauses.size || this.state.status !== 'playing' || action.disabled) return 'none';
        // HUD广告与靠近交互共用平台流程，限定合法变体，不依赖已移除的世界摊位。
        if (action.targetId === -200) {
            const variant = action.variant || '';
            if (action.type === 'ad' && action.key === `hudAd:${variant}` && AD_VARIANTS.includes(variant)) return 'ad';
            const mount = variant as Mount;
            if (action.type === 'mount' && action.key === `hudMount:${mount}` && this.state.unlockedMounts.includes(mount)) {
                this.state.player.mount = mount;
                this.state.player.stamina = Math.min(this.state.player.stamina, RULES.mount[mount].stamina);
                this.dirty = true;
                return 'done';
            }
            return 'none';
        }
        const context = this.context(), live = context?.actions.find(a => a.key === action.key);
        if (!live || live.disabled) return 'none';
        action = live;
        if (action.type === 'ad') return 'ad';
        if (!this.canCommit(action)) return 'none';
        if (action.cost > 0) {
            if (this.state.pledge?.key !== action.key) { this.cancelPledge(); this.state.pledge = { key: action.key, targetId: action.targetId, action: { ...action }, paid: 0, x: context!.x }; }
            if (this.state.gold <= 0) return 'none';
            this.state.gold--; this.state.pledge!.paid++; this.events.push({ kind: 'coin', x: context!.x }); this.dirty = true;
            if (this.state.pledge!.paid < action.cost) return 'done';
            this.state.spent += action.cost; this.state.pledge = null;
        } else if (this.state.pledge) this.cancelPledge();
        this.commit(action); this.dirty = true; return 'done';
    }
    private canCommit(a: Action): boolean {
        if (a.type === 'dispatch') return this.canDispatch();
        if (a.type==='tool'){const b=this.state.buildings.find(b=>b.id===a.targetId);return !!b&&b.stock<RULES.toolCapacity[b.level];}
        if (a.type === 'craft') return this.state.gearStock >= 2;
        return true;
    }
    private canDispatch(): boolean {
        return this.hall.level >= 2 && this.state.expedition.state === 'home' && !!this.nearestCamp &&
            this.state.goblins.some(n => this.isFighter(n)) && this.availableWorkers().length >= 2;
    }
    cancelPledge(): void {
        if (!this.state.pledge) return;
        this.gain(this.state.pledge.paid); // 收到别的金币后再退款，超出钱袋的部分仍归主厅，不吞币也不突破上限。
        this.events.push({ kind: 'refund', x: this.state.pledge.x }); this.state.pledge = null; this.dirty = true;
    }
    private commit(a: Action): void {
        const s = this.state, b = s.buildings.find(b => b.id === a.targetId), n = s.goblins.find(n => n.id === a.targetId), m = s.machines.find(m => m.id === a.targetId);
        if (a.type === 'recover') {
            const enemy = s.enemies.find(e => e.id === a.targetId && e.state === 'dead');
            if (n?.dead || enemy) this.recoverBody(n?.dead ? n : enemy!, true);
            return;
        }
        if (a.type === 'whip' && n) { this.whip(n); return; }
        if (a.type === 'repairMachine' && m) { m.hp = m.maxHp; return; }
        if(a.type==='sell'&&a.targetId===-100){if(s.trader.present&&s.trader.phase==='trading')this.sellCaptives();return;}
        if (!b) return;
        switch (a.type) {
            case 'withdraw':
                if (s.treasury > 0 && s.gold < RULES.purseLimit) {
                    s.treasury--;
                    s.gold++;
                    s.chapter!.done.withdraw = true;
                    if (s.elapsed - this.lastWithdrawal > .85) this.events.push({ kind: 'chest', x: b.x });
                    this.lastWithdrawal = s.elapsed;
                    this.events.push({ kind: 'coin', x: b.x });
                }
                break;
            case 'scrapGear':
                if (s.gearStock) {
                    s.gearStock--;
                    this.gain(1);
                    this.effect('coin', b.x, .65);
                    this.events.push({ kind: 'coin', x: b.x });
                }
                break;
            case 'tool': b.stock++; break;
            case 'bait': if(!b.stock)this.state.recruitment!.next=Math.max(this.state.recruitment!.next,s.elapsed+25);b.stock++; break;
            case 'craft': s.gearStock -= 2; s.equipmentStock++; s.chapter!.done.craft = true; break;
            case 'dispatch': {
                const camp = this.nearestCamp;
                if (!camp) { if (s.camps.every(c => c.defeated)) this.finish('won'); break; }
                const [drummer, puller] = this.availableWorkers().sort((n,q)=>Math.abs(n.x-b.x)-Math.abs(q.x-b.x));
                drummer.task = 'drum'; puller.task = 'drumPull';
                s.drumCart = undefined;
                s.expedition = { state: 'gather', camp: camp.index, beats: 0, drummer: drummer.id, puller: puller.id };
                break;
            }
            case 'recall': case 'retreat':
                this.recallExpedition(false, a.type === 'retreat');
                break;
            case 'upgrade': case 'build': case 'repairBuilding': {
                const repair = a.type === 'repairBuilding' || a.type === 'build' && b.level > 0;
                b.job = { left: RULES.constructionSeconds + b.level * 6, total: RULES.constructionSeconds + b.level * 6, next: repair ? b.level : b.level + 1, repair };
                this.assignBuilder(b);
                break;
            }
        }
    }
    private availableWorkers(): Goblin[] { return this.state.goblins.filter(n => !n.dead && n.role === 'worker' && n.order === 'home' && n.stunned <= 0 && !n.retreat && !n.task); }
    private whip(n: Goblin): void {
        const s = this.state;
        if (n.hit > .38 || n.dead) return;
        n.hit = .62; n.lastWhip = s.elapsed;
        if (n.retreat || n.pressureSince !== undefined) {
            n.retreat = undefined;
            n.pressureSince = undefined;
            n.ralliedUntil = s.elapsed + 4;
        }
        this.manualTarget = 0;
        this.whipFocused = n.id; this.whipFocusUntil = s.elapsed + 1;
        n.strikes = s.elapsed - n.strikeAt < 4 ? n.strikes + 1 : 1; n.strikeAt = s.elapsed;
        // 私藏和准备上交的金币同样是实物，先清空携带再掉落，后续入库不能再结算。
        if (n.hidden > 0) s.chapter!.done.hidden = true;
        const coins=n.hidden+n.carry;n.hidden=0;n.carry=0;
        if(coins)this.drop(n.x+Math.sign(n.x-s.player.x||s.player.face)*24,coins);
        if(n.loot>0){this.state.gearDrops!.push({id:this.id(),x:n.x+25*s.player.face,amount:n.loot,age:0});n.loot=0;if(n.task==='lootReturn')n.task='';}
        if (n.strikes >= 4) { n.stunned = 8; n.strikes = 0; }
        s.player.face = n.x < s.player.x ? -1 : 1; s.player.whip = .45;
        this.effect('hit', n.x, .45); this.events.push({ kind: 'whip', x: n.x });
    }
    gain(amount: number): void {
        const fit = Math.max(0, Math.min(amount, 50 - this.state.gold));
        this.state.gold += fit; this.state.treasury += amount - fit; this.dirty = true;
    }
    drop(x: number, value: number): void {
        if (value <= 0) return;
        const c = this.state.coins.find(c => Math.abs(c.x - x) < 18);
        if (c) c.value += value; else this.state.coins.push({ id: this.id(), x, value, age: 0 });
    }
    effect(kind: Effect['kind'], x: number, life = .5, size = 1): Effect {
        const effect: Effect = { id: this.id(), kind, x, age: 0, life, size };
        this.state.effects.push(effect);
        return effect;
    }
    /** 完成回调携带收据，收据和奖励一起写入对应的存档。 */
    get adGoldReward():number{return 9+Math.max(1,this.state.day);}
    grantAdReward(kind: string, receipt: string): boolean {
        const s = this.state;
        if (!receipt || s.adReceipts.includes(receipt)) return false;
        if (kind === 'revive') {
            if (!this.revive(true)) return false;
        } else if (s.status !== 'playing' || !AD_VARIANTS.includes(kind)) return false;
        else if (kind === 'gold') this.gain(this.adGoldReward);
        else if (kind === 'hunter' || kind === 'worker') { s.populationPending[kind] += 2; this.fillPending(); }
        else if (kind === 'stamina') {
            // 每份完整视频回执增加十分钟实际游戏时间，暂停或离线时不倒计时。
            s.infiniteStaminaUntil = s.elapsed + this.infiniteStaminaSeconds + RULES.rewardStaminaSeconds;
            s.player.stamina = RULES.mount[s.player.mount].stamina;
            s.player.exhausted = false;
        }
        else {
            const mount = kind as Mount;
            if (!s.unlockedMounts.includes(mount)) s.unlockedMounts.push(mount);
            else s.mountBoost[mount] = (s.mountBoost[mount] || 0) + 300;
            s.player.mount = mount;
            s.player.stamina = Math.min(s.player.stamina, RULES.mount[mount].stamina);
        }
        s.adReceipts.push(receipt); this.dirty = true; return true;
    }
    private fillPending(): void {
        for (const role of ['hunter', 'worker'] as Role[]) while (this.state.populationPending[role] > 0 && this.population < this.populationLimit) {
            this.state.populationPending[role]--; this.state.goblins.push(this.makeGoblin(role, 500));
        }
    }
    private finishJob(b: Building): void {
        if (!b.job) return;
        const previousLeaderHp = b.kind === 'hall' ? this.playerMaxHp : 0;
        const upgrade = !b.job.repair; b.level = b.job.next; b.job = undefined;
        if (b.region === -1 && (b.kind === 'wall' || b.kind === 'tower')) {
            this.state.chapter!.done[b.kind] = true;
        }
        b.maxHp = BUILDINGS[b.kind].hp?.[b.level] ?? 100; b.hp = b.maxHp;
        if (b.kind === 'hall') this.updateStats();
        if (b.kind === 'forge' && upgrade) {
            for (const n of this.state.goblins) if (n.gear && !n.dead) n.gear = b.level;
            this.updateStats();
        }
        if (b.kind === 'wall' && b.region >= 0) { const c = this.state.camps[b.region]; c.claimed = c.defeated; c.rebuild = 0; }
        if (previousLeaderHp) this.state.player.hp = Math.min(this.playerMaxHp, this.state.player.hp * this.playerMaxHp / previousLeaderHp);
        if (b.kind === 'wall') this.syncPrisonLocation();
        if (b.kind === 'wall' || b.kind === 'hall') this.syncDrum();
        this.effect('smoke', b.x, .7, 2); this.events.push({ kind: 'build', x: b.x }); this.dirty = true;
    }
    /** 防线失守也要回退旗帜，不能把唯一重新集结入口遗留在复建的敌营后方。 */
    private syncDrum(): void {
        if (this.hall.level < 2) return;
        const drum = this.flag;
        const wall = this.state.buildings.reduce<Building | undefined>((outer, b) =>
            b.kind === 'wall' && b.level && b.hp > 0 && (!outer || b.x > outer.x) ? b : outer, undefined);
        const firstWall = this.state.buildings.find(b => b.kind === 'wall' && b.region === -1);
        drum.level = 1;
        drum.job = undefined;
        // 首道墙内侧留给改造台，战鼓放外侧。扩张后移到最外侧完好墙的后方。
        drum.x = wall ? wall.x + (wall.region === -1 ? 145 : -145) : (firstWall?.x ?? this.frontier) + 145;
    }
    private sellCaptives(): void {
        const s = this.state;
        if(!s.trader.present||s.trader.phase!=='trading')return;
        let income=0;const cargo=s.trader.cargo??=[];
        for (const e of s.enemies) if (e.state === 'captured' || e.state === 'bound' && !e.hauler && e.atPrison) {
            cargo.push({id:e.id,kind:e.kind,hero:e.hero,height:e.bodyHeight||(e.hero?87:e.kind==='shield'?82:77)});
            e.state = 'sold'; e.timer = 0; s.sold++; income += e.saleValue ??= 4 + Math.floor(this.rand() * 3);
        }
        // 当面交易先给钱袋，溢出照常入库；钱袋金币落入动画与到账同步。
        if(income){this.gain(income);this.effect('coin',s.trader.x,.8);this.events.push({kind:'coin',x:s.trader.x});this.dirty=true;}
    }
    finish(status: 'won' | 'lost'): void {
        if (status === 'won' && this.state.status === 'playing') this.events.push({ kind: 'won', x: this.state.player.x });
        this.cancelPledge();
        this.state.status = status;
        this.input.axis = 0;
        this.input.run = false;
        this.dirty = true;
    }
    /** 复活继续同一局，缴回暂停期间不再出征的兵源。 */
    revive(full = false): boolean {
        const s = this.state, p = s.player;
        if (s.status !== 'lost') return false;
        if (s.expedition.state !== 'home' && s.expedition.state !== 'return') this.recallExpedition();
        if (!full) {
            const buildings = s.buildings.filter(b => b.level > 0 && b.hp > 0 && !['hall','gear','treasury','flag'].includes(b.kind));
            const residents = s.goblins.filter(n => !n.dead);
            const losses = Math.floor(residents.length / 2);
            const critical = ['worker','hunter'].map(role=>residents.find(n=>n.role===role)?.id);
            const candidates = residents.filter(n=>!critical.includes(n.id));
            const exposed = candidates.length >= losses ? candidates : residents;
            for (let i = Math.floor(buildings.length / 2); i > 0; i--) {
                const [b] = buildings.splice(Math.floor(this.rand() * buildings.length), 1);
                b.hp = 0; b.job = undefined;
                if (b.kind === 'wall' && b.region >= 0) { s.camps[b.region].claimed = false; s.camps[b.region].rebuild = 0; }
            }
            for (let i = losses; i > 0; i--) {
                const [n] = exposed.splice(Math.floor(this.rand() * exposed.length), 1);
                this.killGoblin(n);
            }
            s.gold = s.treasury = 0;
        }
        for (const c of s.companies) {
            for (const u of c.pending ?? []) s.army!.reserve.push({ ...u, id:u.id ?? this.id(), sourceCamp:u.sourceCamp ?? c.camp });
            c.pending = [];
        }
        for (const e of this.activeEnemies()) if ((e.company || e.patrol) && e.state === 'active') this.returnEnemy(e);
        for (const m of s.machines) if (m.owner === 'enemy' && m.order === 'attack') {
            m.order = 'reserve'; m.company = 0;
        }
        s.shots = s.shots.filter(shot => shot.friendly);
        s.effects = s.effects.filter(effect => !['warning','fire','slamWarning','slamImpact'].includes(effect.kind));
        s.raidsWaiting = [];
        s.truceUntil = s.elapsed + RULES.daySeconds;
        this.syncPrisonLocation();
        this.syncDrum();
        p.x = p.prevX = this.hall.x;
        p.hp = this.playerMaxHp * (full ? 1 : .5);
        p.stamina = RULES.mount[p.mount].stamina;
        p.fly = p.hurt = p.whip = p.attackCooldown = 0;
        p.exhausted = false; p.reviveUntil = s.elapsed + 3;
        this.selected = this.manualTarget = 0; this.selectionX = NaN;
        this.notice = null;
        s.status = 'playing'; this.dirty = true;
        return true;
    }
    restart(): void {
        const mounts = this.state.unlockedMounts, receipts = this.state.adReceipts, pending = this.state.populationPending;
        this.state = this.createState(this.state.seed); this.state.unlockedMounts = mounts; this.state.adReceipts = receipts; this.state.populationPending = pending;
        this.lastWithdrawal = -Infinity;
        this.rebuildEnemyCache();this.towerPositions.clear();this.enemyTowerPositions.clear();this.threatCache.clear();this.threatClock=0;this.towerClock=0;
        this.selected = 0;this.manualTarget=0;this.selectionX=NaN;this.notice=null; this.pauses.clear(); this.input = { axis: 0, run: false }; this.dirty = true;
    }
    snapshot(): State { return JSON.parse(JSON.stringify(this.state)); }
    pause(key: string, enabled: boolean): void {
        if (enabled) this.pauses.add(key); else this.pauses.delete(key);
        this.input.axis = 0; this.input.run = false;
    }

    // 模拟和AI实现接续在下方，固定步长由控制器提供。
    tick(dt: number): void { this.advance(dt); }
    private advance(dt: number): void {
        if (this.pauses.size || this.state.status !== 'playing') return;
        dt = clamp(dt, 0, .1);
        const s = this.state, p = s.player, before = s.time;
        this.hallSpeed = RULES.hallMove[this.hall.level] ?? 1;
        if (p.hp <= 0) { this.finish('lost'); return; }
        s.elapsed += dt; s.time += dt;
        if (s.time >= RULES.daySeconds) { s.time -= RULES.daySeconds; s.day++; this.campaignDay(); this.dirty = true; }
        if (before < RULES.raidAt && s.time >= RULES.raidAt) this.spawnRaid();
        p.prevX = p.x; p.hurt = Math.max(0, p.hurt - dt); p.whip = Math.max(0, p.whip - dt);p.attackCooldown=Math.max(0,(p.attackCooldown||0)-dt);
        this.towerPositions.clear();this.enemyTowerPositions.clear();
        if(s.elapsed>=this.threatClock){this.threatCache.clear();this.threatClock=s.elapsed+.25;}
        const moving = Math.abs(this.input.axis) > .14, mount = RULES.mount[p.mount];
        const boosted = (s.mountBoost[p.mount] || 0) > 0;
        if(p.stamina<=1)p.exhausted=true;if(p.stamina>=30)p.exhausted=false;
        const run = moving && this.input.run && this.canSprint;
        if (moving) { p.face = Math.sign(this.input.axis);const next=clamp(p.x + p.face * mount.speed * this.hallSpeed * (run ? 1.75 : 1) * (boosted ? 1.2 : 1) * dt, RULES.worldMin+95, RULES.worldMax);p.x=this.stopAtEnemyWall(p.x,next); }
        const unlimited = this.infiniteStaminaSeconds > 0;
        p.stamina = clamp(p.stamina + (run && !boosted && !unlimited ? -19 : moving ? 7 : 22) * dt, 0, mount.stamina);
        if (p.stamina <= 1 && !boosted && !unlimited) {
            p.exhausted = true;
            this.input.run = false;
        }
        const flight = p.mount === 'bat' && run ? 42 : 0;
        p.fly += (flight - p.fly) * Math.min(1, dt * 6);
        if (Math.abs(p.x - this.hall.x) < 150 && this.hall.hp > 0 && !this.activeEnemies().some(e => Math.abs(e.x - p.x) < 250)) p.hp = Math.min(this.playerMaxHp, p.hp + dt * 8);
        if (s.pledge && (Math.abs(p.x - s.pledge.x) > RULES.cancelRange || !this.context()?.actions.some(a => a.key === s.pledge!.key))) this.cancelPledge();
        for (const n of s.goblins) { n.prevX = n.x; n.moving = false; n.speed = 0; }
        for (const e of s.enemies) { e.prevX = e.x; e.moving = false; }
        for (const m of s.machines) { m.prevX = m.x; m.moving = false; }
        this.updateRaidQueue(dt);this.updateDayPatrols();this.rebuildEnemyCache();this.updateBuildings(dt);this.updateGarrisons(dt);this.rebuildEnemyCache();
        this.pickupPlayerCoins();this.autoWhip();this.updateExpedition(dt);this.updateGoblins(dt); this.updateEnemies(dt); this.updateMachines(dt);
        this.updateAnimals(dt); this.updateShots(dt); this.updatePrison(dt); this.updateCampaign(dt);
        for (let i = s.goblins.length - 1; i >= 0; i--) {
            const n = s.goblins[i];
            if (n.dead && n.timer >= RULES.corpseSeconds) this.recoverBody(n, false, i);
        }
        for (const c of s.coins) {
            c.age += dt;
            if (this.playerClaimsCoin(c)) {
                this.gain(c.value); c.value = 0; this.events.push({ kind: 'coin', x: c.x });
            }
        }
        s.coins = s.coins.filter(c => c.value > 0);
        for(const item of s.gearDrops!){item.age+=dt;if(item.age>.7&&Math.abs(item.x-p.x)<42){s.gearStock+=item.amount;item.amount=0;this.events.push({kind:'coin',x:item.x});this.dirty=true;}}
        s.gearDrops=s.gearDrops!.filter(item=>item.amount>0);
        for (const f of s.effects) {
            f.age += dt;
            if (f.kind === 'warning' && !f.fired && f.age >= f.life - .05) {
                f.fired = true;
                const radius = METEOR_DAMAGE_RADIUS * f.size;
                this.blast(f.x, radius, f.damage ?? 16, false);
                this.effect('fire', f.x, 4, f.size).tickDamage = f.tickDamage ?? 4;
                this.effect('slamImpact', f.x, .4, radius).strong = f.strong;
            }
            if (f.kind === 'fire' && f.age > (f.nextTick || .8)) { f.nextTick = (f.nextTick || .8) + .8; this.blast(f.x, 38*f.size, f.tickDamage??4, true); this.blast(f.x, 38*f.size, f.tickDamage??4, false); }
        }
        s.effects = s.effects.filter(f => f.age < f.life);
        if (s.effects.length > 100) {
            // 先回收最旧的装饰，密集交战时也要保留待结算的落火和持续伤害。
            let excess = s.effects.length - 100;
            s.effects = s.effects.filter(f => {
                if (excess === 0 || f.kind === 'warning' || f.kind === 'fire') return true;
                excess--;
                return false;
            });
        }
        for (const k of Object.keys(s.mountBoost)) s.mountBoost[k] = Math.max(0, s.mountBoost[k] - dt);
        this.fillPending();
        if (p.hp <= 0) this.finish('lost');
    }
    private rebuildEnemyCache():void{this.liveEnemies=[];this.enemyById.clear();this.enemiesDirty=false;for(const e of this.state.enemies)if(e.state==='active'||e.state==='escaping'){this.liveEnemies.push(e);this.enemyById.set(e.id,e);}}
    private activeEnemies(): Enemy[] { if(this.enemiesDirty)this.rebuildEnemyCache();return this.liveEnemies; }
    private recoverBody(body: Goblin | Enemy, manual: boolean, goblinIndex?: number): void {
        // 手动回收与自动清理可以相邻发生，但一具遗体只能发放一次收益。
        if ('role' in body ? !body.dead || !this.state.goblins.includes(body) : body.state !== 'dead') return;
        if ('role' in body) this.state.goblins.splice(goblinIndex ?? this.state.goblins.indexOf(body), 1);
        else {
            body.state = 'gone'; body.timer = 2;
            if (!body.stripped) this.state.gearStock++;
        }
        const coins = this.corpseReward(body);
        if (manual) {
            if (coins) {
                this.gain(coins);
                this.effect('coin', body.x, .65);
                this.events.push({ kind: 'coin', x: body.x });
            } else this.tell('没有金币');
        } else this.state.treasury += coins;
        if (this.selected === body.id) this.selectionX = NaN;
        this.dirty = true;
    }
    /** 遗体只在回收入口结算，普通士兵一币，精锐和首领两币。 */
    private corpseReward(body: Goblin | Enemy): number {
        return 'hero' in body && body.hero ? 2 : 1;
    }
    private playerClaimsCoin(c:Coin):boolean{return c.value>0&&c.age>=.18&&this.state.player.fly<12&&Math.abs(c.x-this.state.player.x)<RULES.playerCoinRadius;}
    private pickupPlayerCoins():void{for(const c of this.state.coins)if(this.playerClaimsCoin(c)){this.gain(c.value);c.value=0;this.events.push({kind:'coin',x:c.x});}}
    /** 首领自动鞭击只选战斗目标，不修改站定交互焦点，也不自动抽打己方和俘虏。 */
    private autoWhip():void{
        const s=this.state,p=s.player;if((p.attackCooldown||0)>0||p.whip>0||p.fly>70)return;
        const e=closest(this.liveEnemies,p.x,e=>(e.state==='active'||e.state==='escaping')&&!e.towerId&&Math.abs(e.x-p.x)<=120&&!s.fortifications!.some(f=>f.kind==='gate'&&f.hp>0&&(f.x-p.x)*(f.x-e.x)<0));
        if(!e)return;
        p.face=Math.sign(e.x-p.x)||p.face;p.whip=.42;p.attackCooldown=.9;
        this.hitEnemy(e,RULES.role.hunter.attack*RULES.hallFactor[this.hall.level]*2,p.x);this.effect('hit',e.x,.3);this.events.push({kind:'whip',x:p.x});
    }
    /** 扫过整段位移，奔跑、低飞和低帧率都不能越过尚未拆毁的敌墙。 */
    private stopAtEnemyWall(from:number,to:number):number{
        const direction=Math.sign(to-from)||1;
        const gates=this.state.fortifications!.filter(f=>f.kind==='gate'&&f.hp>0).sort((a,b)=>direction*(a.x-b.x));
        for(const gate of gates){
            const pad=RULES.enemyWallClearance[clamp((gate.rank||2)-2,0,3)];
            if(Math.abs(from-gate.x)<pad)return gate.x+(from<gate.x?-pad:from>gate.x?pad:-direction*pad);
            if(direction>0&&from<=gate.x-pad&&to>gate.x-pad)return gate.x-pad;
            if(direction<0&&from>=gate.x+pad&&to<gate.x+pad)return gate.x+pad;
        }
        return to;
    }
    get daytimeRoaming():boolean{return this.state.time>=16&&this.state.time<RULES.patrolRecall;}
    /** 暮间先集结，确认当天攻城队及排队增援结束后即可恢复巡游。 */
    private goblinsCanRoam(): boolean {
        const s = this.state;
        if (s.raidsWaiting?.length || s.companies.some(c => c.pending?.length) ||
            this.activeEnemies().some(e => e.company && e.state === 'active') ||
            s.machines.some(m => m.owner === 'enemy' && m.order === 'attack' && m.hp > 0)) return false;
        if (s.time < RULES.patrolRecall || s.day < RULES.enemySortieStartDay) return true;
        return s.companies.some(c => c.day === s.day || c.day === undefined && c.spawnedAt >= s.elapsed - s.time);
    }
    /** 外出止于敌营外围，未征召的居民不擅自攻城。 */
    private roamLimit():number{
        const camp=this.nearestCamp;if(!camp)return Math.min(RULES.worldMax-200,this.frontier+RULES.patrolReach);
        const gate=this.state.fortifications!.filter(f=>f.camp===camp.index&&f.kind==='gate'&&f.hp>0).sort((a,b)=>a.x-b.x)[0];
        return Math.max(this.frontier,Math.min(this.frontier+RULES.patrolReach,(gate?.x??camp.x-RULES.camps[camp.index].width*.5)-240));
    }
    /** 每营每天一队2至3名普通外征兵，使用真实储备ID；不借走守备或当晚预留编制。 */
    private updateDayPatrols():void{
        // 引导首日只暂停敌军外出，己方仍能白天狩猎。
        const s=this.state;if(this.truceSeconds||s.day<RULES.enemySortieStartDay||!this.daytimeRoaming)return;s.patrolDays??=[];
        for(const camp of s.camps){
            if(camp.defeated||s.time<RULES.patrolStart+camp.index*5||s.patrolDays[camp.index]===s.day)continue;
            if(s.enemies.some(e=>e.patrol&&e.camp===camp.index&&e.state==='active'))continue;
            s.patrolDays[camp.index]=s.day;
            const front=camp.index===(this.nearestCamp?.index??-1),edge=camp.x-RULES.camps[camp.index].width*.52;
            const destination=front?Math.max(this.frontier+220,Math.min(edge-200,this.frontier+650)):edge-650;
            const choices=expandRoster(GUARD_ROSTERS[camp.index]).filter(u=>!u.hero);
            for(let i=0;i<2+(s.day+camp.index)%2;i++){
                const spec=choices[(s.day+i*7)%choices.length];let index=s.army!.reserve.findIndex(n=>n.kind===spec.kind&&!n.hero&&(n.readyAt||0)<=s.elapsed);
                if(index<0){s.army!.reserve.push(this.soldier(spec,camp.index));s.army!.recruited++;index=s.army!.reserve.length-1;}
                const unit=s.army!.reserve.splice(index,1)[0],e=this.makeEnemy(unit.kind,edge-i*34,camp.index,0,unit);
                e.force='field';e.patrol=true;e.roamX=destination+i*45;
            }
            this.dirty=true;
        }
    }
    /** 每250毫秒按区段缓存有效兵力，护甲、伤势和强力单位参与估值，替换逐帧人数比较。 */
    private localNumbers(x:number):{goblins:number;enemies:number}{
        const cell=Math.round(x/160),cached=this.threatCache.get(cell);if(cached)return cached;
        const radius=RULES.patrolRadius,s=this.state,center=cell*160;let goblins=0,enemies=0;
        for(const n of s.goblins)if(!n.dead&&n.stunned<=0&&!n.towerId&&(n.role==='hunter'||n.role==='brute')&&Math.abs(n.x-center)<=radius)goblins+=(n.role==='brute'?2:1)*RULES.hallFactor[this.hall.level]*(1+(RULES.equipmentBonus[n.gear]||0))*Math.max(.2,n.hp/n.maxHp);
        const weights={human:2,elf:1.7,dwarf:3.2,shield:3.5,mage:2.5,jumper:1.7};
        for(const e of this.activeEnemies())if(e.state==='active'&&!e.towerId&&Math.abs(e.x-center)<=radius)enemies+=(e.hero?(HEROES[e.hero]?.boss?14:6):weights[e.kind])*(e.scale||1)*Math.max(.2,e.hp/e.maxHp);
        const result={goblins,enemies};this.threatCache.set(cell,result);return result;
    }

    /** 按基础模板计算一次，移除旧按营地额外增加血量的隐藏系数。 */
    enemyStats(e:Enemy):{hp:number;attack:number;defense:number;range:number;speed:number}{
        const h=HEROES[e.hero||''],base=RULES.enemy[e.kind],scale=e.scale??enemyFactor(this.state.day);
        return{hp:(h?.hp||base.hp)*scale,attack:(h?.attack||base.attack)*scale,defense:(h?.defense??base.defense)*scale,range:h?.skill==='volley'?330:h?.skill==='meteor'?370:base.range,speed:base.speed};
    }
    private makeEnemy(kind: EnemyKind, x: number, camp: number, company = 0, soldier?:Soldier): Enemy {
        const e: Enemy = { id: soldier?.id??this.id(), kind, x, prevX: x, face: -1, hp: 1, maxHp: 1, cooldown: .4, company, camp, state: 'active', timer: 0,
            moving: false, hit: 0, stripped: false, counted: false, hauler: 0, prisonSlot: -1, snared: 0, spells: 6, ammo: 12, atPrison: false,
            force:company?'field':'guard',scale:enemyFactor(this.state.day),hero:soldier?.hero,sourceCamp:soldier?.sourceCamp??camp};
        const h=HEROES[e.hero||''];if(h)e.bodyHeight=h.height;
        e.maxHp=this.enemyStats(e).hp;e.hp=e.maxHp*(soldier?.hpRatio??1);this.state.enemies.push(e);this.enemiesDirty=true;return e;
    }
    private soldier(spec:UnitSpec,sourceCamp:number):Soldier{return{id:this.id(),kind:spec.kind,hero:spec.hero,sourceCamp};}
    private initializeCampaign():void{
        const s=this.state;
        for(const c of s.camps){
            if(!c.guardQueue)c.guardQueue=[...(c.heroesPending||[]).map(hero=>({kind:HEROES[hero].kind,hero})),...(c.reserve||[]).map(kind=>({kind}))].map(u=>this.soldier(u,c.index));
            c.reserve=[];c.heroesPending=[];c.lastReinforcedDay??=s.day;
        }
        for(const e of s.enemies){e.force??=e.company?'field':'guard';if(e.scale===undefined){const ratio=e.hp/Math.max(1,e.maxHp);e.scale=enemyFactor(s.day);if(e.state==='active'||e.state==='escaping'){e.maxHp=this.enemyStats(e).hp;e.hp=e.maxHp*ratio;}}}
        if(!s.army){
            const reserve=([] as Soldier[]).concat(...OPENING_FIELD.map((r,i)=>expandRoster(r).map(u=>this.soldier(u,i))));
            for(const c of s.companies)for(const p of c.pending||[]){p.id??=this.id();p.sourceCamp??=c.camp;}
            s.army={reserve,initial:reserve.length+s.companies.reduce((n,c)=>n+(c.pending?.length||0),0)+s.enemies.filter(e=>e.company&&!e.counted&&(e.state==='active'||e.state==='escaping')).length,recruited:0,lost:0,recovered:0,retired:0,transferred:0,returned:0,guardInitial:s.camps.reduce((n,c)=>n+this.campRemaining(c),0),guardRecruited:0,guardLost:0,guardRecovered:0,guardTransferred:0,enginesBuilt:0};
            // 迁移只替换防线布局，已有敌方设施按原损伤比保留，不借更新免费修好。
            const old=s.fortifications||[];s.fortifications=[];
            for(const c of s.camps){this.createFortifications(c);for(const kind of ['gate','tower']){const before=old.filter(f=>f.camp===c.index&&f.kind===kind),after=s.fortifications.filter(f=>f.camp===c.index&&f.kind===kind);for(let i=0;i<Math.min(before.length,after.length);i++)after[i].hp=after[i].maxHp*before[i].hp/Math.max(1,before[i].maxHp);}}
        }
        if(!s.raidPrep&&!s.companies.some(c=>c.day===s.day||c.day===undefined&&s.time>=RULES.raidAt&&s.elapsed-c.spawnedAt<RULES.daySeconds))this.prepareRaid(s.day);
    }
    private spawnGuards(c: Camp): void {
        const s=this.state,initial=!c.guardQueue;
        if(initial)c.guardQueue=guardSpecs(c.index).map(u=>this.soldier(u,c.index));
        else{
            // 复建使用新的实际调拨，绝不复活被俘或死去的原驻军。
            const desired=guardSpecs(c.index);
            for(const u of desired){let i=s.army!.reserve.findIndex(n=>n.kind===u.kind&&n.hero===u.hero);if(i<0){s.army!.reserve.push(this.soldier(u,4));s.army!.recruited++;i=s.army!.reserve.length-1;}c.guardQueue!.push(s.army!.reserve.splice(i,1)[0]);s.army!.transferred++;s.army!.guardTransferred++;}
        }
        c.reserve=[];c.heroesPending=[];c.reinforcementClock=3;c.lastReinforcedDay=s.day;
        for(const f of s.fortifications||[])if(f.camp===c.index){f.hp=f.maxHp;f.cooldown=2;}
        this.createFortifications(c);
        for(let i=0;i<6&&c.guardQueue!.length;i++){const soldier=c.guardQueue!.shift()!;this.makeEnemy(soldier.kind,c.x-RULES.camps[c.index].width*.25+i*35,c.index,0,soldier);}
    }
    private createFortifications(c:Camp):void{
        const s=this.state,spec=FORTS[c.index];if(c.defeated||s.fortifications!.some(f=>f.camp===c.index))return;
        const width=RULES.camps[c.index].width;
        const gates=spec.walls===3?[-.48,-.08,.29]:spec.walls===2?[-.47,.22]:spec.walls===1?[-.45]:[];
        for(let i=0;i<gates.length;i++){const hp=160+c.index*75+i*35;s.fortifications!.push({id:this.id(),camp:c.index,kind:'gate',x:c.x+width*gates[i],hp,maxHp:hp,cooldown:2,rank:Math.min(5,2+i+c.index-2)});}
        const offsets=spec.levels.length===4?[-.35,-.10,.15,.37]:spec.levels.length===3?[-.32,.02,.34]:[-.24,.30];
        for(let i=0;i<spec.levels.length;i++){const hp=90+c.index*40;s.fortifications!.push({id:this.id(),camp:c.index,kind:'tower',x:c.x+width*offsets[i],hp,maxHp:hp,cooldown:2,levels:spec.levels[i],rank:spec.levels[i]===3?5:spec.levels[i]===2?3:1});}
    }
    /** 新一天仅按日期成长，现有血量比例和被俘状态保持。 */
    private campaignDay():void{
        const s=this.state,scale=enemyFactor(s.day);
        for(const e of s.enemies)if(e.state==='active'||e.state==='escaping'){const ratio=e.hp/Math.max(1,e.maxHp);e.scale=scale;e.maxHp=this.enemyStats(e).hp;e.hp=e.maxHp*ratio;}
        for(const m of s.machines)if(m.owner==='enemy'&&m.hp>0){const ratio=m.hp/m.maxHp;m.scale=scale;m.maxHp=130*scale;m.hp=m.maxHp*ratio;}
        for(const c of s.camps)if(c.lastReinforcedDay!==s.day){c.lastReinforcedDay=s.day;if(c.defeated||c.hp<=0||s.day%5!==0)continue;const slots=Math.min(1,guardCapacity(c.index,s.day)-this.campRemaining(c));const ordinary=expandRoster(GUARD_ROSTERS[c.index]).filter(u=>!u.hero);for(let i=0;i<slots;i++){c.guardQueue!.push(this.soldier(ordinary[(s.day+i)%ordinary.length],c.index));s.army!.guardRecruited++;}}
        this.prepareRaid(s.day);
    }
    /** 船队真实补员并预留当日编制，局部初始库存不能成为阶段锁。 */
    private prepareRaid(day:number):void{
        const s=this.state;if(day<RULES.enemySortieStartDay||!s.army||s.raidPrep?.day===day)return;
        if(s.raidPrep)s.army.reserve.push(...s.raidPrep.units);
        const plan=raidPlan(day),units:Soldier[]=[];
        for(const u of plan.units){const index=s.army.reserve.findIndex(n=>n.kind===u.kind&&n.hero===u.hero&&(n.readyAt||0)<=s.elapsed);let n:Soldier;if(index>=0)n=s.army.reserve.splice(index,1)[0];else{n=this.soldier(u,4);s.army.recruited++;}units.push(n);}
        const engines:number[]=[];
        for(const kind of plan.engines){let m=s.machines.find(m=>m.kind===kind&&m.owner==='enemy'&&m.order==='reserve'&&m.hp>0);if(!m){const scale=enemyFactor(day);m={id:this.id(),kind,x:Math.min(RULES.worldMax-100,(this.nearestCamp?.x||RULES.camps[4].x)+260),prevX:0,hp:130*scale,maxHp:130*scale,owner:'enemy',company:0,crew:[],order:'reserve',cooldown:5,moving:false,scale};m.prevX=m.x;s.machines.push(m);s.army.enginesBuilt++;}engines.push(m.id);m.company=-day;}
        s.raidPrep={day,units,engines,eliteBudget:plan.eliteBudget};
        // 退役过时的在营外征普通兵，记录转出而非死亡；不驱逐正在交战或刚预留的士兵。
        const cap=122+raidPlan(day).units.length*2;while(s.army.reserve.length>cap){s.army.reserve.shift();s.army.retired++;}
    }
    enemyTowerPosition(e:Enemy):{x:number;height:number}{
        const cached=this.enemyTowerPositions.get(e.id);if(cached)return cached;
        const f=this.state.fortifications!.find(f=>f.id===e.towerId&&f.hp>0);if(!f)return{x:e.x,height:0};
        let rank=0;for(const q of this.state.enemies)if(q.state==='active'&&q.towerId===f.id&&q.id<e.id)rank++;
        const spot=towerSpot((f.levels||1)===3?5:(f.levels||1)===2?3:1,rank),position={x:f.x+spot.x,height:spot.height};this.enemyTowerPositions.set(e.id,position);return position;
    }

    private updateGarrisons(dt:number):void{
        const s=this.state;
        for(const c of s.camps){if(c.defeated)continue;const near=Math.abs(s.player.x-c.x)<2400||s.goblins.some(n=>!n.dead&&Math.abs(n.x-c.x)<2100);if(!near)continue;
            c.reinforcementClock=(c.reinforcementClock??3)-dt;if(c.reinforcementClock>0)continue;c.reinforcementClock=4.5;
            let active=s.enemies.filter(e=>e.camp===c.index&&e.force!=='field'&&!e.company&&e.state==='active').length;
            for(let i=0;i<3&&active<(c.index===0?10:RULES.maxGarrisonActive+FORTS[c.index].levels.reduce((a,b)=>a+b,0))&&c.guardQueue?.length;i++,active++){const soldier=c.guardQueue.shift()!;this.makeEnemy(soldier.kind,c.x-RULES.camps[c.index].width*.25+(active%6)*38,c.index,0,soldier);}
        }
        for(const e of s.enemies)if(e.towerId&&!s.fortifications!.some(f=>f.id===e.towerId&&f.hp>0)){e.towerId=undefined;}
        for(const f of s.fortifications!){if(f.hp<=0||f.kind!=='tower'||s.camps[f.camp].defeated)continue;
            let crew=s.enemies.filter(e=>e.state==='active'&&e.towerId===f.id);
            while(crew.length<(f.levels||1)){const e=s.enemies.filter(e=>e.state==='active'&&e.force!=='field'&&!e.company&&e.camp===f.camp&&e.kind==='elf'&&!e.hero&&!e.towerId).sort((a,b)=>Math.abs(a.x-f.x)-Math.abs(b.x-f.x))[0];if(!e)break;e.towerId=f.id;this.enemyTowerPositions.delete(e.id);crew.push(e);}
            for(const e of crew){const spot=this.enemyTowerPosition(e);e.x=e.prevX=spot.x;e.moving=false;}
            f.cooldown-=dt;if(f.cooldown>0||!crew.length)continue;
            const targets=[{id:-1,x:s.player.x},...s.goblins.filter(n=>!n.dead).map(n=>({id:n.id,x:n.x}))].sort((a,b)=>Math.abs(a.x-f.x)-Math.abs(b.x-f.x));
            const target = targets[0];
            if (target && Math.abs(target.x - f.x) < 350) {
                f.cooldown = 2.3;
                for (const e of crew) {
                    e.face = Math.sign(target.x - e.x) || -1;
                    this.queueEnemyStrike(e, 'bow', [target], this.enemyStats(e).attack, 350);
                }
            }
        }
    }
    campRemaining(c:Camp):number{return (c.guardQueue?.length??((c.reserve?.length||0)+(c.heroesPending?.length||0)))+this.state.enemies.filter(e=>e.camp===c.index&&e.force!=='field'&&!e.company&&e.state==='active').length;}
    private damageFort(id:number,amount:number):void{const f=this.state.fortifications!.find(f=>f.id===id&&f.hp>0);if(f){f.hp=Math.max(0,f.hp-amount);this.effect('smoke',f.x,.4);this.dirty=true;}}
    spawnRaid(): void {
        if (this.truceSeconds || this.state.day < RULES.enemySortieStartDay || !this.nearestCamp) return;
        // 旧档缩短夜晚或重复触发时，同一日已经派出的部队不能再次生成。
        if (this.state.companies.some(c => c.day === this.state.day) || this.state.raidsWaiting?.includes(this.state.day)) return;
        (this.state.raidsWaiting ||= []).push(this.state.day);
        this.updateRaidQueue(0);
        this.dirty = true;
    }
    private updateRaidQueue(dt:number):void{
        if (this.truceSeconds) return;
        const s=this.state,c=this.nearestCamp;
        if(c&&s.raidsWaiting?.length){
            const day=s.raidsWaiting.shift()!;this.prepareRaid(day);const prep=s.raidPrep!;
            const group:Company={id:this.id(),initial:prep.units.length,lost:0,retreating:false,camp:c.index,spawnedAt:s.elapsed,pending:prep.units,launchClock:0,launchX:c.x-120,eliteBudget:prep.eliteBudget,day};
            s.companies.push(group);s.raids++;for(const id of prep.engines){const m=s.machines.find(m=>m.id===id)!;m.company=group.id;m.order='attack';m.x=m.prevX=c.x+260;}
            s.raidPrep=undefined;this.events.push({kind:'raid',x:c.x});
        }
        for(const group of s.companies.filter(group => group.pending?.length).sort((a,b)=>(b.day||0)-(a.day||0))){
            // 夜袭不再因损失或天亮撤回，旧档标志也不取消尚未入场的兵。
            group.retreating=false;
            group.launchClock=(group.launchClock||0)-dt;if(group.launchClock>0||!group.pending?.length)continue;
            // 拥堵只延迟普通补入，每个新夜首批仍入场，不能让旧队吞掉日期到来的Boss。
            if(group.pending.length!==group.initial&&this.state.enemies.filter(e=>e.company&&e.state==='active').length>=96)continue;group.launchClock=4;
            for(let i=0;i<6&&group.pending.length;i++){const n=group.pending.shift()!;this.makeEnemy(n.kind,(group.launchX??s.camps[group.camp].x)+i*40,group.camp,group.id,n as Soldier);}
        }
    }
    /** 活着撤回才回到储备，保留伤势并休整，不在下令撤退瞬间复制回营。 */
    private returnEnemy(e:Enemy):void{
        const s=this.state,escaping=e.state==='escaping';
        if(e.force==='field'||e.company){if(escaping&&e.counted)s.army!.recovered++;s.army!.returned++;s.army!.reserve.push({id:e.id,kind:e.kind,hero:e.hero,sourceCamp:e.sourceCamp??e.camp,hpRatio:e.hp/Math.max(1,e.maxHp),readyAt:s.elapsed+60});}
        else{const c=s.camps.find(c=>c.index===e.camp&&!c.defeated)||this.nearestCamp;if(c){c.guardQueue!.push({id:e.id,kind:e.kind,hero:e.hero,sourceCamp:e.camp,hpRatio:e.hp/Math.max(1,e.maxHp)});s.army!.guardRecovered++;}}
        e.returned=true;e.state='gone';e.timer=0;this.enemiesDirty=true;
    }
    private move(n: { x: number; face?: number; moving: boolean; speed?: number;restGoal?:number;role?:Role;owner?:Machine['owner'] }, x: number, speed: number, dt: number): void {
        const distance = x - n.x;
        // 停下后保留18单位的目标容差，避免到位/追赶逐帧反转。
        if(n.restGoal!==undefined&&Math.abs(x-n.restGoal)<18&&Math.abs(distance)<24)return;
        n.restGoal=undefined;if(Math.abs(distance)<6){n.restGoal=x;return;}
        if (n.role) speed *= RULES.goblinFootSpeed * this.hallSpeed;
        else if (n.owner === 'goblin') speed *= this.hallSpeed;
        const amount = Math.min(Math.abs(distance), Math.max(0, speed) * dt);
        n.x += Math.sign(distance) * amount; n.moving = amount > .01;
        if (n.face !== undefined) n.face = Math.sign(distance);
        if (n.speed !== undefined) n.speed = speed;
    }
    private updateBuildings(dt: number): void {
        const s = this.state;
        const r=s.recruitment!;
        const arrivals = r.recent!;
        while (arrivals.length && arrivals[0] <= s.elapsed - RULES.recruitmentLongWindow) arrivals.shift();
        const recent = arrivals.filter(at => at > s.elapsed - RULES.recruitmentShortWindow).length;
        for (const b of s.buildings) {
            b.timer += dt;
            if(b.region===-2&&!b.discovered&&Math.abs(b.x-s.player.x)<760&&b.x<this.frontier+2400){b.discovered=true;this.dirty=true;}
            if (b.kind === 'lure' && b.level && b.hp > 0 && !b.job && b.stock && recent < 3 && arrivals.length < 10 &&
                s.elapsed >= r.next && this.population < this.populationLimit) {
                // 到访才消耗预存金币，人口满时原样保留。
                b.timer = 0; b.stock--; const unit = this.makeGoblin('idle', b.x + 360); unit.task = 'joining'; unit.targetX = b.x;
                arrivals.push(s.elapsed);
                r.next = s.elapsed + 33 + this.rand() * 10;
                s.goblins.push(unit); this.dirty = true;
            }
            if ((b.kind === 'net' || b.kind === 'rock') && b.level && b.hp > 0 && b.timer > (b.kind === 'net' ? 12 : 10)) {
                const e = this.activeEnemies().find(e => Math.abs(e.x - b.x) < 65);
                if (e) { b.timer = 0; if (b.kind === 'net') { e.snared = 4 + b.level; this.effect('star', e.x, .5); } else { this.blast(e.x, 70, 24 * b.level, true); this.effect('smoke', e.x, .6, 2); } }
            }
        }
        this.towerClock-=dt;if(this.towerClock<=0){this.towerClock=.75;this.assignTowers();}
    }
    /** 箭台占用真实猎手，征召、阵亡或倒地立即释放站位。 */
    private assignTowers():void{
        const s=this.state;
        for(const n of s.goblins)if(n.towerId&&(n.dead||n.stunned>0||!s.buildings.some(b=>b.id===n.towerId&&b.hp>0&&this.canHoldTower(n,b)))){n.towerId=undefined;if(n.task==='tower')n.task='';}
        const towers=s.buildings.filter(b=>b.kind==='tower'&&b.level&&b.hp>0&&b.x<=this.frontier+100).sort((a,b)=>b.x-a.x);
        for(const b of towers){
            const occupants=s.goblins.filter(n=>!n.dead&&n.towerId===b.id);
            for(let i=occupants.length;i<RULES.towerSlots[b.level];i++){
                const n=s.goblins.filter(n=>!n.dead&&this.canHoldTower(n,b)&&!n.task&&!n.retreat&&!n.towerId&&n.stunned<=0&&n.carry===0&&Math.abs(n.x-b.x)<1600).sort((a,c)=>Math.abs(a.x-b.x)-Math.abs(c.x-b.x))[0];
                if(!n)break;n.towerId=b.id;n.task='tower';this.towerPositions.delete(n.id);
            }
        }
    }
    /** 出征队占领后就地驻塔，接到下一次出征命令再归队，不凭空生成守军。 */
    private canHoldTower(n:Goblin,b:Building):boolean{return n.role==='hunter'&&(n.order==='home'||n.order==='expedition'&&!!this.state.camps[this.state.expedition.camp]?.defeated&&b.region===this.state.expedition.camp);}
    private towerCombatRange(tower: Building): number {
        return Math.max(RULES.towerCombatMinimum, RULES.role.hunter.range + RULES.towerRange[tower.level]) + RULES.towerRangeBonus;
    }
    /** 先派空闲苦工，再暂停生产。已交付的资源保留，离岗时清掉本轮未完成工时。 */
    private assignBuilder(building: Building): void {
        const s = this.state;
        const candidates = s.goblins.filter(n => n.role === 'worker' && n.order === 'home' &&
            !n.dead && !n.retreat && n.stunned <= 0 && n.hit <= .18 && n.loot === 0 &&
            (!n.task || n.task === 'salvageMachine'));
        const byDistance = (a: Goblin, b: Goblin) => Math.abs(a.x - building.x) - Math.abs(b.x - building.x);
        const priority = (n: Goblin) => n.task === 'salvageMachine' ? 2 : n.workAt ? 1 : 0;
        const builder = candidates.sort((a, b) => priority(a) - priority(b) || byDistance(a, b))[0];
        if (!builder) return;
        if (builder.task === 'salvageMachine') {
            const machine = s.machines.find(m => m.id === builder.targetId);
            if (machine) machine.crew = [];
        }
        builder.task = 'construction';
        builder.targetId = building.id;
        builder.workAt = undefined;
        builder.workTime = 0;
        builder.working = false;
    }
    private updateGoblins(dt: number): void {
        this.safeCorpses=null;
        this.corpseReservations.clear();
        for (const n of this.state.goblins) if (!n.dead && !n.retreat && n.stunned <= 0 && n.task === 'capture')
            this.corpseReservations.set(n.targetId, n.id);
        const s = this.state, enemies = this.activeEnemies(),stationUsers=new Map<number,number>();
        const hazards=s.effects.filter(f=>f.kind==='warning'||f.kind==='fire').sort((a,b)=>a.x-b.x);
        const ranks=new Map<string,number>(),combatLines=new Map<string,number>();
        const assigned = new Set(s.goblins.filter(n => !n.dead && n.role === 'worker' && n.task === 'construction').map(n => n.targetId));
        for (const building of s.buildings) {
            if (building.job && !assigned.has(building.id) && this.visible(building)) this.assignBuilder(building);
        }
        const roaming = this.goblinsCanRoam(), frontier = this.frontier;
        const outerWall = s.buildings.reduce<Building | undefined>((outer,b) =>
            b.kind === 'wall' && b.level > 0 && b.hp > 0 && (!outer || b.x > outer.x) ? b : outer, undefined);
        const breach = s.defenseBreach && s.buildings.find(b => b.kind === 'wall' && b.x === s.defenseBreach!.x && b.hp <= 0);
        const breachAhead = breach && (!outerWall || breach.x > outerWall.x);
        const guardX = breachAhead ? breach.x : outerWall?.x;
        for(const n of s.goblins)if(!n.dead&&!n.towerId&&(n.role==='hunter'||n.role==='brute')){const key=n.role+':'+n.order,rank=ranks.get(key)||0;n.formationRank=rank;ranks.set(key,rank+1);}
        for (const n of s.goblins) {
            const previousStation=n.workAt;n.workAt=undefined;n.working=false;
            n.hit = Math.max(0, n.hit - dt); n.stunned = Math.max(0, n.stunned - dt); n.cooldown = Math.max(0, n.cooldown - dt); n.timer += dt;
            if (n.dead || n.stunned > 0) continue;
            if(n.towerId&&!s.buildings.some(b=>b.id===n.towerId&&this.canHoldTower(n,b))){n.towerId=undefined;if(n.task==='tower')n.task='';}
            const eff = this.efficiency(n), civilian = n.role === 'worker' || n.role === 'idle';
            if (n.retreat || n.hp < n.maxHp / 3 || n.task === 'drum' || n.task === 'drumPull') {
                const threat = n.retreat && Math.abs(n.x - n.retreat.x) >= 16 ? undefined :
                    closest(enemies, n.x, e => e.state === 'active' && Math.abs(e.x-n.x) < 450 &&
                    (!outerWall || (outerWall.x-n.x)*(outerWall.x-e.x) >= 0));
                if (this.updateGoblinRetreat(n, threat, civilian, !!n.towerId, false, dt, n.order === 'home')) continue;
            }
            if (n.hit > .18 || n.task === 'drum' || n.task === 'drumPull') continue;
            const fire = hazards.find(f => Math.abs(f.x-n.x) < 62);
            if (fire && n.task !== 'machine') {
                // 连续火雨按整片危险区避让，不能在相邻落点之间来回抖动。
                let left=fire.x-64,right=fire.x+64;
                for(let pass=0;pass<2;pass++)for(const f of hazards)if(f.x+64>=left&&f.x-64<=right){left=Math.min(left,f.x-64);right=Math.max(right,f.x+64);}
                if((n.evadeUntil||0)<s.elapsed||n.evadeX===undefined){n.evadeX=n.x-left<=right-n.x?left-18:right+18;n.evadeUntil=s.elapsed+.8;}
                this.move(n,n.evadeX,185,dt);continue;
            }
            const phase = s.expedition.state;
            if (!civilian && (n.order === 'gather' || n.order === 'expedition' && phase === 'march')) {
                const spot = this.marchAnchor - (n.role === 'brute' ? 40 : 110) - Math.min(25, n.formationRank || 0) * 16;
                this.move(n, Math.max(RULES.worldMin + 95, spot), 228, dt);
                continue;
            }
            if (n.order === 'return' && n.task !== 'machine') {
                const defense = this.frontier - (n.role === 'hunter' ? 100 : 60) - (n.formationRank || 0) * 26;
                this.move(n, defense, 158, dt);
                if (Math.abs(n.x - defense) < 30) n.order = 'home';
                continue;
            }
            const tower = n.towerId ? s.buildings.find(b => b.id === n.towerId && b.hp > 0) : undefined;
            const guardLine = n.role === 'brute' && n.order === 'home' ? guardX : undefined;
            const guardSpot = guardLine === undefined ? undefined : guardLine - 20 - (n.formationRank || 0) * 27;
            if (guardSpot !== undefined && !n.retreat && n.x > guardLine!) {
                this.move(n, guardSpot, 170, dt);
                continue;
            }
            const range = civilian ? 350 : tower ? this.towerCombatRange(tower) : 430;
            const validEnemy=(e:Enemy)=>(e.state==='active'||e.state==='escaping')&&
                (guardLine === undefined || e.x <= guardLine + (breachAhead ? RULES.role.brute.range : 0)) &&
                (Math.abs(e.x-n.x)<range||!civilian&&!tower&&(e.state==='escaping'&&e.x<frontier+300||n.order==='home'&&e.state==='active'&&e.x<frontier))&&
                (!civilian||!s.buildings.some(w=>w.kind==='wall'&&w.level&&w.hp>0&&(w.x-e.x)*(w.x-n.x)<=0));
            let danger=this.enemyById.get(n.combatTarget||0);
            if(danger&&!validEnemy(danger)||s.elapsed>=(n.thinkAt||0)){
                const nearest=closest(enemies,n.x,validEnemy);
                if(!danger||!validEnemy(danger)||s.elapsed>=(n.targetUntil||0)&&nearest&&Math.abs(nearest.x-n.x)+65<Math.abs(danger.x-n.x)){
                    danger=nearest;n.combatTarget=danger?.id;n.targetUntil=s.elapsed+.8;
                }
                n.thinkAt=s.elapsed+.2+(n.id%3)*.025;
            }

            if (this.updateGoblinRetreat(n, danger, civilian, !!tower, n.order === 'home' && roaming && n.x > frontier + 30, dt, guardLine !== undefined)) continue;
            if (tower && Math.abs(n.x - this.towerPosition(n).x) > 12) {
                this.move(n, this.towerPosition(n).x, 100, dt);
                continue;
            }
            if(!civilian&&danger){const key=n.role+':'+danger.id,slot=combatLines.get(key)||0;combatLines.set(key,slot+1);this.fightGoblin(n,danger,dt,slot,roaming,frontier,breachAhead?undefined:guardLine);continue;}
            // 安全时缓慢恢复；轻伤不再令守军跑回几千单位外的洞穴、留下空墙。
            if ((n.order==='home'||n.order==='expedition'&&s.camps[s.expedition.camp]?.defeated) && n.hp<n.maxHp && !enemies.some(e=>Math.abs(e.x-n.x)<420)) n.hp=Math.min(n.maxHp,n.hp+dt*(Math.abs(n.x-this.hall.x)<180?4:.7));
            if(n.task==='construction'){
                const job=s.buildings.find(b=>b.id===n.targetId&&b.job);
                if(!job){n.task='';continue;}
                this.move(n,job.kind==='wall'?job.x-24:job.x,102*eff*this.logisticsFactor(),dt);
                if(Math.abs(n.x-job.x)<40&&job.job){
                    n.working=!n.moving;job.job.left-=dt*eff;
                    if (n.working && Math.floor(s.elapsed * 2) !== Math.floor((s.elapsed - dt) * 2)) this.events.push({ kind: 'hammer', x: n.x });
                    if(job.job.left<=0){this.finishJob(job);n.task='';n.working=false;}
                }
                continue;
            }
            if (n.task === 'joining') {
                this.move(n, n.targetX, 94, dt);
                if (Math.abs(n.x - n.targetX) < 10) {
                    n.task = '';
                    this.effect('star', n.x, .6);
                    this.events.push({ kind: 'recruit', x: n.x });
                }
                continue;
            }
            if(n.task==='salvageMachine') {
                const m=s.machines.find(m=>m.id===n.targetId&&m.owner==='abandoned'&&m.hp>0);
                if(!m){n.task='';continue;}
                this.move(n,m.x-65,112,dt);
                if(Math.abs(n.x-m.x)<85){m.owner='goblin';m.order='return';n.task='machine';this.dirty=true;}
                continue;
            }
            if (n.task === 'machine') {
                const machine = s.machines.find(m => m.id === n.targetId && m.hp > 0);
                if (machine && machine.owner === 'goblin') { this.move(n, machine.x - 70 - machine.crew.indexOf(n.id) * 35, 130, dt); continue; }
                n.task = ''; n.order = 'home';
            }
            if (n.task === 'haul') { this.haul(n, dt); continue; }
            if (n.task === 'capture') {
                if (this.corpseTask(n, dt)) continue;
                n.task = '';
                n.targetId = 0;
            }
            if (n.task === 'lootReturn' || n.loot > 0) {
                const gearX = s.buildings.find(b => b.kind === 'gear')!.x;
                this.move(n, gearX, 95 * eff*this.logisticsFactor(), dt);
                if (Math.abs(n.x - gearX) < 22) { s.gearStock += n.loot; n.loot = 0; n.task = ''; this.dirty = true; }
                continue;
            }
            // 新征召的猎手经过后勤区时先领已付款的装备，再去集结；在前线的老兵不擅自离队。
            const equipmentPoint=this.flag.level?this.flag.x:this.forge.x;
            if((n.role==='hunter'||n.role==='brute')&&!n.gear&&s.equipmentStock>0&&this.forge.level&&(n.order!=='expedition'||s.camps[s.expedition.camp]?.defeated)){
                this.move(n,equipmentPoint,130*this.logisticsFactor(),dt);if(Math.abs(n.x-equipmentPoint)<35){s.equipmentStock--;n.gear=this.forge.level;this.updateStats();this.effect('star',n.x,.8);this.dirty=true;}continue;
            }
            if (n.task === 'tower' && tower) {
                this.move(n, this.towerPosition(n).x, 100, dt);
                if (!n.moving) this.hunt(n, dt, true);
                continue;
            }
            if (n.order === 'expedition') { this.expeditionGoblin(n, dt); continue; }
            if (n.task === 'tower' && !tower) { n.task = ''; n.towerId = undefined; }
            const deposit = n.role === 'worker'
                ? n.carry > 0 && this.night && n.depositedDay !== s.day
                : n.carry >= 3 || n.carry > 0 && (n.role === 'idle' || n.timer > 90);
            if (deposit) {
                this.move(n, this.hall.x, 95 * eff*this.logisticsFactor(), dt);
                if (Math.abs(n.x - this.hall.x) < 35) {
                    if (this.rand() < .16 && n.hidden < 3 && n.carry > 1) { n.hidden++; n.carry--; }
                    s.treasury += n.carry; n.carry = 0; this.effect('coin', this.hall.x, .5); this.dirty = true;
                    if (n.role === 'worker') n.depositedDay = s.day;
                }
                continue;
            }
            if (n.role === 'idle') {
                const stall = s.buildings.filter(b => ['worker', 'hunter', 'brute'].includes(b.kind) && b.hp > 0 && !b.job && b.stock > 0).sort((a, b) => Math.abs(a.x - n.x) - Math.abs(b.x - n.x))[0];
                if (stall) {
                    this.move(n, stall.x, 100 * eff, dt);
                    if (Math.abs(n.x - stall.x) < 25 && stall.stock > 0) {
                        stall.stock--;
                        n.role = stall.kind as Role;
                        if (n.role === 'worker') s.chapter!.done.hammer = true;
                        if (n.role === 'hunter') s.chapter!.done.bow = true;
                        n.maxHp = this.stats(n).hp;
                        n.hp = n.maxHp;
                        n.timer = 0;
                        this.effect('star', n.x, .7);
                        this.dirty = true;
                    }
                    continue;
                }
            }
            // 已分配的施工仍优先，空闲苦工直接救活口，不受主屋等级或后勤人数限制。
            if ((n.role === 'idle' || n.role === 'worker') && this.corpseTask(n, dt)) continue;
            if (n.role === 'worker') {
                const broken = s.buildings.filter(b => b.hp > 0 && b.hp < b.maxHp && b.x <= this.frontier).sort((a, b) => Math.abs(a.x - n.x) - Math.abs(b.x - n.x))[0];
                if (broken) { this.move(n, broken.x, 100 * eff, dt); if (Math.abs(n.x - broken.x) < 40){n.working=!n.moving;broken.hp = Math.min(broken.maxHp, broken.hp + dt * (7+(s.buildings.find(b=>b.kind==='repair')?.level||0)*2) * eff);} continue; }
                const stations = s.buildings.filter(b => ['farm', 'mine', 'wood'].includes(b.kind) && b.level > 0 && b.hp > 0 && b.x < this.frontier + 500);
                if (stations.length) {
                    const open=stations.filter(b=>(stationUsers.get(b.id)||0)<RULES.productionSlots[b.level]);
                    const b=open.find(b=>b.id===previousStation)||open.sort((a,b)=>Math.abs(a.x-n.x)-Math.abs(b.x-n.x))[0];
                    if(!b){this.move(n,this.hall.x+70+n.id%4*26,65,dt);continue;}
                    stationUsers.set(b.id,(stationUsers.get(b.id)||0)+1);
                    this.move(n, b.x + (n.id % 3 - 1) * 22, 86 * eff*this.logisticsFactor(), dt);
                    if (Math.abs(n.x - b.x) < 60) {
                        // 工时仅在同一真实岗位连续累积，跑路、拖俘或换岗都不能预存产量。
                        if(previousStation!==b.id)n.workTime=0;
                        n.workAt=b.id;n.working=!n.moving;n.workTime=(n.workTime||0)+dt*eff;
                        if(n.workTime>=RULES.productionCycle[b.level]){n.workTime-=RULES.productionCycle[b.level];n.timer=0;n.carry+=(b.kind==='mine'?RULES.mineYield:RULES.productionYield)[b.level];this.effect('coin',n.x,.4);this.dirty=true;}
                    }
                    continue;
                }
            }
            if (n.role === 'hunter') {
                if (s.equipmentStock > 0 && !n.gear && this.forge.level > 0) {
                    this.move(n, equipmentPoint,130*this.logisticsFactor(),dt);
                    if (Math.abs(n.x-equipmentPoint)<35) { s.equipmentStock--; n.gear = this.forge.level; this.updateStats(); this.effect('star', n.x, .8); this.dirty = true; }
                    continue;
                }
                const dropped = s.coins.filter(c => c.value > 0 && !this.playerClaimsCoin(c) && c.age>.45 && Math.abs(c.x - n.x) < 360).sort((a,b) => Math.abs(a.x-n.x)-Math.abs(b.x-n.x))[0];
                if (dropped) { this.move(n, dropped.x, 112 * eff, dt); if (Math.abs(n.x-dropped.x)<22) { n.carry+=dropped.value; dropped.value=0; } continue; }
                if(roaming&&this.hunt(n,dt,false))continue;
                if(roaming)this.roamGoblin(n,dt);else this.move(n, frontier-95-(n.formationRank||0)*26, 146, dt);
            } else if (n.role === 'brute') {
                if (guardSpot !== undefined) this.move(n, guardSpot, 142, dt);
                else if (roaming) this.roamGoblin(n,dt);
                else this.move(n, frontier-45-(n.formationRank||0)*30, 142, dt);
            }
            else {
                const coin = s.coins.filter(c => c.value>0&&!this.playerClaimsCoin(c)&&c.age > 1 && Math.abs(c.x - n.x) < 600).sort((a, b) => Math.abs(a.x - n.x) - Math.abs(b.x - n.x))[0];
                if (coin) { this.move(n, coin.x, 88 * eff, dt); if (Math.abs(n.x - coin.x) < 22) { n.carry += coin.value; coin.value = 0; } }
                else { if (n.timer > 4 + n.id % 5) { n.targetX = 180 + this.rand() * Math.max(450, Math.min(1100, this.frontier - 350)); n.timer = 0; } this.move(n, n.targetX, 47 * eff, dt); }
            }
        }
    }
    /** 狩猎、护甲与战斗共用实际属性；塔上箭矢从真实踏板高度发出。 */
    private hunt(n:Goblin,dt:number,tower:boolean):boolean{
        const b=tower?this.state.buildings.find(b=>b.id===n.towerId):undefined;
        // 驻塔猎手利用高地看到更远的猎物，警戒联军的射程仍由战斗规则决定。
        const range = RULES.role.hunter.range + (b ? RULES.towerRange[b.level] + RULES.towerHuntBonus + RULES.towerRangeBonus : 0);
        const valid=(a:Animal)=>a.hp>0&&(tower?Math.abs(a.x-n.x)<=range:a.x<this.roamLimit()&&a.x>1450);
        let prey=this.state.animals.find(a=>a.id===n.targetId&&valid(a));
        if(!prey)prey=closest(this.state.animals,n.x,valid);
        if(!prey)return false;n.targetId=prey.id;
        if (!tower && Math.abs(n.x - prey.x) > range - 18) {
            this.move(n, prey.x - Math.sign(prey.x - n.x) * (range - 30), 104 * this.efficiency(n), dt);
            return true;
        }
        if (n.cooldown <= 0) {
            n.face = Math.sign(prey.x-n.x) || n.face;
            n.attackAt = this.state.elapsed;
            n.cooldown = (b ? RULES.towerShotInterval : 1.1) / this.efficiency(n);
            this.shoot(n.x, prey.x, prey.id, this.stats(n).attack, true, 'arrow');
            const shot = this.state.shots[this.state.shots.length - 1];
            shot.targetY = prey.kind === 'deer' ? 32 : 16;
            if (b) this.aimTowerShot(n, shot);
        }
        return true;
    }
    /** 跑向固定落点。仍被追击就继续向安全侧跑，重伤者恢复后才重新上阵。 */
    private updateGoblinRetreat(n: Goblin, threat: Enemy | undefined, civilian: boolean, tower: boolean, outOnPatrol: boolean, dt: number, guarding = false): boolean {
        const s = this.state;
        const home = this.hall.x - 145 - n.id % 5 * 19;
        const critical = n.hp < n.maxHp / 3;
        if (n.retreat) {
            if (Math.abs(n.x - n.retreat.x) < 16) {
                if (threat) {
                    const away = Math.sign(n.x - threat.x) || -1;
                    const safe = this.stopAtEnemyWall(n.x, clamp(n.x + away * 600, RULES.worldMin + 95, RULES.worldMax - 95));
                    if (Math.abs(safe - n.x) > 20) n.retreat.x = safe;
                    n.retreat.until = s.elapsed + 2;
                } else {
                    n.hp = Math.min(n.maxHp, n.hp + dt * (Math.abs(n.x - home) < 160 ? 5 : 2.5));
                    if (s.elapsed >= n.retreat.until && n.hp >= n.maxHp * .55) {
                        n.retreat = undefined;
                        n.ralliedUntil = s.elapsed + 1.5;
                        return false;
                    }
                }
            }
            this.move(n, n.retreat.x, 224, dt);
            return true;
        }
        if ((!threat && !(critical && n.hit > 0)) || s.elapsed < (n.ralliedUntil ?? 0)) {
            n.pressureSince = undefined;
            return false;
        }
        if (!critical && !civilian) {
            if (guarding || tower || !outOnPatrol) return false;
            const power = this.localNumbers(n.x);
            if (power.enemies <= power.goblins * 1.5) {
                n.pressureSince = undefined;
                return false;
            }
            n.pressureSince ??= s.elapsed;
            if (s.elapsed - n.pressureSince < 2) return false;
        }
        const away = Math.sign(n.x - (threat?.x ?? n.x + 1)) || -1;
        const destination = away < 0 && n.x > home ? Math.max(home, n.x - 680) : n.x + away * 680;
        n.retreat = { x: this.stopAtEnemyWall(n.x, clamp(destination, RULES.worldMin + 95, RULES.worldMax - 95)),
            until: s.elapsed + 3 };
        n.pressureSince = undefined;
        n.restGoal = undefined;
        n.towerId = undefined;
        if (n.task === 'haul') this.releaseCaptives(n);
        if (n.task === 'machine' || n.task === 'salvageMachine') {
            const machine = s.machines.find(m => m.id === n.targetId && m.crew.includes(n.id));
            if (machine) {
                if (machine.owner === 'goblin') {
                    for (const crew of s.goblins) if (machine.crew.includes(crew.id)) { crew.task = ''; crew.order = 'return'; }
                    machine.crew = []; machine.order = 'park';
                } else machine.crew = machine.crew.filter(id => id !== n.id);
            }
        }
        if (['construction','capture','haul','machine','salvageMachine','tower','drum','drumPull'].includes(n.task)) n.task = '';
        this.move(n, n.retreat.x, 224, dt);
        return true;
    }
    /** 巡游到达后再计停步时间，不逐帧重选目的地。 */
    private roamGoblin(n:Goblin,dt:number):void{
        const end=this.roamLimit(),start=Math.min(end,this.frontier+160);
        if (n.roamX !== undefined && n.roamX >= start && n.roamX <= end && Math.abs(n.x - n.roamX) < 12) {
            n.roamWait ??= this.state.elapsed + 2 + n.id % 3;
            if (this.state.elapsed < n.roamWait) return;
            n.roamX = undefined;
        }
        if (n.roamX === undefined || n.roamX < start || n.roamX > end) {
            n.roamX = start + this.rand() * (end - start);
            n.roamWait = undefined;
        }
        this.move(n,n.roamX,100*this.efficiency(n),dt);
    }
    private fightGoblin(n: Goblin, e: Enemy, dt: number, slot: number, canRoam: boolean, frontier: number, guardLine?: number): void {
        // 近战先拆高塔，不能站在塔脚隔空砍到上层射手。
        if(guardLine===undefined&&n.role!=='hunter'&&e.towerId&&this.state.fortifications!.some(f=>f.id===e.towerId&&f.hp>0)){this.fightFort(n,e.towerId,dt);return;}
        const tower=n.towerId?this.state.buildings.find(b=>b.id===n.towerId&&b.hp>0):undefined;
        const def = RULES.role[n.role], range = n.role === 'hunter' ? (tower ? this.towerCombatRange(tower) : def.range) : def.range + 12, d = Math.abs(n.x - e.x);
        const gate=this.state.fortifications!.filter(f=>f.kind==='gate'&&f.hp>0&&(f.x-n.x)*(f.x-e.x)<0).sort((a,b)=>Math.abs(a.x-n.x)-Math.abs(b.x-n.x))[0];
        if(guardLine===undefined&&gate&&(n.role!=='hunter'||d>range)){this.fightFort(n,gate.id,dt);return;}
        if(Math.abs(e.x-n.x)>10)n.face=Math.sign(e.x-n.x);
        const holding = n.order === 'home' && !canRoam || n.order === 'expedition' && this.state.camps[this.state.expedition.camp]?.defeated;
        const cover = holding && closest(this.state.buildings, n.x, b =>
            b.kind === 'wall' && b.hp > 0 && b.level > 0 && b.x < e.x && Math.abs(n.x - b.x) < 500);
        // 同一接敌目标保留真实纵深，后排补位而非几十个轮廓叠在一个点。
        const reserve=n.role==='brute'&&slot>=3||n.role==='hunter'&&!tower&&slot>=9;
        if(reserve){
            const spot = e.x-n.face*(range+(slot-(n.role==='brute'?2:8))*28);
            this.move(n,guardLine === undefined ? spot : Math.min(spot,guardLine-12),135*this.efficiency(n),dt);
            return;
        }
        if (d > range) {
            if(tower){this.move(n,this.towerPosition(n).x,100,dt);return;}
            const retreating = this.state.companies.some(c=>c.id===e.company && c.retreating);
            const roaming = n.order === 'home' && canRoam;
            const limit = n.order==='home' ? roaming?this.roamLimit():frontier + (retreating ? 180 : 500) : Infinity;
            // 防线后移不能打断已接战的攻城目标。
            if (guardLine === undefined && e.x > limit && !(e.company && d <= 430)) { this.move(n,roaming?limit-70:frontier-80,120,dt);return; }
            let destination = e.x - n.face * (range - 8);
            // 守军利用桩墙阻挡，不能为了追前排主动跑出墙外送掉整条防线。
            if (guardLine !== undefined) destination = Math.min(destination,guardLine-12);
            else if (cover && n.x <= cover.x) destination = Math.min(destination, cover.x - (n.role === 'hunter' ? 40 + slot * 22 : 12 + slot * 25));
            if (n.role === 'brute') n.restGoal = undefined;
            this.move(n, destination, 145 * this.efficiency(n), dt); return;
        }
        if (n.cooldown > 0) return;
        n.attackAt=this.state.elapsed;n.cooldown = (n.role === 'hunter' ? tower ? RULES.towerShotInterval : 1 : .9) / this.efficiency(n);
        if (n.role === 'hunter') {this.shoot(n.x, e.x, e.id, this.stats(n).attack, true, 'arrow');if(tower)this.aimTowerShot(n,this.state.shots[this.state.shots.length-1]);}
        else { this.hitEnemy(e, this.stats(n).attack, n.x, false); this.effect('hit', e.x, .25); this.events.push({ kind: 'melee', x: e.x }); }
    }
    private nearTower(n: Goblin): boolean { return this.state.buildings.some(b => b.kind === 'tower' && b.level > 0 && b.hp > 0 && Math.abs(b.x - n.x) < 65); }
    private fightFort(n:Goblin,id:number,dt:number):void{
        const f=this.state.fortifications!.find(f=>f.id===id&&f.hp>0);if(!f)return;
        const range=RULES.role[n.role].range + (n.role === 'brute' ? 26 : 0),dir=Math.sign(f.x-n.x)||1;n.face=dir;
        if(Math.abs(n.x-f.x)>range){
            n.restGoal = undefined;
            this.move(n, f.x - dir * (range - 8), 140, dt);return;
        }
        if(n.cooldown>0)return;n.attackAt=this.state.elapsed;n.cooldown=n.role==='hunter'?1.05:.9;
        if(n.role==='hunter')this.shoot(n.x,f.x,f.id,this.stats(n).attack,true,'arrow');else this.damageFort(f.id,this.stats(n).attack);
    }
    private isFighter(n: Goblin): boolean {
        return !n.dead && (n.role === 'hunter' || n.role === 'brute');
    }
    private recallExpedition(abandon = false, signalled = false): void {
        const s = this.state;
        const e = s.expedition, cart = s.drumCart;
        if (e.state === 'gather' && !e.beats) this.gain(RULES.drumCost);
        if (s.pledge?.action.type === 'retreat') this.cancelPledge();
        if (signalled) this.events.push({kind:'retreatDrum',x:cart?.x??this.flag.x});
        if (cart && abandon) cart.abandoned = true;
        const keepCrew = !!cart && !cart.abandoned;
        for (const n of s.goblins) {
            if ((n.task === 'drum' || n.task === 'drumPull') && !keepCrew) n.task = '';
            if (n.order !== 'home') {
                n.order = 'return';
                n.towerId = undefined;
                if (n.task === 'tower') n.task = '';
            }
        }
        for (const m of s.machines) {
            if (m.owner === 'goblin' && (m.order === 'expedition' || m.order === 'gather')) m.order = 'return';
        }
        s.expedition = { state: 'return', camp: e.camp, drummer: keepCrew ? e.drummer : undefined, puller: keepCrew ? e.puller : undefined };
        this.dirty = true;
    }
    private updateDrumCart(dt: number, target: number, drummer?: Goblin, puller?: Goblin): void {
        const s = this.state, cart = s.drumCart!;
        const distance = target - cart.x;
        const direction = Math.abs(distance) >= 12 ? Math.sign(distance) : cart.face;
        if (puller && puller.stunned <= 0 && puller.hit <= .18) {
            // 鼓车主动跟上首领，转向时拉车者换边不再卡住车和整支军队。
            const run = this.input.run && this.canSprint;
            const boosted = (s.mountBoost[s.player.mount] || 0) > 0;
            const speed = Math.max(228 * RULES.goblinFootSpeed,
                RULES.mount[s.player.mount].speed * (run ? 1.75 : 1) * (boosted ? 1.2 : 1)) *
                this.hallSpeed * (Math.abs(distance) > 160 ? 1.15 : 1);
            const step = clamp(distance, -speed * dt, speed * dt);
            cart.x += step; cart.travel += step;
            if (Math.abs(step) > .001) cart.face = direction;
        }
        if (drummer) {
            const spot = cart.x - cart.face*25, dx = cart.x-cart.prevX;
            drummer.x += dx + clamp(spot-drummer.x-dx,-190*this.hallSpeed*dt,190*this.hallSpeed*dt);
            drummer.face = cart.face;
        }
        if (puller && puller.stunned <= 0 && puller.hit <= .18) {
            const spot = cart.x + cart.face * 83, dx = cart.x - cart.prevX;
            puller.x += dx + clamp(spot - puller.x - dx, -540 * this.hallSpeed * dt, 540 * this.hallSpeed * dt);
            puller.face = cart.face;
            puller.moving = Math.abs(cart.x-cart.prevX) > .001;
            puller.speed = puller.moving ? 103 : 0;
        }
    }
    /** 战鼓开始后自动召集和编配器械。到目标前保持跟随，到齐才统一进入攻营。 */
    private updateExpedition(dt: number): void {
        const s = this.state, expedition = s.expedition;
        this.marchAnchor = s.player.x;
        let cart = s.drumCart;
        if (cart) cart.prevX = cart.x;
        if (expedition.state === 'home') return;
        let drummer = s.goblins.find(n => n.id === expedition.drummer && !n.dead && !n.retreat);
        let puller = s.goblins.find(n => n.id === expedition.puller && !n.dead && !n.retreat);
        if (expedition.state === 'return') {
            if (!cart || cart.abandoned) return;
            // 拉车者阵亡时由仍存活的鼓手接手，不能把全军锁在回营状态。
            if (!puller && drummer) {
                puller = drummer; drummer = undefined;
                expedition.puller = puller.id; expedition.drummer = undefined;
                puller.task = 'drumPull';
            }
            if (puller) this.updateDrumCart(dt, this.flag.x, drummer, puller);
            if (!puller || Math.abs(cart.x - this.flag.x) < 2) {
                if (!puller) cart.abandoned = true; else s.drumCart = undefined;
                for (const n of [drummer, puller]) if (n) { n.task = ''; n.order = 'home'; }
                this.dirty = true;
            }
            return;
        }
        const fighters = s.goblins.filter(n => this.isFighter(n));
        if (!fighters.length) {
            this.recallExpedition(expedition.state !== 'gather');
            return;
        }
        if (expedition.state === 'gather') {
            if (!drummer || !puller) {
                const workers = this.availableWorkers();
                if (!drummer) { drummer = workers.shift(); if (drummer) { drummer.task = 'drum'; expedition.drummer = drummer.id; } }
                if (!puller) { puller = workers.shift(); if (puller) { puller.task = 'drumPull'; expedition.puller = puller.id; } }
                if (!drummer || !puller) {
                    if (s.goblins.filter(n=>!n.dead&&n.role==='worker').length < 2) this.recallExpedition();
                    return;
                }
            }
            const drumX = this.flag.x - 25, pullX = this.flag.x + 83;
            if (drummer.stunned > 0 || drummer.hit > .18 || puller.stunned > 0 || puller.hit > .18) {
                expedition.beatAt = undefined; return;
            }
            this.move(drummer, drumX, 146, dt); this.move(puller, pullX, 146, dt);
            if (Math.abs(drummer.x - drumX) > 6.01 || Math.abs(puller.x - pullX) > 6.01) {
                expedition.beatAt = undefined; return;
            }
            drummer.moving = false; puller.moving = false;
            drummer.face = 1;
            if (expedition.beatAt === undefined) expedition.beatAt = s.elapsed + .29;
            if (s.elapsed + 1e-6 < expedition.beatAt) return;
            const beats = expedition.beats ?? 0;
            if (!beats) {
                for (const n of fighters) {
                    n.order = 'gather';
                    n.task = '';
                    n.towerId = undefined;
                    n.pressureSince = undefined;
                }
                s.chapter!.done.dispatch = true;
            }
            if (beats < RULES.drumBeats) {
                drummer.attackAt = s.elapsed;
                expedition.beats = beats + 1;
                expedition.beatAt = s.elapsed + RULES.drumBeatSeconds;
                this.events.push({ kind: 'drumBeat', x: this.flag.x });
                this.dirty = true;
                return;
            }
            drummer.order = puller.order = 'expedition';
            for (const n of fighters) n.order = 'expedition';
            const workers = this.availableWorkers();
            for (const m of s.machines) {
                if (m.owner !== 'goblin' || m.hp <= 0 || m.order !== 'park' || workers.length < 2) continue;
                const crew = workers.splice(0, 2);
                m.crew = crew.map(n => n.id);
                m.order = 'expedition';
                for (const n of crew) { n.order = 'expedition'; n.task = 'machine'; n.targetId = m.id; }
            }
            s.expedition.state = 'march';
            cart = s.drumCart = { x:this.flag.x, prevX:this.flag.x, face:1, travel:0, marchAt:s.elapsed };
            this.dirty = true;
        }
        const followers = fighters.filter(n => n.order === 'expedition');
        const camp = s.camps[expedition.camp];
        if (expedition.state === 'hold' || camp?.defeated) { this.recallExpedition(); return; }
        if (!followers.length || (expedition.state === 'assault' && followers.every(n=>n.retreat))) {
            this.recallExpedition(true); return;
        }
        // 旧存档已开始的出征保持原编制，下次出征才使用鼓车。
        if (expedition.state === 'assault') {
            if (cart && !cart.abandoned) this.updateDrumCart(dt, cart.x, drummer, puller);
            return;
        }
        const destination = camp;
        if (!destination) return;
        this.escort = s.machines.filter(m => m.hp > 0 && m.owner === 'goblin' && m.order === 'expedition');
        const front = destination.x - RULES.camps[destination.index].width * .5;
        for (const m of this.escort) this.marchAnchor = Math.min(this.marchAnchor, m.x + 330);
        if (cart && !cart.abandoned) {
            if (!puller) { this.recallExpedition(true); return; }
            const direction = Math.abs(s.player.x - s.player.prevX) > .1 ? s.player.face : cart.face;
            this.updateDrumCart(dt, clamp(Math.min(s.player.x - direction * 180, front - 520), RULES.worldMin+95, RULES.worldMax-95), drummer, puller);
        }
        const inPlace = s.player.x >= front - 310 && this.marchAnchor >= front - 500 && followers.every(n => {
            const spot = this.marchAnchor - (n.role === 'brute' ? 40 : 110) - Math.min(25, n.formationRank || 0) * 16;
            return Math.abs(n.x - spot) < 145;
        });
        if (inPlace && (!cart || cart.abandoned || cart.x >= front - 570) && this.escort.every(m => m.x >= front - 760)) {
            expedition.state = 'assault';
            this.events.push({ kind: 'charge', x: s.player.x });
            this.dirty = true;
        }
    }
    private expeditionGoblin(n: Goblin, dt: number): void {
        const s = this.state, camp = s.camps[s.expedition.camp];
        if (!camp) { n.order = 'return'; return; }
        if (camp.defeated) return;
        const fort=s.fortifications!.filter(f=>f.camp===camp.index&&f.hp>0).sort((a,b)=>Math.abs(a.x-n.x)-Math.abs(b.x-n.x))[0];
        if(fort){this.fightFort(n,fort.id,dt);return;}
        const target = camp.x - (n.role === 'brute' ? 48 : 180);
        this.move(n, target, 160, dt);
        if (!camp.defeated && Math.abs(n.x - camp.x) < RULES.role[n.role].range + 20 && n.cooldown <= 0) {
            n.face = 1;n.attackAt=s.elapsed; n.cooldown = n.role === 'hunter' ? 1.05 : .9;
            if (n.role === 'hunter') this.shoot(n.x, camp.x, camp.id, this.stats(n).attack, true, 'arrow');
            else this.damageCamp(camp, this.stats(n).attack);
        }
    }
    private corpseTask(n: Goblin, dt: number): boolean {
        const s = this.state;
        if (n.task === 'capture' && this.corpseReservations.get(n.targetId) === n.id)
            this.corpseReservations.delete(n.targetId);
        if(!this.safeCorpses){
            // 每个逻辑帧只检查一次安全战场，不能为每个闲置单位对每具遗体重新遍历整支联军。
            const limit=Math.max(this.frontier+1000,...s.camps.filter(c=>c.defeated).map(c=>c.x+600));
            const foes=this.activeEnemies().map(e=>e.x).sort((a,b)=>a-b);let j=0;
            const candidates=s.enemies.filter(e=>(e.state==='wounded'||e.state==='bound'&&!e.atPrison||e.state==='dead'&&!e.stripped)&&e.x<limit).sort((a,b)=>a.x-b.x);
            this.safeCorpses=candidates.filter(e=>{while(j<foes.length&&foes[j]<e.x-210)j++;return j===foes.length||foes[j]>e.x+210;});
        }
        let corpse:Enemy|undefined;
        for (const e of this.safeCorpses) {
            const alive = e.state === 'wounded' || e.state === 'bound' && !e.atPrison;
            const reserved = this.corpseReservations.get(e.id);
            if (e.hauler || reserved && reserved !== n.id || alive && n.role !== 'worker' ||
                !alive && (e.state !== 'dead' || e.stripped)) continue;
            if (s.fortifications!.some(f => f.kind === 'gate' && f.hp > 0 && (f.x - n.x) * (f.x - e.x) < 0)) continue;
            const currentAlive = corpse && corpse.state !== 'dead';
            if (!corpse || alive && !currentAlive || alive === !!currentAlive && Math.abs(e.x - n.x) < Math.abs(corpse.x - n.x)) corpse = e;
        }
        if (!corpse || corpse.state === 'dead') {
            const gear = closest(s.gearDrops!, n.x, item => item.amount > 0 && item.age > .7 && Math.abs(item.x - n.x) < 650);
            if (gear) {
                n.task = ''; n.targetId = 0;
                this.move(n, gear.x, 95 * this.efficiency(n) * this.logisticsFactor(), dt);
                if (Math.abs(n.x - gear.x) < 24) { n.loot += gear.amount; gear.amount = 0; n.task = 'lootReturn'; }
                return true;
            }
        }
        if (!corpse) return false;
        this.corpseReservations.set(corpse.id, n.id);
        n.task = 'capture'; n.targetId = corpse.id;
        this.move(n, corpse.x, 95 * this.efficiency(n)*this.logisticsFactor(), dt);
        if (Math.abs(n.x - corpse.x) < 32) {
            this.corpseReservations.delete(corpse.id);
            if (corpse.state !== 'dead') {
                this.bindCaptive(n, corpse);
                let count = 1;
                const capacity = n.role === 'worker' ? this.hall.level : 1;
                // 附近安全的活口串成一队。没有第二个目标就先送已有俘虏。
                for (const e of this.safeCorpses) {
                    if (count >= capacity) break;
                    if (!e.hauler && !e.atPrison && !this.corpseReservations.has(e.id) && (e.state === 'wounded' || e.state === 'bound') && Math.abs(e.x - n.x) <= 130) {
                        this.bindCaptive(n, e);
                        count++;
                    }
                }
                n.task = 'haul'; n.targetId = corpse.id;
            } else {
                corpse.stripped = true; n.loot++; n.task = 'lootReturn'; this.dirty = true;
            }
        }
        return true;
    }
    private bindCaptive(n: Goblin, e: Enemy): void {
        if (!e.stripped) { e.stripped = true; n.loot++; }
        e.state = 'bound'; e.hauler = n.id; e.atPrison = false; e.timer = 0;
        e.saleValue ??= 4 + Math.floor(this.rand() * 3);
        this.dirty = true;
    }
    private releaseCaptives(n: Goblin): void {
        for (const e of this.state.enemies) if (e.hauler === n.id) { e.hauler = 0; e.timer = 0; }
    }
    private haul(n: Goblin, dt: number): void {
        const group = this.state.enemies.filter(e => e.state === 'bound' && e.hauler === n.id);
        if (!group.length) { n.task = ''; return; }
        this.move(n, this.prison.x, 64 * this.efficiency(n)*this.logisticsFactor(), dt);
        if (Math.abs(n.x - this.prison.x) < 30) {
            for (const e of group) { e.hauler = 0; e.timer = 0; e.atPrison = true; }
            n.task = '';
            this.state.gearStock += n.loot; n.loot = 0; this.dirty = true;
        }
    }
    private updateEnemies(dt: number): void {
        const s = this.state;
        const fronts=new Map<number,Enemy[]>();
        for(const e of s.enemies)if(e.state==='active'&&e.meleeTarget!==undefined&&!e.jump){const line=fronts.get(e.meleeTarget)||[];line.push(e);fronts.set(e.meleeTarget,line);}
        // 目标候选每步只装配一次，接敌队列保持入列次序，不按细小距离每帧交换前后排。
        const allTargets:{id:number;x:number;kind:string;object:any}[]=s.goblins.filter(n=>!n.dead).map(n=>({id:n.id,x:n.x,kind:'goblin',object:n}));
        allTargets.push({id:-1,x:s.player.x,kind:'player',object:s.player});
        for(const m of s.machines)if(m.owner==='goblin'&&m.hp>0)allTargets.push({id:m.id,x:m.x,kind:'machine',object:m});
        const groundTargets=allTargets.filter(t=>t.kind!=='goblin'||this.hitElevation(t.id)<=80);
        for(const tower of s.buildings)if(tower.kind==='tower'&&tower.hp>0&&s.goblins.some(n=>!n.dead&&n.towerId===tower.id))groundTargets.push({id:tower.id,x:tower.x,kind:'building',object:tower});
        for (const e of s.enemies) {
            e.timer += dt; e.hit = Math.max(0, e.hit - dt); e.snared = Math.max(0, e.snared - dt); e.cooldown = Math.max(0, e.cooldown - dt); e.spells -= dt;
            if (e.state !== 'active' && e.state !== 'escaping') continue;
            const company = s.companies.find(c => c.id === e.company), camp = s.camps[e.camp];
            if (e.state === 'escaping') {
                e.windup=undefined;e.jump=undefined;
                const home=s.camps.find(c=>c.index>=e.camp&&!c.defeated)||this.nearestCamp;
                if(!home){if(!e.counted&&e.force==='field')s.army!.retired++;e.state='gone';e.returned=true;continue;}
                this.move(e,home.x+700,172,dt);
                if(e.x>home.x+600)this.returnEnemy(e);
                continue;
            }
            if (e.patrol && s.day < RULES.enemySortieStartDay) {
                delete e.strike;
                e.patrolReturn = true;
            }
            if (e.strike) {
                if (s.elapsed >= e.strike.releaseAt) this.releaseEnemyStrike(e);
                continue;
            }
            if(e.patrol){
                if(!this.daytimeRoaming||camp.defeated)e.patrolReturn=true;
                if(e.patrolReturn){
                    const home=s.camps.find(c=>c.index>=e.camp&&!c.defeated)||this.nearestCamp;
                    if(!home){s.army!.retired++;e.returned=true;e.state='gone';continue;}
                    const destination=home.x-RULES.camps[home.index].width*.25;
                    this.move(e,destination,156,dt);if(Math.abs(e.x-destination)<28)this.returnEnemy(e);continue;
                }
                const threat=closest(s.goblins,e.x,n=>!n.dead&&!n.towerId&&(n.role==='hunter'||n.role==='brute')&&Math.abs(n.x-e.x)<=RULES.patrolRadius);
                const numbers=this.localNumbers(e.x);
                if(threat&&(e.fleeUntil||0)<=s.elapsed&&numbers.enemies<numbers.goblins*.85){e.fleeUntil=s.elapsed+2;e.fleeFrom=threat.x;}
                if((e.fleeUntil||0)>s.elapsed){const away=Math.sign(e.x-(e.fleeFrom??e.x-1))||1;this.move(e,clamp(e.x+away*260,RULES.worldMin+95,RULES.worldMax-95),174,dt);continue;}
            }
            if(e.towerId&&s.fortifications!.some(f=>f.id===e.towerId&&f.hp>0))continue;
            if(e.jump){e.jump.left=Math.max(0,e.jump.left-dt);const t=1-e.jump.left/e.jump.total;e.x=e.jump.from+(e.jump.to-e.jump.from)*t;e.moving=true;if(!e.jump.left)e.jump=undefined;continue;}
            if(e.windup){
                const w=e.windup;w.left-=dt;
                if (w.left <= 0) {
                    if (w.kind === 'jump') {
                        const obstacle = s.buildings.find(b => b.id === w.targetId);
                        if (obstacle && obstacle.hp > 0 && obstacle.level <= 2) e.jump = {from:e.x,to:w.targetX,left:.75,total:.75};
                        e.spells = 9;
                    } else {
                        const radius = w.radius ?? (HEROES[e.hero || '']?.boss ? 100 : 70);
                        e.attackAt = s.elapsed; e.attackStyle = 'slam';
                        this.blast(w.targetX, radius, this.enemyStats(e).attack * 1.5, false);
                        this.effect('slamImpact', w.targetX, .5, radius).strong = HEROES[e.hero || '']?.boss;
                        this.effect('hit', w.targetX, .4, 2);
                        this.events.push({kind:'heavySlam',x:w.targetX});
                        e.spells = 7; e.cooldown = 1.2;
                    }
                    e.windup = undefined;
                }
                continue;
            }
            if (e.snared > 0 || (e.staggerUntil||0)>s.elapsed) continue;
            let aiDt=dt;
            if(!e.company&&Math.abs(e.x-s.player.x)>1800&&!s.goblins.some(n=>!n.dead&&Math.abs(n.x-e.x)<1700)){
                e.aiClock=(e.aiClock||0)+dt;if(e.aiClock<.4)continue;aiDt=e.aiClock;e.aiClock=0;
            }
            const hero=HEROES[e.hero||''];
            const def = e.kind === 'elf' && e.ammo <= 0&&!hero ? {...this.enemyStats(e),range:43,attack:4*(e.scale??enemyFactor(s.day))}:this.enemyStats(e);
            if(hero&&e.spells<=0){
                if(hero.skill==='engineer'){e.spells=8;this.repairEnemyWorks(e);}
                if(hero.skill==='charge'){e.spells=10;e.boostedUntil=s.elapsed+1.8;}
            }
            const targets=def.range<100?groundTargets:allTargets;
            const nearest=closest(targets,e.x,t=>t.object.hp>0&&!t.object.dead);
            const previous=targets.find(t=>t.id===e.combatTarget&&t.object.hp>0&&!t.object.dead);
            let target=previous&&(s.elapsed<(e.targetUntil||0)||!nearest||Math.abs(previous.x-e.x)<Math.abs(nearest.x-e.x)+65)?previous:nearest;
            if(target&&target.id!==e.combatTarget){e.combatTarget=target.id;e.targetUntil=s.elapsed+.8;}
            const alert=s.fortifications!.some(f=>f.camp===e.camp&&f.hp<f.maxHp);
            const sheltered=target&&s.buildings.some(w=>w.kind==='wall'&&w.level&&w.hp>0&&(w.x-target.x)*(w.x-e.x)<0);
            if(e.patrol&&(!target||Math.abs(target.x-e.x)>500||sheltered)){
                if(Math.abs(e.x-(e.roamX??e.x))<25&&e.timer>3){e.timer=0;const first=e.camp===(this.nearestCamp?.index??-1);e.roamX=first?Math.max(this.frontier+210,Math.min(camp.x-450,this.frontier+400+this.rand()*450)):camp.x-RULES.camps[e.camp].width*.55-200-this.rand()*400;}
                this.move(e,e.roamX??camp.x-550,this.enemyStats(e).speed,aiDt);continue;
            }
            if (!e.company && !e.patrol && (!target || Math.abs(target.x-camp.x)>RULES.camps[e.camp].width*.7+260 || Math.abs(e.x-camp.x)>RULES.camps[e.camp].width*.8+300 || Math.abs(target.x-e.x)>(alert?1100:460))) {
                if (e.timer > 5) { e.timer = 0; e.face = this.rand() > .5 ? 1 : -1; }
                this.move(e, camp.x-RULES.camps[e.camp].width*.25+(e.id%6)*38, 75, aiDt); continue;
            }
            if (!target) continue;
            const wall = s.buildings.filter(b => b.hp > 0 && b.level > 0 && b.kind === 'wall' &&
                b.x !== e.x && (b.x - e.x) * (b.x - target.x) <= 0)
                .sort((a, b) => Math.abs(a.x - e.x) - Math.abs(b.x - e.x))[0];
            if(e.kind==='jumper'&&wall&&wall.level<=2&&Math.abs(wall.x-e.x)<145&&e.spells<=0){e.windup={kind:'jump',left:.65,total:.65,targetId:wall.id,targetX:wall.x+Math.sign(target.x-e.x)*100};e.cooldown=1;this.effect('star',e.x,.65);continue;}
            if (wall) target = { id: wall.id, x: wall.x, kind: 'building', object: wall };
            const distance = Math.abs(target.x - e.x), face = Math.sign(target.x - e.x) || -1; e.face = face;
            const reach = def.range + (target.kind === 'player' ? 24 : def.range < 100 ? wall ? 25 : 12 : 0);
            // 一条横路只有有限接敌面，后排近战排队推进，不能叠成一团同时穿模围殴。
            if(def.range<100){
                if(e.meleeTarget!==target.id){const previous=fronts.get(e.meleeTarget!);if(previous){const index=previous.indexOf(e);if(index>=0)previous.splice(index,1);}}
                e.meleeTarget=target.id;
                const line=fronts.get(target.id)||[];if(!line.includes(e))line.push(e);fronts.set(target.id,line);
                const rank=line.indexOf(e);
                if(rank>=3){this.move(e,target.x-face*(reach-5+(rank-2)*32),def.speed*1.3,aiDt);continue;}
            }else e.meleeTarget=undefined;
            if (distance > reach) {
                if (def.range < 100) e.restGoal = undefined;
                this.move(e, target.x - face * (reach - 8), def.speed * (hero?.skill==='charge'&&s.elapsed<(e.boostedUntil||0)?2.1:1.3), aiDt);
                continue;
            }
            if (e.cooldown > 0) continue;
            if (hero?.skill === 'slam' && e.spells <= 0) {
                const radius = hero.boss ? 100 : 70;
                e.windup = {kind:'slam',left:1.1,total:1.1,targetId:target.id,targetX:target.x,radius};
                this.effect('slamWarning', target.x, 1.1, radius).strong = hero.boss;
                continue;
            }
            if (hero?.skill === 'volley' && e.spells <= 0) {
                e.spells = 9;
                e.cooldown = 1.6;
                const volley = wall ? [target] : targets.filter(t => Math.abs(t.x - e.x) <= def.range).slice(0, 3);
                this.queueEnemyStrike(e, 'bow', volley, def.attack, def.range);
                continue;
            }
            e.cooldown = e.kind === 'mage' ? 2.5 : e.kind === 'elf' ? 1.4 : 1.15;
            const style = e.kind === 'mage' ? 'cast' : e.kind === 'elf' && (e.ammo > 0 || hero) ? 'bow' : 'melee';
            const power = def.attack * (s.elapsed < (e.boostedUntil || 0) ? 1.25 : 1);
            this.queueEnemyStrike(e, style, [target], power, reach);
            if (style === 'cast' && e.spells <= 0) {
                e.spells = 11;
                e.strike!.meteor = hero?.skill === 'meteor' ? 2 : 1;
            }
        }
    }
    private repairEnemyWorks(e: Enemy): void {
        const s = this.state;
        let nearest = Infinity;
        for (const fort of s.fortifications!) {
            if (fort.camp !== e.camp || fort.hp <= 0 || fort.hp >= fort.maxHp) continue;
            fort.hp = Math.min(fort.maxHp, fort.hp + 14);
            this.effect('repairSpark', fort.x, .46, fort.kind === 'tower' ? 85 : 52);
            const distance = Math.abs(fort.x - e.x);
            if (distance < nearest) { nearest = distance; e.repairX = fort.x; }
        }
        for (const machine of s.machines) {
            const distance = Math.abs(machine.x - e.x);
            if (machine.owner !== 'enemy' || distance >= 500 || machine.hp >= machine.maxHp) continue;
            machine.hp = Math.min(machine.maxHp, machine.hp + 18);
            if (machine.order !== 'reserve') this.effect('repairSpark', machine.x, .46, 63);
            if (distance < nearest) { nearest = distance; e.repairX = machine.x; }
        }
        if (nearest < Infinity) { e.repairAt = s.elapsed; this.dirty = true; }
    }

    private queueEnemyStrike(e: Enemy, style: QueuedAttackStyle, targets: { id: number }[], power: number, reach: number): void {
        e.attackAt = this.state.elapsed;
        e.attackStyle = style;
        e.strike = { style, releaseAt: e.attackAt + ATTACK_LEAD[style], power, reach,
            targets: targets.map(t => ({ id: t.id })), towerId: e.towerId };
    }

    /** 在挥击或松弦时结算，同一攻击在读档、暂停和重复渲染下都只出手一次。 */
    private releaseEnemyStrike(e: Enemy): void {
        const s = this.state, strike = e.strike!;
        delete e.strike;
        if (strike.towerId && e.towerId !== strike.towerId) return;
        for (const { id } of strike.targets) {
            const target = id === -1 ? s.player :
                s.goblins.find(n => n.id === id && !n.dead) ||
                s.buildings.find(b => b.id === id && b.hp > 0) ||
                s.machines.find(m => m.id === id && m.owner === 'goblin' && m.hp > 0);
            if (!target || target.hp <= 0 || Math.abs(target.x - e.x) > strike.reach + 12) continue;
            if (strike.style === 'melee') {
                this.hurtTarget(id, strike.power, e.x);
                if (!s.buildings.some(b => b.id === id && b.kind === 'wall')) this.events.push({ kind: 'melee', x: target.x });
            }
            else {
                this.shoot(e.x, target.x, id, strike.power, false, strike.style === 'bow' ? 'arrow' : 'fireball');
                if (strike.towerId) s.shots[s.shots.length - 1].fromY = 46 + this.enemyTowerPosition(e).height;
                else if (strike.style === 'bow' && !e.hero) e.ammo--;
                if (strike.meteor) for (let i = -1; i <= strike.meteor; i++) {
                    const warning = this.effect('warning', target.x + i * 65, 1.7, .8);
                    warning.damage = strike.power;
                    warning.tickDamage = 4 * (e.scale ?? 1);
                    warning.strong = e.hero === 'fire_boss';
                }
            }
        }
    }
    private hurtTarget(id: number, damage: number, fromX: number): void {
        const s = this.state;
        if (id === -1) {
            if (s.player.hurt > 0 || s.elapsed < (s.player.reviveUntil ?? 0)) return;
            const oldHp = s.player.hp;
            s.player.hp = Math.max(0, oldHp - damage); s.player.hurt = 1.2; this.effect('hit', s.player.x, .45);
            const low = this.playerMaxHp * .3;
            if (oldHp > low && s.player.hp > 0 && s.player.hp <= low) this.events.push({ kind: 'lowHealth', x: s.player.x });
            return;
        }
        const n = s.goblins.find(n => n.id === id && !n.dead);
        if (n) {
            n.hp -= armoredDamage(damage,this.stats(n).defense); n.hit = .38;
            if (n.hp <= 0) this.killGoblin(n);
            this.effect('hit', n.x, .3); this.dirty = true; return;
        }
        const b = s.buildings.find(b => b.id === id && b.hp > 0);
        if (b) {
            const hit = b.kind === 'wall' && b.level === 1 ? armoredDamage(damage, RULES.starterWallDefense) : damage;
            b.hp = Math.max(0, b.hp - hit);
            if (b.kind === 'wall') this.events.push({ kind: b.hp <= 0 ? 'wallBreak' : 'woodHit', x: b.x });
            if (b.hp <= 0 && b.kind === 'wall') {
                s.defenseBreach = { x: b.x, until: s.elapsed + 6 };
                if(b.region>=0){s.camps[b.region].claimed = false; s.camps[b.region].rebuild = 0;}
                this.syncPrisonLocation();
                this.syncDrum();
            }
            this.effect('smoke', b.x, .4); this.dirty = true;
        }
        const m=s.machines.find(m=>m.id===id&&m.owner==='goblin'&&m.hp>0);
        if(m){m.hp=Math.max(0,m.hp-damage);if(m.hp===0){for(const unit of s.goblins)if(m.crew.includes(unit.id)){unit.task='';unit.order='home';}m.crew=[];}this.effect('smoke',m.x,.4);this.dirty=true;}
    }
    private killGoblin(n: Goblin): void {
        if (n.task === 'haul') this.releaseCaptives(n);
        n.dead = true; n.hp = 0; n.task = ''; n.order = 'home'; n.timer = 0;
        n.towerId = undefined; n.retreat = undefined;
        n.coinLoot = this.corpseReward(n);
        this.drop(n.x, n.carry + n.hidden); n.carry = 0; n.hidden = 0;
        if (n.loot > 0) { this.state.gearDrops!.push({id:this.id(),x:n.x,amount:n.loot,age:0}); n.loot = 0; }
    }
    hitEnemy(e: Enemy, damage: number, fromX: number, arrow = false): void {
        if (e.state !== 'active' && e.state !== 'escaping') return;
        const frontal = Math.sign(fromX - e.x) === e.face;
        if (arrow && !e.stripped&&e.kind === 'shield' && frontal && e.cooldown < .8) {
            damage *= .22;
            this.events.push({ kind: 'shield', x: e.x });
        }
        if(arrow&&HEROES[e.hero||'']?.skill==='armor')damage*=.55;
        const warden = this.state.enemies.find(n => n.state === 'active' && HEROES[n.hero || '']?.skill === 'ward' && Math.abs(n.x - e.x) < 220);
        if (warden) {
            if (damage > 0) { warden.wardCastAt = this.state.elapsed; e.wardAt = this.state.elapsed; }
            damage *= .75;
        }
        e.hp -= armoredDamage(damage,this.enemyStats(e).defense);e.hit=.32;
        if(this.state.elapsed>=(e.staggerReadyAt||0)){e.staggerUntil=this.state.elapsed+(e.hero?.06:.10);e.staggerReadyAt=this.state.elapsed+(e.hero?1:.5);}
        if (e.hp <= 0) {
            e.windup=undefined;e.jump=undefined;e.meleeTarget=undefined;e.towerId=undefined;
            this.enemiesDirty=true;e.state = this.rand() < RULES.enemyCaptureChance ? 'wounded' : 'dead'; e.timer = 0; this.state.kills++;
            if (e.state === 'wounded') e.saleValue = 4 + Math.floor(this.rand() * 3);
            else e.coinLoot = this.corpseReward(e);
            if (!e.counted) {
                e.counted = true; if(this.state.army){if((e.force||(e.company?'field':'guard'))==='field'){this.state.army.lost++;this.state.camps[e.camp].fieldLosses=(this.state.camps[e.camp].fieldLosses||0)+1;}else this.state.army.guardLost++;} const company = this.state.companies.find(c => c.id === e.company);
                if (company) {
                    company.lost++;
                    if (company.lost >= company.initial) {
                        // 攻城队战至全部倒地才丢下器械，不因半数伤亡或天亮逃离。
                        for (const machine of this.state.machines) if (machine.company === company.id && machine.owner === 'enemy') { machine.owner = 'abandoned'; machine.order = 'park'; }
                    }
                }
            }
            this.dirty = true;
        }
    }
    private damageCamp(c: Camp, damage: number): void {
        if (c.defeated) return;
        c.hp = Math.max(0, c.hp - damage);
        if (c.hp <= 0 && this.campRemaining(c)===0&&!this.state.fortifications!.some(f=>f.camp===c.index&&f.hp>0)) this.clearCamp(c);
    }
    private clearCamp(c: Camp): void {
        if (!c.defeated) {
            c.defeated = true; c.rebuild = 0; c.claimed = this.state.buildings.some(b=>b.kind==='wall' && b.region===c.index && b.level>0 && b.hp>0);
            const next=this.state.camps[c.index+1];if(next)next.frontierSince=this.state.day;
            if (!c.rewarded) { c.rewarded = true; this.drop(c.x, 50); }
            this.effect('smoke', c.x, 1.4, 3); this.events.push({ kind: 'camp', x: c.x });
            if (c.index === this.state.expedition.camp && this.state.expedition.state === 'assault') this.recallExpedition();
            if (this.state.camps.every(c=>c.defeated)) this.finish('won');
            this.dirty = true;
        }
    }
    private updateMachines(dt: number): void {
        const s = this.state;
        for (const m of s.machines) {
            m.cooldown = Math.max(0, m.cooldown - dt);
            if (m.hp <= 0 || m.order==='reserve') continue;
            if (m.owner === 'abandoned') {
                m.crew=m.crew.filter(id=>s.goblins.some(n=>n.id===id&&!n.dead&&n.task==='salvageMachine'&&n.targetId===m.id));
                if (!m.crew.length && !s.buildings.some(b=>b.job) && !this.activeEnemies().some(e => Math.abs(e.x - m.x) < 250)) {
                    const worker = this.availableWorkers().sort((a,b)=>Math.abs(a.x-m.x)-Math.abs(b.x-m.x))[0];
                    if(worker){m.crew=[worker.id];worker.task='salvageMachine';worker.targetId=m.id;}
                }
                continue;
            }
            if (m.owner === 'goblin') {
                const crew = m.crew.map(id => s.goblins.find(n => n.id === id && !n.dead)).filter(Boolean) as Goblin[];
                if(crew.length<m.crew.length){for(const n of crew){n.task='';n.order='home';}m.crew=[];m.order='park';this.dirty=true;}
                const canMove = crew.length === (m.order === 'return' ? Math.max(1, m.crew.length) : 2) && crew.every(n => n.stunned<=0 && Math.abs(n.x - m.x) < 150);
                if (m.order === 'gather') { if (canMove) this.move(m, this.flag.x + 120, 56, dt); }
                else if (m.order === 'return') {
                    if (canMove) this.move(m, Math.max(1100, this.frontier - 210), 54, dt);
                    if (Math.abs(m.x - Math.max(1100, this.frontier - 210)) < 12) { m.order = 'park'; for (const n of crew) { n.task = ''; n.order = 'home'; } m.crew = []; }
                } else if (m.order === 'expedition') {
                    if (s.expedition.state === 'march') {
                        const rank = Math.max(0, this.escort.indexOf(m));
                        const destination = clamp(s.player.x - 170 - Math.min(3, rank) * 55, RULES.worldMin + 95, RULES.worldMax - 95);
                        if (canMove) this.move(m, destination, 56, dt);
                        continue;
                    }
                    const c = s.camps[s.expedition.camp]; if (!c || c.defeated) continue;
                    const target = this.activeEnemies().filter(e => e.x > m.x).sort((a, b) => a.x - b.x)[0];
                    const fort=s.fortifications!.filter(f=>f.camp===c.index&&f.hp>0).sort((a,b)=>Math.abs(a.x-m.x)-Math.abs(b.x-m.x))[0];
                    const destination=fort?.x??c.x,targetEnemy=target&&target.x<destination?target:undefined;
                    const targetX=targetEnemy?.x??destination,targetId=targetEnemy?.id??fort?.id??c.id;
                    const range = m.kind === 'ram' ? 85 : 430;
                    if (Math.abs(m.x - targetX) > range && canMove) this.move(m, targetX - range + 5, 54, dt);
                    else if (canMove && m.cooldown <= 0) {
                        m.cooldown = m.kind === 'ram' ? 3 : 5;
                        if (m.kind === 'ram') { if (targetEnemy) this.hitEnemy(targetEnemy,38*(m.scale||1),m.x); else if(fort)this.damageFort(fort.id,46*(m.scale||1));else this.damageCamp(c,46*(m.scale||1)); }
                        else this.shoot(m.x, targetX, targetId,38*(m.scale||1),true, m.kind === 'firecatapult' ? 'fire' : 'stone');
                    }
                }
            } else {
                const wall = s.buildings.filter(b => b.kind === 'wall' && b.hp > 0 && b.x < m.x).sort((a, b) => b.x - a.x)[0];
                const targetX = wall?.x ?? s.player.x, distance = m.x - targetX, range = m.kind === 'ram' ? 85 : 420;
                if (distance > range) this.move(m, targetX + range - 8, 46, dt);
                else if (m.cooldown <= 0) {
                    m.cooldown = m.kind === 'ram' ? 3.2 : 6;
                    if (m.kind === 'ram') this.hurtTarget(wall?.id || -1, 36*(m.scale||1), m.x);
                    else this.shoot(m.x, targetX, wall?.id || -1, 30*(m.scale||1), false, m.kind === 'firecatapult' ? 'fire' : 'stone');
                }
            }
        }
    }
    private updateAnimals(dt: number): void {
        for (const a of this.state.animals) {
            a.timer += dt; a.moving = false;
            if (a.hp <= 0) { if (a.timer > 95) { a.hp = a.kind === 'deer' ? 17 : 8; a.x = a.home; a.timer = 0; } continue; }
            const threat = this.activeEnemies().find(e => Math.abs(e.x - a.x) < 130) || this.state.goblins.find(n => !n.dead && n.role === 'hunter' && Math.abs(n.x - a.x) < 105);
            if (threat) this.move(a, clamp(a.x + Math.sign(a.x - threat.x) * 150, a.home - 240, a.home + 260), a.kind === 'deer' ? 146 : 118, dt);
            else if (a.timer > 3) { a.face = a.timer % 9 < 4 ? -1 : 1; this.move(a, a.home + a.face * 60, 22, dt); if (a.timer > 9) a.timer = 0; }
        }
    }
    /** 使用真实站位高度，箭台和飞行不会只改变画面而仍在地面挨箭。 */
    private hitElevation(id:number):number{
        if(id===-1)return 46+this.state.player.fly;
        const e=this.state.enemies.find(e=>e.id===id&&e.state==='active');if(e?.towerId)return 46+this.enemyTowerPosition(e).height;
        const n=this.state.goblins.find(n=>n.id===id&&!n.dead);
        const tower=n?.towerId?this.state.buildings.find(b=>b.id===n.towerId&&b.hp>0):undefined;
        return tower&&Math.abs(n!.x-tower.x)<55?46+this.towerPosition(n!).height:46;
    }
    private shoot(x: number, targetX: number, targetId: number, damage: number, friendly: boolean, kind: Shot['kind']): void {
        const duration = kind === 'stone' || kind === 'fire' ? 1.15 : Math.max(.15, Math.abs(targetX - x) / 650);
        const targetY=(kind==='arrow'||kind==='fireball')?this.hitElevation(targetId):undefined;
        this.state.shots.push({ id: this.id(), kind, fromX: x, x, targetX, targetId, friendly, damage, age: 0, duration, hit: false, fromY: kind === 'arrow' ? 46 : 70,targetY });
        this.events.push({ kind: kind === 'arrow' ? 'arrow' : 'throw', x });
    }
    /** 驻塔箭矢以更高速度持续修正目标位置，移动猎物和攀跃敌人也能瞄准。 */
    private aimTowerShot(n: Goblin, shot: Shot): void {
        shot.fromY = 46 + this.towerPosition(n).height;
        shot.duration = Math.max(.12, Math.abs(shot.targetX - shot.fromX) / RULES.towerArrowSpeed);
        shot.tracking = true;
    }
    private updateShots(dt: number): void {
        const s = this.state;
        for (const shot of s.shots) {
            if (shot.tracking && !shot.hit) {
                const enemy = this.enemyById.get(shot.targetId);
                const animal = enemy ? undefined : s.animals.find(a => a.id === shot.targetId && a.hp > 0);
                if (enemy) { shot.targetX = enemy.x; shot.targetY = this.hitElevation(enemy.id); }
                else if (animal) { shot.targetX = animal.x; shot.targetY = animal.kind === 'deer' ? 32 : 16; }
            }
            shot.age += dt; shot.x = shot.fromX + (shot.targetX - shot.fromX) * Math.min(1, shot.age / shot.duration);
            if (shot.hit || shot.age < shot.duration) continue;
            shot.hit = true;
            if (shot.kind === 'stone' || shot.kind === 'fire') { this.blast(shot.targetX, 72, shot.damage, shot.friendly); this.effect(shot.kind === 'fire' ? 'fire' : 'smoke', shot.targetX, shot.kind === 'fire' ? 4 : .7, 1.3);if(shot.kind==='fire')s.effects[s.effects.length-1].tickDamage=4*shot.damage/(shot.friendly?38:30); }
            else if (shot.friendly) {
                const enemy = s.enemies.find(e => e.id === shot.targetId);
                if (enemy && Math.abs(enemy.x-shot.targetX)<65&&Math.abs(this.hitElevation(enemy.id)-(shot.targetY??46))<=32) this.hitEnemy(enemy, shot.damage, shot.fromX, true);
                const animal = s.animals.find(a => a.id === shot.targetId);
                if (animal && animal.hp > 0 && Math.abs(animal.x - shot.targetX) < 70) { animal.hp -= shot.damage; if (animal.hp <= 0) { animal.timer = 0; this.drop(animal.x, animal.kind === 'deer' ? 2 : 1); this.effect('smoke', animal.x, .5); } }
                const camp = s.camps.find(c => c.id === shot.targetId); if (camp) this.damageCamp(camp, shot.damage);
                this.damageFort(shot.targetId,shot.damage);
            } else {
                // 敌方弹道与友方一样按真实落点命中，移动躲开不能继续按ID扣血。
                const target=shot.targetId===-1?s.player:s.goblins.find(n=>n.id===shot.targetId&&!n.dead)||s.buildings.find(b=>b.id===shot.targetId&&b.hp>0)||s.machines.find(m=>m.id===shot.targetId&&m.hp>0&&m.owner==='goblin');
                const radius=shot.targetId===-1?42:target&&'kind'in target?42:26;
                if(target&&Math.abs(target.x-shot.targetX)<=radius&&Math.abs(this.hitElevation(shot.targetId)-(shot.targetY??46))<=32)this.hurtTarget(shot.targetId,shot.damage,shot.fromX);
            }
        }
        s.shots = s.shots.filter(shot => shot.age < shot.duration + .18);
    }
    private blast(x: number, radius: number, damage: number, friendly: boolean): void {
        if (friendly) {
            for (const e of this.activeEnemies()) if (Math.abs(e.x - x) < radius) this.hitEnemy(e, damage, x);
            for (const c of this.state.camps) if (Math.abs(c.x - x) < radius + 40) this.damageCamp(c, damage);
            for(const f of this.state.fortifications!)if(f.hp>0&&Math.abs(f.x-x)<radius)this.damageFort(f.id,damage);
        } else {
            if (Math.abs(this.state.player.x - x) < radius) this.hurtTarget(-1, damage, x);
            for (const n of this.state.goblins) if (!n.dead && Math.abs(n.x - x) < radius) this.hurtTarget(n.id, damage, x);
            for (const b of this.state.buildings) if (b.hp > 0 && Math.abs(b.x - x) < radius) this.hurtTarget(b.id, damage, x);
        }
    }
    /** 监牢跟随完好的第二道防线，保留等级、囚犯与搬运目的地。 */
    private syncPrisonLocation(): void {
        const s = this.state, prison = this.prison;
        const walls = s.buildings.filter(b => b.kind === 'wall' && b.level && b.hp > 0).sort((a,b)=>b.x-a.x);
        const support = walls[1];
        const next = support && support.region !== CAVE_TOWER_REGION ? support.x - 460 : CAVE_PRISON_X;
        const distance = next - prison.x;
        if (!distance) return;
        prison.x = next;
        for (const e of s.enemies) if (e.state === 'captured' || e.state === 'bound' && e.atPrison && !e.hauler)
            e.x = e.prevX = e.x + distance;
        if (s.trader.phase === 'trading') {
            s.trader.present = false; s.trader.phase = 'arriving';
        }
        this.dirty = true;
    }
    /** 商人每次都去监牢的新停靠点，当期搬迁则连笼车一起改道。 */
    private updateTrader(dt: number): void {
        const s = this.state, t = s.trader;
        const stop = this.prison.x + TRADER_STOP - CAVE_PRISON_X;
        t.prevX = t.x;
        if (t.phase === 'away') {
            const visitToday = s.day >= RULES.traderFirstDay && (s.day - RULES.traderFirstDay) % RULES.traderInterval === 0;
            if (visitToday && s.time < RULES.traderMorningEnd && t.visitDay !== s.day) {
                t.visitDay = s.day;
                t.x = t.prevX = stop + 2040;
                t.cargo = [];
                t.phase = 'arriving';
                this.dirty = true;
            }
        } else if (t.phase === 'arriving') {
            t.x += clamp(stop - t.x, -88 * dt, 88 * dt);
            if (Math.abs(t.x - stop) < .01) {
                t.x = stop;
                t.phase = 'trading';
                t.present = true;
                this.dirty = true;
            }
        }
        else if (t.phase === 'trading') {
            if (s.day > t.visitDay! + 1 || s.day === t.visitDay! + 1 && s.time >= RULES.traderDepartureAt) {
                t.present = false;
                t.phase = 'turning';
                t.cartX = t.x + TRADER_CART_OFFSET;
                this.dirty = true;
            }
        }
        // 绕到笼车另一侧再拉走，转向过程中笼车留在原位。
        else if (t.phase === 'turning') {
            const destination = t.cartX! + TRADER_CART_OFFSET;
            t.x = Math.min(destination, t.x + 175 * dt);
            if (t.x === destination) {
                t.phase = 'leaving';
                t.prevX = t.x;
                delete t.cartX;
                this.events.push({ kind: 'cart', x: t.x });
            }
        }
        else {
            t.x += 88 * dt;
            if (t.x > stop + 3940 || t.x > stop + 2090 && Math.abs(t.x - s.player.x) > 1500) {
                t.phase = 'away';
                t.cargo = [];
                this.dirty = true;
            }
        }
    }
    private updatePrison(dt: number): void {
        this.updateTrader(dt);
        const s = this.state;
        const capacity=this.prison.hp>0?RULES.prisonCapacity[this.prison.level]:0;
        let occupied=0;
        for(const e of s.enemies)if(e.state==='captured'){
            if(occupied<capacity)occupied++;
            else{e.state='bound';e.atPrison=true;e.hauler=0;}
        }
        // 先按整座监牢计算空位，再提升牢旁俘虏，不能依赖数组先后顺序。
        for(const e of s.enemies)if(e.state==='bound'&&!e.hauler&&e.atPrison&&occupied<capacity){
            e.state='captured';occupied++;
            this.events.push({ kind: 'cage', x: this.prison.x });
        }
        const carriers = new Map(s.goblins.filter(n => !n.dead && n.task === 'haul').map(n => [n.id, n]));
        const spacing = new Map<number, number>();
        for(const e of s.enemies)if(e.state==='bound'&&e.hauler){
            const carrier=carriers.get(e.hauler);
            if(carrier){
                const rank = spacing.get(carrier.id) ?? 0;
                spacing.set(carrier.id, rank + 1);
                e.x = carrier.x - carrier.face * (48 + rank * 75); e.face = carrier.face;
            }
            else e.hauler=0;
        }
        const layout=prisonLayout(this.prison.level,s.enemies.filter(e=>e.state==='captured'));
        let inside = 0, outside = 0;
        for (const e of s.enemies) {
            if (e.state === 'captured') { e.prisonSlot = inside++; e.x = this.prison.x+layout.slotX(e.prisonSlot); }
            if (e.state === 'bound' && !e.hauler && e.atPrison) {
                e.x = this.prison.x + 90 + outside++ * 22;
            }
            if (e.state === 'bound' && !e.hauler && e.timer > 22) {
                e.timer = 0;
                const chance = .26;
                if (this.rand() < chance) { this.enemiesDirty=true;e.state = 'escaping'; e.atPrison = false; e.hp = e.maxHp * .4; e.timer = 0; this.effect('star', e.x, .7); this.dirty = true; }
            }
            // 长地图仍要给正常步行绑运留出时间，不能让远营所有活口在搬运者到达前必死。
            if (e.state === 'wounded' && e.timer > 160+Math.max(0,e.x-this.prison.x)/110) {
                e.state = 'dead'; e.timer = 0; e.coinLoot = this.corpseReward(e);
            }
            if (e.state === 'dead' && e.timer >= RULES.corpseSeconds) this.recoverBody(e, false);
        }
        s.enemies = s.enemies.filter(e => !e.returned&&(!['gone', 'sold'].includes(e.state) || e.timer < 2));
    }
    private updateCampaign(dt: number): void {
        const s = this.state;
        for (const c of s.camps) {
            if (c.hp <= 0 && !c.defeated && this.campRemaining(c)===0&&!s.fortifications!.some(f=>f.camp===c.index&&f.hp>0)) this.clearCamp(c);
            if (!c.defeated || c.claimed) continue;
            c.rebuild += dt;
            if (c.rebuild >= this.rebuildDuration(c)) {
                // 墙必须完工有效，投第一枚或施工虚影不构成巩固。
                const wall = s.buildings.find(b => b.kind === 'wall' && b.region === c.index && b.level && b.hp > 0);
                if (wall) { c.claimed = true; continue; }
                c.defeated = false; c.hp = c.maxHp; c.rebuild = 0; this.spawnGuards(c);
                this.effect('smoke', c.x, 1, 2); this.dirty = true;
            }
        }
        if (s.expedition.state === 'return' && (!s.drumCart || s.drumCart.abandoned) &&
            !s.goblins.some(n => !n.dead && n.order === 'return') &&
            !s.machines.some(m=>m.owner==='goblin'&&m.hp>0&&m.order==='return')) s.expedition.state = 'home';
        if (s.elapsed % 6 < dt) this.dirty = true;
    }
}
