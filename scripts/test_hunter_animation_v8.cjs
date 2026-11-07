// 通过正常模拟驱动双向放箭，独立投射物与身体姿势不重复；夹具不改玩家档。
const {chromium}=require('playwright'),fs=require('fs');let browser;
(async()=>{
 const rank=process.argv.includes('--rank3')?3:process.argv.includes('--rank2')?2:1,name=rank>1?'hunter_'+rank:'hunter';
 const r={scope:'Hunter attack animation integration, isolated Edge software WebGL; source arrow alpha checked separately',passes:[],failures:[],errors:[],directions:[]};
 const check=(n,c)=>(c?r.passes:r.failures).push(n);
 browser=await chromium.launch({channel:'msedge',headless:true,args:['--enable-webgl','--use-angle=swiftshader']});
 const context=await browser.newContext({viewport:{width:1000,height:500}}),page=await context.newPage();
 page.on('pageerror',e=>r.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')r.errors.push(m.text())});
 await page.goto('http://127.0.0.1:42819/');await page.waitForFunction(()=>window.__goblinState?.fire_mode,null,{timeout:60000});
 const cmd=c=>page.evaluate(c=>window.goblinQaCommand(JSON.stringify(c)),c),state=()=>page.evaluate(()=>window.__goblinState);
 await cmd({op:'motion_probe'});
 for(const direction of [1,-1]){
  await cmd({op:'new',seed:894});await cmd({op:'clear'});if(rank>1)await cmd({op:'levels',rank});await cmd({op:'move',x:direction*190});await cmd({op:'time',value:30});await cmd({op:'unit',role:'hunter',x:0});await page.waitForTimeout(500);
  const id=(await state()).units[0].id;await cmd({op:'spawn',type:'human',side:direction,x:direction*160,hp:500});const samples=[];
  for(let i=0;i<45;i++){await page.waitForTimeout(25);samples.push(await state());}
  const poses=samples.flatMap(s=>s.motion.actors).filter(a=>a.scope===`world/unit/${id}`&&a.requested&&a.animation===name+'/shoot');
  check(`Hunter ${direction} actually plays the shooting clip`,poses.length>2);
  check(`Hunter ${direction} advances multiple attack frames`,new Set(poses.map(a=>JSON.stringify(a.source))).size>=3);
  if(rank>1){const clip=JSON.parse(fs.readFileSync('game/art/animation/manifest.json')).clips[name+'/shoot'];check(`Hunter ${direction} reaches the actual release pose before resuming movement`,poses.some(a=>Math.round(a.source[1]/clip.height)*4+Math.round(a.source[0]/clip.width)>=4));}
  check(`Hunter ${direction} faces the enemy during the shot`,poses.length>0&&poses.every(a=>Math.sign(a.rect[2])===direction));
  check(`Hunter ${direction} has one body identity`,samples.every(s=>s.motion.actors.filter(a=>a.scope===`world/unit/${id}`&&a.key.endsWith('/'+name+'/0')).length<=1));
  check(`Hunter ${direction} emits a separate world arrow`,samples.some(s=>s.motion.actors.some(a=>a.scope.startsWith('world/shot/')&&a.requested)));
  const planted=samples.map(s=>s.units.find(u=>u.id===id)).filter(u=>u&&u.shot_pose>.03);
  check(`Hunter ${direction} plants his feet for the release`,planted.length>1&&Math.max(...planted.slice(0,3).map(u=>u.x))-Math.min(...planted.slice(0,3).map(u=>u.x))<.1);
  await cmd({op:'freeze'});await page.screenshot({path:'qa/animation-v8/'+name+'-shoot-'+direction+'-engine.png'});
  r.directions.push({direction,samples:samples.map(s=>({units:s.units,actors:s.motion.actors.filter(a=>a.scope===`world/unit/${id}`||a.scope.startsWith('world/shot/'))}))});
 }
 check('No runtime or shader errors',r.errors.length===0);fs.writeFileSync('qa/godot/v8-hunter-animation'+(rank>1?'-rank'+rank:'')+'.json',JSON.stringify(r,null,2));await browser.close();console.log(JSON.stringify({passes:r.passes.length,failures:r.failures,errors:r.errors}));process.exitCode=r.failures.length?1:0;
})().catch(async e=>{console.error(e);if(browser)await browser.close();process.exitCode=1});
