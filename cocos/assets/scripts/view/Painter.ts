import { Node, Sprite, UITransform, UIOpacity, Layers, Color, Label } from 'cc';
import { ArtBank } from './ArtBank';
import { Visibility } from './Transitions';
interface Drawn { node: Node; fade: Visibility; touched: number; alpha: number; shownAlpha: number; transform:UITransform;opacity:UIOpacity; sprite?: Sprite; label?: Label; fadeRate?: number; }
export interface DrawOptions { alpha?: number; face?: number; angle?: number; tint?: Color; width?: number; anchorX?: number; anchorY?: number; mirrorY?: boolean; layer?: number; frameKey?: string; fadeRate?: number; scale?: number; }
/** 复用节点并统一显隐；图片层级与文本坐标都使用同一设计分辨率。 */
export class Painter {
    nodes = new Map<string, Drawn>();
    layers: Node[] = [];
    epoch = 0;
    width = 1280; height = 600;
    private order: number[] = new Array(14).fill(0);
    constructor(public root: Node, public art: ArtBank) {
        for (let i = 0; i < 14; i++) { const layer = new Node(`Layer${i}`); layer.layer = Layers.Enum.UI_2D; root.addChild(layer); layer.addComponent(UITransform); this.layers.push(layer); }
    }
    begin(width: number, height: number): void { this.epoch++; this.width = width; this.height = height; this.order.fill(0); }
    private obtain(key: string, layer: number, text = false): Drawn {
        let value = this.nodes.get(key);
        if (!value) {
            const node = new Node(key); node.layer = Layers.Enum.UI_2D; this.layers[layer].addChild(node);
            const transform=node.addComponent(UITransform),opacity=node.addComponent(UIOpacity);
            value = { node, fade: new Visibility(), touched: this.epoch, alpha: 1, shownAlpha: 1,transform,opacity };
            if (text) {
                value.label = node.addComponent(Label);
                value.label.font = this.art.font;
                // 整行栅格化，避免共享字形图集用满后新字符消失。
                value.label.cacheMode = Label.CacheMode.BITMAP;
                value.label.enableWrapText = false;
            }
            else { value.sprite = node.addComponent(Sprite); value.sprite.sizeMode = Sprite.SizeMode.CUSTOM; value.sprite.trim = false; }
            this.nodes.set(key, value);
        }
        value.touched = this.epoch; value.fade.set(true);
        const order = this.order[layer]++;
        if (value.node.getSiblingIndex() !== order) value.node.setSiblingIndex(order);
        return value;
    }
    sprite(key: string, asset: string, x: number, y: number, height: number, options: DrawOptions = {}): Node {
        const layer = options.layer ?? 4, info = this.art.info(asset), frame = this.art.get(asset);
        // 一个动作的连续姿势共用节点和透明度，避免新旧姿势叠成重影。
        const drawn = this.obtain(`${key}@${options.frameKey ?? asset}`, layer);
        const scale = height / Math.max(1, info.contentHeight);
        if(drawn.sprite!.spriteFrame!==frame)drawn.sprite!.spriteFrame=frame;
        const material=this.art.materialFor(asset);if(drawn.sprite!.customMaterial!==material)drawn.sprite!.customMaterial=material;
        const tint=options.tint||Color.WHITE;if(!drawn.sprite!.color.equals(tint))drawn.sprite!.color=tint;
        const transform=drawn.transform;
        const w=options.width??info.width*scale,h=info.height*scale;if(transform.width!==w||transform.height!==h)transform.setContentSize(w,h);
        const ax=options.anchorX??info.anchorX,ay=options.anchorY??info.anchorY;if(transform.anchorX!==ax||transform.anchorY!==ay)transform.setAnchorPoint(ax,ay);
        // Cocos 的变换 setter 即使值相同也会使子树失效，静态元素不重复提交。
        const px = x - this.width / 2 - this.layers[layer].position.x;
        const py = this.height / 2 - y - this.layers[layer].position.y;
        const node = drawn.node, position = node.position, sizeScale = options.scale ?? 1;
        const scaleX = (options.face || 1) * (info.facing || 1) * sizeScale;
        const scaleY = (options.mirrorY ? -1 : 1) * sizeScale, angle = options.angle || 0;
        if (position.x !== px || position.y !== py) node.setPosition(px, py, 0);
        if (node.scale.x !== scaleX || node.scale.y !== scaleY) node.setScale(scaleX, scaleY, 1);
        if (node.angle !== angle) node.angle = angle;
        drawn.alpha = options.alpha ?? 1;
        drawn.fadeRate = options.fadeRate;
        return drawn.node;
    }
    text(key: string, text: string, x: number, y: number, size: number, options: { color?: Color; alpha?: number; width?: number; layer?: number; align?: 'left' } = {}): Node {
        const d = this.obtain(`text:${key}`, options.layer ?? 12, true);
        const label = d.label!;
        if (label.string !== text) label.string = text;
        label.fontSize = size; label.lineHeight = size + 6; label.color = options.color || new Color(255, 241, 202, 255);
        label.overflow = Label.Overflow.NONE; label.horizontalAlign = options.align === 'left' ? Label.HorizontalAlign.LEFT : Label.HorizontalAlign.CENTER; label.verticalAlign = Label.VerticalAlign.CENTER;
        // 自适应文本的内容尺寸由 Cocos 排版器决定，避免每帧覆盖后重复栅格化。
        d.transform.setAnchorPoint(options.align === 'left' ? 0 : .5, .5);
        const px = x - this.width / 2, py = this.height / 2 - y;
        if (d.node.position.x !== px || d.node.position.y !== py) d.node.setPosition(px, py, 0);
        d.alpha = options.alpha ?? 1;
        return d.node;
    }
    end(dt: number): void {
        for (const [key, d] of this.nodes) {
            if (d.touched !== this.epoch) d.fade.set(false);
            const fadeDt = dt * (d.fadeRate ?? 1);
            d.shownAlpha+=(d.alpha-d.shownAlpha)*Math.min(1,fadeDt*12);
            const alpha = d.fade.tick(fadeDt) * d.shownAlpha;
            d.opacity.opacity = Math.round(Math.max(0, Math.min(1, alpha)) * 255);
            if (d.fade.value <= 0 && !d.fade.target) { d.node.destroy(); this.nodes.delete(key); }
        }
    }
}
