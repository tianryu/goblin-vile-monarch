// 只在隔离QA存档摆出四档真实角色，截图仍由正式引擎与正式资源绘制。
const {chromium}=require('playwright'),fs=require('fs'),path=require('path'),assert=require('assert/strict');
const out=process.env.MONARCH_QA_OUT||path.resolve(__dirname,'../../qa/cocos/armor-v10');fs.mkdirSync(out,{recursive:true});
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const p=await browser.newPage({viewport:{width:1280,height:600}}),report={checks:[],errors:[],realPhone:false};
p.on('pageerror',e=>report.errors.push(String(e)));p.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});
await p.addInitScript(()=>globalThis.__MONARCH_QA__=true);
try{await p.goto(process.env.MONARCH_URL||'http://127.0.0.1:42823/');await p.waitForFunction(()=>globalThis.__monarch?.view,null,{timeout:60000});
await p.evaluate(()=>{__monarch.reset();const m=__monarch.model;m.state.time=55;m.state.elapsed=40;m.state.player.x=1550;__monarch.view.camera=2100;
 m.state.goblins.forEach((n,i)=>{n.role='hunter';n.gear=i;n.x=n.prevX=1800+i*190;n.targetX=n.x;n.moving=false;n.task='';n.hidden=0;n.carry=0;n.order='home';});m.pause('qa',true);});
await p.waitForTimeout(400);await p.screenshot({path:path.join(out,'four-qualities.png')});
const r=await p.evaluate(()=>({rigs:[...__monarch.view.art.rigs.keys()],actors:__monarch.model.state.goblins.map(n=>({id:n.id,gear:n.gear,parts:[...__monarch.view.painter.nodes.entries()].filter(([key])=>key.startsWith('goblin'+n.id+':')).map(([key,d])=>({key,x:d.node.position.x,y:d.node.position.y,angle:d.node.angle,opacity:d.node._uiProps.opacity}))}))}));
assert.ok(['hunter','hunter_2','hunter_3','hunter_4'].every(n=>r.rigs.includes(n)));assert.ok(r.actors.every(n=>n.parts.length===6));report.checks.push({name:'four-real-gear-assets-six-cutout-parts',pass:true});
for(const phase of [0,.15,.3,.45]){await p.evaluate(t=>{const m=__monarch.model;m.state.elapsed=40+t;m.state.goblins.forEach(n=>{n.moving=true;n.speed=160;n.face=-1;});},phase);await p.waitForTimeout(80);await p.screenshot({path:path.join(out,'running-left-'+phase+'.png')});}
await p.evaluate(()=>{const m=__monarch.model;m.state.goblins.forEach(n=>{n.moving=false;n.face=1;n.hit=.7;});m.state.elapsed=41;});await p.waitForTimeout(100);await p.screenshot({path:path.join(out,'hit.png')});
await p.evaluate(()=>{const m=__monarch.model;m.state.goblins.forEach(n=>{n.hit=0;n.cooldown=1;});});await p.waitForTimeout(100);await p.screenshot({path:path.join(out,'bow-pose.png')});
await p.setViewportSize({width:844,height:390});await p.evaluate(()=>{__monarch.view.camera=2100;__monarch.model.state.goblins.forEach(n=>n.cooldown=0);});await p.waitForTimeout(250);await p.screenshot({path:path.join(out,'four-qualities-mobile.png')});
assert.deepEqual(report.errors,[]);report.checks.push({name:'desktop-and-landscape-mobile-render-no-errors',pass:true});
report.actors=r.actors;
}catch(e){report.failure=String(e);process.exitCode=1;}finally{fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));await browser.close();}})();
