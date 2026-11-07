import { _decorator, Component, Node, Canvas, Camera, UITransform, Layers, view, ResolutionPolicy, Color, game, Game, input, Input, AudioSource, profiler } from 'cc';
import { DEBUG } from 'cc/env';
import { GameModel } from './model/GameModel';
import { ArtBank } from './view/ArtBank';
import { GameView } from './view/GameView';
import { Controls } from './view/Controls';
import { HangingMenu } from './view/HangingMenu';
import { Platform } from './platform/Platform';
const { ccclass } = _decorator;

/** 正式场景入口，后续视图与平台服务都在这个生命周期内装配。 */
@ccclass('MonarchGame')
export class MonarchGame extends Component {
    model!: GameModel;
    private art = new ArtBank();
    private platform!: Platform;
    private world?: GameView;
    private controls?: Controls;
    private menus?:HangingMenu;
    private accumulator = 0;
    private saveClock = 0;
    private audio!: AudioSource;
    private soundReady = false;
    private lastStep = 0;
    async start(): Promise<void> {
        profiler.hideStats();
        view.setDesignResolutionSize(1280, 600, ResolutionPolicy.FIXED_HEIGHT);
        const canvasNode = new Node('GameCanvas'); canvasNode.layer = Layers.Enum.UI_2D; this.node.addChild(canvasNode);
        canvasNode.addComponent(UITransform).setContentSize(1280, 600);
        const cameraNode = new Node('UICamera'); this.node.addChild(cameraNode); cameraNode.setPosition(0, 0, 1000);
        const camera = cameraNode.addComponent(Camera); camera.projection = Camera.ProjectionType.ORTHO; camera.orthoHeight = 300;
        camera.visibility = Layers.Enum.UI_2D; camera.clearFlags = Camera.ClearFlag.SOLID_COLOR; camera.clearColor = new Color(3, 4, 6, 255);
        const canvas = canvasNode.addComponent(Canvas); canvas.cameraComponent = camera;
        this.platform = new Platform(DEBUG && (globalThis as any).__MONARCH_QA__ ? 'goblin-monarch-cocos-v9-qa' : undefined);
        const saved=this.platform.load();this.model = new GameModel(saved);
        await this.art.load(value => { if (DEBUG && value === 1) console.info('[Monarch] production bitmaps ready'); });
        this.world = new GameView(canvasNode, this.art, this.model);
        this.menus=new HangingMenu(this.model,this.platform,!!saved);
        this.controls = new Controls(this.world, this.model, this.platform, () => { this.model.dirty = true; },this.menus);
        this.world.menuBlocks=()=>!!this.menus?.blocks;this.world.hideHud=()=>!!this.menus?.hidesHud;
        this.menus.onCommit=action=>{this.controls?.release();this.accumulator=0;if(action==='new'||action==='continue')this.world!.camera=this.model.state.player.x;this.model.dirty=true;};
        this.world.drawControls = () => this.controls?.render();
        this.audio = this.node.addComponent(AudioSource);
        this.audio.volume=this.platform.soundEnabled?1:0;
        this.menus.onSoundChanged=enabled=>{this.audio.volume=enabled?1:0;};
        input.on(Input.EventType.TOUCH_START, this.unlockAudio, this); input.on(Input.EventType.KEY_DOWN, this.unlockAudio, this);
        game.on(Game.EVENT_HIDE, this.hide, this); game.on(Game.EVENT_SHOW, this.show, this);
        this.platform.initialize().catch(error => console.warn('[Monarch] platform initialize failed', error?.message));
        if (DEBUG) (globalThis as any).__monarch = { model: this.model, view: this.world, controls: this.controls, platform: this.platform,menus:this.menus,
            reset: () => { this.controls!.release(); this.model.restart(); this.world!.camera = this.model.state.player.x; },
            advance: (seconds: number) => { for (let i = 0; i < seconds * 30; i++) this.model.tick(1 / 30); },
            save: () => this.save(), engine: 'Cocos Creator 3.8.8', target: 'taptap-minigame',checkpoint:'hanging-menu-20261103' };
        console.info('[Monarch] Cocos game ready, TapTap minigame target');
    }
    update(dt: number): void {
        if (!this.world || !this.controls) return;
        dt = Math.min(.1, dt); this.menus?.update(dt);this.controls.tick(dt);
        const frozen=this.model.pauses.size>0||this.model.state.status!=='playing';
        if(frozen)this.accumulator=0;
        else{this.accumulator += dt;while (this.accumulator >= 1 / 30) { this.model.tick(1 / 30); this.accumulator -= 1 / 30; }}
        const size = view.getVisibleSize();
        this.world.render(dt, size.width, size.height, frozen?1:this.accumulator * 30);
        this.menus?.afterRender();
        this.saveClock += dt;
        if (this.model.dirty && (this.saveClock > 1.5 || this.model.state.status !== 'playing')) this.save();
        if (this.soundReady&&this.platform.soundEnabled) {
            const mapping: Record<string, string> = { coin: 'coin', refund: 'back', build: 'confirm', whip: 'chop', arrow: 'arrow', throw: 'chop', camp: 'confirm', raid: 'cage' };
            const events = this.model.events.splice(0);
            for (const event of events.slice(-4)) { const clip = this.art.sounds.get(mapping[event.kind]); if (clip && Math.abs(event.x - this.model.state.player.x) < 900) this.audio.playOneShot(clip, .38); }
            if (Math.abs(this.model.input.axis) > .14 && !this.model.pauses.size && this.model.state.elapsed - this.lastStep > .44) { this.lastStep = this.model.state.elapsed; const clip = this.art.sounds.get('hoof'); if (clip) this.audio.playOneShot(clip, .16); }
        } else this.model.events.length = 0;
    }
    private unlockAudio(): void { this.soundReady = true; }
    private save(): void { if (this.platform.save(this.model.snapshot())) { this.model.dirty = false; this.saveClock = 0; } }
    private hide(): void { this.controls?.release(); this.model.cancelPledge(); this.model.pause('background', true); this.save(); }
    private show(): void { this.model.pause('background', false); this.accumulator = 0; }
    onDestroy(): void {
        this.controls?.destroy(); input.off(Input.EventType.TOUCH_START, this.unlockAudio, this); input.off(Input.EventType.KEY_DOWN, this.unlockAudio, this);
        game.off(Game.EVENT_HIDE, this.hide, this); game.off(Game.EVENT_SHOW, this.show, this);
        if (this.model) this.save();
        if (DEBUG) delete (globalThis as any).__monarch;
    }
}
