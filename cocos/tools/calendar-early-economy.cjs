// 本轮仅检查普通经济至首次出征，不代替完整战役；沿用保守经营策略，不注入资源或改敌军。
const{GameModel}=require('../../qa/cocos/model-build/GameModel'),{RULES}=require('../../qa/cocos/model-build/Rules'),fs=require('fs'),path=require('path');
const seed=Number(process.argv[2]||731),g=new GameModel(undefined,seed),trace=[],b=k=>g.state.buildings.find(b=>b.kind===k),outdir=path.resolve('qa/cocos/calendar-early-economy');fs.mkdirSync(outdir,{recursive:true});
let chores=false,maxActive=0,funding=0;const WON=Symbol('victory'),EARLY=Symbol('first-dispatch');
function step(s){for(let i=0;i<s*30;i++){g.tick(1/30);maxActive=Math.max(maxActive,g.state.enemies.filter(e=>e.state==='active').length);if(g.state.status==='won')throw WON;if(g.state.status==='lost')throw Error('chief died');if(g.state.elapsed>12000)throw Error('journey time budget');}}
function log(event){if(event==='dispatch-0')throw EARLY;trace.push({event,t:Math.round(g.state.elapsed),day:g.state.day,gold:g.state.gold,bank:g.state.treasury,pop:g.population,hall:g.hall.level,flag:g.flag.level,kills:g.state.kills,sold:g.state.sold,roles:g.state.goblins.filter(n=>!n.dead).reduce((o,n)=>(o[n.role]=(o[n.role]||0)+1,o),{})});if(['foundation','dispatch-0','cleared-2','cleared-3'].includes(event))fs.writeFileSync(path.join(outdir,`${seed}-${event}-snapshot.json`),JSON.stringify(g.snapshot()));}
function focus(obj,type){g.context();for(let i=0;i<=g.nearbyTargets;i++){const a=g.context()?.actions.find(a=>a.targetId===obj.id&&a.type===type);if(a)return a;g.cycleTarget();}}
function walk(x){let t=0;while(Math.abs(g.state.player.x-x)>6&&t<600){
 if(g.state.player.hp<45&&Math.abs(g.state.player.x-g.hall.x)>160){while(Math.abs(g.state.player.x-g.hall.x)>80){g.input.axis=Math.sign(g.hall.x-g.state.player.x);g.input.run=true;step(.1);}g.input.axis=0;g.input.run=false;while(g.state.player.hp<96)step(.2);}
 g.input.axis=Math.sign(x-g.state.player.x);g.input.run=true;step(.1);t+=.1;}g.input.axis=0;g.input.run=false;if(t>=600)throw Error('walk timeout');}
function collect(){walk(b('treasury').x);while(g.state.gold<50&&g.state.treasury>0){const a=focus(b('treasury'),'withdraw');if(!a||a.disabled)break;g.act(a);step(.14);}}
function safety(){if(g.state.player.hp<62){walk(g.hall.x);while(g.state.player.hp<95)step(.2);}}
function service(){if(chores)return;chores=true;try{
 if(g.state.gold<12&&g.state.treasury>0)collect();
 const fallen=g.state.buildings.filter(b=>b.kind==='wall'&&b.level&&b.hp<=0&&!b.job).sort((a,b)=>b.x-a.x)[0];
 if(fallen&&g.state.gold>=2&&!g.state.enemies.some(e=>e.state==='active'&&Math.abs(e.x-fallen.x)<500)){use(fallen,'build',false);log('repair-ordered');}
 if(g.state.gold<Math.max(20,funding)&&g.state.gearStock>4){walk(b('gear').x);while(g.state.gold<Math.max(28,funding)&&g.state.gearStock>4){const a=focus(b('gear'),'scrapGear');if(!a)break;g.act(a);step(.15);}log('scrap-surplus');}
 const t=g.state.trader;if(t.present&&t.phase==='trading'&&g.state.enemies.some(e=>e.state==='captured'||e.state==='bound'&&e.atPrison&&!e.hauler)){walk(t.x);const a=focus({id:-100},'sell');if(a&&!a.disabled){g.act(a);log('trade');}}
 const lure=b('lure');if(lure.level&&lure.stock<1&&g.population<g.populationLimit&&g.state.gold>=2)use(lure,'bait');
 // 到访后及时分配职业，维持低人口军队而非囤十几个闲置居民。
 const idle=g.state.goblins.filter(n=>!n.dead&&n.role==='idle').length;
 const fighters=g.state.goblins.filter(n=>!n.dead&&['hunter','brute'].includes(n.role)).length;
 if(idle>(g.population>=12?2:g.population>=7?1:0)&&g.state.gold>=(fighters<Math.max(6,g.flagCapacity+2)?5:funding+5)){const workers=g.state.goblins.filter(n=>!n.dead&&n.role==='worker').length,brutes=g.state.goblins.filter(n=>!n.dead&&n.role==='brute').length;const role=workers<(g.state.camps[1].rewarded&&g.state.machines.some(m=>m.owner!=='enemy')?4:g.hall.level>=5?3:2)?'worker':brutes<Math.max(2,g.hall.level)?'brute':'hunter';if(!b(role).stock)use(b(role),'tool');}
 if(g.flag.level&&g.state.camps[0].rewarded&&g.flagUsed<g.flagCapacity&&g.state.expedition.state!=='march'&&fighters>g.flagUsed+1){const n=g.state.goblins.filter(n=>!n.dead&&['hunter','brute'].includes(n.role)&&n.order==='home').sort((a,b)=>(a.role==='brute'?0:1)-(b.role==='brute'?0:1))[0];if(n){walk(n.x);const a=focus(n,'recruit');if(a)g.act(a);}}
}finally{chores=false;}}
function money(cost){const before=funding,start=g.state.elapsed;funding=cost;try{while(g.state.gold<cost&&g.state.elapsed-start<1200){collect();if(g.state.gold>=cost)break;service();step(2);}if(g.state.gold<cost)throw Error('income stalled '+cost);}finally{funding=before;}}
function safeApproach(obj){if(g.state.player.x<obj.x-450)walk(obj.x-450);for(let t=0;t<500;t++){const dangerous=g.state.enemies.some(e=>e.state==='active'&&Math.abs(e.x-obj.x)<540&&!g.state.companies.find(c=>c.id===e.company)?.retreating);if(!dangerous)break;if(g.state.player.x>obj.x-450)walk(obj.x-450);safety();step(.5);}}
function use(obj,type,wait=true){if(obj.region>=0&&!g.visible(obj))waitForTerritory(obj);safeApproach(obj);walk(obj.x-120);let a=focus(obj,type);if(!a&&type==='upgrade'&&obj.level&&obj.hp<=0){use(obj,'build');return use(obj,type,wait);}if(!a)throw Error('missing action '+obj.kind+':'+type+' L'+obj.level);if(a.disabled)return false;if(a.cost){money(a.cost);walk(obj.x-120);a=focus(obj,type);if(!a||a.disabled)return false;for(let i=0;i<a.cost;i++){if(g.state.player.hp<65){safety();return use(obj,type,wait);}g.act(a);step(.18);}}else{g.act(a);step(.05);}
 if(wait&&obj.job){let time=0;walk(Math.min(obj.x-310,g.frontier-130));while(obj.job&&time<360){safety();step(1);time++;}if(obj.job)throw Error('construction stalled '+obj.kind+' '+obj.x);}return true;}
function wait(fn,limit=600){let time=0;while(!fn()&&time<limit){safety();service();step(1);time++;}if(!fn())throw Error('waiting timeout');}
function waitForTerritory(obj){log('territory-recapture-wait');wait(()=>g.visible(obj),420);}
function upgrade(obj,level){while(obj.level<level){if(obj.job)wait(()=>!obj.job,420);if(obj.hp<=0&&obj.maxHp>0)use(obj,'build');use(obj,'upgrade');}}
function draft(){const goal=Math.min(g.flagCapacity,g.state.goblins.filter(n=>!n.dead&&['hunter','brute'].includes(n.role)).length-1);for(let j=0;j<40&&g.flagUsed<goal;j++){
 const tanks=g.state.goblins.filter(n=>!n.dead&&n.role==='brute'&&n.order!=='home').length,desiredTanks=Math.min(4,Math.ceil(g.flagCapacity/3));
 const n=g.state.goblins.filter(n=>!n.dead&&['hunter','brute'].includes(n.role)&&n.order==='home').sort((a,b)=>(tanks<desiredTanks?(a.role==='brute'?0:1)-(b.role==='brute'?0:1):0)||Math.abs(a.x-g.state.player.x)-Math.abs(b.x-g.state.player.x))[0];if(!n)break;let chase=0;while(Math.abs(n.x-g.state.player.x)>30&&chase<100){g.input.axis=Math.sign(n.x-g.state.player.x);g.input.run=true;step(.1);chase+=.1;}g.input.axis=0;g.input.run=false;const a=focus(n,'recruit');if(a){const result=g.act(a);trace.push({event:'draft',id:n.id,role:n.role,result,order:n.order,used:g.flagUsed,t:g.state.elapsed});}
 }walk(g.flag.x);wait(()=>g.canDispatch()&&g.state.goblins.filter(n=>!n.dead&&n.order==='gather'&&n.role!=='worker').every(n=>Math.abs(n.x-g.gatherSpot(n))<80),160);}
let result;
try{
 for(const role of ['worker','hunter','hunter','brute'])use(b(role),'tool');wait(()=>g.state.goblins.every(n=>n.role!=='idle'),60);
 use(b('wall'),'build');use(b('lure'),'build');use(b('lure'),'bait');use(b('farm'),'build');use(b('tower'),'build');log('foundation');
 upgrade(g.hall,2);upgrade(b('wall'),2);upgrade(b('lure'),2);upgrade(g.prison,2);use(g.flag,'build');
 wait(()=>g.population>=8&&g.state.goblins.filter(n=>!n.dead&&['hunter','brute'].includes(n.role)).length>=5,1600);log('population-ready');
 if(g.state.gearStock>=2){use(g.forge,'build');use(g.forge,'craft');wait(()=>g.state.goblins.some(n=>n.gear),120);}
 for(let region=0;region<5;region++){
  if(g.nearestCamp?.index!==region)throw Error('earlier territory lost before region '+region);
  if(region&&region<4){collect();upgrade(g.hall,Math.min(5,region+2));
   if(g.forge.level)upgrade(g.forge,g.hall.level>=5?3:2);else if(g.state.gearStock>=2)use(g.forge,'build');
   upgrade(g.prison,Math.min(3,g.hall.level));
   upgrade(b('farm'),Math.min(3,g.hall.level));
   if(region>=2){const mine=g.state.buildings.find(b=>b.kind==='mine'&&b.region===1);if(!mine.level)use(mine,'build');}
   // 跃墙兵要求先加高已有前线，再花钱扩大编队，不能一直拿低墙硬接后期波次。
   const tower=g.state.buildings.find(b=>b.kind==='tower'&&b.region===region-1);if(!tower.level)use(tower,'build');if(region>=2)upgrade(tower,g.hall.level);
   const front=g.state.buildings.filter(b=>b.kind==='wall'&&b.level).sort((a,b)=>b.x-a.x)[0];upgrade(front,region>=2?g.hall.level:3);
   upgrade(g.flag,Math.min(4,region+1));if(region>=2)upgrade(b('lure'),4);
   const target=g.flagCapacity+5;wait(()=>g.population>=target&&g.state.goblins.filter(n=>!n.dead&&['hunter','brute'].includes(n.role)).length>=g.flagCapacity+1,1800);
   if(g.state.gold+g.state.treasury>35)for(let i=0;i<2&&g.state.gearStock>=2&&g.state.goblins.some(n=>!n.dead&&n.role==='hunter'&&!n.gear&&n.order!=='expedition');i++)use(g.forge,'craft');
  }
  if(region>=2){const engine=g.state.machines.find(m=>m.owner==='goblin'&&m.order==='park'&&m.kind!=='ram'&&m.hp>0);if(engine&&g.flagCapacity-g.flagUsed>=2&&g.availableWorkers().length>=2){if(engine.hp<engine.maxHp)use(engine,'repairMachine');use(engine,'crew',false);log('crew-artillery');}}
  for(let attempt=0;g.state.expedition.state!=='march'&&attempt<12;attempt++){
   money(8);draft();
   // 防线修复会移动军旗，必须重新确认集结就绪；灰掉的按钮不能当作已经发兵。
   wait(()=>g.state.time<55&&g.canDispatch()&&!g.state.enemies.some(e=>e.state==='active'&&e.company&&e.x<g.frontier+900&&!g.state.companies.find(c=>c.id===e.company)?.retreating),500);
   money(8);use(g.flag,'dispatch',false);
  }
  if(g.state.expedition.state!=='march')throw Error('dispatch was never committed');log('dispatch-'+region);
  wait(()=>g.state.camps[region].defeated||g.flagUsed===0||g.state.status==='won',420);if(g.state.status==='won')break;if(!g.state.camps[region].defeated)throw Error('expedition defeated at region '+region);log('cleared-'+region);
  if(region>=3){log('continue-to-ship');continue;}walk(g.state.camps[region].x);step(1);const wall=g.state.buildings.find(b=>b.kind==='wall'&&b.region===region);use(wall,'build');upgrade(wall,Math.min(3,g.hall.level));log('claimed-'+region);
 }
 // 连续推进期间未筑墙的后方营地可能复建，回头清理仍然走付费出征，不直接标记胜利。
 for(let retry=0;g.state.status==='playing'&&retry<4;retry++){money(8);walk(g.flag.x-100);const target=g.nearestCamp?.index;use(g.flag,'dispatch',false);log('recapture-'+target);wait(()=>g.state.camps[target].defeated||g.flagUsed===0,420);}
 if(g.state.status!=='won')throw Error('campaign objectives remain');
 result={status:g.state.status,seed,normalEconomy:true,adReceipts:g.state.adReceipts.length,elapsed:g.state.elapsed,days:g.state.day,trace,maxActive,endingPopulation:g.population};
}catch(e){if(e===EARLY)result={status:'first-dispatch-committed',normalEconomy:true,adReceipts:g.state.adReceipts.length,seed,days:g.state.day,elapsed:g.state.elapsed,trace,maxActive,state:g.snapshot()};else if(e===WON)result={status:'won',seed,normalEconomy:true,adReceipts:g.state.adReceipts.length,elapsed:g.state.elapsed,days:g.state.day,trace,maxActive,endingPopulation:g.population,camps:g.state.camps,state:g.snapshot()};else{result={status:'incomplete',seed,error:String(e),stack:e.stack,elapsed:g.state.elapsed,trace,maxActive,state:g.snapshot()};process.exitCode=1;}}
let attempt=1;while(fs.existsSync(path.join(outdir,`${seed}-attempt${attempt}.json`)))attempt++;const out=path.join(outdir,`${seed}-attempt${attempt}.json`);fs.writeFileSync(out,JSON.stringify(result,null,2));console.log(JSON.stringify({status:result.status,error:result.error,elapsed:Math.round(result.elapsed),trace:trace.slice(-5),out},null,2));
