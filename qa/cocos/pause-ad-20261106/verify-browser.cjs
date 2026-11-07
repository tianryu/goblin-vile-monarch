const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

async function verify() {
    const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--enable-gpu', '--use-angle=d3d11'] });
    const results = {}, errors = [];
    try {
        const page = await browser.newPage({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true });
        page.on('pageerror', error => errors.push(error.message));
        await page.addInitScript(() => { window.__MONARCH_QA__ = true; });
        await page.goto(process.argv[2] || 'http://127.0.0.1:42832/?build=pause-ad-20261106&mockAds=1');
        await page.waitForFunction(() => window.__monarch?.menus.phase === 'open');
        assert.equal(await page.evaluate(() => __monarch.platform.adsReady), true);

        async function tap(key, ready = true) {
            await page.waitForFunction(({key, ready}) => ready
                ? __monarch.controls.handlers.has(key)
                : [...__monarch.view.painter.nodes.keys()].some(name => name.startsWith('control:' + key + '@')), {key, ready});
            const point = await page.evaluate(key => {
                const { view } = __monarch;
                const node = [...view.painter.nodes.entries()].find(([name]) => name.startsWith('control:' + key + '@'))[1];
                const rect = document.querySelector('canvas').getBoundingClientRect();
                return {
                    x: rect.left + (node.node.position.x + view.width / 2) * rect.width / view.width,
                    y: rect.top + (view.height / 2 - node.node.position.y - node.transform.height / 2) * rect.height / view.height
                };
            }, key);
            await page.touchscreen.tap(point.x, point.y);
        }
        await tap('menu:main:new');
        await page.waitForFunction(() => !__monarch.menus.blocks);
        await page.evaluate(() => {
            const {model, controls, platform} = __monarch;
            const chapter = model.state.chapter;
            Object.assign(chapter.seen, {opening: true, expedition: true, trader: true, general: true});
            chapter.guidesSkipped = true;
            if (chapter.dialogue) controls.chapter.director.advance(true);
            // 固定独立浏览器内的普通档，用于检查发奖只写模拟档。
            localStorage.setItem(platform.baseStorageKey, JSON.stringify(model.state));
        });
        await tap('pause');
        await page.waitForFunction(() => __monarch.menus.phase === 'open' && __monarch.menus.kind === 'pause');
        const pause = await page.evaluate(() => {
            const {view, model, controls} = __monarch;
            return {
                elapsed: model.state.elapsed,
                label: view.painter.nodes.get('text:menuLabel:pause:continue').label.string,
                pauseActive: controls.handlers.has('pause'),
                legacyIcon: [...view.painter.nodes.keys()].some(key => key.startsWith('resumeIcon@'))
            };
        });
        assert.equal(pause.label, '继续游戏');
        assert.equal(pause.pauseActive, false);
        assert.equal(pause.legacyIcon, false);
        await page.screenshot({path: path.join(__dirname, 'pause-menu.png')});
        await tap('menu:pause:continue');
        await page.waitForFunction(() => __monarch.menus.phase === 'closing' && !__monarch.controls.handlers.has('menu:pause:continue'));
        assert.equal(await page.evaluate(() => __monarch.model.state.elapsed), pause.elapsed);
        await page.waitForFunction(previous => __monarch.model.state.elapsed > previous, pause.elapsed);
        results.pause = pause;

        const wallet = () => page.evaluate(() => ({
            gold: __monarch.model.state.gold,
            receipts: __monarch.model.state.adReceipts.length
        }));
        const original = await wallet();
        await tap('adGold');
        await page.waitForFunction(() => __monarch.platform.mockRewardSeconds > 0);
        await tap('mockComplete', false);
        assert.deepEqual(await wallet(), original);
        await tap('mockCancel');
        await page.waitForFunction(() => !__monarch.controls.adBusy);
        assert.deepEqual(await wallet(), original);
        await tap('adGold');
        await page.waitForFunction(() => __monarch.controls.handlers.has('mockComplete'));
        await page.waitForTimeout(200);
        await page.screenshot({path: path.join(__dirname, 'mock-ad.png')});
        await tap('mockComplete');
        await page.waitForFunction(() => !__monarch.controls.adBusy);
        const rewarded = await wallet();
        assert.deepEqual(rewarded, {gold: original.gold + 10, receipts: original.receipts + 1});
        const stored = await page.evaluate(() => {
            const {platform} = __monarch;
            return [platform.baseStorageKey, platform.storageKey].map(key => JSON.parse(localStorage.getItem(key)).gold);
        });
        assert.deepEqual(stored, [original.gold, rewarded.gold]);
        results.mock = { original, rewarded, stored };

        const sizes = await page.evaluate(async () => {
            const {model, view} = __monarch, state = model.state;
            const x = 2450;
            state.player.x = state.player.prevX = view.camera = x;
            state.enemies = [];
            state.goblins = [];
            const live = model.makeEnemy('elf', x + 235, 0, 0);
            const dead = model.makeEnemy('elf', x + 110, 0, 0);
            const wounded = model.makeEnemy('elf', x - 118, 0, 0);
            // 定向夹具保留两种倒地状态，同时经过正式受击与死亡入口。
            const rand = model.rand;
            model.rand = () => .9;
            try { model.hitEnemy(dead, 1000, x); } finally { model.rand = rand; }
            Object.assign(wounded, {state: 'wounded', hp: 0});
            Object.assign(live, {cooldown: 8, snared: 8});
            model.rebuildEnemyCache();
            await new Promise(resolve => setTimeout(resolve, 500));
            const spriteWidth = (unit, frame) => view.painter.nodes.get('enemy' + unit.id + '@' + frame)?.transform.width;
            return {
                dead: spriteWidth(dead, 'elf_dead'),
                wounded: spriteWidth(wounded, 'elf_wounded'),
                live: spriteWidth(live, 'combat')
            };
        });
        assert.ok(sizes.dead > 80 && sizes.dead < 100, JSON.stringify(sizes));
        assert.ok(sizes.dead < sizes.wounded * 1.06, JSON.stringify(sizes));
        results.elf = sizes;
        await page.screenshot({path: path.join(__dirname, 'elf-scale.png')});

        await page.evaluate(() => {
            const {model, view} = __monarch, state = model.state;
            state.enemies = [];
            model.rebuildEnemyCache();
            state.player.x = state.player.prevX = view.camera = 2160;
            const worker = model.makeGoblin('worker', 2200);
            state.goblins = [worker];
            model.manualTarget = worker.id;
            const audio = view.root.parent.components.find(component => component.world === view).audio;
            const play = audio.effects.playOneShot.bind(audio.effects);
            window.__whipGains = [];
            audio.effects.playOneShot = (clip, gain) => {
                if (clip.name === 'whip_snap') window.__whipGains.push(gain);
                return play(clip, gain);
            };
        });
        await tap('action1');
        await page.waitForFunction(() => window.__whipGains.length > 0);
        const gains = await page.evaluate(() => window.__whipGains);
        assert.ok(gains[0] > .6 && gains[0] <= .72, JSON.stringify(gains));
        results.whip = gains[0];
        assert.deepEqual(errors, []);
        console.log(JSON.stringify(results, null, 2));
    } finally {
        fs.writeFileSync(path.join(__dirname, 'browser-results.json'), JSON.stringify({results, errors}, null, 2));
        await browser.close();
    }
}
verify().catch(error => { console.error(error); process.exitCode = 1; });
