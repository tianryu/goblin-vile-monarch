import fs from 'node:fs';import {Game} from '../src/model.js';
const g=new Game(),log=[];let steps=0;function tick(t){for(let n=0;n<t;n+=.1){g.tick(.1);if(g.state.status!=='playing')throw Error('Campaign ended '+g.state.status+' at '+g.state.total);if(++steps>200000)throw Error('Campaign timeout');}}
function go(x){for(let i=0;i<1000&&Math.abs(g.state.player.x-x)>12;i++){g.input.axis=Math.sign(x-g.state.player.x);g.input.run=true;tick(.1);}g.input.axis=0;g.input.run=false;tick(.2);}
function use(kind,pred=()=>true,times=1){const b=g.state.buildings.find(b=>b.kind===kind&&pred(b));go(b.x);for(let i=0;i<times;i++){g.action(g.offer(b));tick(.2);}log.push({action:kind,x:b.x,day:g.state.day,time:Math.round(g.state.time),gold:g.state.gold,pop:g.state.npcs.map(n=>n.role)});}
try{
 use('toolsWorker');use('toolsHunter');use('wall',b=>b.x===-805);use('wall',b=>b.x===805);
 use('camp',b=>b.x<0,2);use('chest',b=>b.x<0);use('camp',b=>b.x>0,2);use('chest',b=>b.x>0);
 use('toolsHunter',()=>true,3);use('hall');tick(15);use('hall');tick(15);use('toolsCaptain');tick(1);
 // Collect naturally produced coins and train a home guard before departure.
 for(let i=0;i<3;i++){go(-300);tick(3);go(300);tick(3);}
 if(g.state.gold>=6){use('camp',b=>b.x<0,2);use('toolsHunter',()=>true,2);}
 for(const side of [-1,1]){
   // Gather ordinary income for the 4-coin order.
   for(let i=0;g.state.gold<4&&i<12;i++){go(-220);tick(3);go(220);tick(3);}
   use('rally',b=>Math.sign(b.x)===side);
   const portal=g.state.buildings.find(b=>b.kind==='portal'&&Math.sign(b.x)===side);
   for(let i=0;portal.hp>0&&i<1800;i++){go(0);tick(.2);}
   if(portal.hp>0)throw Error('Army did not destroy portal '+side);
   log.push({action:'portal-destroyed',side,day:g.state.day,time:Math.round(g.state.time),gold:g.state.gold});
 }
 for(let i=0;i<12000&&g.state.status==='playing';i++){g.input.axis=0;g.tick(.1);}
 const result={ok:g.state.status==='won',status:g.state.status,day:g.state.day,seconds:Math.round(g.state.total),adReceipts:g.global.receipts.length,kills:g.state.kills,log};fs.mkdirSync('qa',{recursive:true});fs.writeFileSync('qa/campaign-no-ads.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));if(!result.ok)process.exitCode=1;
}catch(e){const result={ok:false,error:e.message,status:g.state.status,day:g.state.day,time:g.state.time,gold:g.state.gold,pop:g.state.npcs.map(n=>n.role),events:g.events.slice(-10),log};fs.mkdirSync('qa',{recursive:true});fs.writeFileSync('qa/campaign-no-ads.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));process.exitCode=1;}
