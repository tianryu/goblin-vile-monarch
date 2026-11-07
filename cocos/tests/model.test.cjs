const { test } = require('node:test');
const assert = require('node:assert/strict');
const { GameModel } = require('../../qa/cocos/model-build/GameModel');
const { RULES } = require('../../qa/cocos/model-build/Rules');
const advance = (g, seconds) => { for (let i = 0; i < seconds * 30; i++) g.tick(1 / 30); };
const building = (g, kind) => g.state.buildings.find(b => b.kind === kind);
function isolate(g) { g.state.goblins.filter(n=>n.order==='home').forEach(n => n.x = n.prevX = -350); }
function action(g, b, type) { g.state.player.x = b.x; isolate(g); return g.context().actions.find(a => a.type === type); }
function pay(g, b, type) { const a = action(g, b, type); assert.ok(a, type); for (let i = 0; i < Math.max(1, a.cost); i++) g.act(a); return a; }
function ready(g, b, level = 1) { b.level = level; b.hp = b.maxHp = 180; b.job = undefined; }

test('new campaign starts with exactly four idle goblins, no thief systems or auto camps', () => {
  const g = new GameModel(); assert.equal(g.population, 4); assert.ok(g.state.goblins.every(n => n.role === 'idle'));
  assert.equal(g.state.camps.length, 5); assert.equal(g.prison.level, 1); assert.equal(g.state.buildings.some(b => /thief|portal|camp/.test(b.kind)), false);
});
test('part-paid construction refunds carried coins on departure and load, exactly once', () => {
  const g = new GameModel(), b = building(g, 'wall'), initial = g.state.gold, bank = g.state.treasury;
  const a = action(g, b, 'build'); g.act(a); g.act(a); assert.equal(g.state.gold, initial - 2);
  g.state.player.x += 150; g.tick(1/30); assert.equal(g.state.gold, initial); assert.equal(g.state.treasury, bank);
  g.tick(1/30); assert.equal(g.state.gold, initial);
  action(g, b, 'build'); g.act(a); const saved = g.snapshot(); const restored = new GameModel(saved); assert.equal(restored.state.gold, initial); assert.equal(restored.state.pledge, null);
});
test('tool purchase leaves real inventory and an idle goblin walks there to pick it up', () => {
  const g = new GameModel(), b = building(g, 'worker'); pay(g, b, 'tool'); assert.equal(b.stock, 1);
  g.state.goblins[0].x = b.x - 60; advance(g, 2); assert.equal(b.stock, 0); assert.equal(g.state.goblins[0].role, 'worker');
});
test('construction waits for labor and completes without duplicate cost', () => {
  const g = new GameModel(), b = building(g, 'wall'); const start = g.state.gold; pay(g, b, 'build');
  advance(g, 7); assert.ok(b.job); assert.equal(b.level, 0);
  const worker = g.makeGoblin('worker', b.x); g.state.goblins.push(worker); advance(g, RULES.constructionSeconds + 3); assert.equal(b.level, 1); assert.equal(b.job, undefined); assert.equal(start - g.state.gold, 6);
});
test('all professions react to whipping, reveal hidden coins and overstun', () => {
  for (const role of ['idle','hunter','worker','brute']) {
    const g = new GameModel(); const n = g.state.goblins[0]; n.role = role; n.x = 1400; n.hidden = 2;
    g.state.goblins.slice(1).forEach(n => n.x = -350); g.state.player.x = n.x;
    let a = g.context().actions.find(a => a.type === 'whip'); assert.ok(a); g.act(a);
    assert.ok(n.hit > 0); assert.equal(n.hidden, 0); assert.equal(g.state.coins.reduce((n,c)=>n+c.value,0), 2);
    for(let i=0;i<3;i++){ n.hit=0; g.state.elapsed += .5; g.act(a); }
    assert.equal(n.stunned, 8); assert.equal(g.context().id, n.id);
  }
});
test('hall base growth and equipment percentage compose without stacking upgrades', () => {
  const g = new GameModel(); const n = g.makeGoblin('hunter', 700); g.state.goblins.push(n);
  n.gear=1; const first = g.stats(n).attack; ready(g, g.hall, 2); const second = g.stats(n).attack;
  assert.ok(Math.abs(second/first - 1.30)<1e-8); ready(g,g.hall,3);ready(g,g.forge,1); g.state.gearStock=9; g.state.gold=50;
  pay(g,g.forge,'upgrade'); g.state.goblins.push(g.makeGoblin('worker',g.forge.x)); advance(g,RULES.constructionSeconds+12);
  assert.equal(g.forge.level,2); assert.equal(n.gear,2); assert.equal(g.state.goblins[0].gear,0); assert.ok(g.stats(n).attack > second);
});
test('manufacturing consumes one pair of stripped equipment and one expensive payment', () => {
  const g=new GameModel();ready(g,g.forge,1);g.state.gearStock=4;g.state.gold=30;pay(g,g.forge,'craft');
  assert.equal(g.state.gearStock,2);assert.equal(g.state.equipmentStock,1);assert.equal(g.state.gold,18);
});
test('recruitment bait pauses at population cap and never silently consumes it', () => {
  const g=new GameModel();const lure=building(g,'lure');ready(g,lure,1);lure.stock=2;
  while(g.population<g.populationLimit)g.state.goblins.push(g.makeGoblin('idle',400));advance(g,140);assert.equal(lure.stock,2);
  g.state.goblins[0].dead=true;advance(g,1);assert.equal(lure.stock,1);assert.equal(g.population,g.populationLimit);assert.ok(g.state.goblins.some(n=>n.task==='joining'));
});
test('manual treasury withdrawal respects purse cap and surplus gains go to treasury', () => {
  const g=new GameModel();g.state.gold=49;g.state.treasury=8;const box=building(g,'treasury');pay(g,box,'withdraw');assert.equal(g.state.gold,50);assert.equal(g.state.treasury,7);
  pay(g,box,'withdraw');assert.equal(g.state.treasury,7);g.gain(12);assert.equal(g.state.gold,50);assert.equal(g.state.treasury,19);
});
test('nearby daytime guard attacks player instead of waiting for night', () => {
  const g=new GameModel();const e=g.state.enemies[0];g.state.player.x=e.x-30;g.state.time=50;advance(g,4);assert.ok(g.state.player.hp<100);
});
test('raid never retreats at dawn or half losses and abandons machines after all troops fall', () => {
  const g=new GameModel();g.state.camps[0].defeated=g.state.camps[1].defeated=true;g.state.day=10;g.spawnRaid();const company=g.state.companies[0];while(company.pending.length)g.updateRaidQueue(4);const units=g.state.enemies.filter(e=>e.company===company.id);
  g.state.time=239;advance(g,2);assert.equal(company.retreating,false);
  const half=Math.ceil(company.initial*.5);units.slice(0,half).forEach(e=>g.hitEnemy(e,999,-100));assert.equal(company.retreating,false);assert.equal(g.state.machines[0].owner,'enemy');units.slice(half).forEach(e=>g.hitEnemy(e,999,-100));assert.equal(g.state.machines[0].owner,'abandoned');
  const lost=company.lost;g.hitEnemy(units[0],999,-100);assert.equal(company.lost,lost);
});
test('shield reduces frontal arrows but melee remains effective', () => {
  const g=new GameModel();const e=g.state.enemies.find(e=>e.kind==='shield');e.cooldown=0;e.face=-1;const hp=e.hp;g.hitEnemy(e,30,e.x-40,true);const reduced=hp-e.hp;
  const hp2=e.hp;g.hitEnemy(e,30,e.x-40,false);assert.ok(hp2-e.hp>reduced*2);
});
test('machine reserves exactly two existing workers and two flag slots atomically', () => {
  const g=new GameModel();ready(g,g.hall,2);ready(g,g.flag,1);isolate(g);
  const m={id:g.id(),kind:'catapult',x:2450,prevX:2450,hp:130,maxHp:130,owner:'goblin',company:0,crew:[],order:'park',cooldown:0,moving:false};g.state.machines.push(m);
  for(let i=0;i<2;i++)g.state.goblins.push(g.makeGoblin('worker',2000+i*10));
  for(let i=0;i<g.flagCapacity-1;i++){let n=g.makeGoblin('hunter',g.flag.x);n.order='gather';g.state.goblins.push(n);}
  g.state.player.x=m.x;const a=g.context().actions.find(a=>a.type==='crew'), gold=g.state.gold;g.act(a);assert.equal(g.state.gold,gold);assert.equal(m.crew.length,0);
  g.state.goblins.find(n=>n.order==='gather').order='home';g.act(a);g.act(a);assert.equal(m.crew.length,2);assert.equal(g.flagUsed,g.flagCapacity);assert.equal(g.state.gold,gold-2);
});
test('autonomous dispatch advances without following monarch, no brute prerequisite', () => {
  const g=new GameModel();ready(g,g.hall,2);ready(g,g.flag,1);const h=g.makeGoblin('hunter',g.flag.x+30);h.order='gather';g.state.goblins.push(h);
  pay(g,g.flag,'dispatch');g.state.player.x=100;const start=h.x;advance(g,5);assert.equal(h.order,'expedition');assert.ok(h.x>start+500);
});
test('cleared region rebuilds unless its own wall is completed, no repeat first reward', () => {
  const g=new GameModel();const c=g.state.camps[0];c.reserve=[];c.heroesPending=[];c.guardQueue=[];g.state.enemies.filter(e=>e.camp===0).forEach(e=>e.state='dead');g.damageCamp(c,9999);const coins=g.state.coins.reduce((n,c)=>n+c.value,0);assert.equal(c.defeated,true);
  g.state.time=0;c.rebuild=g.rebuildDuration(c)-.1;advance(g,.2);assert.equal(c.defeated,false);c.reserve=[];c.heroesPending=[];c.guardQueue=[];g.state.enemies.filter(e=>e.camp===0).forEach(e=>e.state='dead');g.damageCamp(c,9999);assert.equal(g.state.coins.reduce((n,c)=>n+c.value,0),coins);
  const w=g.state.buildings.find(b=>b.kind==='wall'&&b.region===0);ready(g,w,1);c.claimed=true;advance(g,110);assert.equal(c.defeated,true);
});
test('looting and prisoner hauling use one carrier, strip each enemy only once', () => {
  const g=new GameModel();isolate(g);const e=g.state.enemies[0];e.x=700;e.state='wounded';e.hp=0;e.stripped=false;g.state.enemies.filter(x=>x!==e).forEach(x=>x.x+=1000);
  const n=g.state.goblins[0];n.x=700;n.targetX=700;advance(g,3);assert.ok(e.stripped);assert.equal(g.state.gearStock,1);assert.equal(e.state,'captured');assert.equal(e.hauler,0);
  advance(g,1);assert.equal(g.state.gearStock,1);assert.ok(g.state.goblins.filter(n=>n.task==='haul').length<=1);
});
test('hunter sees real animals and creates income by actual hits', () => {
  const g=new GameModel();g.state.time=50;const n=g.makeGoblin('hunter',1840);g.state.goblins.push(n);g.state.player.x=100;advance(g,8);
  assert.ok(g.state.animals.some(a=>a.hp<=0));assert.ok(g.state.coins.some(c=>c.value>=1)||g.state.goblins.some(n=>n.carry>=1));
});
test('civilian flees at run speed while idle residents spread inside safe area', () => {
  const g=new GameModel();const n=g.state.goblins[0];n.x=2700;g.state.enemies[0].x=2820;const start=n.x;advance(g,1);assert.ok(start-n.x>160);
  const h=new GameModel();advance(h,16);assert.ok(new Set(h.state.goblins.map(n=>Math.round(n.x/30))).size>2);
});
test('reward completion receipts are idempotent and repeated mount ads remain useful', () => {
  const g=new GameModel();assert.equal(g.grantAdReward('gold','real-test-receipt-1'),true);const total=g.state.gold+g.state.treasury;
  assert.equal(g.grantAdReward('gold','real-test-receipt-1'),false);assert.equal(g.state.gold+g.state.treasury,total);
  g.grantAdReward('wolf','real-test-receipt-2');g.grantAdReward('wolf','real-test-receipt-3');assert.equal(g.state.mountBoost.wolf,300);
});
test('death and fifth camp victory settle once; restart is free and retains unlocked mounts', () => {
  const g=new GameModel();g.grantAdReward('bat','test-unlock');g.state.player.hp=0;g.tick(1/30);assert.equal(g.state.status,'lost');g.restart();assert.equal(g.state.status,'playing');assert.ok(g.state.unlockedMounts.includes('bat'));assert.equal(g.population,4);
  // 胜利必须逐区清空真实驻军、预备兵与营防，不能只打掉最后一座营地。
  for(const c of g.state.camps){c.reserve=[];c.heroesPending=[];c.guardQueue=[];g.state.enemies.filter(e=>e.camp===c.index).forEach(e=>e.state='dead');g.state.fortifications.filter(f=>f.camp===c.index).forEach(f=>f.hp=0);g.damageCamp(c,9999);}
  assert.equal(g.state.status,'won');
});

test('home defenders use the wall instead of chasing outside its cover',()=>{
 const g=new GameModel();isolate(g);const wall=building(g,'wall');ready(g,wall,2);
 const n=g.makeGoblin('brute',wall.x-30);g.state.goblins.push(n);const e=g.state.enemies[0];e.x=wall.x+220;g.state.player.x=100;
 let furthest=n.x;for(let i=0;i<50;i++){g.tick(1/30);furthest=Math.max(furthest,n.x);}assert.ok(furthest<=wall.x,furthest);
});
test('enemy attacks nearby captured machinery and damage is real',()=>{
 const g=new GameModel();isolate(g);g.state.player.x=100;
 const m={id:g.id(),kind:'catapult',x:2800,prevX:2800,hp:130,maxHp:130,owner:'goblin',company:0,crew:[],order:'park',cooldown:0,moving:false};g.state.machines.push(m);
 const e=g.state.enemies[0];e.company=1;e.force='field';e.x=2820;advance(g,2);assert.ok(m.hp<130);
});
test('loading earlier V9 save supplies new elf ammo and prison fields',()=>{
 const g=new GameModel(),s=g.snapshot();delete s.enemies[0].ammo;delete s.enemies[0].atPrison;
 const loaded=new GameModel(s);assert.equal(loaded.state.enemies[0].ammo,12);assert.equal(loaded.state.enemies[0].atPrison,false);
});
test('paid construction reserves its worker before abandoned-machine salvaging',()=>{
 const g=new GameModel();isolate(g);const b=building(g,'wall'),n=g.makeGoblin('worker',b.x-30);g.state.goblins.push(n);
 g.state.machines.push({id:g.id(),kind:'catapult',x:b.x+100,prevX:b.x+100,hp:130,maxHp:130,owner:'abandoned',company:0,crew:[],order:'park',cooldown:0,moving:false});
 pay(g,b,'build');assert.equal(n.task,'construction');n.x=b.x-20;advance(g,RULES.constructionSeconds+3);assert.equal(b.level,1);
});
test('overflow prisoner already beside full cage is not hauled repeatedly',()=>{
 const g=new GameModel();isolate(g);const e=g.state.enemies[0];e.state='bound';e.stripped=true;e.atPrison=true;e.x=g.prison.x+90;e.timer=0;
 g.state.enemies.slice(1,3).forEach(e=>{e.state='captured';e.stripped=true;e.atPrison=true;e.timer=0;});const n=g.state.goblins[0];n.x=g.prison.x+100;
 advance(g,3);assert.equal(e.hauler,0);assert.equal(e.state,'bound');assert.notEqual(n.task,'haul');
});
