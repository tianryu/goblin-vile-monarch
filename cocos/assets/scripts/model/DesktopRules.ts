import type { Mount } from './Rules';
/** PC 版不接广告，坐骑费用集中声明供模型和界面共同读取。 */
export const PC_MOUNT_PRICES: Record<Mount, number> = { boar: 0, lizard: 30, wolf: 40, bat: 50 };
