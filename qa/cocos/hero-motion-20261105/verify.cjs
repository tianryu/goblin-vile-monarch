const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const serverSource = fs.readFileSync(path.resolve(__dirname, '../playtest-fix-20261105/verify-browser.cjs'), 'utf8')
    .split('async function verify()')[0].replace('cocos/build/playtest-fix-20261105', 'cocos/build/hero-motion-20261105');
const server = new Function('require', '__dirname', serverSource + '\nreturn server;')(require, __dirname);

async function verify() {
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--enable-gpu', '--use-angle=d3d11'] });
    try {
        const page = await browser.newPage({ viewport: { width: 1100, height: 520 }, hasTouch: true, isMobile: true });
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        await page.addInitScript(() => { window.__MONARCH_QA__ = true; });
        await page.goto('http://127.0.0.1:' + server.address().port);
        await page.waitForFunction(() => !!window.__monarch);
        page.setDefaultTimeout(6000);
        await page.evaluate(() => {
            const { model: m, menus, view } = __monarch;
            Object.assign(m.state.chapter.seen, { opening: true, expedition: true, trader: true, general: true });
            m.state.chapter.guidesSkipped = true;
            menus.close('continue');
            window.motionTick = m.tick.bind(m);
            m.tick = () => {};
            const s = m.state, x = 3500;
            window.motionSetup = (kind, hero, distance) => {
                Object.assign(s, { day: 12, time: 55, status: 'playing', enemies: [], goblins: [], effects: [], shots: [], machines: [], fortifications: [] });
                Object.assign(s.player, { x, prevX: x, hp: 100, hurt: 0 });
                view.camera = x + 100;
                for (const wall of s.buildings.filter(b => b.kind === 'wall')) wall.hp = 0;
                const e = m.makeEnemy(kind, x + distance, 0, 999, { hero, sourceCamp: 0 });
                e.spells = e.cooldown = 0;
                window.motionActor = e;
                m.rebuildEnemyCache();
                return e;
            };
            window.motionStep = n => {
                for (let i = 0; i < n; i++) {
                    for (const enemy of s.enemies) {
                        enemy.prevX = enemy.x;
                        enemy.moving = false;
                    }
                    s.elapsed += 1 / 30;
                    m.updateEnemies(1 / 30);
                    for (const f of s.effects) f.age += 1 / 30;
                    s.effects = s.effects.filter(f => f.age < f.life);
                }
            };
        });
        await page.waitForFunction(() => !__monarch.model.pauses.size);
        const step = n => page.evaluate(n => window.motionStep(n), n);
        const setup = (kind, hero, distance) => page.evaluate(args => { window.motionSetup(...args); }, [kind, hero, distance]);
        const frame = expected => page.waitForFunction(expected => {
            const { view } = __monarch, id = window.motionActor.id;
            const shown = view.painter.nodes.get('enemy' + id + '@combat');
            return shown?.sprite?.spriteFrame === view.art.frames.get(expected) && shown?.opacity.opacity === 255;
        }, expected);
        const shot = name => page.screenshot({ path: path.join(__dirname, name + '.jpg'), quality: 92 });
        const checks = [];

        for (const [hero, radius] of [['heavy', 70], ['siege_boss', 100]]) {
            await setup('dwarf', hero, 60);
            await step(7);
            await frame('enemyPose:elite_heavy:0');
            await step(13);
            await frame('enemyPose:elite_heavy:1');
            const warning = await page.evaluate(() => {
                const { view, model } = __monarch;
                const f = model.state.effects.find(f => f.kind === 'slamWarning');
                const d = view.painter.nodes.get('attackGround' + f.id + '@fxAttackCrack');
                return { x: f.x, size: f.size, width: d.transform.width, strong: !!f.strong,
                    centered: d.node.position.x === view.screen(f.x) - view.width / 2 };
            });
            assert.deepEqual(warning, { x: 3500, size: radius, width: radius * 2, strong: radius === 100, centered: true });
            if (hero === 'siege_boss') {
                await shot('siege-warning');
                await page.evaluate(() => { __monarch.model.state.time = 165; });
                await page.waitForTimeout(260);
                await shot('siege-warning-night');
            }
            await step(12);
            await frame('enemyPose:elite_heavy:2');
            await step(4);
            await frame('enemyPose:elite_heavy:3');
            assert.ok(await page.evaluate(() => __monarch.model.state.player.hp < 100));
            if (hero === 'siege_boss') {
                await page.waitForTimeout(150);
                await shot('siege-impact');
            }
            checks.push(hero);
        }

        for (const [hero, kind, actor] of [['charger', 'human', 'elite_charger'], ['fleet_boss', 'shield', 'fleet']]) {
            await setup(kind, hero, 235);
            await step(2);
            await frame('enemyPose:' + actor + ':0');
            await step(7);
            await frame('enemyPose:' + actor + ':1');
            await shot(hero + '-charge');
            let attacking = false;
            for (let i = 0; i < 36 && !attacking; i++) {
                await step(1);
                attacking = await page.evaluate(() => !!window.motionActor.strike);
            }
            assert.ok(attacking, hero + ' reaches a target');
            await step(7);
            await frame('enemyPose:' + actor + ':2');
            assert.ok(await page.evaluate(() => __monarch.model.state.player.hp < 100));
            checks.push(hero);
        }

        for (const hero of ['pyromancer', 'fire_boss']) {
            await setup('mage', hero, 230);
            await step(2);
            await frame('enemyPose:elite_pyromancer:0');
            await step(4);
            await frame('enemyPose:elite_pyromancer:1');
            assert.equal(await page.evaluate(() => __monarch.model.state.shots.length), 0);
            await shot(hero + '-cast');
            await step(7);
            await frame('enemyPose:elite_pyromancer:2');
            const release = await page.evaluate(() => {
                const { model, view } = __monarch;
                return {
                    projectile: model.state.shots[0].kind,
                    ground: model.state.effects.filter(e => e.kind === 'warning').map(e => ({
                        strong: e.strong, width: view.painter.nodes.get('attackGround' + e.id + '@fxAttackCrack').transform.width,
                    })),
                };
            });
            assert.deepEqual(release, { projectile: 'fireball', ground: Array(4)
                .fill({ strong: hero === 'fire_boss', width: 88 }) });
            if (hero === 'fire_boss') {
                await step(10);
                await page.waitForTimeout(230);
                await shot('meteor-warning');
            }
            checks.push(hero);
        }

        await setup('elf', 'longbow', 210);
        await page.evaluate(() => {
            const { model: m } = __monarch;
            for (const x of [3540, 3570]) {
                const n = m.makeGoblin('hunter', x);
                m.state.goblins.push(n);
            }
        });
        await step(6);
        await frame('enemyPose:elite_longbow:1');
        assert.equal(await page.evaluate(() => __monarch.model.state.shots.length), 0);
        await shot('longbow-draw');
        await step(4);
        await frame('enemyPose:elite_longbow:2');
        assert.deepEqual(await page.evaluate(() => __monarch.model.state.shots.map(s => s.kind)), ['arrow', 'arrow', 'arrow']);
        checks.push('longbow');

        await setup('shield', 'bulwark', 240);
        await page.waitForTimeout(230);
        const guard = await page.evaluate(() => {
            const { model: m } = __monarch;
            const warden = window.motionActor;
            const ally = m.makeEnemy('human', warden.x - 100, 0, 999);
            const hp = ally.hp;
            m.hitEnemy(ally, 16, 3490);
            return { id: ally.id, cut: hp - ally.hp, timed: warden.wardCastAt === ally.wardAt };
        });
        assert.ok(guard.timed && guard.cut > 0 && guard.cut < 16);
        await step(3);
        await page.waitForFunction(ally => {
            const nodes = __monarch.view.painter.nodes;
            return [ally, window.motionActor.id].every(id => nodes.get('enemyWard' + id + '@fxWard')?.opacity.opacity > 95);
        }, guard.id);
        await shot('bulwark-ward');
        checks.push('bulwark');

        await setup('dwarf', 'engineer', 225);
        await page.waitForTimeout(230);
        const repaired = await page.evaluate(() => {
            const { model: m } = __monarch;
            const fort = { id: 991, x: 3780, hp: 48, maxHp: 100, camp: 0, kind: 'gate' };
            const machine = { id: 992, x: 3910, prevX: 3910, hp: 80, maxHp: 100, owner: 'enemy', order: 'attack', kind: 'ram' };
            const full = { ...machine, id: 993, x: 3945, prevX: 3945, hp: 100 };
            m.state.fortifications.push(fort);
            m.state.machines.push(machine, full);
            window.motionStep(2);
            return { health: [fort.hp, machine.hp, full.hp], effects: m.state.effects.filter(e => e.kind === 'repairSpark').map(e => e.x) };
        });
        assert.deepEqual(repaired, { health: [62, 98, 100], effects: [3780, 3910] });
        await frame('enemyPose:elite_engineer:1');
        await shot('engineer-repair');
        await step(6);
        await frame('enemyPose:elite_engineer:2');
        checks.push('engineer');

        const effectsBudget = await page.evaluate(() => {
            const { model: m } = __monarch, s = m.state;
            s.goblins = [];
            s.enemies = [];
            s.effects = [];
            s.player.hurt = 0;
            s.machines = [];
            const marker = m.effect('warning', s.player.x + 43, 1.7, .8);
            marker.age = 1.65;
            marker.damage = 16;
            for (let i = 0; i < 130; i++) m.effect('hit', s.player.x + 1000, .5);
            const hp = s.player.hp;
            window.motionTick(1 / 30);
            const damage = hp - s.player.hp;
            const impact = s.effects.some(f => f.kind === 'slamImpact' && f.size === 44);
            const count = s.effects.length;
            window.motionTick(1 / 30);
            const singleHit = hp - s.player.hp === damage;
            s.player.hurt = 0;
            const outside = m.effect('warning', s.player.x + 45, 1.7, .8);
            outside.age = 1.65;
            window.motionTick(1 / 30);
            return { damage, impact, singleHit, count, outsideSafe: hp - s.player.hp === damage };
        });
        assert.deepEqual(effectsBudget, { damage: 16, impact: true, singleHit: true, count: 100, outsideSafe: true });
        assert.deepEqual(errors, []);
        console.log(JSON.stringify({ checks, effectsBudget, errors }, null, 2));
    } finally {
        await browser.close();
    }
}

verify().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => server.close());
