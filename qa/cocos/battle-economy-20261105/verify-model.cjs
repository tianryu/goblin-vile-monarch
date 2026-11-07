// 只验证本批战斗、后勤及鼓车回归，所有模型和存档均在本目录隔离。
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const ts = require('C:/Develop/Cocos/Creator/3.8.8/resources/app.asar.unpacked/node_modules/typescript');
const root = path.resolve(__dirname, '../../..'), out = path.join(__dirname, 'model');
fs.mkdirSync(out, {recursive:true});
fs.writeFileSync(path.join(out,'package.json'),'{"type":"commonjs"}');
for (const file of fs.readdirSync(path.join(root,'cocos/assets/scripts/model')).filter(f=>f.endsWith('.ts')))
    fs.writeFileSync(path.join(out,file.replace(/\.ts$/,'.js')),ts.transpileModule(fs.readFileSync(path.join(root,'cocos/assets/scripts/model',file),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS}}).outputText);
const {GameModel} = require('./model/GameModel'), {RULES,skyTime,BUILDINGS} = require('./model/Rules');
const results=[];
function check(name, fn){try{const details=fn();results.push({name,pass:true,details});}catch(e){results.push({name,pass:false,error:e.stack});}}
function base(){const m=new GameModel();const s=m.state;s.enemies=[];s.goblins=[];s.animals=[];s.coins=[];s.fortifications=[];s.companies=[];s.shots=[];s.gearDrops=[];s.effects=[];s.day=3;s.time=45;s.elapsed=500;m.rebuildEnemyCache();return m;}
function unit(m,role,x){const n=m.makeGoblin(role,x);m.state.goblins.push(n);return n;}
function body(m,x,kind='human',hero){const e=m.makeEnemy(kind,x,0,0,hero?{hero,sourceCamp:0}:undefined);e.state='wounded';e.hp=0;e.timer=0;m.rebuildEnemyCache();return e;}
function crew(m,x=3500){m.hall.level=2;const a=unit(m,'worker',x-25),b=unit(m,'worker',x+83),n=unit(m,'hunter',x-100);a.task='drum';b.task='drumPull';n.order='expedition';m.state.expedition={state:'march',camp:0,drummer:a.id,puller:b.id};m.state.drumCart={x,prevX:x,face:1,travel:0};m.state.player.x=x+180;return{a,b,n};}

check('遗体收益与重复结算',()=>{
    const m=base(),s=m.state;s.gold=0;s.treasury=0;
    for(const hero of [undefined,'heavy','siege_boss']){const e=body(m,2000,'human',hero);e.state='dead';e.coinLoot=0;const before=s.gold;m.recoverBody(e,true);assert.equal(s.gold-before,hero?2:1);const total=s.gold;m.recoverBody(e,true);assert.equal(s.gold,total);}
    const n=unit(m,'hunter',2000);n.dead=true;n.coinLoot=0;m.recoverBody(n,false);assert.equal(s.treasury,1);m.recoverBody(n,false);assert.equal(s.treasury,1);
    return{manual:s.gold,auto:s.treasury};
});
check('苦工一级主屋有爪牙仍先救活口，多人预约不同目标',()=>{
    const m=base(),s=m.state;unit(m,'idle',1900);const a=unit(m,'worker',1900),b=unit(m,'worker',1900);
    const dead=body(m,1901);dead.state='dead';const c=body(m,2200),d=body(m,2300);
    m.updateGoblins(.1);assert.equal(a.task,'capture');assert.equal(b.task,'capture');assert.notEqual(a.targetId,b.targetId);assert.ok([c.id,d.id].includes(a.targetId));assert.ok([c.id,d.id].includes(b.targetId));
    for(let i=0;i<25;i++){s.elapsed+=.1;m.updateGoblins(.1);}assert.ok([c,d].every(e=>e.hauler));assert.equal(dead.hauler,0);
    return[c.hauler,d.hauler];
});
check('施工人员不抢俘虏，其他苦工不再被全局施工任务挡住',()=>{
    const m=base();const wall=m.state.buildings.find(b=>b.kind==='wall'&&b.region===-1);wall.level=1;wall.hp=120;wall.maxHp=120;wall.job={left:12,total:12,next:2};
    const a=unit(m,'worker',wall.x-5),b=unit(m,'worker',2100),e=body(m,2450);a.task='construction';a.targetId=wall.id;
    m.updateGoblins(.1);assert.equal(a.task,'construction');assert.equal(b.task,'capture');assert.equal(b.targetId,e.id);
});
check('爪牙不拖活口，苦工避开有敌人和敌墙阻挡的伤兵',()=>{
    const m=base();const a=unit(m,'idle',2100),b=unit(m,'worker',2100),e=body(m,2400);m.state.fortifications.push({id:m.id(),kind:'gate',camp:0,x:2300,hp:100,maxHp:100,cooldown:0});
    m.updateGoblins(.1);assert.notEqual(a.task,'capture');assert.notEqual(b.task,'capture');m.state.fortifications=[];
    const foe=m.makeEnemy('human',e.x+150,0,999);m.rebuildEnemyCache();m.updateGoblins(.1);assert.equal(e.hauler,0);assert.notEqual(b.task,'capture');
});
check('二级主屋连续搬两名活口，俘虏成交价4至6，装备拆卖一币',()=>{
    const m=base(),s=m.state;m.hall.level=2;const a=unit(m,'worker',2200),b=body(m,2200),c=body(m,2260);m.updateGoblins(.1);assert.equal(a.task,'haul');assert.equal(b.hauler,a.id);assert.equal(c.hauler,a.id);
    for(const e of[b,c]){assert.ok(e.saleValue>=4&&e.saleValue<=6);e.state='captured';e.hauler=0;}Object.assign(s.trader,{present:true,phase:'trading'});const gold=s.gold;m.sellCaptives();assert.equal(s.gold-gold,b.saleValue+c.saleValue);
    const gear=s.buildings.find(b=>b.kind==='gear');s.gearStock=2;const before=s.gold;m.commit({key:'gear',targetId:gear.id,type:'scrapGear',cost:0,icon:'coin'});assert.equal(s.gold-before,1);assert.equal(s.gearStock,1);return{prices:[b.saleValue,c.saleValue],gearPrice:1};
});
check('苦工白天积攒、每晚仅一次送款，读档不会再次送款',()=>{
    const m=base(),s=m.state;const farm=s.buildings.find(b=>b.kind==='farm'&&b.region===-1);Object.assign(farm,{level:1,hp:100,maxHp:100});const n=unit(m,'worker',farm.x);n.lastWhip=s.elapsed-50;
    for(let i=0;i<1000;i++){s.elapsed+=.1;m.updateGoblins(.1);}assert.ok(n.carry>=3);assert.equal(n.depositedDay,undefined);const saved=n.carry;
    s.time=121;n.x=m.hall.x;const before=s.treasury;m.updateGoblins(.1);assert.equal(n.carry,0);assert.equal(n.depositedDay,s.day);assert.ok(s.treasury-before>=saved-1);
    n.carry=3;const loaded=new GameModel(JSON.parse(JSON.stringify(s)));const nn=loaded.state.goblins.find(q=>q.id===n.id);nn.x=loaded.hall.x;loaded.updateGoblins(.1);assert.equal(nn.carry,3);
    loaded.state.day++;loaded.updateGoblins(.1);assert.equal(nn.carry,0);return{per100seconds:saved,deposited:s.treasury-before};
});
check('箭塔范围和攻速提高，箭矢命中移动猎物且不重复伤害',()=>{
    const m=base(),s=m.state;const tower=s.buildings.find(b=>b.kind==='tower');Object.assign(tower,{level:1,hp:90,maxHp:90});const n=unit(m,'hunter',tower.x);n.towerId=tower.id;n.task='tower';const rabbit={id:m.id(),kind:'rabbit',x:n.x+430,home:n.x+430,hp:20,face:1,moving:true,timer:0};s.animals=[rabbit];
    assert.ok(m.towerCombatRange(tower)>=520);m.hunt(n,.1,true);const shot=s.shots[0];assert.ok(shot?.tracking);assert.ok(n.cooldown<.63);assert.ok(shot.duration<.4);rabbit.x+=160;m.updateShots(shot.duration+.01);assert.equal(rabbit.hp,15);m.updateShots(.05);assert.equal(rabbit.hp,15);assert.equal(shot.targetX,rabbit.x);
});
check('旧档夜晚比例迁移，月升月落、白天时长和同日出兵不重复',()=>{
    const m=base(),s=m.state;s.revision=22;s.time=180;s.day=8;const elapsed=s.elapsed;const n=new GameModel(JSON.parse(JSON.stringify(s)));assert.equal(n.state.time,160);assert.equal(n.state.day,8);assert.equal(n.state.elapsed,elapsed);assert.equal(skyTime(0),0);assert.equal(skyTime(120),120);assert.equal(skyTime(200),240);assert.equal(RULES.daySeconds-RULES.daylightSeconds,80);
    const again=new GameModel(JSON.parse(JSON.stringify(n.state)));assert.equal(again.state.time,160);again.spawnRaid();const raids=again.state.raids;again.spawnRaid();assert.equal(again.state.raids,raids);return{night:80,migration:160};
});
check('夜袭结束后出征不因敌多人少自动逃跑，重伤仍会退却',()=>{
    const m=base(),s=m.state;s.time=175;s.companies=[{id:m.id(),initial:3,lost:3,retreating:false,camp:0,spawnedAt:450,day:s.day,pending:[]}];const n=unit(m,'hunter',s.camps[0].x-300);n.order='expedition';s.expedition={state:'assault',camp:0};for(let i=0;i<8;i++)m.makeEnemy('human',n.x+180+i*15,0,0);m.rebuildEnemyCache();
    assert.equal(m.goblinsCanRoam(),true);for(let i=0;i<50;i++){s.elapsed+=.1;m.updateGoblins(.1);}assert.equal(n.retreat,undefined);assert.equal(n.order,'expedition');
    n.hp=3;n.hit=.3;m.updateGoblins(.1);assert.ok(n.retreat);return{healthy:'fights',critical:'retreats'};
});
check('鼓车追上行走和奔跑首领、转向不等换把手，不限制队伍',()=>{
    const m=base(),s=m.state;const{a,b}=crew(m,1000),cart=s.drumCart;const gaps=[];
    for(const run of[false,true]){m.input.run=run;for(let i=0;i<100;i++){s.player.prevX=s.player.x;s.player.x+=RULES.mount.boar.speed*(run?1.75:1)*.05;s.player.face=1;m.updateExpedition(.05);gaps.push(s.player.x-cart.x);assert.equal(m.marchAnchor,s.player.x);}}
    assert.ok(Math.max(...gaps)<215);assert.ok(Math.min(...gaps)>130);const prev=cart.x;s.player.prevX=s.player.x;s.player.x-=500;s.player.face=-1;m.updateExpedition(.05);assert.ok(cart.x<prev);assert.equal(cart.face,-1);
    assert.ok(Math.abs(b.x-cart.x)<240);return{minGap:Math.min(...gaps),maxGap:Math.max(...gaps)};
});
check('鼓车攻城时停留，胜利返回，玩家行走比之前快且不穿敌墙',()=>{
    const m=base(),s=m.state;crew(m);s.expedition.state='assault';const x=s.drumCart.x;s.player.x+=400;m.updateExpedition(.1);assert.equal(s.drumCart.x,x);s.camps[0].defeated=true;m.updateExpedition(.1);assert.equal(s.expedition.state,'return');
    const n=base();n.state.player.x=1000;n.input.axis=1;n.tick(.1);assert.equal(n.state.player.x,1025);n.state.fortifications.push({id:n.id(),kind:'gate',camp:0,x:1200,hp:100,maxHp:100,cooldown:0});for(let i=0;i<30;i++)n.tick(.1);assert.ok(n.state.player.x<1200);
});
fs.writeFileSync(path.join(__dirname,'model-results.json'),JSON.stringify({timestamp:new Date().toISOString(),results},null,2));
for(const r of results)console.log((r.pass?'PASS ':'FAIL ')+r.name+(r.error?'\n'+r.error:''));
if(results.some(r=>!r.pass))process.exitCode=1;
