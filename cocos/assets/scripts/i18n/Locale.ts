import { EN } from './en';

export type Language = 'zh-CN' | 'en';
let language: Language = 'zh-CN';
const cache = new Map<string, string>();
const phraseKeys = Object.keys(EN).filter(key => key.length > 1).sort((a,b) => b.length-a.length);
export const missingTranslations = new Set<string>();
export function getLanguage(): Language { return language; }
/** 语言属于显示偏好，不读写战役、单位或随机数。 */
export function setLanguage(value: Language): void {
    language = value === 'en' ? 'en' : 'zh-CN';
    cache.clear(); missingTranslations.clear();
    if (typeof document !== 'undefined') document.title = translate('哥布林：卑劣君主');
}
/** 原文键仅用于显示索引，动态数值在明确模板里替换，不能反向参与规则判断。 */
export function translate(source: string): string {
    if (language !== 'en' || !/[\u3400-\u9fff]/.test(source)) return source;
    const saved = cache.get(source); if (saved !== undefined) return saved;
    let value = EN[source];
    if (value === undefined) {
        const templates: [RegExp, (...args: string[]) => string][] = [
            [/^人口 (\d+)\/(\d+)$/, (_, a, b) => `Population ${a}/${b}`],
            [/^攻下(.+)后可扩建$/, (_, name) => `Capture ${translate(name)} to expand`],
            [/^关押 (\d+)\/(\d+)$/, (_, a, b) => `Captives ${a}/${b}`],
            [/^驻守猎手 (\d+)\/(\d+)$/, (_, a, b) => `Archers ${a}/${b}`],
            [/^猎手与恶霸护甲 增幅(\d+)%$/, (_, a) => `Hunter and Bruiser armor +${a}%`],
            [/^缴获装备 (\d+)$/, (_, a) => `Salvaged gear ${a}`],
            [/^第(\d+)日\s+击倒(\d+)人\s+售出(\d+)名俘虏$/, (_, a, b, c) => `Day ${a}   Defeated ${b}   Captives sold ${c}`],
            [/^向(左|右)走，去(.+)$/, (_, dir, target) => `Move ${dir === '左' ? 'left' : 'right'} to ${translate(target)}`],
            [/^领取(\d+)金币$/, (_, a) => `Claim ${a} coins`],
            [/^(\d+)秒后可领取$/, (_, a) => `Ready in ${a}s`],
            [/^(\d+)秒$/, (_, a) => `${a}s`],
            [/^(\d+)分钟$/, (_, a) => `${a} min`],
            [/^领取两名(.+)$/, (_, role) => `Claim 2 ${translate(role)}`],
            [/^留意(.+)$/, (_, target) => `Watch ${translate(target)}`],
            [/^按切换按钮，选中(.+)$/, (_, target) => `Press Tab to select ${translate(target)}`],
            [/^按(.+)按钮(?:，还需(\d+)枚金币)?$/, (_, action, coins) => `${translate(action)}${coins ? `: ${coins} coins left` : ''}`],
        ];
        for (const [pattern, render] of templates) {
            const found = source.match(pattern); if (found) { value = render(...found); break; }
        }
    }
    if (value === undefined) {
        // 职业名与等级、计时等短组合沿用词条，整段剧情必须有完整人工译文。
        value = source;
        for (const key of phraseKeys) value = value.split(key).join(EN[key]);
        if (/[\u3400-\u9fff]/.test(value) && missingTranslations.size<2048) missingTranslations.add(source);
    }
    if (cache.size > 2048) cache.clear();
    cache.set(source, value); return value;
}
