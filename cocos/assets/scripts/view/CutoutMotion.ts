import { Color } from 'cc';
import { Painter } from './Painter';
export type Motion='idle'|'walk'|'run'|'attack'|'work'|'drum'|'pull'|'haul'|'hit'|'stun'|'dead';
export function drumPose(age: number): number {
    return age < .085 ? 0 : age < .18 ? 1 : age < .37 ? 2 : 3;
}
/** 只采样姿态，世界坐标和镜头仍平滑；显示层绝不结算伤害、金币或工时。 */
export function drawCutout(p:Painter,key:string,asset:string,x:number,y:number,height:number,face:number,time:number,motion:Motion,rootAngle:number,layer:number,tint:Color,alpha=1,focus=0,motionAge?:number):boolean{
    const rig=p.art.rigs.get(asset);if(!rig)return false;
    const rate=motion==='run'||motion==='hit'?10:motion==='idle'?3:7;
    // 同一群人保留各自节拍，逻辑时钟暂停时姿态也完全冻结。
    const seed=Number(key.replace(/\D/g,''))||0,step=motion==='drum'&&motionAge!==undefined?drumPose(motionAge):motion==='attack'&&motionAge!==undefined?Math.min(3,Math.floor(motionAge/.105)):Math.floor(time*rate+seed*.67)%4,beat=[-1,0,1,0][step];
    const angles:Record<string,number>={head:motion==='idle'?beat*.5:beat,body:0,armNear:0,armFar:0,legNear:0,legFar:0};
    if(motion==='walk'||motion==='run'||motion==='haul'||motion==='pull'){
        const stride=motion==='run'?11:7;angles.legNear=beat*stride;angles.legFar=-beat*stride;angles.armNear=motion==='haul'?12:beat*5;angles.armFar=-beat*3;
    }
    if(motion==='pull'){angles.armNear=-23;angles.armFar=-56;angles.head=0;}
    // 原画握锤手在身体后侧，先向后举过肩，停拍再向前砸；避免锤头旋进大脑袋后被遮住。
    if(motion==='work'){angles.armNear=[-150,-150,20,0][step];angles.armFar=0;angles.head=0;}
    if(motion==='drum'){angles.armNear=[83,108,-154,122][step];angles.armFar=[23,17,10,16][step];angles.head=[-5,-2,4,1][step];}
    if(motion==='attack'){angles.armNear=asset.startsWith('hunter')?[-5,-15,7,0][step]:[-18,-58,29,0][step];angles.armFar=asset.startsWith('hunter')?[-2,-5,4,0][step]:3;}
    if(motion==='hit'){angles.armNear=beat*19;angles.armFar=-beat*13;angles.head=-beat*7;angles.legNear=beat*4;angles.legFar=-beat*4;}
    if(asset==='trader_pull'){angles.armNear=angles.armFar=0;angles.head=beat*.5;}
    const scale=height/rig.height,radians=rootAngle*Math.PI/180,c=Math.cos(radians),s=Math.sin(radians);
    const focusAsset=asset==='brute_4'?'brute_3':asset;
    if(focus>0&&p.art.rigFocusReady(focusAsset))for(const part of p.art.focusRigs.get(focusAsset)!.parts){
        const dx=part.at[0]*scale*face,dy=part.at[1]*scale;
        p.sprite('focus:'+key+':'+part.name,'rigfocus:'+focusAsset+':'+part.name,x+dx*c+dy*s,y-dx*s+dy*c,height,{layer,face,angle:rootAngle+(angles[part.name]||0)*face,alpha:alpha*focus});
    }
    const parts=motion==='work'||motion==='drum'?[...rig.parts.filter(part=>part.name!=='armNear'),...rig.parts.filter(part=>part.name==='armNear')]:rig.parts;
    for(const part of parts){
        const dx=part.at[0]*scale*face,dy=part.at[1]*scale;
        p.sprite(key+':'+part.name,'rig:'+asset+':'+part.name,x+dx*c+dy*s,y-dx*s+dy*c,height,{layer,face,angle:rootAngle+(angles[part.name]||0)*face,tint,alpha});
    }
    return true;
}
