// 逐个真实建筑/灌木检查风动、地基、上下文光边及暂停，隔离存档且不触发广告。
const {chromium}=require('playwright'),fs=require('fs');let browser;
(async()=>{
 const assets=(process.argv.find(a=>a.startsWith('--assets='))||'--assets=hall3,market_mount,forest_shrub').split('=')[1].split(','),manifest=JSON.parse(fs.readFileSync('game/art/animation/manifest.json')).clips;
 const r={scope:'Extra environment cycles in real map, isolated desktop Edge software WebGL',passes:[],failures:[],errors:[],cases:[]},check=(n,c)=>(c?r.passes:r.failures).push(n);
 browser=await chromium.launch({channel:'msedge',headless:true,args:['--enable-webgl','--use-angle=swiftshader']});const ctx=await browser.newContext({viewport:{width:1100,height:550}}),p=await ctx.newPage();p.on('pageerror',e=>r.errors.push(e.message));p.on('console',m=>{if(m.type()==='error')r.errors.push(m.text())});await p.goto('http://127.0.0.1:42819/');await p.waitForFunction(()=>window.__goblinState?.fire_mode,null,{timeout:60000});const cmd=c=>p.evaluate(c=>window.goblinQaCommand(JSON.stringify(c)),c),state=()=>p.evaluate(()=>window.__goblinState);await cmd({op:'motion_probe'});
 for(const asset of assets){
  await cmd({op:'new',seed:935});await cmd({op:'clear'});await cmd({op:'levels',rank:asset==='hall2'?2:3,built:true});await cmd({op:'time',value:30});const id=asset+'/wind',clip=manifest[id];if(!clip){check(asset+': staged clip exists',false);continue;}
  if(asset.startsWith('hall'))await cmd({op:'resources',gold:18,vault:12});const s=await state(),kind=asset.startsWith('hall')?'hall':asset==='thieves_den'?'den':asset.replace('market_','merchant_');let position=s.sites.find(b=>b.kind===kind)?.x;if(asset.startsWith('hall'))position+=95;
  if(asset==='forest_shrub'){
   for(const x of [-900,-500,400,1000,1600,2300]){await cmd({op:'move',x});await p.waitForTimeout(300);const found=(await state()).motion.surface.find(a=>a.requested&&a.scope.startsWith('world/')&&a.animation===id);if(found){position=Number(found.scope.split('/').pop());break;}}
  }
  if(position===undefined){check(asset+': real map fixture is found',false);continue;}
  await cmd({op:'move',x:position});await p.waitForTimeout(650);const rows=[],start=(await state()).water_time;
  for(let i=0;i<180;i++){await p.waitForTimeout(40);const s=await state();rows.push(s);if(s.water_time-start>4.8)break;}
  const body=s=>s.motion.surface.filter(a=>a.requested&&a.scope.startsWith('world/')&&a.animation===id),poses=rows.flatMap(body),scopes=[...new Set(poses.map(a=>a.scope))],frames=new Set(poses.map(a=>JSON.stringify(a.source))).size;
  check(asset+': full wind cycle plays in real map',frames>=17);check(asset+': every object retains its single fixed ground placement',scopes.length>0&&scopes.every(k=>new Set(poses.filter(a=>a.scope===k).map(a=>JSON.stringify(a.rect))).size===1));check(asset+': no duplicate or transparent building during a cycle',rows.every(s=>scopes.every(k=>body(s).filter(a=>a.scope===k).length===1&&body(s).find(a=>a.scope===k).alpha>.999)));
  const base=JSON.parse(fs.readFileSync(clip.provenance+'/root-audit.json'));check(asset+': reviewed source base remains stable',base.bottom_range<=1&&base.left_range<=1&&base.right_range<=1);check(asset+': no currency, ads, dialogs or world simulation side effects',rows.every(s=>s.gold===18&&s.kills===0&&s.modal===''&&!s.ad_inflight));if(asset!=='forest_shrub')check(asset+': approaching retains contextual glow and caption target',rows.some(s=>s.glow&&s.target.object_id===s.sites.find(b=>b.kind===kind).id));
  await cmd({op:'freeze'});await p.waitForTimeout(200);const a=await state();await p.screenshot({path:'qa/animation-v8/'+asset+'-wind-engine.png'});await p.waitForTimeout(300);const b=await state();check(asset+': pause holds the exact wind pose',a.water_time===b.water_time&&JSON.stringify(body(a).map(x=>x.source))===JSON.stringify(body(b).map(x=>x.source)));r.cases.push({asset,position,frames});
 }
 check('No runtime or shader errors',r.errors.length===0);fs.writeFileSync('qa/godot/v8-extra-environment-'+assets.join('-')+'.json',JSON.stringify(r,null,2));await browser.close();console.log(JSON.stringify(r));process.exitCode=r.failures.length?1:0;
})().catch(async e=>{console.error(e);if(browser)await browser.close();process.exitCode=1});
