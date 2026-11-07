const{test}=require('node:test'),assert=require('node:assert/strict'),fs=require('fs');
const{GameModel}=require('../../qa/cocos/model-build/GameModel'),{RULES,HEROES}=require('../../qa/cocos/model-build/Rules'),{raidPlan,raidCount,enemyFactor,FORTS}=require('../../qa/cocos/model-build/CampaignRules');
function fieldAlive(g){return g.state.enemies.filter(e=>e.force==='field'&&!e.counted&&(e.state==='active'||e.state==='escaping'));}
function ledger(g){const s=g.state,a=s.army;assert.equal(a.initial+a.recruited+a.recovered-a.lost-a.retired-a.transferred,a.reserve.length+(s.raidPrep?.units.length||0)+s.companies.reduce((n,c)=>n+(c.pending?.length||0),0)+fieldAlive(g).length);assert.equal(a.guardInitial+a.guardRecruited+a.guardRecovered+a.guardTransferred-a.guardLost,s.camps.reduce((n,c)=>n+g.campRemaining(c),0));}
function allIds(g){const s=g.state;return [...s.army.reserve,...(s.raidPrep?.units||[]),...s.companies.flatMap(c=>c.pending||[]),...s.camps.flatMap(c=>c.guardQueue||[]),...s.enemies.filter(e=>e.state==='active'&&!e.counted)].map(n=>n.id);}
test('calendar wave sizes and threat composition are identical at all five progress states',()=>{
 for(const day of [1,5,10,15,20,21,25,30,32,100]){let reference;for(let camp=0;camp<5;camp++){const g=new GameModel();g.state.day=day;g.state.camps.slice(0,camp).forEach(c=>c.defeated=true);g.spawnRaid();const c=g.state.companies[0],units=[...g.state.enemies.filter(e=>e.company===c.id),...c.pending],signature=units.map(e=>e.kind+':'+(e.hero||'')).sort();assert.equal(units.length,raidCount(day));assert.equal(c.camp,camp);if(reference)assert.deepEqual(signature,reference);reference=signature;assert.deepEqual(g.state.machines.filter(m=>m.company===c.id).map(m=>m.kind).sort(),raidPlan(day).engines.slice().sort());}}
});
test('calendar curve increases by two through day twenty and three after, capped at eighty',()=>{
 for(let d=1;d<=120;d++){const n=raidCount(d);assert.equal(n,Math.min(80,d<=20?6+2*(d-1):44+3*(d-20)));assert.ok(raidPlan(d).units.every(u=>u&&RULES.enemy[u.kind]));}
 assert.deepEqual([19,20,21,30,31,32].map(raidCount),[42,44,47,74,77,80]);
});
test('strong units and siege weapons arrive on their date without capturing the scout camp',()=>{
 for(const day of [5,10,15,20,25,30]){const g=new GameModel();g.state.day=day;g.spawnRaid();const c=g.state.companies[0],p=raidPlan(day);assert.equal(g.nearestCamp.index,0);assert.equal(c.initial,raidCount(day));assert.equal(c.eliteBudget,Math.floor(day/5));if(day>=20)assert.ok(g.state.enemies.some(e=>e.company===c.id&&HEROES[e.hero]?.boss));assert.equal(g.state.machines.filter(m=>m.company===c.id).length,p.engines.length);}
});
test('a new evening starts its dated threat even when earlier forces have not finished',()=>{
 const g=new GameModel();for(const day of [1,2,20]){g.state.day=day;g.spawnRaid();}assert.equal(g.state.companies.length,3);assert.ok(g.state.enemies.some(e=>e.company===g.state.companies[2].id&&e.hero==='siege_boss'));assert.equal(g.state.raidsWaiting.length,0);
});
test('initial guard totals include bosses, while opening field stocks are separate and conserved',()=>{
 const g=new GameModel();assert.deepEqual(g.state.camps.map(c=>g.campRemaining(c)),[15,30,50,70,30]);assert.equal(g.state.army.initial,122);ledger(g);const ids=allIds(g);assert.equal(new Set(ids).size,ids.length);
});
test('nightly field losses deduct once and cannot remove the core garrison or its commander',()=>{
 const g=new GameModel();g.state.day=5;g.campaignDay();const guards=g.state.camps.map(c=>g.campRemaining(c));g.spawnRaid();const c=g.state.companies[0];while(c.pending.length)g.updateRaidQueue(4);const troops=g.state.enemies.filter(e=>e.company===c.id);for(const e of troops.slice(0,7))g.hitEnemy(e,99999,e.x-30);assert.equal(g.state.army.lost,7);assert.deepEqual(g.state.camps.map(c=>g.campRemaining(c)),guards);assert.equal(c.retreating,false);g.hitEnemy(troops[0],99999,0);assert.equal(g.state.army.lost,7);ledger(g);
 g.updateEnemies(20);g.updatePrison(0);assert.equal(g.state.army.returned,0);ledger(g);assert.equal(new Set(allIds(g)).size,allIds(g).length);
});
test('queued night troops keep advancing despite legacy retreat flags without losing wounded identities',()=>{
 const g=new GameModel();g.state.day=30;g.spawnRaid();const c=g.state.companies[0],first=g.state.enemies.find(e=>e.company===c.id);first.hp=first.maxHp*.4;c.retreating=true;const pending=c.pending.length,kills=g.state.kills;g.updateRaidQueue(4);assert.equal(c.pending.length,pending-6);assert.equal(c.retreating,false);assert.equal(g.state.kills,kills);assert.ok(Math.abs(first.hp/first.maxHp-.4)<1e-9);ledger(g);
});
test('capturing and selling an already fallen field unit cannot subtract it twice',()=>{
 const g=new GameModel();g.spawnRaid();const e=g.state.enemies.find(e=>e.company);g.hitEnemy(e,99999,0);const lost=g.state.army.lost;e.state='captured';e.atPrison=e.stripped=true;g.state.trader.present=true;g.state.trader.phase='trading';g.sellCaptives();assert.equal(g.state.army.lost,lost);ledger(g);
});
test('five-day attribute steps preserve wounds, cap at twice base and leave prisoners unchanged',()=>{
 const g=new GameModel(),e=g.state.enemies[0];e.hp=e.maxHp*.35;const prisoner=g.state.enemies[1];prisoner.state='captured';const before=prisoner.maxHp;for(const day of [4,5,9,10,95,100,105]){g.state.day=day;g.campaignDay();assert.ok(Math.abs(e.hp/e.maxHp-.35)<1e-9);assert.equal(e.maxHp,RULES.enemy[e.kind].hp*enemyFactor(day));assert.equal(prisoner.maxHp,before);}assert.equal(enemyFactor(100),2);assert.equal(enemyFactor(1000),2);
});
test('all enemy kinds, strong units and siege engines share date growth without camp multipliers',()=>{
 const g=new GameModel();g.state.day=20;for(const kind of Object.keys(RULES.enemy)){const e=g.makeEnemy(kind,5000,4,1);assert.equal(e.maxHp,RULES.enemy[kind].hp*1.2);assert.equal(g.enemyStats(e).attack,RULES.enemy[kind].attack*1.2);}g.spawnRaid();const hero=g.state.enemies.find(e=>e.company&&e.hero);assert.equal(hero.maxHp,HEROES[hero.hero].hp*1.2);const m=g.state.machines.find(m=>m.company>0);assert.equal(m.maxHp,156);m.hp=78;g.state.day=25;g.campaignDay();assert.equal(m.hp,m.maxHp*.5);
});
test('early camps have no fixed defenses and late towers use real garrison archers on multiple floors',()=>{
 const g=new GameModel();assert.ok(g.state.fortifications.every(f=>f.camp>=2));for(const index of [2,3,4]){const c=g.state.camps[index];g.state.player.x=c.x;for(let i=0;i<35;i++)g.updateGarrisons(1);const towers=g.state.fortifications.filter(f=>f.camp===index&&f.kind==='tower'),crew=g.state.enemies.filter(e=>e.camp===index&&e.towerId);assert.equal(crew.length,FORTS[index].levels.reduce((a,b)=>a+b,0));assert.equal(g.campRemaining(c),RULES.camps[index].total);for(const t of towers){const heights=g.state.enemies.filter(e=>e.towerId===t.id).map(e=>g.enemyTowerPosition(e).height);assert.equal(new Set(heights).size,t.levels);}}
});
test('empty enemy towers do not fire and destroying a tower releases its actual archers',()=>{
 const g=new GameModel(),c=g.state.camps[2],t=g.state.fortifications.find(f=>f.camp===2&&f.kind==='tower');g.state.player.x=t.x-100;for(let i=0;i<20;i++)g.updateGarrisons(1);const crew=g.state.enemies.filter(e=>e.towerId===t.id);assert.equal(crew.length,1);for(const e of crew)g.hitEnemy(e,99999,e.x-10);g.state.enemies.forEach(e=>{if(e.camp===2&&e.kind==='elf')e.state='dead';});c.guardQueue=c.guardQueue.filter(n=>n.kind!=='elf');g.state.shots=[];t.cooldown=0;g.updateGarrisons(.1);assert.equal(g.state.shots.length,0);t.hp=0;g.updateGarrisons(.1);assert.ok(g.state.enemies.every(e=>e.towerId!==t.id));
});
test('core growth is slow, does not reset losses or clone resident elites',()=>{
 const g=new GameModel(),c=g.state.camps[1];g.state.day=10;const before=g.campRemaining(c);g.campaignDay();assert.equal(g.campRemaining(c),before+2);const count=g.campRemaining(c);g.campaignDay();assert.equal(g.campRemaining(c),count);assert.equal(c.guardQueue.filter(n=>n.hero==='heavy').length+g.state.enemies.filter(e=>e.camp===1&&e.hero==='heavy').length,1);
});
test('rebuilding transfers new field soldiers and never resurrects captive core IDs',()=>{
 const g=new GameModel(),c=g.state.camps[0],old=g.state.enemies.find(e=>e.camp===0);for(const e of g.state.enemies.filter(e=>e.camp===0))g.hitEnemy(e,99999,0);for(const n of c.guardQueue)g.state.army.guardLost++;c.guardQueue=[];old.state='captured';old.stripped=true;old.atPrison=true;c.defeated=false;g.spawnGuards(c);assert.equal(g.campRemaining(c),15);assert.equal(g.state.enemies.filter(e=>e.id===old.id&&e.state==='captured').length,1);assert.equal(g.state.army.guardTransferred,15);ledger(g);
});
test('current save reload preserves army identities, reservations, casualties and wealth',()=>{
 const g=new GameModel();g.state.day=20;g.campaignDay();g.spawnRaid();const e=g.state.enemies.find(e=>e.company);g.hitEnemy(e,99999,0);g.state.gold=17;g.state.treasury=123;const s=g.snapshot(),before=JSON.stringify(s.army),loaded=new GameModel(s);assert.equal(JSON.stringify(loaded.state.army),before);assert.equal(loaded.state.gold,17);assert.equal(loaded.state.treasury,123);ledger(loaded);
});
test('legacy V11 map and army migrate without deleting a single active unit or changing wealth',()=>{
 const p='qa/cocos/v11-campaign/2026-cleared-2-snapshot.json',s=JSON.parse(fs.readFileSync(p));const ids=s.enemies.map(e=>e.id),gold=s.gold,treasury=s.treasury;const oldX=s.player.x,loaded=new GameModel(s);assert.equal(loaded.state.revision,12);assert.equal(loaded.state.gold,gold);assert.equal(loaded.state.treasury,treasury);assert.ok(ids.every(id=>loaded.state.enemies.some(e=>e.id===id)));assert.ok(loaded.state.player.x>=oldX);assert.deepEqual(loaded.state.camps.map(c=>c.x),[6500,12000,18500,26500,28500]);ledger(loaded);
});
test('free restart initializes the new army before the first nightly attack',()=>{
 const g=new GameModel();g.restart();assert.ok(g.state.army);assert.equal(g.state.raidPrep.units.length,6);g.state.time=127.99;g.tick(.05);assert.equal(g.state.companies.length,1);ledger(g);
});
test('ground melee attacks tower supports instead of hitting elevated archers through the air',()=>{
 const g=new GameModel();g.state.enemies=[];g.state.goblins=[];g.state.player.x=0;const tower=g.state.buildings.find(b=>b.kind==='tower');tower.level=1;tower.hp=100;const n=g.makeGoblin('hunter',tower.x);n.towerId=tower.id;g.state.goblins.push(n);const e=g.makeEnemy('human',tower.x+20,0,1);e.cooldown=0;g.updateEnemies(.1);assert.equal(n.hp,n.maxHp);assert.ok(tower.hp<100);
 const fort=g.state.fortifications.find(f=>f.kind==='tower');e.kind='elf';e.company=0;e.camp=fort.camp;e.towerId=fort.id;e.x=fort.x;const brute=g.makeGoblin('brute',fort.x-25);brute.cooldown=0;const hp=e.hp,structure=fort.hp;g.fightGoblin(brute,e,.1);assert.equal(e.hp,hp);assert.ok(fort.hp<structure);
});
test('escaped prisoners walk to the next surviving camp when their original camp was captured',()=>{
 const g=new GameModel();g.spawnRaid();const c=g.state.companies[0],e=g.state.enemies.find(e=>e.company===c.id);g.hitEnemy(e,99999,0);e.state='escaping';e.hp=e.maxHp*.4;g.state.camps[0].defeated=true;const x=e.x;g.updateEnemies(1);assert.ok(e.x>x);assert.equal(e.state,'escaping');assert.equal(g.state.army.returned,0);g.updateEnemies(45);assert.equal(e.returned,true);assert.ok(e.x>g.state.camps[1].x+600);
});
