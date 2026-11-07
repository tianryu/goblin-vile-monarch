import { Role, EnemyKind, MachineKind, Mount } from './Rules';
import {Soldier} from './CampaignRules';
export interface Job { left: number; total: number; next: number; repair?: boolean }
export interface Building { id: number; kind: string; x: number; level: number; hp: number; maxHp: number; region: number; stock: number; timer: number; job?: Job; discovered?: boolean }
export interface Goblin {
    id: number; role: Role; x: number; prevX: number; face: number; hp: number; maxHp: number;
    cooldown: number; timer: number; targetX: number; moving: boolean; speed: number; carry: number; hidden: number;
    lastWhip: number; hit: number; stunned: number; strikes: number; strikeAt: number; gear: number; loot: number;
    order: 'home' | 'gather' | 'expedition' | 'return'; task: string; targetId: number; dead: boolean; towerId?: number;
    workAt?: number; workTime?: number; depositedDay?: number;
    working?:boolean;roamX?:number;roamWait?:number;
    retreat?: { x: number; until: number }; pressureSince?: number; ralliedUntil?: number;
    formationRank?:number;attackAt?:number;combatTarget?:number;targetUntil?:number;thinkAt?:number;evadeX?:number;evadeUntil?:number;
    restGoal?: number; coinLoot?: number;
}
export interface Enemy {
    id: number; kind: EnemyKind; x: number; prevX: number; face: number; hp: number; maxHp: number; cooldown: number;
    company: number; camp: number; state: 'active' | 'wounded' | 'dead' | 'bound' | 'captured' | 'escaping' | 'sold' | 'gone';
    timer: number; moving: boolean; hit: number; stripped: boolean; counted: boolean; hauler: number; prisonSlot: number; snared: number; spells: number; ammo: number; atPrison: boolean;
    hero?: string; boostedUntil?: number; aiClock?: number; bodyHeight?:number;meleeTarget?:number;
    windup?:{left:number;total:number;targetId:number;targetX:number;kind:'slam'|'jump';radius?:number};
    jump?:{left:number;total:number;from:number;to:number};
    force?:'guard'|'field';scale?:number;towerId?:number;sourceCamp?:number;returned?:boolean;
    patrol?:boolean;roamX?:number;patrolReturn?:boolean;fleeUntil?:number;fleeFrom?:number;
    attackAt?:number;combatTarget?:number;targetUntil?:number;staggerUntil?:number;staggerReadyAt?:number;
    attackStyle?: import('./EnemyAttack').AttackStyle;
    strike?: import('./EnemyAttack').EnemyStrike;
    repairAt?: number; repairX?: number;
    wardAt?: number; wardCastAt?: number;
    saleValue?: number; coinLoot?: number;
    restGoal?: number;
}
export interface Camp { id: number; index: number; x: number; hp: number; maxHp: number; defeated: boolean; claimed: boolean; rewarded: boolean; rebuild: number; reserve?: EnemyKind[]; heroesPending?: string[]; reinforcementClock?: number; frontierSince?:number;guardQueue?:Soldier[];fieldLosses?:number;lastReinforcedDay?:number }
export interface Fortification { id: number; camp: number; kind: 'gate'|'tower'; x: number; hp: number; maxHp: number; cooldown: number;levels?:number;rank?:number }
export interface GearDrop { id: number; x: number; amount: number; age: number }
export interface DrumCart { x: number; prevX: number; face: number; travel: number; marchAt?: number; abandoned?: boolean }
export interface Company { id: number; initial: number; lost: number; retreating: boolean; camp: number; spawnedAt: number; pending?:{kind:EnemyKind;hero?:string;id?:number;sourceCamp?:number;hpRatio?:number}[];launchX?:number;launchClock?:number;withdrawn?:number;eliteBudget?:number;day?:number }
export interface Machine { id: number; kind: MachineKind; x: number; prevX: number; hp: number; maxHp: number; owner: 'enemy' | 'abandoned' | 'goblin'; company: number; crew: number[]; order: 'attack' | 'park' | 'gather' | 'expedition' | 'return' | 'reserve'; cooldown: number; moving: boolean;scale?:number }
export interface Coin { id: number; x: number; value: number; age: number }
export interface Animal { id: number; kind: 'rabbit' | 'deer'; x: number; home: number; hp: number; face: number; moving: boolean; timer: number }
export interface Shot { id: number; kind: 'arrow' | 'stone' | 'fire' | 'fireball'; fromX: number; x: number; targetX: number; targetId: number; friendly: boolean; damage: number; age: number; duration: number; hit: boolean; fromY: number; targetY?: number; tracking?: boolean }
export interface Effect { id: number; kind: 'hit' | 'coin' | 'smoke' | 'fire' | 'warning' | 'star' | 'heart' | 'slamWarning' | 'slamImpact' | 'repairSpark'; x: number; age: number; life: number; size: number; fired?: boolean; nextTick?: number;damage?:number;tickDamage?:number;strong?:boolean }
export interface Action { key: string; targetId: number; type: string; cost: number; icon: string; variant?: string; disabled?: boolean }
export interface Context { id: number; kind: string; x: number; name: string; description: string; actions: Action[]; level?: number; amount?: number }
export interface State {
    mountTrader?: import('./MountTrader').MountVisit;
    chapter?: import('./ChapterProgress').ChapterProgress;
    version: number; revision?: number; seed: number; nextId: number; elapsed: number; time: number; day: number; status: 'playing' | 'won' | 'lost';
    gold: number; treasury: number; gearStock: number; equipmentStock: number; populationPending: Record<string, number>;
    player: { x: number; prevX: number; face: number; hp: number; stamina: number; mount: Mount; fly: number; hurt: number; whip: number; exhausted?: boolean;attackCooldown?:number; reviveUntil?: number };
    goblins: Goblin[]; enemies: Enemy[]; camps: Camp[]; companies: Company[]; machines: Machine[];
    buildings: Building[]; coins: Coin[]; animals: Animal[]; shots: Shot[]; effects: Effect[]; gearDrops?: GearDrop[]; fortifications?: Fortification[];
    recruitment?: { start: number; limit: number; count: number; next: number; recent?: number[] }; raidsWaiting?:number[];patrolDays?:number[];
    returnHomeAt?: number; truceUntil?: number;
    raidPrep?:{day:number;units:Soldier[];engines:number[];eliteBudget:number};
    defenseBreach?: { x: number; until: number };
    army?:{reserve:Soldier[];initial:number;recruited:number;lost:number;recovered:number;retired:number;transferred:number;returned:number;guardInitial:number;guardRecruited:number;guardLost:number;guardRecovered:number;guardTransferred:number;enginesBuilt:number};
    pledge: { key: string; targetId: number; action: Action; paid: number; x: number } | null;
    expedition: { state: 'home' | 'gather' | 'march' | 'assault' | 'hold' | 'return'; camp: number;
        drummer?: number; puller?: number; beats?: number; beatAt?: number };
    drumCart?: DrumCart;
    unlockedMounts: Mount[]; mountBoost: Record<string, number>; adReceipts: string[];
    infiniteStaminaUntil?: number;
    trader: { x: number; present: boolean; visitDay?: number; phase?: 'away'|'arriving'|'trading'|'turning'|'leaving'; prevX?: number; cartX?: number; cargo?:{id:number;kind:EnemyKind;hero?:string;height:number}[] }; raids: number; kills: number; sold: number; spent: number; battleCoinProgress?:number;
}
