const assert = require('node:assert/strict');
const { GameModel } = require('./model/GameModel.js');
const { RULES } = require('./model/Rules.js');

function scenario(withSiege = false) {
    const game = new GameModel(undefined, 99);
    const s = game.state;
    game.hall.level = 2;
    const wall = s.buildings.find(b => b.kind === 'wall' && b.region === -1);
    wall.level = 1; wall.hp = wall.maxHp = 120;
    game.syncDrum();
    s.enemies = []; s.camps.forEach(c => c.guardQueue = []);
    game.rebuildEnemyCache();
    s.goblins[2].role = 'brute';
    s.goblins[3].role = 'worker';
    if (withSiege) s.goblins.push(game.makeGoblin('worker',game.flag.x),game.makeGoblin('worker',game.flag.x));
    const fighters = s.goblins.filter(n => n.role === 'hunter' || n.role === 'brute');
    for (const n of s.goblins) { n.x = n.prevX = game.flag.x-100; n.task = ''; }
    const machine = {id:game.id(),kind:'catapult',x:game.flag.x-110,prevX:game.flag.x-110,hp:130,maxHp:130,owner:'goblin',company:0,crew:[],order:'park',cooldown:0,moving:false};
    if (withSiege) s.machines.push(machine);
    const events = [];
    function step(seconds, until) {
        for (let i = 0; i < seconds*30 && !until?.(); i++) {
            game.tick(1/30);
            events.push(...game.events.splice(0));
        }
    }
    function act(type) {
        const a = game.context()?.actions.find(a=>a.type===type);
        assert.ok(a && !a.disabled, `Missing ${type} in ${s.expedition.state}`);
        assert.equal(game.act(a),'done');
    }
    function pay(type, count) { for(let i=0;i<count;i++) act(type); }
    s.player.x = game.flag.x;
    s.gold = 30;
    pay('dispatch',RULES.drumCost);
    assert.equal(s.expedition.state,'gather');
    const first = s.expedition.drummer, second = s.expedition.puller;
    assert.notEqual(first,second);
    step(8,()=>s.expedition.state==='march');
    assert.equal(s.expedition.state,'march');
    assert.equal(events.filter(e=>e.kind==='drumBeat').length,6);
    const crew = s.goblins.filter(n=>n.id===first||n.id===second);
    assert.ok(crew.every(n=>n.order==='expedition'));
    if (withSiege) {
        assert.equal(machine.crew.length,2);
        assert.ok(!machine.crew.includes(first)&&!machine.crew.includes(second));
    }
    const cart = s.drumCart;
    assert.ok(cart && !cart.abandoned);
    const cartSave = new GameModel(game.snapshot());
    assert.equal(cartSave.state.drumCart.x,cart.x);
    assert.equal(cartSave.state.expedition.puller,second);
    const camp=s.camps[0], front=camp.x-RULES.camps[0].width*.5;
    s.player.x=front-130;
    step(.6);
    assert.equal(s.expedition.state,'march');
    assert.ok(cart.x>game.flag.x && game.waitingForDrum);
    step(80,()=>s.expedition.state!=='march');
    assert.equal(s.expedition.state,'assault');
    assert.equal(events.filter(e=>e.kind==='charge').length,1);
    const parked=cart.x;
    s.player.x=front-50; step(.4);
    assert.equal(cart.x,parked);
    return {game,s,cart,fighters,crew,camp,events,step,pay,act};
}

{
    const {game,s,cart,crew,step,pay,act,events} = scenario(true);
    const balance=s.gold, spent=s.spent;
    s.player.x=game.flag.x;
    assert.ok(!game.context()?.actions.some(a=>a.type==='retreat'));
    s.player.x=cart.x;
    act('retreat');
    assert.equal(s.pledge.paid,1);
    s.player.x=cart.x+500; step(.1);
    assert.equal(s.pledge,null); assert.equal(s.gold,balance);
    s.player.x=cart.x;
    const parked=cart.x;
    pay('retreat',RULES.drumRetreatCost);
    assert.equal(s.expedition.state,'return');
    assert.equal(s.spent,spent+RULES.drumRetreatCost);
    step(1.6);
    assert.equal(events.filter(e=>e.kind==='retreatDrum').length,1);
    assert.ok(!cart.abandoned && cart.x<parked);
    assert.ok(crew.every(n=>n.order==='return'));
    step(95,()=>s.expedition.state==='home');
    assert.equal(s.expedition.state,'home'); assert.equal(s.drumCart,undefined);
}
{
    const {game,s,camp,cart,crew,step,act} = scenario();
    s.player.x=cart.x;
    const gold=s.gold;
    act('retreat');
    game.clearCamp(camp);
    assert.equal(s.expedition.state,'return');
    assert.equal(s.gold,gold); assert.equal(s.pledge,null);
    assert.ok(crew.every(n=>n.order==='return'));
    step(55,()=>s.expedition.state==='home');
    assert.equal(s.expedition.state,'home'); assert.equal(s.drumCart,undefined);
}
{
    const {s,cart,fighters,crew,step} = scenario();
    const parked=cart.x;
    fighters.forEach(n=>{n.retreat={x:n.x-300,until:s.elapsed+3};});
    step(.1);
    assert.equal(s.expedition.state,'return');
    assert.ok(cart.abandoned && cart.x===parked);
    assert.ok(crew.every(n=>n.task===''&&n.order==='return'&&n.moving));
    step(55,()=>s.expedition.state==='home');
    assert.equal(s.expedition.state,'home'); assert.equal(s.drumCart.x,parked);
}
console.log('PASS: 两名鼓车苦工与器械班组分开、六声集结、行军等待、到阵停鼓、存档接续、投币撤退与退款、胜利收车、溃败弃车');
