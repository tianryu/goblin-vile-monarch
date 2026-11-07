import { sys } from 'cc';
import { DEBUG } from 'cc/env';
import { State } from '../model/State';
const STORAGE_KEY = 'goblin-monarch-cocos-v9-app1018356';
type RewardResult = { completed: boolean; receipt: string };
interface TapHost {
    getStorageSync(key: string): any; setStorageSync(key: string, value: any): void;
    getAccountInfoSync(): { miniGame: { appId: string } };
    login(options: { timeout?: number; success: (result: { code: string }) => void; fail: (reason: any) => void }): void;
}
/** 平台身份和存档入口。缺少目标小游戏ID时不借用其他应用的广告配置。 */
export class Platform {
    readonly tap: TapHost | undefined = (globalThis as any).tap;
    private readonly storageKey: string;
    readonly mockAds = DEBUG && !this.tap && typeof location !== 'undefined' &&
        ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname) &&
        new URLSearchParams(location.search).get('mockAds') === '1';
    private mockReward?: { readyAt: number; resolve: (reward: RewardResult) => void };
    constructor(private readonly baseStorageKey = STORAGE_KEY) {
        this.storageKey = this.mockAds ? baseStorageKey + ':mock-ads' : baseStorageKey;
        // 声音设置独立于战役，重新开局不会重置偏好。
        try{const raw=this.read(this.storageKey+':settings')??this.read(baseStorageKey+':settings');if(raw)this.soundEnabled=JSON.parse(raw).soundEnabled!==false;}catch(_){/* 损坏设置回到默认开启，不改玩家战役档。 */}
    }
    soundEnabled=true;
    setSoundEnabled(enabled:boolean):void{
        this.soundEnabled=enabled;
        try{this.write(this.storageKey+':settings',JSON.stringify({soundEnabled:enabled}));}catch(_){this.storageError=true;}
    }
    miniappId = '';
    loginReady = false;
    storageError = false;
    get isTapTap(): boolean { return !!this.tap; }
    get adsReady(): boolean { return this.mockAds; }
    async initialize(): Promise<void> {
        if (!this.tap) return;
        try { this.miniappId = this.tap.getAccountInfoSync()?.miniGame?.appId || ''; } catch (_) { /* 身份读取失败不伪造ID。 */ }
        await new Promise<void>(resolve => {
            this.tap!.login({ timeout: 10000, success: () => { this.loginReady = true; resolve(); }, fail: () => resolve() });
        });
    }
    private read(key: string): string | null {
        const value = this.tap ? this.tap.getStorageSync(key) : sys.localStorage.getItem(key);
        return typeof value === 'string' ? value : null;
    }
    private write(key: string, value: string): void {
        if (this.tap) this.tap.setStorageSync(key, value); else sys.localStorage.setItem(key, value);
    }
    load(): State | undefined {
        const keys = [this.storageKey, this.storageKey + ':backup'];
        if (this.mockAds) keys.push(this.baseStorageKey, this.baseStorageKey + ':backup');
        for (const key of keys) {
            try {
                const raw = this.read(key); if (!raw) continue;
                const state = JSON.parse(raw);
                if (state.version === 9 && state.player && Number.isFinite(state.player.x) && Array.isArray(state.goblins) && Array.isArray(state.camps)) return state;
            } catch (_) { /* 主档不可读时试备份，不能覆盖原Godot档。 */ }
        }
        return undefined;
    }
    save(state: State, replaceCampaign = false): boolean {
        try {
            const data = JSON.stringify(state), previous = this.read(this.storageKey);
            if (previous && !replaceCampaign) this.write(this.storageKey + ':backup', previous);
            this.write(this.storageKey, data);
            if (replaceCampaign) this.write(this.storageKey + ':backup', data);
            this.storageError = false; return true;
        } catch (_) { this.storageError = true; return false; }
    }
    get mockRewardSeconds(): number | undefined {
        if (this.mockReward) return Math.max(0, Math.ceil((this.mockReward.readyAt - Date.now()) / 1000));
    }
    async rewarded(_kind: string): Promise<RewardResult> {
        if (!this.mockAds || this.mockReward) return { completed: false, receipt: '' };
        return new Promise(resolve => {
            this.mockReward = { readyAt: Date.now() + 2000, resolve };
        });
    }
    finishMockReward(completed: boolean): void {
        const active = this.mockReward;
        if (!active || completed && Date.now() < active.readyAt) return;
        this.mockReward = undefined;
        const receipt = completed ? 'mock:' + (globalThis.crypto?.randomUUID?.() ?? Date.now() + ':' + Math.random()) : '';
        active.resolve({ completed, receipt });
    }
}
