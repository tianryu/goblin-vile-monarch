import { Color, Graphics, Layers, Node, UITransform } from 'cc';
import type { ChapterDirector, ChapterGuide } from '../model/ChapterDirector';
import { CHAPTER_END, CHAPTER_TITLE, DIALOGUES, SPEAKERS } from '../model/ChapterText';
import { clamp, RULES } from '../model/Rules';
import type { Action } from '../model/State';
import type { GameView } from './GameView';
import type { MenuButton } from './HangingMenu';
import { Visibility } from './Transitions';
import { getLanguage, translate } from '../i18n/Locale';

const BUTTON_LABELS: Record<string, string> = {
    withdraw: '宝箱', whip: '鞭子', recruit: '旗帜', upgrade: '锤子', cycleMount: '切换',
};
const GOLD = new Color(255, 221, 130);

/** 复用游戏木框与角色贴图，虚线路标和点按环只绘制在教学层。 */
export class ChapterView {
    private ink: Graphics;
    private route = new Visibility();
    private tap = new Visibility();
    private routeShape?: { from: number; to: number; y: number; direction: number };
    private tapShape?: { x: number; y: number; radius: number };
    private tapKey = '';

    constructor(private view: GameView, readonly director: ChapterDirector) {
        const node = new Node('ChapterGuideMarks');
        node.layer = Layers.Enum.UI_2D;
        view.painter.layers[12].addChild(node);
        node.addComponent(UITransform);
        this.ink = node.addComponent(Graphics);
    }

    get guideTargetId(): number | undefined { return this.director.guide?.target?.id; }
    get blocks(): boolean { return this.director.blocks; }
    get guide() { return this.director.guide; }

    guideControls(dt: number, allowed: boolean, cycleX: number, cycleY: number): void {
        const guide = allowed ? this.guide : undefined;
        this.ink.clear();
        this.tapKey = '';
        this.route.set(false);
        this.tap.set(false);
        if (guide) {
            const target = guide.target;
            let instruction = guide.wait || '';
            if (target) {
                const player = this.view.model.state.player;
                const distance = Math.abs(target.x - player.x);
                const limit = guide.key === 'machine' ? RULES.interactRange + 20 : RULES.interactRange;
                const direction = target.x < player.x ? -1 : 1;
                if (distance >= limit && !guide.wait) {
                    instruction = `向${direction < 0 ? '左' : '右'}走，去${guide.destination}`;
                    this.route.set(true);
                    this.routeShape = {
                        from: this.view.screen(player.x) + direction * 42,
                        to: clamp(this.view.screen(target.x), 36, this.view.width - 36),
                        y: this.view.ground + 17,
                        direction,
                    };
                    this.view.painter.text('guideMove', direction<0?'A / ←':'D / →',130,this.view.height-40,24,{layer:12,width:180,color:GOLD});
                } else if (guide.action) {
                    const action = this.view.context?.actions.slice(0, 3).find(a => a.type === guide.action && a.targetId === target.id);
                    if (action && !action.disabled) {
                        const paid = this.view.model.state.pledge?.key === action.key ? this.view.model.state.pledge.paid : 0;
                        instruction = this.actionInstruction(action, paid);
                        if (action.cost === 0 || this.view.model.state.gold > 0) this.tapKey = action.key;
                    } else if (!action && this.view.context?.id !== target.id && this.view.model.nearbyTargets > 1) {
                        instruction = '按切换按钮，选中' + guide.destination;
                        this.markButton(cycleX, cycleY, 30);
                    } else instruction = this.waitInstruction(guide);
                } else if (guide.observe) instruction = '留意' + guide.destination;
                this.targetName(guide);
            }
            if (guide.key === 'raid') {
                this.view.painter.sprite('guideRaidClock', 'ui_action_ring', this.view.width - 153, 120, 112,
                    { layer: 12, alpha: .57, tint: GOLD });
                this.view.painter.text('guideRaidDirection', '联军从右侧来袭', this.view.width - 135, this.view.ground - 124, 18);
            }
            this.card(guide, instruction);
        }
        this.drawRoute(this.route.tick(dt));
    }

    actionButton(action: Action, x: number, y: number, size: number, disabled: boolean): void {
        if (!disabled && action.key === this.tapKey) this.markButton(x, y, size * .48);
    }

    skipButtons(button: MenuButton): void {
        if (!this.guide || this.view.model.pauses.size) return;
        if (this.guide.key === 'facility:lure' || this.guide.key === 'facility:brute') return;
        const center = this.view.width / 2, y = 155;
        button('chapter:skipGuide', center - 55, y, 100, 40, true, () => this.director.skipGuide());
        button('chapter:skipAllGuides', center + 55, y, 100, 40, true, () => this.director.skipGuide(true));
        this.view.painter.text('chapterSkipGuide', '跳过这步', center - 55, y, 16, { width: 100 });
        this.view.painter.text('chapterSkipAllGuides', '跳过全部', center + 55, y, 16, { width: 100 });
    }

    afterButtons(dt: number): void {
        const alpha = this.tap.tick(dt), shape = this.tapShape;
        if (!shape || alpha <= 0) return;
        const x = shape.x - this.view.width / 2;
        const y = this.view.height / 2 - shape.y;
        this.ink.strokeColor = this.gold(alpha);
        this.ink.lineWidth = 3;
        this.ink.circle(x, y, shape.radius);
        this.ink.stroke();
        const tip = y + shape.radius + 4;
        this.ink.fillColor = this.gold(alpha);
        this.ink.moveTo(x, tip);
        this.ink.lineTo(x - 9, tip + 13);
        this.ink.lineTo(x + 9, tip + 13);
        this.ink.close();
        this.ink.fill();
        this.view.painter.text('guidePress', '按这里', shape.x, shape.y - shape.radius - 30, 19, { alpha });
    }

    dialogue(button: MenuButton): void {
        const state = this.director.dialogue;
        if (!state) return;
        const p = this.view.painter, w = this.view.width, h = this.view.height;
        const lines = DIALOGUES[state.id], page = lines[state.page];
        if (!page) return;
        const speaker = SPEAKERS[page.speaker];
        const width = Math.min(1140, w - 36), left = (w - width) / 2, bottom = h - 15, top = bottom - 180;
        p.sprite('chapterDialogueBase', 'ui_tag_v5', w / 2, bottom, 180, { layer: 13, width, anchorY: 0 });
        if (state.id === 'opening') {
            const titleWidth = getLanguage()==='en'?470:330;
            p.sprite('chapterTitleBase', 'ui_tag_v5', w / 2, 98, 67, { layer: 13, width: titleWidth, anchorY: 0 });
            p.text('chapterTitle', CHAPTER_TITLE, w / 2, 64, 28, { layer: 13, width:titleWidth-28 });
        }
        const key = state.id + ':' + state.page;
        p.sprite('chapterPortrait:' + key, speaker.portrait, left + 94, bottom - 19, 117, { layer: 13 });
        p.text('chapterSpeaker:' + key, speaker.name, left + 172, top + 37, 25,
            { layer: 13, width: 195, align: 'left' });
        this.lines('chapterLine:' + key, page.text, left + 172, top + 76, width - 340, 23, 30, 13, true);
        const nextX = left + width - 90, nextY = bottom - 46;
        button('chapter:next', nextX, nextY, 133, 52, true, () => this.director.advance());
        const label = state.id === 'ending' ? '结算' : '继续';
        p.text('chapterNextText', label, nextX, nextY, 24, { layer: 13, width: 133 });
        button('chapter:skip', w - 96, 151, 104, 43, true, () => this.director.advance(true));
        p.text('chapterSkipText', '跳过', w - 96, 151, 21, { layer: 13, width: 104 });
    }

    result(): void {
        if (this.view.model.state.status !== 'won' || this.view.menuBlocks?.()) return;
        this.view.painter.text('chapterTeaser', CHAPTER_END, this.view.width / 2, this.view.height / 2 + 30, 24,
            { layer: 13, color: new Color(94, 67, 47) });
    }

    private actionInstruction(action: Action, paid: number): string {
        if (action.cost > paid && this.view.model.state.gold === 0) return '钱袋不够，先筹些金币';
        if (action.type === 'whip') return '按 Q 抽鞭';
        const hint = translate('按 E 交互');
        return hint + (action.cost ? `  ${action.cost-paid} ` + translate('金币') : '');
    }

    private waitInstruction(guide: ChapterGuide): string {
        if (guide.action === 'dispatch') return '需要两名空闲苦工和至少一名战士';
        if (guide.action === 'sell') return '等俘虏被押到监牢';
        return '';
    }

    private markButton(x: number, y: number, radius: number): void {
        this.tapShape = { x, y, radius };
        this.tap.set(true);
    }

    private gold(alpha: number): Color { return new Color(GOLD.r, GOLD.g, GOLD.b, 255 * alpha); }

    private drawRoute(alpha: number): void {
        const shape = this.routeShape;
        if (!shape || alpha <= 0) return;
        const half = this.view.width / 2;
        const start = clamp(shape.from, 35, this.view.width - 35) - half;
        const end = shape.to - half;
        const y = this.view.height / 2 - shape.y;
        const direction = shape.direction, length = (end - start) * direction;
        if (length < 16) return;
        this.ink.strokeColor = this.gold(alpha);
        this.ink.lineWidth = 4;
        // 固定的短线与留白贯穿整段路线，箭头末端仍清楚表示方向。
        for (let d = 0; d < length - 14; d += 19) {
            this.ink.moveTo(start + d * direction, y);
            this.ink.lineTo(start + Math.min(d + 10, length - 14) * direction, y);
        }
        this.ink.moveTo(end - 13 * direction, y + 8);
        this.ink.lineTo(end, y);
        this.ink.lineTo(end - 13 * direction, y - 8);
        this.ink.stroke();
    }

    private targetName(guide: ChapterGuide): void {
        if (!guide.target || !guide.destination) return;
        const x = clamp(this.view.screen(guide.target.x), 97, this.view.width - 97);
        const markerHeight = guide.key === 'treasury' ? 103 :
            guide.key === 'hidden' || guide.key === 'rally' || guide.key === 'trade' ? 109 : 190;
        const y = this.view.ground - markerHeight;
        const p = this.view.painter;
        p.sprite('guideTargetBase', 'ui_tag_v5', x, y + 16, 38, { layer: 12, width: 177, anchorY: 0 });
        const showStock = guide.key === 'treasury' && this.view.context?.id === guide.target.id;
        if (showStock) {
            p.text('guideTargetName', guide.destination, x - 28, y - 3, 18, { width: 110 });
            p.sprite('guideTreasuryCoin', 'coin', x + 31, y + 8, 19, { layer: 12 });
            p.text('guideTreasuryStock', String(this.view.model.state.treasury), x + 58, y - 3, 18, { width: 44 });
        } else p.text('guideTargetName', guide.destination, x, y - 3, 19, { width: 177 });
    }

    private card(guide: ChapterGuide, instruction: string): void {
        const w = this.view.width, x = w / 2, width = Math.min(498, Math.max(265, w - 701)), p = this.view.painter;
        p.sprite('guideCard', 'ui_tag_v5', x, 181, 151, { layer: 12, width, anchorY: 0 });
        p.text('guideTitle:' + guide.key, guide.title, x, 52, 22, { width: width - 26 });
        if (instruction) this.lines('guideInstruction', instruction, x, 80, width - 26, 17, 19, 12);
        this.lines('guideVoice:' + guide.key, guide.line, x, instruction ? 111 : 87, width - 26, 16, 18, 12);
    }

    private lines(key: string, text: string, x: number, y: number, width: number, size: number, gap: number, layer: number, left = false): void {
        text = translate(text);
        const count = Math.max(8, Math.floor(width / (size * (getLanguage()==='en'?.52:1))));
        const rows: string[] = [];
        if (getLanguage()==='en') {
            let row='';
            for (const word of text.split(/\s+/)) {
                if (row && row.length+word.length+1 > count) {rows.push(row);row=word;}
                else row+=(row?' ':'')+word;
            }
            if(row)rows.push(row);
        } else for(let i=0;i<text.length;i+=count)rows.push(text.slice(i,i+count));
        rows.forEach((row,index)=>this.view.painter.text(key+':'+index,row,x,y+index*gap,size,{width,layer,align:left?'left':undefined}));
    }
}
