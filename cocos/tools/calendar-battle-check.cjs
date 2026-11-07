// 同一中期防线对比不同日期的真实战斗。隔离夹具，只衡量相对压力，不代表普通经济整局。
const fs=require('fs'),{performance}=require('node:perf_hooks'),{GameModel}=require('../../qa/cocos/model-build/GameModel'),{BUILDINGS}=require('../../qa/cocos/model-build/Rules');
const results=[];
for(const day of [1,5,10,20,30]){const g=new GameModel(undefined,731);g.state.day=day;g.campaignDay();g.state.goblins=[];g.hall.level=3;
 const w=g.state.buildings.find(b=>b.kind==='wall'),t=g.state.buildings.find(b=>b.kind==='tower');w.level=t.level=3;w.hp=w.maxHp=BUILDINGS.wall.hp[3];t.hp=t.maxHp=BUILDINGS.tower.hp[3];
 for(let i=0;i<10;i++){const n=g.makeGoblin(i<3?'brute':i<8?'hunter':'worker',w.x-100-i*12);if(n.role==='hunter'){n.gear=2;n.hp=n.maxHp=g.stats(n).hp;}g.state.goblins.push(n);}
 g.spawnRaid();g.spawnRaid=()=>{};const c=g.state.companies[0];c.launchX=w.x+700;g.state.enemies.filter(e=>e.company===c.id).forEach((e,i)=>e.x=e.prevX=w.x+700+i*32);g.state.machines.filter(m=>m.company===c.id).forEach(m=>m.x=m.prevX=w.x+900);
 const beforeGuards=g.state.camps.map(c=>g.campRemaining(c));let peak=0,broken=false;const ms=[];
 for(let i=0;i<140*30&&g.state.status==='playing';i++){const start=performance.now();g.tick(1/30);ms.push(performance.now()-start);peak=Math.max(peak,g.state.enemies.filter(e=>e.company&&e.state==='active').length);if(w.hp<=0)broken=true;}
 ms.sort((a,b)=>a-b);results.push({day,enemyInitial:c.initial,engineKinds:g.state.machines.filter(m=>m.company===c.id).map(m=>m.kind),wallBroke:broken,wallEndHp:Math.round(w.hp),casualties:g.state.goblins.filter(n=>n.dead).reduce((o,n)=>(o[n.role]=(o[n.role]||0)+1,o),{}),survivors:g.population,chiefHp:Math.round(g.state.player.hp),status:g.state.status,enemyLost:c.lost,enemyRetreating:c.retreating,peakActiveField:peak,p95ModelMs:ms[Math.floor(ms.length*.95)],garrisonUnaffected:g.state.camps.every((x,i)=>g.campRemaining(x)===beforeGuards[i])});}
const report={fixture:true,normalEconomy:false,realPhone:false,description:'同一主厅三级、三级墙塔、三恶霸五白铁猎手两工匠，敌军起点移近以排除行军差异，140秒单波战斗',results};fs.writeFileSync('qa/cocos/calendar-battle-comparison.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
