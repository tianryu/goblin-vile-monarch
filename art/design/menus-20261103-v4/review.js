// 设计审核入口：独立端口、独立QA档和只读固定构建，不修改正式Cocos脚本或玩家档。
const stage=document.querySelector('#stage'),frame=document.querySelector('#game'),toggle=document.querySelector('#pause-toggle');
const menus={main:document.querySelector('#main-menu'),pause:document.querySelector('#pause-menu')};
let game=null,state='loading',kind='main',serial=0,animation=null,soundOn=localStorage.getItem('hanging-menu-review-sound')!=='off';
const history=[];
function record(event){history.push({event,time:performance.now(),elapsed:game?.model.state.elapsed,state});}
function setState(next){state=next;stage.dataset.state=next;stage.dataset.kind=kind;record(next);}
function sound(){soundOn=!soundOn;stage.classList.toggle('sound-off',!soundOn);localStorage.setItem('hanging-menu-review-sound',soundOn?'on':'off');}
stage.classList.toggle('sound-off',!soundOn);
function stopWorld(){game.controls.release();game.model.cancelPledge();game.model.pause('hanging-review',true);}
function currentPose(element){const css=getComputedStyle(element);return{transform:css.transform==='none'?'translateY(0px)':css.transform,opacity:css.opacity};}
function hideInteraction(){for(const el of Object.values(menus)){el.classList.remove('interactive');el.setAttribute('aria-hidden','true');}toggle.disabled=true;}
/** 换向从当前姿态接续，旧完成回调失效，不能重复恢复世界或重新开局。 */
async function showMenu(next){
 if(!game)return;const id=++serial,el=menus[next],same=kind===next&&['entering','closing','shown'].includes(state);
 const from=same?currentPose(el):{transform:'translateY(-110%)',opacity:0};animation?.cancel();hideInteraction();
 for(const [name,node]of Object.entries(menus))if(name!==next){node.style.opacity='0';node.style.transform='translateY(-110%)';}
 kind=next;stopWorld();setState('entering');stage.classList.add('menu-open');el.setAttribute('aria-hidden','false');
 animation=el.animate([from,{transform:'translateY(6px) rotate(.35deg)',opacity:1,offset:.78},{transform:'translateY(0px)',opacity:1}],{duration:420,easing:'cubic-bezier(.2,.7,.3,1)',fill:'forwards'});
 try{await animation.finished;}catch{return;}if(id!==serial)return;
 el.style.transform='translateY(0px)';el.style.opacity='1';animation.cancel();animation=null;el.classList.add('interactive');el.setAttribute('aria-hidden','false');toggle.disabled=false;setState('shown');
}
/** 菜单完全离屏才解除暂停；返回主菜单全程保持冻结。 */
async function pullAway(action='continue'){
 if(!game||state==='closing'||state==='playing'||state==='loading')return;
 const id=++serial,el=menus[kind],from=currentPose(el),y=new DOMMatrixReadOnly(from.transform).m42;
 animation?.cancel();hideInteraction();stopWorld();setState('closing');
 const keys=[from];if(Math.abs(y)<3&&Number(from.opacity)>.95)keys.push({transform:'translateY(7px)',opacity:.97,offset:.15});keys.push({transform:'translateY(-112%)',opacity:0});
 animation=el.animate(keys,{duration:400,easing:'cubic-bezier(.55,.05,.8,.35)',fill:'forwards'});
 try{await animation.finished;}catch{return;}if(id!==serial)return;
 el.style.opacity='0';el.style.transform='translateY(-112%)';animation.cancel();animation=null;
 if(action==='home'){record('home-after-exit');return showMenu('main');}
 if(action==='new'){game.model.restart();game.view.camera=game.model.state.player.x;record('new-game-after-exit');}
 kind='';setState('playing');stage.classList.remove('menu-open');toggle.disabled=false;game.model.pause('hanging-review',false);record('world-resumed');frame.contentWindow.focus();frame.contentDocument.querySelector('#GameCanvas')?.focus();
}
function escape(){if(!game)return;if(state==='playing')showMenu('pause');else if(kind==='pause'&&state!=='closing')pullAway();else if(kind==='pause'&&state==='closing')showMenu('pause');}
toggle.addEventListener('click',escape);
for(const button of document.querySelectorAll('[data-action]'))button.addEventListener('click',()=>{if(state!=='shown')return;const action=button.dataset.action;if(action==='sound')sound();else pullAway(action);});
window.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();escape();}});
window.__hangingDemo={get state(){return state;},get kind(){return kind;},get game(){return game;},get soundOn(){return soundOn;},history,showMenu,pullAway,escape};
window.onHangingGameReady=async value=>{
 game=value;stopWorld();record('engine-ready-frozen');
 // 原右上暂停键只在审核页隐藏，代以左移的新热区；实际项目未据此声称完成宿主适配。
 const oldButton=game.controls.button;game.controls.button=function(key,...args){if(key!=='pause')return oldButton.call(this,key,...args);};
 const originalHud=game.view.hud;game.view.hud=function(...args){if(kind!=='main')return originalHud.apply(this,args);};
 const originalContext=game.model.context;game.model.context=function(...args){return state==='playing'?originalContext.apply(this,args):null;};
 const originalControls=game.view.drawControls;game.view.drawControls=()=>{if(state==='playing')originalControls();};
 const cc=await frame.contentWindow.System.import('cc'),originalOneShot=cc.AudioSource.prototype.playOneShot;
 cc.AudioSource.prototype.playOneShot=function(...args){if(soundOn)return originalOneShot.apply(this,args);};
 stage.classList.add('ready');showMenu('main');
};
(async()=>{
 try{
  const base='/release/cocos-starter-20261103-r1/';let html=await(await fetch(base+'index.html')).text();
  // 在引擎第一次赋值调试句柄时就冻结，不能等轮询发现后让世界先偷偷走几帧。
  const bootstrap=`globalThis.__MONARCH_QA__=true;let reviewGame;Object.defineProperty(globalThis,'__monarch',{configurable:true,get(){return reviewGame},set(value){reviewGame=value;value.model.pause('hanging-review',true);parent.onHangingGameReady(value)}});window.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();parent.__hangingDemo.escape()}},true);`;
  html=html.replace('<head>',`<head><base href="${location.origin+base}"><script>${bootstrap}<\/script>`);frame.srcdoc=html;
 }catch(error){document.querySelector('#load-status').textContent='审核预览载入失败：'+error.message;throw error;}
})();
