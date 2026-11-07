import { State } from './State';
import { RULES } from './Rules';

/** 老试玩档只迁移布局，不抹掉金币、职业、主厅或已攻占状态。 */
export function upgradeWorld(s:State):void{
    s.gearDrops ||= [];s.fortifications ||= [];
    s.recruitment ||= {start:s.elapsed,limit:2,count:0,next:s.elapsed+95};
    s.trader.phase ||= s.trader.present?'trading':'away';s.trader.prevX=s.trader.x;
    if((s.revision||0)>=10)return;
    const old=[2500,3100,5100,7300,9600,12200,12550],fresh=[2500,...RULES.camps.map(c=>c.x),RULES.worldMax];
    const remap=(x:number)=>{if(x<=old[0])return x;for(let i=1;i<old.length;i++)if(x<=old[i])return fresh[i-1]+(x-old[i-1])/(old[i]-old[i-1])*(fresh[i]-fresh[i-1]);return Math.min(RULES.worldMax,x);};
    s.player.x=remap(s.player.x);
    for(const n of s.goblins){n.x=remap(n.x);n.targetX=remap(n.targetX);}
    for(const e of s.enemies)e.x=remap(e.x);
    for(const m of s.machines)m.x=remap(m.x);
    for(const c of s.coins)c.x=remap(c.x);
    for(const a of s.animals){a.x=remap(a.x);a.home=remap(a.home);}
    const base:Record<string,number>={prison:700,gear:910,forge:1050,worker:1200,hunter:1345,brute:1490,lure:1640};
    for(const b of s.buildings){
        if(b.region>=0)b.x=RULES.camps[b.region].x+(b.kind==='wall'||b.kind==='tower'?[780,880,940,1000,-185][b.region]-(b.kind==='tower'?100:0):b.kind==='farm'?490+b.region*40:320+b.region*30);
        else if(base[b.kind]!==undefined)b.x=base[b.kind];
    }
    for(const c of s.camps)c.x=RULES.camps[c.index].x;
    for(const [kind,x] of [['wall',3250],['tower',3150],['wood',2760],['farm',2980],['wall',4250],['tower',4150],['mine',3700]] as [string,number][])
        s.buildings.push({id:s.nextId++,kind,x,level:0,hp:0,maxHp:0,region:-2,stock:0,timer:0});
    s.shots=[];s.effects=[];s.revision=10;
}
