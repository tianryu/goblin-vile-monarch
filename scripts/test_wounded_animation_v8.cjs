// 活伤兵、静止尸体与笼内俘虏分别观察，播放不能再次结算伤亡或金币。
const {chromium}=require('playwright'),fs=require('fs');let browser;
(async()=>{
 const r={scope:'Living wounded and still corpses, then captive rear/front cage occlusion in isolated desktop Edge software WebGL',passes:[],failures:[],errors:[],cases:[]};const check=(n,c)=>(c?r.passes:r.failures).push(n);
 browser=await chromium.launch({channel:'msedge',headless:true,args:['--enable-webgl','--use-angle=swiftshader']});const ctx=await browser.newContext({viewport:{width:1100,height:550}}),page=await ctx.newPage();page.on('pageerror',e=>r.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')r.errors.push(m.text())});
 await page.goto('http://127.0.0.1:42819/');await page.waitForFunction(()=>window.__goblinState?.fire_mode,null,{timeout:60000});const cmd=c=>page.evaluate(c=>window.goblinQaCommand(JSON.stringify(c)),c),state=()=>page.evaluate(()=>window.__goblinState);await cmd({op:'motion_probe'});
 for(const type of (process.argv.includes('--cage-only')?[]:['human','elf','dwarf'])){
  await cmd({op:'new',seed:903});await cmd({op:'clear'});await cmd({op:'time',value:30});await cmd({op:'move',x:400});await cmd({op:'fall',type,x:350});await cmd({op:'fall',type,x:520,dead:true});await page.waitForTimeout(450);
  const ids=(await state()).enemies,live=ids.find(e=>e.mode==='downed').id,dead=ids.find(e=>e.mode==='dead').id,start=(await state()).water_time,samples=[];
  for(let i=0;i<85;i++){await page.waitForTimeout(45);const s=await state();samples.push(s);if(s.water_time-start>2.5)break;}
  const subject=(s,id)=>s.motion.actors.filter(a=>a.requested&&a.scope==='world/enemy/'+id),alive=samples.flatMap(s=>subject(s,live)),still=samples.flatMap(s=>subject(s,dead));
  check(type+': wounded body uses a complete struggle loop',alive.length>28&&alive.every(a=>a.animation===type+'_wounded/struggle')&&new Set(alive.map(a=>JSON.stringify(a.source))).size>=17);
  check(type+': corpse stays still',still.length>28&&still.every(a=>!a.animation)&&new Set(still.map(a=>JSON.stringify([a.source,a.rect]))).size===1);
  check(type+': exactly one body per subject',samples.every(s=>subject(s,live).length===1&&subject(s,dead).length===1));check(type+': animation does not change living/dead states or pay coins',samples.every(s=>s.gold===18&&s.enemies.length===2&&s.enemies.find(e=>e.id===live)?.mode==='downed'&&s.enemies.find(e=>e.id===dead)?.mode==='dead'&&s.modal===''));
  await cmd({op:'freeze'});await page.screenshot({path:'qa/animation-v8/'+type+'-wounded-and-corpse-engine.png'});r.cases.push({type,poses:new Set(alive.map(a=>JSON.stringify(a.source))).size});
 }
 await cmd({op:'scene',time:30});await cmd({op:'clear'});const prison=(await state()).sites.find(b=>b.kind==='prison');await cmd({op:'move',x:prison.x});await cmd({op:'unfreeze'});await page.waitForTimeout(500);const samples=[],start=(await state()).water_time;
 for(let i=0;i<80;i++){await page.waitForTimeout(50);const s=await state();samples.push(s);if(s.water_time-start>2.5)break;}
 const people=samples.flatMap(s=>s.motion.surface.filter(a=>a.requested&&a.scope.includes('/captive/')&&a.animation==='captive_human/idle'));
 check('Captive breathes and blinks inside the cage',new Set(people.map(a=>JSON.stringify(a.source))).size>=17);
 r.cage_layers=samples.map(s=>{const p=s.motion.surface.find(a=>a.requested&&a.scope.includes('/captive/')&&a.animation==='captive_human/idle'),front=s.motion.surface.find(a=>a.requested&&a.scope==='world/building/'+prison.id+'/front'),rear=s.motion.surface.find(a=>a.requested&&a.scope==='world/building/'+prison.id);return {rear:rear?.layer,person:p?.layer,front:front?.layer,prison_id:prison.id};});
 check('Prison keeps rear, prisoner and front layers in that order',r.cage_layers.length>0&&r.cage_layers.every(x=>x.rear<x.person&&x.person<x.front));
 check('Prison breathing does not sell captives or create a dialog',samples.every(s=>s.captives===2&&s.modal===''));
 await cmd({op:'freeze'});await page.waitForTimeout(220);const a=await state();await page.waitForTimeout(350);const b=await state();check('Pause freezes captive pose',a.water_time===b.water_time&&JSON.stringify(a.motion.surface.filter(x=>x.requested&&x.scope.includes('/captive/')).map(x=>x.source))===JSON.stringify(b.motion.surface.filter(x=>x.requested&&x.scope.includes('/captive/')).map(x=>x.source)));
 await page.screenshot({path:'qa/animation-v8/prison-captive-idle-engine.png'});r.prison_sample=b.motion.surface.filter(x=>x.requested&&x.scope.startsWith('world/building/'+prison.id));
 check('No runtime or shader errors',r.errors.length===0);fs.writeFileSync('qa/godot/v8-wounded-animation'+(process.argv.includes('--cage-only')?'-cage':'')+'.json',JSON.stringify(r,null,2));await browser.close();console.log(JSON.stringify({passes:r.passes.length,failures:r.failures,errors:r.errors,cage_layers:r.cage_layers}));process.exitCode=r.failures.length?1:0;
})().catch(async e=>{console.error(e);if(browser)await browser.close();process.exitCode=1});
