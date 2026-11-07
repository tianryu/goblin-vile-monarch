import { AudioClip, AudioSource, Node } from 'cc';
import { GameModel } from '../model/GameModel';
import { clamp, RULES } from '../model/Rules';
import type { State } from '../model/State';

type Track = 'bard' | 'forest_theme' | 'birds' | 'crickets' | 'stream' | 'fire_loop' | 'march_drums';
const TRACKS: Track[] = ['bard', 'forest_theme', 'birds', 'crickets', 'stream', 'fire_loop', 'march_drums'];
const CUES: Record<string, { clip: string; volume: number; interval: number; priority: number; global?: boolean }> = {
    coin: { clip: 'coin', volume: .28, interval: .12, priority: 2 },
    refund: { clip: 'back', volume: .25, interval: .13, priority: 2 },
    build: { clip: 'construction_done', volume: .13, interval: .24, priority: 2 },
    whip: { clip: 'whip_snap', volume: .24, interval: .16, priority: 2 },
    arrow: { clip: 'arrow', volume: .13, interval: .22, priority: 1 },
    throw: { clip: 'chop', volume: .21, interval: .23, priority: 1 },
    melee: { clip: 'sword_heavy', volume: .23, interval: .19, priority: 1 },
    shield: { clip: 'shield_hit', volume: .23, interval: .20, priority: 2 },
    woodHit: { clip: 'wall_thud', volume: .27, interval: .23, priority: 2 },
    wallBreak: { clip: 'wood_break', volume: .44, interval: .45, priority: 4 },
    heavySlam: { clip: 'wall_thud', volume: .48, interval: .35, priority: 4 },
    hammer: { clip: 'chop', volume: .055, interval: .40, priority: 0 },
    chest: { clip: 'chest_open', volume: .18, interval: .45, priority: 1 },
    cage: { clip: 'metal_latch', volume: .23, interval: .35, priority: 2 },
    cart: { clip: 'cart_creak', volume: .23, interval: .45, priority: 2 },
    recruit: { clip: 'confirm', volume: .19, interval: .35, priority: 2 },
    camp: { clip: 'confirm', volume: .28, interval: .30, priority: 2 },
    raid: { clip: 'raid_horn', volume: .29, interval: .6, priority: 4, global: true },
    lowHealth: { clip: 'heartbeat', volume: .23, interval: 1.6, priority: 4, global: true },
    won: { clip: 'victory', volume: .30, interval: .6, priority: 4, global: true },
    drumBeat: { clip: 'drum_strike', volume: .35, interval: .32, priority: 4 },
    charge: { clip: 'drum_strike', volume: .27, interval: .35, priority: 3, global: true },
    retreatDrum: { clip: 'drum_strike', volume: .40, interval: .35, priority: 4, global: true },
};

/** 声音只消费已经结算的事件。循环层渐变，近处音效限频，避免大部队的声音叠成一团。 */
export class Soundscape {
    private loops = new Map<Track, { source: AudioSource; running: boolean }>();
    private effects: AudioSource;
    private lastCue = new Map<string, number>();
    private state?: State;
    private lastX = 0;
    private stepDistance = 0;
    private duckUntil = 0;

    constructor(parent: Node, private clips: ReadonlyMap<string, AudioClip>) {
        this.effects = parent.addComponent(AudioSource);
        for (const key of TRACKS) {
            const clip = clips.get(key);
            if (!clip) continue;
            const node = new Node('Soundscape-' + key);
            parent.addChild(node);
            const source = node.addComponent(AudioSource);
            source.playOnAwake = false;
            source.loop = true;
            source.volume = 0;
            source.clip = clip;
            this.loops.set(key, { source, running: false });
        }
    }

    suspend(): void {
        this.stepDistance = 0;
        for (const track of this.loops.values()) {
            if (track.running) track.source.pause();
            track.running = false;
            track.source.volume = 0;
        }
    }

    update(dt: number, model: GameModel, audible: boolean, title: boolean): void {
        const s = model.state, x = s.player.x;
        if (this.state !== s) {
            this.state = s;
            this.lastX = x;
            this.stepDistance = this.duckUntil = 0;
            this.lastCue.clear();
        }
        const distance = Math.abs(x - this.lastX);
        this.lastX = x;
        if (!audible || model.pauses.has('background') || model.pauses.has('ad')) {
            model.events.length = 0;
            this.suspend();
            return;
        }
        this.playCues(model);
        const time = title ? 32 : s.time;
        const night = time < 25 ? 1 - clamp(time / 25, 0, 1) : clamp((time - 105) / 35, 0, 1);
        const dusk = clamp((time - 84) / 28, 0, 1) * (1 - clamp((time - 134) / 23, 0, 1));
        const outside = clamp((x - 770) / 410, 0, 1);
        const calm = title ? .82 : model.pauses.size || s.status !== 'playing' ? .42 : 1;
        const danger = !title && (s.elapsed < this.duckUntil || s.enemies.some(e => e.company && e.state === 'active' && Math.abs(e.x - x) < 620));
        const drumming = !title && s.status === 'playing' && model.drumPlaying;
        const music = calm * (drumming ? s.expedition.state === 'assault' ? 0 : .25 : danger ? .22 : 1);
        const dayMusic = (1 - night) * (1 - dusk) * (1 - clamp((time - 70) / 15, 0, 1));
        const stream = clamp(Math.round((x - RULES.streamStart) / RULES.streamSpacing), 0, RULES.streamCount - 1);
        const waterDistance = Math.abs(x - (RULES.streamStart + stream * RULES.streamSpacing));
        let fire = 0;
        for (const b of s.buildings) {
            if (!b.level || b.hp <= 0 || (b.kind !== 'hall' && b.kind !== 'wall' && b.kind !== 'prison')) continue;
            fire = Math.max(fire, (b.x < 900 ? 1 : night) * clamp(1 - Math.abs(x - b.x - 68) / 240, 0, 1));
        }
        this.mix('bard', dayMusic * music * .11, dt);
        this.mix('forest_theme', dusk * music * .095, dt);
        const ambience = calm * .6;
        this.mix('birds', (1 - night) * ambience * (title ? .055 : .018 + outside * .052), dt);
        this.mix('crickets', night * ambience * (.027 + outside * .035), dt);
        this.mix('stream', title ? 0 : clamp(1 - waterDistance / 400, 0, 1) * ambience * .08, dt);
        this.mix('fire_loop', title ? 0 : fire * ambience * .055, dt);
        const marchTrack = this.loops.get('march_drums');
        if (drumming && !model.pauses.size && marchTrack && !marchTrack.running && s.drumCart?.marchAt !== undefined) {
            const source = marchTrack.source;
            source.currentTime = Math.max(0, s.elapsed-s.drumCart.marchAt) % (source.duration || 1);
        }
        this.mix('march_drums', drumming && !model.pauses.size ? .14 : 0, dt, 10);

        if (Math.abs(model.input.axis) <= .14 || distance > 85 || s.player.fly > 8 || model.pauses.size || s.status !== 'playing') {
            this.stepDistance = 0;
            return;
        }
        // 渲染帧比逻辑帧密时，中间的零位移帧仍属于同一步。
        if (distance < .05) return;
        const stride = model.input.run ? 106 : 82;
        this.stepDistance += distance;
        if (this.stepDistance >= stride) {
            this.stepDistance %= stride;
            const clip = this.clips.get('hoof_soft') ?? this.clips.get('hoof');
            if (clip) this.effects.playOneShot(clip, model.input.run ? .085 : .06);
        }
    }

    private mix(key: Track, target: number, dt: number, rate = 1.35): void {
        const track = this.loops.get(key);
        if (!track || (!track.running && target < .002)) return;
        const source = track.source;
        source.volume += (target - source.volume) * Math.min(1, dt * rate);
        if (!track.running) {
            track.running = true;
            source.play();
        } else if (target < .002 && source.volume < .002) {
            source.pause();
            source.volume = 0;
            track.running = false;
        }
    }

    private playCues(model: GameModel): void {
        const s = model.state;
        if (!model.events.length) return;
        const nearby = model.events.splice(0).filter(e => {
            const cue = CUES[e.kind];
            return cue && (cue.global || Math.abs(e.x - s.player.x) < 850);
        });
        nearby.sort((a, b) => CUES[b.kind].priority - CUES[a.kind].priority || Math.abs(a.x - s.player.x) - Math.abs(b.x - s.player.x));
        let played = 0;
        for (const e of nearby) {
            const cue = CUES[e.kind], last = this.lastCue.get(e.kind) ?? -Infinity;
            if (e.kind === 'raid') this.duckUntil = s.elapsed + 12;
            const clip = this.clips.get(cue.clip);
            if (!clip || s.elapsed - last < cue.interval) continue;
            this.lastCue.set(e.kind, s.elapsed);
            const proximity = cue.global ? 1 : 1 - .8 * Math.abs(e.x - s.player.x) / 850;
            this.effects.playOneShot(clip, cue.volume * proximity);
            if (++played >= 3) break;
        }
    }
}
