import { Node, Sprite, UITransform, UIOpacity, Layers, Color, Label, LabelOutline } from 'cc';
import { ArtBank } from './ArtBank';
import { Visibility } from './Transitions';
interface Drawn { node: Node; fade: Visibility; touched: number; alpha: number; shownAlpha: number; sprite?: Sprite; label?: Label; }
export interface DrawOptions { alpha?: number; face?: number; angle?: number; tint?: Color; width?: number; anchorX?: number; anchorY?: number; mirrorY?: boolean; layer?: number; }
/** 复用节点并统一显隐；图片层级与文本坐标都使用同一设计分辨率。 */
export class Painter {
    nodes = new Map<string, Drawn>();
    layers: Node[] = [];
    epoch = 0;
    width = 1280; height = 600;
    private order = new Map<number, number>();
    constructor(public root: Node, public art: ArtBank) {
        for (let i = 0; i < 14; i++) { const layer = new Node(`Layer${i}`); layer.layer = Layers.Enum.UI_2D; root.addChild(layer); layer.addComponent(UITransform); this.layers.push(layer); }
    }
    begin(width: number, height: number): void { this.epoch++; this.width = width; this.height = height; this.order.clear(); }
    private obtain(key: string, layer: number, text = false): Drawn {
        let value = this.nodes.get(key);
        if (!value) {
            const node = new Node(key); node.layer = Layers.Enum.UI_2D; this.layers[layer].addChild(node);
            node.addComponent(UITransform); node.addComponent(UIOpacity);
            value = { node, fade: new Visibility(), touched: this.epoch, alpha: 1, shownAlpha: 1 };
            if (text) { value.label = node.addComponent(Label); value.label.font = this.art.font; value.label.cacheMode = Label.CacheMode.CHAR; value.label.enableWrapText = false; }
            else { value.sprite = node.addComponent(Sprite); value.sprite.sizeMode = Sprite.SizeMode.CUSTOM; value.sprite.trim = false; }
            this.nodes.set(key, value);
        }
        value.touched = this.epoch; value.fade.set(true);
        value.node.setSiblingIndex(this.order.get(layer) || 0); this.order.set(layer, (this.order.get(layer) || 0) + 1);
        return value;
    }
    sprite(key: string, asset: string, x: number, y: number, height: number, options: DrawOptions = {}): Node {
        const layer = options.layer ?? 4, info = this.art.info(asset), frame = this.art.get(asset);
        const drawn = this.obtain(`${key}@${asset}`, layer);
        const scale = height / Math.max(1, info.contentHeight);
        drawn.sprite!.spriteFrame = frame; drawn.sprite!.color = options.tint || Color.WHITE;
        const transform = drawn.node.getComponent(UITransform)!;
        transform.setContentSize(options.width ?? info.width * scale, info.height * scale);
        transform.setAnchorPoint(options.anchorX ?? info.anchorX, options.anchorY ?? info.anchorY);
        drawn.node.setPosition(x - this.width / 2 - this.layers[layer].position.x, this.height / 2 - y - this.layers[layer].position.y, 0);
        drawn.node.setScale((options.face || 1) * (info.facing || 1), options.mirrorY ? -1 : 1, 1); drawn.node.angle = options.angle || 0;
        drawn.alpha = options.alpha ?? 1;
        return drawn.node;
    }
    text(key: string, text: string, x: number, y: number, size: number, options: { color?: Color; alpha?: number; width?: number; layer?: number } = {}): Node {
        const d = this.obtain(`text:${key}`, options.layer ?? 12, true);
        const label = d.label!;
        if (label.string !== text) label.string = text;
        label.fontSize = size; label.lineHeight = size + 6; label.color = options.color || new Color(255, 241, 202, 255);
        label.overflow = Label.Overflow.NONE; label.horizontalAlign = Label.HorizontalAlign.CENTER; label.verticalAlign = Label.VerticalAlign.CENTER;
        d.node.getComponent(UITransform)!.setContentSize(options.width || 500, size + 10);
        d.node.setPosition(x - this.width / 2, this.height / 2 - y, 0); d.alpha = options.alpha ?? 1;
        return d.node;
    }
    end(dt: number): void {
        for (const [key, d] of this.nodes) {
            if (d.touched !== this.epoch) d.fade.set(false);
            d.shownAlpha+=(d.alpha-d.shownAlpha)*Math.min(1,dt*12);
            const alpha = d.fade.tick(dt) * d.shownAlpha;
            d.node.getComponent(UIOpacity)!.opacity = Math.round(Math.max(0, Math.min(1, alpha)) * 255);
            if (d.fade.value <= 0 && !d.fade.target) { d.node.destroy(); this.nodes.delete(key); }
        }
    }
}
