const {chromium}=require('playwright'),fs=require('fs');let browser;
(async()=>{
 const r={scope:'Oak canopy sequence and fixed root placement in isolated desktop Edge software WebGL',passes:[],failures:[],errors:[]};const check=(n,c)=>(c?r.passes:r.failures).push(n);
 browser=await chromium.launch({channel:'msedge',headless:true,args:['--enable-webgl','--use-angle=swiftshader']});const context=await browser.newContext({viewport:{width:1100,height:550}}),page=await context.newPage();
 page.on('pageerror',e=>r.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')r.errors.push(m.text())});
 await page.goto('http://127.0.0.1:42819/');await page.waitForFunction(()=>window.__goblinState?.fire_mode,null,{timeout:60000});
 const cmd=c=>page.evaluate(c=>window.goblinQaCommand(JSON.stringify(c)),c),state=()=>page.evaluate(()=>window.__goblinState);await cmd({op:'motion_probe'});await cmd({op:'new',seed:896});await cmd({op:'clear'});await cmd({op:'time',value:30});await cmd({op:'move',x:400});await page.waitForTimeout(600);
 const samples=[];for(let i=0;i<36;i++){await page.waitForTimeout(70);samples.push(await state());}
 const trees=samples.flatMap(s=>s.motion.surface.filter(a=>a.requested&&a.animation==='tree_oak/wind'));
 check('Visible oaks use the generated canopy sequence',trees.length>30);check('Wind advances through a complete set of poses',new Set(trees.map(a=>JSON.stringify(a.source))).size>=18);
 const scopes=[...new Set(trees.map(a=>a.scope))];check('Each tree keeps one stable placement',scopes.length>0&&scopes.every(scope=>new Set(trees.filter(a=>a.scope===scope).map(a=>JSON.stringify(a.rect))).size===1));
 check('Roots stay at the source contact line',JSON.parse(fs.readFileSync('artifacts/animation-v8/tree_oak-wind-v01/extracted-v04/root-audit.json')).bottom_range===0);
 check('Tree rendering has no coin transactions or dialogs',samples.every(s=>s.gold===18&&s.modal===''));check('This isolated scene stays inside the animation cache target',samples.every(s=>s.animation.decoded_bytes<=48*1024*1024));
 await cmd({op:'freeze'});await page.waitForTimeout(200);const a=await state();await page.waitForTimeout(350);const b=await state();check('Pause freezes wind and leaves the tree visible',a.water_time===b.water_time&&JSON.stringify(a.motion.surface.filter(x=>x.requested&&x.animation==='tree_oak/wind').map(x=>x.source))===JSON.stringify(b.motion.surface.filter(x=>x.requested&&x.animation==='tree_oak/wind').map(x=>x.source)));
 await page.screenshot({path:'qa/animation-v8/oak-wind-engine.png'});check('No runtime or shader errors',r.errors.length===0);r.visible_tree_scopes=scopes;r.max_animation_bytes=Math.max(...samples.map(s=>s.animation.decoded_bytes));fs.writeFileSync('qa/godot/v8-tree-animation.json',JSON.stringify(r,null,2));await browser.close();console.log(JSON.stringify(r));process.exitCode=r.failures.length?1:0;
})().catch(async e=>{console.error(e);if(browser)await browser.close();process.exitCode=1});
