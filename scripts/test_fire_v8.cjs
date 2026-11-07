// 独立浏览器档验证火形真实变化、昼夜、暂停和显隐，不触碰玩家存档。
const {chromium}=require('playwright'),sharp=require('sharp'),fs=require('fs');let browser;
(async()=>{
 const out='qa/fire-v8';fs.mkdirSync(out,{recursive:true});
 const r={scope:'Godot Web, isolated desktop Edge software WebGL, not phone or TapTap',passes:[],failures:[],errors:[],samples:[]};
 const check=(name,passed)=>(passed?r.passes:r.failures).push(name);
 browser=await chromium.launch({channel:'msedge',headless:true,args:['--enable-webgl','--use-angle=swiftshader']});
 const ctx=await browser.newContext({viewport:{width:1200,height:600},deviceScaleFactor:1});const page=await ctx.newPage();
 page.on('pageerror',e=>r.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')r.errors.push(m.text())});
 await page.goto('http://127.0.0.1:42819/');await page.waitForFunction(()=>window.__goblinState?.fire_mode,null,{timeout:60000});
 const cmd=c=>page.evaluate(c=>window.goblinQaCommand(JSON.stringify(c)),c),state=()=>page.evaluate(()=>window.__goblinState);
 await cmd({op:'motion_probe'});
 await cmd({op:'new',seed:891});await cmd({op:'clear'});await cmd({op:'move',x:230});await cmd({op:'time',value:60});await cmd({op:'photo',hide:true});await page.waitForTimeout(1100);
 let s=await state();r.samples.push(s.fire);check('Flames use the procedural renderer',s.fire_mode==='procedural-handpainted');
 check('Daylight keeps a campfire but extinguishes torches',s.fire.some(f=>f.kind==='campfire'&&f.alpha>.99)&&!s.fire.some(f=>f.kind==='torch'&&f.alpha>.01));
 const fire=s.fire.find(f=>f.kind==='campfire');if(!fire)throw Error('No campfire rendered');
 const ratio=1200/s.viewport[0];const rect={left:Math.round((fire.point[0]-42)*ratio),top:Math.round((fire.point[1]-67)*ratio),width:Math.round(84*ratio),height:Math.round(73*ratio)};
 const crop=async()=>sharp(await page.screenshot()).extract(rect).raw().toBuffer();
 const a=await crop();await page.waitForTimeout(230);const b=await crop();let delta=0;for(let i=0;i<a.length;i++)if(Math.abs(a[i]-b[i])>15)delta++;
 check('Actual game time continuously changes the fire image',delta>120);r.changed_channels=delta;
 await page.screenshot({path:out+'/day.png'});
 await cmd({op:'time',value:180});await page.waitForTimeout(500);s=await state();r.samples.push(s.fire);
 check('Night lights visible torch flames smoothly',s.fire.some(f=>f.kind==='torch'&&f.alpha>.95));
 await page.screenshot({path:out+'/night.png'});
 await cmd({op:'freeze',value:true});await page.waitForTimeout(250);const t=(await state()).fire.map(f=>f.time);await page.waitForTimeout(320);
 check('Pause freezes the procedural flame clock',JSON.stringify((await state()).fire.map(f=>f.time))===JSON.stringify(t));
 // 以渲染帧收集过程，避免软件WebGL中一次墙钟等待跨过整个显隐窗口。
 const transition=async value=>page.evaluate(async value=>{const rows=[];window.goblinQaCommand(JSON.stringify({op:'time',value}));for(let i=0;i<4;i++){await new Promise(requestAnimationFrame);rows.push(window.__goblinState.fire)}return rows},value);
 const fade=await transition(60);r.fade=fade;
 check('Extinguishing uses an intermediate opacity',fade.flat().some(f=>f.kind==='torch'&&f.alpha>0&&f.alpha<1));
 const reverse=await transition(180);r.reverse=reverse;
 check('Relight resumes the current opacity',reverse.flat().some(f=>f.kind==='torch'&&f.alpha>0&&f.alpha<1));
 await page.waitForTimeout(350);await cmd({op:'levels',rank:2});await page.waitForTimeout(400);s=await state();
 check('Upgrading the tent removes its old campfire',!s.fire.some(f=>f.id===fire.id));
 check('No runtime or shader errors',r.errors.length===0);
 fs.writeFileSync(out+'/acceptance.json',JSON.stringify(r,null,2));await browser.close();
 console.log(JSON.stringify({passes:r.passes.length,failures:r.failures,errors:r.errors}));process.exitCode=r.failures.length?1:0;
})().catch(async e=>{console.error(e);if(browser)await browser.close();process.exitCode=1});
