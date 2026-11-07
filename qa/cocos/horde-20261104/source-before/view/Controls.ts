import { input, Input, EventTouch, EventMouse, EventKeyboard, KeyCode, Node, UITransform, Color } from 'cc';
import { GameModel } from '../model/GameModel';
import { Action } from '../model/State';
import { RULES } from '../model/Rules';
import { GameView } from './GameView';
import { Platform } from '../platform/Platform';
import { HangingMenu } from './HangingMenu';

/** 手指ID分别管理摇杆、奔跑和投币，世界对象没有直接点击事件。 */
export class Controls {
    private joystickId = -1;
    private runId = -1;
    private actionId = -1;
    private keys = new Set<number>();
    private attached = new WeakSet<Node>();
    private visible = new Set<string>();
    private held: Action | null = null;
    private repeat = 0;
    private adBusy = false;
    private joystickAxis = 0;
    private runLatched = false;
    private mouseJoystick = false;
    private handlers = new Map<string, () => void>();
    constructor(public view: GameView, public model: GameModel, public platform: Platform, private saved: () => void,public menu?:HangingMenu) {
        input.on(Input.EventType.TOUCH_MOVE, this.touchMove, this);
        input.on(Input.EventType.TOUCH_END, this.touchEnd, this); input.on(Input.EventType.TOUCH_CANCEL, this.touchEnd, this);
        input.on(Input.EventType.KEY_DOWN, this.keyDown, this); input.on(Input.EventType.KEY_UP, this.keyUp, this);
        input.on(Input.EventType.MOUSE_MOVE,this.mouseMove,this);input.on(Input.EventType.MOUSE_UP,this.mouseUp,this);
    }
    destroy(): void {
        input.off(Input.EventType.TOUCH_MOVE, this.touchMove, this); input.off(Input.EventType.TOUCH_END, this.touchEnd, this); input.off(Input.EventType.TOUCH_CANCEL, this.touchEnd, this);
        input.off(Input.EventType.KEY_DOWN, this.keyDown, this); input.off(Input.EventType.KEY_UP, this.keyUp, this);
        input.off(Input.EventType.MOUSE_MOVE,this.mouseMove,this);input.off(Input.EventType.MOUSE_UP,this.mouseUp,this);
    }
    release(): void { this.keys.clear(); this.joystickId = this.runId = this.actionId = -1; this.joystickAxis = 0; this.mouseJoystick=false;this.runLatched=false;this.held = null; this.model.input = { axis: 0, run: false }; }
    tick(dt: number): void {
        if(this.menu?.blocks){this.model.input={axis:0,run:false};this.held=null;return;}
        this.model.input.axis = this.joystickId >= 0 ? this.joystickAxis : (this.keys.has(KeyCode.KEY_D) || this.keys.has(KeyCode.ARROW_RIGHT) ? 1 : 0) - (this.keys.has(KeyCode.KEY_A) || this.keys.has(KeyCode.ARROW_LEFT) ? 1 : 0);
        this.model.input.run = this.runLatched || this.runId >= 0 || this.keys.has(KeyCode.SHIFT_LEFT) || this.keys.has(KeyCode.SHIFT_RIGHT);
        if (this.held && !this.adBusy) {
            const context = this.model.context();
            if (!context?.actions.some(a => a.key === this.held!.key)) { this.held = null; return; }
            this.repeat -= dt;
            if (this.repeat <= 0) { const a = this.held; this.trigger(a); this.repeat = a.type === 'whip' ? .48 : a.type === 'withdraw' ? .14 : .18; }
        }
    }
    render(): void {
        this.visible.clear(); this.handlers.clear();
        const p = this.view.painter, W = this.view.width, H = this.view.height, playing = this.model.state.status === 'playing';
        if(this.menu?.blocks){
            this.menu.render(this.view,(key,x,y,width,height,enabled,callback)=>{
                // 所有菜单项同一位图、宽高和热区，退场立即禁用；透明度由吊牌统一控制。
                const node=this.button(key,'ui_button_v5',x,y,height,()=>{callback();this.saved();},!enabled,true,13,width);
                if(node){const d=this.view.painter.nodes.get('control:'+key+'@ui_button_v5');if(d)d.alpha=this.menu!.alpha*(enabled?.96:.42);}
            });
            if(this.menu.kind==='pause'&&this.menu.phase!=='closing'&&this.menu.phase!=='exit-ready')this.pauseButton(true);
            return;
        }
        if (!playing) {
            this.button('restart', 'icon_restart', W / 2, H / 2 + 73, 82, () => { this.release(); this.model.restart(); this.view.camera = this.model.state.player.x; this.saved(); }, false, false, 13);
            return;
        }
        this.pauseButton(false);
        this.button('joystick', 'ui_joystick_base', 130, H - 77, 103, () => {}, false, true, 12, 220);
        const knob = 130 + this.joystickAxis * 62;
        p.sprite('joystickKnob', 'ui_joystick_knob', knob, H - 48, 60, { layer: 12 });
        this.button('run', 'icon_run', W - 205, H - 76, 82, () => {}, false, false);
        // 复用既有位图底条，紧贴奔跑按钮下方；常显避免玩家不知道有体力，暂停时不更新模型。
        const player=this.model.state.player,ratio=Math.max(0,Math.min(1,player.stamina/RULES.mount[player.mount].stamina)),meterWidth=100;
        p.sprite('staminaBack','ui_bar',W-205,H-17,14,{layer:12,width:meterWidth,anchorY:.5});
        const fill=Math.max(0,(meterWidth-6)*ratio);
        if(fill>0)p.sprite('staminaFill','ui_bar_fill',W-205-(meterWidth-6)/2+fill/2,H-17,8,{layer:12,width:fill,anchorY:.5,tint:player.exhausted?new Color(255,99,70):ratio<.3?new Color(255,191,100):new Color(90,255,130)});
        if(player.exhausted)p.sprite('staminaEmpty','icon_run',W-258,H-9,18,{layer:12,tint:new Color(255,137,109),alpha:.7+.3*Math.sin(this.model.state.elapsed*6)});
        if(this.runLatched)p.sprite('sprintActive','ui_action_ring',W-205,H-35,82,{layer:12,alpha:.2,tint:new Color(255,218,115)});
        if (this.model.nearbyTargets>1) this.button('cycleTarget','icon_rotate',W-315,H-72,55,()=>{this.held=null;this.model.cancelPledge();this.model.cycleTarget();},false,false);
        if (this.model.pauses.has('manual')) {
            p.sprite('pauseBreath', 'icon_play', W - 310, 74, 31, { layer: 12 }); return;
        }
        const actions = this.view.context?.actions || [];
        for (let i = 0; i < Math.min(3, actions.length); i++) {
            const a = actions[i], x = i === 0 ? W - 82 : i === 1 ? W - 205 : W - 80;
            const y = i === 0 ? H - 82 : H - 187;
            const disabled = !!a.disabled || a.type === 'ad' && !this.platform.adsReady || this.adBusy;
            this.button(`action${i}`, a.icon, x, y, i === 0 ? 113 : 77, () => this.startAction(a), disabled, false);
        }
    }
    private pauseButton(resume:boolean):void{
        const x=this.view.width-310,y=60,p=this.view.painter;
        this.button('pause','ui_pause_control',x,y,58,()=>{this.release();if(this.menu)this.menu.togglePause();else this.model.pause('manual',!this.model.pauses.has('manual'));this.saved();},false,true,13);
        if(resume){p.sprite('resumeRing','ui_action_ring',x,y+29,58,{layer:13});p.sprite('resumeIcon','icon_play',x,y+14,31,{layer:13});}
    }
    private button(key: string, icon: string, x: number, y: number, size: number, callback: () => void, disabled: boolean, raw = false, layer = 12, width?: number):Node {
        const p = this.view.painter;
        const node = p.sprite(`control:${key}`, raw ? icon : 'ui_action_ring', x, y + size / 2, size, { layer, alpha: disabled ? .42 : .96, width, anchorX: .5 });
        if (!raw) p.sprite(`controlIcon:${key}`, icon, x, y + size * .22, size * .56, { layer, alpha: disabled ? .4 : 1 });
        this.visible.add(key); if (!disabled) this.handlers.set(key, callback);
        if (this.attached.has(node)) return node;
        this.attached.add(node);
        const hit=new Node('TouchTarget');hit.layer=node.layer;node.addChild(hit);
        const visual=node.getComponent(UITransform)!;
        hit.addComponent(UITransform).setContentSize(Math.max(76,visual.width),Math.max(76,visual.height));
        hit.setPosition(visual.width*(.5-visual.anchorX),visual.height*(.5-visual.anchorY),0);
        hit.on(Node.EventType.TOUCH_START, (event: EventTouch) => {
            if (!this.visible.has(key) || !this.handlers.has(key)) return;
            if (key === 'joystick') { this.joystickId = event.getID(); this.updateJoystick(event); }
            else if (key === 'run') {this.runId = event.getID();this.runLatched=!this.runLatched;}
            else { this.actionId = event.getID(); this.handlers.get(key)?.(); }
            event.propagationStopped = true;
        });
        hit.on(Node.EventType.TOUCH_END, (event: EventTouch) => this.touchEnd(event));
        // UI命中后触摸会被节点系统接管，不能只监听全局Input的拖动。
        hit.on(Node.EventType.TOUCH_MOVE, (event: EventTouch) => this.touchMove(event));
        hit.on(Node.EventType.TOUCH_CANCEL, (event: EventTouch) => this.touchEnd(event));
        if(key==='joystick'){
            hit.on(Node.EventType.MOUSE_DOWN,(event:EventMouse)=>{if(event.getButton()===0){this.mouseJoystick=true;this.joystickId=0;this.joystickAxis=Math.max(-1,Math.min(1,(event.getUILocation().x-130)/62));}});
            hit.on(Node.EventType.MOUSE_MOVE,(event:EventMouse)=>this.mouseMove(event));
            hit.on(Node.EventType.MOUSE_UP,()=>this.mouseUp());
        }
        return node;
    }
    private updateJoystick(event: EventTouch): void {
        const location = event.getUILocation();
        this.joystickAxis = Math.max(-1, Math.min(1, (location.x - 130) / 62));
    }
    private touchMove(event: EventTouch): void { if (event.getID() === this.joystickId) this.updateJoystick(event); }
    private mouseMove(event:EventMouse):void{if(this.mouseJoystick)this.joystickAxis=Math.max(-1,Math.min(1,(event.getUILocation().x-130)/62));}
    private mouseUp():void{if(this.mouseJoystick){this.mouseJoystick=false;this.joystickId=-1;this.joystickAxis=0;}}
    private touchEnd(event: EventTouch): void {
        const id = event.getID();
        if (id === this.joystickId) { this.joystickId = -1; this.joystickAxis = 0; }
        if (id === this.runId) this.runId = -1;
        if (id === this.actionId) { this.actionId = -1; this.held = null; }
    }
    private startAction(action: Action): void {
        this.view.activeAction = action.key; this.trigger(action);
        if (action.cost > 0 || action.type === 'withdraw' || action.type === 'whip') { this.held = action; this.repeat = action.type === 'whip' ? .48 : .22; }
    }
    private async trigger(action: Action): Promise<void> {
        if (this.adBusy || this.model.pauses.size) return;
        const result = this.model.act(action);
        if (result !== 'ad') { this.saved(); return; }
        this.held = null; this.adBusy = true; this.model.pause('ad', true); this.release();
        try {
            const reward = await this.platform.rewarded(action.variant || '');
            if (reward.completed) this.model.grantAdReward(action.variant || '', reward.receipt);
        } finally { this.adBusy = false; this.model.pause('ad', false); this.saved(); }
    }
    private keyDown(event: EventKeyboard): void {
        if (this.keys.has(event.keyCode)) return;
        this.keys.add(event.keyCode);
        if (event.keyCode === KeyCode.ESCAPE) { this.release(); if(this.menu)this.menu.togglePause();else this.model.pause('manual', !this.model.pauses.has('manual')); return; }
        if(this.menu?.blocks)return;
        const actions = this.model.context()?.actions || [];
        if (event.keyCode === KeyCode.KEY_E || event.keyCode === KeyCode.SPACE) { if (actions[0]) this.startAction(actions[0]); }
        if (event.keyCode === KeyCode.KEY_Q) { const whip = actions.find(a => a.type === 'whip'); if (whip) this.startAction(whip); }
        if (event.keyCode === KeyCode.KEY_R) { const recruit = actions.find(a => a.type === 'recruit'); if (recruit) this.startAction(recruit); }
    }
    private keyUp(event: EventKeyboard): void {
        this.keys.delete(event.keyCode);
        if ([KeyCode.KEY_E, KeyCode.SPACE, KeyCode.KEY_Q].includes(event.keyCode)) this.held = null;
    }
}
