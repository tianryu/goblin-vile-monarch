const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const origin = 'http://127.0.0.1:42828';

(async () => {
    const browser = await chromium.launch({channel:'msedge',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
    const comparisons = {};
    try {
        for (const build of ['field-recovery-20261104','store-20261104']) {
            const page = await browser.newPage({viewport:{width:844,height:390},deviceScaleFactor:1});
            const errors = [];
            page.on('pageerror',e=>errors.push(e.message));
            await page.addInitScript(()=>{window.__MONARCH_QA__=true;});
            await page.goto(origin+'/'+build+'/');
            await page.waitForFunction(build=>window.__monarch?.checkpoint===build,build,{timeout:45000});
            await page.evaluate(()=>{
                const {model:m,view:v,menus}=__monarch, s=m.state;
                Object.assign(s.chapter.seen,{opening:true,expedition:true,trader:true,general:true});
                s.chapter.guidesSkipped=true;
                menus.close('continue');
                s.seed=731;
                s.time=120;
                const wall=s.buildings.find(b=>b.kind==='wall'&&b.region===-1);
                Object.assign(wall,{level:3,hp:9000,maxHp:9000});
                s.player.x=s.player.prevX=wall.x-90;
                s.player.hp=100;
                v.camera=wall.x;
                s.goblins=[];
                for (let i=0;i<16;i++) {
                    const n=m.makeGoblin(i%3===0?'brute':'hunter',wall.x-30-i*18);
                    n.hp=n.maxHp=500;
                    s.goblins.push(n);
                }
                for (let i=0;i<32;i++) {
                    const e=m.makeEnemy(['human','dwarf','elf'][i%3],wall.x+60+i*13,0,999);
                    e.hp=e.maxHp=500;
                }
            });
            await page.waitForFunction(()=>!__monarch.model.pauses.size);
            await page.waitForTimeout(1000);
            comparisons[build] = await page.evaluate(()=>new Promise(resolve=>{
                const {model:m,view:v}=__monarch;
                const render = v.render, tick = m.tick;
                const renderTimes=[], tickTimes=[], intervals=[];
                let last=performance.now();
                const started=last;
                v.render=function(...args){
                    const now=performance.now();
                    intervals.push(now-last);
                    last=now;
                    render.apply(this,args);
                    renderTimes.push(performance.now()-now);
                };
                m.tick=function(...args){
                    const now=performance.now();
                    tick.apply(this,args);
                    tickTimes.push(performance.now()-now);
                };
                setTimeout(()=>{
                    m.tick=tick;
                    v.render=render;
                    const total=(performance.now()-started)/1000;
                    const percentile=(array,p)=>array.sort((a,b)=>a-b)[Math.min(array.length-1,Math.floor(array.length*p))];
                    const textures=new Set([...v.art.frames.values()].map(f=>f.texture));
                    const bytes=[...textures].reduce((n,t)=>n+t.width*t.height*4,0);
                    resolve({elapsedSeconds:total,frames:renderTimes.length,fps:renderTimes.length/total,
                        frameIntervalP95Ms:percentile(intervals,.95),renderJsP95Ms:percentile(renderTimes,.95),
                        tickP95Ms:percentile(tickTimes,.95),uniqueTextureRgbaEstimateBytes:bytes});
                },8500);
            }));
            assert.deepEqual(errors,[]);
            await page.close();
        }
        fs.writeFileSync(path.join(__dirname,'performance.json'),JSON.stringify({environment:'Desktop Edge SwiftShader, 844x390 at DPR 1, 16 defenders and 32 enemies',comparisons},null,2));
        console.log(comparisons);
    } finally { await browser.close(); }
})().catch(e=>{console.error(e);process.exitCode=1;});
