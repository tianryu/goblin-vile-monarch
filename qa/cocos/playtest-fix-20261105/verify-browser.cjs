const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');

const preview = path.resolve(__dirname, '../../../cocos/build/playtest-fix-20261105');
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
    '.png': 'image/png', '.ogg': 'audio/ogg', '.ttf': 'font/ttf' };
const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://localhost');
    const file = path.resolve(preview, '.' + (url.pathname === '/' ? '/index.html' : decodeURIComponent(url.pathname)));
    if (!file.startsWith(preview + path.sep) || !fs.existsSync(file)) {
        res.writeHead(404).end();
        return;
    }
    res.setHeader('Content-Type', mime[path.extname(file)] ?? 'application/octet-stream');
    fs.createReadStream(file).pipe(res);
});

async function verify() {
    await new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen(0, '127.0.0.1', resolve);
    });
    const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--enable-gpu', '--use-angle=d3d11'] });
    try {
        const page = await browser.newPage({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true });
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        await page.addInitScript(() => { window.__MONARCH_QA__ = true; });
        await page.goto('http://127.0.0.1:' + server.address().port);
        await page.waitForFunction(() => !!window.__monarch);
        await page.evaluate(() => {
            const { model: m, view, menus } = __monarch;
            Object.assign(m.state.chapter.seen, { opening: true, expedition: true, trader: true, general: true });
            m.state.chapter.guidesSkipped = true;
            menus.close('continue');
            m.state.day = 6;
            m.state.time = 59;
            m.state.player.x = m.state.player.prevX = 2260;
            view.camera = 2260;
        });
        await page.waitForFunction(() => !__monarch.model.pauses.size && __monarch.controls.handlers.has('run'));
        const cdp = await page.context().newCDPSession(page);
        const point = (x, y, id) => ({ x, y, id });
        const touch = (type, touchPoints) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints });
        const snapshot = () => page.evaluate(() => {
            const { controls, model, view } = __monarch, canvas = document.querySelector('canvas');
            return {
                origin: controls.joystickOrigin, axis: controls.joystickAxis, run: model.input.run,
                dimensions: [visualViewport.scale, canvas.width, canvas.height, view.width, view.height],
            };
        });
        const run = await page.evaluate(() => {
            const { view } = __monarch;
            const node = view.painter.nodes.get('control:run@ui_action_ring');
            const rect = document.querySelector('canvas').getBoundingClientRect();
            return [rect.left + (node.node.position.x + view.width / 2) * rect.width / view.width,
                rect.top + (view.height / 2 - node.node.position.y - node.transform.height / 2) * rect.height / view.height];
        });
        await touch('touchStart', [point(122, 330, 1)]);
        await touch('touchMove', [point(167, 330, 1)]);
        await page.waitForFunction(() => __monarch.controls.joystickAxis > .5);
        const before = await snapshot();
        await touch('touchStart', [point(167, 330, 1), point(...run, 2)]);
        await page.waitForFunction(() => __monarch.model.input.run);
        const sprinting = await snapshot();
        await touch('touchMove', [point(85, 330, 1), point(...run, 2)]);
        await page.waitForFunction(() => __monarch.controls.joystickAxis < -.5);
        const reversed = await snapshot();
        await touch('touchEnd', []);
        await page.waitForFunction(() => !__monarch.controls.joystickOrigin && __monarch.controls.joystickAxis === 0);
        assert.deepEqual(sprinting.origin, before.origin);
        assert.deepEqual(reversed.origin, before.origin);
        assert.deepEqual(reversed.dimensions, before.dimensions);
        assert.equal(reversed.run, true);

        const layout = await page.evaluate(async () => {
            const { model, view } = __monarch, state = model.state;
            const wall = state.buildings.find(b => b.kind === 'wall' && b.region === -1);
            state.player.x = state.player.prevX = wall.x;
            const worker = model.makeGoblin('worker', wall.x - 8);
            worker.stunned = 7;
            state.goblins.push(worker);
            const wait = () => new Promise(requestAnimationFrame);
            const read = key => {
                const item = view.painter.nodes.get('control:' + key + '@ui_action_ring');
                return item ? [item.node.position.x, item.node.position.y] : null;
            };
            model.manualTarget = wall.id;
            for (let i = 0; i < 8; i++) await wait();
            const building = { coin: read('action0'), whip: read('action1') };
            model.manualTarget = worker.id;
            for (let i = 0; i < 20; i++) await wait();
            return { building, worker: { coin: read('action0'), whip: read('action1') } };
        });
        assert.ok(layout.building.coin && layout.building.whip);
        assert.deepEqual(layout.worker.whip, layout.building.whip);
        assert.equal(layout.worker.coin, null);

        const attack = await page.evaluate(async () => {
            const { model, view } = __monarch, state = model.state;
            const x = state.player.x;
            const e = model.makeEnemy('dwarf', x + 180, 0, undefined, { hero: 'heavy', sourceCamp: 0 });
            e.windup = { kind: 'slam', left: 1.2, total: 1.2, targetId: 0, targetX: x + 100, radius: 50 };
            const frames = new Set(), start = performance.now();
            while (performance.now() - start < 1900) {
                await new Promise(requestAnimationFrame);
                const shown = view.painter.nodes.get('enemy' + e.id + '@combat')?.sprite?.spriteFrame;
                for (let i = 0; i < 4; i++) if (shown && shown === view.art.frames.get('enemyPose:elite_heavy:' + i)) frames.add(i);
            }
            return [...frames];
        });
        assert.deepEqual(attack, [0, 1, 2, 3]);
        const saveRetry = await page.evaluate(async () => {
            const { model, view, platform } = __monarch;
            const game = view.root.parent.components.find(component => component.world === view);
            const realSave = platform.save;
            const realDirty = model.dirty;
            const started = performance.now(), attempts = [];
            platform.save = () => { attempts.push(performance.now() - started); return false; };
            try {
                model.dirty = true;
                game.saveClock = 2;
                await new Promise(resolve => setTimeout(resolve, 1100));
                return { attempts, stillDirty: model.dirty };
            } finally {
                platform.save = realSave;
                game.saveFailed = false;
                model.dirty = realDirty;
            }
        });
        assert.equal(saveRetry.attempts.length, 1);
        assert.equal(saveRetry.stillDirty, true);
        const performance = await page.evaluate(async () => {
            const { model, view } = __monarch, s = model.state;
            const wall = s.buildings.find(b => b.kind === 'wall' && b.region === -1);
            Object.assign(wall, { level: 2, hp: 9000, maxHp: 9000 });
            s.enemies = s.enemies.filter(e => Math.abs(e.x - wall.x) > 1800);
            s.goblins = [];
            for (let i = 0; i < 16; i++) {
                const n = model.makeGoblin(i % 3 ? 'hunter' : 'brute', wall.x - 35 - i * 20);
                n.hp = n.maxHp = 500;
                s.goblins.push(n);
            }
            for (let i = 0; i < 32; i++) {
                const e = model.makeEnemy(['human', 'dwarf', 'elf'][i % 3], wall.x + 70 + i * 16, 0, 999);
                e.hp = e.maxHp = 500;
            }
            const samples = [];
            for (const mode of ['straight', 'turns', 'revive-turns']) {
                if (mode === 'revive-turns') {
                    s.status = 'lost';
                    model.revive(true);
                }
                s.player.x = s.player.prevX = wall.x - 320;
                view.camera = s.player.x;
                const original = model.tick;
                let start = window.performance.now();
                model.tick = function (...args) {
                    const step = Math.floor((window.performance.now() - start) / (mode === 'straight' ? 1800 : 270));
                    this.input.axis = step % 2 ? -1 : 1;
                    return original.apply(this, args);
                };
                const intervals = [];
                try {
                    for (let i = 0; i < 20; i++) await new Promise(requestAnimationFrame);
                    start = window.performance.now();
                    let prev = start;
                    while (prev - start < 3500) {
                        const now = await new Promise(requestAnimationFrame);
                        intervals.push(now - prev);
                        prev = now;
                    }
                } finally {
                    model.tick = original;
                    model.input.axis = 0;
                }
                intervals.sort((a, b) => a - b);
                samples.push({ mode, frames: intervals.length, p95Ms: intervals[Math.floor(intervals.length * .95)],
                    maxMs: intervals.at(-1), framesOver50Ms: intervals.filter(ms => ms > 50).length });
            }
            return samples;
        });
        assert.deepEqual(errors, []);
        console.log(JSON.stringify({ before, sprinting, reversed, layout, attack, saveRetry, performance, errors }, null, 2));
    } finally {
        await browser.close();
    }
}

verify().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => server.close());
