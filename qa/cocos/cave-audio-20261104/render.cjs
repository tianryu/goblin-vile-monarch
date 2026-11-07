const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const path = require('node:path');

(async () => {
    const browser = await chromium.launch({channel:'msedge',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
    const p = await browser.newPage({viewport:{width:844,height:390},hasTouch:true});
    const errors = [];
    p.on('pageerror', error => errors.push(error.message));
    p.on('response', response => { if (response.status() >= 400) errors.push(response.url()); });
    try {
        await p.addInitScript(() => { window.__MONARCH_QA__ = true; });
        await p.goto(process.env.MONARCH_URL);
        await p.waitForFunction(() => window.__monarch?.checkpoint === 'cave-audio-20261104', null, { timeout:40000 });
        await p.evaluate(() => {
            const { model, menus } = __monarch;
            model.state.chapter.seen.opening = true;
            model.state.chapter.guidesSkipped = true;
            menus.close('continue');
        });
        await p.waitForFunction(() => !__monarch.menus.blocks && !__monarch.model.pauses.size);
        await p.evaluate(() => {
            const { model:m, view:v } = __monarch;
            m.state.player.x = m.state.player.prevX = m.forge.x;
            m.forge.level = 1;
            m.forge.hp = m.forge.maxHp = 100;
            m.state.time = 46;
            v.camera = m.forge.x;
        });
        const tap = async (offsetFromRight, y) => {
            const viewport = await p.evaluate(() => {
                const canvas = document.getElementById('GameCanvas').getBoundingClientRect();
                return {x:canvas.x,y:canvas.y,w:canvas.width,h:canvas.height,designW:__monarch.view.width,designH:__monarch.view.height};
            });
            await p.touchscreen.tap(viewport.x + (viewport.designW-offsetFromRight)*viewport.w/viewport.designW,
                viewport.y + y*viewport.h/viewport.designH);
        };
        await p.waitForFunction(() => __monarch.view.context?.kind === 'forge');
        await tap(63, 60);
        await p.waitForFunction(() => [...__monarch.view.painter.nodes.keys()].some(key=>key.startsWith('control:adStamina@')));
        assert.equal(await p.evaluate(() => __monarch.controls.adPanel),'rewards');
        await p.waitForTimeout(360);
        await p.screenshot({path:path.join(__dirname,'reward-menu-small-landscape.png')});
        await tap(126,324);
        assert.equal(await p.evaluate(() => __monarch.model.infiniteStaminaSeconds),0);
        await tap(126,258);
        await p.waitForFunction(() => __monarch.controls.adPanel === 'mount' && __monarch.controls.visible.has('adBack'));
        await p.waitForTimeout(180);
        await tap(126,126);
        await p.waitForFunction(() => __monarch.controls.adPanel === 'rewards');
        const cdp = await p.context().newCDPSession(p);
        await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:180,y:250,id:1}]});
        await p.waitForFunction(() => __monarch.controls.joystickOrigin && !__monarch.controls.adPanel);
        assert.equal(await p.evaluate(() => __monarch.model.input.axis),0);
        await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
        await p.waitForTimeout(250);
        await p.screenshot({path:path.join(__dirname,'cave-forge.png')});

        await p.keyboard.press('Shift');
        const audio = await p.evaluate(() => {
            const { model:m, view:v } = __monarch;
            const component = v.root.parent.getComponent('MonarchGame');
            const sound = component.audio;
            const captured = [];
            const playOneShot = sound.effects.playOneShot;
            sound.effects.playOneShot = function (clip, volume) {
                captured.push({clip:clip.name,volume});
                return playOneShot.call(this,clip,volume);
            };
            m.events.push({kind:'build',x:m.state.player.x},{kind:'hammer',x:m.state.player.x});
            sound.update(.016,m,true,false);
            return captured;
        });
        assert.deepEqual(audio,[{clip:'build_complete',volume:.13},{clip:'wood_hit',volume:.055}]);
        assert.deepEqual(errors,[]);
        console.log('PASS: 844x390 reward menu and touch, no local ad payout, cave forge, replacement construction cues');
    } finally { await browser.close(); }
})().catch(error=>{ console.error(error); process.exitCode=1; });
