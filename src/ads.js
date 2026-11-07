// Real provider is intentionally unconfigured until TapTap enables this application's
// monetization and returns its CURRENT verified ad space. No fake ads in production.
export class Ads{
 constructor(game,{provider=null,persist=()=>{}}={}){this.game=game;this.provider=provider;this.persist=persist;this.busy=false;}
 get ready(){return !!this.provider?.showRewarded;}
 async show(kind){if(this.busy)return{ok:false,reason:'广告正在处理中'};if(!this.ready)return{ok:false,reason:globalThis.tap?'此应用广告尚未开通，请稍后再试':'请在 TapTap 内运行；当前预览不提供真实广告'};this.busy=true;this.game.pause('ad');const id=globalThis.crypto?.randomUUID?.()||`${Date.now()}-${Math.random()}`;let reward=false;try{await this.provider.showRewarded({onReward:()=>{if(reward)return;reward=this.game.grantReward(kind,id);this.persist();}});return reward?{ok:true}:{ok:false,reason:'未完成广告观看，已有资源未受影响'};}catch(e){return{ok:false,reason:e.message||'暂无广告，请稍后再试'};}finally{this.busy=false;this.game.pause('ad',false);}}
}
