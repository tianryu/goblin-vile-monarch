// 自然AI到达驻点后的呼吸、眨眼、光边与暂停，保持独立存档上下文。
const {chromium}=require('playwright'),fs=require('fs');let browser;
(async()=>{
 const r={scope:'Eleven rank idle loops, isolated desktop Edge software WebGL',passes:[],failures:[],errors:[],cases:[]};const check=(n,c)=>(c?r.passes:r.failures).push(n);
 browser=await chromium.launch({channel:'msedge',headless:true,args:['--enable-webgl','--use-angle=swiftshader']});
 const context=await browser.newContext({viewport:{width:1100,height:550}}),page=await context.newPage();
 page.on('pageerror',e=>r.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')r.errors.push(m.text())});
 await page.goto('http://127.0.0.1:42819/');await page.waitForFunction(()=>window.__goblinState?.fire_mode,null,{timeout:60000});
 const cmd=c=>page.evaluate(c=>window.goblinQaCommand(JSON.stringify(c)),c),state=()=>page.evaluate(()=>window.__goblinState);await cmd({op:'motion_probe'});
 let cases=[['worker',1],['hunter',1],['brute',1],['thief',1],['worker',2],['hunter',2],['brute',2],['thief',2],['worker',3],['hunter',3],['brute',3],['thief',3]];
 if(process.argv.includes('--hunter3-only'))cases=cases.filter(c=>c[0]==='hunter'&&c[1]===3);
 for(const [role,rank] of cases){
  const name=role+(rank>1?'_'+rank:'');
  await cmd({op:'new',seed:897});await cmd({op:'clear'});await cmd({op:'levels',rank});await cmd({op:'time',value:30});
  const sites=(await state()).sites,den=sites.find(b=>b.kind==='den');
  // 初始ID68的自然驻点，允许AI最后自行走完几步。
  const x={worker:60,hunter:-180,brute:12,thief:den.x+55}[role];
  await cmd({op:'unit',role,x});await cmd({op:'move',x});await page.waitForTimeout(650);
  const samples=[];for(let i=0;i<38;i++){await page.waitForTimeout(80);samples.push(await state());}
  const bodies=samples.map(s=>s.motion.actors.filter(a=>a.requested&&a.scope.startsWith('world/unit/')&&a.animation===name+'/idle'));
  const poses=bodies.flat(),frames=new Set(poses.map(a=>JSON.stringify(a.source)));
  check(name+': breathing loop advances',poses.length>24&&frames.size>=15);
  check(name+': one opaque body, no transition clone',bodies.every(a=>a.length===1&&a[0].alpha>.999&&a[0].tint_alpha>.999));
  check(name+': feet remain planted',poses.length>0&&Math.max(...poses.map(a=>a.rect[1]+a.rect[3]))-Math.min(...poses.map(a=>a.rect[1]+a.rect[3]))<.05);
  check(name+': proximity target retains its outline',samples.some(s=>s.glow));
  check(name+': visual loop has no coin or dialog side effects',samples.every(s=>s.gold===18&&s.modal===''));
  await cmd({op:'freeze'});await page.waitForTimeout(250);const a=await state();await page.waitForTimeout(300);const b=await state();
  check(name+': pause freezes current pose',a.water_time===b.water_time&&JSON.stringify(a.motion.actors.filter(x=>x.requested).map(x=>x.source))===JSON.stringify(b.motion.actors.filter(x=>x.requested).map(x=>x.source)));
  r.cases.push({name,source_frames:frames.size,decoded_bytes:b.animation.decoded_bytes});await page.screenshot({path:'qa/animation-v8/'+name+'-idle-engine.png'});
 }
 check('No runtime or shader errors',r.errors.length===0);r.scope='Rank idle loops, isolated desktop Edge software WebGL';fs.writeFileSync('qa/godot/v8-idle-animation'+(process.argv.includes('--hunter3-only')?'-hunter3':'')+'.json',JSON.stringify(r,null,2));await browser.close();console.log(JSON.stringify(r));process.exitCode=r.failures.length?1:0;
})().catch(async e=>{console.error(e);if(browser)await browser.close();process.exitCode=1});
