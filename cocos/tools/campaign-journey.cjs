// 普通经济流程的自动操作策略：只走路、投币和正常征召，不增资源、不改敌人属性。
const { GameModel } = require('../../qa/cocos/model-build/GameModel');
const fs=require('fs'), path=require('path');
const seed=Number(process.argv[2]||731),g=new GameModel(undefined,seed), trace=[];
const b=kind=>g.state.buildings.find(b=>b.kind===kind);
function focus(obj,type){let a=g.context()?.actions.find(a=>a.targetId===obj.id&&a.type===type);const count=g.nearbyTargets;for(let i=0;!a&&i<count;i++){g.cycleTarget();a=g.context()?.actions.find(a=>a.targetId===obj.id&&a.type===type);}return a;}
function step(seconds){for(let i=0;i<seconds*30;i++){g.tick(1/30);if(g.state.status!=='playing')break;}if(g.state.status==='lost')throw Error('chief died');if(g.state.elapsed>9000)throw Error('journey time budget');}
function log(event){trace.push({event,t:Math.round(g.state.elapsed),day:g.state.day,gold:g.state.gold,bank:g.state.treasury,pop:g.population,roles:g.state.goblins.filter(n=>!n.dead).reduce((o,n)=>(o[n.role]=(o[n.role]||0)+1,o),{})});}
function recover(){let t=0;while(Math.abs(g.state.player.x-g.hall.x)>40&&t<120){g.input.axis=Math.sign(g.hall.x-g.state.player.x);g.input.run=true;step(.1);t+=.1;}g.input.axis=0;g.input.run=false;while(g.state.player.hp<96&&t<160){step(.2);t+=.2;}}
function walk(x,limit=180){let t=0;while(Math.abs(g.state.player.x-x)>5&&t<limit&&g.state.status==='playing'){if(g.state.player.hp<48&&x>g.hall.x+200)recover();g.input.axis=Math.sign(x-g.state.player.x);g.input.run=true;step(.1);t+=.1;}g.input.axis=0;g.input.run=false;if(t>=limit)throw Error('walk timeout '+x);}
function collect(){walk(b('treasury').x);while(g.state.gold<50&&g.state.treasury>0){const a=focus(b('treasury'),'withdraw');if(!a||a.disabled)break;g.act(a);step(.14);}}
function money(cost){let t=0;while(g.state.gold<cost&&t<480){
 const hidden=g.state.goblins.find(n=>!n.dead&&n.hidden>0&&n.order==='home');
 if(g.state.treasury===0&&hidden){walk(hidden.x);const whip=g.context()?.actions.find(a=>a.type==='whip');if(whip){g.act(whip);step(.2);}}
 collect();if(g.state.gold<cost)step(1);t++;
}if(g.state.gold<cost)throw Error('income stalled cost '+cost);}
function use(obj,type,wait=true){if(obj.x>1800&&g.state.player.x<1100&&g.state.treasury>0)collect();walk(obj.x);let a=focus(obj,type);if(!a){walk(obj.x+18);a=focus(obj,type);}if(!a&&type==='upgrade'&&obj.level&&obj.hp<=0){use(obj,'build');walk(obj.x);a=focus(obj,type);}if(!a)throw Error('missing action '+obj.kind+':'+type+' context '+g.context()?.kind);if(a.disabled) return false;
 if(a.cost){money(a.cost);walk(obj.x);a=focus(obj,type);if(!a||a.disabled)return false;for(let i=0;i<a.cost;i++){g.act(a);step(.18);}}else g.act(a);
 if(wait&&obj.job){let t=0;walk(obj.x-330);while(obj.job&&t<160){if(g.state.player.hp<60)recover();step(1);t++;}if(obj.job)throw Error('construction stalled '+obj.kind+' '+obj.x);}return true;}
function waitUntil(fn,limit=180){let t=0;while(!fn()&&t<limit){if(g.state.player.hp<50)recover();step(1);t++;}if(!fn())throw Error('wait timeout');}
function reinforce(region){const desired={worker:region>=3?6:region>=2?4:2,brute:region>=3?8:region>=2?6:4,hunter:region>=3?16:region>=2?12:6};
 for(const role of ['worker','brute','hunter']){let loops=0;while(g.state.goblins.filter(n=>!n.dead&&n.role===role).length<desired[role]&&loops++<18){
  // 到访受真实五分钟配额约束，不能继续用旧版80秒截止判作游戏卡死。
  if(!g.state.goblins.some(n=>!n.dead&&n.role==='idle')){if(!b('lure').stock)use(b('lure'),'bait');waitUntil(()=>g.state.goblins.some(n=>!n.dead&&n.role==='idle'),380);}
  const existing=new Set(g.state.goblins.filter(n=>n.role===role).map(n=>n.id));use(b(role),'tool');waitUntil(()=>g.state.goblins.some(n=>!n.dead&&n.role===role&&!existing.has(n.id)),100);
 }}if(g.state.trader.present&&g.state.trader.phase==='trading'&&g.state.enemies.some(e=>e.state==='captured'||e.state==='bound'&&e.atPrison))use({id:-100,x:g.state.trader.x,kind:'trader'},'sell');}
function draft(){waitUntil(()=>g.state.time<45,250);log('draft-start');const fighters=g.state.goblins.filter(n=>!n.dead&&(n.role==='hunter'||n.role==='brute'));const keep=fighters.length>=12?2:fighters.length>=6?1:0;const reserved=[...fighters.filter(n=>n.role==='brute').slice(-keep||fighters.length),...fighters.filter(n=>n.role==='hunter').slice(-keep||fighters.length)].map(n=>n.id);const goal=Math.min(g.flagCapacity,fighters.length-reserved.length);for(let tries=0;tries<60&&g.flagUsed<goal;tries++){
 const n=g.state.goblins.find(n=>!n.dead&&n.order==='home'&&(n.role==='hunter'||n.role==='brute')&&!reserved.includes(n.id));if(!n)break;
 let chase=0;while(Math.abs(n.x-g.state.player.x)>8&&chase<45){g.input.axis=Math.sign(n.x-g.state.player.x);g.input.run=true;step(.1);chase+=.1;}g.input.axis=0;g.input.run=false;
 let a=g.context()?.actions.find(a=>a.type==='recruit'&&!reserved.includes(a.targetId)&&g.state.goblins.find(n=>n.id===a.targetId)?.order==='home');
 for(let i=0;!a&&i<g.nearbyTargets;i++){g.cycleTarget();a=g.context()?.actions.find(a=>a.type==='recruit'&&!reserved.includes(a.targetId)&&g.state.goblins.find(n=>n.id===a.targetId)?.order==='home');}
 if(a){g.act(a);trace.push({event:'draft-unit',id:a.targetId,used:g.flagUsed,t:g.state.elapsed});}else{walk(n.x+20);step(.5);}
 }log('draft-wait');waitUntil(()=>g.flagUsed>0&&g.state.goblins.filter(n=>!n.dead&&n.order==='gather'&&n.role!=='worker').every(n=>Math.abs(n.x-g.gatherSpot(n))<80),120);}
let result;
try{
 use(b('worker'),'tool');use(b('hunter'),'tool');use(b('hunter'),'tool');use(b('brute'),'tool');waitUntil(()=>!g.state.goblins.some(n=>n.role==='idle'),45);
 use(b('wall'),'build');use(b('farm'),'build');use(b('lure'),'build');for(let i=0;i<3;i++)use(b('lure'),'bait');
 use(g.hall,'upgrade');use(g.flag,'build');
 log('base-ready');
 const attempts={};for(let region=0;region<5;region++){
   if(g.nearestCamp&&g.nearestCamp.index<region)region=g.nearestCamp.index;
   attempts[region]=(attempts[region]||0)+1;if(attempts[region]>6)throw Error('region repeatedly lost '+region);
   if(region===1){reinforce(region);if(b('wall').level<Math.min(3,g.hall.level))use(b('wall'),'upgrade');if(!b('tower').level||b('tower').hp<=0)use(b('tower'),'build');}
   if(region===2){reinforce(region);if(g.hall.level<3)use(g.hall,'upgrade');if(g.flag.level<2)use(g.flag,'upgrade');if(b('farm').level<3)use(b('farm'),'upgrade');}
   if(region>=3)reinforce(region);
   if(region>0&&g.state.gearStock>=2){if(!g.forge.level)use(g.forge,'build');if(region>1&&g.forge.level<g.hall.level)use(g.forge,'upgrade');for(let i=0;i<(region>1?3:1)&&g.state.gearStock>=2;i++)use(g.forge,'craft');}
   draft();use(g.flag,'dispatch',false);region=g.state.expedition.camp;log('dispatch-'+region);
   waitUntil(()=>g.state.camps[region].defeated||g.state.status==='won',240);log('cleared-'+region);if(g.state.status==='won')break;walk(g.state.camps[region].x);step(.2);
   const wall=g.state.buildings.find(b=>b.kind==='wall'&&b.region===region);use(wall,'build');while(wall.level<Math.min(3,g.hall.level))use(wall,'upgrade');log('claimed-'+region);use(g.flag,'recall',false);
   walk(g.hall.x);waitUntil(()=>!g.state.goblins.some(n=>!n.dead&&n.order==='return'),160);step(35);
 }
 result={seed,normalEconomy:true,simulated:true,status:g.state.status,elapsed:g.state.elapsed,days:g.state.day,camps:g.state.camps,trace,adReceipts:g.state.adReceipts.length,endingPopulation:g.population};
}catch(error){result={seed,normalEconomy:true,simulated:true,status:'incomplete',error:String(error),stack:error.stack,elapsed:g.state.elapsed,day:g.state.day,trace,state:g.snapshot()};process.exitCode=1;}
const out=path.resolve(__dirname,'../../qa/cocos/campaign-'+seed+'.json');let attempt=1;while(fs.existsSync(out.replace('.json','-attempt'+attempt+'.json')))attempt++;if(fs.existsSync(out))fs.copyFileSync(out,out.replace('.json','-attempt'+attempt+'.json'));fs.writeFileSync(out,JSON.stringify(result,null,2));console.log(JSON.stringify({seed,status:result.status,error:result.error,elapsed:Math.round(result.elapsed),trace:trace.slice(-4),out},null,2));
