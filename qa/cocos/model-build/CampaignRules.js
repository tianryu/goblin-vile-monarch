"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.raidPlan = exports.guardSpecs = exports.expandRoster = exports.unitSpec = exports.guardCapacity = exports.FORTS = exports.OPENING_FIELD = exports.GUARD_ROSTERS = exports.raidCount = exports.enemyFactor = void 0;
const Rules_1 = require("./Rules");
/** 战役强度唯一入口，参数只有全局天数，不接受营地或主厅进度。 */
function enemyFactor(day) { return 1 + .05 * Math.min(20, Math.floor(Math.max(1, day) / 5)); }
exports.enemyFactor = enemyFactor;
function raidCount(day) { return Math.min(80, 6 + 2 * Math.min(Math.max(0, day - 1), 19) + 3 * Math.max(0, day - 20)); }
exports.raidCount = raidCount;
exports.GUARD_ROSTERS = [
    { human: 9, elf: 6 }, { human: 12, elf: 8, jumper: 6, dwarf: 3, heavy: 1 },
    { shield: 16, elf: 14, dwarf: 14, jumper: 4, bulwark: 1, longbow: 1 },
    { shield: 22, dwarf: 18, elf: 16, mage: 12, engineer: 1, siege_boss: 1 },
    { shield: 10, dwarf: 4, mage: 6, elf: 8, pyromancer: 1, fleet_boss: 1 }
];
exports.OPENING_FIELD = [{ human: 8, elf: 4 }, { human: 8, elf: 6, jumper: 4, dwarf: 2 }, { shield: 12, elf: 8, dwarf: 6, jumper: 4 }, { shield: 14, mage: 10, elf: 8, dwarf: 4, jumper: 4 }, { shield: 6, mage: 6, dwarf: 3, jumper: 3, elf: 2 }];
exports.FORTS = [{ walls: 0, levels: [] }, { walls: 0, levels: [] }, { walls: 1, levels: [1, 1] }, { walls: 3, levels: [3, 2, 2] }, { walls: 2, levels: [2, 2, 2, 2] }];
function guardCapacity(index, day) { return Math.ceil(Rules_1.RULES.camps[index].total * (1 + Math.min(.5, .05 * Math.floor(day / 10)))); }
exports.guardCapacity = guardCapacity;
function unitSpec(key) { return Rules_1.HEROES[key] ? { kind: Rules_1.HEROES[key].kind, hero: key } : { kind: key }; }
exports.unitSpec = unitSpec;
function expandRoster(roster) { const out = []; for (const key of Object.keys(roster))
    for (let i = 0; i < roster[key]; i++)
        out.push(unitSpec(key)); return out; }
exports.expandRoster = expandRoster;
/** 塔手和驻营精锐先就位，其余按职业交错，避免十六名盾兵堵住全部活跃位。 */
function guardSpecs(index) {
    const all = expandRoster(exports.GUARD_ROSTERS[index]), out = [];
    for (let i = 0; i < exports.FORTS[index].levels.reduce((a, b) => a + b, 0); i++) {
        const n = all.findIndex(u => u.kind === 'elf' && !u.hero);
        if (n >= 0)
            out.push(all.splice(n, 1)[0]);
    }
    for (let i = all.length - 1; i >= 0; i--)
        if (all[i].hero)
            out.push(all.splice(i, 1)[0]);
    const kinds = ['shield', 'human', 'dwarf', 'elf', 'mage', 'jumper'];
    while (all.length)
        for (const kind of kinds) {
            const n = all.findIndex(u => u.kind === kind);
            if (n >= 0)
                out.push(all.splice(n, 1)[0]);
        }
    return out;
}
exports.guardSpecs = guardSpecs;
/** 整数配额使用最大余数法；精锐占人头，不在普通兵预算外加人。 */
function raidPlan(day) {
    const count = raidCount(day), budget = Math.min(count, Math.floor(day / 5));
    const weights = day >= 30 ? { shield: 30, mage: 30, dwarf: 15, jumper: 15, elf: 10 } : day >= 20 ? { shield: 35, mage: 25, elf: 20, dwarf: 10, jumper: 10 } : day >= 10 ? { shield: 40, elf: 25, dwarf: 20, jumper: 15 } : day >= 5 ? { human: 40, elf: 30, jumper: 20, dwarf: 10 } : { human: 70, elf: 30 };
    const choices = day >= 20 ? ['heavy', 'longbow', 'bulwark', 'charger', 'engineer', 'pyromancer'] : day >= 15 ? ['heavy', 'longbow', 'bulwark', 'charger', 'engineer'] : day >= 10 ? ['heavy', 'longbow', 'bulwark', 'charger'] : ['heavy'];
    const strong = [];
    let slots = budget;
    if (day >= 20 && slots >= 2) {
        strong.push(unitSpec(day >= 25 && day % 2 ? 'fire_boss' : 'siege_boss'));
        slots -= 2;
    }
    for (let i = 0; i < slots; i++)
        strong.push(unitSpec(choices[(Math.floor(day / 5) - 1 + i) % choices.length]));
    const ordinary = count - strong.length, quotas = Object.keys(weights).map((key, i) => ({ key, i, n: Math.floor(ordinary * weights[key] / 100), fraction: ordinary * weights[key] / 100 % 1 }));
    let missing = ordinary - quotas.reduce((a, b) => a + b.n, 0);
    for (const q of quotas.slice().sort((a, b) => b.fraction - a.fraction || a.i - b.i)) {
        if (missing-- > 0)
            q.n++;
    }
    const normal = [];
    while (quotas.some(q => q.n > 0))
        for (const q of quotas)
            if (q.n-- > 0)
                normal.push(unitSpec(q.key));
    // 按固定间距插入，保证强力队不会全部挤在首批。
    const spread = [];
    let k = 0;
    for (let i = 0; i < count; i++)
        spread.push(k < strong.length && i === Math.floor(k * count / strong.length) ? strong[k++] : normal.shift());
    const engines = day >= 30 ? ['firecatapult', 'catapult'] : day >= 20 ? ['firecatapult'] : day >= 15 ? ['catapult'] : day >= 10 ? ['ram'] : [];
    return { day, units: spread, engines, eliteBudget: budget };
}
exports.raidPlan = raidPlan;
