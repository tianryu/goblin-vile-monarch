const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const materials = path.resolve(__dirname, '../../../release/taptap-20261104-r1/materials');
const url = process.env.MONARCH_CAPTURE_URL ?? 'http://127.0.0.1:42828/store-20261104/';
const creditsOutput = process.argv[2];

(async () => {
    const browser = await chromium.launch({channel:'msedge',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
    const errors = [];
    try {
        const page = await browser.newPage({viewport:{width:1920,height:1080},deviceScaleFactor:1,hasTouch:true});
        page.on('pageerror',e=>errors.push(e.message));
        await page.addInitScript(()=>{ window.__MONARCH_QA__=true; });
        await page.goto(url);
        await page.waitForFunction(()=>window.__monarch?.checkpoint==='store-20261104',null,{timeout:45000});
        await page.waitForFunction(()=>__monarch.menus.phase==='open');
        await page.waitForFunction(()=>__monarch.view.painter.nodes.get('menuHeadingArt@title_wordmark')?.opacity.opacity===255);
        if (!creditsOutput) await page.screenshot({path:path.join(__dirname,'menu.jpg'),quality:90});
        const click = async key => {
            const pt = await page.evaluate(key=>{
                const v=__monarch.view,d=v.painter.nodes.get('control:'+key+'@ui_button_v5');
                const rect=document.querySelector('canvas').getBoundingClientRect();
                return [rect.left+(d.node.position.x+v.width/2)*rect.width/v.width,
                    rect.top+(v.height/2-d.node.position.y-d.transform.height/2)*rect.height/v.height];
            },key);
            await page.touchscreen.tap(...pt);
        };
        await click('menu:main:credits');
        await page.waitForFunction(()=>__monarch.view.painter.nodes.get('text:creditsHeading')?.opacity.opacity===255);
        if (creditsOutput) {
            await page.waitForFunction(()=>{
                const nodes=__monarch.view.painter.nodes;
                const heading=nodes.get('text:creditsAiHeading');
                const notice=nodes.get('text:creditsAiNotice');
                return heading?.label.string==='AI 生成声明' &&
                    notice?.label.string==='图片素材都由\nOpenAI ImageGen 生成' &&
                    notice.opacity.opacity===255 && nodes.get('text:creditsLine6')?.opacity.opacity===255;
            });
            await page.screenshot({path:creditsOutput});
            await click('menu:credits:back');
            await page.waitForFunction(()=>__monarch.controls.handlers.has('menu:main:credits'));
            assert.deepEqual(errors,[]);
            console.log('Credits disclosure and touch return verified');
            return;
        }
        await page.screenshot({path:path.join(__dirname,'credits.jpg'),quality:90});
        await click('menu:credits:back');
        await page.waitForFunction(()=>__monarch.controls.handlers.has('menu:main:new'));
        await click('menu:main:new');
        await page.waitForFunction(()=>__monarch.controls.chapter.director.dialogue?.id==='opening');
        await page.evaluate(()=>{
            const {model:m,controls,view}=__monarch;
            controls.chapter.director.advance(true);
            m.state.chapter.guidesSkipped=true;
            m.state.chapter.seen.expedition=true;
            m.state.chapter.seen.trader=true;
            m.state.chapter.seen.general=true;
            const s=m.state;
            const wall=s.buildings.find(b=>b.kind==='wall'&&b.region===-1);
            const tower=s.buildings.find(b=>b.kind==='tower'&&b.region===-1);
            const farm=s.buildings.find(b=>b.kind==='farm'&&b.region===-1);
            Object.assign(wall,{level:2,hp:170,maxHp:170});
            Object.assign(tower,{level:1,hp:90,maxHp:90});
            Object.assign(farm,{level:1,hp:100,maxHp:100});
            s.day=5;s.time=104;s.gold=28;s.treasury=22;
            m.hall.level=2;m.updateStats();s.player.hp=m.playerMaxHp;
            const population=['hunter','hunter','brute','brute','hunter','worker','hunter','brute','worker'];
            for(const role of population) s.goblins.push(m.makeGoblin(role,1900));
            s.goblins.forEach((n,i)=>{n.x=n.prevX=wall.x-90-i*76;});
            s.player.x=s.player.prevX=1720;view.camera=1720;m.selectionX=NaN;
        });
        await page.waitForFunction(()=>!__monarch.model.pauses.size);
        await page.waitForTimeout(900);
        await page.screenshot({path:path.join(materials,'01-outpost.jpg'),quality:91});
        await page.evaluate(()=>{
            const {model:m,view}=__monarch,s=m.state;
            const wall=s.buildings.find(b=>b.kind==='wall'&&b.region===-1);
            s.player.x=s.player.prevX=wall.x-195;view.camera=wall.x-5;
            m.spawnRaid();
            const wave=s.enemies.filter(e=>e.company);
            wave.forEach((e,i)=>{e.x=e.prevX=wall.x+195+i*40;});
        });
        await page.waitForTimeout(700);
        assert.ok(await page.evaluate(()=>!__monarch.model.pauses.size&&__monarch.model.activeEnemies().some(e=>e.company)));
        await page.evaluate(()=>{
            const canvas=document.querySelector('canvas');
            const stream=canvas.captureStream(30);
            const rec=new MediaRecorder(stream,{mimeType:'video/webm;codecs=vp8',videoBitsPerSecond:7500000});
            const chunks=[];
            rec.ondataavailable=e=>chunks.push(e.data);
            window.gameCapture={rec,chunks};
            rec.start(800);
        });
        await page.keyboard.down('d'); await page.waitForTimeout(630); await page.keyboard.up('d');
        await page.waitForTimeout(2300);
        await page.screenshot({path:path.join(materials,'02-defense.jpg'),quality:91});
        await page.keyboard.down('a'); await page.waitForTimeout(650); await page.keyboard.up('a');
        await page.waitForTimeout(5300);
        await page.keyboard.down('d'); await page.waitForTimeout(980); await page.keyboard.up('d');
        await page.waitForTimeout(4300);
        await page.keyboard.down('a'); await page.waitForTimeout(580); await page.keyboard.up('a');
        await page.waitForTimeout(5000);
        const encoded = await page.evaluate(()=>new Promise(resolve=>{
            const {rec,chunks}=window.gameCapture;
            rec.onstop=()=>{
                const reader=new FileReader();
                reader.onload=()=>resolve(reader.result.split(',')[1]);
                reader.readAsDataURL(new Blob(chunks,{type:'video/webm'}));
            };
            rec.stop();
        }));
        fs.writeFileSync(path.join(__dirname,'gameplay.webm'),Buffer.from(encoded,'base64'));
        await page.evaluate(()=>{
            const {model:m,view}=__monarch,s=m.state;
            const camp=s.camps[1];
            s.time=69; s.player.x=s.player.prevX=camp.x-380;view.camera=s.player.x;
            m.state.chapter.seen.general=true;
            s.goblins.filter(n=>!n.dead).forEach((n,i)=>{n.x=n.prevX=s.player.x-65-i*31;n.order='expedition';n.task='';n.retreat=undefined;n.towerId=undefined;});
            s.expedition={state:'assault',camp:1};
            for (const [i,kind] of ['human','dwarf','elf'].entries()) m.makeEnemy(kind,camp.x-165+i*74,1);
        });
        await page.waitForTimeout(800);
        await page.screenshot({path:path.join(materials,'03-siege.jpg'),quality:91});
        assert.deepEqual(errors,[]);
        console.log('Captured menu, credits, three gameplay screenshots and raw video');
    } finally { await browser.close(); }
})().catch(e=>{console.error(e);process.exitCode=1;});
