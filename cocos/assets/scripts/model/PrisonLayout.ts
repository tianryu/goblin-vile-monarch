import { Enemy } from './State';
/** 原角色站立高度贯穿倒地、绑运和关押，强力单位不会进笼后缩成普通兵。 */
export function captiveHeight(enemy:Enemy):number{return enemy.bodyHeight|| (enemy.hero?87:enemy.kind==='shield'?82:77);}
/** 模型位置与前后笼体共享分格，逃脱时从真实牢位出发。 */
export function prisonLayout(level:number,prisoners:Enemy[]){
    const tier=Math.max(1,Math.min(5,level)),cols=[0,2,4,3,4,5][tier],rows=tier>=3?2:1;
    const widths=Array(cols).fill(65),heights=Array(rows).fill(87);
    prisoners.slice(0,cols*rows).forEach((e,i)=>{widths[i%cols]=Math.max(widths[i%cols],captiveHeight(e)*.70+10);heights[Math.floor(i/cols)]=Math.max(heights[Math.floor(i/cols)],captiveHeight(e));});
    const total=widths.reduce((a,b)=>a+b,0),pitch=heights[0]+10;
    return{cols,rows,step:Math.max(...widths),pitch,width:Math.max([0,180,280,260,340,360][tier],total+24),height:Math.max(tier>=3?210:112,heights.reduce((a,b)=>a+b,0)+(rows-1)*10+18),
        slotX:(slot:number)=>widths.slice(0,slot%cols).reduce((a,b)=>a+b,0)+widths[slot%cols]/2-total/2,slotY:(slot:number)=>-10-Math.floor(slot/cols)*pitch};
}
