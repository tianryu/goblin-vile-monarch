import { RULES, Mount, clamp } from './Rules';
import type { State } from './State';
import { PC_MOUNT_PRICES } from './DesktopRules';

export interface MountVisit {
    phase: 'away'|'arriving'|'trading'|'leaving';
    x: number; prevX: number; visitDay: number; offer: Mount; sold: boolean;
}
export const MOUNT_TRADER_ID = -120;
export const MOUNT_VISIT = { firstDay:2, interval:6, morningEnd:35, departAt:108, stopX:1870, travel:1050, speed:150 };
const STOCK:Mount[]=['lizard','wolf','bat','boar'];

/** 固定轮换保证相邻两次不同，报价在到访时确定，不消耗战斗随机数。 */
export function updateMountTrader(s:State,dt:number): void {
    const t=s.mountTrader!;
    t.prevX=t.x;
    if(t.phase==='away'){
        if(s.day>=MOUNT_VISIT.firstDay&&(s.day-MOUNT_VISIT.firstDay)%MOUNT_VISIT.interval===0&&s.time<MOUNT_VISIT.morningEnd&&t.visitDay!==s.day){
            // 按上次商品轮换，旧两天周期的存档也不会在下次到访时重复商品。
            t.offer=STOCK[t.visitDay>0?(STOCK.indexOf(t.offer)+1)%STOCK.length:0];
            t.visitDay=s.day;t.sold=false;t.phase='arriving';t.x=t.prevX=MOUNT_VISIT.stopX+MOUNT_VISIT.travel;
        }
    }else if(t.phase==='arriving'){
        t.x+=clamp(MOUNT_VISIT.stopX-t.x,-MOUNT_VISIT.speed*dt,MOUNT_VISIT.speed*dt);
        if(Math.abs(t.x-MOUNT_VISIT.stopX)<.01)t.phase='trading';
    }else if(t.phase==='trading'){
        if(s.day>t.visitDay||s.time>=MOUNT_VISIT.departAt)t.phase='leaving';
    }else{
        t.x+=MOUNT_VISIT.speed*dt;
        if(t.x>=MOUNT_VISIT.stopX+MOUNT_VISIT.travel)t.phase='away';
    }
}
/** 业务层重新校验距离、当期商品及营业状态。已拥有坐骑只免费更换，不重复买。 */
export function canBuyMount(s:State,mount:Mount): boolean {
    const t=s.mountTrader;
    return !!t&&t.phase==='trading'&&!t.sold&&t.offer===mount&&s.day===t.visitDay&&s.time<MOUNT_VISIT.departAt&&
        Math.abs(t.x-s.player.x)<RULES.interactRange&&s.player.mount!==mount;
}
export function mountPrice(s:State): number {return s.unlockedMounts.includes(s.mountTrader!.offer)?0:PC_MOUNT_PRICES[s.mountTrader!.offer];}
