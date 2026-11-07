"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.upgradeCampaign = void 0;
const Rules_1 = require("./Rules");
/** 长地图迁移保留财富、伤亡和占领，弹道和运输目的地按同一区间映射。 */
function upgradeCampaign(s, alreadyMapped = false) {
    if ((s.revision || 0) >= 12)
        return;
    const old = [2500, 5200, 9200, 14200, 20700, 22400, 23100], fresh = [2500, ...Rules_1.RULES.camps.map(c => c.x), Rules_1.RULES.worldMax];
    const map = (x) => { if (x <= 2500 || alreadyMapped)
        return x; for (let i = 1; i < old.length; i++)
        if (x <= old[i])
            return fresh[i - 1] + (x - old[i - 1]) / (old[i] - old[i - 1]) * (fresh[i] - fresh[i - 1]); return Math.min(Rules_1.RULES.worldMax, x); };
    s.player.x = map(s.player.x);
    for (const n of s.goblins) {
        n.x = map(n.x);
        n.targetX = map(n.targetX);
        if (n.recoverX !== undefined)
            n.recoverX = map(n.recoverX);
    }
    for (const e of s.enemies) {
        e.x = map(e.x);
        if (e.windup)
            e.windup.targetX = map(e.windup.targetX);
        if (e.jump) {
            e.jump.from = map(e.jump.from);
            e.jump.to = map(e.jump.to);
        }
    }
    for (const m of s.machines)
        m.x = map(m.x);
    for (const b of s.buildings)
        b.x = map(b.x);
    for (const c of s.coins)
        c.x = map(c.x);
    for (const c of s.gearDrops || [])
        c.x = map(c.x);
    for (const f of s.effects)
        f.x = map(f.x);
    for (const a of s.animals) {
        a.x = map(a.x);
        a.home = map(a.home);
    }
    for (const shot of s.shots) {
        shot.x = map(shot.x);
        shot.fromX = map(shot.fromX);
        shot.targetX = map(shot.targetX);
    }
    if (s.pledge)
        s.pledge.x = map(s.pledge.x);
    for (const c of s.camps)
        c.x = Rules_1.RULES.camps[c.index].x;
    for (const c of s.companies)
        if (c.launchX !== undefined)
            c.launchX = map(c.launchX);
    for (const f of s.fortifications || [])
        f.x = map(f.x);
    s.revision = 12;
}
exports.upgradeCampaign = upgradeCampaign;
