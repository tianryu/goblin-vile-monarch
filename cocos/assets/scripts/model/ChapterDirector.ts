import type { GameModel } from './GameModel';
import type { Building, Context, State } from './State';
import { BUILDINGS, RULES } from './Rules';
import { DIALOGUES, FACILITY_HINTS, STORY_HINTS } from './ChapterText';
import type { DialogueId } from './ChapterText';
import { resumeChapter } from './ChapterProgress';

export interface ChapterGuide {
    key: string;
    title: string;
    line: string;
    target?: { id: number; x: number };
    destination?: string;
    action?: string;
    wait?: string;
    observe?: boolean;
}

const OPENING_STEPS = [
    { key: 'hammer', kind: 'worker', title: '放置木锤', name: '木锤摊', action: 'tool', wait: '等待空手爪牙领走木锤' },
    { key: 'bow', kind: 'hunter', title: '放置弓箭', name: '弓箭摊', action: 'tool', wait: '等待空手爪牙领走弓箭' },
    { key: 'wall', kind: 'wall', title: '建造城墙', name: '城墙建造点', action: 'build', wait: '等待苦工建好城墙' },
    { key: 'tower', kind: 'tower', title: '建造箭塔', name: '箭塔建造点', action: 'build', wait: '等待苦工建好箭塔' },
] as const;

/** 对白和指引由真实存档状态触发。导演只写教学进度，不替玩家操作。 */
export class ChapterDirector {
    guide?: ChapterGuide;
    private lastState?: State;
    private nextCheck = 0;
    private closing = 0;
    private hint?: { guide: ChapterGuide; until: number };

    constructor(private model: GameModel, private releaseControls: () => void) {}

    get dialogue() { return this.model.state.chapter?.dialogue; }
    get blocks(): boolean { return !!this.dialogue || this.closing > 0; }

    advance(skip = false): void {
        const chapter = resumeChapter(this.model.state);
        const scene = chapter.dialogue;
        if (!scene) return;
        if (!skip && scene.page + 1 < DIALOGUES[scene.id].length) scene.page++;
        else {
            chapter.seen[scene.id] = true;
            delete chapter.dialogue;
            this.closing = .18;
            this.nextCheck = 0;
            this.releaseControls();
        }
        this.model.dirty = true;
    }

    /** 跳过只写教学偏好，不能代替实际取币、建造或出征。 */
    skipGuide(all = false): void {
        if (!this.guide) return;
        const progress = this.model.state.chapter!;
        if (all) progress.guidesSkipped = true;
        else (progress.skipped ??= {})[this.guide.key] = true;
        if (all || this.guide.key === 'hidden') delete progress.hiddenTarget;
        if (all || this.hint?.guide.key === this.guide.key) this.hint = undefined;
        this.guide = undefined;
        this.nextCheck = 0;
        this.model.dirty = true;
    }

    update(dt: number, context?: Context | null): void {
        const s = this.model.state;
        if (this.lastState !== s) {
            this.lastState = s;
            this.guide = this.hint = undefined;
            this.nextCheck = this.closing = 0;
            this.model.pause('chapter', false);
        }
        for (const pause of this.model.pauses) if (pause !== 'chapter') return;
        const progress = resumeChapter(s);
        if (progress.dialogue) {
            this.model.pause('chapter', true);
            return;
        }
        if (this.closing > 0) {
            this.closing = Math.max(0, this.closing - dt);
            if (!this.closing) this.model.pause('chapter', false);
            return;
        }
        if (s.status === 'won') {
            if (!progress.seen.ending) this.open('ending');
            this.guide = undefined;
            return;
        }
        if (s.status !== 'playing') { this.guide = undefined; return; }
        if (!progress.seen.opening) { this.open('opening'); return; }
        if (s.elapsed < this.nextCheck) return;
        this.nextCheck = s.elapsed + .15;
        if (this.hint?.guide.key === 'facility:gear' && s.gearStock <= 0 ||
            this.hint?.guide.key === 'hall' && (this.model.hall.level !== 1 || this.model.hall.job)) {
            this.hint = undefined;
        }

        const x = s.player.x;
        const danger = s.enemies.some(e => e.state === 'active' && Math.abs(e.x - x) < 470);
        const mainCamp = s.camps[3];
        const nearCommand = (position: number) => !!mainCamp && position >= mainCamp.x - 1800 && position < mainCamp.x + 800;
        if (mainCamp && !mainCamp.rewarded && !progress.seen.general &&
            (nearCommand(x) || s.goblins.some(n => !n.dead && n.order === 'expedition' && nearCommand(n.x)))) {
            this.open('general');
            return;
        }
        if (!danger && s.trader.phase === 'trading' && !progress.seen.trader && Math.abs(s.trader.x - x) < 180) {
            this.open('trader');
            return;
        }
        if (!danger && this.model.hall.level >= 2 && !progress.seen.expedition && !progress.done.dispatch) {
            this.open('expedition');
            return;
        }
        if (progress.guidesSkipped) return;
        if (this.hint && this.hint.until <= s.elapsed) this.hint = undefined;
        this.observeStory(danger);
        this.guide = this.chooseGuide(danger, context);
    }

    private open(id: DialogueId): void {
        this.model.state.chapter!.dialogue = { id, page: 0 };
        this.guide = undefined;
        this.releaseControls();
        this.model.pause('chapter', true);
        this.model.dirty = true;
    }

    private once(guide: ChapterGuide, seconds = 8): void {
        const s = this.model.state;
        if (s.chapter!.seen[guide.key] || s.chapter!.skipped?.[guide.key]) return;
        s.chapter!.seen[guide.key] = true;
        this.hint = { guide, until: s.elapsed + seconds };
        this.model.dirty = true;
    }

    private observeStory(danger: boolean): void {
        const s = this.model.state;
        const progress = s.chapter!;
        if (s.raids > 0 && !progress.seen.raid) {
            this.once({ key: 'raid', title: '联军来袭', line: STORY_HINTS.raid });
            return;
        }
        if (this.hint) return;
        if (danger) return;
        const firstWave = s.companies[0];
        const mainCamp = s.camps[3];
        const ship = s.camps[4];
        const captive = s.enemies.some(e => e.state === 'captured');
        const machine = s.machines.find(m => m.owner === 'goblin' && m.order === 'park' && m.hp > 0);
        if (mainCamp?.rewarded && ship && !ship.rewarded && !progress.seen.ship) {
            this.once({ key: 'ship', title: '夺取运兵船', line: STORY_HINTS.ship }, 5);
        } else if (firstWave && firstWave.lost >= firstWave.initial && !progress.seen.survived) {
            this.once({ key: 'survived', title: '守住第一波', line: STORY_HINTS.survived });
        } else if (captive && !progress.seen.captive) {
            this.once({ key: 'captive', title: '关押俘虏', line: STORY_HINTS.captive }, 5);
        } else if (s.camps[0]?.rewarded && !progress.seen.scout) {
            this.once({ key: 'scout', title: '守住斥候营', line: STORY_HINTS.scout }, 5);
        } else if (machine && !progress.seen.machine) {
            this.once({ key: 'machine', title: '缴获攻城器械', line: STORY_HINTS.machine }, 5);
        } else if (progress.done.tower && !progress.seen.towerReady) {
            this.once({ key: 'towerReady', title: '箭塔建成', line: STORY_HINTS.towerReady }, 5);
        } else if (progress.done.craft && !progress.seen.armorReady) {
            this.once({ key: 'armorReady', title: '护甲做好了', line: '猎手和恶霸会到改造台或战鼓旁领取护甲。' }, 5);
        }
    }

    private chooseGuide(danger: boolean, context?: Context | null): ChapterGuide | undefined {
        const s = this.model.state;
        const progress = s.chapter!;
        if (this.hint?.guide.key === 'raid') return this.hint.guide;
        if (danger) return undefined;
        if (this.hint) {
            const hint = this.hint.guide;
            const built = hint.action === 'build' && s.buildings.some(b => b.id === hint.target?.id && b.level > 0);
            if (!built) return hint;
            this.hint = undefined;
        }
        const pending = (key: string) => !progress.done[key] && !progress.skipped?.[key];
        const hasIdle = s.goblins.some(n => n.role === 'idle' && !n.dead && n.task !== 'joining');
        const needsRecruits = !hasIdle && (pending('hammer') || pending('bow'));
        const lure = needsRecruits ? s.buildings.find(b => b.kind === 'lure') : undefined;
        if (lure && pending('needIdle') && !progress.seen['facility:lure'] && !progress.skipped?.['facility:lure']) {
            const joining = s.goblins.some(n => !n.dead && n.task === 'joining');
            const full = this.model.population >= this.model.populationLimit;
            const line = joining ? '有个新爪牙正在路上。' : full ? '部落有空位后，还能继续招募。' :
                lure.stock ? STORY_HINTS.recruitWaiting : FACILITY_HINTS.lure.line;
            const guide = { key: 'facility:lure', title: BUILDINGS.lure.name, line };
            this.once(guide, 5);
            return guide;
        }
        const first = OPENING_STEPS.findIndex(step => pending(step.key) && (step.action !== 'tool' || hasIdle));
        const step = first < 0 ? undefined : OPENING_STEPS[first];
        const building = step && s.buildings.find(b => b.kind === step.kind && b.region === -1);
        const chest = s.buildings.find(b => b.kind === 'treasury');
        if (!progress.seen.treasury && !progress.skipped?.treasury && !progress.done.withdraw &&
            chest && s.treasury > 0 && s.gold < RULES.purseLimit && Math.abs(chest.x-s.player.x) < RULES.interactRange) {
            const guide = { key: 'treasury', title: '营地宝箱', line: STORY_HINTS.treasury };
            this.once(guide, 5);
            return guide;
        }

        // 只把真正的私藏标记为藏钱。被教学的角色离开或失去金币后不重新弹出。
        if (progress.done.hammer && !progress.seen.hidden && pending('hidden')) {
            const hiding = s.goblins.find(n => !n.dead && n.hidden > 0 && Math.abs(n.x - s.player.x) < 480);
            if (hiding) {
                progress.seen.hidden = true;
                progress.hiddenTarget = hiding.id;
                this.model.dirty = true;
            }
        }
        if (progress.hiddenTarget !== undefined) {
            const hiding = s.goblins.find(n => n.id === progress.hiddenTarget && !n.dead && n.hidden > 0);
            if (hiding && pending('hidden')) {
                return { key: 'hidden', title: '找回私藏的金币', line: STORY_HINTS.hidden, target: hiding, destination: '藏钱的哥布林', action: 'whip' };
            }
            delete progress.hiddenTarget;
            this.model.dirty = true;
        }

        if (step && building) {
            const waiting = !!building.job || (step.action === 'tool' && building.stock > 0);
            return {
                key: step.key, title: `${first + 1}/4  ${step.title}`, line: STORY_HINTS[step.key],
                target: building, destination: step.name, action: waiting ? undefined : step.action,
                wait: waiting ? step.wait : undefined,
            };
        }

        const trader = s.trader;
        if (!progress.seen.trade && !progress.skipped?.trade && progress.seen.trader && s.sold === 0 && trader.phase === 'trading' &&
            s.enemies.some(e => e.state === 'captured' || e.state === 'bound' && e.atPrison && !e.hauler) &&
            Math.abs(trader.x - s.player.x) < 250) {
            const guide = { key: 'trade', title: '与商人交易', line: '他会为关押的俘虏付金币。' };
            this.once(guide, 5);
            return guide;
        }

        const feature = this.firstFacility() || this.firstUpgrade(context);
        if (feature) return feature;
        const hall = this.model.hall;
        if (s.day >= 6 && hall.level === 1 && !hall.job && !progress.seen.hall && !progress.skipped?.hall &&
            s.goblins.filter(n => !n.dead && n.task !== 'joining').length > 10) {
            const built = new Set(s.buildings.filter(b => b.region === -1 && b.level > 0 && (!b.maxHp || b.hp > 0)).map(b => b.kind));
            // 常规布防和生产已成形才提议扩建。改造台等支线设施不作为门槛。
            if (built.has('wall') && built.has('tower') && built.has('farm')) {
                const guide = { key: 'hall', title: '扩建主厅', line: STORY_HINTS.hall };
                this.once(guide, 5);
                return guide;
            }
        }
        if (hall.level >= 2 && s.expedition.state === 'home' && !progress.done.dispatch &&
            !progress.seen.dispatch && !progress.skipped?.dispatch) {
            const guide = {
                key: 'dispatch', title: '敲响出征战鼓', line: '投币召集猎手和恶霸，两名苦工带着鼓车跟你出征。',
            };
            this.once(guide, 5);
            return guide;
        }
        return undefined;
    }

    private firstUpgrade(context?: Context | null): ChapterGuide | undefined {
        const building = this.model.state.buildings.find(b => b.id === context?.id);
        if (!building || ['hall', 'forge', 'brute', 'lure'].includes(building.kind) ||
            (building.kind === 'prison' && !this.model.state.enemies.some(e => e.state === 'captured')) ||
            !context?.actions.some(a => a.type === 'upgrade' && !a.disabled)) return;
        const key = `upgrade:${building.kind}:${building.level}`;
        const progress = this.model.state.chapter!;
        if (progress.seen[key] || progress.skipped?.[key]) return;
        const guide: ChapterGuide = {
            key, title: '扩建' + BUILDINGS[building.kind].name, line: '这个设施还能扩建，升一级就能做得更好。',
            target: building, destination: BUILDINGS[building.kind].name, action: 'upgrade',
        };
        this.once(guide, 5);
        return guide;
    }

    private firstFacility(): ChapterGuide | undefined {
        const s = this.model.state;
        const progress = s.chapter!;
        let nearest: Building | undefined;
        let distance = RULES.interactRange;
        for (const b of s.buildings) {
            if (b.kind === 'gear' && s.gearStock <= 0) continue;
            const d = Math.abs(b.x - s.player.x);
            const key = 'facility:' + b.kind;
            if (d < distance && FACILITY_HINTS[b.kind] && !progress.seen[key] && !progress.skipped?.[key] && this.model.visible(b)) {
                nearest = b;
                distance = d;
            }
        }
        if (!nearest) return;
        const entry = FACILITY_HINTS[nearest.kind];
        const key = 'facility:' + nearest.kind;
        const title = BUILDINGS[nearest.kind].name;
        if (['brute', 'lure', 'net', 'rock'].includes(nearest.kind)) {
            const guide = { key, title, line: entry.line };
            this.once(guide, 5);
            return guide;
        }
        const guide: ChapterGuide = {
            key, title, line: entry.line,
            target: nearest, destination: title,
            action: nearest.job ? undefined : entry.action === 'build' && nearest.level ? 'upgrade' : entry.action,
            observe: !entry.action && nearest.kind !== 'forge',
        };
        this.once(guide);
        return guide;
    }
}
