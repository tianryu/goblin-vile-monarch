/** 集中存放本轮可调初值，显示名称从稳定ID映射，不参与业务判断。 */
export type Role = 'idle' | 'worker' | 'hunter' | 'brute';
export type EnemyKind = 'human' | 'elf' | 'dwarf' | 'shield' | 'mage' | 'jumper';
export type MachineKind = 'ram' | 'catapult' | 'firecatapult';
export type Mount = 'boar' | 'lizard' | 'wolf' | 'bat';
export const RULES = {
    saveVersion: 9, daySeconds: 200, daylightSeconds: 120, raidAt: 128, purseLimit: 50, maxPopulation: 48,
    enemySortieStartDay: 2,
    traderFirstDay: 3, traderInterval: 2, traderMorningEnd: 35, traderDepartureAt: 108,
    starterWallDefense: 3, // 旧墙未接护甲，按普通士兵的 2 点防御作为基准上调一半。
    interactRange: 130, cancelRange: 164, constructionSeconds: 16, rebuildSeconds: 180, rebuildPerRegion: 60,
    worldMin: -420, worldMax: 30600, shoreX: 28400, recruitmentShortWindow: 120, recruitmentLongWindow: 600,
    corpseSeconds: 18, corpseCoinChance: 1, enemyCorpseCoinChance: 1, enemyCaptureChance: .25, returnHomeCooldown: 120, playerCoinRadius: 84,
    streamStart: 2410, streamSpacing: 2180, streamCount: 8,
    productionSeconds: 45, maxGarrisonActive: 16,
    patrolStart:22,patrolRecall:98,patrolRadius:600,patrolReach:1300,
    // 对应二至五阶墙的可见半宽加坐骑身位，不能只挡中心却让半头野猪穿进木桩。
    enemyWallClearance:[90,105,125,140],
    withdrawalSeconds: .14, coinSeconds: .18,
    drumCost: 3, drumRetreatCost: 3, drumBeats: 6, drumBeatSeconds: 60 / 130,
    rewardStaminaSeconds: 600,
    population: [0,15,20,26,36,48], hallFactor:[0,1,1.15,1.3,1.5,1.75],
    hallMove: [1,1,1.10,1.20,1.30,1.40], goblinFootSpeed: 1.2,
    prisonCapacity:[0,2,4,6,8,10], towerSlots:[0,1,1,2,2,3],towerRange:[0,80,115,150,190,230],
    towerHuntBonus:120,
    towerWallGap:56, towerCombatMinimum:400,
    towerRangeBonus:120, towerShotInterval:.62, towerArrowSpeed:1100,
    toolCapacity:[0,4,5,6,7,8],productionSlots:[0,1,1,2,2,3],
    productionYield:[0,1,1,2,2,3],mineYield:[0,2,2,3,3,4],
    productionCycle:[0,24,22,20,18,16],
    raidBase:[6,9,13,17,22],raidGrowth:[2,3,3,4,4],raidCap:[18,24,32,40,48],
    mount: {
        boar: { name: '獠牙野猪', speed: 250, stamina: 100 },
        lizard: { name: '洞穴巨蜥', speed: 280, stamina: 150 },
        wolf: { name: '疾风狼', speed: 330, stamina: 110 },
        bat: { name: '洞穴巨蝠', speed: 300, stamina: 120 },
    },
    role: {
        idle: { name: '爪牙', hp: 20, attack: 2, defense: 0, range: 24, speed: 70 },
        worker: { name: '苦工', hp: 22, attack: 2, defense: 0, range: 28, speed: 76 },
        hunter: { name: '猎手', hp: 22, attack: 5, defense: 1, range: 265, speed: 90 },
        brute: { name: '恶霸', hp: 45, attack: 8, defense: 2, range: 68, speed: 82 },
    },
    enemy: {
        human: { hp: 45, attack: 9, defense: 2, range: 42, speed: 104, value: 3 },
        elf: { hp: 36, attack: 7, defense: 1, range: 245, speed: 112, value: 4 },
        dwarf: { hp: 80, attack: 13, defense: 4, range: 45, speed: 82, value: 6 },
        shield: { hp: 100, attack: 9, defense: 6, range: 48, speed: 87, value: 7 },
        mage: { hp: 55, attack: 12, defense: 0, range: 330, speed: 90, value: 9 },
        jumper:{hp:36,attack:8,defense:1,range:39,speed:120,value:4},
    },
    camps: [
        { name: '斥候营地', x: 6500, hp: 135, width: 550, total: 15, heroes: [] as string[], guard: ['human', 'human', 'elf'], raid: ['human', 'human', 'human', 'elf'] },
        { name: '先锋营地', x: 12000, hp: 220, width: 1000, total: 24, heroes: ['heavy'], guard: ['human', 'elf', 'jumper'], raid: ['human', 'human', 'elf', 'jumper', 'dwarf'] },
        { name: '前军营地', x: 18500, hp: 330, width: 1500, total: 36, heroes: ['bulwark','longbow'], guard: ['shield', 'human', 'elf', 'dwarf','jumper'], raid: ['shield', 'human', 'elf', 'dwarf', 'jumper'] },
        { name: '中军大营', x: 26500, hp: 450, width: 2400, total: 48, heroes: ['engineer','siege_boss'], guard: ['shield', 'dwarf', 'elf', 'mage'], raid: ['shield', 'shield', 'jumper', 'mage', 'elf'] },
        { name: '运兵大船', x: 28500, hp: 650, width: 1400, total: 28, heroes: ['pyromancer','fleet_boss'], guard: ['shield', 'dwarf', 'mage', 'elf', 'mage'], raid: ['shield', 'jumper', 'mage', 'mage', 'elf', 'human'] },
    ],
    equipmentBonus: [0, .25, .50, .80], equipmentPrice: [0, 12, 20, 30],
};
/** 英雄只配置角色和能力，资源与战斗结算仍走统一模型。 */
export const HEROES: Record<string,{name:string;kind:EnemyKind;hp:number;attack:number;defense:number;height:number;asset:string;boss?:boolean;skill:'slam'|'armor'|'volley'|'ward'|'engineer'|'meteor'|'charge'}>={
 heavy:{name:'重锤巨兵',kind:'dwarf',hp:180,attack:18,defense:4,height:102,asset:'elite_heavy',skill:'slam'},
 longbow:{name:'精锐长弓卫',kind:'elf',hp:110,attack:13,defense:2,height:88,asset:'elite_longbow',skill:'volley'},
 bulwark:{name:'圣盾重卫',kind:'shield',hp:260,attack:14,defense:7,height:104,asset:'elite_bulwark',skill:'ward'},
 engineer:{name:'攻城工头',kind:'dwarf',hp:160,attack:13,defense:4,height:94,asset:'elite_engineer',skill:'engineer'},
 pyromancer:{name:'火焰大师',kind:'mage',hp:130,attack:17,defense:1,height:100,asset:'elite_pyromancer',skill:'meteor'},
 charger:{name:'重枪突击手',kind:'human',hp:180,attack:20,defense:4,height:100,asset:'elite_charger',skill:'charge'},
 siege_boss:{name:'破城督军',kind:'dwarf',hp:550,attack:25,defense:8,height:140,asset:'elite_heavy',boss:true,skill:'slam'},
 fire_boss:{name:'焚林导师',kind:'mage',hp:450,attack:23,defense:3,height:132,asset:'elite_pyromancer',boss:true,skill:'meteor'},
 fleet_boss:{name:'舰队统帅',kind:'shield',hp:650,attack:25,defense:8,height:145,asset:'elite_bulwark',boss:true,skill:'charge'},
};
export const BUILDINGS: Record<string, {
    name: string; description: string; costs: number[]; maxLevel: number; hall: number; hp?: number[];
}> = {
    hall: { name: '哥布林主厅', description: '壮大部落，开放新建筑', costs: [0, 26, 26, 34,42], maxLevel: 5, hall: 1, hp: [0, 220, 370, 560,800,1100] },
    treasury: { name: '部落钱箱', description: '取出储藏的金币', costs: [0], maxLevel: 1, hall: 1 },
    prison: { name: '监牢', description: '关押活口，等待人类商人', costs: [5, 12, 18,26,36], maxLevel: 5, hall: 1, hp: [0, 100, 170, 250,350,480] },
    worker: { name: '苦工工具摊', description: '投币摆上木锤，爪牙领取', costs: [2,8,12,18,26], maxLevel: 5, hall: 1 },
    hunter: { name: '猎手工具摊', description: '投币摆上弓箭，爪牙领取', costs: [3,10,14,20,28], maxLevel: 5, hall: 1 },
    brute: { name: '恶霸工具摊', description: '投币摆上盾斧，爪牙领取', costs: [5,12,16,22,30], maxLevel: 5, hall: 1 },
    lure: { name: '招募钱盘', description: '摆上金币，吸引无主哥布林', costs: [4,8,14,22,32], maxLevel: 5, hall: 1 },
    wall: { name: '尖桩城墙', description: '筑墙巩固领地，阻挡联军', costs: [6,12,20,30,42], maxLevel: 5, hall: 1, hp: [0,120,170,340,600,940] },
    tower: { name: '猎手箭台', description: '驻守猎手，压制前线', costs: [5,10,18,28,38], maxLevel: 5, hall: 1, hp: [0,90,170,260,370,510] },
    net: { name: '绊索吊网', description: '困住前排，方便捕俘', costs: [5,11,17,25,35], maxLevel: 5, hall: 2, hp: [0,80,140,210,300,410] },
    rock: { name: '落石架', description: '重创盾阵与重甲步兵', costs: [7,14,21,29,40], maxLevel: 5, hall: 2, hp: [0,100,160,240,340,460] },
    farm: { name: '蘑菇田', description: '苦工照看，持续生产金币', costs: [5,10,17,25,34], maxLevel: 5, hall: 1 },
    wood: { name: '伐木营', description: '苦工开工，产出金币', costs: [7,12,19,27,37], maxLevel: 5, hall: 2 },
    mine: { name: '金币矿', description: '苦工开采，获得更多金币', costs: [9,16,24,33,44], maxLevel: 5, hall: 2 },
    forge: { name: '装备改造台', description: '改造缴获装备，强化猎手和恶霸', costs: [7, 18, 32], maxLevel: 3, hall: 1 },
    gear: { name: '缴获装备', description: '收集敌装，供改造台使用', costs: [0], maxLevel: 1, hall: 1 },
    repair: { name: '修械场', description: '修复缴获的攻城器械', costs: [8,18,25,34,44], maxLevel: 5, hall: 2 },
    flag: { name: '出征战鼓', description: '敲鼓召集猎手和恶霸，跟随首领', costs: [3], maxLevel: 1, hall: 2 },
    goldMerchant: { name: '金币商人', description: '观看广告，领取金币', costs: [0], maxLevel: 1, hall: 1 },
    armyMerchant: { name: '援军商人', description: '观看广告，选择两名援军', costs: [0], maxLevel: 1, hall: 1 },
    mountMerchant: { name: '坐骑商人', description: '更换坐骑，解锁新的伙伴', costs: [0], maxLevel: 1, hall: 1 },
};
export const clamp = (v: number, a: number, b: number): number => Math.max(a, Math.min(b, v));

/** 昼夜各占半个天象周期，夜晚加速完成月升月落，真实工时按游戏秒计。 */
export function skyTime(time: number): number {
    return time < RULES.daylightSeconds ? time :
        RULES.daylightSeconds + (time - RULES.daylightSeconds) * 120 / (RULES.daySeconds - RULES.daylightSeconds);
}
