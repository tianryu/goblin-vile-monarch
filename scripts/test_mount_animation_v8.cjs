// 真实方向与奔跑输入，地面脚线和蝙蝠低空飞行分别验证。
const {chromium}=require('playwright'),fs=require('fs');let browser;
(async()=>{
 const r={scope:'Generated mount walks, runs and bat flight in isolated desktop Edge software WebGL',passes:[],failures:[],errors:[],cases:[]};const check=(n,c)=>(c?r.passes:r.failures).push(n);
 browser=await chromium.launch({channel:'msedge',headless:true,args:['--enable-webgl','--use-angle=swiftshader']});
 const context=await browser.newContext({viewport:{width:1100,height:550},hasTouch:true}),page=await context.newPage();
 page.on('pageerror',e=>r.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')r.errors.push(m.text())});
 await page.goto('http://127.0.0.1:42819/');await page.waitForFunction(()=>window.__goblinState?.fire_mode,null,{timeout:60000});
 const cmd=c=>page.evaluate(c=>window.goblinQaCommand(JSON.stringify(c)),c),state=()=>page.evaluate(()=>window.__goblinState);await cmd({op:'motion_probe'});
 let cases=[['boar','walk'],['lizard','walk'],['lizard','run'],['wolf','walk'],['wolf','run'],['bat','run']];
 if(process.argv.includes('--bat-only'))cases=cases.filter(c=>c[0]==='bat');
 for(const [mount,action] of cases){
  const id='rider_'+mount+'/'+action;
  await cmd({op:'new',seed:898});await cmd({op:'clear'});await cmd({op:'time',value:30});await cmd({op:'mount',mount});await cmd({op:'move',x:0});
  check(id+': requested clip is installed',(await state()).animation.clips.includes(id));
  await page.keyboard.down('ArrowRight');if(action==='run')await page.keyboard.down('Shift');
  await page.waitForTimeout(400);const start=(await state()).water_time,samples=[];
  // 用实际游戏时钟覆盖一个完整周期；浏览器调用和截图耗时不能把短耐力夹具耗尽。
  for(let i=0;i<100;i++){await page.waitForTimeout(45);const s=await state();samples.push(s);if(s.water_time-start>(mount==='bat'?2.4:2.5))break;}
  const bodies=samples.map(s=>s.motion.actors.filter(a=>a.requested&&a.scope==='world/hero'&&a.animation===id)),poses=bodies.flat(),frames=new Set(poses.map(a=>JSON.stringify(a.source)));
  check(id+': full generated cycle advances',poses.length>(mount==='bat'?15:28)&&frames.size>=(mount==='bat'?13:22));
  check(id+': monarch and mount stay one opaque subject',bodies.every(a=>a.length===1&&a[0].alpha>.999&&a[0].tint_alpha>.999));
  const anchors=samples.map(s=>s.hero_anchor[1]+s.fly*s.viewport[1]/480);
  check(id+': terrain anchor is flat',Math.max(...anchors)-Math.min(...anchors)<.05);
  if(mount==='bat')check(id+': actual low flight is active',samples.every(s=>s.fly>20));
  check(id+': no extra coin transactions or dialogs',samples.every(s=>s.gold===18&&s.modal===''));
  await cmd({op:'freeze'});await page.screenshot({path:'qa/animation-v8/'+mount+'-'+action+'-right-engine.png'});
  await page.keyboard.up('ArrowRight');await page.keyboard.down('ArrowLeft');await cmd({op:'unfreeze'});await page.waitForTimeout(350);const left=await state();
  check(id+': opposite direction flips the same complete body',left.hero_face===-1&&left.motion.actors.some(a=>a.requested&&a.scope==='world/hero'&&a.animation===id&&a.rect[2]<0));
  await cmd({op:'freeze'});await page.screenshot({path:'qa/animation-v8/'+mount+'-'+action+'-left-engine.png'});
  await page.waitForTimeout(250);const a=await state();await page.waitForTimeout(300);const b=await state();
  check(id+': pause freezes current pose',a.water_time===b.water_time&&JSON.stringify(a.motion.actors.filter(x=>x.requested&&x.scope==='world/hero').map(x=>x.source))===JSON.stringify(b.motion.actors.filter(x=>x.requested&&x.scope==='world/hero').map(x=>x.source)));
  await page.keyboard.up('ArrowLeft');if(action==='run')await page.keyboard.up('Shift');
  r.cases.push({id,source_frames:frames.size,decoded_bytes:b.animation.decoded_bytes});
 }
 check('No runtime or shader errors',r.errors.length===0);fs.writeFileSync('qa/godot/v8-mount-animation'+(process.argv.includes('--bat-only')?'-bat':'')+'.json',JSON.stringify(r,null,2));await browser.close();console.log(JSON.stringify(r));process.exitCode=r.failures.length?1:0;
})().catch(async e=>{console.error(e);if(browser)await browser.close();process.exitCode=1});
