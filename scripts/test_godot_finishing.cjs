const {chromium}=require('playwright');
const fs=require('node:fs');
const path=require('node:path');
let browser,activeReport;
(async()=>{
 const out='qa/polish-round3';fs.mkdirSync(out,{recursive:true});
 const report={scope:'Desktop Edge touch emulation and explicit scenario fixtures. Not physical phone or live TapTap ads.',passes:[],failures:[],errors:[],screens:[]};
 activeReport=report;
 const check=(name,ok,detail)=>{(ok?report.passes:report.failures).push({name,...(detail?{detail}:{})})};
 browser=await chromium.launch({channel:'msedge',headless:true,args:['--enable-webgl','--use-angle=swiftshader']});
 const ctx=await browser.newContext({viewport:{width:740,height:360},hasTouch:true,deviceScaleFactor:1});
 const page=await ctx.newPage();page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text())});page.on('pageerror',e=>report.errors.push(e.message));
 const state=()=>page.evaluate(()=>window.__goblinState);
 const cmd=async c=>{await page.evaluate(c=>window.goblinQaCommand(JSON.stringify(c)),c);await page.waitForTimeout(300)};
 const tap=async key=>{let s=await state(),r=s.rects[key];if(!r)throw Error('Missing control '+key);let box=await page.locator('canvas').boundingBox();await page.touchscreen.tap(box.x+(r[0]+r[2]/2)*box.width/s.viewport[0],box.y+(r[1]+r[3]/2)*box.height/s.viewport[1]);await page.waitForTimeout(300)};
 await page.goto('http://127.0.0.1:42819/');await page.waitForFunction(()=>window.__goblinState,null,{timeout:60000});
 for(const [width,height] of [[740,360],[844,390],[932,430],[1280,720]]){
  await page.setViewportSize({width,height});await cmd({op:'scene'});
  for(const kind of ['welcome','tools','gold','army','mount','prison','trader','steal','rally','pause','guide','ledger','restart']){
   await cmd({op:'open',kind});const s=await state();const scale=height/s.viewport[1];
   const buttons=s.ui.filter(c=>!['run','action','pause'].includes(c.key));
   const bad=buttons.filter(c=>{const [x,y,w,h]=c.rect;const [cx,cy,cw,ch]=s.content_clip;return x<-1||y<-1||x+w>s.viewport[0]+1||y+h>s.viewport[1]+1||h*scale<47.5||(c.key!=='close'&&(x<cx-1||x+w>cx+cw+1||y<cy-1||y+h>cy+ch+1))});
   check(`${width}x${height} ${kind} buttons stay reachable`,bad.length===0,bad.length?bad:undefined);
   const file=`${width}x${height}-${kind}.png`;await page.screenshot({path:path.join(out,file)});report.screens.push(file);
  }
  await cmd({op:'close'});await page.screenshot({path:`${out}/${width}x${height}-world.png`});
 }
 await page.setViewportSize({width:844,height:390});await cmd({op:'new',seed:429});await cmd({op:'move',x:550});
 check('No interaction key on empty road',!(await state()).rects.action);
 await cmd({op:'move',x:-465});await tap('action');let workerCount=(await state()).roles.worker;await tap('tool_worker');
 check('Worker card gives intended role',(await state()).roles.worker===workerCount+1);
 await tap('tool_thief');check('Thief tools wait for a recruit',(await state()).tool_stock.thief===1);
 await tap('close');check('Visible return control closes window',(await state()).modal==='');
 await cmd({op:'move',x:-315});await tap('action');let cash=(await state()).gold+(await state()).reserve;
 await page.evaluate(()=>{window.GoblinRewardedAds={ready:true,show(kind,callback){window.__fixtureAd={kind,callback}}}});
 for(let i=0;i<5;i++){await tap('ad_gold');await page.evaluate(i=>window.__fixtureAd.callback(JSON.stringify({completed:true,kind:'gold',receipt:'polish-gold-'+i})),i);await page.waitForTimeout(300)}
 check('Five consecutive controlled rewards have no cap or cooldown',(await state()).gold+(await state()).reserve===cash+150);
 cash=(await state()).gold+(await state()).reserve;await tap('ad_gold');await page.evaluate(()=>window.__fixtureAd.callback(JSON.stringify({completed:true,kind:'wolf',receipt:'wrong-kind'})));await page.waitForTimeout(300);
 check('Wrong reward kind never credits money',(await state()).gold+(await state()).reserve===cash);
 await tap('close');check('Ad completion restores the return button',(await state()).modal==='');await cmd({op:'scene',interactive:true});await cmd({op:'move',x:430});await tap('action');await tap('sell_human');
 check('Sold human moves from prison into cart',(await state()).captives===2&&(await state()).trader_cargo[0]==='human');
 await tap('sell_all');check('Sell all clears prison and fills caged cart',(await state()).captives===0&&(await state()).trader_cargo.length===3);
 await tap('close');check('Trading return button remains usable',(await state()).modal==='');await page.screenshot({path:`${out}/loaded-prison-cart.png`});
 for(const mount of ['boar','lizard','wolf','bat'])for(const bare of [false,true]){
  await cmd({op:'look',mount,bare});await page.screenshot({path:`${out}/rider-${mount}${bare?'-bare':''}.png`});
 }
 await cmd({op:'open',kind:'mount'});let boostState=await state();let clip=boostState.content_clip;
 check('Fully owned bat merchant keeps boost action visible',boostState.ui.filter(c=>c.key!=='close'&&!['run','action','pause'].includes(c.key)).every(c=>c.rect[1]+c.rect[3]<=clip[1]+clip[3]+1));
 await tap('ad_bat');await page.evaluate(()=>window.__fixtureAd.callback(JSON.stringify({completed:true,kind:'bat',receipt:'polish-bat-boost'})));await page.waitForTimeout(300);
 check('Equipped bat can repeatedly buy real-duration boost through controlled provider',(await state()).boosts.bat===300);await page.screenshot({path:`${out}/mount-boost.png`});
 await tap('close');
 await cmd({op:'night_scene'});await page.screenshot({path:`${out}/night-defense.png`});await cmd({op:'unfreeze'});await cmd({op:'advance',seconds:5});await page.screenshot({path:`${out}/night-fight.png`});
 await cmd({op:'outcome',win:true});await page.screenshot({path:`${out}/victory.png`});check('Victory has free new campaign',(await state()).rects.new_campaign&&!((await state()).rects.close));
 await tap('new_campaign');check('Free new campaign returns to play',(await state()).status==='playing'&&(await state()).day===1);
 await cmd({op:'outcome',win:false});await page.screenshot({path:`${out}/defeat.png`});await tap('new_campaign');check('Defeat restart never requires advertisement',(await state()).status==='playing');
 await cmd({op:'move',x:-315});await tap('action');await tap('close');await tap('pause');
 let saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('goblin_monarch_godot_v3.bak')));await page.evaluate(()=>localStorage.setItem('goblin_monarch_godot_v3','{broken'));
 await page.reload();await page.waitForFunction(()=>window.__goblinState,null,{timeout:60000});
 check('Corrupted primary save recovers previous valid backup',Math.abs((await state()).hero_x-saved.state.hero.x)<2&&(await state()).gold===saved.state.gold);
 check('No Web runtime errors',report.errors.length===0,report.errors);
 fs.writeFileSync('qa/godot/finishing-browser-tests.json',JSON.stringify(report,null,2));
 console.log(JSON.stringify({passed:report.passes.length,failures:report.failures,errors:report.errors,screens:report.screens.length}));
 await browser.close();process.exitCode=report.failures.length?1:0;
})().catch(async e=>{console.error(e);if(activeReport){activeReport.exception=String(e);fs.writeFileSync('qa/godot/finishing-browser-tests.json',JSON.stringify(activeReport,null,2))}if(browser)await browser.close();process.exitCode=1});
