import { _decorator, Component, Node, Canvas, Camera, UITransform, Layers, view, ResolutionPolicy, Color, game, Game, input, Input, profiler } from 'cc';
import { DEBUG } from 'cc/env';
import { GameModel } from './model/GameModel';
import { ArtBank } from './view/ArtBank';
import { GameView } from './view/GameView';
import { Controls } from './view/Controls';
import { HangingMenu } from './view/HangingMenu';
import { Platform } from './platform/Platform';
import { ChapterDirector } from './model/ChapterDirector';
import { GAME_TITLE } from './model/ChapterText';
import { ChapterView } from './view/ChapterView';
import { Soundscape } from './view/Soundscape';
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
    private chapter?: ChapterDirector;
    private accumulator = 0;
    private saveClock = 0;
    private saveFailed = false;
    private replacePending = false;
    private browserCanvas?: HTMLCanvasElement;
    private readonly preventGesture = (event: Event) => event.preventDefault();
    private audio?: Soundscape;
    private soundReady = false;
    async start(): Promise<void> {
        profiler.hideStats();
        if (typeof document !== 'undefined') document.title = GAME_TITLE;
        view.setDesignResolutionSize(1280, 600, ResolutionPolicy.FIXED_HEIGHT);
        const canvasNode = new Node('GameCanvas'); canvasNode.layer = Layers.Enum.UI_2D; this.node.addChild(canvasNode);
        canvasNode.addComponent(UITransform).setContentSize(1280, 600);
        const cameraNode = new Node('UICamera'); this.node.addChild(cameraNode); cameraNode.setPosition(0, 0, 1000);
        const camera = cameraNode.addComponent(Camera); camera.projection = Camera.ProjectionType.ORTHO; camera.orthoHeight = 300;
        camera.visibility = Layers.Enum.UI_2D; camera.clearFlags = Camera.ClearFlag.SOLID_COLOR; camera.clearColor = new Color(3, 4, 6, 255);
        const canvas = canvasNode.addComponent(Canvas); canvas.cameraComponent = camera;
        this.platform = new Platform(DEBUG && (globalThis as any).__MONARCH_QA__ ? 'goblin-monarch-cocos-v9-qa' : undefined);
        if (!this.platform.isTapTap && typeof document !== 'undefined') {
            this.browserCanvas = game.canvas ?? undefined;
            if (this.browserCanvas) {
                this.browserCanvas.style.touchAction = 'none';
                this.browserCanvas.addEventListener('gesturestart', this.preventGesture, { passive: false });
            }
        }
        const saved=this.platform.load();this.model = new GameModel(saved);
        await this.art.load(value => { if (DEBUG && value === 1) console.info('[Monarch] production bitmaps ready'); });
        this.world = new GameView(canvasNode, this.art, this.model);
        this.menus=new HangingMenu(this.model,this.platform,!!saved);
        this.controls = new Controls(this.world, this.model, this.platform, immediate => {
            if (immediate) this.save();
            else this.model.dirty = true;
        }, this.menus);
        this.chapter = new ChapterDirector(this.model, () => this.controls?.release());
        this.world.chapter = new ChapterView(this.world, this.chapter);
        this.controls.chapter = this.world.chapter;
        this.world.menuBlocks=()=>!!this.menus?.blocks || !!this.chapter?.blocks;this.world.hideHud=()=>!!this.menus?.hidesHud;
        this.menus.onCommit=action=>{
            this.controls?.release();this.accumulator=0;
            if (action === 'home') { this.soundReady = false; this.audio?.suspend(); }
            if(action==='new'||action==='continue')this.world!.camera=this.model.state.player.x;
            this.model.dirty=true;
            if (action === 'new') this.save(true);
        };
        this.world.drawControls = dt => this.controls?.render(dt);
        this.audio = new Soundscape(this.node, this.art.sounds);
        this.menus.onPlayRequested = () => {
            this.soundReady = true;
            if (this.platform.soundEnabled) this.audio?.prime();
        };
        this.menus.onSoundChanged=enabled=>{if (!enabled) this.audio?.suspend();};
        input.on(Input.EventType.TOUCH_START, this.unlockAudio, this); input.on(Input.EventType.KEY_DOWN, this.unlockAudio, this);
        game.on(Game.EVENT_HIDE, this.hide, this); game.on(Game.EVENT_SHOW, this.show, this);
        this.platform.initialize().catch(error => console.warn('[Monarch] platform initialize failed', error?.message));
        if (DEBUG) (globalThis as any).__monarch = { model: this.model, view: this.world, controls: this.controls, platform: this.platform,menus:this.menus,
            reset: () => { this.controls!.release(); this.model.restart(); this.world!.camera = this.model.state.player.x; },
            advance: (seconds: number) => { for (let i = 0; i < seconds * 30; i++) this.model.tick(1 / 30); },
            save: () => this.save(), engine: 'Cocos Creator 3.8.8', target: 'taptap-minigame',checkpoint:'store-20261104' };
        console.info('[Monarch] Cocos game ready, TapTap minigame target');
    }
    update(dt: number): void {
        if (!this.world || !this.controls) return;
        dt = Math.min(.1, dt); this.menus?.update(dt);
        this.chapter?.update(dt, this.world.context);
        this.controls.tick(dt);
        const frozen=this.model.pauses.size>0||this.model.state.status!=='playing';
        if(frozen)this.accumulator=0;
        else{this.accumulator += dt;while (this.accumulator >= 1 / 30) { this.model.tick(1 / 30); this.accumulator -= 1 / 30; }}
        if (!frozen && this.model.state.status === 'won') this.chapter?.update(0);
        const size = view.getVisibleSize();
        this.world.render(dt, size.width, size.height, frozen?1:this.accumulator * 30);
        this.menus?.afterRender();
        this.saveClock += dt;
        if (this.model.dirty && (this.saveFailed ? this.saveClock >= 5 :
            this.saveClock > 1.5 || this.model.state.status !== 'playing')) this.save();
        this.audio?.update(dt, this.model, this.soundReady && this.platform.soundEnabled, !!this.menus?.hidesHud);
    }
    private unlockAudio(): void {
        if (this.menus?.hidesHud) return;
        this.soundReady = true;
    }
    private save(replaceCampaign = false): void {
        this.replacePending ||= replaceCampaign;
        if (!replaceCampaign && this.saveFailed && this.saveClock < 5) return;
        // 平台在本次调用内同步序列化，避免先把整份状态再复制一次。
        this.saveFailed = !this.platform.save(this.model.state, this.replacePending);
        this.saveClock = 0;
        if (!this.saveFailed) {
            this.model.dirty = false;
            this.replacePending = false;
        }
    }
    private hide(): void { this.audio?.suspend(); this.controls?.release(); this.model.cancelPledge(); this.model.pause('background', true); this.save(); }
    private show(): void { this.model.pause('background', false); this.accumulator = 0; }
    onDestroy(): void {
        this.browserCanvas?.removeEventListener('gesturestart', this.preventGesture);
        this.controls?.destroy(); input.off(Input.EventType.TOUCH_START, this.unlockAudio, this); input.off(Input.EventType.KEY_DOWN, this.unlockAudio, this);
        game.off(Game.EVENT_HIDE, this.hide, this); game.off(Game.EVENT_SHOW, this.show, this);
        if (this.model) this.save();
        if (DEBUG) delete (globalThis as any).__monarch;
    }
}
