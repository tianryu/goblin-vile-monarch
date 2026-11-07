import { input, Input, EventTouch, EventMouse, EventKeyboard, KeyCode, Node, UITransform, Color } from 'cc';
import { GameModel } from '../model/GameModel';
import { Action } from '../model/State';
import { RULES } from '../model/Rules';
import type { Mount } from '../model/Rules';
import { GameView } from './GameView';
import { Platform } from '../platform/Platform';
import { HangingMenu } from './HangingMenu';
import type { ChapterView } from './ChapterView';
import { translate } from '../i18n/Locale';
import { PC_MOUNT_PRICES } from '../model/DesktopRules';

const STICK_RADIUS = 62;
const STICK_DEAD_ZONE = 8;
const ACTION_SHIFT_X = 34;
const ACTION_SHIFT_Y = 35;
const ACTION_OPACITY = .74;

/** 手指ID分别管理摇杆、奔跑和投币，世界对象没有直接点击事件。 */
export class Controls {
    chapter?: ChapterView;
    private joystickId = -1;
    private actionId = -1;
    private keys = new Set<number>();
    private attached = new WeakMap<Node, UITransform>();
    private visible = new Set<string>();
    private held: Action | null = null;
    private repeat = 0;
    private adBusy = false;
    private reviveAdFailed = false;
    private adPanel?: 'army' | 'mount';
    private rewardRise = 0;
    private joystickAxis = 0;
    private joystickOrigin?: { x: number; y: number };
    private readonly joystickZone: Node;
    private readonly joystickTransform: UITransform;
    private runLatched = false;
    private sprintKeyBlocked = false;
    private mouseJoystick = false;
    private readonly blur = () => this.release();
    private handlers = new Map<string, () => void>();
    private activeHits = new Map<string, UITransform>();
    constructor(public view: GameView, public model: GameModel, public platform: Platform, private saved: (immediate?: boolean) => void, public menu: HangingMenu) {
        // 热区留在原位，底座只负责显示。广告、引导和功能键位于热区上层，拥有优先权。
        this.joystickZone = new Node('FloatingJoystickZone');
        this.joystickZone.layer = view.painter.layers[12].layer;
        view.root.insertChild(this.joystickZone, view.painter.layers[12].getSiblingIndex());
        this.joystickTransform = this.joystickZone.addComponent(UITransform);
        this.joystickZone.active = false;
        this.joystickZone.on(Node.EventType.TOUCH_START, (e:EventTouch) => {
            const id = e.getID();
            if (id !== null && this.startJoystick(e.getUILocation(), id)) e.propagationStopped = true;
        });
        this.joystickZone.on(Node.EventType.TOUCH_MOVE, this.touchMove, this);
        this.joystickZone.on(Node.EventType.TOUCH_END, this.touchEnd, this);
        this.joystickZone.on(Node.EventType.TOUCH_CANCEL, this.touchEnd, this);
        this.joystickZone.on(Node.EventType.MOUSE_DOWN, (e:EventMouse) => {
            if (e.getButton() === 0 && this.startJoystick(e.getUILocation())) e.propagationStopped = true;
        });
        this.joystickZone.on(Node.EventType.MOUSE_MOVE, this.mouseMove, this);
        this.joystickZone.on(Node.EventType.MOUSE_UP, this.mouseUp, this);
        input.on(Input.EventType.TOUCH_MOVE, this.touchMove, this);
        input.on(Input.EventType.TOUCH_END, this.touchEnd, this); input.on(Input.EventType.TOUCH_CANCEL, this.touchEnd, this);
        input.on(Input.EventType.KEY_DOWN, this.keyDown, this); input.on(Input.EventType.KEY_UP, this.keyUp, this);
        input.on(Input.EventType.MOUSE_MOVE,this.mouseMove,this);input.on(Input.EventType.MOUSE_UP,this.mouseUp,this);
        if (typeof window !== 'undefined') window.addEventListener?.('blur',this.blur);
    }
    destroy(): void {
        this.platform.finishMockReward(false);
        input.off(Input.EventType.TOUCH_MOVE, this.touchMove, this); input.off(Input.EventType.TOUCH_END, this.touchEnd, this); input.off(Input.EventType.TOUCH_CANCEL, this.touchEnd, this);
        input.off(Input.EventType.KEY_DOWN, this.keyDown, this); input.off(Input.EventType.KEY_UP, this.keyUp, this);
        input.off(Input.EventType.MOUSE_MOVE,this.mouseMove,this);input.off(Input.EventType.MOUSE_UP,this.mouseUp,this);
        if (typeof window !== 'undefined') window.removeEventListener?.('blur',this.blur);
        this.joystickZone.destroy();
    }
    release(): void { this.adPanel=undefined;this.rewardRise=0;this.keys.clear();this.resetJoystick();this.actionId=-1;this.runLatched=false;this.sprintKeyBlocked=false;this.held=null;this.model.input={axis:0,run:false}; }
    tick(dt: number): void {
        if(this.menu.blocks || this.chapter?.blocks || this.model.pauses.size || this.model.state.status!=='playing'){
            this.resetJoystick();this.model.input={axis:0,run:false};this.held=null;return;
        }
        this.model.input.axis = this.joystickOrigin ? this.joystickAxis : (this.keys.has(KeyCode.KEY_D) || this.keys.has(KeyCode.ARROW_RIGHT) ? 1 : 0) - (this.keys.has(KeyCode.KEY_A) || this.keys.has(KeyCode.ARROW_LEFT) ? 1 : 0);
        this.resetExhaustedSprint();
        this.model.input.run = this.runEnabled;
        if (this.held && !this.adBusy) {
            const context = this.model.context();
            if (!context?.actions.some(a => a.key === this.held!.key)) { this.held = null; return; }
            this.repeat -= dt;
            if (this.repeat <= 0) { const a = this.held; this.trigger(a); this.repeat = a.type === 'whip' ? .48 : a.type === 'withdraw' ? .14 : .18; }
        }
    }
    render(dt = 0): void {
        this.visible.clear(); this.handlers.clear();
        this.draw(dt);
        // 退场还在绘制时也要退出触摸系统，否则旧按钮会挡住下一层的按钮。
        for (const [key, hit] of this.activeHits) {
            if (!this.handlers.has(key)) {
                hit.node.active = false;
                this.activeHits.delete(key);
            }
        }
    }
    private draw(dt: number): void {
        const p = this.view.painter, W = this.view.width, H = this.view.height, playing = this.model.state.status === 'playing';
        this.joystickZone.active = false;
        const mockSeconds = this.platform.mockRewardSeconds;
        if (mockSeconds !== undefined) {
            this.mockAd(mockSeconds);
            this.chapter?.afterButtons(dt);
            return;
        }
        const cycleX = W / 2, cycleY = H - 43;
        this.chapter?.guideControls(dt, playing && !this.model.pauses.size, cycleX, cycleY);
        if(this.menu.blocks){
            this.menu.render(this.view,(key,x,y,width,height,enabled,callback)=>{
                // 所有菜单项同一位图、宽高和热区，退场立即禁用；透明度由吊牌统一控制。
                const node=this.button(key,'ui_button_v5',x,y,height,()=>{callback();this.saved();},!enabled,true,13,width,76,1,height);
                if(node){const d=this.view.painter.nodes.get('control:'+key+'@ui_button_v5');if(d)d.alpha=this.menu.alpha*(enabled?.96:.42);}
            });
            this.chapter?.afterButtons(dt);
            return;
        }
        if (this.chapter?.blocks) {
            this.chapter.dialogue((key, x, y, width, height, enabled, callback) =>
                this.button(key, 'ui_button_v5', x, y, height, callback, !enabled, true, 13, width));
            this.chapter.afterButtons(dt);
            return;
        }
        if (!playing) {
            this.resultButtons();
            this.chapter?.afterButtons(dt);
            return;
        }
        this.pauseButton();
        this.desktopButtons();
        this.chapter?.skipButtons((key,x,y,width,height,enabled,callback)=>this.button(key,'ui_button_v5',x,y,height,callback,!enabled,true,12,width));
        this.chapter?.afterButtons(dt);
        return;
    }
    /** 固定键位和鼠标热区共用同一业务入口，不因交互对象变化交换 E 与 Q。 */
    private desktopButtons(): void {
        const {painter:p,width:W,height:H}=this.view;
        const actions=this.view.context?.actions||[];
        const primary=actions.find(a=>a.type!=='whip');
        const secondary=actions.filter(a=>a.type!=='whip')[1];
        const whip=actions.find(a=>a.type==='whip');
        const command=(key:string,label:string,icon:string,index:number,callback:()=>void,disabled=false,action?:Action)=>{
            const x=W/2+(index-2)*105,y=H-78;
            this.button('pc:'+key,icon,x,y,43,callback,disabled,false,12,undefined,48,.9,48);
            p.text('pc:key:'+key,key,x-29,y+18,15,{layer:12,color:new Color(255,221,130)});
            p.text('pc:label:'+key,label,x,y+55,14,{layer:12,width:100,alpha:disabled?.5:1});
            if(action)this.chapter?.actionButton(action,x,y+21,43,disabled);
        };
        command('E','交互',primary?.icon||'coin',0,()=>{if(primary)this.startAction(primary);},!primary||!!primary.disabled,primary);
        command('Q','抽鞭','icon_whip',1,()=>{if(whip)this.startAction(whip);},!whip||!!whip.disabled,whip);
        command('Tab','换目标','icon_rotate',2,()=>this.cycle(),this.model.nearbyTargets<2);
        command('H','回洞','hall1',3,()=>this.returnHome(),!this.model.canReturnHome);
        command('M','坐骑','boar',4,()=>{this.adPanel=this.adPanel==='mount'?undefined:'mount';this.held=null;});
        if(secondary)command('R',secondary.type==='upgrade'?'扩建':'交互',secondary.icon,5,()=>this.startAction(secondary),!!secondary.disabled,secondary);
        p.text('pc:movement','A / D   ← / →',100,H-47,20,{layer:12,width:190});
        p.text('pc:sprint','Shift  '+translate('奔跑'),100,H-24,15,{layer:12,width:190});
        const s=this.model.state.player,ratio=Math.max(0,Math.min(1,s.stamina/RULES.mount[s.mount].stamina));
        p.sprite('pc:staminaBack','ui_bar',100,H-65,12,{width:150,layer:12,anchorY:.5,alpha:.8});
        if(ratio>0)p.sprite('pc:staminaFill','ui_bar_fill',25+75*ratio,H-65,7,{width:150*ratio,layer:12,anchorY:.5,tint:new Color(115,225,152)});
        if(this.adPanel==='mount'){
            const costs=PC_MOUNT_PRICES;
            p.sprite('pc:mountBack','ui_tag_v5',W/2,H-107,110,{layer:12,width:560,anchorY:0});
            for(const [i,mount]of(Object.keys(costs)as Mount[]).entries()){
                const x=W/2+(i-1.5)*130,y=H-181,owned=this.model.state.unlockedMounts.includes(mount),current=s.mount===mount;
                this.button('pc:mount:'+mount,mount,x,y,49,()=>{if(this.model.purchaseMount(mount)){this.adPanel=undefined;this.saved(true);}},current||!owned&&this.model.state.gold<costs[mount],false,12,undefined,50,.95,50);
                p.text('pc:mountName:'+mount,RULES.mount[mount].name,x,y+63,16,{layer:12,width:122});
                p.text('pc:mountCost:'+mount,current?'已骑乘':owned?'骑乘':String(costs[mount]),x,y+85,15,{layer:12,width:110});
                if(!owned)p.sprite('pc:mountCoin:'+mount,'coin',x+23,y+94,16,{layer:12});
            }
        }
    }
    private cycle(): void {this.held=null;this.model.cancelPledge();this.model.cycleTarget();}
    private resultButtons(): void {
        const { painter, width, height } = this.view;
        const lost = this.model.state.status === 'lost', center = width / 2, y = height / 2 + (lost ? 60 : 75);
        const restartX = center;
        this.button('resultRestart', 'ui_button_v5', restartX, y, 50, () => {
            if (this.adBusy) return;
            this.release();
            this.reviveAdFailed = false;
            if (lost) {
                if (!this.model.revive()) return;
            } else this.model.restart();
            this.view.camera = this.model.state.player.x;
            this.saved(true);
        }, this.adBusy, true, 13, 206);
        painter.text('resultRestartLabel', lost ? '整顿部落' : '重新开始', restartX, y, 24, { layer: 13, width: 206, alpha: this.adBusy ? .52 : 1 });
    }
    private get shiftHeld(): boolean {
        return this.keys.has(KeyCode.SHIFT_LEFT) || this.keys.has(KeyCode.SHIFT_RIGHT);
    }
    private get runEnabled(): boolean {
        return this.model.canSprint && (this.runLatched || this.shiftHeld && !this.sprintKeyBlocked);
    }
    /** 体力恢复后要重新按下，长按 Shift 也不会自行重新起跑。 */
    private resetExhaustedSprint(): void {
        if (!this.model.canSprint) {
            this.runLatched = false;
            this.sprintKeyBlocked = this.shiftHeld;
        }
    }
    private sprintButton(): void {
        const { painter: p, width: W, height: H } = this.view;
        this.resetExhaustedSprint();
        const { player } = this.model.state;
        const x = W - 205 - ACTION_SHIFT_X, y = H - 76 - ACTION_SHIFT_Y, enabled = this.runEnabled;
        const recovering = !this.model.canSprint;
        const color = recovering ? new Color(255, 142, 91) : new Color(255, 221, 126);
        this.button('run', 'icon_run', x, y, 82, () => {
            this.runLatched = !this.runLatched;
            this.model.input.run = this.runEnabled;
        }, recovering,false,12,undefined,76,ACTION_OPACITY,undefined,enabled ? .91 : 1);
        if (enabled) {
            p.sprite('sprintPressedRing', 'ui_action_ring', x, y + 43, 90,
                { layer: 12, tint: color, alpha: .9 * ACTION_OPACITY });
            // 金环贴在图标下，缩小鞋子并下沉，区别于单纯改变边框亮度。
            p.sprite('controlIcon:run', 'icon_run', x, y + 23, 42, { layer: 12, tint: color, alpha: ACTION_OPACITY });
        }
        const staminaSeconds = Math.ceil(this.model.infiniteStaminaSeconds);
        const timer = Math.floor(staminaSeconds / 60) + ':' + String(staminaSeconds % 60).padStart(2, '0');
        const sprintLabel = recovering ? '体力恢复中' : enabled ? '奔跑已开启' : '奔跑';
        const labelWidth = staminaSeconds ? 152 : 106;
        p.sprite('sprintLabelBack', 'ui_tag_v5', x, y - 40, 25, { layer: 12, width: labelWidth, anchorY: .5, alpha: ACTION_OPACITY });
        p.text('sprintLabel', staminaSeconds ? '无限体力 ' + timer : sprintLabel, x, y - 40, 16,
            { layer: 12, width: labelWidth, color: enabled || recovering || staminaSeconds ? color : new Color(233, 225, 201) });
        const ratio = Math.max(0, Math.min(1, player.stamina / RULES.mount[player.mount].stamina));
        p.sprite('staminaBack', 'ui_bar', x, H - 17 - ACTION_SHIFT_Y, 14, { layer: 12, width: 100, anchorY: .5, alpha: ACTION_OPACITY });
        const fill = 94 * ratio;
        if (fill > 0) p.sprite('staminaFill', 'ui_bar_fill', x - 47 + fill / 2, H - 17 - ACTION_SHIFT_Y, 8,
            { layer: 12, width: fill, anchorY: .5, alpha: ACTION_OPACITY, tint: player.exhausted ? new Color(255, 99, 70) : ratio < .3 ? color : new Color(90, 255, 130) });
    }

    /** 奖励木牌常驻底部中央。奖励和摇杆的起手区分开。 */
    private adButtons(dt: number): void {
        const {painter:p,width,height} = this.view;
        const blocked = this.adBusy || !this.platform.adsReady;
        const ad = (variant: string): Action => ({ key: 'hudAd:' + variant, targetId: -200, type: 'ad', cost: 0, icon: 'icon_play', variant });
        const open = (panel?: 'army' | 'mount') => {
            this.held = null;
            this.adPanel = panel;
            this.rewardRise = 0;
        };
        const count = this.adPanel === 'army' ? 3 : this.adPanel === 'mount' ? 5 : 4;
        const slot = Math.min(112, width / (3 * count)), left = (width - slot * count) / 2;
        this.rewardRise = Math.min(.55, this.rewardRise + dt);
        const row = (key: string, index: number, title: string,
            callback: () => void, disabled = false, video = false, detail?: string) => {
            const progress = Math.min(1, Math.max(0, (this.rewardRise - index * .045) / .33));
            const y = height - 37 + 74 * (1 - progress) ** 3;
            this.rewardRow(key, left + (index + .5) * slot, y, slot - 3, title, callback, disabled, video, progress, detail);
        };
        if (!this.adPanel) {
            row('adGold', 0, `领取${this.model.adGoldReward}金币`, () => this.startAction(ad('gold')), blocked, true);
            row('adArmy', 1, '领两名居民', () => open('army'), this.adBusy, true);
            row('adMount', 2, '解锁坐骑', () => open('mount'), this.adBusy, true);
            const minutes = RULES.rewardStaminaSeconds / 60;
            row('adStamina', 3, '无限体力', () => this.startAction(ad('stamina')), blocked, true, `${minutes}分钟`);
        } else if (this.adPanel === 'army') {
            row('adBack', 0, '返回奖励', () => open());
            for (const [i, role] of (['hunter', 'worker'] as const).entries()) {
                row('adArmy:' + role, i + 1, '领取两名' + RULES.role[role].name,
                    () => this.startAction(ad(role)), blocked, true);
            }
        } else {
            row('adBack', 0, '返回奖励', () => open());
            for (const [i, mount] of (Object.keys(RULES.mount) as Mount[]).entries()) {
                const owned = this.model.state.unlockedMounts.includes(mount);
                const current = this.model.state.player.mount === mount;
                const action = owned ? { ...ad(mount), key: 'hudMount:' + mount, type: 'mount' } : ad(mount);
                const prefix = current ? '已骑乘' : owned ? '骑乘' : '解锁';
                row('mount:' + mount, i + 1, RULES.mount[mount].name,
                    () => { open(); this.startAction(action); }, current || !owned && blocked, !owned, prefix);
            }
        }
        const status = this.platform.mockAds ? '模拟广告' : !this.platform.adsReady ? '视频暂不可用' : '';
        if (status) p.text('rewardStatus', status, width / 2, height - 80, 13, { layer: 12, alpha: Math.min(1, this.rewardRise * 3) });
    }
    private rewardRow(key: string, x: number, y: number, width: number, title: string,
        callback: () => void, disabled: boolean, video: boolean, progress: number, detail?: string): void {
        const p = this.view.painter;
        const alpha = (disabled ? .88 : 1) * progress;
        const size = Math.max(9, Math.min(16, (width - 16) / title.length));
        this.button(key, 'price_board', x, y, 76, callback, disabled || progress < .82, true, 12, width, 76, 1, 48);
        p.nodes.get(`control:${key}@price_board`)!.alpha = alpha;
        if (video) p.sprite(key + ':ad', 'icon_play', x + 5, y - 14, 18, { layer: 12, alpha, anchorY: .5 });
        p.text(key + ':title', title, x + 4, detail ? y - 1 : y + 2, size, { layer: 12, alpha });
        if (detail) p.text(key + ':detail', detail, x + 4, y + 11, Math.max(9, size - 2), { layer: 12, alpha });
    }
    private mockAd(seconds: number): void {
        const { painter: p, width, height } = this.view;
        const x = width / 2, y = height / 2;
        const ink = new Color(87, 52, 33);
        p.sprite('mockAdPanel', 'ui_panel_v5', x, y, 190, { layer: 13, width: 460, anchorY: .5 });
        p.text('mockAdTitle', '模拟广告', x, y - 52, 30, { layer: 13, color: ink });
        p.text('mockAdTimer', seconds ? `${seconds}秒后可领取` : '奖励可领取', x, y - 11, 23, { layer: 13, color: ink });
        this.button('mockCancel', 'ui_button_v5', x - 103, y + 43, 50, () => this.platform.finishMockReward(false), false, true, 13, 174);
        this.button('mockComplete', 'ui_button_v5', x + 103, y + 43, 50, () => this.platform.finishMockReward(true), seconds > 0, true, 13, 174);
        p.text('mockCancelText', '取消', x - 103, y + 43, 23, { layer: 13 });
        p.text('mockCompleteText', '领取奖励', x + 103, y + 43, 23, { layer: 13, alpha: seconds ? .5 : 1 });
    }
    private pauseButton(): void {
        this.button('pause', 'ui_pause_control', this.view.width - 55, 45, 48, () => {
            // 暂停入口只开菜单，关闭由菜单内的「继续游戏」处理。
            if (this.menu.blocks || this.model.pauses.size) return;
            this.release();
            this.menu.open('pause');
            this.saved();
        }, false, true, 13);
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
            if (id === this.joystickId) return;
            // 奔跑等独立按钮不能抢走正在按住的世界交互。
            if ((key.startsWith('action') || ['pc:E','pc:Q','pc:R'].includes(key)) && id !== null) this.actionId = id;
            this.handlers.get(key)?.();
            event.propagationStopped = true;
        });
        hit.on(Node.EventType.TOUCH_END, (event: EventTouch) => this.touchEnd(event));
        // UI命中后触摸会被节点系统接管，不能只监听全局Input的拖动。
        hit.on(Node.EventType.TOUCH_MOVE, (event: EventTouch) => this.touchMove(event));
        hit.on(Node.EventType.TOUCH_CANCEL, (event: EventTouch) => this.touchEnd(event));
        return node;
    }
    private startJoystick(location: {x:number;y:number}, id?: number): boolean {
        if (!this.joystickZone.active || this.joystickOrigin || this.model.pauses.size) return false;
        this.joystickOrigin = {x:location.x,y:this.view.height-location.y};
        this.joystickId = id ?? -1; this.mouseJoystick = id === undefined;
        this.joystickAxis=0;this.model.input.axis=0;
        return true;
    }
    private updateJoystick(x: number): void {
        if (!this.joystickOrigin) return;
        const dx=x-this.joystickOrigin.x;
        this.joystickAxis=Math.sign(dx)*Math.min(1,Math.max(0,(Math.abs(dx)-STICK_DEAD_ZONE)/(STICK_RADIUS-STICK_DEAD_ZONE)));
    }
    private resetJoystick(): void {
        this.joystickOrigin=undefined;this.joystickId=-1;this.joystickAxis=0;this.mouseJoystick=false;this.model.input.axis=0;
    }
    private touchMove(event: EventTouch): void { if (event.getID() === this.joystickId) this.updateJoystick(event.getUILocation().x); }
    private mouseMove(event:EventMouse):void{if(this.mouseJoystick)this.updateJoystick(event.getUILocation().x);}
    private mouseUp():void{if(this.mouseJoystick)this.resetJoystick();}
    private touchEnd(event: EventTouch): void {
        const id = event.getID();
        if (id === this.joystickId) this.resetJoystick();
        if (id === this.actionId) { this.actionId = -1; this.held = null; }
    }
    private startAction(action: Action): void {
        this.held = null;
        this.view.activeAction = action.key; this.trigger(action);
        if (action.cost > 0 || action.type === 'withdraw' || action.type === 'whip') { this.held = action; this.repeat = action.type === 'whip' ? .48 : .22; }
    }
    private returnHome(): void {
        if (!this.model.returnHome()) return;
        this.release();
        this.view.camera = Math.max(this.model.state.player.x, RULES.worldMin + this.view.width / 2);
        this.saved(true);
    }
    private async trigger(action: Action): Promise<void> {
        if (this.adBusy || this.model.pauses.size) return;
        const result = this.model.act(action);
        if (result !== 'ad') { this.saved(); return; }
        await this.watchRewarded(action.variant || '');
    }
    /** 广告流程共用暂停和去重，复活单独校验结算状态与本局身份。 */
    private async watchRewarded(kind: string): Promise<void> {
        const state = this.model.state, revive = kind === 'revive';
        if (this.adBusy || !this.platform.adsReady || this.model.pauses.size ||
            state.status !== (revive ? 'lost' : 'playing')) return;
        this.adBusy = true;
        this.reviveAdFailed = false;
        this.model.pause('ad', true);
        this.release();
        try {
            const reward = await this.platform.rewarded(kind);
            if (state !== this.model.state) return;
            if (!reward.completed || !this.model.grantAdReward(kind, reward.receipt)) {
                this.reviveAdFailed = revive;
                return;
            }
            if (revive) this.view.camera = Math.max(state.player.x, RULES.worldMin + this.view.width / 2);
            this.saved(true);
        } catch {
            this.reviveAdFailed = revive;
        } finally {
            this.adBusy = false;
            this.model.pause('ad', false);
        }
    }
    private keyDown(event: EventKeyboard): void {
        if (this.adBusy) {
            if (event.keyCode === KeyCode.ESCAPE) this.platform.finishMockReward(false);
            return;
        }
        if (this.keys.has(event.keyCode)) return;
        this.keys.add(event.keyCode);
        if (this.chapter?.blocks && !this.menu.blocks) {
            if ([KeyCode.ENTER, KeyCode.NUM_ENTER, KeyCode.SPACE, KeyCode.KEY_E].includes(event.keyCode)) this.chapter.director.advance();
            if (event.keyCode === KeyCode.ESCAPE) this.chapter.director.advance(true);
            return;
        }
        if (event.keyCode === KeyCode.ESCAPE) { this.release(); this.menu.togglePause(); return; }
        if(this.menu.blocks)return;
        if (event.keyCode === KeyCode.KEY_H) { this.returnHome(); return; }
        if (event.keyCode === KeyCode.TAB) {this.cycle();return;}
        if (event.keyCode === KeyCode.KEY_M) {this.held=null;this.adPanel=this.adPanel==='mount'?undefined:'mount';return;}
        const actions = this.model.context()?.actions || [];
        if (event.keyCode === KeyCode.KEY_E || event.keyCode === KeyCode.SPACE) { const action=actions.find(a=>a.type!=='whip');if(action)this.startAction(action); }
        if (event.keyCode === KeyCode.KEY_Q) { const whip = actions.find(a => a.type === 'whip'); if (whip) this.startAction(whip); }
        if (event.keyCode === KeyCode.KEY_R) {const extra=actions.filter(a=>a.type!=='whip')[1];if(extra)this.startAction(extra);}
    }
    private keyUp(event: EventKeyboard): void {
        this.keys.delete(event.keyCode);
        if (!this.shiftHeld) this.sprintKeyBlocked = false;
        if ([KeyCode.KEY_E, KeyCode.SPACE, KeyCode.KEY_Q].includes(event.keyCode)) this.held = null;
    }
}
