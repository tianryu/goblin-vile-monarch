const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const probe = process.argv.includes('--probe');
const hardware = process.argv.includes('--hardware');
const folder = path.join(__dirname, 'mobile-capture');
const prefix = probe ? 'probe' : hardware ? 'take-hardware' : 'take';
const url = process.env.MONARCH_CAPTURE_URL ?? 'http://127.0.0.1:42828/store-20261104/';
const viewport = { width: 960, height: 540 };

async function main() {
    fs.mkdirSync(folder, { recursive: true });
    const browser = await chromium.launch({
        channel: 'msedge', headless: true,
        args: [
            ...(hardware ? ['--enable-gpu', '--use-angle=d3d11'] : ['--use-angle=swiftshader', '--enable-unsafe-swiftshader']),
            '--autoplay-policy=no-user-gesture-required',
        ],
    });
    const errors = [];
    const timing = {};
    const evidence = {};
    const chunks = [];
    try {
        const page = await browser.newPage({
            viewport, screen: viewport, deviceScaleFactor: 2, hasTouch: true, isMobile: true,
        });
        page.on('pageerror', e => errors.push(e.message));
        if (probe) {
            page.on('console', msg => { if (msg.type() === 'error' || msg.type() === 'warning') console.log(msg.type(), msg.text().slice(0, 500)); });
            page.on('response', res => { if (res.status() >= 400) console.log(res.status(), res.url()); });
        }
        await page.exposeBinding('captureChunk', (_source, index, data) => { chunks[index] = Buffer.from(data, 'base64'); });
        await page.addInitScript(() => {
            window.__MONARCH_QA__ = true;
            const connect = AudioNode.prototype.connect;
            const buses = new WeakMap();
            AudioNode.prototype.connect = function (destination, ...ports) {
                const context = this.context;
                if (destination !== context.destination) return connect.call(this, destination, ...ports);
                let bus = buses.get(context);
                if (!bus) {
                    const mixer = context.createGain();
                    const recorder = context.createMediaStreamDestination();
                    connect.call(mixer, destination);
                    connect.call(mixer, recorder);
                    bus = { mixer, recorder };
                    buses.set(context, bus);
                    window.captureAudio = recorder;
                }
                return connect.call(this, bus.mixer, ...ports);
            };
        });
        await page.goto(url);
        await page.waitForFunction(() => window.__monarch?.checkpoint === 'store-20261104', null, { timeout: 45000 });
        const cdp = await page.context().newCDPSession(page);
        async function touch(type, points = []) {
            await cdp.send('Input.dispatchTouchEvent', { type, touchPoints: points.map(([x, y]) => ({ x, y, id: 1 })) });
        }
        async function stick(direction, milliseconds, strength = 1) {
            const origin = [112, 465];
            await touch('touchStart', [origin]);
            await touch('touchMove', [[origin[0] + 56 * strength * direction, origin[1]]]);
            await page.waitForTimeout(milliseconds);
            await touch('touchEnd');
        }
        async function control(key) {
            return page.evaluate(key => {
                const v = __monarch.view;
                const item = [...v.painter.nodes.entries()].find(([name]) => name.startsWith('control:' + key + '@'))?.[1];
                if (!item) throw Error('Control missing: ' + key);
                const rect = document.querySelector('canvas').getBoundingClientRect();
                return [
                    rect.left + (item.node.position.x + v.width / 2) * rect.width / v.width,
                    rect.top + (v.height / 2 - item.node.position.y - item.transform.height / 2) * rect.height / v.height,
                ];
            }, key);
        }
        async function action(milliseconds = 0) {
            const point = await control('action0');
            if (!milliseconds) return page.touchscreen.tap(...point);
            await touch('touchStart', [point]);
            await page.waitForTimeout(milliseconds);
            await touch('touchEnd');
        }
        async function until(seconds) {
            const elapsed = await page.evaluate(() => (performance.now() - window.captureStart) / 1000);
            await page.waitForTimeout(Math.max(0, (seconds - elapsed) * 1000));
        }
        async function mark(name) {
            timing[name] = await page.evaluate(() => (performance.now() - window.captureStart) / 1000);
            console.log(name, timing[name].toFixed(2));
        }
        async function setup(scene) {
            return page.evaluate(scene => {
                const { model: m, view, controls } = __monarch;
                const s = m.state;
                s.chapter.guidesSkipped = true;
                for (const key of ['expedition', 'trader', 'general']) s.chapter.seen[key] = true;
                const get = kind => s.buildings.find(b => b.kind === kind && b.region === -1);
                const wall = get('wall'), tower = get('tower'), farm = get('farm'), chest = get('treasury');
                const build = (b, level, hp) => Object.assign(b, { level, hp, maxHp: hp, job: undefined });
                const place = (x, camera = x) => {
                    controls.release();
                    s.player.x = s.player.prevX = x;
                    s.player.face = 1;
                    view.camera = camera;
                    m.selectionX = NaN;
                };
                if (scene === 'camp') {
                    s.time = 43;
                    s.gold = 18; s.treasury = 24;
                    for (const [i, n] of s.goblins.entries()) n.x = n.prevX = chest.x + 185 + 48 * i;
                    place(chest.x - 117);
                } else if (scene === 'build') {
                    s.time = 52;
                    s.gold = 36;
                    build(tower, 1, 90);
                    build(farm, 1, 100);
                    for (const [i, n] of s.goblins.entries()) {
                        n.x = n.prevX = wall.x - 74 - 46 * i;
                        n.task = '';
                    }
                    s.goblins.push(m.makeGoblin('worker', wall.x - 62));
                    place(wall.x + 162);
                } else if (scene === 'defense') {
                    s.day = 8; s.time = 106;
                    build(wall, 2, 170);
                    build(tower, 2, 170);
                    build(farm, 1, 100);
                    build(m.hall, 2, 230);
                    m.updateStats();
                    s.player.hp = m.playerMaxHp;
                    for (const role of ['hunter', 'hunter', 'brute', 'brute', 'hunter', 'worker', 'hunter', 'brute', 'worker']) {
                        s.goblins.push(m.makeGoblin(role, wall.x - 80));
                    }
                    for (const [i, n] of s.goblins.entries()) {
                        n.x = n.prevX = wall.x - 60 - i * 36;
                        n.task = '';
                    }
                    s.truceUntil = 0;
                    place(wall.x - 264);
                    m.spawnRaid();
                    const wave = s.enemies.filter(e => e.company);
                    for (const [i, e] of wave.entries()) e.x = e.prevX = wall.x + 175 + i * 54;
                    for (const company of s.companies) company.launchX = wall.x + 430;
                } else {
                    const camp = s.camps[2];
                    s.day = 12; s.time = 47;
                    for (const c of s.camps.slice(0, 2)) {
                        c.defeated = true; c.claimed = true; c.hp = 0;
                    }
                    build(m.hall, 3, 360);
                    build(m.forge, 2, 100);
                    s.player.hp = m.playerMaxHp;
                    s.player.hurt = 0;
                    const firstGate = s.fortifications.filter(f => f.camp === camp.index && f.kind === 'wall').sort((a, b) => a.x - b.x)[0];
                    const gate = firstGate?.x ?? camp.x - 215;
                    place(gate - 390);
                    s.expedition = { state: 'assault', camp: camp.index };
                    s.goblins = ['brute', 'brute', 'brute', 'hunter', 'hunter', 'hunter', 'brute', 'hunter', 'hunter', 'brute', 'hunter', 'worker']
                        .map((role, i) => {
                            const n = m.makeGoblin(role, gate - 215 - i * 23);
                            n.order = 'expedition'; n.task = '';
                            if (role !== 'worker') n.gear = 2;
                            return n;
                        });
                    m.updateStats();
                    for (const [i, kind] of ['human', 'dwarf', 'elf', 'shield', 'elf'].entries()) {
                        m.makeEnemy(kind, gate + 40 + i * 72, camp.index);
                    }
                }
                return { x: s.player.x, wall: wall.x, chest: chest.x, hall: m.hall.x, camps: s.camps.map(c => c.x), enemies: s.enemies.length };
            }, scene);
        }
        await page.waitForFunction(() => __monarch.controls.handlers.has('menu:main:new'));
        await page.touchscreen.tap(...await control('menu:main:new'));
        await page.waitForFunction(() => __monarch.controls.chapter.director.dialogue?.id === 'opening');
        await page.evaluate(() => {
            const { view, controls } = __monarch;
            controls.chapter.director.advance(true);
            const game = view.root.parent.components.find(c => c.world === view);
            const soundscape = game?.audio;
            if (!soundscape) throw Error('Game Soundscape unavailable');
            game.soundReady = true;
            window.captureGame = game;
            const mix = soundscape.mix;
            soundscape.mix = function (key, level, ...rest) {
                return mix.call(this, key, ['bard', 'forest_theme', 'march_drums'].includes(key) ? 0 : level, ...rest);
            };
            window.cues = {};
            const oneShot = soundscape.effects.playOneShot;
            soundscape.effects.playOneShot = function (clip, ...rest) {
                const name = clip.name;
                window.cues[name] = (window.cues[name] || 0) + 1;
                return oneShot.call(this, clip, ...rest);
            };
        });
        evidence.camp = await setup('camp');
        await page.waitForFunction(() => !__monarch.model.pauses.size && window.captureAudio?.context.state === 'running');
        if (probe) console.log(await page.evaluate(() => ({
            soundReady: captureGame.soundReady, enabled: captureGame.platform.soundEnabled,
            clips: [...captureGame.audio.clips.keys()], audioState: captureAudio.context.state,
            audioTime: captureAudio.context.currentTime, tracks: captureAudio.stream.getTracks().map(t => [t.kind, t.readyState, t.muted]),
        })));
        evidence.display = await page.evaluate(() => {
            const canvas = document.querySelector('canvas');
            return { width: canvas.width, height: canvas.height, cssWidth: innerWidth, cssHeight: innerHeight, touch: navigator.maxTouchPoints };
        });
        assert.deepEqual(evidence.display, { width: 1920, height: 1080, cssWidth: 960, cssHeight: 540, touch: 1 });
        await page.evaluate(() => {
            const stream = document.querySelector('canvas').captureStream(30);
            stream.addTrack(window.captureAudio.stream.getAudioTracks()[0]);
            const recorder = new MediaRecorder(stream, {
                mimeType: 'video/webm;codecs=vp8,opus', videoBitsPerSecond: 6500000, audioBitsPerSecond: 160000,
            });
            const writes = [];
            recorder.ondataavailable = ({ data }) => {
                if (!data.size) return;
                (window.captureSizes ??= []).push(data.size);
                const index = writes.length;
                writes.push(new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = () => window.captureChunk(index, reader.result.slice(reader.result.lastIndexOf(',') + 1)).then(resolve, reject);
                    reader.onerror = reject;
                    reader.readAsDataURL(data);
                }));
            };
            window.captureStop = () => new Promise((resolve, reject) => {
                recorder.onstop = () => Promise.all(writes).then(resolve, reject);
                recorder.stop();
            });
            recorder.start(1250);
            window.captureStart = performance.now();
        });
        await mark('camp');
        await stick(1, 650, .8);
        console.log(await page.evaluate(() => ({ x: __monarch.model.state.player.x, context: __monarch.view.context?.name, act: __monarch.view.context?.actions[0]?.type })));
        await page.waitForFunction(() => __monarch.view.context?.actions[0]?.type === 'withdraw', null, { timeout: 3500 });
        const before = await page.evaluate(() => __monarch.model.state.treasury);
        await action(1050);
        evidence.treasuryAfter = await page.evaluate(() => __monarch.model.state.treasury);
        assert.ok(evidence.treasuryAfter < before, 'Touch must withdraw from the treasury');
        if (probe) {
            await until(5);
        } else {
            await until(5);
            if (await page.evaluate(() => __monarch.view.context?.actions[0]?.type === 'withdraw')) await action(1050);
            await until(8);
            await stick(1, 2350);
            await until(12);
            await stick(1, 2600);
            await until(17);
            await stick(1, 1900, .65);
            await until(26);
            evidence.build = await setup('build');
            await mark('build');
            await stick(-1, 650);
            await page.waitForFunction(() => __monarch.view.context?.kind === 'wall' && __monarch.view.context.actions[0]?.type === 'build', null, { timeout: 4200 });
            await action(2250);
            await page.waitForFunction(() => {
                const { model } = __monarch;
                return model.state.buildings.some(b => b.kind === 'wall' && b.region === -1 && (b.job || b.level));
            }, null, { timeout: 4000 });
            await until(50);
            evidence.wallBuilt = await page.evaluate(() => __monarch.model.state.buildings.find(b => b.kind === 'wall' && b.region === -1).level);
            assert.ok(evidence.wallBuilt > 0, 'Actual construction must finish');
            await stick(-1, 1370);
            await until(53);
            evidence.defense = await setup('defense');
            await mark('defense');
            await until(55);
            await stick(1, 530, .7);
            await until(64);
            await stick(-1, 465, .65);
            await until(72);
            await stick(1, 420, .65);
            await until(82);
            evidence.siege = await setup('siege');
            await mark('siege');
            await stick(1, 1110);
            await until(89);
            await stick(-1, 1300);
            await until(97);
            await stick(1, 680, .55);
            await until(104);
            await stick(-1, 1980);
            await until(112);
            if (await page.evaluate(() => __monarch.model.state.status === 'lost')) {
                await page.touchscreen.tap(...await control('resultRestart'));
            } else {
                await stick(1, 870, .65);
            }
            await until(120);
        }
        await page.evaluate(() => window.captureStop());
        evidence.cues = await page.evaluate(() => window.cues);
        evidence.end = await page.evaluate(() => ({
            status: __monarch.model.state.status, hp: __monarch.model.state.player.hp,
            expedition: __monarch.model.state.expedition.state,
        }));
        if (probe) console.log(await page.evaluate(() => ({
            soundReady: captureGame.soundReady, eventCount: captureGame.model.events.length,
            audioTime: captureAudio.context.currentTime, sizes: captureSizes,
        })));
        evidence.browserErrors = errors;
        assert.deepEqual(errors, []);
        assert.ok(chunks.length > 1 && chunks.every(Boolean));
        assert.ok(chunks.reduce((bytes, chunk) => bytes + chunk.length, 0) > 100000);
        fs.writeFileSync(path.join(folder, prefix + '.webm'), Buffer.concat(chunks));
        fs.writeFileSync(path.join(folder, prefix + '.json'), JSON.stringify({ timing, evidence }, null, 2) + '\n');
        console.log(JSON.stringify({ timing, evidence }));
    } finally {
        await browser.close();
    }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
