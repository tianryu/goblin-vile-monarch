export const DAY=150,MAX_ACTIVE=60,GROUND=575;
export const MOUNTS={boar:{name:'獠牙野猪',speed:1,stamina:1},lizard:{name:'洞穴巨蜥',speed:1.15,stamina:1.8},wolf:{name:'疾风狼',speed:1.3,stamina:1},bat:{name:'洞穴巨蝠',speed:1.2,stamina:1}};
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export class Game{
 constructor(global=null,world=null){this.global=global||{version:1,mounts:['boar'],reserve:0,pending:{hunter:0,worker:0},boosts:{wolf:0,bat:0},receipts:[],settings:{sound:true},wins:0};this.events=[];this.pauses=new Set();this.input={axis:0,run:false};this.target=null;this.saveRequested=false;this.state=world||this.newWorld();this.validate();}
 newWorld(){const s={version:1,time:25,day:1,total:0,seed:947,nid:1,status:'playing',gold:12,adInBag:0,player:{x:200,face:1,stamina:100,mount:'boar',fly:0,hit:0},npcs:[],enemies:[],coins:[],shots:[],effects:[],buildings:[],tools:{worker:0,hunter:0,farmer:0,captain:0},crown:null,waves:0,kills:0,spent:0,recruited:0,attacks:{'-1':false,'1':false},retaliation:[],tutorial:0,nightSpawned:false};
 const add=(kind,x,extra={})=>s.buildings.push({id:s.nid++,kind,x,level:0,hp:0,max:0,job:null,...extra});
 add('hall',-110,{level:1,hp:100,max:100});add('merchantGold',-510,{level:1});add('merchantArmy',355,{level:1});add('merchantMount',630,{level:1});
 for(const side of [-1,1]){for(const d of [805,1300,1900])add('wall',d*side);for(const d of [745,1240,1840])add('tower',d*side);add('farm',side*1080);add('camp',side*1550,{stock:2,regen:0});add('portal',side*2700,{level:1,hp:140,max:140});add('rally',side*680,{level:1});for(const d of [1010,1440,1750,2100])add('tree',side*d,{level:1});add('chest',side*2350,{level:1});}
 add('toolsWorker',-720,{level:1});add('toolsHunter',-650,{level:1});add('toolsFarmer',-580,{level:1});add('toolsCaptain',-340,{level:1});
 s.npcs.push(this.makeNPC('idle',-240,s),this.makeNPC('idle',-160,s));return s;}
 validate(){const g=this.global;g.mounts=[...new Set(['boar',...(g.mounts||[])])].filter(k=>MOUNTS[k]);g.reserve=Math.max(0,Number(g.reserve)||0);g.pending||={hunter:0,worker:0};g.boosts||={wolf:0,bat:0};g.receipts||=[];g.settings||={sound:true};const s=this.state;if(!Number.isFinite(s.player?.x)||!Array.isArray(s.buildings))throw Error('存档格式不完整');if(!g.mounts.includes(s.player.mount))s.player.mount='boar';s.adInBag=clamp(s.adInBag||0,0,s.gold);}
 rand(){const s=this.state;s.seed=(1664525*s.seed+1013904223)>>>0;return s.seed/4294967296;}
 makeNPC(role,x,s=this.state){const id=s.nid++;return{id,role,x,hp:role==='captain'?80:20,carry:0,timer:0,shot:0,side:id%2?1:-1,attack:false,anim:0};}
 emit(text,type='info'){this.events.push({text,type});}
 save(){this.saveRequested=true;}
 get hall(){return this.state.buildings.find(b=>b.kind==='hall');}
 get phase(){return this.state.time<105?'白昼':this.state.time<120?'黄昏':'黑夜';}
 get night(){return this.state.time>=120;}
 get active(){return this.state.npcs.filter(n=>n.role!=='idle').length;}
 get paused(){return this.pauses.size>0;}
 get remainingPortals(){return this.state.buildings.filter(b=>b.kind==='portal'&&b.hp>0).length;}
 pause(reason,on=true){on?this.pauses.add(reason):this.pauses.delete(reason);this.input.axis=0;this.input.run=false;}
 pay(n){const s=this.state;this.refill();if(s.gold<n){this.emit('金币不足，猎手和菌田能带来收入');return false;}const natural=s.gold-s.adInBag;const ad=Math.max(0,n-natural);s.adInBag-=ad;s.gold-=n;s.spent+=n;this.refill();return true;}
 refill(){const s=this.state,n=Math.min(50-s.gold,this.global.reserve);if(n>0){s.gold+=n;s.adInBag+=n;this.global.reserve-=n;}}
 gain(n,ad=false){if(ad){this.global.reserve+=n;this.refill();}else{const room=Math.min(n,50-this.state.gold);this.state.gold+=room;if(room<n)this.drop(this.state.player.x,n-room);}this.save();}
 drop(x,value=1){if(value<=0)return;const pile=this.state.coins.find(c=>Math.abs(c.x-x)<16);if(pile){pile.value+=value;return;}this.state.coins.push({id:this.state.nid++,x,value,age:0});}
 boundary(side){const walls=this.state.buildings.filter(b=>b.kind==='wall'&&Math.sign(b.x)===side&&b.hp>0);return walls.length?side*Math.max(...walls.map(b=>Math.abs(b.x))):side*420;}
 offer(b){if(!b)return null;const s=this.state;const mk=(label,cost=0,extra={})=>({id:b.id,kind:b.kind,x:b.x,label,cost,...extra});if(b.job)return mk('正在建造',0,{disabled:true,detail:Math.ceil(b.job.left)+'秒'});
 if(b.kind.startsWith('merchant'))return mk({merchantGold:'金币商人',merchantArmy:'援军商人',merchantMount:'坐骑商人'}[b.kind],0,{shop:true});
 if(b.kind==='hall')return b.level>=3?mk('酋长大厅　已满级',0,{disabled:true}):mk('升级酋长大厅',b.level===1?6:12);
 if(b.kind==='wall'){if(b.level>=3&&b.hp>=b.max)return mk('加固墙　已满级',0,{disabled:true});if(b.level>=this.hall.level&&b.hp>0&&b.hp>=b.max)return mk('先升级大厅',0,{disabled:true});return mk(b.hp===0&&b.level>0?'重建城墙':b.hp>0&&b.hp<b.max?'修复城墙':b.level?'升级城墙':'建造城墙',b.level&&b.hp<b.max?2:[2,5,9][b.level]);}
 if(b.kind==='tower'){if(b.level>=2)return mk('哨塔　已满级',0,{disabled:true});if(this.hall.level<2)return mk('大厅二级解锁哨塔',0,{disabled:true});return mk(b.level?'升级哨塔':'建造哨塔',b.level?6:3);}
 if(b.kind==='farm'){if(this.hall.level<2)return mk('大厅二级解锁菌田',0,{disabled:true});return b.level>=2?mk('菌田　已满级',0,{disabled:true}):mk(b.level?'升级菌田':'种植菌田',b.level?8:5);}
 if(b.kind==='camp')return mk(b.stock>0?'招募流浪哥布林':'等待新的流浪者',b.stock?1:0,{disabled:b.stock<=0});
 if(b.kind.startsWith('tools')){const role={toolsWorker:'worker',toolsHunter:'hunter',toolsFarmer:'farmer',toolsCaptain:'captain'}[b.kind];if((role==='farmer'&&this.hall.level<2)||(role==='captain'&&this.hall.level<3))return mk(role==='farmer'?'大厅二级解锁农具':'大厅三级解锁队长',0,{disabled:true});return mk({worker:'购买木锤',hunter:'购买短弓',farmer:'购买农具',captain:'购买队长装备'}[role],{worker:2,hunter:2,farmer:4,captain:6}[role],{role,detail:'待领 '+s.tools[role]});}
 if(b.kind==='tree')return b.level?mk('清理树木',1):null;
 if(b.kind==='chest')return b.level?mk('打开遗落宝箱'):null;
 if(b.kind==='rally')return this.hall.level<3?mk('大厅三级解锁出征',0,{disabled:true}):mk('向'+(b.x<0?'西':'东')+'出征',4,{rally:true});return null;}
 findTarget(){const p=this.state.player;if(p.fly>12)return null;const available=this.state.buildings.map(b=>({b,o:this.offer(b)})).filter(({b,o})=>o&&Math.abs(b.x-p.x)<(o.shop?165:66));if(!available.length)return null;available.sort((a,b)=>{const score=t=>Math.abs(t.b.x-p.x)+(Math.sign(t.b.x-p.x)!==p.face?10:0)+(t.o.disabled?50:0)-(this.target?.id===t.b.id?18:0);return score(a)-score(b)});return available[0].o;}
 action(target=null){if(this.paused||this.state.status!=='playing')return null;if(this.state.player.fly>12){this.emit('松开奔跑，先落地再交互');return null;}const o=target||this.findTarget();if(!o){if(this.pay(1)){this.drop(this.state.player.x+this.state.player.face*42);this.emit('投下一枚金币');}return null;}const b=this.state.buildings.find(b=>b.id===o.id);if(!b||Math.abs(b.x-this.state.player.x)>(o.shop?180:80))return null;const live=this.offer(b);if(!live||live.disabled){this.emit(live?.label||'目标已离开');return null;}if(live.shop)return live.kind;
 if(live.rally){const side=Math.sign(b.x);if(!this.state.buildings.some(v=>v.kind==='portal'&&Math.sign(v.x)===side&&v.hp>0)){this.emit('这一侧已经安全');return null;}const cap=this.state.npcs.find(n=>n.role==='captain'&&!n.attack);const hunters=this.state.npcs.filter(n=>n.role==='hunter'&&!n.attack);if(!cap||hunters.length<2){this.emit('需要1名队长和至少2名猎手');return null;}if(!this.pay(live.cost))return null;cap.attack=true;cap.side=side;for(const n of hunters.slice(0,4)){n.attack=true;n.side=side;}this.emit((side<0?'西':'东')+'征小队出发！');this.save();return null;}
 if(!this.pay(live.cost))return null;
 if(b.kind==='camp'){b.stock--;if(this.state.npcs.length<MAX_ACTIVE){this.state.npcs.push(this.makeNPC('idle',b.x));}else{this.state.tools.worker++;this.global.pending.worker++;this.emit('部落繁忙，新族人加入待命');}this.state.recruited++;this.emit('一名哥布林加入部落');}
 else if(live.role){this.state.tools[live.role]++;this.emit('工具已放到摊位，待业族人会自动领取');}
 else if(b.kind==='chest'){b.level=0;this.gain(15);this.emit('发现15枚金币！');}
 else{b.job={left:b.kind==='tree'?3:4+b.level*2,total:b.kind==='tree'?3:4+b.level*2,repair:b.level>0&&b.hp<b.max};this.emit(b.kind==='tree'?'工匠准备清理树木':'已下达建设任务');}
 this.save();return null;}
 grantReward(kind,id){if(typeof id!=='string'||!id||this.global.receipts.includes(id))return false;const g=this.global;if(kind==='gold')this.gain(30,true);else if(kind==='hunter'||kind==='worker'){g.pending[kind]+=2;this.fillPending();}else if(kind==='wolf'||kind==='bat'){if(!g.mounts.includes(kind))g.mounts.push(kind);else g.boosts[kind]+=300;}else return false;g.receipts.push(id);this.emit({gold:'金币 +30',hunter:'猎手 +2',worker:'工匠 +2',wolf:'疾风狼奖励已到账',bat:'巨蝠奖励已到账'}[kind],'reward');this.save();return true;}
 fillPending(){for(const role of ['hunter','worker'])while(this.global.pending[role]>0&&this.state.npcs.length<MAX_ACTIVE){this.global.pending[role]--;this.state.npcs.push(this.makeNPC(role,role==='hunter'?355:330));}}
 buyLizard(){if(this.global.mounts.includes('lizard'))return false;if(!this.spendTotal(40)){this.emit('需要40金币，可合并使用钱袋与储备');return false;}this.global.mounts.push('lizard');this.emit('洞穴巨蜥永久解锁！','reward');this.save();return true;}
 spendTotal(n){if(this.state.gold+this.global.reserve<n)return false;const from=Math.min(this.state.gold,n);this.state.adInBag=Math.max(0,this.state.adInBag-Math.max(0,from-(this.state.gold-this.state.adInBag)));this.state.gold-=from;this.global.reserve-=n-from;this.state.spent+=n;this.refill();return true;}
 equipMount(kind){if(!this.global.mounts.includes(kind))return false;this.state.player.mount=kind;this.state.player.fly=0;this.emit('已骑乘'+MOUNTS[kind].name);this.save();return true;}
 reset(){this.global.reserve+=this.state.adInBag||0;this.state=this.newWorld();this.pauses.clear();this.input={axis:0,run:false};this.target=null;this.fillPending();this.save();}
 finishJob(b){const repair=b.job.repair;b.job=null;if(b.kind==='tree'){b.level=0;this.drop(b.x,2);}else{if(!repair)b.level++;b.max=b.kind==='wall'?[0,65,150,280][b.level]:b.kind==='hall'?100*b.level:80*b.level;b.hp=b.max;this.emit({wall:'城墙完工',tower:'哨塔完工',farm:'菌田已建成',hall:'酋长大厅升级完成'}[b.kind]||'建设完成');}this.save();}
 tick(dt){if(this.paused||this.state.status!=='playing')return;dt=clamp(dt,0,.1);const s=this.state,p=s.player;s.total+=dt;s.time+=dt;if(s.time>=DAY){s.time-=DAY;s.day++;s.nightSpawned=false;this.emit('第'+s.day+'日　新的黎明');this.save();}if(this.night&&!s.nightSpawned){s.nightSpawned=true;this.spawnWave();}
 p.hit=Math.max(0,p.hit-dt);const moving=Math.abs(this.input.axis)>.14;const mount=MOUNTS[p.mount];const boosted=(this.global.boosts[p.mount]||0)>0;if(boosted)this.global.boosts[p.mount]=Math.max(0,this.global.boosts[p.mount]-dt);let speed=0;if(moving){p.face=Math.sign(this.input.axis);const sprint=this.input.run&&(boosted||p.stamina>2);speed=145*(sprint?1.55:1)*mount.speed*(p.mount==='wolf'&&boosted?1.6/1.3:1);p.x=clamp(p.x+Math.sign(this.input.axis)*speed*dt,-2900,2900);if(sprint&&!boosted)p.stamina=Math.max(0,p.stamina-18/mount.stamina*dt);else p.stamina=Math.min(100,p.stamina+10/mount.stamina*dt);const flying=p.mount==='bat'&&sprint;p.fly+=((flying?70:0)-p.fly)*Math.min(1,dt*7);}else{p.stamina=Math.min(100,p.stamina+21/mount.stamina*dt);p.fly+=(0-p.fly)*Math.min(1,dt*7);}
 this.refill();this.fillPending();this.updateNPCs(dt);this.updateEnemies(dt);this.updateShots(dt);
 for(const b of s.buildings){if(b.kind==='camp'){b.regen+=dt;if(b.regen>40){b.regen=0;b.stock=Math.min(3,b.stock+1);}}if(b.kind==='tower'&&b.level){b.shot=(b.shot||0)-dt;const enemy=s.enemies.find(e=>e.hp>0&&Math.abs(e.x-b.x)<340);if(enemy&&b.shot<=0){b.shot=.9;this.shoot(b.x,enemy.x,9*b.level,'friendly',GROUND-80);}}}
 for(const c of s.coins){c.age+=dt;if(Math.abs(c.x-p.x)<37&&p.fly<12&&s.gold<50){const n=Math.min(c.value,50-s.gold);s.gold+=n;c.value-=n;}}
 s.coins=s.coins.filter(c=>c.value>0);if(s.crown){if(Math.abs(s.crown.x-p.x)<32&&!s.crown.carrier){s.crown=null;p.hit=2;this.emit('王冠夺回来了！');}else if(s.crown.carrier){const e=s.enemies.find(e=>e.id===s.crown.carrier);if(!e||e.hp<=0){s.crown.carrier=null;}else{s.crown.x=e.x;if(Math.abs(e.x)>2890){s.status='lost';this.emit('王冠失守了。部落等待你的归来。');this.save();}}}}
 s.effects=s.effects.filter(e=>(e.life-=dt)>0);for(const r of s.retaliation){r.left-=dt;if(r.left<=0&&!r.done){r.done=true;this.spawnWave(r.side,true);}}s.retaliation=s.retaliation.filter(r=>!r.done);
 if(this.remainingPortals===0&&!s.enemies.some(e=>e.hp>0)&&!s.retaliation.length){s.status='won';this.global.wins++;this.emit('联军撤退了，森林归哥布林！');this.save();}
 this.target=this.findTarget();}
 updateNPCs(dt){const s=this.state,p=s.player;const move=(n,x,speed=68)=>{const d=x-n.x;n.moving=Math.abs(d)>5;if(n.moving)n.x+=Math.sign(d)*Math.min(Math.abs(d),speed*dt);};
 for(const n of s.npcs){n.anim+=dt;n.shot=Math.max(0,n.shot-dt);n.timer+=dt;if(n.hp<=0)continue;
 if(n.role==='idle'){move(n,-250+n.id%5*30);for(const role of ['worker','hunter','farmer','captain'])if(s.tools[role]>0){s.tools[role]--;n.role=role;n.hp=role==='captain'?80:20;n.timer=0;this.emit({worker:'工匠领取了木锤',hunter:'猎手领取了短弓',farmer:'农夫领取了农具',captain:'队长准备就绪'}[role]);break;}continue;}
 if(n.carry>=6){move(n,n.side*200);if(Math.abs(n.x-n.side*200)<30){this.drop(n.x,n.carry);n.carry=0;}continue;}
 if(n.role==='worker'){const jobs=s.buildings.filter(b=>b.job&&(!this.night||Math.abs(b.x)<Math.abs(this.boundary(Math.sign(b.x)))+20)).sort((a,b)=>Math.abs(n.x-a.x)-Math.abs(n.x-b.x));const job=jobs[0];if(job){move(n,job.x);if(Math.abs(n.x-job.x)<35){job.job.left-=dt;if(job.job.left<=0)this.finishJob(job);}}else{const damaged=s.buildings.find(b=>b.kind==='wall'&&b.hp>0&&b.hp<b.max&&Math.abs(n.x-b.x)<500);if(damaged){move(n,damaged.x);if(Math.abs(n.x-damaged.x)<35)damaged.hp=Math.min(damaged.max,damaged.hp+4*dt);}else move(n,this.night?n.side*260:-300+(n.id%8)*80);}}
 if(n.role==='farmer'){const farms=s.buildings.filter(b=>b.kind==='farm'&&b.level);const farm=farms[n.id%Math.max(1,farms.length)];if(farm&&!this.night){move(n,farm.x+(n.id%4)*18);if(n.timer>12){n.carry+=3*farm.level;n.timer=0;}}else move(n,n.side*240);}
 if(n.role==='hunter'||n.role==='captain'){if(n.attack){const portal=s.buildings.find(b=>b.kind==='portal'&&Math.sign(b.x)===n.side&&b.hp>0);if(!portal){n.attack=false;move(n,n.side*300);}else{move(n,portal.x-n.side*(n.role==='hunter'?170:55),55);if(Math.abs(n.x-portal.x)<220&&n.shot<=0){n.shot=n.role==='hunter'?.8:1.3;portal.hp-=n.role==='hunter'?7:12;s.effects.push({x:portal.x,y:GROUND-45,life:.2,type:'hit'});if(portal.hp<=0){this.emit((n.side<0?'西':'东')+'方据点被摧毁，小心反击！');s.retaliation.push({side:n.side,left:3});s.kills++;for(const a of s.npcs.filter(a=>a.side===n.side))a.attack=false;this.save();}}}}
 else{const bound=this.boundary(n.side);const dest=this.night?bound-n.side*(45+(n.id%5)*17):bound+n.side*(80+(n.id%4)*45);move(n,dest);if(!this.night&&n.role==='hunter'&&n.timer>10){n.carry+=1;n.timer=0;}}
 if(n.role==='hunter'){const enemy=s.enemies.filter(e=>e.hp>0&&Math.abs(e.x-n.x)<300).sort((a,b)=>Math.abs(a.x-n.x)-Math.abs(b.x-n.x))[0];if(enemy&&n.shot<=0){n.shot=1;this.shoot(n.x,enemy.x,7,'friendly',GROUND-35);}}}
 if(n.carry>0&&Math.abs(n.x-p.x)<100&&p.fly<12){this.drop(n.x,n.carry);n.carry=0;}if(n.carry>8){move(n,n.side*200);if(Math.abs(n.x-n.side*200)<25){this.drop(n.x,n.carry);n.carry=0;}}
 }
 s.npcs=s.npcs.filter(n=>n.hp>0);}
 spawnWave(side=null,retaliation=false){const s=this.state;const count=retaliation?6+s.day:Math.min(18,2+Math.floor(s.day*1.5));const sides=side?[side]:[-1,1];for(const dir of sides){if(!retaliation&&!s.buildings.some(b=>b.kind==='portal'&&Math.sign(b.x)===dir&&b.hp>0))continue;for(let i=0;i<count;i++){const type=s.day>3&&i%5===0?'ranged':s.day>2&&i%4===0?'heavy':'small';s.enemies.push({id:s.nid++,x:dir*(Math.max(1450,Math.abs(this.boundary(dir))+650)+i*43),side:dir,type,hp:type==='heavy'?60:type==='ranged'?25:20,shot:i*.1,loot:false,anim:this.rand()*5});}}s.waves++;this.emit(retaliation?'讨伐联军发动反击！':'讨伐联军夜袭将至，守住两侧城墙！');}
 updateEnemies(dt){const s=this.state,p=s.player;for(const e of s.enemies){if(e.hp<=0)continue;e.anim+=dt;e.shot-=dt;if(e.loot||s.crown?.carrier===e.id){e.x+=e.side*105*dt;continue;}const walls=s.buildings.filter(b=>b.kind==='wall'&&b.hp>0&&Math.sign(b.x)===e.side&&Math.abs(b.x)<Math.abs(e.x)+20).sort((a,b)=>Math.abs(b.x)-Math.abs(a.x));const wall=walls[0];let stopped=false;
 if(wall&&Math.abs(e.x-wall.x)<(e.type==='ranged'?160:30)){stopped=true;if(e.shot<=0){e.shot=e.type==='heavy'?1.3:1;wall.hp=Math.max(0,wall.hp-(e.type==='heavy'?13:5));s.effects.push({x:wall.x,y:GROUND-35,life:.15,type:'hit'});if(wall.hp===0){this.emit('一侧城墙被突破！');this.save();}}}
 if(e.type==='ranged'&&Math.abs(e.x-p.x)<250&&e.shot<=0){e.shot=1.8;this.shoot(e.x,p.x,1,'enemy',GROUND-45);}
 if(!stopped)e.x-=e.side*(e.type==='heavy'?58:83)*dt;
 const coin=s.coins.find(c=>c.value>0&&Math.abs(c.x-e.x)<22);if(coin){coin.value--;e.loot=true;continue;}
 if(Math.abs(e.x-p.x)<34&&p.fly<28&&p.hit<=0)this.hitPlayer(e);
 const npc=s.npcs.find(n=>Math.abs(n.x-e.x)<23);if(npc&&e.shot<=0){e.shot=1.2;if(npc.role==='captain'){npc.hp-=6;e.hp-=9;}else if(npc.role!=='idle'){s.tools[npc.role]=(s.tools[npc.role]||0)+1;npc.role='idle';npc.x-=e.side*75;npc.attack=false;}else npc.x-=e.side*80;}
 if(Math.abs(e.x)>3100)e.hp=0;
 }const dead=s.enemies.filter(e=>e.hp<=0);for(const e of dead){s.kills++;if(this.rand()<.6)this.drop(e.x,1);if(s.crown?.carrier===e.id)s.crown.carrier=null;}s.enemies=s.enemies.filter(e=>e.hp>0&&Math.abs(e.x)<3150);}
 hitPlayer(e){const s=this.state,p=s.player;p.hit=1.5;if(s.gold>0){const n=Math.min(s.gold,3);s.adInBag=Math.max(0,s.adInBag-Math.max(0,n-(s.gold-s.adInBag)));s.gold-=n;for(let i=0;i<n;i++)this.drop(p.x+(i-1)*30,1);e.loot=true;this.emit('金币被抢走了，快回防线！');}else if(!s.crown){s.crown={x:p.x,carrier:e.id};this.emit('王冠被夺走，快追上它！');}else if(!s.crown.carrier){s.crown.carrier=e.id;}}
 shoot(x,to,damage,team,y){this.state.shots.push({id:this.state.nid++,x,y,dir:Math.sign(to-x)||1,damage,team,life:1.5});}
 updateShots(dt){const s=this.state;for(const a of s.shots){a.life-=dt;a.x+=a.dir*390*dt;if(a.team==='friendly'){const e=s.enemies.find(e=>e.hp>0&&Math.abs(e.x-a.x)<25);if(e){e.hp-=a.damage;a.life=0;}}else if(Math.abs(a.x-s.player.x)<25&&s.player.hit<=0){this.hitPlayer({id:0,loot:false});a.life=0;}}
 s.shots=s.shots.filter(a=>a.life>0);}
 snapshot(){return JSON.parse(JSON.stringify({global:this.global,world:this.state}));}
}

// Versioned local archive with last known-good fallback. No network or cloud claim.
export class Archive{
 constructor(storage){this.storage=storage;this.key='goblin-monarch-v1';this.error=null;}
 load(){for(const key of [this.key,this.key+'-backup']){try{const raw=this.storage.getItem(key);if(!raw)continue;const e=JSON.parse(raw);if(e.version!==1||!e.data?.global||!e.data?.world)throw Error('存档版本不支持');const checksum=this.hash(JSON.stringify(e.data));if(checksum!==e.checksum)throw Error('存档校验失败');return e.data;}catch(e){this.error=e.message;}}return null;}
 hash(str){let h=2166136261;for(let i=0;i<str.length;i++){h^=str.charCodeAt(i);h=Math.imul(h,16777619);}return h>>>0;}
 save(game){try{const data=game.snapshot(),body=JSON.stringify(data),payload=JSON.stringify({version:1,checksum:this.hash(body),data});const old=this.storage.getItem(this.key);if(old){try{const e=JSON.parse(old);if(e.checksum===this.hash(JSON.stringify(e.data)))this.storage.setItem(this.key+'-backup',old);}catch{}}this.storage.setItem(this.key,payload);this.error=null;return true;}catch(e){this.error='无法保存本地进度：'+e.message;return false;}}
 clear(){this.storage.removeItem(this.key);this.storage.removeItem(this.key+'-backup');}
}
