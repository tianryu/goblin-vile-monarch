// 针对真实缺陷验证表现与结算一致，不依赖引擎或正式玩家存档。
const{test}=require('node:test'),assert=require('node:assert/strict');
const{GameModel}=require('../../qa/cocos/model-build/GameModel');
const{RULES}=require('../../qa/cocos/model-build/Rules');
const{captiveHeight,prisonLayout}=require('../../qa/cocos/model-build/PrisonLayout');
function quiet(){const g=new GameModel();g.state.enemies=[];g.state.fortifications=[];g.state.goblins=[];g.spawnRaid=()=>{};for(const c of g.state.camps){c.reserve=[];c.heroesPending=[];c.guardQueue=[];}return g;}
test('arrow and fireball miss a player who left the actual impact point',()=>{
 for(const kind of ['arrow','fireball']){const g=quiet();g.state.player.x=2000;g.shoot(2300,2000,-1,13,false,kind);const s=g.state.shots[0];g.state.player.x=1900;g.updateShots(s.duration);assert.equal(g.state.player.hp,100);assert.equal(s.hit,true);}
});
test('a real projectile hit settles once, not again after hurt protection expires',()=>{
 const g=quiet();g.state.player.x=2000;g.shoot(2300,2000,-1,13,false,'arrow');g.updateShots(1);assert.equal(g.state.player.hp,87);g.state.player.hurt=0;g.updateShots(2);assert.equal(g.state.player.hp,87);
});
test('flight and tower elevation use the same launch and hit plane as the rendering',()=>{
 const g=quiet();g.state.player.x=2000;g.shoot(2300,2000,-1,13,false,'arrow');g.state.player.fly=42;g.updateShots(1);assert.equal(g.state.player.hp,100);
 g.state.player.hurt=0;g.shoot(2300,2000,-1,13,false,'arrow');assert.equal(g.state.shots[0].targetY,88);g.updateShots(1);assert.equal(g.state.player.hp,87);
});
test('moving goblins and machinery are not damaged through stale target IDs',()=>{
 const g=quiet(),n=g.makeGoblin('worker',2100);g.state.goblins.push(n);g.shoot(2400,2100,n.id,7,false,'arrow');n.x=2000;g.updateShots(1);assert.equal(n.hp,n.maxHp);
 const m={id:g.id(),kind:'catapult',x:2100,prevX:2100,hp:130,maxHp:130,owner:'goblin',company:0,crew:[],order:'park',cooldown:0,moving:false};g.state.machines.push(m);g.shoot(2400,2100,m.id,7,false,'fireball');m.x=2000;g.updateShots(1);assert.equal(m.hp,130);
});
test('empty-quiver elite elf still uses real arrows, ordinary elf closes into melee',()=>{
 const g=quiet();g.state.player.x=5000;const e=g.makeEnemy('elf',5200,0,1);e.hero='longbow';e.ammo=0;e.cooldown=0;e.spells=3;g.updateEnemies(1/30);assert.equal(g.state.shots.length,1);assert.equal(g.state.shots[0].kind,'arrow');assert.equal(g.state.player.hp,100);
 g.state.shots=[];delete e.hero;e.cooldown=0;e.x=5200;g.updateEnemies(1/30);assert.equal(g.state.shots.length,0);assert.equal(g.state.player.hp,100);assert.ok(e.x<5200);
});
test('walking and hauling time cannot be banked as production',()=>{
 const g=quiet(),farm=g.state.buildings.find(b=>b.kind==='farm'),wall=g.state.buildings.find(b=>b.kind==='wall');wall.level=1;wall.hp=140;farm.level=1;farm.hp=100;
 const n=g.makeGoblin('worker',farm.x-400);g.state.goblins.push(n);n.timer=999;g.updateGoblins(1/30);assert.equal(n.carry,0);n.x=farm.x;g.updateGoblins(1/30);assert.equal(n.carry,0);assert.ok(n.workTime<1);
 for(let i=0;i<300;i++)g.updateGoblins(1/30);const progress=n.workTime;assert.ok(progress>5&&progress<20);
 n.task='lootReturn';n.loot=1;g.updateGoblins(1/30);n.task='';n.loot=0;n.x=farm.x;g.updateGoblins(1/30);assert.ok(n.workTime<1);assert.equal(n.carry,0);
 const saved=g.snapshot(),loaded=new GameModel(saved);loaded.updateGoblins(1/30);assert.equal(loaded.state.goblins[0].carry,0);
});
test('one low-level production site has one real worker slot, not unlimited multipliers',()=>{
 const g=quiet(),farm=g.state.buildings.find(b=>b.kind==='farm'),wall=g.state.buildings.find(b=>b.kind==='wall');wall.level=1;wall.hp=140;farm.level=1;farm.hp=100;
 for(let i=0;i<4;i++)g.state.goblins.push(g.makeGoblin('worker',farm.x));
 for(let i=0;i<30*37;i++)g.updateGoblins(1/30);assert.equal(g.state.goblins.reduce((v,n)=>v+n.carry,0),1);assert.equal(g.state.goblins.filter(n=>n.workAt===farm.id).length,1);
});
test('a fallen loot carrier drops the same gear once and does not destroy it',()=>{
 const g=quiet(),n=g.makeGoblin('worker',2100);g.state.goblins.push(n);n.loot=3;g.hurtTarget(n.id,999,2200);assert.equal(n.loot,0);assert.equal(g.state.gearDrops.reduce((v,n)=>v+n.amount,0),3);g.hurtTarget(n.id,999,2200);assert.equal(g.state.gearDrops.reduce((v,n)=>v+n.amount,0),3);
});
test('early dispatch depends on money and upgrades, never a day-number lock',()=>{
 const g=quiet();g.hall.level=2;g.flag.level=1;g.state.player.x=g.flag.x;const n=g.makeGoblin('hunter',g.flag.x);n.order='gather';g.state.goblins.push(n);g.state.gold=5;
 const a=g.context().actions.find(a=>a.type==='dispatch');assert.ok(a&&!a.disabled);for(let i=0;i<3;i++)g.act(a);assert.equal(g.state.day,1);assert.equal(g.state.expedition.state,'march');assert.equal(g.state.gold,2);
});
test('stationed army can be paid to continue, or freely recalled, without an automatic chain',()=>{
 const g=quiet();g.hall.level=2;g.flag.level=1;g.state.player.x=g.flag.x;g.state.camps[0].defeated=true;g.state.expedition={state:'hold',camp:0};const n=g.makeGoblin('hunter',5500);n.order='expedition';g.state.goblins.push(n);
 assert.equal(g.state.expedition.camp,0);const c=g.context();assert.ok(c.actions.some(a=>a.type==='recall'));const a=c.actions.find(a=>a.type==='dispatch');assert.ok(a&&!a.disabled);g.act(a);assert.equal(g.context().name,'出征旗帜');g.act(a);g.act(a);assert.equal(g.state.expedition.camp,1);assert.equal(g.state.expedition.state,'march');assert.equal(n.order,'expedition');
 const recall=g.context().actions.find(a=>a.type==='recall');g.act(recall);assert.equal(n.order,'return');assert.equal(g.state.expedition.state,'return');
});
test('full visible tool inventory cannot silently take payment for hidden tools',()=>{
 const g=quiet(),b=g.state.buildings.find(b=>b.kind==='worker');b.stock=4;g.state.player.x=b.x;const a=g.context().actions.find(a=>a.type==='tool');assert.equal(a.disabled,true);const money=g.state.gold;g.act(a);assert.equal(g.state.gold,money);assert.equal(b.stock,4);
});
test('refund after another gain respects the purse limit and conserves all coins',()=>{
 const g=quiet(),b=g.state.buildings.find(b=>b.kind==='wall');g.state.player.x=b.x;const a=g.context().actions.find(a=>a.type==='build');g.act(a);g.act(a);g.gain(30);const total=g.state.gold+g.state.treasury+g.state.pledge.paid;g.cancelPledge();assert.equal(g.state.gold,50);assert.equal(g.state.gold+g.state.treasury,total);g.cancelPledge();assert.equal(g.state.gold+g.state.treasury,total);
});
test('reinforcement rewards reserve overflow instead of exceeding the hall capacity',()=>{
 const g=quiet();while(g.population<g.populationLimit)g.state.goblins.push(g.makeGoblin('idle',400));const cap=g.populationLimit;g.grantAdReward('hunter','isolated-repair-receipt');assert.equal(g.population,cap);assert.equal(g.state.populationPending.hunter,2);g.state.goblins[0].dead=true;g.fillPending();assert.equal(g.population,cap);assert.equal(g.state.populationPending.hunter,1);assert.equal(g.grantAdReward('hunter','isolated-repair-receipt'),false);
});
test('hauling stays attached during fire avoidance and a stun, with exactly one carrier',()=>{
 const g=quiet(),n=g.makeGoblin('worker',2100);g.state.goblins.push(n);const e=g.makeEnemy('human',2148,0);e.state='bound';e.stripped=true;e.hauler=n.id;e.atPrison=false;n.task='haul';n.targetId=e.id;g.effect('warning',2080,1.7);g.updateGoblins(.1);g.updatePrison(.1);assert.equal(Math.abs(e.x-n.x),48);assert.equal(e.hauler,n.id);assert.equal(n.face,1);n.stunned=8;const before=e.x;g.updateGoblins(.1);g.updatePrison(.1);assert.equal(e.x,before);
});
test('large captives retain height and prison model cells fit the same rendered layout',()=>{
 const g=quiet();g.prison.level=3;g.prison.hp=250;const e=g.makeEnemy('dwarf',700,0);e.hero='heavy';e.bodyHeight=118;e.state='captured';e.atPrison=true;g.updatePrison(.1);assert.equal(captiveHeight(e),118);const layout=prisonLayout(3,[e]);assert.equal(e.x,g.prison.x+layout.slotX(e.prisonSlot));for(let i=0;i<6;i++){const height=i===e.prisonSlot?118:77;assert.ok(Math.abs(layout.slotX(i))+height*.35<layout.width/2);assert.ok(layout.slotY(i)-height>-layout.height);}
});
test('tower marksman leaves the old shot height when he leaves the tower',()=>{
 const g=quiet(),tower=g.state.buildings.find(b=>b.kind==='tower');tower.level=1;tower.hp=90;const n=g.makeGoblin('hunter',tower.x);n.towerId=tower.id;g.state.goblins.push(n);g.shoot(tower.x+250,n.x,n.id,7,false,'arrow');assert.equal(g.state.shots[0].targetY,171);n.towerId=undefined;g.updateShots(1);assert.equal(n.hp,n.maxHp);
});
test('civilians flee away from enemies on either side and remain inside the cave boundary',()=>{
 for(const side of [-1,1]){const g=quiet(),n=g.makeGoblin('worker',2100);g.state.goblins.push(n);g.makeEnemy('human',n.x+side*100,0);const start=n.x;g.updateGoblins(.1);assert.ok((n.x-start)*side<0);}
 const g=quiet(),n=g.makeGoblin('idle',RULES.worldMin+96);g.state.goblins.push(n);g.makeEnemy('human',n.x+100,0);g.updateGoblins(.1);assert.ok(n.x>=RULES.worldMin+95);
});
test('rally line spreads all soldiers behind the flag with distinct safe positions',()=>{
 const g=quiet();g.flag.level=1;for(let i=0;i<8;i++){const n=g.makeGoblin(i%3?'hunter':'brute',g.flag.x);n.order='gather';g.state.goblins.push(n);}const xs=g.state.goblins.map(n=>g.gatherSpot(n));assert.equal(new Set(xs).size,8);assert.ok(xs.every(x=>x<g.flag.x));assert.ok(Math.max(...xs)-Math.min(...xs)>=294);
});
test('losing an expedition releases recruitment without reviving or refunding the fallen',()=>{
 const g=quiet();g.flag.level=1;g.state.expedition.state='march';const lost=g.makeGoblin('hunter',6000);lost.order='expedition';lost.dead=true;g.state.goblins.push(lost);const survivor=g.makeGoblin('hunter',2600);g.state.goblins.push(survivor);g.state.player.x=2600;const gold=g.state.gold;g.updateCampaign(.1);assert.equal(g.state.expedition.state,'home');assert.equal(lost.dead,true);assert.equal(g.state.gold,gold);g.act(g.context().actions.find(a=>a.type==='recruit'));assert.equal(survivor.order,'gather');
});
test('a destroyed advanced wall returns the flag behind the remaining completed wall',()=>{
 const g=quiet();g.flag.level=1;const home=g.state.buildings.find(b=>b.kind==='wall'&&b.region===-1),advanced=g.state.buildings.find(b=>b.kind==='wall'&&b.region===0);home.level=1;home.hp=140;advanced.level=1;advanced.hp=140;g.state.camps[0].defeated=g.state.camps[0].claimed=true;g.flag.x=advanced.x-270;g.hurtTarget(advanced.id,200,advanced.x+20);assert.equal(g.flag.x,home.x-270);assert.equal(g.state.camps[0].claimed,false);assert.equal(advanced.hp,0);g.hurtTarget(home.id,200,home.x+20);assert.equal(g.flag.x,970);
});
