const assert = require('node:assert/strict')
const { GameModel } = require('./model/GameModel.js')
const { RULES } = require('./model/Rules.js')
const game = new GameModel(undefined, 99)
const s = game.state
game.hall.level = 2
const wall = s.buildings.find(b => b.kind === 'wall' && b.region === -1)
wall.level=1; wall.hp=wall.maxHp=120
game.syncDrum()
assert.equal(game.flag.x, wall.x+145)
assert.equal(game.flag.level, 1)
s.enemies = []; s.camps.forEach(c=>c.guardQueue=[])
game.rebuildEnemyCache()
s.goblins[2].role='brute'
s.goblins[3].role='worker'
const allFighters=s.goblins.filter(n=>n.role==='hunter'||n.role==='brute')
for (const n of s.goblins){n.x=game.flag.x-200;n.prevX=n.x;n.task=''}
const m={id:game.id(),kind:'catapult',x:game.flag.x-360,prevX:game.flag.x-360,hp:130,maxHp:130,owner:'goblin',company:0,crew:[],order:'park',cooldown:0,moving:false}
s.machines.push(m)
s.player.x=game.flag.x
const action=game.context().actions.find(a=>a.type==='dispatch')
assert.ok(action && !action.disabled)
const gold=s.gold
for(let i=0;i<RULES.drumCost;i++)game.act(action)
assert.equal(s.gold,gold-3)
assert.equal(s.expedition.state,'gather')
let beats=0
function step(seconds){for(let i=0;i<seconds*30;i++){game.tick(1/30);beats+=game.events.filter(e=>e.kind==='drumBeat').length;game.events.length=0}}
step(6)
assert.equal(beats,6)
assert.equal(s.expedition.state,'march')
assert.ok(allFighters.every(n=>n.order==='expedition'))
assert.equal(m.crew.length,2)
const saved=new GameModel(game.snapshot())
assert.equal(saved.state.expedition.state,'march')
assert.equal(saved.state.revision,17)
const camp=s.camps[0]
const front=camp.x-RULES.camps[0].width*.5
s.player.x=front-165
step(2)
assert.equal(s.expedition.state,'march')
assert.ok(game.waitingForSiege)
step(65)
assert.ok(camp.hp<camp.maxHp,'队伍在器械抵达后确实发动进攻')
console.log('PASS 战鼓收费一次、六击、全队集结、双苦工推车、存档接续、等待器械、进攻扣营地血量')
