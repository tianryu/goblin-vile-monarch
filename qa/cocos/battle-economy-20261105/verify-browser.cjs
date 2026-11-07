// 使用隔离浏览器上下文检查本批画面和实际音频组件，不使用玩家存档。
const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const template=fs.readFileSync(path.join(__dirname,'../playtest-fix-20261105/verify-browser.cjs'),'utf8');
const prefix=template.slice(0,template.indexOf('async function verify()')).replace('build/playtest-fix-20261105','build/battle-economy-20261105');
const server=new Function('require','__dirname',prefix+'\nreturn server;')(require,__dirname);
async function main(){
    await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
    const browser=await chromium.launch({channel:'msedge',headless:true,args:['--enable-gpu','--use-angle=d3d11']});
    const results=[],errors=[];
    try{
        const page=await browser.newPage({viewport:{width:1280,height:600},hasTouch:true,isMobile:true});
        page.on('pageerror',e=>errors.push(e.message));
        await page.addInitScript(()=>window.__MONARCH_QA__=true);
        await page.goto('http://127.0.0.1:'+server.address().port);
        await page.waitForFunction(()=>!!window.__monarch);
        await page.evaluate(()=>{const{model:m,menus}=__monarch;Object.assign(m.state.chapter.seen,{opening:true,expedition:true,trader:true,general:true});m.state.chapter.guidesSkipped=true;menus.close('continue');});
        await page.waitForFunction(()=>!__monarch.model.pauses.size);
        await page.mouse.click(640,350);
        await page.evaluate(()=>{
            const{model:m,view}=__monarch,s=m.state;window.__qaTick=m.tick.bind(m);m.tick=()=>{};
            s.enemies=[];s.companies=[];s.goblins=[];s.animals=[];s.effects=[];s.shots=[];s.day=6;s.time=98;s.elapsed=500;m.hall.level=2;
            const wall=s.buildings.find(b=>b.kind==='wall'&&b.region===-1);Object.assign(wall,{level:1,hp:80,maxHp:120,job:{left:10,total:16,next:2}});
            const n=m.makeGoblin('worker',wall.x-25);n.task='construction';n.targetId=wall.id;s.goblins=[n];s.player.x=s.player.prevX=wall.x-185;view.camera=s.player.x;
        });
        await page.waitForTimeout(800);
        const upgrade=await page.evaluate(()=>{
            const{model:m,view:v}=__monarch,wall=m.state.buildings.find(b=>b.kind==='wall'&&b.region===-1),p=v.painter.nodes;
            const current=p.get('building'+wall.id+'@wall1'),ghost=p.get('buildingUpgradeGhost'+wall.id+'@wall2');
            return{currentArt:current?.sprite.spriteFrame===v.art.frames.get('wall1'),opacity:current?.opacity.opacity,ghostOpacity:ghost?.opacity.opacity,
                hp:p.get('hpBuilding'+wall.id+':back@ui_bar')?.opacity.opacity,progress:p.get('job'+wall.id+':back@ui_bar')?.opacity.opacity};
        });
        assert.equal(upgrade.currentArt,true);assert.equal(upgrade.opacity,255);assert.ok(upgrade.ghostOpacity>40&&upgrade.ghostOpacity<90);assert.equal(upgrade.hp,255);assert.equal(upgrade.progress,255);
        results.push({name:'升级期间当前建筑完整显示，保留血条和施工条',details:upgrade});
        await page.screenshot({path:path.join(__dirname,'building-upgrade.png')});
        const damage=await page.evaluate(()=>{const m=__monarch.model,w=m.state.buildings.find(b=>b.kind==='wall'&&b.region===-1);const hp=w.hp;m.hurtTarget(w.id,12,w.x+100);return{before:hp,after:w.hp,job:!!w.job,level:w.level};});
        assert.ok(damage.after<damage.before);assert.equal(damage.level,1);assert.equal(damage.job,true);results.push({name:'升级中仍能正常受击',details:damage});
        await page.evaluate(()=>{const{model:m,view}=__monarch,s=m.state;for(const b of s.buildings)b.job=undefined;s.goblins=[];Object.assign(m.flag,{level:1,hp:100,maxHp:100});s.player.x=s.player.prevX=m.flag.x-120;view.camera=s.player.x;s.elapsed=500;s.time=65;});
        await page.waitForTimeout(650);
        const ground=await page.evaluate(()=>{const{model:m,view:v}=__monarch,item=v.painter.nodes.get('building'+m.flag.id+':'+m.flag.x+'@war_drum'),info=v.art.info('war_drum');return{height:item?.transform.height*info.contentHeight/info.height,alpha:item?.opacity.opacity};});
        assert.ok(Math.abs(ground.height-61)<.01);assert.equal(ground.alpha,255);await page.screenshot({path:path.join(__dirname,'drum-ground.png')});
        await page.evaluate(()=>{
            const{model:m}=__monarch,s=m.state,x=m.flag.x;
            const a=m.makeGoblin('worker',x-25),b=m.makeGoblin('worker',x+83),n=m.makeGoblin('hunter',x-160);a.task='drum';b.task='drumPull';a.order=b.order=n.order='expedition';
            s.goblins=[a,b,n];s.expedition={state:'march',camp:0,drummer:a.id,puller:b.id};s.drumCart={x,prevX:x,face:1,travel:0,marchAt:s.elapsed-.2};s.player.x=s.player.prevX=x+180;__monarch.view.camera=s.player.x;
        });
        await page.waitForTimeout(900);
        const march=await page.evaluate(()=>{const{view:v}=__monarch,info=v.art.info('war_drum'),n=v.painter.nodes.get('drumCartDrum@war_drum'),game=v.root.parent.components.find(c=>c.world===v);return{height:n?.transform.height*info.contentHeight/info.height,volume:game.audio.loops.get('march_drums').source.volume};});
        assert.ok(Math.abs(march.height-ground.height)<.01);assert.ok(march.volume>.349);await page.screenshot({path:path.join(__dirname,'drum-march.png')});
        await page.evaluate(()=>__monarch.model.state.expedition.state='assault');await page.waitForTimeout(450);
        const assault=await page.evaluate(()=>{const v=__monarch.view,game=v.root.parent.components.find(c=>c.world===v);return{volume:game.audio.loops.get('march_drums').source.volume,playing:__monarch.model.drumPlaying};});
        assert.ok(assault.volume>=march.volume-.001);assert.equal(assault.playing,true);results.push({name:'地面与车上鼓同尺寸，行军和攻城鼓乐音量一致',details:{ground,march,assault}});
        await page.evaluate(()=>{const m=__monarch.model;m.state.expedition.state='march';m.state.player.x=4000;m.state.player.prevX=4000;m.state.drumCart.x=m.state.drumCart.prevX=3820;__monarch.view.camera=4000;});
        const follow=await page.evaluate(()=>{
            const m=__monarch.model,s=m.state;const checks=[];
            for(const face of[1,-1]){m.input.run=true;for(let i=0;i<40;i++){s.player.prevX=s.player.x;s.player.face=face;s.player.x+=face*437.5*.05;m.updateExpedition(.05);}checks.push({face,gap:Math.abs(s.player.x-s.drumCart.x),anchor:m.marchAnchor,player:s.player.x});}
            return checks;
        });
        results.push({name:'构建内鼓车双向奔跑跟随且不限制军队锚点',details:follow});assert.ok(follow.every(q=>Math.abs(q.anchor-q.player)<.01));assert.ok(follow.every(q=>q.gap<=200));
        assert.deepEqual(errors,[]);results.push({name:'浏览器无未捕获异常',details:errors});
        fs.writeFileSync(path.join(__dirname,'browser-results.json'),JSON.stringify({timestamp:new Date().toISOString(),device:'desktop Edge D3D11, 1280x600 touch emulation',results},null,2));
        console.log(JSON.stringify(results,null,2));
    }catch(e){fs.writeFileSync(path.join(__dirname,'browser-failure.json'),JSON.stringify({error:e.stack,results,errors},null,2));throw e;}
    finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
