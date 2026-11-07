import {GROUND} from './model.js';import {AssetBank} from './assets.js';
// Authored bitmap layers, independent world coordinates and visible chunk cache.
// Rectangles below are exclusively UI bars, clipping, and a day/night tint.
class SceneChunks{
 constructor(buildings){this.buildings=buildings;this.cache=new Map();this.size=887;}
 update(camera,width){const first=Math.floor((camera-width/2-160)/this.size),last=Math.floor((camera+width/2+160)/this.size);for(const id of this.cache.keys())if(id<first||id>last)this.cache.delete(id);for(let id=first;id<=last;id++)if(!this.cache.has(id))this.cache.set(id,this.buildings.filter(b=>Math.floor(b.x/this.size)===id));return[...this.cache.values()].flat();}
}
export class Renderer{
 constructor(canvas,game){this.canvas=canvas;this.ctx=canvas.getContext('2d',{alpha:false});this.game=game;this.bank=new AssetBank();this.ready=this.bank.ready;this.camera=0;this.w=1774;this.h=887;this.t=0;this.fps=60;this.chunks=new SceneChunks(game.state.buildings);this.resize();}
 resize(){const r=this.canvas.getBoundingClientRect();this.w=Math.round(887*r.width/Math.max(1,r.height));this.canvas.width=this.w;this.canvas.height=887;this.ctx.imageSmoothingEnabled=false;}
 sx(x){return x-this.camera+this.w/2;}
 image(name,x,y,opts={}){this.bank.draw(this.ctx,name,this.sx(x),y,opts);}
 frame(t=this.t,speed=7){return Math.floor(t*speed)%4;}
 layer(name,parallax=1,{clip=false,alpha=1}={}){const c=this.ctx,img=this.bank.images[name];if(!img)return;const offset=this.camera*parallax,first=Math.floor((offset-this.w/2+887)/1774)-1,last=first+Math.ceil(this.w/1774)+2;c.save();c.globalAlpha*=alpha;if(clip){c.beginPath();c.rect(0,0,this.w,GROUND);c.clip();}for(let i=first;i<=last;i++){const x=Math.round(i*1774-887-offset+this.w/2);c.save();c.translate(x+(Math.abs(i)%2?1774:0),0);c.scale(Math.abs(i)%2?-1:1,1);c.drawImage(img,0,0,1774,887);c.restore();}c.restore();}
 bar(x,y,w,value,color='#c6b47d'){const c=this.ctx;c.fillStyle='#23333bcc';c.fillRect(Math.round(x-w/2),Math.round(y),w,5);c.fillStyle=color;c.fillRect(Math.round(x-w/2),Math.round(y),Math.round(w*Math.max(0,Math.min(1,value))),4);}
 building(b,reflection=false){const x=b.x,frame=this.frame();if(Math.abs(x-this.camera)>this.w/2+230)return;
 switch(b.kind){
 case'hall':this.image('hall-stages',x,GROUND,{width:420,frame:b.level-1});break;
 case'merchantGold':this.image('merchant-gold',x,GROUND,{width:170});break;
 case'merchantArmy':this.image('merchant-army',x,GROUND,{width:180});break;
 case'merchantMount':this.image('merchant-mount',x+35,GROUND,{width:260});break;
 case'wall':if(b.level&&b.hp>0)this.image('walls',x,GROUND,{width:80,frame:b.level-1});else this.image('effects',x,GROUND,{width:32,frame:10,alpha:.6});break;
 case'tower':if(b.level){this.image('towers',x,GROUND,{height:135+20*b.level,frame:b.level-1});this.image('unit-hunter',x,GROUND-(105+20*b.level),{height:44,face:Math.sign(b.x)});}break;
 case'farm':if(b.level)this.image('farms',x,GROUND,{width:170,frame:b.level-1});else if(!reflection)this.image('effects',x,GROUND,{width:25,frame:10,alpha:.45});break;
 case'camp':this.image('camp',x,GROUND,{width:125});for(let i=0;i<b.stock;i++)this.image('unit-idle',x-75-i*28,GROUND,{height:46});break;
 case'portal':if(b.hp>0)this.image('portal',x,GROUND,{width:150,frame});break;
 case'rally':if(this.game.hall.level>=3)this.image('rally',x,GROUND,{height:95,face:Math.sign(b.x)});break;
 case'tree':if(b.level)this.image('tree',x,GROUND,{height:260});break;
 case'chest':if(b.level)this.image('chest',x,GROUND,{width:45,frame:0});break;
 default:if(b.kind.startsWith('tools'))this.image('tools',x,GROUND,{width:48,frame:{toolsWorker:0,toolsHunter:1,toolsFarmer:2,toolsCaptain:3}[b.kind]});
 }
 if(reflection)return;if(b.job)this.bar(this.sx(x),GROUND-62,70,1-b.job.left/b.job.total);if((b.kind==='wall'||b.kind==='portal')&&b.hp>0&&b.hp<b.max)this.bar(this.sx(x),GROUND-(b.kind==='portal'?145:100),70,b.hp/b.max,'#bc8a70');}
 npc(n){if(Math.abs(n.x-this.camera)>this.w/2+70)return;this.image('unit-'+n.role,n.x,GROUND,{height:n.role==='captain'?58:n.role==='farmer'?55:50,frame:n.moving?this.frame(n.anim,8):1,face:n.side||1});}
 player(reflection=false){const p=this.game.state.player,c=this.ctx;const moving=Math.abs(this.game.input.axis)>.14;const frame=moving||p.fly>10?this.frame(this.t,this.game.input.run?10:6):1;const y=GROUND-p.fly;c.save();if(p.hit>0&&Math.floor(this.t*12)%2)c.globalAlpha=.45;this.image('mount-'+p.mount,p.x,y,{height:p.mount==='bat'?70:56,frame,face:p.face});this.image('monarch',p.x-p.face*8,y-(p.mount==='bat'?28:30),{height:62,frame,face:p.face});c.restore();if(!reflection&&p.stamina<99)this.bar(this.sx(p.x),y+12,64,p.stamina/100,'#aec775');}
 decorations(){for(const x of[-621,-234,43,493,863])this.image('torch',x,GROUND,{height:x===863?150:95,frame:this.frame(this.t+x*.001)});this.image('fire',-267,GROUND,{height:82,frame:this.frame(this.t,9)});this.image('mount-lizard',625,GROUND,{height:43});this.image('mount-wolf',720,GROUND,{height:50});this.image('mount-bat',690,GROUND-90,{height:35,frame:this.frame(this.t,3)});}
 render(dt=1/60){this.t+=dt;this.fps=this.fps*.95+(1/Math.max(.001,dt))*.05;const c=this.ctx,g=this.game,s=g.state,p=s.player;const desired=Math.max(-2900+this.w/2,Math.min(2900-this.w/2,p.x-200));this.camera+=(desired-this.camera)*Math.min(1,dt*7);c.imageSmoothingEnabled=false;
 if(this.chunks.buildings!==s.buildings)this.chunks=new SceneChunks(s.buildings);const buildings=this.chunks.update(this.camera,this.w);this.visibleChunks=[...this.chunks.cache.keys()];
 this.layer('layer-sky',.04);this.layer('layer-far',.12,{clip:true});this.layer('layer-middle',.28,{clip:true});this.layer('layer-near',.65,{clip:true});this.layer('layer-water',.8);
 // Reflections transform the same bitmaps; no generated-in-code art.
 c.save();c.beginPath();c.rect(0,675,this.w,212);c.clip();c.globalAlpha=.28;c.translate(0,GROUND*2+100);c.scale(1,-1);this.layer('layer-far',.12,{clip:true});this.layer('layer-middle',.28,{clip:true});this.layer('layer-near',.65,{clip:true});for(const b of buildings)this.building(b,true);this.decorations();for(const n of s.npcs)this.npc(n);this.player(true);c.restore();
 this.layer('layer-ground',1);for(const b of buildings)this.building(b);this.decorations();for(const n of s.npcs)this.npc(n);
 for(const e of s.enemies)if(Math.abs(e.x-this.camera)<this.w/2+90)this.image('enemy-'+e.type,e.x,GROUND,{height:e.type==='heavy'?52:e.type==='ranged'?60:55,frame:this.frame(e.anim,7),face:-e.side});
 for(const a of s.shots)this.image('effects',a.x,a.y,{width:22,frame:8,face:a.dir});for(const coin of s.coins)this.image('effects',coin.x,GROUND-5-Math.sin(coin.age*3)*2,{height:16,frame:this.frame(coin.age,6)});
 this.player();if(s.crown)this.image('effects',s.crown.x,GROUND-10,{width:26,frame:9});for(const e of s.effects)this.image('effects',e.x,e.y,{width:38,frame:4+Math.min(3,Math.floor((.2-e.life)*20))});this.layer('layer-foreground',1.18);
 const tint=g.night?.42:g.phase==='黄昏'?.12:0;if(tint){c.fillStyle=`rgba(12,22,50,${tint})`;c.fillRect(0,0,this.w,887);}
 }
}
