import { State } from './State';
import { RULES,HEROES,clamp } from './Rules';
import { enemyFactor } from './CampaignRules';

/** 同一套布局用于新局与旧档，只平移拥挤地段，不重置财富、职业或占领。 */
export function upgradeHorde(s:State):void{
    s.trader.cargo??=[];
    if((s.revision||0)>=13)return;
    const old=[0,1050,1200,1345,1490,1640,1800,2000,2100,2200,2300,2550,2760,2980,3150,3250,3700,4150,4250,6500];
    const fresh=[0,1050,1200,1400,1600,1820,2050,2520,2880,3220,3520,3830,4110,4390,4650,5010,5480,5790,6150,6500];
    const map=(x:number)=>{if(x<=0||x>=6500)return x;for(let i=1;i<old.length;i++)if(x<=old[i])return fresh[i-1]+(x-old[i-1])/(old[i]-old[i-1])*(fresh[i]-fresh[i-1]);return x;};
    s.player.x=map(s.player.x);s.player.prevX=s.player.x;s.player.attackCooldown=0;
    for(const n of s.goblins){
        n.x=map(n.x);n.prevX=n.x;n.targetX=map(n.targetX);
        n.roamX=undefined;
        const ratio=clamp(n.hp/Math.max(1,n.maxHp),0,1),factor=RULES.hallFactor[s.buildings.find(b=>b.kind==='hall')!.level||1]*(1+RULES.equipmentBonus[clamp(n.gear||0,0,3)]);
        n.maxHp=RULES.role[n.role].hp*factor;n.hp=n.dead?0:n.maxHp*ratio;
    }
    for(const e of s.enemies){
        e.x=map(e.x);e.prevX=e.x;e.roamX=undefined;
        if(e.windup)e.windup.targetX=map(e.windup.targetX);if(e.jump){e.jump.from=map(e.jump.from);e.jump.to=map(e.jump.to);}
        const ratio=clamp(e.hp/Math.max(1,e.maxHp),0,1);e.scale=enemyFactor(s.day);e.maxHp=(HEROES[e.hero||'']?.hp||RULES.enemy[e.kind].hp)*e.scale;e.hp=e.maxHp*ratio;
    }
    for(const b of s.buildings){
        if(b.region>=0){const wall=RULES.camps[b.region].x+[780,880,940,1000,-185][b.region];b.x=wall-(b.kind==='tower'?360:b.kind==='farm'?820:b.kind==='wood'||b.kind==='mine'?1130:0);}
        else b.x=map(b.x);
    }
    for(const m of s.machines){m.x=map(m.x);m.prevX=m.x;}
    for(const c of s.coins)c.x=map(c.x);for(const d of s.gearDrops||[])d.x=map(d.x);
    for(const a of s.animals){a.x=map(a.x);a.home=map(a.home);}for(const f of s.effects)f.x=map(f.x);
    for(const shot of s.shots){shot.x=map(shot.x);shot.fromX=map(shot.fromX);shot.targetX=map(shot.targetX);}
    // 尚未出发的旧编制归还同一储备账，按新日期表重排；已交战队伍和真实守军不凭空消失。
    if(s.raidPrep&&s.army){s.army.reserve.push(...s.raidPrep.units);s.raidPrep=undefined;}
    s.recruitment={start:s.elapsed,limit:2,count:0,next:s.elapsed+60};
    s.revision=13;
}

/** 护甲提高生命、攻击与防御；减伤封顶，避免成熟单位让普通攻击永远只扣一点。 */
export function armoredDamage(attack:number,defense:number):number{
    return Math.max(1,attack*Math.max(.55,10/(10+Math.max(0,defense))));
}
