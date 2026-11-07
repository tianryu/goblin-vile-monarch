import { sys } from 'cc';
import { State } from '../model/State';
import { Language, setLanguage } from '../i18n/Locale';
// PC 战役与手机小游戏隔离，语言和音量偏好再与战役分离。
const STORAGE_KEY = 'goblin-vile-monarch-pc-v1';
/** PC 本地存档和长期设置，不加载广告 SDK 或调用平台登录。 */
export class Platform {
    private readonly storageKey:string;
    constructor(private readonly baseStorageKey = STORAGE_KEY) {
        this.storageKey = baseStorageKey;
        // 声音设置独立于战役，重新开局不会重置偏好。
        try{const raw=this.read(this.storageKey+':settings')??this.read(baseStorageKey+':settings');if(raw){const settings=JSON.parse(raw);this.soundEnabled=settings.soundEnabled!==false;this.language=settings.language==='en'?'en':'zh-CN';}}catch(_){/* 损坏设置回到默认开启，不改玩家战役档。 */}
        setLanguage(this.language);
    }
    soundEnabled=true;
    language: Language = 'zh-CN';
    setLanguage(language: Language): void {
        this.language = language === 'en' ? 'en' : 'zh-CN';
        setLanguage(this.language); this.saveSettings();
    }
    private saveSettings(): void {
        try{this.write(this.storageKey+':settings',JSON.stringify({soundEnabled:this.soundEnabled,language:this.language}));}catch(_){this.storageError=true;}
    }
    setSoundEnabled(enabled:boolean):void{
        this.soundEnabled=enabled;
        this.saveSettings();
    }
    storageError=false;
    get isTapTap():boolean{return false;}
    async initialize():Promise<void>{}
    private read(key:string):string|null{return sys.localStorage.getItem(key);}
    private write(key:string,value:string):void{sys.localStorage.setItem(key,value);}
    load(): State | undefined {
        const keys = [this.storageKey, this.storageKey + ':backup'];

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
}
