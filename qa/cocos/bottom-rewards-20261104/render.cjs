const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

(async () => {
    const browser = await chromium.launch({channel:'msedge',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
    const result = {};
    const errors = [];
    const viewport = {width:844,height:390};
    async function game(url, checkpoint) {
        const page = await browser.newPage({viewport,hasTouch:true});
        page.on('pageerror',e=>errors.push(e.message));
        await page.addInitScript(() => { window.__MONARCH_QA__=true; });
        await page.goto(url);
        await page.waitForFunction(checkpoint=>window.__monarch?.checkpoint===checkpoint,checkpoint,{timeout:40000});
        await page.evaluate(() => {
            const {model,menus}=__monarch;
            model.state.chapter.seen.opening=true;
            model.state.chapter.guidesSkipped=true;
            menus.close('continue');
        });
        await page.waitForFunction(() => !__monarch.menus.blocks);
        return page;
    }
    async function farmAfterAtlasPressure(page, sample) {
        await page.evaluate(() => {
            const v=__monarch.view, normal=v.drawControls;
            v.drawControls=dt=>{
                normal(dt);
                for(let i=0;i<72;i++){
                    const phrase=Array.from({length:30},(_,j)=>String.fromCodePoint(0x4e00+i*30+j)).join('');
                    v.painter.text('atlasStress'+i,phrase,-2000,10+i,27+(i%3)*4);
                    v.painter.nodes.get('text:atlasStress'+i).label.cacheMode=2;
                }
                v.drawControls=normal;
            };
        });
        await page.waitForTimeout(1300);
        await page.evaluate(()=>{
            const {model:m,view:v}=__monarch;
            const b=m.state.buildings.find(b=>b.kind==='farm'&&b.region===-1);
            m.state.player.x=m.state.player.prevX=b.x;
            m.selectionX=NaN;m.manualTarget=b.id;v.camera=b.x;
        });
        await page.waitForFunction(()=>__monarch.view.painter.nodes.get('text:contextTitle')?.label.string==='蘑菇田');
        await page.waitForTimeout(350);
        await page.screenshot({path:path.join(__dirname,sample+'.png')});
        return page.evaluate(()=>{
            const get = name => {
                const label=__monarch.view.painter.nodes.get('text:'+name).label;
                return {string:label.string, vertices:label.renderData?.vertexCount, cacheMode:label.cacheMode};
            };
            return {title:get('contextTitle'),desc:get('contextDescription')};
        });
    }
    try {
        const before=await game('http://127.0.0.1:42828/','cave-audio-20261104');
        result.before=await farmAfterAtlasPressure(before,'farm-before');
        assert.ok(result.before.title.vertices < 12,JSON.stringify(result.before));
        await before.close();
        const after=await game('http://127.0.0.1:42960/','bottom-rewards-20261104');
        result.after=await farmAfterAtlasPressure(after,'farm-after');
        assert.deepEqual(result.after.title,{string:'蘑菇田',vertices:4,cacheMode:1});
        assert.equal(result.after.desc.string,'苦工照看，持续生产金币');
        assert.equal(result.after.desc.vertices,4);
        const layout = await after.evaluate(()=>{
            const {view:v,controls:c}=__monarch;
            const read=(key,asset)=>{
                const node=v.painter.nodes.get('control:'+key+'@'+asset);
                return {x:node.node.position.x+v.width/2,y:v.height/2-node.node.position.y,alpha:node.alpha,width:node.transform.width};
            };
            return {width:v.width,height:v.height,joystick:c.joystickTransform.width,run:read('run','ui_action_ring'),
                signs:['adGold','adArmy','adMount','adStamina'].map(key=>read(key,'price_board'))};
        });
        assert.ok(Math.abs(layout.width/3-layout.joystick)<.1);
        assert.ok(layout.signs.every(s=>s.x-s.width/2>=layout.width/3&&s.x+s.width/2<=layout.width*2/3&&s.y>layout.height-55));
        assert.ok(layout.run.x < layout.width-225 && layout.run.alpha<.8);
        const cdp=await after.context().newCDPSession(after);
        const touch=(type,points=[])=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:points});
        await touch('touchStart',[{x:310,y:260,id:1}]);
        await after.waitForTimeout(120);
        assert.equal(await after.evaluate(()=>__monarch.controls.joystickOrigin),undefined);
        await touch('touchEnd');
        await touch('touchStart',[{x:195,y:250,id:2}]);
        await after.waitForFunction(()=>!!__monarch.controls.joystickOrigin);
        await touch('touchMove',[{x:320,y:250,id:2}]);
        await after.waitForFunction(()=>__monarch.model.input.axis>.9);
        await touch('touchEnd');
        const rewardTap = async (key) => {
            const spot=await after.evaluate(key=>{
                const v=__monarch.view,node=v.painter.nodes.get('control:'+key+'@price_board').node;
                return {x:(node.position.x+v.width/2)/v.width,y:(v.height/2-node.position.y-38)/v.height};
            },key);
            await after.touchscreen.tap(spot.x*viewport.width,spot.y*viewport.height);
        };
        await rewardTap('adArmy');
        await after.waitForFunction(()=>__monarch.controls.adPanel==='army');
        await after.waitForTimeout(540);
        await rewardTap('adBack');
        await after.waitForFunction(()=>!__monarch.controls.adPanel);
        await after.waitForTimeout(540);
        const audio = await after.evaluate(()=>{
            const {model:m,view:v}=__monarch;
            const sound=v.root.parent.getComponent('MonarchGame').audio;
            const captured=[];
            sound.effects.playOneShot=(clip,volume)=>captured.push([clip.name,volume]);
            for(const kind of ['build','woodHit','melee','whip']){
                m.events.length=0;m.events.push({kind,x:m.state.player.x});
                sound.update(.016,m,true,false);
            }
            return captured;
        });
        assert.deepEqual(audio,[['chop',.13],['wall_thud',.27],['sword_heavy',.23],['whip_snap',.24]]);
        await after.evaluate(()=>{
            const {model:m,view:v}=__monarch,s=m.state;
            s.player.x=s.player.prevX=m.hall.x+95;
            m.forge.level=1;m.forge.hp=m.forge.maxHp=100;
            s.gearStock=4;v.camera=Math.max(s.player.x,-420+v.width/2);
        });
        await after.waitForTimeout(350);
        await after.screenshot({path:path.join(__dirname,'cave-workshops.png')});
        assert.deepEqual(errors,[]);
        result.layout=layout;result.audio=audio;
        fs.writeFileSync(path.join(__dirname,'render-report.json'),JSON.stringify(result,null,2));
        console.log('PASS: before/after font atlas exhaustion, center-third reward signs, left-third touch and drag, audio routing',result.before,result.after);
    } finally { await browser.close(); }
})().catch(e=>{console.error(e);process.exitCode=1;});
