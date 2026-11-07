// Actual proximity button presses in an isolated save, never a fabricated lash command.
const {chromium}=require('playwright'),fs=require('fs');let browser;
(async()=>{
 const r={scope:'Chief gesture and rank2 recoil, desktop Edge software WebGL with actual contextual touch input',passes:[],failures:[],errors:[],cases:[]};
 const check=(n,c)=>(c?r.passes:r.failures).push(n),clips=JSON.parse(fs.readFileSync('game/art/animation/manifest.json')).clips;
 browser=await chromium.launch({channel:'msedge',headless:true,args:['--enable-webgl','--use-angle=swiftshader']});
 const ctx=await browser.newContext({viewport:{width:1100,height:550},hasTouch:true}),p=await ctx.newPage();
 p.on('pageerror',e=>r.errors.push(e.message));p.on('console',m=>{if(m.type()==='error')r.errors.push(m.text())});
 await p.goto('http://127.0.0.1:42819/');await p.waitForFunction(()=>window.__goblinState?.animation,null,{timeout:60000});
 const cmd=c=>p.evaluate(c=>window.goblinQaCommand(JSON.stringify(c)),c),state=()=>p.evaluate(()=>window.__goblinState);await cmd({op:'motion_probe'});
 const actor=(s,k)=>s.motion.actors.filter(a=>a.scope===k&&a.requested),count=(rows,k,id)=>new Set(rows.flatMap(s=>actor(s,k).filter(a=>a.animation===id)).map(a=>JSON.stringify(a.source))).size;
 const coins=s=>s.gold+s.vault+s.drops.filter(d=>d.kind==='gold').reduce((n,d)=>n+d.amount,0)+s.units.reduce((n,u)=>n+u.carry,0);
 const point=async()=>{const s=await state(),key=s.target.mode==='whip'?'action':'whip',a=s.rects[key],b=await p.locator('canvas').boundingBox();if(!a)throw Error('No normal whip button');return{x:b.x+(a[0]+a[2]/2)*b.width/s.viewport[0],y:b.y+(a[1]+a[3]/2)*b.height/s.viewport[1]};};
 const press=async()=>{const q=await point();await p.touchscreen.tap(q.x,q.y);};
 for(const side of [1,-1]){
  await cmd({op:'new',seed:951});await cmd({op:'clear'});await cmd({op:'time',value:30});const sites=(await state()).sites;let x;
  for(let n=4500;n<=8500;n+=50){const a=side*n,b=side*(n-350),lo=Math.min(a,b)-120,hi=Math.max(a,b)+120;if(sites.filter(v=>v.visible).every(v=>v.x<lo||v.x>hi)){x=a;break;}}
  if(x===undefined)throw Error('No empty real-map corridor');
  await cmd({op:'move',x});await cmd({op:'mount',mount:'boar',face:-side});await cmd({op:'freeze'});await cmd({op:'unit',role:'worker',rank:2,x:x+side*55,hidden:7});await p.waitForTimeout(900);
  const id=(await state()).units[0].id,key='world/unit/'+id,q=await point();await cmd({op:'unfreeze'});await p.touchscreen.tap(q.x,q.y);const rows=[];let paused=false,start=(await state()).water_time;
  for(let i=0;i<90;i++){
   await p.waitForTimeout(12);let s=await state();rows.push(s);
   if(!paused&&s.hero_whip_pose>0&&s.hero_whip_pose<.35){
    await cmd({op:'freeze'});await p.waitForTimeout(80);const a=await state();await p.screenshot({path:'qa/animation-v8/chief-whip-'+side+'-engine.png'});await p.waitForTimeout(220);const b=await state();
    check(side+': pause holds chief arm and rank2 recoil together',a.hero_whip_pose===b.hero_whip_pose&&JSON.stringify(actor(a,'world/hero'))===JSON.stringify(actor(b,'world/hero'))&&JSON.stringify(actor(a,key))===JSON.stringify(actor(b,key)));
    await cmd({op:'unfreeze'});paused=true;
   }
   if(s.water_time-start>.7)break;
  }
  const chief=rows.flatMap(s=>actor(s,'world/hero').filter(a=>a.animation==='rider_boar/whip')),worker=rows.flatMap(s=>actor(s,key).filter(a=>a.animation==='worker_2/hit'));
  check(side+': real-time touch shows multiple generated seated poses',count(rows,'world/hero','rider_boar/whip')>=3);
  check(side+': real-time touch shows multiple rank2 recoil poses',count(rows,key,'worker_2/hit')>=3);
  check(side+': chief faces the actual selected goblin',chief.length>0&&chief.every(a=>Math.sign(a.rect[2])===side)&&rows.some(s=>s.hero_face===side));
  check(side+': rider and mount stay one solid inseparable subject',rows.every(s=>actor(s,'world/hero').length===1&&actor(s,'world/hero')[0].alpha>.999)&&chief.every(a=>a.rotation===0));
  for(const [label,poses] of [['chief',chief],['worker',worker]]){
   const feet=poses.map(a=>{const c=clips[a.animation];return a.rect[1]+c.anchor_y*Math.abs(a.rect[2])/c.width;});
   check(side+': '+label+' retains the fixed walk plane',feet.length>0&&Math.max(...feet)-Math.min(...feet)<.2);
  }
  check(side+': one successful lash drops hidden coins once',coins(rows.at(-1))===25&&rows.at(-1).units[0].hidden===0&&rows.every(s=>s.modal===''&&!s.ad_inflight));
  // H3 runs on the same machine. Inspect every pose separately through authoritative model ticks,
  // without changing animation clocks or claiming this is physical-phone frame rate.
  await cmd({op:'freeze'});let a=await state();await cmd({op:'move',x:a.units[0].x-side*55});await p.waitForTimeout(250);const q2=await point();await cmd({op:'unfreeze'});await p.touchscreen.tap(q2.x,q2.y);await cmd({op:'freeze'});
  const stepped=[];for(let i=0;i<64;i++){stepped.push(await state());await cmd({op:'advance',seconds:1/120});await p.waitForTimeout(8);}
  check(side+': frame-stepped real gesture covers its late recovery',count(stepped,'world/hero','rider_boar/whip')>=8&&stepped.some(s=>s.hero_whip_pose<.06));
  check(side+': frame-stepped rank2 recoil reaches ready stance',count(stepped,key,'worker_2/hit')>=5&&stepped.some(s=>s.units[0].hit_pose===0));
  await cmd({op:'unfreeze'});await p.waitForTimeout(550);
  const rest=await state();await cmd({op:'move',x:rest.units[0].x-side*18});await p.waitForTimeout(160);await press();await p.keyboard.down('d');await p.waitForTimeout(180);await p.keyboard.up('d');const moved=await state();
  check(side+': moving cancels gesture and resumes actual gait',moved.hero_whip_pose===0&&moved.hero_x>rest.units[0].x-side*18+2);
  check(side+': second lash cannot create hidden money again',coins(moved)===25);
  r.cases.push({side,chief_poses:count(rows,'world/hero','rider_boar/whip'),rank2_poses:count(rows,key,'worker_2/hit'),stepped_chief:count(stepped,'world/hero','rider_boar/whip'),stepped_rank2:count(stepped,key,'worker_2/hit'),samples:rows.map(s=>({time:s.water_time,gold:s.gold,total_coins:coins(s),drops:s.drops,carry:s.units.map(u=>u.carry),pose:s.hero_whip_pose,face:s.hero_face,chief:actor(s,'world/hero'),unit:actor(s,key)}))});
 }
 check('No runtime or shader errors',r.errors.length===0);fs.writeFileSync('qa/godot/v8-chief-gesture-animation.json',JSON.stringify(r,null,2));await browser.close();console.log(JSON.stringify({passes:r.passes.length,failures:r.failures,errors:r.errors,cases:r.cases.map(({samples,...v})=>v)}));process.exitCode=r.failures.length?1:0;
})().catch(async e=>{console.error(e);if(browser)await browser.close();process.exitCode=1});
