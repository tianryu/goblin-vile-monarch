// 真实投币施工驱动工作动画，独立浏览器夹具不改正式玩家档。
const {chromium}=require('playwright'),fs=require('fs');let browser;
(async()=>{
 const rank=process.argv.includes('--rank3')?3:process.argv.includes('--rank2')?2:1,name=rank>1?'worker_'+rank:'worker';
 const r={scope:'Visible '+name+' construction animation and idle loop in isolated Edge software WebGL',passes:[],failures:[],errors:[]};const check=(n,c)=>(c?r.passes:r.failures).push(n);
 browser=await chromium.launch({channel:'msedge',headless:true,args:['--enable-webgl','--use-angle=swiftshader']});
 const context=await browser.newContext({viewport:{width:1000,height:500}}),page=await context.newPage();
 page.on('pageerror',e=>r.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')r.errors.push(m.text())});
 await page.goto('http://127.0.0.1:42819/');await page.waitForFunction(()=>window.__goblinState?.fire_mode,null,{timeout:60000});
 const cmd=c=>page.evaluate(c=>window.goblinQaCommand(JSON.stringify(c)),c),state=()=>page.evaluate(()=>window.__goblinState);
 await cmd({op:'motion_probe'});await cmd({op:'new',seed:895});await cmd({op:'clear'});await cmd({op:'time',value:30});
 if(rank>1)await cmd({op:'levels',rank});
 await cmd({op:'unit',role:'worker',x:400});await cmd({op:'move',x:400});const moving=[];
 for(let i=0;i<20;i++){await page.waitForTimeout(60);moving.push(await state());}
 const walks=moving.flatMap(s=>s.motion.actors).filter(a=>a.requested&&a.animation===name+'/walk');
 check('Walking worker uses a full generated gait',walks.length>10&&new Set(walks.map(a=>JSON.stringify(a.source))).size>=9);
 await cmd({op:'new',seed:895});await cmd({op:'clear'});await cmd({op:'time',value:30});await cmd({op:'resources',gold:50});
 if(rank>1)await cmd({op:'levels',rank});
 const wall=(await state()).sites.find(b=>b.kind==='wall'&&b.visible&&b.level===0);if(!wall)throw Error('No build site fixture');
 await cmd({op:'unit',role:'worker',x:wall.x+10});await cmd({op:'move',x:wall.x});await page.waitForTimeout(500);
 await page.keyboard.down('KeyE');await page.waitForTimeout(1800);await page.keyboard.up('KeyE');await page.waitForTimeout(500);
 const paidGold=(await state()).gold;
 const samples=[];for(let i=0;i<24;i++){await page.waitForTimeout(60);samples.push(await state());}
 const poses=samples.flatMap(s=>s.motion.actors).filter(a=>a.requested&&a.animation===name+'/work');
 check('Real coin-funded construction uses the generated hammer action',poses.length>12);check('Work cycle advances through many source poses',new Set(poses.map(a=>JSON.stringify(a.source))).size>=9);
 check('Repeated visuals do not spend extra coins',paidGold<50&&samples.every(s=>s.gold===paidGold));check('Construction stays in the world without a dialog',samples.every(s=>s.modal===''));
 await page.screenshot({path:'qa/animation-v8/'+name+'-construction.png'});
 await cmd({op:'new',seed:895});await cmd({op:'clear'});await cmd({op:'time',value:30});await cmd({op:'unit',role:'idle',x:210});await cmd({op:'move',x:210});await page.waitForTimeout(900);
 const idle=[];for(let i=0;i<22;i++){await page.waitForTimeout(90);idle.push(await state());}
 const breathing=idle.flatMap(s=>s.motion.actors).filter(a=>a.requested&&a.animation==='idle/idle');
 check('An idle goblin uses the generated breathing loop',breathing.length>10);check('Idle advances through blink and breathing frames',new Set(breathing.map(a=>JSON.stringify(a.source))).size>=12);
 check('No runtime or shader errors',r.errors.length===0);r.samples=samples.map(s=>({gold:s.gold,animation:s.animation}));
 fs.writeFileSync('qa/godot/v8-worker-animation'+(rank>1?'-rank'+rank:'')+'.json',JSON.stringify(r,null,2));await browser.close();console.log(JSON.stringify({passes:r.passes.length,failures:r.failures,errors:r.errors}));process.exitCode=r.failures.length?1:0;
})().catch(async e=>{console.error(e);if(browser)await browser.close();process.exitCode=1});
