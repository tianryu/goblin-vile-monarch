const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const assert = require('node:assert/strict');
const build = path.resolve(process.argv[2] || 'cocos/build/hero-motion-20261105');
const label = process.argv[3] || 'before';
const output = path.join(__dirname, label);
fs.mkdirSync(output, { recursive: true });
const mime = { '.html': 'text/html', '.js': 'application/javascript', '.json': 'application/json',
    '.css': 'text/css', '.png': 'image/png', '.ogg': 'audio/ogg', '.ttf': 'font/ttf' };
const server = http.createServer((req, res) => {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const file = path.resolve(build, '.' + (pathname === '/' ? '/index.html' : pathname));
    if (!file.startsWith(build + path.sep) || !fs.existsSync(file)) return res.writeHead(404).end();
    res.setHeader('Content-Type', mime[path.extname(file)] || 'application/octet-stream');
    fs.createReadStream(file).pipe(res);
});

async function main() {
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const browser = await chromium.launch({ channel: 'msedge', headless: true,
        args: ['--use-angle=d3d11', '--enable-precise-memory-info'] });
    const report = { build, label, fixture: true, realPhone: false, errors: [], failures: [], scenes: [] };
    try {
        const page = await browser.newPage({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 2,
            hasTouch: true, isMobile: true });
        page.on('pageerror', e => report.errors.push(e.message));
        page.on('requestfailed', req => report.failures.push({ url: req.url(), error: req.failure()?.errorText }));
        await page.addInitScript(() => { globalThis.__MONARCH_QA__ = true; });
        await page.goto('http://127.0.0.1:' + server.address().port);
        await page.waitForFunction(() => !!window.__monarch, null, { timeout: 60000 });
        await page.evaluate(async () => {
            window.perfCC = await System.import('cc');
            const { model: m, menus } = __monarch;
            Object.assign(m.state.chapter.seen, { opening: true, expedition: true, trader: true, general: true });
            m.state.chapter.guidesSkipped = true;
            menus.close('continue');
        });
        await page.waitForFunction(() => !__monarch.model.pauses.size);
        const cdp = await page.context().newCDPSession(page);
        await cdp.send('Performance.enable');
        await cdp.send('Profiler.enable');
        const cpuRate = Number(process.env.CPU_RATE || 1);
        await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpuRate });
        report.environment = await page.evaluate(() => {
            const cc = window.perfCC, device = cc.director.root.device;
            return { renderer: device.renderer, vendor: device.vendor, agent: navigator.userAgent,
                canvas: [document.querySelector('canvas').width, document.querySelector('canvas').height],
                frameRate: cc.game.frameRate };
        });
        report.environment.cpuRate = cpuRate;
        const scenes = [['opening', 12], ['opening-turns', 25], ['day6-turns', 25], ['day30-dense', 30],
            ['revived-dense-turns', 25], ['focus-cycles', 55]];
        const selected = (process.env.SCENES || 'opening,day6-turns,day30-dense,revived-dense-turns,focus-cycles').split(',');
        for (const [name, seconds] of scenes.filter(([name]) => selected.includes(name))) {
            await page.evaluate(name => {
                const { model: m, view: v, controls } = __monarch;
                controls.release();
                m.restart();
                const s = m.state;
                Object.assign(s.chapter.seen, { opening: true, expedition: true, trader: true, general: true });
                s.chapter.guidesSkipped = true;
                m.pauses.clear();
                const wall = s.buildings.find(b => b.kind === 'wall' && b.region === -1);
                window.perfMotion = undefined;
                s.seed = 731;
                s.time = 55;
                if (name === 'opening-turns') window.perfMotion = 'turn';
                if (name !== 'opening' && name !== 'opening-turns') {
                    s.day = name === 'day6-turns' ? 6 : 30;
                    m.hall.level = name === 'day6-turns' ? 2 : 5;
                    Object.assign(wall, { level: 3, hp: 100000, maxHp: 100000 });
                    s.enemies = [];
                    s.goblins = [];
                    for (const camp of s.camps) camp.guardQueue = [];
                    s.companies = [];
                    s.machines = [];
                    s.fortifications = [];
                    s.player.x = s.player.prevX = wall.x - 270;
                    s.player.hp = 100000;
                    if (name === 'focus-cycles') {
                        for (let i = 0; i < 12; i++) {
                            const n = m.makeGoblin(['idle', 'worker', 'hunter', 'brute'][i % 4], wall.x - 260 + i * 200);
                            n.gear = Math.floor(i / 4);
                            n.stunned = 100;
                            s.goblins.push(n);
                        }
                        window.perfMotion = 'focus';
                    } else {
                        s.time = 145;
                        for (let i = 0; i < (name === 'day6-turns' ? 15 : 24); i++) {
                            const n = m.makeGoblin(i % 3 === 0 ? 'brute' : 'hunter', wall.x - 35 - i * 12);
                            n.hp = n.maxHp = 100000;
                            n.gear = 2;
                            s.goblins.push(n);
                        }
                        const heroes = { 0: ['dwarf', 'heavy'], 7: ['mage', 'pyromancer'],
                            14: ['shield', 'bulwark'], 21: ['elf', 'longbow'], 28: ['human', 'charger'] };
                        for (let i = 0; i < (name === 'day6-turns' ? 10 : 96); i++) {
                            const [kind, hero] = heroes[i] || [['human', 'shield', 'elf', 'mage', 'jumper', 'dwarf'][i % 6]];
                            const e = m.makeEnemy(kind, wall.x + 70 + i * 5, 0, 999, { hero, sourceCamp: 0 });
                            e.hp = e.maxHp = 100000;
                        }
                        window.perfMotion = name.includes('turns') ? 'turn' : undefined;
                    }
                    m.rebuildEnemyCache();
                    if (name === 'revived-dense-turns') {
                        const enemies = s.enemies.map(e => ({ ...e })), goblins = s.goblins.map(n => ({ ...n }));
                        s.status = 'lost';
                        m.revive(true);
                        s.enemies = enemies;
                        s.goblins = goblins;
                        s.player.x = s.player.prevX = wall.x - 270;
                        s.player.hp = 100000;
                        m.rebuildEnemyCache();
                    }
                }
                m.dirty = false;
                v.camera = s.player.x;
                window.perfStart = performance.now();
                window.perfPlayerStart = s.player.x;
                if (window.perfRawTick) m.tick = window.perfRawTick;
                window.perfRawTick = m.tick;
                const actual = m.tick;
                m.tick = function(dt) {
                    const t = (performance.now() - window.perfStart) / 1000;
                    this.input.axis = window.perfMotion === 'turn' ? (Math.floor(t * 3.5) % 2 ? 1 : -1) : 0;
                    if (window.perfMotion === 'focus') {
                        const n = this.state.goblins[Math.floor(t / 2.5) % this.state.goblins.length];
                        this.state.player.x = this.state.player.prevX = n.x - 38;
                        this.manualTarget = n.id;
                    }
                    actual.call(this, dt);
                };
            }, name);
            await page.waitForTimeout(1200);
            await cdp.send('HeapProfiler.collectGarbage');
            const before = await cdp.send('Performance.getMetrics');
            await cdp.send('Profiler.setSamplingInterval', { interval: 1000 });
            await cdp.send('Profiler.start');
            const result = await page.evaluate(async seconds => {
                const { model: m, view: v, platform } = __monarch;
                const cc = window.perfCC, device = cc.director.root.device;
                const stats = {}, rawMethods = [], intervals = [], gameIntervals = [], draws = [], samples = [];
                let lastRender = performance.now();
                const wrap = (object, key, name) => {
                    const raw = object[key];
                    rawMethods.push([object, key, raw]);
                    stats[name] = [];
                    object[key] = function(...args) {
                        const start = performance.now();
                        if (name === 'render') { gameIntervals.push(start - lastRender); lastRender = start; }
                        const value = raw.apply(this, args);
                        stats[name].push(performance.now() - start);
                        return value;
                    };
                };
                wrap(m, 'tick', 'tick');
                wrap(v, 'render', 'render');
                wrap(v.painter, 'end', 'painterEnd');
                wrap(platform, 'save', 'save');
                for (const key of ['updateGoblins', 'updateEnemies', 'context', 'updatePrison']) wrap(m, key, key);
                for (const key of ['environment', 'goblins', 'enemies', 'procedural', 'hud']) wrap(v, key, key);
                const snapshot = () => {
                    const textures = new Set([...v.art.frames.values()].map(f => f.texture));
                    return { heap: performance.memory?.usedJSHeapSize, nodes: v.painter.nodes.size,
                        sceneNodes: cc.director.getScene().children.reduce((total, child) => {
                            const walk = n => 1 + n.children.reduce((count, c) => count + walk(c), 0);
                            return total + walk(child);
                        }, 1), frames: v.art.frames.size, textures: textures.size,
                        rgbaBytes: [...textures].reduce((sum, t) => sum + t.width * t.height * 4, 0),
                        engineMemory: { ...device.memoryStatus }, focus: v.art.focusUse.size,
                        glow: v.art.glowUse.size, enemies: m.state.enemies.length,
                        active: m.state.enemies.filter(e => e.state === 'active').length,
                        effects: m.state.effects.length, shots: m.state.shots.length };
                };
                const start = performance.now();
                let prev = start, lastSample = start;
                await new Promise(resolve => {
                    const sample = now => {
                        intervals.push(now - prev); prev = now;
                        draws.push(device.numDrawCalls);
                        if (now - lastSample > 2000) { samples.push({ t: now - start, ...snapshot() }); lastSample = now; }
                        if (now - start < seconds * 1000) requestAnimationFrame(sample);
                        else resolve();
                    };
                    requestAnimationFrame(sample);
                });
                const end = snapshot();
                for (const [object, key, raw] of rawMethods.reverse()) object[key] = raw;
                const summary = values => {
                    const sorted = values.slice().sort((a, b) => a - b);
                    return { count: values.length, sum: values.reduce((sum, x) => sum + x, 0),
                        p50: sorted[Math.floor(sorted.length * .5)] || 0,
                        p95: sorted[Math.floor(sorted.length * .95)] || 0, max: sorted[sorted.length - 1] || 0 };
                };
                return { wallMs: performance.now() - start, intervals: summary(intervals),
                    gameIntervals: summary(gameIntervals),
                    gameOver50ms: gameIntervals.filter(x => x > 50).length,
                    over50ms: intervals.filter(x => x > 50).length, over100ms: intervals.filter(x => x > 100).length,
                    drawCalls: summary(draws), timings: Object.fromEntries(Object.entries(stats).map(([k, a]) => [k, summary(a)])),
                    end, samples, playing: m.state.status };
            }, seconds);
            const { profile } = await cdp.send('Profiler.stop');
            fs.writeFileSync(path.join(output, name + '.cpuprofile'), JSON.stringify(profile));
            await cdp.send('HeapProfiler.collectGarbage');
            const after = await cdp.send('Performance.getMetrics');
            const wanted = list => Object.fromEntries(list.metrics.filter(m => ['JSHeapUsedSize', 'Nodes', 'Documents',
                'JSEventListeners', 'TaskDuration', 'ScriptDuration', 'LayoutCount'].includes(m.name)).map(m => [m.name, m.value]));
            result.metricsBefore = wanted(before);
            result.metricsAfter = wanted(after);
            result.name = name;
            result.rafFps = result.intervals.count * 1000 / result.wallMs;
            result.fps = result.timings.render.count * 1000 / result.wallMs;
            report.scenes.push(result);
            fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
            await page.screenshot({ path: path.join(output, name + '.jpg'), quality: 88 });
            console.log(JSON.stringify({ scene: name, fps: result.fps, intervals: result.intervals,
                heapAfterGc: result.metricsAfter.JSHeapUsedSize, end: result.end,
                timings: Object.fromEntries(Object.entries(result.timings).map(([key, value]) => [key, value.p95])) }));
        }
        assert.deepEqual(report.errors, []);
        assert.deepEqual(report.failures, []);
    } finally {
        fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
        await browser.close();
    }
}
main().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => server.close());
