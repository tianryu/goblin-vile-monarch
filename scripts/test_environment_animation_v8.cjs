// 在真实地图中寻找可见松树与已解锁集结旗，验证锚点和光边随帧更新。
const {chromium}=require('playwright'),fs=require('fs');let browser;
(async()=>{
 const r={scope:'Environment cloth and foliage in isolated desktop Edge software WebGL',passes:[],failures:[],errors:[],cases:[]};const check=(n,c)=>(c?r.passes:r.failures).push(n);
 browser=await chromium.launch({channel:'msedge',headless:true,args:['--enable-webgl','--use-angle=swiftshader']});const ctx=await browser.newContext({viewport:{width:1100,height:550}}),page=await ctx.newPage();page.on('pageerror',e=>r.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')r.errors.push(m.text())});await page.goto('http://127.0.0.1:42819/');await page.waitForFunction(()=>window.__goblinState?.fire_mode,null,{timeout:60000});
 const cmd=c=>page.evaluate(c=>window.goblinQaCommand(JSON.stringify(c)),c),state=()=>page.evaluate(()=>window.__goblinState);await cmd({op:'motion_probe'});await cmd({op:'new',seed:904});await cmd({op:'clear'});if(!process.argv.includes('--hall-only'))await cmd({op:'levels',rank:3});await cmd({op:'time',value:30});
 const willow=process.argv.includes('--willow-only'),hall=process.argv.includes('--hall-only');
 for(const [id,folder] of (hall?[['hall1/wind','hall1-wind-v03/extracted-v01']]:willow?[['tree_willow/wind','tree_willow-wind-v01/extracted-video-v01']]:[['tree_pine/wind','tree_pine-wind-v01/extracted-v02'],['tribal_banner/wind','tribal_banner-wind-v02/extracted-v02']])){
  let position=null;
  const positions=hall?(await state()).sites.filter(b=>b.kind==='hall').map(b=>b.x-160):id.startsWith('tree_')?[-900,-500,400,1000,1600,2300]:(await state()).sites.filter(b=>b.kind==='rally'&&b.visible).map(b=>b.x);
  for(const x of positions){await cmd({op:'move',x});await page.waitForTimeout(450);const s=await state(),found=s.motion.surface.find(a=>a.requested&&a.animation===id);if(found){position=id.startsWith('tree_')?Number(found.scope.split('/').pop()):x;break;}}
  if(position===null){check(id+': visible real-map fixture exists',false);continue;}
  // 世界保留屏外裁切余量。把实际对象移到镜头中心后再观察，不能将余量内请求等同于屏内可见。
  await cmd({op:'move',x:position});await page.waitForTimeout(450);
  const samples=[],start=(await state()).water_time;for(let i=0;i<150;i++){await page.waitForTimeout(45);const s=await state();samples.push(s);if(s.water_time-start>(hall?4.8:2.6))break;}
  const poses=samples.flatMap(s=>s.motion.surface.filter(a=>a.requested&&a.animation===id)),scopes=[...new Set(poses.map(a=>a.scope))];
  check(id+': complete wind cycle advances',new Set(poses.map(a=>JSON.stringify(a.source))).size>=17);check(id+': one fixed placement per object',scopes.length>0&&scopes.every(scope=>new Set(poses.filter(a=>a.scope===scope).map(a=>JSON.stringify(a.rect))).size===1));
  const root=JSON.parse(fs.readFileSync('artifacts/animation-v8/'+folder+(willow?'/root-audit-low-band.json':'/root-audit.json')));check(id+': source base stays fixed within one source pixel',root.bottom_range===0&&root.left_range<=1&&root.right_range<=1);
  check(id+': no coin or dialog side effects',samples.every(s=>s.gold===18&&s.modal===''));
  if(id.startsWith('tribal_'))check('Flag proximity glow remains available',samples.some(s=>s.glow));
  await cmd({op:'freeze'});await page.waitForTimeout(220);const a=await state();await page.waitForTimeout(330);const b=await state();check(id+': pause freezes the current wind pose',a.water_time===b.water_time&&JSON.stringify(a.motion.surface.filter(x=>x.requested&&x.animation===id).map(x=>x.source))===JSON.stringify(b.motion.surface.filter(x=>x.requested&&x.animation===id).map(x=>x.source)));
  await page.screenshot({path:'qa/animation-v8/'+id.replace('/','-')+'-engine.png'});r.cases.push({id,position,source_frames:new Set(poses.map(a=>JSON.stringify(a.source))).size});await cmd({op:'unfreeze'});
 }
 check('No runtime or shader errors',r.errors.length===0);fs.writeFileSync('qa/godot/v8-environment-animation'+(hall?'-hall':willow?'-willow':'')+'.json',JSON.stringify(r,null,2));await browser.close();console.log(JSON.stringify(r));process.exitCode=r.failures.length?1:0;
})().catch(async e=>{console.error(e);if(browser)await browser.close();process.exitCode=1});
