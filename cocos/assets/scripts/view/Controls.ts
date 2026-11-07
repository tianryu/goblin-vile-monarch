import { input, Input, EventTouch, EventKeyboard, KeyCode, Node, UITransform, Color, EventGamepad } from 'cc';
import { GameModel } from '../model/GameModel';
import { Action } from '../model/State';
import { RULES } from '../model/Rules';
import { GameView } from './GameView';
import { Platform } from '../platform/Platform';
import { HangingMenu } from './HangingMenu';
import type { ChapterView } from './ChapterView';
import { translate } from '../i18n/Locale';
import { PadState, PadSnapshot, PadButton } from './PadState';

type Command='confirm'|'cancel'|'secondary'|'cycle'|'sprint'|'home'|'pause'|'help';
const KEYS:Record<Command,string>={confirm:'E',cancel:'Q',secondary:'R',cycle:'Tab',sprint:'Shift',home:'H',pause:'Esc',help:'F1'};
const PAD:Record<Command,string>={confirm:'A',cancel:'B',secondary:'X',cycle:'Y',sprint:'LB',home:'RT',pause:'Start',help:'Back'};
interface FocusItem{key:string;x:number;y:number;width:number;height:number;callback:()=>void}

/** 键鼠和手柄复用交互事务；按键边沿、菜单焦点与游戏长按各自管理。 */
export class Controls {
    chapter?:ChapterView;
    mode:'keyboard'|'gamepad'='keyboard';
    readonly pad=new PadState();
    private keys=new Set<number>();
    private held:Action|null=null;
    private heldOwner:'keyboard'|'pad'|'mouse'='keyboard';
    private repeat=0;
    private sprintBlocked=false;
    private actionId=-1;
    private attached=new WeakMap<Node,UITransform>();
    private handlers=new Map<string,()=>void>();
    private visible=new Set<string>();
    private activeHits=new Map<string,UITransform>();
    private focus:FocusItem[]=[];
    private focusIndex=0;
    private focusPage='';
    private hint=0;
    private seenPad=false;
    private lastPadX=0;
    private lastPadY=0;
    private pads=new Map<number,EventGamepad['gamepad']>();
    private onPad=(event:EventGamepad)=>{const d=event.gamepad;if(d.connected)this.pads.set(d.deviceId,d);else this.pads.delete(d.deviceId);};
    private menuKeyFocus=false;
    private readonly blur=()=>this.release();
    constructor(public view:GameView,public model:GameModel,public platform:Platform,private saved:(immediate?:boolean)=>void,public menu:HangingMenu){
        input.on(Input.EventType.KEY_DOWN,this.keyDown,this);input.on(Input.EventType.KEY_UP,this.keyUp,this);
        if(typeof window!=='undefined')window.addEventListener('blur',this.blur);
        input.on(Input.EventType.GAMEPAD_INPUT,this.onPad,this);input.on(Input.EventType.GAMEPAD_CHANGE,this.onPad,this);
        menu.onControlsRequested=()=>this.release();
    }
    destroy():void{
        input.off(Input.EventType.GAMEPAD_INPUT,this.onPad,this);input.off(Input.EventType.GAMEPAD_CHANGE,this.onPad,this);
        input.off(Input.EventType.KEY_DOWN,this.keyDown,this);input.off(Input.EventType.KEY_UP,this.keyUp,this);
        if(typeof window!=='undefined')window.removeEventListener('blur',this.blur);
    }
    release():void{this.keys.clear();this.held=null;this.actionId=-1;this.pad.reset();this.sprintBlocked=false;this.model.input={axis:0,run:false};}
    keyLabel(command:Command):string{return(this.mode==='gamepad'?PAD:KEYS)[command];}
    private useKeyboard():void{this.mode='keyboard';this.menu.inputMode='keyboard';}
    /** 原生与浏览器都使用 Cocos 的设备接口，避免轮询浏览器 API 造成两套映射。 */
    private readPad():PadSnapshot|undefined{
        // Creator 的宽松展开编译不会展开 Map 迭代器，必须显式转成数组。
        const all=Array.from(this.pads.values());
        const d=all.find(d=>d.connected&&d.deviceId===this.pad.id)||all.find(d=>d.connected);
        if(!d)return;
        const stick=d.leftStick.getValue(),cross=d.dpad.getValue();
        const down=(name:string)=>(d as any)[name]?.getValue()>.45;
        return{id:d.deviceId,x:Math.abs(cross.x)>.5?cross.x:stick.x,y:Math.abs(cross.y)>.5?cross.y:stick.y,buttons:{
            confirm:down('buttonSouth'),cancel:down('buttonEast'),secondary:down('buttonWest'),cycle:down('buttonNorth'),
            sprint:down('buttonL1'),home:down('buttonR2'),pause:down('buttonOptions')||down('buttonStart'),help:down('buttonShare')}};
    }
    tick(dt:number):void{
        if(!this.menu.blocks&&!this.chapter?.blocks)this.hint=Math.max(0,this.hint-dt);
        const lost=this.pad.sample(this.readPad());
        if(lost){this.release();this.mode='keyboard';this.menu.inputMode='keyboard';this.model.tell('手柄已断开，可继续使用键鼠');if(!this.menu.blocks&&!this.chapter?.blocks&&this.model.state.status==='playing')this.menu.open('pause');return;}
        const axisChanged=Math.abs(this.pad.x-this.lastPadX)>.05||Math.abs(this.pad.y-this.lastPadY)>.05;
        this.lastPadX=this.pad.x;this.lastPadY=this.pad.y;
        if(this.pad.pressed.size||axisChanged&&(this.pad.x!==0||this.pad.y!==0)){
            this.mode='gamepad';this.menu.inputMode='gamepad';
            if(!this.seenPad){this.seenPad=true;this.hint=7;}
        }
        for(const key of Array.from(this.pad.released))if(['confirm','cancel','secondary'].includes(key)&&this.heldOwner==='pad')this.held=null;
        const step=this.pad.menuStep(dt);
        if(this.menu.blocks){if(step)this.navigate(step);if(this.pad.pressed.has('confirm'))this.activate();else if(this.pad.pressed.has('cancel')||this.pad.pressed.has('pause'))this.menu.togglePause();this.model.input={axis:0,run:false};this.held=null;return;}
        if(this.chapter?.blocks){if(this.pad.pressed.has('confirm'))this.chapter.director.advance();else if(this.pad.pressed.has('cancel'))this.chapter.director.advance(true);this.model.input={axis:0,run:false};return;}
        if(this.model.state.status!=='playing'){if(this.pad.pressed.has('confirm'))this.activate();return;}
        for(const key of Array.from(this.pad.pressed))if(key!=='sprint')this.command(key,'pad');
        if(this.menu.blocks||this.model.pauses.size){this.model.input={axis:0,run:false};this.held=null;return;}
        const keyboard=(this.keys.has(KeyCode.KEY_D)||this.keys.has(KeyCode.ARROW_RIGHT)?1:0)-(this.keys.has(KeyCode.KEY_A)||this.keys.has(KeyCode.ARROW_LEFT)?1:0);
        this.model.input.axis=this.mode==='gamepad'?this.pad.x:keyboard;
        const sprint=this.mode==='gamepad'?this.pad.down.has('sprint'):this.keys.has(KeyCode.SHIFT_LEFT)||this.keys.has(KeyCode.SHIFT_RIGHT);
        if(!sprint)this.sprintBlocked=false;
        if(!this.model.canSprint&&sprint)this.sprintBlocked=true;
        this.model.input.run=!!sprint&&!this.sprintBlocked&&this.model.canSprint;
        if(this.held){
            if(!this.model.context()?.actions.some(a=>a.key===this.held!.key&&!a.disabled)){this.held=null;return;}
            this.repeat-=dt;if(this.repeat<=0){this.trigger(this.held);this.repeat=this.held.type==='whip'?.48:this.held.type==='withdraw'?.14:.18;}
        }
    }
    private command(command:Command,owner:'pad'|'keyboard'):void{
        if(command==='pause'){this.release();this.menu.open('pause');return;}
        if(command==='help'){this.release();this.menu.open('pause');this.menu.showControls();return;}
        if(command==='cycle'){this.held=null;this.model.cancelPledge();this.model.cycleTarget();return;}
        if(command==='home'){if(this.model.returnHome()){this.release();this.view.camera=this.model.state.player.x;this.saved(true);}return;}
        const actions=this.model.context()?.actions||[],other=actions.filter(a=>a.type!=='whip');
        const action=command==='cancel'?actions.find(a=>a.type==='whip'):command==='confirm'?other[0]:command==='secondary'?other[1]:undefined;
        if(action&&!action.disabled){this.heldOwner=owner;this.startAction(action);}
    }
    private startAction(action:Action):void{this.held=null;this.view.activeAction=action.key;this.trigger(action);if(action.cost>0||action.type==='withdraw'||action.type==='whip'){this.held=action;this.repeat=action.type==='whip'?.48:.22;}}
    private trigger(action:Action):void{if(this.model.pauses.size)return;this.model.act(action);this.saved();}
    private navigate(direction:number):void{
        this.menuKeyFocus=true;
        if(!this.focus.length)return;
        this.focusIndex=(this.focusIndex+direction+this.focus.length)%this.focus.length;
    }
    private activate():void{this.focus[this.focusIndex]?.callback();this.saved();this.pad.reset();}
    private remember(key:string,x:number,y:number,width:number,height:number,enabled:boolean,callback:()=>void):void{
        if(!enabled)return;
        const index=this.focus.length;this.focus.push({key,x,y,width,height,callback});
        if((this.mode==='gamepad'||this.menuKeyFocus)&&index===this.focusIndex)this.view.painter.sprite('padFocus','ui_button_v5',x,y+height/2,height,{layer:13,width,tint:new Color(255,219,100),alpha:.3});
    }
    render(dt=0):void{
        this.visible.clear();this.handlers.clear();this.focus=[];
        const page=this.menu.blocks?this.menu.navPage:this.chapter?.blocks?'dialogue':this.model.state.status;
        if(page!==this.focusPage){this.focusPage=page;this.focusIndex=page==='confirm'?1:0;}
        this.draw(dt);
        if(this.focusIndex>=this.focus.length)this.focusIndex=0;
        for(const [key,hit] of this.activeHits)if(!this.handlers.has(key)){hit.node.active=false;this.activeHits.delete(key);}
    }
    private draw(dt:number):void{
        const {painter:p,width:W,height:H}=this.view;
        if(this.chapter)this.chapter.inputMode=this.mode;
        this.chapter?.guideControls(dt,!this.menu.blocks&&!this.model.pauses.size,W/2,H-56);
        const menuButton=(key:string,x:number,y:number,width:number,height:number,enabled:boolean,callback:()=>void)=>{
            this.button(key,'ui_button_v5',x,y,height,()=>{this.useKeyboard();callback();this.saved();},!enabled,true,13,width,48,1,height);
            const drawn=p.nodes.get('control:'+key+'@ui_button_v5');if(drawn&&this.menu.blocks)drawn.alpha=this.menu.alpha*(enabled?.96:.42);
            this.remember(key,x,y,width,height,enabled,callback);
        };
        if(this.menu.blocks){this.menu.render(this.view,menuButton);this.chapter?.afterButtons(dt);return;}
        if(this.chapter?.blocks){this.chapter.dialogue(menuButton);this.chapter.afterButtons(dt);return;}
        if(this.model.state.status!=='playing'){
            const x=W/2,y=H/2+(this.model.state.status==='lost'?60:75),lost=this.model.state.status==='lost';
            menuButton('resultRestart',x,y,230,50,true,()=>{this.release();if(lost)this.model.revive();else this.model.restart();this.view.camera=this.model.state.player.x;this.saved(true);});
            p.text('resultRestartLabel',lost?'整顿部落':'重新开始',x,y,24,{layer:13,width:230});return;
        }
        this.button('pause','ui_pause_control',W-55,45,48,()=>{this.release();this.menu.open('pause');},false,true,13);
        const actions=this.view.context?.actions||[],primary=actions.find(a=>a.type!=='whip'),secondary=actions.filter(a=>a.type!=='whip')[1],whip=actions.find(a=>a.type==='whip');
        const row=(command:Command,title:string,icon:string,i:number,disabled=false,a?:Action)=>{
            const x=W/2+(i-2)*105,y=H-78;
            const help=command==='help';
            this.button('pc:'+command,help?'ui_button_v5':icon,x,y,43,()=>{this.useKeyboard();this.command(command,'keyboard');},disabled,help,12,help?86:undefined,48,.9,48);
            p.text('pc:key:'+command,this.keyLabel(command),help?x:x-29,y+18,help?20:15,{layer:12,color:new Color(255,221,130)});
            p.text('pc:label:'+command,title,x,y+55,14,{layer:12,width:100,alpha:disabled?.5:1});
            if(a)this.chapter?.actionButton(a,x,y+21,43,disabled);
        };
        row('confirm','交互',primary?.icon||'coin',0,!primary||!!primary.disabled,primary);
        row('cancel','抽鞭','icon_whip',1,!whip||!!whip.disabled,whip);
        row('cycle','换目标','icon_rotate',2,this.model.nearbyTargets<2);
        row('home','回洞','hall1',3,!this.model.canReturnHome);
        row('help','操作说明','ui_tag_v5',4);
        if(secondary)row('secondary',secondary.type==='upgrade'?'扩建':'交互',secondary.icon,5,!!secondary.disabled,secondary);
        p.text('pc:movement',this.mode==='gamepad'?'LS / D-pad':'A / D   ← / →',100,H-47,20,{layer:12,width:190});
        p.text('pc:sprint',this.keyLabel('sprint')+'  '+translate('奔跑'),100,H-24,15,{layer:12,width:190});
        const player=this.model.state.player,ratio=Math.max(0,Math.min(1,player.stamina/RULES.mount[player.mount].stamina));
        p.sprite('pc:staminaBack','ui_bar',100,H-65,12,{width:150,layer:12,anchorY:.5,alpha:.8});
        if(ratio>0)p.sprite('pc:staminaFill','ui_bar_fill',25+75*ratio,H-65,7,{width:150*ratio,layer:12,anchorY:.5,tint:new Color(115,225,152)});
        if(this.hint>0){p.sprite('padHintBase','ui_tag_v5',W/2,H-115,65,{layer:12,width:470});p.text('padHint','手柄已连接，Back 查看操作',W/2,H-145,19,{layer:12,width:440,alpha:Math.min(1,this.hint)});}
        this.chapter?.skipButtons(menuButton);this.chapter?.afterButtons(dt);
    }
    private button(key: string, icon: string, x: number, y: number, size: number, callback: () => void, disabled: boolean, raw = false, layer = 12, width?: number, minHeight = 76, opacity = 1, hitHeight?: number, scale = 1):Node {
        const p = this.view.painter;
        const node = p.sprite(`control:${key}`, raw ? icon : 'ui_action_ring', x, y + size / 2, size, { layer, alpha: (disabled ? .42 : .96) * opacity, width, anchorX: .5, scale });
        if (!raw) p.sprite(`controlIcon:${key}`, icon, x, y + size * .22, size * .56, { layer, alpha: (disabled ? .4 : 1) * opacity });
        this.visible.add(key); if (!disabled) this.handlers.set(key, callback);
        const visual=node.getComponent(UITransform)!;
        const targetWidth=hitHeight ? visual.width : Math.max(76,visual.width), targetHeight=hitHeight ?? Math.max(minHeight,visual.height);
        const existing = this.attached.get(node);
        if (existing) {
            if (existing.width !== targetWidth || existing.height !== targetHeight) existing.setContentSize(targetWidth,targetHeight);
            if (!disabled) { existing.node.active = true; this.activeHits.set(key, existing); }
            return node;
        }
        const hit=new Node('TouchTarget');hit.layer=node.layer;node.addChild(hit);
        const hitTransform = hit.addComponent(UITransform);
        this.attached.set(node,hitTransform);
        hit.active = !disabled;
        if (!disabled) this.activeHits.set(key, hitTransform);
        hitTransform.setContentSize(targetWidth,targetHeight);
        hit.setPosition(visual.width*(.5-visual.anchorX),visual.height*(.5-visual.anchorY),0);
        hit.on(Node.EventType.TOUCH_START, (event: EventTouch) => {
            if (!this.visible.has(key) || !this.handlers.has(key)) return;
            const id = event.getID();
            this.useKeyboard();
            // 奔跑等独立按钮不能抢走正在按住的世界交互。
            if ((key.startsWith('action') || ['pc:confirm','pc:cancel','pc:secondary'].includes(key)) && id !== null) this.actionId = id;
            this.handlers.get(key)?.();
            if(this.held)this.heldOwner='mouse';
            event.propagationStopped = true;
        });
        hit.on(Node.EventType.TOUCH_END,()=>{this.held=null;this.actionId=-1;});
        hit.on(Node.EventType.TOUCH_CANCEL,()=>{this.held=null;this.actionId=-1;});
        return node;
    }

    private keyDown(event:EventKeyboard):void{
        this.useKeyboard();if(this.keys.has(event.keyCode))return;this.keys.add(event.keyCode);
        if(this.menu.blocks){
            if([KeyCode.ARROW_UP,KeyCode.KEY_W].includes(event.keyCode))this.navigate(-1);
            else if([KeyCode.ARROW_DOWN,KeyCode.KEY_S].includes(event.keyCode))this.navigate(1);
            else if([KeyCode.ENTER,KeyCode.NUM_ENTER,KeyCode.SPACE].includes(event.keyCode))this.activate();
            else if(event.keyCode===KeyCode.ESCAPE)this.menu.togglePause();
            return;
        }
        if(this.chapter?.blocks){if([KeyCode.ENTER,KeyCode.NUM_ENTER,KeyCode.SPACE,KeyCode.KEY_E].includes(event.keyCode))this.chapter.director.advance();if(event.keyCode===KeyCode.ESCAPE)this.chapter.director.advance(true);return;}
        if(this.model.state.status!=='playing'){if(event.keyCode===KeyCode.ENTER)this.activate();return;}
        const commands:Record<number,Command>={[KeyCode.ESCAPE]:'pause',[KeyCode.F1]:'help',[KeyCode.KEY_H]:'home',[KeyCode.TAB]:'cycle',[KeyCode.KEY_E]:'confirm',[KeyCode.SPACE]:'confirm',[KeyCode.KEY_Q]:'cancel',[KeyCode.KEY_R]:'secondary'};
        if(commands[event.keyCode])this.command(commands[event.keyCode],'keyboard');
    }
    private keyUp(event:EventKeyboard):void{this.keys.delete(event.keyCode);if([KeyCode.KEY_E,KeyCode.SPACE,KeyCode.KEY_Q,KeyCode.KEY_R].includes(event.keyCode)&&this.heldOwner==='keyboard')this.held=null;}
}
