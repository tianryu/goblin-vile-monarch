export const GAME_TITLE = '哥布林：卑劣君主';
export const CHAPTER_TITLE = '第1章 守住金币';
export const CHAPTER_END = '第二部敬请期待';

export const SPEAKERS = {
    chief: { name: '哥布林君主', portrait: 'rider_boar' },
    trader: { name: '人类商人', portrait: 'trader' },
    general: { name: '联军大将军', portrait: 'elite_heavy' },
};

interface Line {
    speaker: keyof typeof SPEAKERS;
    text: string;
}

export const DIALOGUES = {
    opening: [
        { speaker: 'chief', text: '人类军队就要来了，不能让他们抢走我的金币，我要在此处做好防守准备。' },
    ],
    trader: [
        { speaker: 'trader', text: '这些人类、精灵和矮人奴隶，我都收购。你把人带来，我付金币。' },
        { speaker: 'chief', text: '好。记得把你的车赶近点。' },
    ],
    expedition: [
        { speaker: 'chief', text: '也许是时候主动出击，攻击敌方营地了。' },
    ],
    general: [
        { speaker: 'general', text: '你为什么要攻击我们？我们是去讨伐巨龙的。' },
        { speaker: 'chief', text: '是你们先想要抢夺我的金币的。' },
        { speaker: 'general', text: '船上的人还在等我的军令。把路让开。' },
    ],
    ending: [
        { speaker: 'chief', text: '也许我可以用这艘船去远征人类、精灵和矮人的领土，去抢夺更多金币。' },
    ],
} satisfies Record<string, Line[]>;
export type DialogueId = keyof typeof DIALOGUES;

export const STORY_HINTS = {
    hammer: '那边有木锤。给空手的家伙一把，活就有人干了。',
    bow: '另一个给我拿弓。想碰我的钱箱，先吃一箭。',
    wall: '在路口钉上木桩。让他们去撞木头。',
    tower: '让猎手站高些。谁往墙边走，就射谁。',
    towerReady: '箭塔好了。附近的猎手会自己上塔。',
    treasury: '手下挣来的金币，大部分都放进了营地宝箱。钱袋不够了，就回去取。',
    hidden: '这家伙藏了我的金币。过去给他一鞭子。',
    recruitWaiting: '金币已摆好。等有机会，无主哥布林就会来。',
    raid: '火把到路口了。猎手上塔，墙破了就叫苦工去补！',
    survived: '金币还在。看看外头，他们丢下了什么。',
    captive: '活的关进牢里。牢门外那几个，盯紧点。',
    hall: '想招更多哥布林时，可以扩建主厅。',
    scout: '拿到了。把墙立起来，这条路才算归我。',
    machine: '把器械带到战鼓旁。敲鼓出征时，有两名空闲苦工就能推上它。',
    ship: '他们把船留在岸边了。跟我来，那艘船也归我。',
};

/** 首次靠近可用设施时的一句话，以及实际情境操作。 */
export const FACILITY_HINTS: Record<string, { line: string; action?: string }> = {
    lure: { line: '需要人手时，可以在钱盘放金币。' },
    brute: { line: '空手爪牙可以领斧头和盾牌，成为恶霸。' },
    farm: { line: '种点蘑菇。苦工照看，金币慢慢进账。', action: 'build' },
    wood: { line: '这片林子能挣钱。搭个伐木营，让苦工去砍。', action: 'build' },
    mine: { line: '石头底下有金币。建好矿场，再让苦工去挖。', action: 'build' },
    net: { line: '等它们挤过来，吊网就会兜住前排。', action: 'build' },
    rock: { line: '盾牌能挡箭，未必挡得住滚下来的石头。', action: 'build' },
    repair: { line: '修械场建好以后，修缴获的器械能省些金币。', action: 'build' },
    forge: { line: '改造台能把缴获的装备做成护甲，给猎手和恶霸穿。' },
    gear: { line: '缴来的东西先堆这里。做甲要用，缺钱时也能拆卖。', action: 'scrapGear' },
};
