// 对输入边沿和商人事务作独立预期验证，不把模拟手柄称作实体手柄验收。
require('./test_pc_desktop.cjs');
const path=require('path'),assert=require('assert'),fs=require('fs');
const root=path.resolve(__dirname,'..'),base=path.join(root,'cocos/assets/scripts');
const {PadState}=require(path.join(base,'view/PadState.ts'));
const {GameModel}=require(path.join(base,'model/GameModel.ts'));
const {updateMountTrader,MOUNT_TRADER_ID,MOUNT_VISIT}=require(path.join(base,'model/MountTrader.ts'));
const p=new PadState(),sample=(x=0,buttons={})=>({id:0,x,y:0,buttons:{confirm:false,cancel:false,secondary:false,cycle:false,sprint:false,home:false,pause:false,help:false,...buttons}});
p.sample(sample(.15));assert.equal(p.x,0);
p.sample(sample(1,{confirm:true}));assert.equal(p.x,1);assert(p.pressed.has('confirm'));
p.sample(sample(1,{confirm:true}));assert(!p.pressed.has('confirm'));
p.reset();p.sample(sample(1,{confirm:true}));assert.equal(p.x,0);assert.equal(p.pressed.size,0);
p.sample(sample());p.sample(sample(0,{confirm:true}));assert(p.pressed.has('confirm'));
assert(p.sample(undefined));assert.equal(p.x,0);assert.equal(p.down.size,0);
const m=new GameModel(),s=m.state;
assert.equal(m.purchaseMount('lizard'),false);
const offers=[];
for(const day of [2,4,6,8,10]){
 s.mountTrader.phase='away';s.day=day;s.time=1;updateMountTrader(s,0);
 offers.push(s.mountTrader.offer);for(let i=0;i<240;i++)updateMountTrader(s,1/30);
 assert.equal(s.mountTrader.phase,'trading');
}
assert.deepEqual(offers,['lizard','wolf','bat','boar','lizard']);
s.mountTrader.phase='trading';s.mountTrader.offer='lizard';s.mountTrader.sold=false;s.mountTrader.visitDay=s.day;s.player.x=s.mountTrader.x;s.gold=50;
let ctx=m.context();m.cycleTarget();ctx=m.context();
// 无论附近还有谁，都通过实际候选找到商人，再使用 act 正式逐币入口。
for(let i=0;i<20&&ctx?.id!==MOUNT_TRADER_ID;i++){m.cycleTarget();ctx=m.context();}
assert.equal(ctx.id,MOUNT_TRADER_ID);const action=ctx.actions[0];assert.equal(action.cost,30);
for(let i=0;i<4;i++)assert.equal(m.act(action),'done');assert.equal(s.gold,46);
s.time=MOUNT_VISIT.departAt;updateMountTrader(s,.1);
assert.equal(m.act(action),'none');m.cancelPledge();assert.equal(s.gold,50);
s.time=5;s.mountTrader.phase='trading';
for(let i=0;i<30;i++)m.act(action);
assert.equal(s.player.mount,'lizard');assert.equal(s.gold,20);assert(s.mountTrader.sold);
assert.equal(m.act(action),'none');assert.equal(s.gold,20);
const restored=new GameModel(JSON.parse(JSON.stringify(s)));assert.equal(restored.state.mountTrader.offer,'lizard');assert(restored.state.mountTrader.sold);
const wealth=s.gold;s.status='lost';assert(!m.grantAdReward('revive','fake'));assert(!m.grantAdReward('gold','fake'));assert.equal(s.gold,wealth);
fs.writeFileSync(path.join(root,'qa/pc/controller-model.json'),JSON.stringify({passed:true,checks:['dead zone','press edge','held button quarantine','disconnect reset','visit cycle','proximity purchase gate','partial payment refund','single transaction','sold visit persistence','ad reward rejection'],offers},null,2));
console.log('Controller and trader model checks passed');
