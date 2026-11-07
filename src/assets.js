// Every game-world visual is a separately generated bitmap. Frame cropping and
// mirror/position transforms only; no procedural sprite/material generation.
export const ASSETS={
 'layer-sky':[1,1], 'layer-far':[1,1], 'layer-middle':[1,1], 'layer-near':[1,1], 'layer-ground':[1,1], 'layer-water':[1,1], 'layer-foreground':[1,1],
 'hall-stages':[3,1], 'merchant-gold':[1,1], 'merchant-army':[1,1], 'merchant-mount':[1,1],walls:[3,1],towers:[2,1],farms:[2,1],
 camp:[1,1],portal:[2,2],tree:[1,1],chest:[2,1],tools:[2,2],rally:[1,1],fire:[2,2],torch:[2,2],
 'unit-idle':[2,2],'unit-worker':[2,2],'unit-hunter':[2,2],'unit-farmer':[2,2],'unit-captain':[2,2],monarch:[2,2],
 'mount-boar':[2,2],'mount-lizard':[2,2],'mount-wolf':[2,2],'mount-bat':[2,2],
 'enemy-small':[2,2],'enemy-heavy':[2,2],'enemy-ranged':[2,2],effects:[4,3],'ui-icons':[4,2]
};
export class AssetBank{
 constructor(){this.images={};this.meta={};this.loaded=0;this.ready=Promise.all(Object.entries(ASSETS).map(async([name,grid])=>{const img=new Image();await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=()=>reject(Error('素材加载失败：'+name));img.src=`./assets/${name}.png`;});this.images[name]=img;this.meta[name]=this.measure(img,grid,name.startsWith('layer-'));this.loaded++;}));}
 measure(img,[cols,rows],layer){if(layer)return{cols,rows,frames:[],maxW:img.width,maxH:img.height};const canvas=document.createElement('canvas');canvas.width=img.width;canvas.height=img.height;const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(img,0,0);const pixels=ctx.getImageData(0,0,img.width,img.height).data;const frames=[];let maxW=1,maxH=1;for(let i=0;i<cols*rows;i++){const left=Math.round(i%cols*img.width/cols),top=Math.round(Math.floor(i/cols)*img.height/rows),right=Math.round((i%cols+1)*img.width/cols),bottom=Math.round((Math.floor(i/cols)+1)*img.height/rows);let minX=right,minY=bottom,maxX=left,maxY=top;for(let y=top;y<bottom;y++)for(let x=left;x<right;x++)if(pixels[(y*img.width+x)*4+3]>24){minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);}const frame=maxX>=minX&&maxY>=minY?{x:minX,y:minY,w:maxX-minX+1,h:maxY-minY+1}:{x:left,y:top,w:1,h:1};frames.push(frame);maxW=Math.max(maxW,frame.w);maxH=Math.max(maxH,frame.h);}canvas.width=canvas.height=1;return{cols,rows,frames,maxW,maxH};}
 draw(ctx,name,x,y,{frame=0,height=null,width=null,face=1,alpha=1}={}){const img=this.images[name],meta=this.meta[name];if(!img||!meta)return;const f=meta.frames[frame%meta.frames.length];if(!f)return;const scale=width!==null?width/meta.maxW:(height??meta.maxH)/meta.maxH;ctx.save();ctx.globalAlpha*=alpha;ctx.translate(Math.round(x),Math.round(y));ctx.scale(face,1);ctx.drawImage(img,f.x,f.y,f.w,f.h,Math.round(-f.w*scale/2),Math.round(-f.h*scale),Math.round(f.w*scale),Math.round(f.h*scale));ctx.restore();}
}
