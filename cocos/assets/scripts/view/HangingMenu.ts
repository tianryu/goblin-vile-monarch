import { Color } from 'cc';
import { GameModel } from '../model/GameModel';
import { Platform } from '../platform/Platform';
import { GameView } from './GameView';
import { getLanguage } from '../i18n/Locale';

type Kind='main'|'pause';
type Phase='opening'|'open'|'closing'|'exit-ready'|'closed';
type Choice='continue'|'new'|'sound'|'language'|'home';
type ExitChoice='continue'|'new'|'home';
interface Item { id:Choice;label:string;disabled?:boolean }
export type MenuButton=(key:string,x:number,y:number,width:number,height:number,enabled:boolean,callback:()=>void)=>void;
const lerp=(a:number,b:number,t:number)=>a+(b-a)*t;
const out=(t:number)=>1-Math.pow(1-Math.max(0,Math.min(1,t)),3);

/** 统一吊牌的动画与暂停门闩，菜单退场完成一帧后才放行世界逻辑。 */
export class HangingMenu {
    kind:Kind='main';
    phase:Phase='closed';
    offset=-560;
    alpha=0;
    private clock=0;
    private fromOffset=-560;
    private fromAlpha=0;
    private pending:ExitChoice='continue';
    private hasSave:boolean;
    private confirmNew = false;
    private credits = false;
    private panelSwap = 0;
    onCommit?:(action:Choice)=>void;
    onSoundChanged?:(enabled:boolean)=>void;
    onPlayRequested?:()=>void;
    constructor(private model:GameModel,private platform:Platform,hasSave:boolean){this.hasSave=hasSave;this.open('main');}
    get blocks():boolean{return this.phase!=='closed';}
    get hidesHud():boolean{return this.blocks&&this.kind==='main';}
    private get height():number{return 580;}
    private items():Item[]{
        const resume: Item = { id: 'continue', label: '继续游戏' };
        const sound:Item={id:'sound',label:this.platform.soundEnabled?'声音：开':'声音：关'};
        const language:Item={id:'language',label:getLanguage()==='en'?'Language: English':'语言：简体中文'};
        return this.kind === 'main'
            ? [{ ...resume, disabled: !this.hasSave || this.model.state.status === 'won' }, { id: 'new', label: '新的征程' }, language, sound]
            : [resume, language, sound, { id: 'home', label: '主菜单' }];
    }
    /** 暂停立即生效；快速反向切换保留当前位移和透明度，不跳回起点。 */
    open(kind:Kind):void{
        const same=this.blocks&&this.kind===kind;
        this.confirmNew = false;
        this.credits = false;
        this.panelSwap = 0;
        this.kind=kind;this.clock=0;this.fromOffset=same?this.offset:-this.height-40;this.fromAlpha=same?this.alpha:0;
        this.offset=this.fromOffset;this.alpha=this.fromAlpha;this.phase='opening';
        this.model.cancelPledge();this.model.pause('menu',true);
    }
    togglePause():void{
        if (this.confirmNew) { this.showNewConfirmation(false); return; }
        if (this.credits) { this.showCredits(false); return; }
        if(this.model.state.status!=='playing'&&this.phase==='closed')return;
        if(this.phase==='closed')this.open('pause');
        else if(this.kind==='pause'&&(this.phase==='closing'||this.phase==='exit-ready'))this.open('pause');
        else if(this.kind==='pause')this.close('continue');
    }
    close(choice:ExitChoice):void{
        if(!this.blocks||this.phase==='closing'||this.phase==='exit-ready')return;
        if (choice === 'new' || choice === 'continue') this.onPlayRequested?.();
        this.pending=choice;this.fromOffset=this.offset;this.fromAlpha=this.alpha;this.clock=0;this.phase='closing';
        this.model.pause('menu',true);
    }
    private choose(item:Item):void{
        if(this.phase!=='open'||item.disabled)return;
        if(item.id==='sound'){this.platform.setSoundEnabled(!this.platform.soundEnabled);this.onSoundChanged?.(this.platform.soundEnabled);return;}
        if(item.id==='language'){this.platform.setLanguage(getLanguage()==='en'?'zh-CN':'en');return;}
        if (item.id === 'new' && this.hasSave) { this.showNewConfirmation(true); return; }
        this.close(item.id);
    }
    private showNewConfirmation(visible: boolean): void {
        this.confirmNew = visible;
        this.panelSwap = .15;
    }
    private showCredits(visible: boolean): void {
        this.credits = visible;
        this.panelSwap = .15;
    }
    /** UI使用真实帧时钟；世界暂停时仍能完成显隐与绳吊位移。 */
    update(dt:number):void{
        if (this.panelSwap > 0) this.panelSwap = Math.max(0, this.panelSwap - dt);
        if(this.phase==='closed'||this.phase==='open'||this.phase==='exit-ready')return;
        this.clock+=dt;
        if(this.phase==='opening'){
            const t=Math.min(1,this.clock/.42);
            this.offset=t<.8?lerp(this.fromOffset,6,out(t/.8)):6*(1-out((t-.8)/.2));
            this.alpha=lerp(this.fromAlpha,1,Math.min(1,t/.65));
            if(t>=1){this.offset=0;this.alpha=1;this.phase='open';}
        }else{
            const t=Math.min(1,this.clock/.4),hop=Math.abs(this.fromOffset)<3&&this.fromAlpha>.95;
            this.offset=hop&&t<.15?lerp(this.fromOffset,7,t/.15):lerp(hop?7:this.fromOffset,-this.height-40,Math.pow(Math.max(0,(t-(hop?.15:0))/(hop?.85:1)),3));
            this.alpha=lerp(this.fromAlpha,0,t*t);
            if(t>=1){this.offset=-this.height-40;this.alpha=0;this.phase='exit-ready';}
        }
    }
    render(view:GameView,button:MenuButton):void{
        if(!this.blocks)return;
        const p=view.painter,W=view.width,H=view.height,x=W-300,y=this.offset,a=this.alpha;
        p.sprite('menuVeil','ui_panel_v5',W/2,H+100,H+200,{layer:13,width:W+200,tint:new Color(0,0,0),alpha:a*(this.kind==='pause'?.34:.15)});
        p.sprite('hangingMenu','hanging_menu',x,this.height+y,this.height,{layer:13,width:420,alpha:a,anchorX:.5,anchorY:0});
        if (this.panelSwap > 0) return;
        if (this.credits) {
            p.text('creditsHeading','制作与鸣谢',x,136+y,27,{layer:13,alpha:a});
            // AI 图片来源独立成段，随鸣谢吊牌一起过渡。
            p.text('creditsAiHeading','AI 生成声明',x,185+y,21,{layer:13,alpha:a});
            p.text('creditsAiNotice','图片素材都由\nOpenAI ImageGen 生成',x,221+y,18,{layer:13,alpha:a});
            const lines = [
                '游戏开发  五方', '界面字体  霞鹜文楷（OFL）', '音乐  RandomMind',
                '音乐  Cleyton Kauffman', '战鼓  William Hector',
                '音效  Kenney、StarNinjas', '录音  Freesound 作者',
            ];
            for (const [index,line] of lines.entries()) p.text('creditsLine'+index,line,x,268+y+index*27,18,{layer:13,alpha:a});
            button('menu:credits:back',x,493+y,255,56,this.phase==='open',()=>this.showCredits(false));
            p.text('creditsBack','返回',x,493+y,24,{layer:13,alpha:a});
            return;
        }
        if (this.confirmNew) {
            p.text('newSaveTitle', '开启新的征程', x, 144+y, 29, {layer:13,alpha:a});
            p.text('newSaveWarning', '旧战役存档将被覆盖', x, 214+y, 22, {layer:13,alpha:a});
            const enabled = this.phase === 'open';
            button('menu:newConfirm',x,300+y,292,64,enabled,()=>this.close('new'));
            button('menu:newCancel',x,378+y,292,64,enabled,()=>this.showNewConfirmation(false));
            p.text('newSaveConfirm', '确认开启', x, 300+y, 26, {layer:13,alpha:a});
            p.text('newSaveCancel', '取消', x, 378+y, 26, {layer:13,alpha:a});
            return;
        }
        if (this.kind==='main') p.sprite('menuHeadingArt',getLanguage()==='en'?'title_wordmark_en':'title_wordmark',x,143+y,94,{layer:13,anchorY:.5,alpha:a});
        else p.text('menuHeading','暂停',x,128+y,32,{layer:13,alpha:a});
        for(const [i,item]of this.items().entries()){
            const cy = (this.kind === 'main' ? 242 : 222) + i * 78 + y;
            button('menu:'+this.kind+':'+item.id,x,cy,292,64,this.phase==='open'&&!item.disabled,()=>this.choose(item));
            p.text('menuLabel:'+this.kind+':'+item.id,item.label,x,cy,26,{layer:13,width:276,alpha:a*(item.disabled?.58:1)});
        }
        if (this.kind === 'main') {
            button('menu:main:credits',x,559+y,142,30,this.phase==='open',()=>this.showCredits(true));
            p.text('creditsLink','制作与鸣谢',x,559+y,17,{layer:13,alpha:a});
        }
    }
    /** 最终离屏姿态已交给显示层后才执行一次动作，旧节点淡出时已在屏幕外。 */
    afterRender():void{
        if(this.phase!=='exit-ready')return;
        const action=this.pending;
        if(action==='home'){this.onCommit?.(action);this.hasSave=true;this.open('main');return;}
        if(action==='new'){this.model.restart();this.hasSave=true;}
        this.onCommit?.(action);
        this.confirmNew = false;
        this.phase='closed';this.model.pause('menu',false);
    }
}
