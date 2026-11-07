import type { State } from './State';
import type { DialogueId } from './ChapterText';

export interface ChapterProgress {
    seen: Record<string, true>;
    done: Record<string, true>;
    skipped?: Record<string, true>;
    guidesSkipped?: true;
    dialogue?: { id: DialogueId; page: number };
    hiddenTarget?: number;
}

export function newChapter(): ChapterProgress {
    return { seen: {}, done: {} };
}

/** 已在游玩的旧档接续新剧情，保留原职业和已完成的开局建设。 */
export function resumeChapter(state: State): ChapterProgress {
    if (state.chapter) return state.chapter;
    const chapter = newChapter();
    if (state.elapsed === 0 && state.spent === 0 && state.raids === 0) {
        state.chapter = chapter;
        return chapter;
    }
    chapter.seen.opening = true;
    chapter.done.hammer = true;
    chapter.done.bow = true;
    if (state.raids > 0) chapter.seen.raid = true;
    if (state.day > 1) chapter.seen.survived = true;
    if (state.sold > 0) chapter.seen.trader = true;
    if (state.expedition.state === 'march' || state.expedition.state === 'assault' || state.camps[0]?.rewarded) chapter.done.dispatch = true;
    if (state.camps[0]?.rewarded) chapter.seen.scout = true;
    if (state.camps[3]?.rewarded) chapter.seen.general = true;
    if (state.status === 'won') chapter.seen.ending = true;
    for (const building of state.buildings) {
        if (building.region === -1 && building.level > 0 &&
            (building.kind === 'wall' || building.kind === 'tower')) chapter.done[building.kind] = true;
    }
    state.chapter = chapter;
    return chapter;
}
