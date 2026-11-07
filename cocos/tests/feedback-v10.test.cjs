const{test}=require('node:test'),assert=require('node:assert/strict');
const{GameModel}=require('../../qa/cocos/model-build/GameModel');const{RULES}=require('../../qa/cocos/model-build/Rules');
const tick=(g,s)=>{for(let i=0;i<s*30;i++)g.tick(1/30);};const b=(g,k)=>g.state.buildings.find(x=>x.kind===k);
function quiet(g){g.state.enemies=[];g.state.fortifications=[];for(const c of g.state.camps){c.reserve=[];c.heroesPending=[];c.guardQueue=[];}g.spawnRaid=()=>{};g.updateDayPatrols=()=>{};}
function focus(g,id){g.context();for(let i=0;i<g.nearbyTargets+1;i++){const c=g.context();if(c?.id===id)return c;g.cycleTarget();}throw Error('target unavailable '+id);}

test('V10 treasury repeated clicks keep target and conserve exact coins',()=>{
 const g=new GameModel();quiet(g);g.state.gold=0;g.state.treasury=20;g.state.player.x=b(g,'treasury').x;focus(g,b(g,'treasury').id);
 g.state.goblins[0].x=g.state.player.x;
 for(let i=0;i<10;i++){const c=g.context();assert.equal(c.kind,'treasury');g.act(c.actions[0]);}
 assert.equal(g.state.gold,10);assert.equal(g.state.treasury,10);assert.equal(g.context().amount,10);assert.equal(g.context().description,'');
});
test('V10 one-body interaction range and stationary focus survive a whip',()=>{
 const g=new GameModel();quiet(g);const n=g.state.goblins[0];n.x=1200;g.state.goblins.slice(1).forEach(n=>n.x=200);g.state.player.x=1090;
 const c=g.context();assert.ok(c.actions.some(a=>a.type==='whip'));const id=c.id;g.act(c.actions.find(a=>a.type==='whip'));assert.equal(g.context().id,id);
});
test('V10 stationary target leaving does not transfer a held action to another actor',()=>{
 const g=new GameModel();quiet(g);const a=g.state.goblins[0],other=g.state.goblins[1];g.state.player.x=3000;a.x=3000;other.x=3400;g.state.goblins.slice(2).forEach(n=>n.x=0);
 assert.equal(g.context().id,a.id);a.x=3400;other.x=3000;assert.equal(g.context(),null);assert.equal(g.context(),null);assert.equal(g.nearbyTargets,2);
 g.cycleTarget();assert.equal(g.context().id,other.id);
});
test('V11 lure has slower arrivals and a fresh quota every five minutes',()=>{
 const g=new GameModel();quiet(g);const lure=b(g,'lure');lure.level=3;lure.hp=100;lure.stock=9;g.state.player.x=100;
 tick(g,120);assert.equal(g.population,4);tick(g,12);assert.equal(g.population,5);tick(g,167);assert.equal(g.population,5);
 const first=lure.stock;tick(g,1.1);assert.equal(g.state.recruitment.count,0);tick(g,299);const arrived=first-lure.stock;assert.ok(arrived>=1&&arrived<=2,arrived);
 const loaded=new GameModel(g.snapshot());assert.deepEqual(loaded.state.recruitment,g.state.recruitment);
});
test('V10 bait bought after scheduled time never spawns instantly',()=>{
 const g=new GameModel();quiet(g);const lure=b(g,'lure');lure.level=1;lure.hp=100;g.state.elapsed=170;g.state.player.x=lure.x;
 const a=focus(g,lure.id).actions.find(a=>a.type==='bait');g.act(a);g.act(a);tick(g,40);assert.equal(g.population,4);tick(g,11);assert.equal(g.population,5);
});
test('V10 a hauling craftsman is never stolen by construction',()=>{
 const g=new GameModel();quiet(g);const worker=g.state.goblins[0];worker.role='worker';worker.task='haul';worker.targetId=999;worker.x=1800;g.state.player.x=b(g,'wall').x;
 const a=focus(g,b(g,'wall').id).actions.find(a=>a.type==='build');for(let i=0;i<a.cost;i++)g.act(a);assert.equal(worker.task,'haul');assert.ok(b(g,'wall').job);
});
test('V10 whip drops carried gear once and preserves total gear',()=>{
 const g=new GameModel();quiet(g);const n=g.state.goblins[0];n.x=1200;n.loot=3;n.task='lootReturn';g.state.player.x=1090;
 const a=g.context().actions.find(a=>a.type==='whip');g.act(a);assert.equal(n.loot,0);assert.equal(g.state.gearDrops.reduce((s,i)=>s+i.amount,0),3);n.stunned=8;
 g.state.player.x=g.state.gearDrops[0].x;tick(g,1);assert.equal(g.state.gearStock,3);assert.equal(g.state.gearDrops.length,0);
});
test('V10 full flag gives feedback without spending or adding a unit',()=>{
 const g=new GameModel();quiet(g);g.flag.level=1;
 for(let i=0;i<8;i++){const n=g.makeGoblin('hunter',g.flag.x);n.order='gather';g.state.goblins.push(n);}
 const n=g.makeGoblin('brute',1450);g.state.goblins.push(n);g.state.player.x=n.x;const gold=g.state.gold;
 const a=focus(g,n.id).actions.find(a=>a.type==='recruit');g.act(a);assert.equal(g.notice.text,'集结已满');assert.equal(g.flagUsed,8);assert.equal(g.state.gold,gold);
});
test('V10 flag relocates only when a new wall finishes',()=>{
 const g=new GameModel();quiet(g);g.flag.level=1;const wall=b(g,'wall'),worker=g.makeGoblin('worker',wall.x);g.state.goblins.push(worker);g.state.player.x=wall.x;
 const old=g.flag.x,a=focus(g,wall.id).actions.find(a=>a.type==='build');for(let i=0;i<a.cost;i++)g.act(a);assert.equal(g.flag.x,old);tick(g,20);assert.equal(wall.level,1);assert.equal(g.flag.x,wall.x-270);
});
test('V10 tower occupies a real hunter and releases him on draft',()=>{
 const g=new GameModel();quiet(g);const tower=b(g,'tower'),wall=b(g,'wall');tower.level=1;tower.hp=100;wall.level=1;wall.hp=140;g.flag.level=1;
 const n=g.makeGoblin('hunter',tower.x);g.state.goblins.push(n);const pop=g.population;tick(g,3);assert.equal(n.towerId,tower.id);assert.equal(g.population,pop);
 g.state.player.x=n.x;const a=focus(g,n.id).actions.find(a=>a.type==='recruit');g.act(a);tick(g,.1);assert.equal(n.towerId,undefined);assert.equal(n.order,'gather');
});
test('V10 trader arrives with a journey, can trade directly, then departs',()=>{
 const g=new GameModel();const captive=g.state.enemies[0];quiet(g);captive.state='captured';captive.atPrison=true;captive.stripped=true;g.state.enemies.push(captive);
 tick(g,100.1);assert.equal(g.state.trader.phase,'arriving');assert.equal(g.state.trader.present,false);tick(g,24);assert.equal(g.state.trader.phase,'trading');
 g.state.player.x=g.state.trader.x;const a=focus(g,-100).actions.find(a=>a.type==='sell'),old=g.state.treasury+g.state.gold;g.act(a);assert.ok(g.state.treasury+g.state.gold>old);assert.equal(g.state.sold,1);g.act(a);assert.equal(g.state.sold,1);
 tick(g,66);assert.equal(g.state.trader.present,false);assert.ok(['leaving','away'].includes(g.state.trader.phase));
});
test('V10 garrison budgets and heroes are finite and block a premature capture',()=>{
 const g=new GameModel();for(let i=0;i<5;i++)assert.equal(g.campRemaining(g.state.camps[i]),RULES.camps[i].total);
 const c=g.state.camps[0];g.state.enemies.filter(e=>e.camp===0).forEach(e=>e.state='dead');g.damageCamp(c,9999);assert.equal(c.defeated,false);
 c.reserve=[];c.heroesPending=[];c.guardQueue=[];g.damageCamp(c,9999);assert.equal(c.defeated,true);
 assert.equal(RULES.camps[3].total+RULES.camps[4].total,100);
});
test('V10 rear camp cannot be captured with surviving gates or towers',()=>{
 const g=new GameModel(),c=g.state.camps[2];c.reserve=[];c.heroesPending=[];c.guardQueue=[];g.state.enemies.filter(e=>e.camp===2).forEach(e=>e.state='dead');g.damageCamp(c,9999);assert.equal(c.defeated,false);
 g.state.fortifications.filter(f=>f.camp===2).forEach(f=>f.hp=0);g.tick(1/30);assert.equal(c.defeated,true);
});
test('V11 garrison fields a real large unit with its own body size',()=>{
 const g=new GameModel();g.state.player.x=RULES.camps[1].x;g.state.player.hp=10000;tick(g,11);
 const strong=g.state.enemies.find(e=>e.hero==='heavy');assert.ok(strong);assert.equal(strong.bodyHeight,102);assert.ok(strong.maxHp>100);
});
test('V10 long-map migration preserves player resources and progress',()=>{
 const g=new GameModel(),s=g.snapshot();delete s.revision;s.player.x=5100;s.camps[1].x=5100;s.treasury=123;s.gold=17;
 const loaded=new GameModel(s);assert.equal(loaded.state.player.x,12000);assert.equal(loaded.state.treasury,123);assert.equal(loaded.state.gold,17);assert.equal(loaded.state.camps[1].x,12000);
});
test('V10 running is faster and exhaustion does not strobe every simulation step',()=>{
 const g=new GameModel();quiet(g);g.input={axis:1,run:false};tick(g,1);const walk=g.state.player.x-400;g.state.player.x=400;g.input.run=true;tick(g,1);assert.ok(g.state.player.x-400>walk*1.6);
 g.state.player.stamina=.5;g.tick(1/30);assert.equal(g.state.player.exhausted,true);tick(g,1);assert.equal(g.state.player.exhausted,true);
});
