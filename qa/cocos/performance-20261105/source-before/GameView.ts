import { Color, Node, UITransform, Graphics, Layers, Mask } from 'cc';
import { GameModel } from '../model/GameModel';
import { RULES, BUILDINGS,HEROES, clamp } from '../model/Rules';
import { Building, Context, Enemy, Goblin } from '../model/State';
import { TRADER_CART_OFFSET } from '../model/BaseLayout';
import { ATTACK_LEAD, ATTACK_RECOVERY, METEOR_DAMAGE_RADIUS, AttackStyle } from '../model/EnemyAttack';
import { ArtBank } from './ArtBank';
import { Painter } from './Painter';
import {drawCutout,drumPose,Motion} from './CutoutMotion';
import{captiveHeight,prisonLayout}from'../model/PrisonLayout';
import type { ChapterView } from './ChapterView';

const WHITE = new Color(255, 255, 255, 255);
const CRACK_WARNING = new Color(255, 229, 204);
const CAST_GEM = [[.116, 1.08], [-.268, .87], [-.643, .75]];
const ATTACK_TILT: Record<AttackStyle, number[]> = {
    melee: [-6, -15, -22, 22, 12, 2],
    bow: [-3, -8, -13, 8, 4, 1],
    cast: [-5, -10, -17, 15, 8, 1],
    slam: [48, 33, 9],
};
/** 所有美术来自位图。程序只负责组装、贴纸姿态、灯光和用户明确允许的火焰/水波。 */
export class GameView {
    painter: Painter;
    camera = 400;
    width = 1280; height = 600; ground = 402;
    context: Context | null = null;
    activeAction = '';
    drawControls?: (dt: number) => void;
    chapter?: ChapterView;
    menuBlocks?:()=>boolean;
    hideHud?:()=>boolean;
    private fx: Graphics;
    private healthFx: Graphics;
    private lowHealthAlpha = 0;
    private worldClip:Node;
    private uiCoins: { x: number; y: number; vx: number; vy: number; angle: number }[] = [];
    private purseReady=false;
    private ambient=new Color();private actorLight=new Color();private skyLight=new Color();private warmth=0;
    constructor(public root: Node, public art: ArtBank, public model: GameModel) {
        this.painter = new Painter(root, art);
        this.worldClip=new Node('ClosedWorldBoundary');this.worldClip.layer=Layers.Enum.UI_2D;root.insertChild(this.worldClip,0);this.worldClip.addComponent(UITransform);this.worldClip.addComponent(Mask).type=Mask.Type.GRAPHICS_RECT;
        for(let i=0;i<=11;i++)this.painter.layers[i].setParent(this.worldClip);
        this.painter.layers[3].addComponent(Mask).type=Mask.Type.GRAPHICS_RECT;
        const f = new Node('ProceduralLightsAndFire'); f.layer = Layers.Enum.UI_2D; this.painter.layers[10].addChild(f); f.addComponent(UITransform);
        this.fx = f.addComponent(Graphics);
        const cue = new Node('ChiefHealthCue');
        cue.layer = Layers.Enum.UI_2D;
        root.insertChild(cue, this.painter.layers[12].getSiblingIndex());
        cue.addComponent(UITransform);
        this.healthFx = cue.addComponent(Graphics);
    }
    screen(x: number): number { return x - this.camera + this.width / 2; }
    private inView(x: number, margin = 280): boolean { return Math.abs(x - this.camera) < this.width / 2 + margin; }
    private nightAmount(): number {
        const t = this.model.state.time;
        if (t < 20) return 1 - t / 20;
        if (t < 105) return 0;
        if (t < 140) return (t - 105) / 35;
        return 1;
    }
    /** 每画面只计算三种色调，人物保持明亮，晨暮改变色相而非只压暗。 */
    private updateLighting():void{
        const t=this.model.state.time,n=this.nightAmount();
        this.warmth=Math.max(0,1-Math.abs(t-18)/23)*.65+Math.max(0,1-Math.abs(t-108)/27);
        const w=this.warmth;
        this.ambient.set(255-n*94,255-n*67-w*34,255-n*33-w*65,255);
        this.actorLight.set(255-n*24,255-n*16-w*7,255-w*12,255);
        this.skyLight.set(255-n*130,255-n*90-w*65,255-n*35-w*115,255);
    }
    private light(actor=false):Color{return actor?this.actorLight:this.ambient;}
    render(dt: number, width: number, height: number, interpolation = 1): void {
        this.width = width; this.height = height; this.ground = height * .67;
        if (!this.model.pauses.size) this.camera += (Math.max(RULES.worldMin+width/2,this.model.state.player.x) - this.camera) * Math.min(1, dt * 6);
        this.painter.begin(width, height); this.context = this.menuBlocks?.()?null:this.model.context();
        const clipLeft=clamp(this.screen(RULES.worldMin),0,width-1),clipWidth=width-clipLeft;
        const clip=this.worldClip.getComponent(UITransform)!;clip.setContentSize(clipWidth,height);clip.setAnchorPoint((width/2-clipLeft)/clipWidth,.5);
        const landLayer=this.painter.layers[3];
        // 洞内不用草地贴图。岩地是单独位图，洞口再接回室外土地。
        const landStart=clamp(this.screen(1040),0,width),landEnd=clamp(this.screen(RULES.shoreX),0,width+20);
        landLayer.setPosition(landStart-width/2,0,0);landLayer.getComponent(UITransform)!.setAnchorPoint(0,.5);
        landLayer.getComponent(UITransform)!.setContentSize(Math.max(0,landEnd-landStart),height);
        this.updateLighting();this.environment();
        const cart = this.model.state.drumCart;
        for (const b of this.model.state.buildings) if (this.inView(b.x) && this.model.visible(b) && !(b.kind==='flag' && cart && !cart.abandoned)) this.building(b);
        this.camps(); this.animals(); this.drumCart(interpolation); this.hero(interpolation); this.goblins(interpolation); this.enemies(interpolation); this.machines(interpolation);
        this.coins(); this.trader(interpolation);this.projectiles(); this.procedural(); if(!this.hideHud?.())this.hud(this.model.pauses.size?0:dt); this.foreground();
        this.healthCue(dt);
        this.drawControls?.(dt); this.chapter?.result(); this.painter.end(dt);
    }
    private healthCue(dt: number): void {
        const graphics = this.healthFx, s = this.model.state;
        const visible = !this.hideHud?.() && s.status === 'playing';
        const ratio = s.player.hp / this.model.playerMaxHp;
        const target = visible && ratio <= .3 ? .45 + (.3 - ratio) * .8 : 0;
        this.lowHealthAlpha += (target - this.lowHealthAlpha) * Math.min(1, dt * 10);
        const breath = .87 + Math.sin(s.elapsed * 4.8) * .13;
        // 直接使用受击计时，暂停不会继续闪烁，连击也不会叠加多层遮罩。
        const age = 1.2 - s.player.hurt;
        const flash = visible ? Math.min(1, age / .035 + .15) * Math.max(0, 1 - age / .24) : 0;
        const strength = Math.min(.8, this.lowHealthAlpha * breath + flash * .64);
        graphics.clear();
        if (strength < .006) return;
        const halfW = this.width / 2, halfH = this.height / 2, step = 10;
        for (let band = 0; band < 10; band++) {
            const x = halfW - band * step, y = halfH - band * step;
            graphics.fillColor = new Color(239, 28, 37, Math.round(255 * strength * (1 - band / 10) ** 1.55));
            graphics.rect(-x, y - step, x * 2, step);
            graphics.rect(-x, -y, x * 2, step);
            graphics.rect(-x, -y + step, step, (y - step) * 2);
            graphics.rect(x - step, -y + step, step, (y - step) * 2);
            graphics.fill();
        }
    }
    private isGuideTarget(id: number): boolean {
        return !this.menuBlocks?.() && this.chapter?.guideTargetId === id;
    }
    private environment(): void {
        const p = this.painter, s = this.model.state, g = this.ground, W = this.width, H = this.height;
        const n = this.nightAmount();
        p.sprite('sky', 'sky_base', W / 2, H, H, { layer: 0, width: W, anchorY: 0, tint: this.skyLight });
        const daylight = s.time < 120, phase = (s.time % 120) / 120;
        const orbY = g - 80 - Math.sin(phase * Math.PI) * 230;
        p.sprite('celestial', daylight ? 'sun' : 'moon', W * (.10 + phase * .8), orbY, daylight ? 82 : 76, { layer: 1, alpha: Math.min(1, phase * 15, (1 - phase) * 15) });
        for (let i = 0; i < 6; i++) {
            const x = ((i * 310 + 100 + s.elapsed * (3 + i % 3)) % (W + 380)) - 190;
            p.sprite(`cloud${i}`, 'cloud', x, 125 + i % 3 * 26, 35 + i % 2 * 14, { layer: 1, alpha: .48, tint: this.light() });
        }
        this.band('far', 900, g - 40, 198, .12, 1, this.light());
        this.band('middle', 1100, g, 382, .34, 1, new Color(210-n*65,220-n*50-this.warmth*24,211-n*20-this.warmth*40));
        // 相邻镜像瓦片的边界像素相同，不在重复边界叠加突兀拼接线。
        this.band('water', 600, H + 70, H - g + 80, .96, 2, new Color(195 - n * 55, 220 - n * 40, 235 - n * 15), s.elapsed * 4);
        this.band('water', 630, H + 85, H - g + 80, .96, 2, new Color(210, 224, 235), -s.elapsed * 2.3, .18);
        this.band('land', 1000, g + 63, 69, 1, 3, this.light());
        if(this.art.frames.has('land_entry'))p.sprite('caveLandJoin','land_entry',this.screen(920),g+63,69,{layer:4,width:240,anchorY:0,tint:this.light()});
        if(this.art.frames.has('cave_floor'))p.sprite('caveRockFloor','cave_floor',this.screen(330),g+65,65,{layer:4,width:1530,tint:this.light()});
        if (this.art.frames.has('cave')) p.sprite('cave-shell', 'cave', this.screen(300), g + 1, 420, { layer: 2, width: 1530, anchorX: .5, tint: this.light() });
        for (let i = 0; i < 84; i++) {
            const x = 1850 + i * 253 + Math.sin(i * 5.17) * 105;
            if (!this.inView(x, 450)) continue;
            if (this.model.state.buildings.some(b => Math.abs(b.x - x) < 90 && b.level)) continue;
            const kind = i % 3 === 0 ? 'tree_pine' : i % 3 === 1 ? 'tree_oak' : 'tree_willow';
            const size = 230 + i % 4 * 30;
            const held = Math.floor(s.elapsed * 7 + i) / 7;
            // 根部固定，不用上下位移制造走路或树根漂浮。
            p.sprite(`tree${i}`, kind, this.screen(x), g + 2, size, { layer: 3, angle: Math.sin(held * .7 + i) * .35, tint: this.light(), face: i % 2 ? 1 : -1 });
            if (i % 2) p.sprite(`shrub${i}`, 'forest_shrub', this.screen(x + 95), g + 4, 48, { layer: 4, tint: this.light() });
        }
        for (let i = 0; i < RULES.streamCount; i++) {
            const x = RULES.streamStart + i * RULES.streamSpacing;
            if (this.inView(x)) p.sprite(`stream${i}`, 'stream_crossing', this.screen(x), g + 22, 90, { layer: 3, tint: this.light() });
        }
        // 占领视觉强调掠来的装备与部落路标，而非复制王国边界旗海。
        const sections:{left:number;right:number}[]=[{left:900,right:Math.max(1550,...s.buildings.filter(b=>b.kind==='wall'&&b.region<0&&b.level&&b.hp>0).map(b=>b.x))}];
        for(const c of s.camps)if(c.claimed&&c.defeated){const wall=s.buildings.find(b=>b.kind==='wall'&&b.region===c.index&&b.hp>0);if(wall)sections.push({left:c.index?RULES.camps[c.index-1].x+RULES.camps[c.index-1].width/2:sections[0].right,right:wall.x});}
        for(let k=0;k<sections.length;k++)for(let x=Math.ceil(sections[k].left/430)*430;x<sections[k].right;x+=430){
            if(!this.inView(x)||s.buildings.some(b=>b.level&&Math.abs(b.x-x)<105))continue;
            p.sprite('occupied:'+k+':'+x,this.art.frames.has('territory_marker')?'territory_marker':'tribal_banner',this.screen(x),g+2,69,{layer:3,tint:this.light(),face:x%860?1:-1});
        }
    }
    private band(asset: string, width: number, y: number, height: number, factor: number, layer: number, tint: Color, flow = 0, alpha = 1): void {
        const offset = this.camera * factor + flow;
        const first = Math.floor((offset - this.width / 2) / width) - 1;
        for (let i = first; i < first + Math.ceil(this.width / width) + 3; i++) {
            const x = i * width - offset + this.width / 2 + width / 2;
            this.painter.sprite(`band:${asset}:${layer}:${alpha}:${i}`, asset, x, y, height, { layer, width: width + 1, anchorX: .5, anchorY: 0, face: i % 2 ? -1 : 1, tint, alpha });
        }
    }
    private buildingArt(b: Building): [string, number] {
        const level = Math.max(1, b.job?.next || b.level);
        switch (b.kind) {
            case 'hall': return [`hall${level}`, 188 + level * 9];
            case 'treasury': return [this.art.frames.has('open_chest') ? 'open_chest' : 'chest', 70];
            case 'prison': return [level===1?'prison_back1':level===2?'prison_back':'prison_back3', prisonLayout(level,this.model.state.enemies.filter(e=>e.state==='captured')).height];
            case 'worker': return ['empty_tool_worker', 126];
            case 'hunter': return ['empty_tool_hunter', 132];
            case 'brute': return ['empty_tool_brute', 126];
            case 'lure': return [this.art.frames.has('lure') ? 'lure' : 'build_site_sign', 92 + level * 7];
            case 'wall': return [`wall${level}`, 98 + level * 23];
            case 'tower': return [level>=3?'tower'+level:level === 1 ? 'tower' : 'tower2', 170 + level * 15];
            case 'net': return [level === 1 ? 'net_trap' : 'net_trap2', 142];
            case 'rock': return [level === 1 ? 'rock_trap' : 'rock_trap2', 140];
            case 'farm': return ['mushroom_farm', 138];
            case 'wood': return ['woodcut_camp', 148];
            case 'mine': return ['gold_mine', 150];
            case 'forge': return [this.art.frames.has('forge') ? 'forge' : 'woodcut_camp', 122];
            case 'gear': return [this.model.state.gearStock>0?'gear_pile':'open_chest',this.model.state.gearStock>0?44:38];
            case 'repair': return [this.art.frames.has('repair') ? 'repair' : 'woodcut_camp', 158];
            case 'flag': {
                const e = this.model.state.expedition;
                const pulse = e.state === 'gather' && e.beats && e.beatAt !== undefined
                    ? clamp((e.beatAt - this.model.state.elapsed - RULES.drumBeatSeconds + .13) / .13, 0, 1) : 0;
                return ['war_drum', 43 - 2 * pulse];
            }
            default: return ['build_site_sign', 60];
        }
    }
    private building(b: Building): void {
        const p = this.painter, x = this.screen(b.x), y = this.ground + 3, selected = this.context?.id === b.id;
        const guided = this.isGuideTarget(b.id);
        const [art, height] = this.buildingArt(b);
        const cage=b.kind==='prison'?prisonLayout(Math.max(1,b.job?.next||b.level),this.model.state.enemies.filter(e=>e.state==='captured')):undefined;
        const cageWidth=cage?.width;
        const unbuilt = !b.level && !b.job, ghost = unbuilt || !!b.job;
        const layer = b.kind === 'treasury' ? 5 : 4;
        if (unbuilt && !selected && !guided) { p.sprite(`stake${b.id}`, 'build_site_sign', x, y, 62, { layer: 4, tint: this.light() }); return; }
        if (b.hp <= 0 && b.maxHp > 0 && b.level && !b.job) {
            p.sprite(`ruin${b.id}`, 'hall_ruin', x, y, 62, { layer: 4, tint: this.light() });
        } else {
            p.sprite(`building${b.id}${b.kind==='flag'?':'+b.x:''}`, art, x, y, height, { layer, width:cageWidth,alpha: ghost ? .38 : 1, tint: this.light() });
            if (!ghost && !['gear','flag'].includes(b.kind)) p.sprite(`buildingReflection${b.id}`,art,x,y+64,height*.7,{layer:9,mirrorY:true,alpha:.10,tint:new Color(90,145,157)});
            if ((selected || guided) && this.art.glowReady(art)) p.sprite(`buildingGlow${b.id}`, `${art}__glow`, x, y, height, { layer,width:cageWidth, alpha: .8 + .18 * Math.sin(this.model.state.elapsed * 3) });
        }
        const materialUpgrade=['worker','hunter','brute','lure','forge','repair','farm','wood','mine','flag','prison'].includes(b.kind);
        // 施工虚影也预览下一阶材质，三级装备台对应主厅五级的铁制工坊。
        const materialLevel=b.kind==='forge'?[0,1,3,5][b.job?.next||b.level]:(b.job?.next||b.level);
        if(materialUpgrade&&materialLevel>=2&&!unbuilt&&(b.hp>0||b.maxHp===0||b.job)){
            const width=b.kind==='prison'?cageWidth:Math.min(220,this.art.info(art).width/this.art.info(art).contentHeight*height+20);
            const material=(key:string,asset:string,yy:number,h:number,w:number)=>{
                p.sprite(key+b.id,asset,x,yy,h,{layer:4,width:w,tint:this.light(),alpha:ghost?.38:1});
                if(selected&&this.art.glowReady(asset))p.sprite(key+'Glow'+b.id,asset+'__glow',x,yy,h,{layer:4,width:w,alpha:.8+.18*Math.sin(this.model.state.elapsed*3)});
            };
            if(materialLevel<=3)material('timberFrame','timber_frame',y,b.kind==='prison'?height:height*.88,width+8);
            if(materialLevel>=3)material('stoneBase','stone_plinth',y,32,width);
            if(materialLevel>=4)material('ironFrame','metal_workframe',y,b.kind==='prison'?height:height*.9,width+10);
            if(materialLevel>=5)material('ironRoof','metal_roof',y-height+28,40,width+20);
        }
        if (b.kind === 'treasury') {
            const bank=this.model.state.treasury,count = Math.min(60, bank), baseY = y - 14;
            for (let i = 0; i < count; i++) {
                const row = Math.floor(i / 8), col = i % 8;
                p.sprite(`treasuryCoin${i}`, 'coin', x - 37 + col * 10 + Math.sin(i * 9) * 3, baseY - row * (7+Math.min(4,Math.log2(Math.max(1,bank/60)))), 14, { layer: 4, angle: Math.sin(i * 7) * 35 });
            }
            if (this.art.frames.has('chest_front')) p.sprite(`chestFront${b.id}`, 'chest_front', x, y, height*this.art.info('chest_front').contentHeight/this.art.info('open_chest').contentHeight, { layer: 4 });
        }
        if (b.kind === 'prison' && !unbuilt) {
            const prisoners = this.model.state.enemies.filter(e => e.state === 'captured').slice(0, RULES.prisonCapacity[b.level]);
            for (let i = 0; i < prisoners.length; i++) {
                const enemy = prisoners[i], name = this.prisonerArt(enemy);
                p.sprite(`captive${enemy.id}`, name, x+cage.slotX(i), y+cage.slotY(i), captiveHeight(enemy), { layer: 4, face: i % 2 ? 1 : -1, tint: this.light(true) });
            }
            if(b.level>=3)p.sprite('cageMiddleFloor','cage_divider',x,y-cage.pitch-7,8,{layer:4,width:cageWidth-24});
            const front = b.level === 1 ? 'prison_front1' : b.level === 2 ? 'prison_front' : 'prison_front3';
            p.sprite(`prisonFront${b.id}`, front, x, y, height, { layer: 4,width:cageWidth, tint: this.light() });
        }
        if (['worker', 'hunter', 'brute'].includes(b.kind)) {
            const tool = b.kind === 'worker' ? 'hammer' : b.kind === 'hunter' ? 'bow' : 'club';
            for (let i = 0; i < Math.min(RULES.toolCapacity[b.level], b.stock); i++) p.sprite(`stock${b.id}:${i}`, tool, x - 32 + i%4 * 24, y - 40-Math.floor(i/4)*32, 36, { layer: 4, angle: b.kind === 'worker' ? -18 : 0 });
        }
        if (b.kind === 'lure') for (let i = 0; i < b.stock; i++) p.sprite(`bait${b.id}:${i}`, 'coin', x - 24 + i % 5 * 12, y - 36 - Math.floor(i / 5) * 9, 15, { layer: 4 });
        if((b.kind==='forge'&&!this.model.flag.level||b.kind==='flag'&&b.level)&&this.model.state.equipmentStock){
            const tier=this.model.forge.level,base=b.kind==='flag'?x+48:x;
            if(b.kind==='flag')p.sprite('fieldEquipmentChest','open_chest',base,y,38,{layer:4});
            for(let i=0;i<Math.min(3,this.model.state.equipmentStock);i++)p.sprite(`equipmentStock${i}`,'armor_item',base-24+i*24,y-28,31,{layer:4,angle:-8,tint:tier===3?new Color(110,155,255):tier===2?new Color(240,240,235):new Color(192,143,92)});
        }
        if (b.kind === 'gear' && this.model.state.gearStock) {
            for (let i = 0; i < Math.min(8, this.model.state.gearStock); i++) p.sprite(`loot${i}`, i % 2 ? 'club' : 'bow', x - 30 + i % 4 * 20, y - Math.floor(i / 4) * 13, 31, { layer: 4, angle: i % 2 ? 28 : -25 });
        }
        // 等级由结构材质和真实库存体现，不再给每座设施堆同款旗帜、钱箱与缩小建筑。
        // 同源位图加装承台、备网、备石与粮床，等级改变功能部件而非只缩放整栋建筑。
        if((b.kind==='net'||b.kind==='rock')&&b.level>=3)for(let i=0;i<b.level-2;i++)p.sprite('trapReserve'+b.id+':'+i,b.kind==='net'?'net':'stone_projectile',x+45+i*22,y,b.kind==='net'?40:23,{layer:4,tint:this.light()});
        if (b.job) this.bar(`job${b.id}`, x, y - height - 15, 1 - b.job.left / b.job.total, 94, 4);
        else if (b.maxHp > 0 && b.hp < b.maxHp) this.bar(`hpBuilding${b.id}`, x, y - height - 12, b.hp / b.maxHp, 90, 4);
        if (selected && this.context) {
            const action = this.context.actions.find(a => a.key === (this.model.state.pledge?.key || this.activeAction)) || this.context.actions[0];
            if (action?.cost) this.costSlots(b.id, x, y - height - 24, action.cost, this.model.state.pledge?.targetId === b.id ? this.model.state.pledge.paid : 0);
        }
    }
    private costSlots(id: number, x: number, y: number, count: number, paid: number): void {
        const perRow = Math.min(16, count), rows = Math.ceil(count / perRow);
        for (let i = 0; i < count; i++) {
            const row = Math.floor(i / perRow), col = i % perRow, thisRow = Math.min(perRow, count - row * perRow);
            this.painter.sprite(`cost${id}:${i}`, 'coin', x + (col - (thisRow - 1) / 2) * 19, y - (rows - 1 - row) * 21, 19, { layer: 10, alpha: i < paid ? 1 : .24 + .08 * Math.sin(this.model.state.elapsed * 3), angle: -10 });
        }
    }
    private camps(): void {
        for (const c of this.model.state.camps) {
            const layout=RULES.camps[c.index];
            if (!this.inView(c.x,layout.width*.6+300)) continue;
            const x = this.screen(c.x), y = this.ground + 3;
            if (c.defeated) {
                this.painter.sprite(`campRemains${c.id}`, 'battlefield_wreck', x, y, 55, { layer: 4, tint: this.light() });
                if (!c.claimed) this.bar(`rebuild${c.id}`, x, y - 80, c.rebuild / this.model.rebuildDuration(c), 100, 4);
                continue;
            }
            if (c.index === 4 && this.art.frames.has('ship')) {
                this.painter.sprite(`ship${c.id}`, 'ship', x + 80, y + 30, 312, { layer: 4, tint: this.light() });
            } else {
                this.painter.sprite(`enemyCamp${c.id}`, 'outpost', x, y, 164 + c.index * 18, { layer: 4, tint: this.light() });
                for (let i = 0; i < 2+c.index*2; i++){
                    const tentX=c.x-layout.width*.25+i*(layout.width/(3+c.index*2));if(!this.inView(tentX,180))continue;
                    this.painter.sprite(`campTent${c.id}:${i}`, 'outpost', this.screen(tentX), y, 112 + i % 3 * 17, { layer: 4, tint: this.light(), face: i % 2 ? 1 : -1 });
                }
            }
            this.painter.sprite(`campSupply${c.id}`, 'chest', x + 130, y, 37, { layer: 4, tint: this.light() });
            this.painter.sprite(`campFlag${c.id}`, 'flag', x - 110, y, 98, { layer: 4, tint: this.light() });
            if (c.hp < c.maxHp) this.bar(`campHp${c.id}`, x, y - 200 - c.index * 18, c.hp / c.maxHp, 150, 4);
        }
        for(const f of this.model.state.fortifications||[]){
            if(!this.inView(f.x,190))continue;
            if(f.hp<=0){this.painter.sprite('fortRuin'+f.id,'hall_ruin',this.screen(f.x),this.ground+3,42,{layer:4,tint:this.light()});continue;}
            const rank=f.rank||2,art=f.kind==='gate'?'wall'+Math.max(2,rank):(f.levels||1)>=3?'tower5':(f.levels||1)===2?'tower3':'tower',height=f.kind==='gate'?118+rank*18:(f.levels||1)>=3?245:(f.levels||1)===2?215:185;
            this.painter.sprite('enemyFort'+f.id,art,this.screen(f.x),this.ground+3,height,{layer:4,tint:new Color(207,219,230)});
            this.painter.sprite('enemyFortFlag'+f.id,'flag',this.screen(f.x)+24,this.ground-height+32,42,{layer:4});
            if(f.hp<f.maxHp)this.bar('fortHp'+f.id,this.screen(f.x),this.ground-height-18,f.hp/f.maxHp,92,10);
        }
    }
    private actor(key: string, asset: string, worldX: number, height: number, face: number, opts: { angle?: number; y?: number; layer?: number; alpha?: number; glow?: boolean; motion?: Motion; motionAge?: number; frameKey?: string } = {}): void {
        if (!this.inView(worldX, 140)) return;
        const p = this.painter, x = this.screen(worldX), y = opts.y ?? this.ground + 3;
        const focus=opts.glow?.9+.1*Math.sin(this.model.state.elapsed*3):0;
        const rigged=drawCutout(p,key,asset,x,y,height,face,this.model.state.elapsed,opts.motion||'idle',opts.angle||0,opts.layer??6,this.light(true),opts.alpha??1,focus,opts.motionAge);
        if(!rigged)p.sprite(key, asset, x, y, height, { layer: opts.layer ?? 6, face, angle: opts.angle, alpha: opts.alpha, tint: this.light(true), frameKey: opts.frameKey });
        if (!rigged&&opts.glow && this.art.glowReady(asset)) p.sprite(`glow:${key}`, `${asset}__glow`, x, y, height, { layer: opts.layer ?? 6, face, angle: opts.angle, alpha: focus });
        // 倒影只在水面区域，透光不改变真正角色的不透明度。
        p.sprite(`reflection:${key}`, asset, x + Math.sin(this.model.state.elapsed * 1.2 + worldX) * 2, this.ground + 65, height * .72, { layer: 9, mirrorY: true, face, alpha: .12, tint: new Color(90, 148, 159), frameKey: opts.frameKey });
    }
    private hero(interpolation: number): void {
        const s = this.model.state, hero = s.player, x = hero.prevX + (hero.x - hero.prevX) * interpolation;
        const moving = Math.abs(hero.x - hero.prevX) > .1;
        const pose = Math.floor(s.elapsed * (this.model.input.run ? 10 : 7));
        const angle = hero.whip > 0 ? (Math.floor(hero.whip * 12) % 2 ? -10 : 6) * hero.face : moving ? (pose % 2 ? 1.2 : -1.2) * hero.face : 0;
        this.actor('chief', `rider_${hero.mount}`, x, hero.mount === 'bat' ? 107 : 101, hero.face, { layer: 5, y: this.ground + 3 - hero.fly, angle });
        if(hero.whip>0)this.painter.sprite('chiefWhip','icon_whip',this.screen(x)+hero.face*45,this.ground-68-hero.fly,54,{layer:7,face:hero.face,angle:hero.face*(Math.floor(hero.whip*12)%2?-55:30),alpha:Math.min(1,hero.whip*12)});
        if (hero.hurt > 0) this.bar('heroHealth', this.screen(x), this.ground - 122 - hero.fly, hero.hp / 100, 85, 10);
    }
    private drumCart(interpolation: number): void {
        const s = this.model.state, cart = s.drumCart;
        if (!cart || !this.inView(cart.x)) return;
        const x = this.screen(cart.prevX + (cart.x-cart.prevX)*interpolation), y = this.ground + 3, p = this.painter;
        const angle = -(cart.travel-(cart.x-cart.prevX)*(1-interpolation))*180/(Math.PI*14);
        p.sprite('drumCartBed','wagon',x+cart.face*26,y-15,51,{layer:4,face:-cart.face,tint:this.light()});
        for (const side of [-1,1]) p.sprite('drumCartWheel'+side,'wheel',x+side*36,y-14,28,{layer:4,anchorX:.5,anchorY:.5,angle,tint:this.light()});
        const drumming = this.model.drumPlaying;
        const beat = Math.max(0,s.elapsed-(cart.marchAt??s.elapsed)) % RULES.drumBeatSeconds;
        const height = drumming && beat < .085 ? 61 - 2*(1-beat/.085) : 61;
        const drumX = x+cart.face*13, selected = !cart.abandoned && this.context?.id===this.model.flag.id;
        p.sprite('drumCartDrum','war_drum',drumX,y-55,height,{layer:4,tint:this.light()});
        if (selected && this.art.glowReady('war_drum')) p.sprite('drumCartGlow','war_drum__glow',drumX,y-55,height,{layer:4,alpha:.8+.18*Math.sin(s.elapsed*3)});
        const action = selected && this.context?.actions.find(a=>a.type==='retreat');
        if (action) this.costSlots(action.targetId,drumX,y-136,action.cost,s.pledge?.targetId===action.targetId?s.pledge.paid:0);
    }
    private goblins(interpolation: number): void {
        const s = this.model.state;
        const cart = s.drumCart && !s.drumCart.abandoned ? s.drumCart : undefined, e = s.expedition;
        for (const n of s.goblins) {
            if (!this.inView(n.x)) continue;
            const x = n.prevX + (n.x - n.prevX) * interpolation;
            const joining=n.task==='joining',rank=(n.role==='hunter'||n.role==='brute')&&n.gear?`_${n.gear+1}`:n.role==='worker'&&this.model.hall.level>1?`_${Math.min(3,this.model.hall.level)}`:'';
            let asset = joining && this.art.frames.has('unowned') ? 'unowned' : n.role + rank;
            if (!this.art.frames.has(asset)) asset = n.role;
            const phase = Math.floor(s.elapsed * (n.speed > 110 ? 10 : 7) + n.id*.67);
            const hit = n.hit > 0 ? n.hit > .4 ? 19 : Math.floor(n.hit * 18) % 2 ? -14 : 10 : 0;
            const working=n.role==='worker'&&!!n.working&&!n.moving;
            // 举锤停一拍，再压身敲下；根部不升降，避免施工看成走路或脚底打滑。
            const workAngle=working?[-5,-5,8,1][phase%4]*n.face:0;
            const attackAge=s.elapsed-(n.attackAt??-10),attacking=n.task!=='drum'&&attackAge>=0&&attackAge<.42;
            const onCart=!!cart && e.drummer===n.id && !n.dead;
            const drumAge=onCart&&this.model.drumPlaying?Math.max(0,s.elapsed-(cart!.marchAt??s.elapsed))%RULES.drumBeatSeconds:
                n.task==='drum'&&e.state==='gather'&&e.beatAt!==undefined&&!n.moving?Math.max(0,RULES.drumBeatSeconds-e.beatAt+s.elapsed):undefined;
            const drumming=drumAge!==undefined;
            const angle=n.dead?86:n.stunned>0?82:hit||(drumming?[-9,-3,7,0][drumPose(drumAge)]*n.face:workAngle||(attacking?[-7,-13,9,0][Math.min(3,Math.floor(attackAge/.105))]*n.face:0));
            const height = n.role === 'brute' ? 79 : n.role==='worker'?64:74;
            const tower=n.towerId?s.buildings.find(b=>b.id===n.towerId&&b.hp>0):undefined;
            const foot=onCart?this.ground+3-52:tower&&Math.abs(n.x-tower.x)<55?this.ground-this.model.towerPosition(n).height:this.ground+3;
            const motion:Motion=n.dead?'dead':n.stunned>0?'stun':n.hit>0?'hit':drumming?'drum':working?'work':cart&&n.task==='drumPull'&&n.moving?'pull':n.task==='haul'?'haul':attacking?'attack':n.moving?n.speed>110?'run':'walk':'idle';
            this.actor(`goblin${n.id}`, asset, x, height, n.face, { angle,motion,motionAge:drumming?drumAge:attacking?attackAge:undefined,y:n.dead||n.stunned>0?foot-21:foot, alpha: n.dead ? .45 : 1, glow: this.context?.id === n.id||this.model.isWhipTarget(n.id)||this.isGuideTarget(n.id) });
            if(n.loot>0)this.painter.sprite(`carriedLoot${n.id}`,'bow',this.screen(x)-n.face*17,this.ground-35,35,{layer:6,face:n.face,angle:-28*n.face});
            if (!n.dead&&(n.hidden > 0||n.carry>0)) {
                // 配件锚在腰部并随整身转向、受击旋转，不能悬在头顶或沿用地面绝对坐标。
                const rad=angle*Math.PI/180,dx=-height*.17*n.face,dy=-height*.43;
                const rootY=n.stunned>0?this.ground-18:foot;
                this.painter.sprite(`pocket${n.id}`,'pocket',this.screen(x)+dx*Math.cos(rad)+dy*Math.sin(rad),rootY-dx*Math.sin(rad)+dy*Math.cos(rad),height*(n.hidden>0?.25:.20),{layer:6,face:n.face,angle,anchorX:.5,anchorY:.5});
            }
            if (n.carry > 0) this.painter.sprite(`carry${n.id}`, 'coin', this.screen(x), foot-height-4, 23, { layer: 10 });
            if (n.hp < n.maxHp && !n.dead) this.bar(`health${n.id}`, this.screen(x), this.ground - 86, n.hp / n.maxHp, 48, 10);
            if (n.order !== 'home'&&!n.dead&&n.role!=='worker') this.painter.sprite(`enlisted${n.id}`, 'tribal_banner', this.screen(x)-12*n.face, foot-height*.90, 29, { layer: 10,face:n.face,angle:-9*n.face });
            if (n.stunned > 0) for (let i = 0; i < 3; i++) this.painter.sprite(`stun${n.id}:${i}`, 'coin', this.screen(x) + Math.sin(s.elapsed * 3 + i * 2) * 20, this.ground - 73 + Math.cos(s.elapsed * 3 + i * 2) * 5, 8, { layer: 10, alpha: .7 });
        }
    }
    private prisonerArt(e: Enemy): string { return e.kind === 'elf' ? 'captive_elf' : e.kind === 'dwarf' ? 'captive_dwarf' : 'captive_human'; }
    /** 拖行按旋转后贴纸的实际边界贴地，不让大个子沿用普通兵的固定抬高量。 */
    private draggedFoot(asset:string,height:number,face:number,angle:number):number{
        const info=this.art.info(asset),scale=height/info.contentHeight,pad=(info.height-info.contentHeight)/2;
        const rad=angle*Math.PI/180,sin=Math.sin(rad),cos=Math.cos(rad),flip=face*(info.facing||1);
        let bottom=-Infinity;
        for(const px of [pad,info.width-pad])for(const py of [pad,info.height-pad]){
            const dx=(px-info.width*info.anchorX)*scale*flip,dy=(info.height-py-info.height*info.anchorY)*scale;
            bottom=Math.max(bottom,-dx*sin-dy*cos);
        }
        return this.ground+3-bottom;
    }
    private heroPose(e: Enemy, age: number, lead: number, attacking: boolean): string | undefined {
        const hero = HEROES[e.hero || ''];
        if (!hero || e.jump || e.stripped || e.state !== 'active') return;
        const elapsed = this.model.state.elapsed;
        if (hero.skill === 'slam') {
            if (e.windup?.kind === 'slam') {
                const progress = 1 - e.windup.left / e.windup.total;
                return `enemyPose:elite_heavy:${progress < .42 ? 0 : progress < .88 ? 1 : 2}`;
            }
            if (attacking && e.attackStyle === 'slam') return `enemyPose:elite_heavy:${age < .15 ? 3 : 2}`;
        }
        if (hero.skill === 'charge') {
            const actor = e.hero === 'fleet_boss' ? 'fleet' : 'elite_charger';
            if (attacking && e.attackStyle === 'melee') return `enemyPose:${actor}:${e.strike ? 0 : 2}`;
            const remaining = (e.boostedUntil ?? 0) - elapsed;
            if (remaining > 0 && e.moving) return `enemyPose:${actor}:${remaining > 1.66 ? 0 : 1}`;
        }
        if (hero.skill === 'engineer') {
            const since = elapsed - (e.repairAt ?? -10);
            if (since >= 0 && since < .39) return `enemyPose:elite_engineer:${since < .16 ? 1 : 2}`;
            if (attacking && e.attackStyle === 'melee') return `enemyPose:elite_engineer:${e.strike ? 0 : 1}`;
        }
        if (attacking && (hero.skill === 'meteor' && e.attackStyle === 'cast' || hero.skill === 'volley' && e.attackStyle === 'bow')) {
            const beat = e.strike ? Number(age >= lead * .42) : 2;
            return `enemyPose:${hero.asset}:${beat}`;
        }
    }
    private enemies(interpolation: number): void {
        const s = this.model.state;
        const ropeEnds = new Map<number, number>();
        const nearStrong=s.enemies.filter(e=>e.hero&&e.state==='active').sort((a,b)=>Math.abs(a.x-s.player.x)-Math.abs(b.x-s.player.x)).slice(0,2);
        for (const e of s.enemies) {
            if (!this.inView(e.x) || e.state === 'captured' || e.state === 'gone' || e.state === 'sold') continue;
            const x = e.prevX + (e.x - e.prevX) * interpolation;
            if (e.state === 'bound') {
                const carrier = s.goblins.find(n => n.id === e.hauler && !n.dead);
                const face=carrier?.face||-1,height=captiveHeight(e);
                const art=this.prisonerArt(e),angle=76*face;
                this.actor(`bound${e.id}`, art, x, height, face, { angle,y:this.draggedFoot(art,height,face,angle) });
                this.painter.sprite(`net${e.id}`, 'net', this.screen(x)-face*height*.45, this.ground + 4, 69*height/77, { layer: 7, alpha: .7 });
                if (carrier) {
                    const end = ropeEnds.get(carrier.id) ?? carrier.prevX + (carrier.x - carrier.prevX) * interpolation;
                    this.painter.sprite(`rope${e.id}`, 'rope', this.screen((end + x) / 2), this.ground - 17, 5, { layer: 7, width: Math.abs(end - x), anchorX: .5 });
                    ropeEnds.set(carrier.id, x);
                }
                continue;
            }
            const strong=HEROES[e.hero||''];
            const style = e.attackStyle, lead = style ? ATTACK_LEAD[style] : 0;
            const age = s.elapsed - (e.attackAt ?? -10);
            const attacking = !!style && age >= 0 && age < lead + ATTACK_RECOVERY;
            const armed = e.ammo > 0 || !!e.towerId || (attacking && style === 'bow');
            let asset: string = strong?.asset || (e.kind === 'jumper' ? 'elite_jumper' : e.kind === 'elf' && !armed ? 'elf_melee' : e.kind);
            const base = e.kind === 'elf' ? 'elf' : e.kind === 'dwarf' ? 'dwarf' : 'human';
            if (e.state === 'wounded' || e.state === 'dead') asset = `${base}_${e.state}`;
            if (e.stripped) asset = this.prisonerArt(e);
            if (!this.art.frames.has(asset)) asset = base;
            const fallen=e.state==='wounded'||e.state==='dead';
            const phase = Math.floor(s.elapsed * 9 + e.id);
            let attackAngle = 0, lunge = 0;
            const candidate = this.heroPose(e, age, lead, attacking);
            const skillPose = candidate && this.art.frames.has(candidate) ? candidate : undefined;
            if (skillPose) asset = skillPose;
            else if (attacking && !fallen && !e.stripped && style && !e.jump) {
                const beat = age < lead ? Math.floor(age / lead * 3) : 3 + Math.min(2, Math.floor((age - lead) / ATTACK_RECOVERY * 3));
                const pose = `enemyPose:${asset}:${beat}`;
                if (this.art.frames.has(pose)) asset = pose;
                else {
                    attackAngle = ATTACK_TILT[style][style === 'slam' ? beat - 3 : beat] * e.face;
                    lunge = age >= lead && (style === 'melee' || style === 'slam') ? ((style === 'slam' ? 26 : 6) - (beat - 3) * 2) * e.face : 0;
                }
            }
            const windupAngle = e.windup?.kind === 'slam' ? [-17,-31,-44,-51][Math.min(3, Math.floor((1-e.windup.left/e.windup.total)*4))] : -18;
            const brace = strong?.skill === 'ward' && s.elapsed - (e.wardCastAt ?? -10) < .22;
            const angle = e.state === 'wounded' ? (e.stripped ? 80 : 0) + (phase % 3 ? 0 : -4)
                : e.state === 'dead' && e.stripped ? 82 : skillPose ? 0 : e.windup ? windupAngle * e.face
                : brace ? -9 * e.face : attacking ? attackAngle : e.hit > 0 ? (phase % 2 ? 16 : -12) : e.moving ? (phase % 2 ? 2 : -2) * e.face : 0;
            const lift=e.jump?Math.sin((1-e.jump.left/e.jump.total)*Math.PI)*125:0,towerLift=e.towerId?this.model.enemyTowerPosition(e).height:0;
            const height = captiveHeight(e), foot = this.ground + 3 - lift - towerLift;
            const repairing = skillPose && e.repairAt !== undefined && s.elapsed - e.repairAt < .39;
            const face = repairing ? Math.sign((e.repairX ?? e.x) - e.x) || e.face : e.face;
            this.actor(`enemy${e.id}`, asset, x + lunge, fallen && !e.stripped ? 40*height/77 : height, face, { angle,y:fallen&&e.stripped?this.ground-18:foot, alpha: e.state === 'dead' ? .66 : 1, frameKey: fallen ? undefined : 'combat', glow: this.context?.id === e.id });
            if (!fallen) this.heroSkillEffects(e, skillPose, this.screen(x), foot, height, age, lead);
            if(e.hero&&!fallen){
                this.painter.sprite('heroInsignia'+e.id,'flag',this.screen(x)+20,this.ground-captiveHeight(e)+3-towerLift,25,{layer:10});
                if(strong?.boss||nearStrong.includes(e))this.painter.text('heroName'+e.id,strong?.name||'',this.screen(x),this.ground-captiveHeight(e)-27-(e.id%2)*14-towerLift,strong?.boss?22:17,{layer:10,width:210,color:new Color(255,211,195)});
            }
            if (e.snared > 0) this.painter.sprite(`snare${e.id}`, 'net', this.screen(x), this.ground + 3, 65, { layer: 7, alpha: .65 });
            if (e.hp > 0 && e.hp < e.maxHp) this.bar(`enemyHp${e.id}`, this.screen(x), this.ground-captiveHeight(e)-9-towerLift, e.hp / e.maxHp, strong?.boss?110:strong?65:45, 10);
        }
    }
    private heroSkillEffects(e: Enemy, pose: string | undefined, x: number, foot: number, height: number, age: number, lead: number): void {
        const elapsed = this.model.state.elapsed;
        const ward = Math.max(e.wardAt ?? -10, e.wardCastAt ?? -10);
        const wardAge = elapsed - ward;
        if (wardAge >= 0 && wardAge < .45) {
            const caster = e.wardCastAt === ward;
            this.painter.sprite(`enemyWard${e.id}`, 'fxWard', x + (caster ? e.face * height * .23 : 0), foot - height * .56,
                height * (caster ? .88 : .70), { layer: 8, anchorY: .5, alpha: Math.min(1, wardAge * 22, (.45 - wardAge) * 6) });
        }
        if (pose?.startsWith('enemyPose:elite_pyromancer:')) {
            const beat = Number(pose.slice(-1)), [dx, dy] = CAST_GEM[beat];
            const size = e.hero === 'fire_boss' ? 1.35 : 1;
            const alpha = Math.max(0, Math.min(1, age * 13, (lead + ATTACK_RECOVERY - age) * 10));
            this.painter.sprite(`enemyStaff${e.id}`, 'fxStaffFire', x - dx * e.face * height, foot - dy * height,
                height * (.24 + beat * .04) * size, { layer: 8, anchorY: .5, alpha });
        }
    }
    private machines(interpolation: number): void {
        for (const m of this.model.state.machines) {
            if (m.hp <= 0 || m.order==='reserve' || !this.inView(m.x)) continue;
            const asset = this.art.frames.has(m.kind) ? m.kind : 'rock_trap2';
            this.painter.sprite(`machine${m.id}`, asset, this.screen(m.prevX + (m.x - m.prevX) * interpolation), this.ground + 3, m.kind === 'ram' ? 105 : 128, { layer: 4, face: m.owner === 'enemy' ? -1 : 1, tint: this.light() });
            if ((this.context?.id === m.id || this.isGuideTarget(m.id)) && this.art.glowReady(asset)) this.painter.sprite(`machineGlow${m.id}`, `${asset}__glow`, this.screen(m.x), this.ground + 3, m.kind === 'ram' ? 105 : 128, { layer: 4, alpha: .8 });
        }
    }
    private animals(): void {
        for (const a of this.model.state.animals) {
            if (!this.inView(a.x) || a.hp <= 0 || !this.art.frames.has(a.kind)) continue;
            this.painter.sprite(`animal${a.id}`, a.kind, this.screen(a.x), this.ground + 2, a.kind === 'deer' ? 58 : 28, { layer: 6, face: a.face, tint: this.light(true), angle: a.moving ? (Math.floor(this.model.state.elapsed * 8) % 2 ? 3 : -3) : 0 });
        }
    }
    private coins(): void {
        for (const c of this.model.state.coins) {
            if (!this.inView(c.x)) continue;
            const x = this.screen(c.x), y = this.ground + 2;
            this.painter.sprite(`coin${c.id}`, 'coin', x, y, 27, { layer: 7, angle: Math.sin(c.age * 4) * 5 });
            this.painter.sprite(`coinBreath${c.id}`, 'coin', x, y + 2, 36, { layer: 6, alpha: .12 + .1 * Math.sin(c.age * 3) });
        }
        for(const item of this.model.state.gearDrops||[])if(this.inView(item.x))this.painter.sprite(`droppedGear${item.id}`,'armor_item',this.screen(item.x),this.ground-2-Math.max(0,Math.sin(Math.min(1,item.age/.6)*Math.PI)*25),32,{layer:7,angle:item.age<.6?item.age*70:22});
    }
    private trader(interpolation=1):void{
        const t = this.model.state.trader;
        if (t.phase === 'away') return;
        const worldX = (t.prevX ?? t.x) + (t.x - (t.prevX ?? t.x)) * interpolation;
        const pulling = t.phase === 'arriving' || t.phase === 'leaving';
        const turning = t.phase === 'turning', cartFace = t.phase === 'leaving' || t.phase === 'arriving' && t.x > (t.prevX ?? t.x) ? 1 : -1;
        const cartWorldX = turning ? t.cartX! : worldX - cartFace * TRADER_CART_OFFSET;
        if (!this.inView(worldX) && !this.inView(cartWorldX)) return;
        const cartX = this.screen(cartWorldX), y = this.ground + 3;
        const passengers = (t.cargo || []).slice(0, 3);
        // 俘虏先画在笼内，完整车架、栏杆、车轮和拉杆一次盖在前面。
        for (const [i, passenger] of passengers.entries()) {
            const asset = this.prisonerArt({ kind: passenger.kind } as Enemy);
            const px = cartX + (i - (passengers.length - 1) / 2) * 43;
            this.painter.sprite(`traderPassenger${passenger.id}`, asset, px, y - 47, 42, { layer: 6, face: cartFace, tint: this.light(true) });
        }
        this.painter.sprite('traderCageCart', 'prison_cart', cartX, y, 108, { layer: 7, face: cartFace, tint: this.light(true) });
        this.actor('humanSlaveMerchant', pulling ? 'trader_pull' : 'trader', worldX, 88, turning ? 1 : cartFace, {
            layer: 7, motion: pulling || turning ? 'walk' : 'idle', glow: this.context?.id === -100 || this.isGuideTarget(-100),
        });
    }
    private projectiles(): void {
        for (const shot of this.model.state.shots) {
            const t = Math.min(1, shot.age / shot.duration), height = shot.kind === 'arrow' || shot.kind === 'fireball' ? 20 : 130;
            const y = this.ground - (shot.fromY*(1-t)+(shot.targetY??(shot.kind==='arrow'?46:35))*t) - Math.sin(t * Math.PI) * height;
            if (shot.kind === 'arrow') this.painter.sprite(`shot${shot.id}`, 'arrow', this.screen(shot.x), y, 10, { layer: 7, face: shot.targetX > shot.fromX ? 1 : -1, angle: (1 - t * 2) * (shot.targetX > shot.fromX ? -12 : 12), alpha: shot.hit ? Math.max(0, 1 - (shot.age - shot.duration) * 8) : 1 });
            else if(shot.kind==='stone'||shot.kind==='fire')this.painter.sprite(`shot${shot.id}`, 'stone_projectile', this.screen(shot.x), y,23,{layer:7,anchorY:.5,angle:t*180,alpha:shot.hit?Math.max(0,1-(shot.age-shot.duration)*8):1});
        }
    }
    private point(x: number, y: number): [number, number] { return [x - this.width / 2, this.height / 2 - y]; }
    private ellipse(x: number, y: number, rx: number, ry: number, color: Color): void { const pos = this.point(x, y); this.fx.fillColor = color; this.fx.ellipse(pos[0], pos[1], rx, ry); this.fx.fill(); }
    private procedural(): void {
        this.fx.clear(); const s = this.model.state, g = this.ground, n = this.nightAmount();
        if(this.warmth>.01){const sunrise=s.time<60,edge=sunrise?this.width*.12:this.width*.88;for(let i=3;i>0;i--)this.ellipse(edge,g-100,this.width*.34*i/3,70*i/3,new Color(255,153,73,8*this.warmth));}
        // 实时火焰：分层连续火舌、暖光和余烬，保持非像素哑光色块。
        const fires: { x: number; y: number; size: number; alpha: number }[] = [];
        for(const shot of s.shots)if((shot.kind==='fireball'||shot.kind==='fire')&&this.inView(shot.x)){
            const t=Math.min(1,shot.age/shot.duration),x=this.screen(shot.x),y=g-(shot.fromY*(1-t)+(shot.targetY??35)*t)-Math.sin(t*Math.PI)*(shot.kind==='fireball'?20:130);
            const alpha=Math.max(0,Math.min(1,shot.age*15,(shot.duration+.18-shot.age)*8));
            this.ellipse(x,y,12,9,new Color(224,81,35,225*alpha));this.ellipse(x,y,7,6,new Color(255,209,95,240*alpha));
            fires.push({x,y:y+7,size:.46,alpha});
        }
        for (const b of s.buildings) if (['hall', 'wall', 'prison'].includes(b.kind) && b.level && b.hp > 0 && this.inView(b.x)) {
            this.painter.sprite(`torch${b.id}`, 'torch_unlit', this.screen(b.x) + 68, g - 12, 63, { layer: 4, tint: this.light() });
            if (n > .05 || b.x < 900) fires.push({ x: this.screen(b.x) + 68, y: g - 74, size: .7, alpha: b.x < 900 ? 1 : n });
        }
        for (const c of s.camps) if (!c.defeated && this.inView(c.x)) fires.push({ x: this.screen(c.x) + 90, y: g - 8, size: .65, alpha: .9 });
        for (const e of s.effects) {
            const alpha = Math.max(0, Math.min(1, e.age * 12, (e.life - e.age) * 7));
            if (e.kind === 'fire') fires.push({ x: this.screen(e.x), y: g - 4, size: 1.2, alpha });
            if (e.kind === 'warning' || e.kind === 'slamWarning' || e.kind === 'slamImpact') {
                const impact = e.kind === 'slamImpact';
                const radius = e.kind === 'warning' ? METEOR_DAMAGE_RADIUS * e.size : e.size;
                if (!this.inView(e.x, radius)) continue;
                const x = this.screen(e.x), progress = e.age / e.life;
                this.painter.sprite(`attackGround${e.id}`, 'fxAttackCrack', x, g + 11,
                    clamp(radius * (impact || e.strong ? .32 : .28), 15, 32), {
                        layer: 4, width: radius * 2, anchorX: .5, anchorY: .5,
                        tint: impact || e.strong ? WHITE : CRACK_WARNING,
                        alpha: alpha * (impact || e.strong ? 1 : .75 + .23 * progress),
                        fadeRate: impact ? 2.6 : 1
                    });
                if (impact) this.painter.sprite(`attackSparks${e.id}`, 'fxRepair', x, g - progress * 22,
                    clamp(radius * .45, 24, 45), { layer: 8, anchorY: .3, alpha, fadeRate: 2.6 });
            }
            if (e.kind === 'repairSpark' && this.inView(e.x)) this.painter.sprite(`repair${e.id}`, 'fxRepair', this.screen(e.x), g - e.size,
                37, { layer: 8, anchorY: .5, alpha });
            if (e.kind === 'hit') for (let i = 0; i < 5; i++) this.ellipse(this.screen(e.x) + Math.cos(i * 1.5) * e.age * 40, g - 45 + Math.sin(i * 1.5) * e.age * 35, 3, 2, new Color(255, 230, 160, 200 * alpha));
        }
        for (const fire of fires) {
            this.ellipse(fire.x, fire.y + 10, 30 * fire.size, 19 * fire.size, new Color(255, 165, 65, 25 * fire.alpha));
            for (let j = 0; j < 3; j++) {
                const t = s.elapsed * 4 + j * 2.4, wobble = Math.sin(t) * 4 * fire.size, h = (28 + Math.sin(t * 1.7) * 5 - j * 4) * fire.size;
                const [x, y] = this.point(fire.x, fire.y), w = (12 - j * 3) * fire.size;
                this.fx.fillColor = [new Color(223, 77, 33, 210 * fire.alpha), new Color(255, 154, 46, 235 * fire.alpha), new Color(255, 225, 126, 250 * fire.alpha)][j];
                this.fx.moveTo(x - w, y); this.fx.bezierCurveTo(x - w * 1.2, y + h * .45, x + wobble, y + h * .75, x + wobble, y + h);
                this.fx.bezierCurveTo(x + w, y + h * .45, x + w * 1.4, y + h * .15, x + w, y); this.fx.close(); this.fx.fill();
            }
            for (let j = 0; j < 3; j++) {
                const t = (s.elapsed * .6 + j / 3) % 1;
                this.ellipse(fire.x + Math.sin(j * 4 + t * 8) * 9, fire.y - t * 48, 1.2, 2, new Color(255, 211, 105, 150 * Math.sin(t * Math.PI) * fire.alpha));
            }
        }
        if (n > .01) for (let i = 0; i < 30; i++) {
            const x = ((i * 127 + s.elapsed * (3 + i % 4) - this.camera * .7) % (this.width + 100) + this.width + 100) % (this.width + 100) - 50;
            const y = g - 20 - (i % 5) * 20 + Math.sin(s.elapsed * .6 + i) * 10;
            this.ellipse(x, y, 1.6, 1.6, new Color(227, 249, 161, n * (65 + Math.sin(s.elapsed * 2 + i) * 50)));
        }
    }
    private bar(key: string, x: number, y: number, ratio: number, width: number, layer: number): void {
        this.painter.sprite(`${key}:back`, 'ui_bar', x, y, 8, { layer, width, anchorY: .5 });
        // 刚开始施工时可能不足两像素，禁止负宽导致填充反向翻出底板。
        const fill = Math.max(0, width * clamp(ratio, 0, 1) - 2);
        if (fill > 0) this.painter.sprite(`${key}:fill`, 'ui_bar_fill', x - width / 2 + 1 + fill / 2, y, 4, { layer, width: fill, anchorY: .5 });
    }
    private hud(dt: number): void {
        const p = this.painter, s = this.model.state, W = this.width;
        // 钱袋内每一枚金币独立落下，袋身透明，口沿保持实心。
        p.sprite('purseBody', 'purse', 78, 104, 96, { layer: 12, alpha: .30 });
        while (this.uiCoins.length < Math.min(50, s.gold)) { const i = this.uiCoins.length; this.uiCoins.push({ x: 78 + Math.sin(i * 11.71) * 25, y: this.purseReady?33-i%5*6:91-Math.floor(i/8)*7, vx: Math.sin(i * 7) * 12, vy: 0, angle: Math.sin(i * 9) * 35 }); }
        this.purseReady=true;
        while (this.uiCoins.length > Math.max(0, Math.min(50, s.gold))) this.uiCoins.pop();
        for (let i = 0; i < this.uiCoins.length; i++) {
            const coin = this.uiCoins[i], row = Math.floor(i / 8), floor = 91 - row * 7;
            coin.vy += dt * 360; coin.y = Math.min(floor, coin.y + coin.vy * dt); coin.x = clamp(coin.x + coin.vx * dt, 48, 104);
            if (coin.y >= floor) { coin.vy = 0; coin.vx *= .8; }
            p.sprite(`purseCoin${i}`, 'coin', coin.x, coin.y, 14, { layer: 12, angle: coin.angle });
        }
        p.sprite('purseRim', 'purse_rim', 78, 40, 32, { layer: 12 });
        p.text('goldCount', `${s.gold}`, 78, 24, 22, { color: new Color(255, 237, 187) });
        for(let i=0;i<4;i++){
            const role=(['idle','worker','hunter','brute'] as const)[i],x=29+i*58,count=s.goblins.filter(n=>!n.dead&&n.role===role).length;
            p.sprite('rolePortrait'+role,role,x,163,28,{layer:12});p.text('roleCount'+role,String(count),x+25,150,18,{width:35});
            if((s.populationPending[role]||0)>0)p.text('roleReserve'+role,'+'+s.populationPending[role],x+25,171,13,{width:35,color:new Color(255,220,145)});
        }
        p.sprite('heart', 'heart_icon', 148, 44, 23, { layer: 12 });
        p.text('hp', `${Math.ceil(s.player.hp)}/${Math.round(this.model.playerMaxHp)}`, 200, 34, 21);
        p.sprite('popIcon', 'idle', 268, 49, 36, { layer: 12 }); p.text('population', `${this.model.population}/${this.model.populationLimit}`, 319, 34, 23);
        const day = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'][s.day - 1] || String(s.day);
        p.sprite('clock', 'cycle_dial', W - 153, 116, 108, { layer: 12 });
        p.text('day', day, W - 153, 65, 29);
        if (this.model.truceSeconds && s.status === 'playing') p.text('truce', '停袭中', W - 153, 126, 16);
        const t = s.time / RULES.daySeconds * Math.PI * 2 - Math.PI / 2;
        p.sprite('clockOrb', this.model.night ? 'moon' : 'sun', W - 153 + Math.cos(t) * 42, 65 + Math.sin(t) * 42 + 8, 18, { layer: 12 });
        if (this.context && this.context.kind !== 'goblin' && !this.chapter?.guide) {
            p.sprite('contextBase', 'ui_tag_v5', W / 2, 94, 70, { layer: 12, width: 376, anchorY: 0 });
            p.text('contextTitle', this.context.name, W / 2, 45, 26);
            if(this.context.kind==='treasury'){
                p.text('treasuryAmount',String(this.context.amount||0),W/2-12,73,21);p.sprite('treasuryAmountCoin','coin',W/2+34,84,23,{layer:12});
            }else p.text('contextDescription', this.context.description, W / 2, 73, 16);
        }
        if(this.model.notice&&s.elapsed<this.model.notice.until){p.sprite('noticeBase','ui_tag_v5',W-172,this.height-260,45,{layer:12,width:220});p.text('notice',this.model.notice.text,W-172,this.height-283,22,{width:210});}
        if (this.model.waitingForSiege || this.model.waitingForDrum) {
            p.sprite('siegeWaitBase', 'ui_tag_v5', W / 2, this.height - 34, 44, { layer: 12, width: 238 });
            p.text('siegeWait', this.model.waitingForSiege?'等待攻城器械跟上':'等待战鼓车跟上', W / 2, this.height - 57, 20, { width: 226 });
        }
        if (this.model.state.status !== 'playing' && !this.chapter?.blocks) {
            p.sprite('resultBase', 'ui_panel_v5', W / 2, this.height / 2 + 110, 245, { layer: 13, width: 550 });
            p.text('resultTitle', s.status === 'won' ? '运兵船归哥布林了' : '首领倒下了', W / 2, this.height / 2 - 70, 38, { layer: 13, color: new Color(87, 52, 33) });
            p.text('resultDetails', `第${s.day}日  击倒${s.kills}人  售出${s.sold}名俘虏`, W / 2, this.height / 2 - 12, 22, { layer: 13, color: new Color(94, 67, 47) });
            if (s.status === 'lost') p.text('resultLosses', '整顿部落会损失半数设施和居民，金币清空',
                W / 2, this.height / 2 + 20, 18, {layer:13,color:new Color(94,67,47)});
        }
    }
    private foreground(): void { this.band('foreground', 1100, this.height + 7, 83, 1.12, 11, new Color(78, 104, 95), 0, .9); }
}
