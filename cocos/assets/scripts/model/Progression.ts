import {State,Building} from './State';
import {RULES,HEROES,BUILDINGS} from './Rules';
/** 装备只有三级，主厅成长另算；不是把五级索引直接用于三档装备数组。 */
export function forgeGate(next:number):number{return [0,1,3,5][next]||5;}
/** 箭台各层的站位与发射高度共用，不让猎手浮在两层踏板之间。 */
export function towerSpot(level:number,index:number):{x:number;height:number}{
 const floors=[[],[125],[140],[159,90],[172,92],[196,130,74]][level]||[125];
 const offsets=[[],[0],[0],[-8,8],[-28,24],[-28,18,10]][level]||[0];
 return{x:offsets[index]||0,height:floors[index]||floors[0]};
}
export function upgradeAllowed(s:State,b:Building):boolean{
 const hall=s.buildings.find(n=>n.kind==='hall')!,next=b.level+1;
 if(b.kind==='hall')return next<=2||!!s.camps[next-3]?.rewarded;
 return hall.level>=(b.kind==='forge'?forgeGate(next):next);
}
/** 新规则保留旧档已获得的科技和单位，不清空存档、不吞掉超上限人口。 */
export function upgradeProgression(s:State):void{
 s.battleCoinProgress??=0;for(const c of s.camps)c.frontierSince??=c.index===0?1:s.day;
 if((s.revision||0)>=11)return;
 const map=[0,1,3,5],aliases:Record<string,string>={david:'heavy',durin:'heavy',sylva:'longbow',leona:'bulwark',barok:'engineer',alden:'pyromancer',roland:'fleet_boss'};
 for(const b of s.buildings){if(['hall','wall','tower','prison','lure','farm','wood','mine'].includes(b.kind)){b.level=map[b.level]||b.level;if(b.job)b.job.next=map[b.job.next]||b.job.next;}}
 // 旧军旗的一、二级分别容纳八、十二人，映射到新三级、五级，不把已解锁编制缩水。
 const flag=s.buildings.find(b=>b.kind==='flag');if(flag){flag.level=[0,3,5][flag.level]||flag.level;if(flag.job)flag.job.next=[0,3,5][flag.job.next]||flag.job.next;}
 for(const b of s.buildings)if(b.region===-1&&['wall','tower','net','rock','farm'].includes(b.kind))b.x=({wall:2100,tower:2000,net:2200,rock:2300,farm:1800}as Record<string,number>)[b.kind];
 const hall=s.buildings.find(b=>b.kind==='hall')!;
 for(const b of s.buildings){if(b.kind==='forge'&&b.level>=2)hall.level=Math.max(hall.level,forgeGate(b.level));}
 // 新血量按旧损伤比例迁移，废墟仍是废墟，不把更新当免费维修。
 for(const b of s.buildings){const hp=RULES_BUILDING_HP(b.kind,b.level);if(hp){const ratio=b.maxHp>0?b.hp/b.maxHp:1;b.maxHp=hp;b.hp=hp*ratio;}}
 for(const e of s.enemies)if(e.hero){e.hero=aliases[e.hero]||e.hero;const h=HEROES[e.hero];if(h){const ratio=e.hp/Math.max(1,e.maxHp);e.kind=h.kind;e.maxHp=h.hp;e.hp=h.hp*ratio;e.bodyHeight=h.height;}}
 for(const c of s.camps)c.heroesPending=c.heroesPending?.map(key=>aliases[key]||key);
 s.recruitment={start:s.elapsed,limit:1,count:0,next:s.elapsed+125};s.revision=11;
}
function RULES_BUILDING_HP(kind:string,level:number):number|undefined{return BUILDINGS[kind]?.hp?.[level];}
