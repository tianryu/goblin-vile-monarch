const {chromium}=require('playwright'),fs=require('fs'),path=require('path');
let browser,report={scope:'V5 desktop Edge touch emulation, deterministic QA scenarios and controlled ad provider. Not a phone or live TapTap test.',passes:[],failures:[],errors:[],screens:[]};
(async()=>{const out='qa/interaction-v5';fs.mkdirSync(out,{recursive:true});browser=await chromium.launch({channel:'msedge',headless:true,args:['--enable-webgl','--use-angle=swiftshader']});const ctx=await browser.newContext({viewport:{width:960,height:480},hasTouch:true,deviceScaleFactor:1});const page=await ctx.newPage();page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text())});page.on('pageerror',e=>report.errors.push(e.message));
const check=(name,ok,detail)=>{(ok?report.passes:report.failures).push({name,...(detail?{detail}:{})})};
const state=()=>page.evaluate(()=>window.__goblinState);
const cmd=async c=>{await page.evaluate(c=>window.goblinQaCommand(JSON.stringify(c)),c);await page.waitForTimeout(160)};
const point=async key=>{const s=await state(),r=s.rects[key],b=await page.locator('canvas').boundingBox();if(!r)throw Error('Missing '+key+' '+s.modal);return{x:b.x+(r[0]+r[2]/2)/s.viewport[0]*b.width,y:b.y+(r[1]+r[3]/2)/s.viewport[1]*b.height}};
const tap=async key=>{const p=await point(key);await page.touchscreen.tap(p.x,p.y);await page.waitForTimeout(180)};
const snap=async file=>{await page.screenshot({path:path.join(out,file+'.png')});report.screens.push(file+'.png')};
await page.goto('http://127.0.0.1:42819/');await page.waitForFunction(()=>window.__goblinState,null,{timeout:60000});
for(const [width,height] of [[960,480],[740,360],[844,390],[1280,720]]){
 await page.setViewportSize({width,height});await cmd({op:'scene'});await cmd({op:'levels',rank:2});
 for(const kind of ['welcome','tools','gold','army','mount','prison','trader','steal','rally','pause','guide','ledger','credits','restart']){
  await cmd({op:'open',kind});const s=await state(),scale=height/s.viewport[1],all=s.ui.filter(c=>!['run','action','pause'].includes(c.key));
  const bad=all.filter(c=>{const[x,y,w,h]=c.rect,[cx,cy,cw,ch]=s.content_clip;return x<-1||y<-1||x+w>s.viewport[0]+1||y+h>s.viewport[1]+1||h*scale<47.5||(!c.footer&&(x<cx-1||x+w>cx+cw+1||y<cy-1||y+h>cy+ch+1))});
  const footer=all.filter(c=>c.footer);const overlap=footer.some((a,i)=>footer.slice(i+1).some(b=>a.rect[0]<b.rect[0]+b.rect[2]-1&&a.rect[0]+a.rect[2]>b.rect[0]+1));
  check(width+'x'+height+' '+kind+' bounds and thumb controls',bad.length===0&&!overlap,bad.length?bad:undefined);
  if(width===960||width===740)await snap(width+'-'+kind);
 }
 for(let n=1;n<4;n++){await cmd({op:'guide_page',page:n});await snap(width+'-guide-'+(n+1))}
 await cmd({op:'outcome',win:true});await snap(width+'-victory');await cmd({op:'outcome',win:false});await snap(width+'-defeat');await cmd({op:'new',seed:731});
}
await page.setViewportSize({width:844,height:390});await cmd({op:'new',seed:731});check('Native canvas active',(await state()).native_canvas);
await cmd({op:'move',x:-1000});await cmd({op:'resources',gold:50,scrap:100});await cmd({op:'time',value:35});await snap('coin-ghost-empty');let s=await state();check('Unbuilt wall shows exactly four coin ghosts and wall preview',s.coin_slots===4&&s.ghost_key==='wall1');
await tap('action');s=await state();check('One tap holds one real coin without completing',s.payment.paid===1&&s.gold===49&&s.coin_slots===4);
await snap('coin-ghost-one');await tap('action');check('Second tap retains first contribution',(await state()).payment.paid===2);
await cmd({op:'move',x:-1130});check('Walking away returns partial payment',(await state()).payment.paid===undefined&&(await state()).gold===50);
await cmd({op:'move',x:-1000});let p=await point('action');await page.mouse.move(p.x,p.y);await page.mouse.down();await page.waitForTimeout(950);await page.mouse.up();await page.waitForTimeout(120);
check('Holding fills four coins once then stops',(await state()).gold===46&&Object.keys((await state()).payment).length===0);
await snap('wall-funded');await cmd({op:'new',seed:732});await cmd({op:'move',x:-1000});await tap('action');await tap('pause');check('Pause refunds partial payment',(await state()).gold===18&&Object.keys((await state()).payment).length===0);await tap('resume');
await cmd({op:'move',x:-465});await tap('action');let workers=(await state()).roles.worker;await tap('select_worker');check('Selecting a profession does not spend money',(await state()).gold===18);await tap('buy_tool');check('Bottom confirm buys selected tool',(await state()).roles.worker===workers+1&&(await state()).gold===16);
await tap('select_thief');await tap('buy_tool');check('Extra tools remain useful as stock',(await state()).tool_stock.thief===1);await tap('close');
await cmd({op:'move',x:655});await cmd({op:'resources',gold:50,scrap:100});await tap('action');await tap('select_lizard');await tap('buy_lizard');check('Game-coin mount is acquired and equipped',(await state()).gold===10&&(await state()).mount==='lizard'&&(await state()).modal==='');
await cmd({op:'move',x:-315});await tap('action');let cash=(await state()).gold+(await state()).reserve;await tap('ad_gold');check('Unavailable ads never fabricate success',(await state()).gold+(await state()).reserve===cash);await snap('ad-unavailable');
await page.evaluate(()=>{window.GoblinRewardedAds={ready:true,show(kind,callback){window.__fixture={kind,callback}}}});
for(let i=0;i<5;i++){await tap('ad_gold');await page.evaluate(i=>window.__fixture.callback(JSON.stringify({completed:true,kind:'gold',receipt:'v5-repeat-'+i})),i);await page.waitForTimeout(180)}
check('Unlimited consecutive voluntary ad rewards',(await state()).gold+(await state()).reserve===cash+150);cash+=150;
await tap('ad_gold');check('Ad disables footer and keeps simulation paused',(await state()).ui.every(c=>c.disabled)&&(await state()).paused);
await page.evaluate(()=>{let r=JSON.stringify({completed:true,kind:'gold',receipt:'v5-repeat-4'});window.__fixture.callback(r);window.__fixture.callback(r)});await page.waitForTimeout(250);check('Duplicate receipt and callback give no duplicate reward',(await state()).gold+(await state()).reserve===cash);
await tap('ad_gold');await page.evaluate(()=>window.__fixture.callback(JSON.stringify({completed:true,kind:'wolf',receipt:'v5-wrong'})));await page.waitForTimeout(200);check('Wrong kind is rejected',(await state()).gold+(await state()).reserve===cash);
await tap('ad_gold');await page.evaluate(()=>window.__fixture.callback(JSON.stringify({completed:false})));await page.waitForTimeout(200);await tap('close');check('Cancelled ad restores bottom return button',(await state()).modal==='');
await cmd({op:'move',x:-35});await tap('action');await tap('select_worker');await tap('ad_worker');let before=(await state()).roles.worker||0;await page.evaluate(()=>window.__fixture.callback(JSON.stringify({completed:true,kind:'worker',receipt:'v5-workers'})));await page.waitForTimeout(200);await tap('close');await page.waitForTimeout(300);check('Reinforcements are exactly two selected workers',(await state()).roles.worker===before+2);
await cmd({op:'scene',interactive:true});await cmd({op:'move',x:430});await tap('action');await tap('sell_selected');check('One human sold into cart',(await state()).captives===2&&(await state()).trader_cargo[0]==='human');await tap('sell_all');check('All remaining prisoners sold once',(await state()).captives===0&&(await state()).trader_cargo.length===3);await tap('close');await snap('loaded-cart');
await cmd({op:'new',seed:44});await cmd({op:'scene'});await cmd({op:'levels',rank:3,prison:true});check('Professions have rank-three appearances',(await state()).gear.filter(u=>u.role!=='idle').every(u=>u.rank===3));await snap('tier3');
for(const mount of ['boar','lizard','wolf','bat'])for(const bare of [false,true]){
 await cmd({op:'look',mount,bare,face:1});await page.waitForTimeout(800);let first=await state();await snap('rider-'+mount+(bare?'-bare':'')+'-right');
 await cmd({op:'look',mount,bare,face:-1});await page.waitForTimeout(300);let second=await state();await snap('rider-'+mount+(bare?'-bare':'')+'-left');
 check(mount+(bare?' bare':' crowned')+' turn keeps saddle anchor',Math.abs(first.hero_anchor[0]-second.hero_anchor[0])<.2&&Math.abs(first.hero_anchor[1]-second.hero_anchor[1])<.2);
}
await cmd({op:'new',seed:45});await cmd({op:'move',x:550});await cmd({op:'time',value:35});check('Empty road has no action button',!(await state()).rects.action);await page.touchscreen.tap(400,180);check('Direct world taps do not activate objects',(await state()).modal==='');
await snap('water-flow-a');s=await state();await page.waitForTimeout(1200);check('Water clock advances while playing',(await state()).water_time>s.water_time+.8);await snap('water-flow-b');
await tap('pause');s=await state();await page.waitForTimeout(500);check('Pause stops water and simulation clocks',(await state()).water_time===s.water_time&&(await state()).time===s.time);await tap('resume');
const cdp=await ctx.newCDPSession(page);const joy=await point('joystick'),run=await point('run');s=await state();
await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:joy.x+27,y:joy.y,id:1},{x:run.x,y:run.y,id:2}]});await page.waitForTimeout(420);check('Two thumbs move and run together',(await state()).hero_x>s.hero_x+20&&(await state()).run);await cdp.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});await page.waitForTimeout(150);check('Touch cancel clears movement and run',(await state()).axis===0&&!(await state()).run);
await page.setViewportSize({width:390,height:844});await page.waitForTimeout(350);check('Portrait pauses and clears input',(await state()).paused&&(await state()).axis===0);await snap('rotate');await page.setViewportSize({width:844,height:390});await page.waitForTimeout(250);check('Landscape restores clean input',!(await state()).paused&&(await state()).axis===0);
await cmd({op:'outcome',win:true});await tap('close');check('Victory report can be viewed',(await state()).modal==='ledger');await tap('close');await tap('new_campaign');check('Victory restart is free',(await state()).status==='playing');await cmd({op:'outcome',win:false});await tap('new_campaign');check('Defeat restart is free',(await state()).status==='playing');
await cmd({op:'move',x:-650});await tap('pause');s=await state();await page.reload();await page.waitForFunction(()=>window.__goblinState,null,{timeout:60000});check('Save survives native UI reload',Math.abs((await state()).hero_x-s.hero_x)<1);
await page.goto('http://127.0.0.1:42819/nested/monarch/');await page.waitForFunction(()=>window.__goblinState,null,{timeout:60000});check('Nested H5 deployment boots',!!(await state()));check('No runtime errors',report.errors.length===0,report.errors);
fs.writeFileSync('qa/godot/interaction-browser-tests.json',JSON.stringify(report,null,2));console.log(JSON.stringify({passed:report.passes.length,failures:report.failures,errors:report.errors,screens:report.screens.length}));await browser.close();process.exitCode=report.failures.length?1:0;
})().catch(async e=>{report.exception=String(e);fs.writeFileSync('qa/godot/interaction-browser-tests.json',JSON.stringify(report,null,2));console.error(e);if(browser)await browser.close();process.exitCode=1});
