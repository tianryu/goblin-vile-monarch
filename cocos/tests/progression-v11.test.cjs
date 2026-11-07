const{test}=require('node:test'),assert=require('node:assert/strict');
const{GameModel}=require('../../qa/cocos/model-build/GameModel'),{RULES,HEROES,BUILDINGS}=require('../../qa/cocos/model-build/Rules'),{prisonLayout,captiveHeight}=require('../../qa/cocos/model-build/PrisonLayout');
function quiet(){const g=new GameModel();g.state.enemies=[];g.state.goblins=[];g.state.fortifications=[];for(const c of g.state.camps){c.reserve=[];c.heroesPending=[];c.guardQueue=[];}return g;}
function focus(g,b,type){g.state.player.x=b.x;g.manualTarget=b.id;g.selectionX=NaN;return g.context()?.actions.find(a=>a.type===type);}
function pay(g,b,type){const a=focus(g,b,type);assert.ok(a);g.state.gold=50;for(let i=0;i<Math.max(1,a.cost);i++)g.act(a);return a;}
test('V11 every upgradeable building has a complete payable progression and a real end cap',()=>{
 for(const kind of Object.keys(BUILDINGS).filter(k=>BUILDINGS[k].maxLevel>1)){
  const g=quiet();g.hall.level=5;g.state.camps.forEach(c=>c.rewarded=true);const b=g.state.buildings.find(b=>b.kind===kind);if(kind==='hall')g.hall.level=1;else b.level=1;b.hp=b.maxHp=100;
  while(b.level<BUILDINGS[kind].maxLevel){const next=b.level+1,cost=pay(g,b,'upgrade').cost;assert.ok(cost>0&&cost<=50);assert.equal(b.job.next,next);g.finishJob(b);assert.equal(b.level,next);assert.ok(Number.isFinite(b.hp)&&b.hp>0);}
  assert.equal(focus(g,b,'upgrade'),undefined);
 }
});
test('V11 hall progression needs conquest milestones, never a day-number gate',()=>{
 const g=quiet();assert.ok(focus(g,g.hall,'upgrade'));g.hall.level=2;assert.equal(focus(g,g.hall,'upgrade'),undefined);g.state.camps[0].rewarded=true;assert.ok(focus(g,g.hall,'upgrade'));g.hall.level=4;assert.equal(focus(g,g.hall,'upgrade'),undefined);g.state.camps[2].rewarded=true;assert.ok(focus(g,g.hall,'upgrade'));assert.equal(g.state.day,1);
});
test('V11 white iron and blue equipment require hall three and five, update all worn sets once',()=>{
 const g=quiet();g.hall.level=2;g.forge.level=1;assert.equal(focus(g,g.forge,'upgrade'),undefined);g.hall.level=3;const n=g.makeGoblin('hunter',800);n.gear=1;g.state.goblins.push(n);g.state.gearStock=8;pay(g,g.forge,'upgrade');g.finishJob(g.forge);assert.equal(n.gear,2);assert.equal(g.state.gearStock,8);const damage=g.stats(n).attack;g.finishJob(g.forge);assert.equal(g.stats(n).attack,damage);g.hall.level=4;assert.equal(focus(g,g.forge,'upgrade'),undefined);g.hall.level=5;assert.ok(focus(g,g.forge,'upgrade'));g.forge.level=3;assert.equal(focus(g,g.forge,'upgrade'),undefined);
});
test('V11 low population and flag limits compose with exactly two crew slots',()=>{
 const g=quiet();for(let level=1;level<=5;level++){g.hall.level=level;g.flag.level=level;assert.equal(g.populationLimit,[8,12,16,20,24][level-1]);assert.equal(g.flagCapacity,[4,6,8,10,12][level-1]);}assert.equal(RULES.towerSlots[5],3);
});
test('V11 larger prisons contain all ten full-sized captives and no phantom inmates',()=>{
 const g=quiet();g.prison.level=5;g.prison.hp=480;for(let i=0;i<11;i++){const e=g.makeEnemy('human',700,0);e.state='bound';e.atPrison=true;e.stripped=true;e.bodyHeight=i===0?145:77;}g.updatePrison(.1);const inside=g.state.enemies.filter(e=>e.state==='captured'),layout=prisonLayout(5,inside);assert.equal(inside.length,10);assert.equal(g.state.enemies.filter(e=>e.state==='bound').length,1);for(const e of inside){assert.ok(layout.slotY(e.prisonSlot)-captiveHeight(e)>-layout.height);assert.equal(e.x,g.prison.x+layout.slotX(e.prisonSlot));}
});
test('V11 fifth-day wave introduces a strong unit and every five days raises the actual budget',()=>{
 for(const day of [1,2,4,5,10,15,20]){const g=quiet();g.state.day=day;g.spawnRaid();const c=g.state.companies[0],units=[...g.state.enemies.filter(e=>e.company===c.id),...c.pending];assert.equal(c.eliteBudget,Math.floor(day/5));assert.equal(units.length,c.initial);if(day<5)assert.equal(units.filter(e=>e.hero).length,0);else assert.ok(units.some(e=>e.hero));if(day===5)assert.equal(units.filter(e=>e.hero)[0].hero,'heavy');if(day===20)assert.ok(units.some(e=>HEROES[e.hero]?.boss));}
});
test('waves grow by global day and reinforcements spawn six at a time',()=>{
 const first=quiet();first.state.day=1;first.spawnRaid();assert.equal(first.state.companies[0].initial,6);const second=quiet();second.state.day=2;second.spawnRaid();assert.equal(second.state.companies[0].initial,8);assert.equal(second.state.enemies.length,6);assert.equal(second.state.companies[0].pending.length,2);second.updateRaidQueue(4);assert.equal(second.state.enemies.length,8);assert.equal(second.state.companies[0].pending.length,0);
 const later=quiet();later.state.camps[0].defeated=true;later.state.camps[1].frontierSince=20;later.state.day=20;later.spawnRaid();assert.equal(later.state.companies[0].initial,44);
});
test('new dated threats enter while ordinary reinforcements remain in real queues',()=>{const g=quiet();g.spawnRaid();g.spawnRaid();g.state.day=5;g.spawnRaid();assert.equal(g.state.companies.length,3);assert.equal(g.state.raidsWaiting.length,0);assert.equal(g.state.companies[2].eliteBudget,1);assert.ok(g.state.enemies.some(e=>e.hero==='heavy'));});
test('V11 pending soldiers withdrawn after retreat are not counted as casualties or coins',()=>{
 const g=quiet();g.state.day=5;g.spawnRaid();const c=g.state.companies[0];while(c.pending.length)g.updateRaidQueue(4);const troops=g.state.enemies.filter(e=>e.company===c.id);for(const e of troops.slice(0,Math.ceil(c.initial*.5)))g.hitEnemy(e,99999,e.x-40);const lost=c.lost;assert.ok(c.retreating);g.updateRaidQueue(.1);assert.equal(c.lost,lost);assert.equal(g.state.coins.reduce((s,c)=>s+c.value,0),Math.floor(lost/3));
});
test('V11 ordinary jumper telegraphs and crosses low walls, but cannot vault a high wall',()=>{
 for(const level of [1,2,3,5]){const g=quiet(),wall=g.state.buildings.find(b=>b.kind==='wall');wall.level=level;wall.hp=100;g.state.player.x=wall.x-135;const e=g.makeEnemy('jumper',wall.x+115,0,1);e.spells=0;g.updateEnemies(.1);if(level<=2){assert.equal(e.windup?.kind,'jump');g.updateEnemies(.7);assert.ok(e.jump);g.updateEnemies(.8);assert.ok(e.x<wall.x);assert.equal(e.hero,undefined);}else{assert.equal(e.windup,undefined);assert.equal(e.jump,undefined);assert.ok(e.x>wall.x);}}
});
test('V11 strong hammer windup has an avoidable real landing point',()=>{
 const g=quiet();g.state.player.x=2000;const e=g.makeEnemy('dwarf',2050,0,1);e.hero='heavy';e.spells=0;e.cooldown=0;g.updateEnemies(.1);assert.equal(e.windup.kind,'slam');assert.equal(g.state.player.hp,100);g.state.player.x=1800;g.updateEnemies(1.2);assert.equal(g.state.player.hp,100);assert.equal(e.windup,undefined);
});
test('V11 front-line contact cannot stack ten melee hits on one goblin in one beat',()=>{
 const g=quiet();g.state.player.x=10000;const n=g.makeGoblin('brute',1900);g.state.goblins.push(n);for(let i=0;i<10;i++)g.makeEnemy('human',1940+i,0,1);g.updateEnemies(.5);assert.ok(n.maxHp-n.hp<=3*3);assert.ok(g.state.enemies.slice(3).every(e=>e.x>1945));
});
test('V11 large bosses can be stripped, hauled, held and sold without shrinking or duplication',()=>{
 const g=quiet();const e=g.makeEnemy('dwarf',700,0);e.hero='siege_boss';e.bodyHeight=140;e.maxHp=480;e.hp=0;e.state='wounded';const n=g.makeGoblin('idle',700);g.state.goblins.push(n);for(let i=0;i<90;i++)g.tick(1/30);assert.equal(e.state,'captured');assert.equal(captiveHeight(e),140);assert.equal(g.state.gearStock,1);g.state.trader={x:905,present:true,phase:'trading',timer:65};g.state.player.x=905;const before=g.state.treasury;g.act(focus(g,{x:905,id:-100},'sell'));assert.equal(e.state,'sold');assert.equal(g.state.treasury-before,24);g.sellCaptives();assert.equal(g.state.treasury-before,24);
});
test('V11 old tier-three equipment save migrates to hall five and preserves damage and wealth',()=>{
 const g=quiet(),s=g.snapshot();s.revision=10;s.buildings.find(b=>b.kind==='hall').level=3;s.buildings.find(b=>b.kind==='forge').level=3;const wall=s.buildings.find(b=>b.kind==='wall');wall.level=2;wall.hp=80;wall.maxHp=320;s.treasury=123;s.gold=17;const loaded=new GameModel(s);assert.equal(loaded.hall.level,5);assert.equal(loaded.forge.level,3);assert.equal(loaded.state.gold,17);assert.equal(loaded.state.treasury,123);const w=loaded.state.buildings.find(b=>b.id===wall.id);assert.equal(w.level,3);assert.equal(w.hp/w.maxHp,.25);const again=new GameModel(loaded.snapshot());assert.equal(again.hall.level,5);assert.equal(again.state.treasury,123);
});
test('V11 occupied expedition hunters use the new frontier tower and leave for the next camp',()=>{
 const g=quiet(),c=g.state.camps[0],w=g.state.buildings.find(b=>b.kind==='wall'&&b.region===0),t=g.state.buildings.find(b=>b.kind==='tower'&&b.region===0);c.defeated=c.claimed=true;w.level=t.level=5;w.hp=t.hp=500;g.state.expedition={state:'hold',camp:0};for(let i=0;i<3;i++){const n=g.makeGoblin('hunter',t.x);n.order='expedition';g.state.goblins.push(n);}g.assignTowers();assert.equal(g.state.goblins.filter(n=>n.towerId===t.id).length,3);g.state.expedition={state:'march',camp:1};g.updateGoblins(.1);assert.ok(g.state.goblins.every(n=>!n.towerId&&n.order==='expedition'));
});
test('V11 workers stay behind an intact wall but run from an enemy inside it',()=>{
 const g=quiet(),w=g.state.buildings.find(b=>b.kind==='wall');w.level=1;w.hp=80;const n=g.makeGoblin('worker',w.x-25);n.task='construction';n.targetId=w.id;w.job={next:2,left:30,total:30};g.state.goblins.push(n);const e=g.makeEnemy('human',w.x+55,0,1);g.updateGoblins(.1);assert.ok(w.job.left<30);const x=n.x;e.x=n.x+10;g.updateGoblins(.1);assert.ok(n.x<x);
});
test('V11 a paid kit is collected at the moving rally and consumed exactly once',()=>{
 const g=quiet();g.flag.level=2;g.flag.x=5600;g.forge.level=2;g.state.equipmentStock=1;const n=g.makeGoblin('hunter',g.flag.x-20);n.order='gather';g.state.goblins.push(n);g.updateGoblins(.1);assert.equal(n.gear,2);assert.equal(g.state.equipmentStock,0);g.updateGoblins(.1);assert.equal(g.state.equipmentStock,0);assert.equal(n.gear,2);
});
test('V11 idle logistics reaches distant safe fallen soldiers and does not invent gear',()=>{
 const g=quiet();g.state.camps[2].defeated=true;const e=g.makeEnemy('human',14000,2);e.state='dead';e.stripped=false;const n=g.makeGoblin('idle',700);g.state.goblins.push(n);g.updateGoblins(1);assert.ok(n.x>700);assert.equal(e.stripped,false);assert.equal(g.state.gearStock,0);
});
test('V11 recovery continues away from a nearby pursuer rather than stopping at a stale point',()=>{
 const g=quiet();const n=g.makeGoblin('hunter',3000);n.hp=5;n.task='recover';n.recoverX=3000;g.state.goblins.push(n);g.makeEnemy('human',3050,0,1);g.updateGoblins(.2);assert.ok(n.x<3000);assert.ok(n.recoverX<3000);assert.equal(n.hp,5);
});
test('V11 prisoner merchant returns on the same route even after a distant conquest',()=>{
 const g=quiet(),w=g.state.buildings.find(b=>b.kind==='wall'&&b.region===3);w.level=5;w.hp=900;g.state.camps[3].claimed=g.state.camps[3].defeated=true;g.state.trader={x:2651,present:false,phase:'away',timer:0};g.updatePrison(.1);assert.equal(g.state.trader.x,2600);for(let i=0;i<20;i++)g.updatePrison(1);assert.equal(g.state.trader.phase,'trading');assert.equal(g.state.trader.present,true);
});
test('V11 retreat cancels unfinished hero strikes and a newly high wall cancels a vault',()=>{
 const g=quiet(),w=g.state.buildings.find(b=>b.kind==='wall');w.level=2;w.hp=170;g.state.player.x=w.x-100;const e=g.makeEnemy('jumper',w.x+100,0,1);e.spells=0;g.updateEnemies(.1);assert.equal(e.windup.kind,'jump');w.level=3;g.updateEnemies(.8);assert.equal(e.jump,undefined);assert.ok(e.x>w.x);
 const h=g.makeEnemy('dwarf',g.state.player.x+40,0,9);h.hero='heavy';h.windup={kind:'slam',left:.1,targetX:g.state.player.x};g.state.companies.push({id:9,initial:1,lost:0,camp:0,retreating:true});g.updateEnemies(.2);assert.equal(h.windup,undefined);assert.equal(g.state.player.hp,100);
});
test('V11 old rally upgrades retain the previously purchased eight and twelve unit capacity',()=>{
 for(const [oldLevel,capacity]of [[1,8],[2,12]]){const g=quiet(),s=g.snapshot();s.revision=10;s.buildings.find(b=>b.kind==='hall').level=3;s.buildings.find(b=>b.kind==='flag').level=oldLevel;const loaded=new GameModel(s);assert.equal(loaded.flagCapacity,capacity);}
});
