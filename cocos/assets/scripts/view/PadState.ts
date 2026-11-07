export type PadButton='confirm'|'cancel'|'secondary'|'cycle'|'sprint'|'home'|'pause'|'help';
export interface PadSnapshot { id:number; x:number;y:number;buttons:Record<PadButton,boolean> }
/** 与引擎解耦的手柄边沿、死区及菜单连移。切换菜单后必须松手，防止确认键穿透为投币。 */
export class PadState {
    connected=false;id=-1;x=0;y=0;down=new Set<PadButton>();pressed=new Set<PadButton>();released=new Set<PadButton>();
    blocked=false; private menuClock=0;private menuSign=0;
    reset():void{this.blocked=true;this.x=this.y=0;this.down.clear();this.pressed.clear();this.released.clear();}
    sample(snapshot:PadSnapshot|undefined):boolean{
        const lost=this.connected&&(!snapshot||snapshot.id!==this.id);
        this.connected=!!snapshot;this.id=snapshot?.id??-1;this.pressed.clear();this.released.clear();
        if(!snapshot){for(const key of Array.from(this.down))this.released.add(key);this.down.clear();this.x=this.y=0;this.blocked=false;return lost;}
        const axis=(n:number)=>Math.abs(n)<.22?0:Math.sign(n)*Math.min(1,(Math.abs(n)-.22)/.78);
        this.x=axis(snapshot.x);this.y=axis(snapshot.y);
        const next=new Set((Object.keys(snapshot.buttons) as PadButton[]).filter(k=>snapshot.buttons[k]));
        if(this.blocked){if(!next.size&&!this.x&&!this.y)this.blocked=false;this.x=this.y=0;return lost;}
        for(const key of Array.from(next))if(!this.down.has(key))this.pressed.add(key);
        for(const key of Array.from(this.down))if(!next.has(key))this.released.add(key);
        this.down=next;return lost;
    }
    menuStep(dt:number):number{
        const sign=Math.abs(this.y)>.5?Math.sign(-this.y):0;
        if(!sign){this.menuSign=0;this.menuClock=0;return 0;}
        if(sign!==this.menuSign){this.menuSign=sign;this.menuClock=.35;return sign;}
        this.menuClock-=dt;if(this.menuClock<=0){this.menuClock=.14;return sign;}return 0;
    }
}
