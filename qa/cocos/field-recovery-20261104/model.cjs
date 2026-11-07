const assert = require('node:assert/strict');
const { GameModel } = require('./model/GameModel');
const { RULES } = require('./model/Rules');
const tests = [];
const run = (name, test) => { test(); tests.push(name); };
function field() {
    const m = new GameModel();
    m.state.enemies = [];
    m.rebuildEnemyCache();
    return m;
}
const wall = m => m.state.buildings.find(b=>b.region===-3);
run('starter 6, tier-1 population 15, cave wall and migration', () => {
    const m = new GameModel();
    assert.deepEqual(m.state.goblins.map(n=>n.role),['worker','hunter','idle','idle','idle','idle']);
    assert.equal(m.populationLimit,15);
    assert.equal(wall(m).kind,'wall');
    const old = m.snapshot(), b = old.buildings.find(b=>b.region===-3);
    Object.assign(b,{kind:'tower',level:2,hp:50,maxHp:100,job:{left:2,total:8,next:3}});
    old.goblins.length=4;old.revision=20;old.goblins[1].towerId=b.id;old.goblins[1].task='tower';
    const migrated = new GameModel(old);
    assert.equal(migrated.population,4);
    assert.equal(wall(migrated).id,b.id);
    assert.equal(wall(migrated).kind,'wall');
    assert.equal(wall(migrated).hp/wall(migrated).maxHp,.5);
    assert.equal(wall(migrated).job.left,2);
    assert.equal(migrated.state.goblins[1].towerId,undefined);
});
run('manual and automatic recovery for both sides settle only once', () => {
    const m = field(), s=m.state;
    const n=s.goblins[0]; n.x=s.player.x=4000;
    const oldGold=s.gold, oldTreasury=s.treasury;
    m.hurtTarget(n.id,200,3990);
    n.coinLoot=1;
    const action=m.context().actions[0];
    assert.equal(action.type,'recover');
    assert.equal(m.act(action),'done');
    assert.equal(m.act(action),'none');
    assert.equal(s.gold,oldGold+1);
    const automatic=s.goblins[0];
    m.hurtTarget(automatic.id,200,1);automatic.timer=RULES.corpseSeconds;automatic.coinLoot=1;
    m.tick(.033);
    assert.equal(s.treasury,oldTreasury+1);
    assert.equal(s.goblins.includes(automatic),false);
    const e=m.makeEnemy('human',4020,0);
    m.rand=()=>.8;
    m.hitEnemy(e,200,4000);
    assert.equal(e.state,'dead');
    assert.equal(e.coinLoot,0);
    e.coinLoot=1;
    assert.equal(m.act(m.context().actions[0]),'done');
    assert.equal(s.gold,oldGold+2);
    assert.equal(s.gearStock,1);
    const e2=m.makeEnemy('human',4200,0);
    m.hitEnemy(e2,200,4200);e2.timer=RULES.corpseSeconds;e2.coinLoot=1;
    m.tick(.033);m.tick(.033);
    assert.equal(s.treasury,oldTreasury+2);
    assert.equal(s.gearStock,2);
});
run('captive outcomes and stable 4 to 6 prices', () => {
    const m = field(), s=m.state;
    const amounts=[.01,.4,.9], values=[];
    for (const price of amounts) {
        const e=m.makeEnemy('human',m.prison.x,0);
        const rng=[.1,price];m.rand=()=>rng.shift();
        m.hitEnemy(e,200,0);assert.equal(e.state,'wounded');
        e.state='captured';values.push(e.saleValue);
    }
    assert.deepEqual(values,[4,5,6]);
    const copy=new GameModel(m.snapshot());
    assert.deepEqual(copy.state.enemies.map(e=>e.saleValue),values);
    const before=s.gold;s.trader.present=true;s.trader.phase='trading';
    m.sellCaptives();m.sellCaptives();
    assert.equal(s.gold-before,15);assert.equal(s.trader.cargo.length,3);
});
run('rolling recruitment limits and remote arrivals', () => {
    const m=field(),s=m.state;
    s.player.x=20000;
    const lure=s.buildings.find(b=>b.kind==='lure');lure.stock=100;
    let oldStock=lure.stock;const arrivals=[];
    for(let sec=0;sec<=1500;sec++){
        s.elapsed=sec;m.updateBuildings(1);
        if(lure.stock<oldStock){arrivals.push(sec);oldStock=lure.stock;}
        s.goblins=s.goblins.filter(n=>n.task!=='joining');
    }
    assert.ok(arrivals.length>=24,arrivals.join(','));
    for(const at of arrivals){
        assert.ok(arrivals.filter(t=>t<=at&&t>at-120).length<=3);
        assert.ok(arrivals.filter(t=>t<=at&&t>at-600).length<=10);
    }
});
run('critical escape and continuing flight while pursued', () => {
    for(const role of ['idle','worker','hunter','brute']){
        const m=field(),s=m.state;
        const n=s.goblins[0];Object.assign(n,{role,x:4200,hp:5,maxHp:24,hit:.32});
        const e=m.makeEnemy('human',4250,0);m.rebuildEnemyCache();
        m.updateGoblins(.033);assert.ok(n.retreat&&n.x<4200,role);
        assert.ok(n.retreat.x<=3520);
        n.x=n.retreat.x;e.x=n.x+50;s.elapsed=4;m.updateGoblins(.033);
        assert.ok(n.retreat.x<n.x-500,role);
        n.x=n.retreat.x;e.x=9000;s.elapsed=8;m.updateGoblins(.033);
        assert.ok(n.retreat,role);
        assert.ok(n.hp>5,role);
    }
});
run('multi-haul capacity, positions, delivery and release', () => {
    for(const tier of [2,5]){
        const m=field(),s=m.state,n=s.goblins[0];
        m.hall.level=tier;n.x=1950;
        s.enemies=Array.from({length:5},(_,i)=>({...m.makeEnemy('human',1950+i*14,0),state:'wounded'}));
        m.rebuildEnemyCache();m.corpseTask(n,.033);
        const held=s.enemies.filter(e=>e.hauler===n.id);
        assert.equal(held.length,tier);
        m.updatePrison(.033);
        assert.equal(new Set(held.map(e=>e.x)).size,tier);
        if(tier===2){
            n.x=m.prison.x;m.haul(n,.033);m.updatePrison(.033);
            assert.ok(held.every(e=>e.state==='captured'&&!e.hauler));
            assert.equal(s.gearStock,2);
        }else{
            m.hurtTarget(n.id,200,0);assert.ok(held.every(e=>!e.hauler));
        }
    }
});
run('speed growth, home cooldown, refundable pledge', () => {
    const m=field(),s=m.state,p=s.player;
    const n=s.goblins[0];n.x=0;
    m.move(n,1000,100,.1);assert.equal(n.x,12);
    m.hall.level=3;m.tick(.033);n.x=0;m.move(n,1000,100,.1);assert.ok(Math.abs(n.x-14.4)<.001);
    p.x=p.prevX=4600;p.hp=20;
    s.pledge={paid:2,x:4600};const before=s.gold;
    assert.equal(m.returnHome(),true);assert.equal(p.x,m.hall.x-90);assert.equal(p.hp,20);
    assert.equal(s.gold,before+2);assert.equal(m.returnHomeSeconds,120);
    p.x=4600;assert.equal(m.returnHome(),false);
    const copy = new GameModel(m.snapshot());assert.equal(copy.returnHomeSeconds,120);
});
run('wall clearance blocks crossing and melee reaches the wall and the breach', () => {
    const m=field(),s=m.state,b=wall(m);
    s.fortifications=[{kind:'gate',hp:100,x:9000,rank:2}];
    assert.equal(m.stopAtEnemyWall(8800,9050),8910);
    assert.equal(m.stopAtEnemyWall(9200,8900),9090);
    s.fortifications=[];
    const e=m.makeEnemy('human',b.x+100,0,999);
    m.rebuildEnemyCache();
    s.player.x=b.x-200;
    const n=s.goblins[0];Object.assign(n,{role:'brute',x:b.x-20,hp:45,maxHp:45});
    for(let i=0;i<45;i++)m.tick(1/30);
    assert.ok(b.hp<b.maxHp);assert.ok(n.x<b.x);
    b.hp=0;s.defenseBreach={x:b.x,until:s.elapsed+6};e.x=b.x+65;e.hp=e.maxHp;e.strike=undefined;n.cooldown=0;
    const before=e.hp;
    for(let i=0;i<45;i++)m.tick(1/30);
    assert.ok(e.hp<before);
});
run('leader growth and both revival paths with an identical one-day truce', () => {
    for (const full of [false,true]) {
        const m=field(),s=m.state;
        s.day=8; s.player.hp=50;
        m.hall.job={left:0,total:1,next:2};
        m.finishJob(m.hall);
        assert.ok(Math.abs(m.playerMaxHp-115)<.001);
        assert.ok(Math.abs(s.player.hp-57.5)<.001);
        const regular = s.buildings.filter(b=>b.level>0&&b.hp>0&&!['hall','gear','treasury','flag'].includes(b.kind));
        m.spawnRaid();
        const active=m.activeEnemies().filter(e=>e.company);
        assert.ok(active.length>0);
        m.finish('lost');
        const gold=s.gold, treasury=s.treasury, raid=s.raids, pop=m.population;
        if (full) assert.equal(m.grantAdReward('revive','receipt'),true);
        else assert.equal(m.revive(),true);
        assert.equal(m.revive(),false);
        assert.equal(s.day,8); assert.equal(m.truceSeconds,240);
        assert.equal(s.status,'playing');
        assert.ok(Math.abs(s.player.hp - (full?115:57.5))<.001);
        assert.equal(s.gold,full?gold:0);assert.equal(s.treasury,full?treasury:0);
        assert.equal(regular.filter(b=>b.hp===0).length,full?0:Math.floor(regular.length/2));
        assert.equal(m.population,full?pop:pop-Math.floor(pop/2));
        assert.ok(active.every(e=>e.returned));
        m.spawnRaid();assert.equal(s.raids,raid);
        s.elapsed=s.truceUntil;
        m.spawnRaid();assert.equal(s.raids,raid+1);
    }
});
run('prison follows second intact wall and trader follows prison', () => {
    const m=field(),s=m.state;
    const forward=s.buildings.filter(b=>b.kind==='wall'&&b.region!==-3).sort((a,b)=>a.x-b.x).slice(0,3);
    for (const b of forward) Object.assign(b,{level:1,hp:120,maxHp:120});
    const prisoner=m.makeEnemy('human',m.prison.x,0);prisoner.state='captured';
    const old=m.prison.x;s.trader.phase='trading';s.trader.x=old+150;s.trader.visitDay=s.day;s.trader.present=true;
    m.syncPrisonLocation();
    assert.equal(m.prison.x,forward[1].x-460);
    assert.equal(prisoner.x,m.prison.x);
    assert.equal(s.trader.phase,'arriving');
    for(let i=0;i<50;i++)m.updateTrader(1);
    assert.equal(s.trader.x,m.prison.x+150);
    assert.equal(s.trader.phase,'trading');
    m.hurtTarget(forward[2].id,400,forward[2].x+50);
    assert.equal(m.prison.x,forward[0].x-460);
});
run('70 percent corpse threshold, wider pickup and true slam range', () => {
    const m=field(),s=m.state;
    m.rand=()=>.699;
    const n=s.goblins[0];m.killGoblin(n);assert.equal(n.coinLoot,1);
    m.rand=()=>.7;const q=s.goblins[1];m.killGoblin(q);assert.equal(q.coinLoot,0);
    assert.equal(m.playerClaimsCoin({x:s.player.x+80,value:1,age:.4}),true);
    assert.equal(m.playerClaimsCoin({x:s.player.x+85,value:1,age:.4}),false);
    s.player.x=3000;
    const e=m.makeEnemy('human',3040,0,999,{id:m.id(),hero:'heavy',kind:'human',sourceCamp:0});e.spells=0;e.cooldown=0;
    for(const n of s.goblins)n.x=0;
    m.updateEnemies(1/30);
    assert.equal(e.windup.kind,'slam');
    assert.equal(s.effects.find(f=>f.kind==='slamWarning').size,e.windup.radius);
    for(let i=0;i<34;i++)m.updateEnemies(1/30);
    assert.ok(s.player.hp<m.playerMaxHp);
    assert.ok(s.effects.some(f=>f.kind==='slamImpact'&&f.size===70));
});
require('fs').writeFileSync(__dirname+'/model-report.json',JSON.stringify({passed:tests},null,2));
console.log(tests.length+' model checks passed');
