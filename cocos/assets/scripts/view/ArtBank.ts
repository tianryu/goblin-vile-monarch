import { resources, SpriteFrame, JsonAsset, TTFFont, AudioClip,Texture2D,Rect,Size,Material,EffectAsset,Vec4 } from 'cc';
const FOCUS_CACHE_BUDGET = 4 * 1024 * 1024;
export interface ArtInfo { width: number; height: number; contentHeight: number; anchorX: number; anchorY: number; source: string; facing?: number }
export interface RigPart{ name:string;rect:number[];at:number[];width:number;height:number;contentHeight:number;anchorX:number;anchorY:number;facing:number }
export interface Rig{atlas:string;height:number;root:number;parts:RigPart[]}
/** 原始AI位图只在离线阶段裁切，运行不读源码大图或设计图。 */
export class ArtBank {
    frames = new Map<string, SpriteFrame>();
    catalog: Record<string, ArtInfo> = {};
    font!: TTFFont;
    sounds = new Map<string, AudioClip>();
    rigs=new Map<string,Rig>();
    focusRigs=new Map<string,Rig>();
    private blueArmor?:Material;
    private brownArmor?:Material;
    /** 两份共享材质映射现有AI原画的金属区，不新增贴图或逐人克隆材质。 */
    materialFor(asset:string):Material|null{
        if(asset==='brute_4'||asset.startsWith('rig:brute_4:'))return this.blueArmor||null;
        if(asset==='brute_2'||asset.startsWith('rig:brute_2:'))return this.brownArmor||null;
        return null;
    }
    private focusLoading=new Set<string>();
    private focusUse=new Map<string,number>();
    private focusRetry=new Map<string,number>();
    /** 只为当前角色载入关节光边，所有关节先画金色轮廓再画主体，避免静态姿势残影。 */
    rigFocusReady(asset:string):boolean{
        const rig=this.focusRigs.get(asset);if(!rig)return false;
        const prefix='rigfocus:'+asset+':';this.focusUse.set(asset,Date.now());
        if(this.frames.has(prefix+rig.parts[0].name))return true;
        if(this.focusLoading.has(asset)||Date.now()<(this.focusRetry.get(asset)||0))return false;
        this.focusLoading.add(asset);
        resources.load('rigs/focus/'+asset+'/texture',Texture2D,(error,texture)=>{
            this.focusLoading.delete(asset);if(error){this.focusRetry.set(asset,Date.now()+1500);return;}
            this.focusRetry.delete(asset);
            for(const part of rig.parts){const key=prefix+part.name,frame=new SpriteFrame();frame.texture=texture;frame.rect=new Rect(...part.rect as [number,number,number,number]);frame.originalSize=new Size(part.width,part.height);frame.packable=false;this.frames.set(key,frame);this.catalog[key]={...part,source:'technical joint alpha dilation'};}
            // 往返同一路段优先复用高亮图集，超过预算才回收已离开且已淡出的图集。
            const active: { name: string; last: number; parts: RigPart[]; bytes: number }[] = [];
            for (const [name, last] of this.focusUse) {
                const parts = this.focusRigs.get(name)!.parts;
                const texture = this.frames.get('rigfocus:' + name + ':' + parts[0].name)?.texture;
                if (texture) active.push({ name, last, parts, bytes: texture.width * texture.height * 4 });
            }
            active.sort((a, b) => a.last - b.last);
            let bytes = active.reduce((total, entry) => total + entry.bytes, 0);
            const now = Date.now();
            for (const entry of active) {
                if (bytes <= FOCUS_CACHE_BUDGET) break;
                if (entry.name === asset || now - entry.last <= 2000) continue;
                for (const part of entry.parts) {
                    const key = 'rigfocus:' + entry.name + ':' + part.name;
                    this.frames.get(key)?.destroy();
                    this.frames.delete(key);
                    delete this.catalog[key];
                }
                resources.release('rigs/focus/' + entry.name + '/texture', Texture2D);
                this.focusUse.delete(entry.name);
                bytes -= entry.bytes;
            }
        });return false;
    }
    private glowLoading=new Set<string>();
    private glowUse=new Map<string,number>();
    private glowRetry=new Map<string,number>();
    /** 金边只在接近对象时加载，不能为整张长地图提前常驻一百多张光边纹理。 */
    glowReady(asset:string):boolean{
        const name=asset+'__glow';if(!this.catalog[name])return false;
        this.glowUse.set(name,Date.now());
        if(this.frames.has(name))return true;
        if(Date.now()<(this.glowRetry.get(name)||0))return false;
        if(!this.glowLoading.has(name)){
            this.glowLoading.add(name);
            resources.load('art/'+name+'/spriteFrame',SpriteFrame,(error,frame)=>{
                this.glowLoading.delete(name);if(error){this.glowRetry.set(name,Date.now()+1000);return;}
                this.glowRetry.delete(name);frame.packable=false;this.frames.set(name,frame);
                // 淡出只需短暂保留；两秒内仍在用的目标不能被异步回收。
                let bytes=0;for(const key of this.glowUse.keys())if(this.frames.has(key)){const info=this.catalog[key];bytes+=info.width*info.height*4;}
                for(const [key,last]of [...this.glowUse].sort((a,b)=>a[1]-b[1]))if(bytes>8*1024*1024&&Date.now()-last>2000&&this.frames.has(key)){
                    const info=this.catalog[key];bytes-=info.width*info.height*4;this.frames.delete(key);this.glowUse.delete(key);resources.release('art/'+key+'/spriteFrame',SpriteFrame);
                }
            });
        }
        return false;
    }
    async load(progress?: (value: number) => void): Promise<void> {
        const json = await new Promise<JsonAsset>((resolve, reject) => resources.load('art/catalog', JsonAsset, (e, asset) => e ? reject(e) : resolve(asset)));
        this.catalog = json.json as Record<string, ArtInfo>;
        let done = 0;
        const names = Object.keys(this.catalog).filter(name=>!name.endsWith('__glow'));
        // 控制元数据和纹理请求的并发，避免冷启动一次压入数百项资源。
        let cursor=0;
        const worker=async()=>{while(cursor<names.length){const name=names[cursor++];await new Promise<void>((resolve,reject)=>resources.load(`art/${name}/spriteFrame`,SpriteFrame,(error,frame)=>{
            if(error){reject(error);return;}
            this.frames.set(name,frame);progress?.(++done/names.length);resolve();
        }));}};
        await Promise.all(Array.from({length:Math.min(6,names.length)},()=>worker()));
        this.font = await new Promise<TTFFont>((resolve, reject) => resources.load('fonts/GoblinHand', TTFFont, (error, font) => error ? reject(error) : resolve(font)));
        await new Promise<void>(resolve => resources.loadDir('audio', AudioClip, (error, clips) => { if (!error) for (const clip of clips) this.sounds.set(clip.name, clip); resolve(); }));
        const rigs=await new Promise<JsonAsset>((resolve,reject)=>resources.load('rigs/catalog',JsonAsset,(e,a)=>e?reject(e):resolve(a)));
        await Promise.all(Object.entries((rigs.json as any).rigs as Record<string,Rig>).map(async([name,rig])=>{
            const texture=await new Promise<Texture2D>((resolve,reject)=>resources.load('rigs/'+rig.atlas+'/texture',Texture2D,(e,a)=>e?reject(e):resolve(a)));
            for(const part of rig.parts){const key='rig:'+name+':'+part.name,frame=new SpriteFrame();frame.texture=texture;frame.rect=new Rect(...part.rect as [number,number,number,number]);frame.originalSize=new Size(part.width,part.height);frame.packable=false;this.frames.set(key,frame);this.catalog[key]={...part,source:'original bitmap cutout'};}
            this.rigs.set(name,rig);
        }));
        const focus=await new Promise<JsonAsset>((resolve,reject)=>resources.load('rigs/focus/catalog',JsonAsset,(e,a)=>e?reject(e):resolve(a)));
        for(const [name,rig]of Object.entries((focus.json as any).rigs as Record<string,Rig>))this.focusRigs.set(name,rig);
        // 敌兵动作、精锐姿态和技能贴图共用图集，换姿势只替换 SpriteFrame。
        const [attackFrames, attackTexture] = await Promise.all([
            new Promise<JsonAsset>((resolve, reject) => resources.load('rigs/enemy_attack_frames', JsonAsset, (e, a) => e ? reject(e) : resolve(a))),
            new Promise<Texture2D>((resolve, reject) => resources.load('rigs/enemy_attacks/texture', Texture2D, (e, a) => e ? reject(e) : resolve(a))),
        ]);
        for (const [name, info] of Object.entries(attackFrames.json as Record<string, ArtInfo & { rect: [number, number, number, number] }>)) {
            const frame = new SpriteFrame();
            frame.texture = attackTexture;
            frame.rect = new Rect(...info.rect);
            frame.originalSize = new Size(info.width, info.height);
            frame.packable = false;
            this.frames.set(name, frame);
            this.catalog[name] = info;
        }
        // 蓝甲复用正持斧的白铁原画与关节，不采用旧倒持斧候选，也不增加动画图集。
        this.frames.set('brute_4',this.frames.get('brute_3')!);this.catalog.brute_4=this.catalog.brute_3;
        const source=this.rigs.get('brute_3');if(source){this.rigs.set('brute_4',source);for(const part of source.parts){const from='rig:brute_3:'+part.name,to='rig:brute_4:'+part.name;this.frames.set(to,this.frames.get(from)!);this.catalog[to]=this.catalog[from];}}
        const effect=await new Promise<EffectAsset>((resolve,reject)=>resources.load('materials/armor-palette',EffectAsset,(e,a)=>e?reject(e):resolve(a)));
        this.blueArmor=new Material();this.blueArmor.initialize({effectAsset:effect,defines:{USE_TEXTURE:true}});this.blueArmor.setProperty('metalColor',new Vec4(.36,.61,.98,1));
        this.brownArmor=new Material();this.brownArmor.initialize({effectAsset:effect,defines:{USE_TEXTURE:true}});this.brownArmor.setProperty('metalColor',new Vec4(.75,.47,.24,1));
    }
    get(name: string): SpriteFrame { return this.frames.get(name) || this.frames.get('coin')!; }
    info(name: string): ArtInfo { return this.catalog[name] || this.catalog.coin; }
}
