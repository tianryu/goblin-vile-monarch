// 在隔离存档中用真实追击AI检查动画、就近转向和暂停，不改战斗数值。
const {chromium}=require('playwright'),fs=require('fs');let browser;
(async()=>{
 const r={scope:'Enemy walking and nearest-target facing in isolated desktop Edge software WebGL',passes:[],failures:[],errors:[],cases:[]};const check=(n,c)=>(c?r.passes:r.failures).push(n);
 browser=await chromium.launch({channel:'msedge',headless:true,args:['--enable-webgl','--use-angle=swiftshader']});const ctx=await browser.newContext({viewport:{width:1300,height:600}}),page=await ctx.newPage();
 page.on('pageerror',e=>r.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')r.errors.push(m.text())});await page.goto('http://127.0.0.1:42819/');await page.waitForFunction(()=>window.__goblinState?.fire_mode,null,{timeout:60000});
 const cmd=c=>page.evaluate(c=>window.goblinQaCommand(JSON.stringify(c)),c),state=()=>page.evaluate(()=>window.__goblinState);await cmd({op:'motion_probe'});
 const melee=process.argv.includes('--elf-melee-only');const cases=melee||process.argv.includes('--elf-only')?['elf']:['human','dwarf'];
 for(const type of cases){const asset=melee?'elf_melee':type;
  await cmd({op:'new',seed:902});await cmd({op:'clear'});await cmd({op:'time',value:30});await cmd({op:'move',x:400});await cmd({op:'spawn',type,side:1,x:900,ammo:melee?0:6});await page.waitForTimeout(450);
  const start=(await state()).water_time,samples=[];for(let i=0;i<(melee?160:85);i++){await page.waitForTimeout(45);const s=await state();samples.push(s);if(s.water_time-start>(melee?4.8:2.6))break;}
  const bodies=samples.map(s=>s.motion.actors.filter(a=>a.requested&&a.scope.startsWith('world/enemy/')&&a.animation===asset+'/walk')),poses=bodies.flat();
  const clip=JSON.parse(fs.readFileSync('game/art/animation/manifest.json')).clips[asset+'/walk'];check(type+': a complete generated gait plays',new Set(poses.map(a=>JSON.stringify(a.source))).size>=(type==='elf'?Math.ceil(clip.frames.length*.85):22));
  check(type+': one solid subject in each observed frame',bodies.every(a=>a.length===1&&a[0].alpha>.999&&a[0].tint_alpha>.999));
  const end=await state(),enemy=end.enemies[0];check(type+': actual AI approaches the nearby chief',enemy&&enemy.x<800&&enemy.face===-1&&enemy.moving);
  check(type+': left-facing art agrees with target direction',poses.every(a=>a.rect[2]>0));check(type+': no extra transactions or dialogs',samples.every(s=>s.gold===18&&s.modal===''));
  await cmd({op:'freeze'});await page.screenshot({path:'qa/animation-v8/'+asset+'-walk-left-engine.png'});
  await cmd({op:'move',x:enemy.x+(type==='elf'&&!melee?310:230)});await cmd({op:'unfreeze'});await page.waitForTimeout(500);const turned=await state(),right=turned.motion.actors.filter(a=>a.requested&&a.scope.startsWith('world/enemy/')&&a.animation===asset+'/walk');
  check(type+': a nearer target behind changes actual facing',turned.enemies[0]?.face===1&&right.length===1&&right[0].rect[2]<0);
  await cmd({op:'freeze'});await page.waitForTimeout(220);const a=await state();await page.waitForTimeout(330);const b=await state();check(type+': pause holds the current pose',a.water_time===b.water_time&&JSON.stringify(a.motion.actors.filter(x=>x.requested).map(x=>x.source))===JSON.stringify(b.motion.actors.filter(x=>x.requested).map(x=>x.source)));
  await page.screenshot({path:'qa/animation-v8/'+asset+'-walk-right-engine.png'});r.cases.push({type,poses:new Set(poses.map(a=>JSON.stringify(a.source))).size,travel:900-enemy.x});
 }
 check('No runtime or shader errors',r.errors.length===0);fs.writeFileSync('qa/godot/v8-enemy-animation'+(melee?'-elf-melee':process.argv.includes('--elf-only')?'-elf':'')+'.json',JSON.stringify(r,null,2));await browser.close();console.log(JSON.stringify(r));process.exitCode=r.failures.length?1:0;
})().catch(async e=>{console.error(e);if(browser)await browser.close();process.exitCode=1});
