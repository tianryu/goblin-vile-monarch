// 桌面模型诊断。统计明确分开普通经济策略、无操作基线和人工压力夹具。
const fs=require('fs'),{performance}=require('node:perf_hooks'),{GameModel}=require('../../qa/cocos/model-build/GameModel');
const out='qa/cocos/v11-diagnostics.json',sort=a=>a.sort((a,b)=>a-b),percentile=(a,q)=>a[Math.floor((a.length-1)*q)];
const baseline=[];
for(const seed of [731,2026,1103]){const g=new GameModel(undefined,seed);for(let i=0;i<1800*30&&g.state.status==='playing';i++)g.tick(1/30);baseline.push({seed,status:g.state.status,elapsed:g.state.elapsed,day:g.state.day,kind:'no-input-no-defense'});}
const g=new GameModel(undefined,731);g.hall.level=5;g.state.enemies=[];g.state.goblins=[];g.state.player.x=400;
for(let i=0;i<24;i++){const n=g.makeGoblin(i<6?'brute':'hunter',4000+i*15);n.order='expedition';g.state.goblins.push(n);}
for(let i=0;i<96;i++)g.makeEnemy(['human','elf','shield','mage','dwarf','jumper'][i%6],4500+i*11,0,1);
let peakActive=0;const ms=[];for(let i=0;i<900;i++){const t=performance.now();g.tick(1/30);ms.push(performance.now()-t);peakActive=Math.max(peakActive,g.state.enemies.filter(e=>e.state==='active').length);}sort(ms);
const campaign=['731-attempt39','2026-attempt1','1103-attempt1'].map(id=>{const r=JSON.parse(fs.readFileSync('qa/cocos/v11-campaign/'+id+'.json'));return{id,status:r.status,error:r.error||null,seconds:r.elapsed,minutes:r.elapsed/60,firstDispatchDay:r.trace.find(t=>t.event==='dispatch-0')?.day,adReceipts:r.adReceipts??r.state?.adReceipts?.length,maxActive:r.maxActive};});
const report={date:'2026-11-03',realPhone:false,engineRenderingIncluded:false,normalCampaign:campaign,baseline,stressFixture:{seed:731,initialAllies:24,initialEnemies:96,steps:900,peakActive,p50Ms:percentile(ms,.5),p95Ms:percentile(ms,.95),p99Ms:percentile(ms,.99),maxMs:ms.at(-1)},interpretation:'普通经济两种子通关，一个种子在中军推进超过控制器420秒预算，保留未完成；不能据此计算真人败率。通关时长是保守自动策略147至174分钟，不是35至50分钟目标的达成证据。无操作基线仅说明不准备会失败。压力数据是桌面Node逻辑，不是手机帧率。'};
fs.writeFileSync(out,JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
