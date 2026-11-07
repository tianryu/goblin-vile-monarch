// Real movement input, complete silhouettes, constant flight anchor and pause.
const {chromium}=require('playwright'),fs=require('fs');let browser;
(async()=>{
 const r={scope:'Bat rest, low glide, flight, landing and arrow presentation in isolated desktop software WebGL. Not phone performance.',passes:[],failures:[],errors:[],cases:[]},check=(n,c)=>(c?r.passes:r.failures).push(n);
 const clips=JSON.parse(fs.readFileSync('game/art/animation/manifest.json')).clips,bounds={};
 for(const action of ['idle','walk','run']){
  const c=clips['rider_bat/'+action],m=JSON.parse(fs.readFileSync(c.provenance+'/manifest.json'));bounds[action]=m.source_indices.map((_,i)=>{
   // Alpha bounds below are measured from immutable PNGs by Python, not guessed from the crop.
   return JSON.parse(fs.readFileSync('qa/godot/v8-bat-alpha-bounds.json'))[action][i];
  });
 }
 browser=await chromium.launch({channel:'msedge',headless:true,args:['--enable-webgl','--use-angle=swiftshader']});
 const ctx=await browser.newContext({viewport:{width:1100,height:550},hasTouch:true}),p=await ctx.newPage();p.on('pageerror',e=>r.errors.push(e.message));p.on('console',m=>{if(m.type()==='error')r.errors.push(m.text())});
 await p.goto('http://127.0.0.1:42819/');await p.waitForFunction(()=>window.__goblinState?.animation,null,{timeout:60000});
 const cmd=c=>p.evaluate(c=>window.goblinQaCommand(JSON.stringify(c)),c),state=()=>p.evaluate(()=>window.__goblinState);await cmd({op:'motion_probe'});
 const body=s=>s.motion.actors.filter(a=>a.requested&&a.scope==='world/hero'),plane=s=>s.hero_anchor[1]+(s.fly+s.hero_hover)*s.viewport[1]/480;
 const clearance=s=>body(s).map(a=>{const action=a.animation?.split('/')[1],c=clips[a.animation];if(!c||!bounds[action])return -999;const index=c.frames.findIndex(f=>f.x===a.source[0]&&f.y===a.source[1]);if(index<0)return -999;return plane(s)-(a.rect[1]+bounds[action][index][3]*Math.abs(a.rect[2])/c.width);});
 for(const action of ['idle','walk','run']){
  await cmd({op:'new',seed:963});await cmd({op:'clear'});await cmd({op:'time',value:30});await cmd({op:'mount',mount:'bat'});await p.waitForTimeout(700);
  if(action!=='idle')await p.keyboard.down('d');if(action==='run')await p.keyboard.down('Shift');await p.waitForTimeout(550);
  const rows=[],start=(await state()).water_time;for(let i=0;i<180;i++){await p.waitForTimeout(24);const s=await state();rows.push(s);if(s.water_time-start>3.2)break;}
  const poses=rows.flatMap(body),id='rider_bat/'+action,count=new Set(poses.filter(a=>a.animation===id).map(a=>JSON.stringify(a.source))).size;
  check(action+': full original wing cycle plays',count>=(action==='run'?13:18));
  check(action+': rider and mount remain one opaque body',rows.every(s=>body(s).length===1&&body(s)[0].alpha>.999&&body(s)[0].tint_alpha>.999));
  check(action+': every original wing tip stays above the walk plane',rows.every(s=>clearance(s).every(v=>v>.5)));
  const planes=rows.map(plane);check(action+': fixed anchor does not follow decorative grass',Math.max(...planes)-Math.min(...planes)<.05);
  check(action+': simulation flight state remains correct',rows.every(s=>action==='run'?s.fly>30:s.fly===0));
  check(action+': no extra transactions or dialogs',rows.every(s=>s.gold===18&&s.modal===''&&!s.ad_inflight));
  await cmd({op:'freeze'});await p.screenshot({path:'qa/animation-v8/bat-complete-'+action+'-right.png'});await p.waitForTimeout(180);const a=await state();await p.waitForTimeout(240);const b=await state();check(action+': pause freezes pose and flight',a.water_time===b.water_time&&a.fly===b.fly&&JSON.stringify(body(a))===JSON.stringify(body(b)));
  if(action!=='idle')await p.keyboard.up('d');await p.keyboard.down('a');await cmd({op:'unfreeze'});await p.waitForTimeout(350);const left=await state();check(action+': turning flips the complete merged silhouette',left.hero_face===-1&&body(left).length===1&&body(left)[0].rect[2]<0);await cmd({op:'freeze'});await p.screenshot({path:'qa/animation-v8/bat-complete-'+action+'-left.png'});await p.keyboard.up('a');if(action==='run')await p.keyboard.up('Shift');
  r.cases.push({action,observed_poses:count,minimum_clearance:Math.min(...rows.flatMap(clearance)),samples:rows.map(s=>({fly:s.fly,hover:s.hero_hover,anchor:s.hero_anchor,body:body(s)}))});
 }
 await cmd({op:'new',seed:964});await cmd({op:'clear'});await cmd({op:'time',value:30});await cmd({op:'mount',mount:'bat'});await p.waitForTimeout(500);await p.keyboard.down('Shift');const transitions=[];
 for(let i=0;i<26;i++){await p.waitForTimeout(20);transitions.push(await state());}
 await p.keyboard.up('Shift');for(let i=0;i<34;i++){await p.waitForTimeout(20);transitions.push(await state());}
 check('Takeoff and landing never bury either original wing tip',transitions.every(s=>clearance(s).every(v=>v>.5)));
 const ground=transitions.map(plane);check('Changing cycles does not jump the anchor',Math.max(...ground)-Math.min(...ground)<.05);
 check('Released sprint returns to interactive low hover',transitions.at(-1).fly===0&&body(transitions.at(-1))[0].animation==='rider_bat/idle');
 await p.keyboard.down('Shift');await p.waitForTimeout(600);await cmd({op:'spawn',type:'elf',side:1,x:180,cooldown:0});
 await p.waitForFunction(()=>window.__goblinState.shots?.some(s=>s.target_hero),null,{timeout:5000});await cmd({op:'freeze'});const shot=await state(),arrow=shot.shots.find(a=>a.target_hero),draw=shot.motion.actors.filter(a=>a.requested&&a.scope.startsWith('world/shot/'));
 check('Real elf arrow retains the flying chief as target',!!arrow&&arrow.target_fly>30&&draw.length>0);
 check('Arrow endpoint rises toward the visible bat instead of ground',draw.some(a=>a.rect[1]+a.rect[3]<plane(shot)-24));
 await p.screenshot({path:'qa/animation-v8/bat-complete-arrow.png'});await p.keyboard.up('Shift');
 check('No runtime or shader errors',r.errors.length===0);fs.writeFileSync('qa/godot/v8-bat-completion.json',JSON.stringify(r,null,2));await browser.close();console.log(JSON.stringify({passes:r.passes.length,failures:r.failures,errors:r.errors,cases:r.cases.map(({samples,...v})=>v)}));process.exitCode=r.failures.length?1:0;
})().catch(async e=>{console.error(e);if(browser)await browser.close();process.exitCode=1});
