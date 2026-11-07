import { BUILDINGS, RULES } from './Rules';
import type { Building, State } from './State';

export const CAVE_TOWER_REGION = -3;
export const TRADER_STOP = 560;
export const TRADER_CART_OFFSET = 170;
export const CAVE_PRISON_X = 410;
export const CAVE_FORGE_X = 846;
const CAVE_BUILDINGS: Record<string, number> = {
    treasury: 260, hall: 70, prison: CAVE_PRISON_X, gear: 896, forge: CAVE_FORGE_X, flag: 940,
};
export const REMOVED_STALLS = new Set(['goldMerchant', 'armyMerchant', 'mountMerchant']);

/** 原洞口塔保留等级、施工和稳定 ID，墙体按原耐久比例接续。 */
export function replaceCaveTower(s: State): void {
    const b = s.buildings.find(b => b.region === CAVE_TOWER_REGION && b.kind === 'tower');
    if (!b) return;
    const maxHp = BUILDINGS.wall.hp![b.level];
    b.hp = maxHp * Math.max(0, b.hp) / Math.max(1, b.maxHp);
    b.maxHp = maxHp;
    b.kind = 'wall';
    for (const n of s.goblins) {
        if (n.towerId !== b.id) continue;
        delete n.towerId;
        if (n.task === 'tower') n.task = '';
    }
}

/** 重排洞内据点，同时保留旧档建筑等级、施工进度和兵力。 */
export function upgradeBaseLayout(s: State): void {
    const revision = s.revision || 0;
    if (revision >= 20) return;
    // 恢复缴获装备原位，改造台移到旁边。保留旧档的建筑和投币。
    for (const b of s.buildings) {
        if (revision === 19 && (b.region !== -1 || (b.kind !== 'forge' && b.kind !== 'gear'))) continue;
        if (b.region === -1 && ['forge','gear','hall','treasury'].includes(b.kind)) b.x = CAVE_BUILDINGS[b.kind];
        if (b.kind === 'tower' && b.region !== CAVE_TOWER_REGION) {
            const wall = s.buildings.reduce<Building | undefined>((nearest,w) =>
                w.kind === 'wall' && w.region === b.region && w.x > b.x && (!nearest || w.x < nearest.x) ? w : nearest, undefined);
            if (wall) b.x = wall.x - RULES.towerWallGap;
        }
        if (s.pledge?.targetId === b.id && ['forge','gear','hall','treasury','tower'].includes(b.kind)) s.pledge.x = b.x;
    }
    if (revision >= 16) return;
    s.buildings = s.buildings.filter(b => !REMOVED_STALLS.has(b.kind));
    for (const b of s.buildings) {
        if (b.region !== -1 || (b.kind === 'flag' && b.level > 0)) continue;
        const x = CAVE_BUILDINGS[b.kind];
        if (x !== undefined) b.x = x;
    }
    if (revision < 14) {
        const hp = BUILDINGS.tower.hp![1];
        s.buildings.push({ id: s.nextId++, kind: 'tower', x: 1040, level: 1, hp, maxHp: hp,
            region: CAVE_TOWER_REGION, stock: 0, timer: 0 });
    }
    if (revision < 14 && s.elapsed === 0 && s.spent === 0 && s.raids === 0 && (s.goblins.length === 4 || s.goblins.length === 6)) {
        s.player.x = s.player.prevX = 0;
        const roles = ['worker', 'hunter', 'idle', 'idle', 'idle', 'idle'] as const;
        for (const [i, n] of s.goblins.entries()) {
            n.x = n.prevX = n.targetX = -145 + i * 85;
            n.role = roles[i];
            n.hp = n.maxHp = RULES.role[n.role].hp;
        }
    }
    // 已建木墙按原受损比例升级，倒塌的墙保留为废墟。
    for (const b of s.buildings) {
        if (b.kind !== 'wall' || b.level !== 1 || b.maxHp <= 0) continue;
        const maxHp = BUILDINGS.wall.hp![1];
        b.hp *= maxHp / b.maxHp;
        b.maxHp = maxHp;
    }
    const trader = s.trader;
    if (trader.phase === 'trading') trader.x = trader.prevX = TRADER_STOP;
    if (trader.phase === 'trading' || trader.phase === 'arriving') {
        const visitDay = s.day - ((s.day - RULES.traderFirstDay) % RULES.traderInterval + RULES.traderInterval) % RULES.traderInterval;
        if (visitDay >= RULES.traderFirstDay && (visitDay === s.day || s.time < RULES.traderDepartureAt)) {
            trader.visitDay = visitDay;
        } else {
            trader.present = false;
            trader.phase = trader.cargo?.length ? 'turning' : 'away';
            if (trader.phase === 'turning') trader.cartX = trader.x + TRADER_CART_OFFSET;
        }
    }
    for (const n of s.goblins) if (n.task === 'recover') n.task = '';
    if (!s.sold && !s.enemies.some(e => e.state === 'captured')) delete s.chapter?.seen.captive;
    s.revision = 16;
}
