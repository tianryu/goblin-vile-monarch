const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

(async()=>{
    const browser=await chromium.launch({channel:'msedge',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
    const p=await browser.newPage({viewport:{width:1280,height:600},hasTouch:true});
    const errors=[];
    p.on('pageerror',e=>errors.push(e.message));
    p.on('response',r=>{if(r.status()>=400)errors.push(r.status()+' '+r.url());});
    try {
        await p.addInitScript(()=>globalThis.__MONARCH_QA__=true);
        await p.goto(process.env.MONARCH_URL);
        await p.waitForFunction(()=>globalThis.__monarch?.checkpoint==='drum-cart-20261104',null,{timeout:40000});
        await p.evaluate(()=>{
            const m=__monarch.model, ch=m.state.chapter;
            ch.seen.opening=ch.seen.expedition=true;ch.guidesSkipped=true;
            delete ch.dialogue;
            __monarch.menus.close('continue');
        });
        await p.waitForFunction(()=>!__monarch.menus.blocks&&!__monarch.model.pauses.size);
        await p.evaluate(()=>{
            const {model:m,view:v}=__monarch;
            const s=m.state;
            m.hall.level=2; m.syncDrum();
            s.goblins=[m.makeGoblin('worker',m.flag.x-25),m.makeGoblin('worker',m.flag.x+83),m.makeGoblin('hunter',m.flag.x+200)];
            s.enemies=[];s.camps.forEach(c=>c.guardQueue=[]);s.time=44;
            m.rebuildEnemyCache();
            s.player.x=s.player.prevX=m.flag.x+300; v.camera=s.player.x;
            s.expedition={state:'march',camp:0,drummer:s.goblins[0].id,puller:s.goblins[1].id};
            s.goblins[0].task='drum';s.goblins[1].task='drumPull';
            s.goblins[1].moving=true;s.goblins[1].speed=103;
            s.goblins.forEach(n=>n.order='expedition');
            s.drumCart={x:m.flag.x,prevX:m.flag.x,face:1,travel:120,marchAt:10};
            m.pause('qa',true);
        });
        const poses=[];
        for(const [name,age] of [['impact',.025],['raised',.26]]){
            await p.evaluate(age=>{__monarch.model.state.elapsed=10+age;},age);
            await p.waitForTimeout(250);
            poses.push(await p.evaluate(()=>{
                const s=__monarch.model.state,n=__monarch.view.painter.nodes;
                const get=(prefix)=>[...n].find(([k])=>k.startsWith(prefix))?.[1].node;
                return {arm:get('goblin'+s.expedition.drummer+':armNear@')?.angle,drum:get('drumCartDrum@')?.position.y,bed:get('drumCartBed@')?.position.y,wheel:get('drumCartWheel1@')?.position.y};
            }));
            await p.screenshot({path:path.join(__dirname,name+'.png')});
        }
        assert.ok(Math.abs(poses[1].arm-poses[0].arm)>60,JSON.stringify(poses));
        assert.ok(poses[0].drum>poses[0].bed&&poses[0].bed>poses[0].wheel,JSON.stringify(poses));
        await p.evaluate(()=>{
            const {model:m,view:v}=__monarch, s=m.state;
            s.expedition.state='assault';
            s.player.x=s.player.prevX=s.drumCart.x+104; v.camera=s.drumCart.x;
            m.selected=m.manualTarget=m.flag.id;m.selectionX=NaN;
        });
        await p.waitForTimeout(250);
        const retreat=await p.evaluate(()=>__monarch.model.context().actions.find(a=>a.type==='retreat'));
        assert.equal(retreat.cost,3);
        await p.screenshot({path:path.join(__dirname,'parked-retreat.png')});
        await p.evaluate(()=>{
            const {model:m,view:v}=__monarch,s=m.state;
            m.pause('qa',false);
            s.drumCart=undefined;s.expedition={state:'home',camp:0};
            s.goblins=[];s.player.x=s.player.prevX=3200;v.camera=3200;
        });
        const read=()=>p.evaluate(()=>{
            const {model:m,view:v}=__monarch;
            const n=v.painter.nodes.get('joystickBase@ui_joystick_base').node.position;
            return {x:m.state.player.x,axis:m.input.axis,run:m.input.run,cx:n.x+v.width/2,cy:v.height/2-n.y};
        });
        await p.waitForFunction(()=>__monarch.view.painter.nodes.has('joystickBase@ui_joystick_base'));
        const start=await read();
        assert.deepEqual([start.cx,start.cy],[130,523]);
        const cdp=await p.context().newCDPSession(p);
        const touch=(type,points=[])=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:points});
        const first={x:409,y:458,id:1};
        await touch('touchStart',[first]);await p.waitForTimeout(120);
        let stick=await read();
        assert.deepEqual([stick.cx,stick.cy,stick.axis,stick.x],[409,458,0,start.x]);
        await touch('touchMove',[{...first,y:530}]);await p.waitForTimeout(120);
        stick=await read();
        assert.deepEqual([stick.cx,stick.cy,stick.axis,stick.x],[409,458,0,start.x]);
        const right={x:686,y:530,id:1};
        await touch('touchMove',[right]);await p.waitForTimeout(160);
        stick=await read();assert.ok(stick.axis===1&&stick.x>start.x+4,JSON.stringify(stick));
        await touch('touchStart',[right,{x:1075,y:524,id:2}]);await p.waitForTimeout(180);
        stick=await read();
        assert.ok(stick.run&&stick.axis===1&&stick.cx===409,JSON.stringify(stick));
        await touch('touchCancel');await p.waitForTimeout(120);
        stick=await read();assert.deepEqual([stick.cx,stick.cy,stick.axis],[130,523,0]);
        await touch('touchStart',[{x:308,y:540,id:3}]);await p.waitForTimeout(90);
        stick=await read();assert.deepEqual([stick.cx,stick.cy,stick.axis],[308,540,0]);
        await p.screenshot({path:path.join(__dirname,'joystick-touch-origin.png')});
        await touch('touchEnd');await p.waitForTimeout(90);
        stick=await read();assert.deepEqual([stick.cx,stick.cy,stick.axis],[130,523,0]);
        await p.mouse.move(345,485);await p.mouse.down();await p.waitForTimeout(90);
        stick=await read();assert.deepEqual([stick.cx,stick.cy,stick.axis],[345,485,0]);
        await p.mouse.move(270,485);await p.waitForTimeout(90);
        assert.equal((await read()).axis,-1);
        await p.mouse.up();await p.waitForTimeout(90);
        stick=await read();assert.deepEqual([stick.cx,stick.cy,stick.axis],[130,523,0]);
        assert.deepEqual(errors,[]);
        fs.writeFileSync(path.join(__dirname,'render-report.json'),JSON.stringify({poses,retreatCost:retreat.cost,floatingJoystick:'touch, multitouch, cancel, release and mouse passed',errors},null,2));
        console.log('PASS: cart sprites, two drum poses, retreat controls, floating joystick and multitouch',poses);
    } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
