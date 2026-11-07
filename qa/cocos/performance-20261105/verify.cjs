const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const prefix = fs.readFileSync(path.resolve(__dirname, '../playtest-fix-20261105/verify-browser.cjs'), 'utf8')
    .split('async function verify()')[0].replace('cocos/build/playtest-fix-20261105', 'cocos/build/performance-20261105');
const server = new Function('require', '__dirname', prefix + '\nreturn server;')(require, __dirname);

async function verify() {
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--use-angle=d3d11'] });
    try {
        const page = await browser.newPage({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        await page.addInitScript(() => { window.__MONARCH_QA__ = true; });
        await page.goto('http://127.0.0.1:' + server.address().port);
        await page.waitForFunction(() => !!window.__monarch);
        page.setDefaultTimeout(7000);
        await page.evaluate(async () => {
            const { view, model } = __monarch;
            window.perfCC = await System.import('cc');
            window.gameComponent = view.root.parent.components.find(component => component.world === view);
            Object.assign(model.state.chapter.seen, { opening: true, expedition: true, trader: true, general: true });
            model.state.chapter.guidesSkipped = true;
        });
        const audio = () => page.evaluate(() => Object.fromEntries([...window.gameComponent.audio.loops]
            .map(([key, track]) => [key, { playing: track.source.playing, running: track.running, volume: track.source.volume }])));
        await page.waitForTimeout(600);
        assert.ok(Object.values(await audio()).every(track => !track.playing && !track.running && track.volume === 0));
        const tap = async key => {
            await page.waitForFunction(key => __monarch.controls.handlers.has(key), key);
            const [x, y] = await page.evaluate(key => {
                const { view } = __monarch;
                const d = view.painter.nodes.get('control:' + key + '@ui_button_v5');
                const rect = document.querySelector('canvas').getBoundingClientRect();
                const hit = __monarch.controls.activeHits.get(key).node.position;
                return [rect.left + (d.node.position.x + hit.x + view.width / 2) * rect.width / view.width,
                    rect.top + (view.height / 2 - d.node.position.y - hit.y) * rect.height / view.height];
            }, key);
            await page.touchscreen.tap(x, y);
        };
        await tap('menu:main:new');
        await page.waitForFunction(() => !__monarch.menus.blocks && window.gameComponent.audio.loops.get('bard').source.playing);
        await page.waitForFunction(() => window.gameComponent.chapter.dialogue?.id === 'opening');
        await page.evaluate(() => {
            __monarch.model.state.time = 55;
            window.gameComponent.chapter.advance(true);
            __monarch.model.state.chapter.guidesSkipped = true;
        });
        await page.waitForFunction(() => !__monarch.model.pauses.size);
        await page.waitForTimeout(3000);
        const started = await audio();
        console.log(JSON.stringify({ stage: 'audio-start', started, world: await page.evaluate(() => ({
            time: __monarch.model.state.time, pauses: [...__monarch.model.pauses], chapter: __monarch.model.state.chapter.dialogue
        })) }));
        assert.ok(started.bard.volume > .17 && started.birds.volume > .015);
        await page.evaluate(() => __monarch.menus.open('pause'));
        await tap('menu:pause:home');
        await page.waitForFunction(() => __monarch.menus.kind === 'main' && __monarch.menus.phase === 'open');
        await page.waitForTimeout(150);
        assert.ok(Object.values(await audio()).every(track => !track.playing && !track.running && track.volume === 0));
        await tap('menu:main:continue');
        await page.waitForFunction(() => !__monarch.menus.blocks && window.gameComponent.audio.loops.get('bard').source.playing);

        const canvas = await page.evaluate(() => {
            const { model: m, view: v } = __monarch;
            m.state.player.x = m.state.player.prevX = 1700;
            v.camera = 1700;
            m.pause('qa', true);
            m.input.axis = 0;
            return [document.querySelector('canvas').width, document.querySelector('canvas').height, v.width, v.height];
        });
        await page.waitForTimeout(500);
        const transforms = await page.evaluate(async () => {
            const { view: v } = __monarch;
            const stats = { scale: 0, position: 0 }, prototype = window.perfCC.Node.prototype;
            const oldScale = prototype.setScale, oldPosition = prototype.setPosition;
            prototype.setScale = function(...args) { stats.scale++; return oldScale.apply(this, args); };
            prototype.setPosition = function(...args) { stats.position++; return oldPosition.apply(this, args); };
            try {
                for (let i = 0; i < 20; i++) await new Promise(requestAnimationFrame);
            } finally {
                prototype.setScale = oldScale;
                prototype.setPosition = oldPosition;
            }
            const layer = v.painter.layers[3].getComponent(window.perfCC.UITransform);
            return { ...stats, landWidth: layer.width, landHeight: layer.height };
        });
        assert.equal(transforms.scale, 0);
        assert.equal(transforms.landWidth, 28400 - 1040);

        const particles = await page.evaluate(() => {
            const { model: m, view: v } = __monarch, s = m.state;
            const prior = s.effects;
            s.effects = [];
            const original = v.ellipse;
            let calls = 0;
            v.ellipse = function(...args) { calls++; return original.apply(this, args); };
            try {
                v.procedural();
                const base = calls;
                for (let i = 0; i < 80; i++) { const f = m.effect('fire', s.player.x + 15000, 4); f.age = 1; }
                v.procedural();
                const offscreen = calls - base;
                s.effects = [];
                for (let i = 0; i < 25; i++) { const f = m.effect('fire', s.player.x + 5, 4); f.age = 1; }
                const before = calls;
                v.procedural();
                return { offscreenExtra: offscreen - base, overlappingExtra: calls - before - base };
            } finally {
                s.effects = prior;
                v.ellipse = original;
            }
        });
        assert.equal(particles.offscreenExtra, 0);
        assert.equal(particles.overlappingExtra, 4);
        const cdp = await page.context().newCDPSession(page);
        const snapshot = () => page.evaluate(() => {
            const { controls, view, model } = __monarch;
            return { origin: controls.joystickOrigin, axis: controls.joystickAxis, face: model.state.player.face,
                canvas: [document.querySelector('canvas').width, document.querySelector('canvas').height, view.width, view.height] };
        });
        await page.evaluate(() => __monarch.model.pause('qa', false));
        const point = (x, y) => ({ x, y, id: 1 });
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point(105, 330)] });
        const origin = (await snapshot()).origin;
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [point(170, 330)] });
        await page.waitForFunction(() => __monarch.model.state.player.face === 1);
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [point(45, 330)] });
        await page.waitForFunction(() => __monarch.model.state.player.face === -1);
        const reverse = await snapshot();
        assert.deepEqual(reverse.origin, origin);
        assert.deepEqual(reverse.canvas, canvas);
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
        assert.deepEqual(errors, []);
        console.log(JSON.stringify({ started, transforms, particles, reverse, errors }, null, 2));
    } finally {
        await browser.close();
    }
}
verify().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => server.close());
