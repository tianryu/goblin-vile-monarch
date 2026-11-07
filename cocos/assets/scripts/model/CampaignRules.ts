import {RULES,HEROES,EnemyKind,MachineKind} from './Rules';
export interface Soldier {id:number;kind:EnemyKind;hero?:string;sourceCamp:number;hpRatio?:number;readyAt?:number}
export interface UnitSpec {kind:EnemyKind;hero?:string}
/** 战役强度唯一入口，参数只有全局天数，不接受营地或主厅进度。 */
export function enemyFactor(day:number):number{return 1+.05*Math.min(20,Math.floor(Math.max(1,day)/5));}
export function raidCount(day:number):number{
 const d=Math.max(1,Math.floor(day));
 if(d<RULES.enemySortieStartDay)return 0;
 // 首战三人，第三、四天逐步增加，再接回第五天的原编制。
 if(d<5)return 3+2*(d-RULES.enemySortieStartDay);
 return d<=20?6+2*Math.floor((d-1)/2):Math.min(60,24+3*Math.floor((d-20)/3));
}
export const GUARD_ROSTERS:Record<string,number>[]=[
 {human:10,elf:5}, {human:12,elf:6,jumper:4,dwarf:1,heavy:1},
 {shield:10,elf:8,dwarf:8,jumper:6,mage:2,bulwark:1,longbow:1},
 {shield:12,dwarf:10,elf:12,mage:10,jumper:2,engineer:1,siege_boss:1},
 {shield:8,dwarf:5,mage:5,elf:8,pyromancer:1,fleet_boss:1}
];
export const OPENING_FIELD:Record<string,number>[]=[{human:8,elf:4},{human:8,elf:6,jumper:4,dwarf:2},{shield:12,elf:8,dwarf:6,jumper:4},{shield:14,mage:10,elf:8,dwarf:4,jumper:4},{shield:6,mage:6,dwarf:3,jumper:3,elf:2}];
export const FORTS=[{walls:0,levels:[]},{walls:0,levels:[]},{walls:1,levels:[1,1]},{walls:3,levels:[3,2,2]},{walls:2,levels:[2,2,2,2]}];
export function guardCapacity(index:number,day:number):number{return RULES.camps[index].total+Math.min(3,Math.floor(Math.max(0,day)/15));}
export function unitSpec(key:string):UnitSpec{return HEROES[key]?{kind:HEROES[key].kind,hero:key}:{kind:key as EnemyKind};}
export function expandRoster(roster:Record<string,number>):UnitSpec[]{const out:UnitSpec[]=[];for(const key of Object.keys(roster))for(let i=0;i<roster[key];i++)out.push(unitSpec(key));return out;}
/** 塔手和驻营精锐先就位，其余按职业交错，避免十六名盾兵堵住全部活跃位。 */
export function guardSpecs(index:number):UnitSpec[]{
 const all=expandRoster(GUARD_ROSTERS[index]),out:UnitSpec[]=[];
 for(let i=0;i<FORTS[index].levels.reduce((a,b)=>a+b,0);i++){const n=all.findIndex(u=>u.kind==='elf'&&!u.hero);if(n>=0)out.push(all.splice(n,1)[0]);}
 for(let i=all.length-1;i>=0;i--)if(all[i].hero)out.push(all.splice(i,1)[0]);
 const kinds=['shield','human','dwarf','elf','mage','jumper'];while(all.length)for(const kind of kinds){const n=all.findIndex(u=>u.kind===kind);if(n>=0)out.push(all.splice(n,1)[0]);}
 return out;
}
/** 整数配额使用最大余数法；精锐占人头，不在普通兵预算外加人。 */
export function raidPlan(day:number):{day:number;units:UnitSpec[];engines:MachineKind[];eliteBudget:number}{
 const count=raidCount(day),budget=Math.min(Math.floor(count/2),Math.floor(day/5));
 const weights:Record<string,number>=day>=30?{shield:30,mage:30,dwarf:15,jumper:15,elf:10}:day>=20?{shield:35,mage:25,elf:20,dwarf:10,jumper:10}:day>=10?{shield:40,elf:25,dwarf:20,jumper:15}:day>=5?{human:40,elf:30,jumper:20,dwarf:10}:{human:70,elf:30};
 const choices=day>=20?['heavy','longbow','bulwark','charger','engineer','pyromancer']:day>=15?['heavy','longbow','bulwark','charger','engineer']:day>=10?['heavy','longbow','bulwark','charger']:['heavy'];
 const strong:UnitSpec[]=[];let slots=budget;
 if(day>=20&&slots>=2){strong.push(unitSpec(day>=25&&day%2?'fire_boss':'siege_boss'));slots-=2;}
 for(let i=0;i<slots;i++)strong.push(unitSpec(choices[(Math.floor(day/5)-1+i)%choices.length]));
 const ordinary=count-strong.length,quotas=Object.keys(weights).map((key,i)=>({key,i,n:Math.floor(ordinary*weights[key]/100),fraction:ordinary*weights[key]/100%1}));
 let missing=ordinary-quotas.reduce((a,b)=>a+b.n,0);for(const q of quotas.slice().sort((a,b)=>b.fraction-a.fraction||a.i-b.i)){if(missing-->0)q.n++;}
 const normal:UnitSpec[]=[];while(quotas.some(q=>q.n>0))for(const q of quotas)if(q.n-->0)normal.push(unitSpec(q.key));
 // 按固定间距插入，保证强力队不会全部挤在首批。
 const spread:UnitSpec[]=[];let k=0;
 for(let i=0;i<count;i++)spread.push(k<strong.length&&i===Math.floor(k*count/strong.length)?strong[k++]:normal.shift()!);
 const engines:MachineKind[]=day>=30?['firecatapult','catapult']:day>=20?['firecatapult']:day>=15?['catapult']:day>=10?['ram']:[];
 return{day,units:spread,engines,eliteBudget:budget};
}
