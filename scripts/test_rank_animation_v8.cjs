// 隔离浏览器中的真实职业AI，不修改正式玩家存档。
const {chromium}=require('playwright'),fs=require('fs');let browser;
(async()=>{
 const r={scope:'Seven full-cycle rank walks in isolated desktop Edge software WebGL',passes:[],failures:[],errors:[],cases:[]};
 const check=(n,c)=>(c?r.passes:r.failures).push(n);
 browser=await chromium.launch({channel:'msedge',headless:true,args:['--enable-webgl','--use-angle=swiftshader']});
 const context=await browser.newContext({viewport:{width:1100,height:550}}),page=await context.newPage();
 page.on('pageerror',e=>r.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')r.errors.push(m.text())});
 await page.goto('http://127.0.0.1:42819/');await page.waitForFunction(()=>window.__goblinState?.fire_mode,null,{timeout:60000});
 const cmd=c=>page.evaluate(c=>window.goblinQaCommand(JSON.stringify(c)),c),state=()=>page.evaluate(()=>window.__goblinState);
 await cmd({op:'motion_probe'});
 let cases=[['worker',3],['brute',1],['brute',2],['brute',3],['thief',1],['thief',2],['thief',3]];
 if(process.argv.includes('--added'))cases=[['worker',2],['hunter',1],['hunter',2]];
 if(process.argv.includes('--hunter3-only'))cases=[['hunter',3]];
 for(const [role,rank] of cases){
  const name=role+(rank>1?'_'+rank:'');
  await cmd({op:'new',seed:896});await cmd({op:'clear'});await cmd({op:'levels',rank});await cmd({op:'time',value:30});
  await cmd({op:'unit',role,x:400});await cmd({op:'move',x:400});
  const samples=[];for(let i=0;i<44;i++){await page.waitForTimeout(65);samples.push(await state());}
  const bodies=samples.map(s=>s.motion.actors.filter(a=>a.requested&&a.scope.startsWith('world/unit/')&&a.animation===name+'/walk'));
  const frames=bodies.flat().map(a=>JSON.stringify(a.source));
  check(name+': complete gait advances',frames.length>24&&new Set(frames).size>=20);
  check(name+': one stable body identity',bodies.every(a=>a.length<=1));
  check(name+': no extra coin transactions',samples.every(s=>s.gold===18&&s.modal===''));
  const last=await state(),unit=last.units[0];
  check(name+': AI actually travels',unit&&Math.abs(unit.x-400)>90);
  const anchor=samples.map(s=>s.hero_anchor[1]);check(name+': ground anchor stays flat',Math.max(...anchor)-Math.min(...anchor)<0.05);
  await cmd({op:'freeze'});await page.waitForTimeout(250);const a=await state();await page.waitForTimeout(330);const b=await state();
  check(name+': paused animation stays still',a.water_time===b.water_time&&JSON.stringify(a.motion.actors.filter(x=>x.requested).map(x=>x.source))===JSON.stringify(b.motion.actors.filter(x=>x.requested).map(x=>x.source)));
  r.cases.push({name,frames:new Set(frames).size,travel:unit?unit.x-400:null,decoded_bytes:last.animation.decoded_bytes});
  await page.screenshot({path:'qa/animation-v8/'+name+'-walk-engine.png'});
 }
 check('No runtime or shader errors',r.errors.length===0);
 fs.writeFileSync('qa/godot/v8-rank-animation'+(process.argv.includes('--hunter3-only')?'-hunter3':process.argv.includes('--added')?'-added':'')+'.json',JSON.stringify(r,null,2));await browser.close();console.log(JSON.stringify(r));process.exitCode=r.failures.length?1:0;
})().catch(async e=>{console.error(e);if(browser)await browser.close();process.exitCode=1});
