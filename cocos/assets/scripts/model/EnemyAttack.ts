export type AttackStyle = 'melee' | 'bow' | 'cast' | 'slam';
export type QueuedAttackStyle = Exclude<AttackStyle, 'slam'>;
export const ATTACK_LEAD: Record<AttackStyle, number> = { melee: .18, bow: .24, cast: .28, slam: 0 };
export const ATTACK_RECOVERY = .30;
export const METEOR_DAMAGE_RADIUS = 55;

export interface EnemyStrike {
    style: QueuedAttackStyle;
    releaseAt: number;
    power: number;
    reach: number;
    targets: { id: number }[];
    towerId?: number;
    meteor?: number;
}
