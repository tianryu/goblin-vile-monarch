// 隔离浏览器档，验证真实输入驱动的帧切换、暂停与平稳脚点，不改变玩家存档。
const {chromium}=require('playwright'),fs=require('fs');let browser;
(async()=>{
 const r={scope:'V8 representative sequences and flat walk plane in isolated desktop Edge software WebGL, not phone validation.',passes:[],failures:[],errors:[]};
 fs.mkdirSync('qa/animation-v8',{recursive:true});
 browser=await chromium.launch({channel:'msedge',headless:true,args:['--enable-webgl','--use-angle=swiftshader']});
 const ctx=await browser.newContext({viewport:{width:1000,height:500},deviceScaleFactor:1,hasTouch:true});const page=await ctx.newPage();
 page.on('pageerror',e=>r.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')r.errors.push(m.text())});
 await page.goto('http://127.0.0.1:42819/');await page.waitForFunction(()=>window.__goblinState?.animation,null,{timeout:60000});
 const cmd=c=>page.evaluate(c=>window.goblinQaCommand(JSON.stringify(c)),c),state=()=>page.evaluate(()=>window.__goblinState);
 const check=(n,c)=>(c?r.passes:r.failures).push(n);
 await cmd({op:'new',seed:881});await cmd({op:'clear'});await cmd({op:'unit',role:'idle',x:430});await cmd({op:'time',value:30});await cmd({op:'motion_probe'});
 await page.waitForTimeout(900);await page.keyboard.down('ArrowRight');await page.keyboard.down('Shift');
 const samples=[];
 for(let i=0;i<18;i++){await page.waitForTimeout(70);samples.push(await state());if(i===9)await page.screenshot({path:'qa/animation-v8/first-live-run.png'});}
 await page.keyboard.up('Shift');await page.keyboard.up('ArrowRight');await page.waitForTimeout(350);
 const live=samples.flatMap(s=>s.motion.actors).filter(a=>a.scope==='world/hero'&&a.animation==='rider_boar/run'&&a.requested);
 check('Actual run input resolves a generated rider clip',live.length>5);
 check('Animation advances through multiple source atlas cells',new Set(live.map(a=>JSON.stringify(a.source))).size>=6);
 const ys=samples.map(s=>s.hero_anchor[1]);check('Terrain no longer bounces the walk anchor',Math.max(...ys)-Math.min(...ys)<.05);
 check('Actor atlas is loaded on demand',samples.some(s=>s.animation.loaded>0));
 check('Display never spends player coins',samples.every(s=>s.gold===18));
 await cmd({op:'freeze',value:true});const before=(await state()).water_time;await page.waitForTimeout(300);check('Paused visual action clock stays fixed',Math.abs((await state()).water_time-before)<.001);
 await cmd({op:'freeze',value:false});await page.keyboard.down('ArrowLeft');await page.keyboard.down('Shift');await page.waitForTimeout(600);await page.screenshot({path:'qa/animation-v8/first-live-turn.png'});await page.keyboard.up('Shift');await page.keyboard.up('ArrowLeft');
 check('Opposite movement keeps the original facing control',(await state()).hero_face===-1);
 await page.waitForTimeout(200);check('No runtime or shader errors',r.errors.length===0);
 r.samples=samples.map(s=>({x:s.hero_x,anchor:s.hero_anchor,animation:s.animation}));
 fs.writeFileSync('qa/godot/v8-animation-browser.json',JSON.stringify(r,null,2));await browser.close();console.log(JSON.stringify({passes:r.passes.length,failures:r.failures,errors:r.errors}));process.exitCode=r.failures.length?1:0;
})().catch(async e=>{console.error(e);if(browser)await browser.close();process.exitCode=1});
