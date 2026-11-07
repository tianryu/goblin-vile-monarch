// 本批隔离模型夹具：只覆盖试玩反馈与直接关联的账本、巡游和碰撞。
const{test}=require('node:test'),assert=require('node:assert/strict');
const{GameModel}=require('../../qa/cocos/model-build/GameModel'),{RULES}=require('../../qa/cocos/model-build/Rules'),{raidPlan}=require('../../qa/cocos/model-build/CampaignRules');
function focus(g,id){g.selected=g.manualTarget=id;g.selectionX=NaN;return g.context();}
function isolate(g){g.state.enemies=[];g.state.goblins=[];g.state.animals=[];g.state.camps.forEach(c=>c.guardQueue=[]);g.state.patrolDays=g.state.camps.map(()=>g.state.day);}
function advance(g,t){for(let i=0;i<t*30;i++)g.tick(1/30);}
function wealth(g){return g.state.gold+g.state.treasury+g.state.coins.reduce((n,c)=>n+c.value,0)+g.state.goblins.reduce((n,q)=>n+q.carry+q.hidden,0);}
function ledger(g){const s=g.state,a=s.army,active=s.enemies.filter(e=>e.force==='field'&&!e.counted&&(e.state==='active'||e.state==='escaping')).length;assert.equal(a.initial+a.recruited+a.recovered-a.lost-a.retired-a.transferred,a.reserve.length+(s.raidPrep?.units.length||0)+s.companies.reduce((n,c)=>n+(c.pending?.length||0),0)+active);}
test('whip drops hidden and courier coins plus carried equipment without double deposit',()=>{
 const g=new GameModel();isolate(g);const n=g.makeGoblin('worker',1100);g.state.goblins.push(n);Object.assign(n,{hidden:2,carry:5,loot:3,task:'lootReturn'});g.state.player.x=1030;const before=wealth(g),gear=g.state.gearStock;g.act(focus(g,n.id).actions.find(a=>a.type==='whip'));assert.equal(n.carry+n.hidden+n.loot,0);assert.equal(g.state.coins.reduce((n,c)=>n+c.value,0),7);assert.equal(g.state.gearDrops.reduce((n,d)=>n+d.amount,0),3);assert.equal(wealth(g),before);n.stunned=15;advance(g,1);assert.equal(g.state.gearStock,gear);assert.equal(wealth(g),before);const loaded=new GameModel(g.snapshot());assert.equal(loaded.state.goblins[0].carry,0);assert.equal(wealth(loaded),before);
});
test('empty pockets never create money on repeated whips',()=>{
 const g=new GameModel();isolate(g);const n=g.makeGoblin('hunter',1100);g.state.goblins.push(n);g.state.player.x=1030;const before=wealth(g);for(let i=0;i<5;i++){n.hit=0;g.act(focus(g,n.id).actions.find(a=>a.type==='whip'));}assert.equal(wealth(g),before);assert.ok(n.stunned>0);
});
test('prison cannot sell or discard captives even when the trader is present',()=>{
 const g=new GameModel(),e=g.state.enemies[0];g.hall.level=2;Object.assign(e,{state:'captured',atPrison:true,stripped:true,x:g.prison.x});Object.assign(g.state.trader,{present:true,phase:'trading',x:g.prison.x+205});g.state.player.x=g.prison.x;const c=focus(g,g.prison.id),old=wealth(g);assert.ok(c.actions.some(a=>a.type==='upgrade'));assert.ok(!c.actions.some(a=>a.type==='sell'));assert.equal(g.act({key:'sell:'+g.prison.id+':',targetId:g.prison.id,type:'sell',cost:0,icon:'coin'}),'none');assert.equal(e.state,'captured');assert.equal(wealth(g),old);
});
test('merchant sale visibly credits purse, overflows to treasury, and only pays once',()=>{
 const g=new GameModel(),e=g.state.enemies[0];Object.assign(e,{state:'captured',atPrison:true,stripped:true,x:g.prison.x});Object.assign(g.state.trader,{present:true,phase:'trading',x:g.prison.x+205});g.state.gold=49;g.state.player.x=g.state.trader.x;const old=g.state.treasury,a=focus(g,-100).actions[0];g.act(a);assert.equal(g.state.gold,50);assert.equal(g.state.treasury,old+RULES.enemy[e.kind].value-1);assert.equal(e.state,'sold');const paid=wealth(g);g.act(a);assert.equal(wealth(g),paid);assert.equal(g.state.sold,1);
});
test('gold ad reward starts at ten and adds one per global day with receipt deduplication',()=>{
 const g=new GameModel();for(const day of [1,2,10,50]){g.state.day=day;const old=wealth(g),receipt='feedback-'+day;assert.equal(g.adGoldReward,9+day);assert.equal(g.grantAdReward('gold',receipt),true);assert.equal(wealth(g)-old,9+day);assert.equal(g.grantAdReward('gold',receipt),false);const b=g.state.buildings.find(b=>b.kind==='goldMerchant');g.state.player.x=b.x;assert.ok(focus(g,b.id).description.includes(String(9+day)));}
});
test('night raid fights through half casualties, leaves engines only when every soldier falls',()=>{
 const g=new GameModel();g.state.day=10;g.spawnRaid();const c=g.state.companies[0];while(c.pending.length)g.updateRaidQueue(4);const units=g.state.enemies.filter(e=>e.company===c.id),machines=g.state.machines.filter(m=>m.company===c.id);units.slice(0,12).forEach(e=>g.hitEnemy(e,99999,0));assert.equal(c.retreating,false);assert.ok(machines.every(m=>m.owner==='enemy'));units.slice(12).forEach(e=>g.hitEnemy(e,99999,0));assert.equal(c.lost,c.initial);assert.ok(machines.every(m=>m.owner==='abandoned'));assert.equal(g.state.army.lost,24);ledger(g);
});
test('old retreat flags no longer withdraw queued night troops on reload',()=>{
 const g=new GameModel();g.state.day=20;g.spawnRaid();const c=g.state.companies[0];c.retreating=true;const pending=c.pending.length,loaded=new GameModel(g.snapshot());assert.equal(loaded.state.companies[0].retreating,false);loaded.updateRaidQueue(4);assert.equal(loaded.state.companies[0].pending.length,pending-6);ledger(loaded);
});
test('dawn never cancels a surviving raid',()=>{
 const g=new GameModel();g.spawnRaid();const c=g.state.companies[0];g.state.time=239.9;advance(g,.2);assert.equal(c.retreating,false);assert.ok(g.state.enemies.some(e=>e.company===c.id&&e.state==='active'));assert.equal(g.state.army.returned,0);
});
test('day patrol uses separate real field IDs without consuming guards or nightly reservations',()=>{
 const g=new GameModel();g.state.time=55;const guards=g.state.camps.map(c=>g.campRemaining(c)),prep=JSON.stringify(g.state.raidPrep),plan=JSON.stringify(raidPlan(g.state.day));g.updateDayPatrols();const patrols=g.state.enemies.filter(e=>e.patrol);assert.equal(patrols.length,13);assert.ok(patrols.every(e=>e.force==='field'&&!e.hero&&!e.towerId));assert.deepEqual(g.state.camps.map(c=>g.campRemaining(c)),guards);assert.equal(JSON.stringify(g.state.raidPrep),prep);assert.equal(JSON.stringify(raidPlan(g.state.day)),plan);ledger(g);g.updateDayPatrols();assert.equal(g.state.enemies.filter(e=>e.patrol).length,13);const e=patrols[0];g.hitEnemy(e,99999,0);assert.equal(g.state.army.lost,1);assert.deepEqual(g.state.camps.map(c=>g.campRemaining(c)),guards);ledger(g);
});
test('patrol return preserves identity and wounds once, including after save reload',()=>{
 const g=new GameModel();g.state.time=55;g.updateDayPatrols();const e=g.state.enemies.find(e=>e.patrol),id=e.id;e.hp=e.maxHp*.4;g.state.time=98;g.updateEnemies(1);assert.equal(e.patrolReturn,true);const loaded=new GameModel(g.snapshot()),unit=loaded.state.enemies.find(e=>e.id===id);unit.x=loaded.state.camps[unit.camp].x-RULES.camps[unit.camp].width*.25;loaded.updateEnemies(.1);assert.equal(loaded.state.army.reserve.filter(n=>n.id===id).length,1);assert.ok(Math.abs(loaded.state.army.reserve.find(n=>n.id===id).hpRatio-.4)<1e-9);loaded.updateEnemies(.1);assert.equal(loaded.state.army.reserve.filter(n=>n.id===id).length,1);ledger(loaded);
});
test('outnumbered daytime goblin runs away while a larger allied party makes patrol enemies flee',()=>{
 const g=new GameModel();const originals=g.state.enemies.slice(0,3);isolate(g);g.state.time=55;const n=g.makeGoblin('hunter',2050);g.state.goblins.push(n);for(let i=0;i<3;i++){Object.assign(originals[i],{x:2300+i*24,prevX:2300+i*24,patrol:true,force:'field'});g.state.enemies.push(originals[i]);}g.updateGoblins(.2);assert.ok(n.x<2050);assert.ok(n.speed>=170);
 g.state.enemies=originals.slice(0,1);g.state.goblins=[g.makeGoblin('hunter',2050),g.makeGoblin('brute',2080),g.makeGoblin('brute',2100)];const e=g.state.enemies[0],x=e.x;g.updateEnemies(.2);assert.ok(e.x>x);assert.ok(e.fleeUntil>g.state.elapsed);
});
test('idle home hunters and brutes roam outside the wall and run back before evening',()=>{
 const g=new GameModel();isolate(g);g.state.time=55;for(const role of ['hunter','brute'])g.state.goblins.push(g.makeGoblin(role,g.frontier-70));advance(g,8);assert.ok(g.state.goblins.every(n=>n.x>g.frontier+160));g.state.time=98;const positions=g.state.goblins.map(n=>n.x);g.updateGoblins(.5);assert.ok(g.state.goblins.every((n,i)=>n.x<positions[i]));assert.ok(g.state.goblins.every(n=>n.speed>=170));
});
test('equal patrol groups engage, while outnumbering cannot make a night attacker retreat',()=>{
 const g=new GameModel(),e=g.state.enemies[0];isolate(g);g.state.time=55;Object.assign(e,{patrol:true,force:'field',x:2200,prevX:2200,cooldown:0});g.state.enemies=[e];const n=g.makeGoblin('brute',2160);g.state.goblins=[n];g.updateGoblins(.1);assert.ok(e.hp<e.maxHp);const before=n.hp;g.updateEnemies(.3);assert.ok(n.hp<before);assert.ok(!e.fleeUntil);
 g.state.time=140;e.patrol=false;e.company=999;e.x=2200;e.cooldown=0;e.hit=0;for(let i=0;i<4;i++)g.state.goblins.push(g.makeGoblin('brute',2150+i*10));g.updateEnemies(.1);assert.ok(!e.fleeUntil);assert.equal(e.state,'active');
});
test('daytime roaming hunter actually kills prey and earns its existing coin reward',()=>{
 const g=new GameModel();isolate(g);g.state.time=55;g.state.player.x=100;g.state.goblins.push(g.makeGoblin('hunter',2040));g.state.animals.push({id:g.id(),kind:'rabbit',x:2200,home:2200,hp:8,face:1,moving:false,timer:0});advance(g,5);assert.ok(g.state.animals[0].hp<=0);assert.ok(g.state.goblins[0].carry+g.state.coins.reduce((n,c)=>n+c.value,0)>0);
});
test('intact enemy gates block both directions for all mounts and destroyed gates allow passage',()=>{
 for(const mount of ['boar','wolf','lizard','bat']){const g=new GameModel();isolate(g);const wall=g.state.fortifications.find(f=>f.kind==='gate'),pad=RULES.enemyWallClearance[wall.rank-2];g.state.player.mount=mount;g.state.player.stamina=100;g.state.player.x=wall.x-pad-1;g.input={axis:1,run:true};advance(g,.5);assert.equal(g.state.player.x,wall.x-pad);g.state.player.x=wall.x+pad+1;g.input.axis=-1;advance(g,.5);assert.equal(g.state.player.x,wall.x+pad);wall.hp=0;advance(g,1);assert.ok(g.state.player.x<wall.x-20);}
});
test('swept wall collision stops at the first live layer even for a long movement step',()=>{
 const g=new GameModel(),walls=g.state.fortifications.filter(f=>f.kind==='gate'&&f.camp===3).sort((a,b)=>a.x-b.x),pad=f=>RULES.enemyWallClearance[f.rank-2];assert.equal(g.stopAtEnemyWall(walls[0].x-300,walls[2].x+300),walls[0].x-pad(walls[0]));walls[0].hp=0;assert.equal(g.stopAtEnemyWall(walls[0].x-300,walls[2].x+300),walls[1].x-pad(walls[1]));assert.equal(g.stopAtEnemyWall(walls[2].x+300,walls[0].x-300),walls[2].x+pad(walls[2]));
});
test('real running consumes stamina, exhaustion slows movement, rest restores and pause freezes it',()=>{
 const g=new GameModel();isolate(g);g.state.player.x=2500;g.input={axis:1,run:true};advance(g,6);assert.equal(g.state.player.exhausted,true);const stamina=g.state.player.stamina;g.pause('qa',true);advance(g,2);assert.equal(g.state.player.stamina,stamina);g.pause('qa',false);advance(g,2);assert.ok(g.state.player.stamina>stamina+30);
});
test('worker only performs stationary hammering while actually building or producing',()=>{
 const g=new GameModel();isolate(g);const n=g.makeGoblin('worker',1950),wall=g.state.buildings.find(b=>b.kind==='wall');g.state.goblins.push(n);wall.job={left:20,total:20,next:1};n.task='construction';n.targetId=wall.id;g.tick(.1);assert.equal(n.working,false);n.x=wall.x-24;g.tick(.1);assert.equal(n.working,true);assert.equal(n.moving,false);n.stunned=8;g.tick(.1);assert.equal(n.working,false);
});
