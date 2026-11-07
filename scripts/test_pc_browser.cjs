// 独立浏览器档进行 PC 输入、语言与菜单定向验收。模型赋值只用于安排附近交互的夹具。
const {chromium}=require('playwright');
const fs=require('fs'),path=require('path'),assert=require('assert');
const root=path.resolve(__dirname,'..'),out=path.join(root,'qa/pc');
(async()=>{
 fs.mkdirSync(out,{recursive:true});
 const browser=await chromium.launch({channel:'msedge',headless:true,args:['--use-gl=angle','--use-angle=swiftshader-webgl','--enable-webgl']});
 const context=await browser.newContext({viewport:{width:1280,height:720}}),page=await context.newPage(),errors=[];
 await page.addInitScript(()=>globalThis.__MONARCH_QA__=true);
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto(process.env.PC_URL||'http://127.0.0.1:42833');
 await page.waitForFunction(()=>globalThis.__monarch?.menus?.phase==='open',null,{timeout:120000});
 const click=async(x,y)=>{const box=await page.locator('canvas').boundingBox(),size=await page.evaluate(()=>({w:__monarch.view.width,h:__monarch.view.height}));await page.mouse.click(box.x+x/size.w*box.width,box.y+y/size.h*box.height);};
 const menuClick=async(row)=>{const w=await page.evaluate(()=>__monarch.view.width);await click(w-300,242+78*row);await page.waitForTimeout(400);};
 await page.screenshot({path:path.join(out,'main-zh.png')});
 await menuClick(2);assert.equal(await page.evaluate(()=>__monarch.platform.language),'en');
 await page.screenshot({path:path.join(out,'main-en.png')});
 await menuClick(1);
 await page.waitForFunction(()=>__monarch.menus.phase==='closed'&&__monarch.controls.chapter.blocks);
 await page.screenshot({path:path.join(out,'dialogue-en.png')});
 for(let i=0;i<10&&await page.evaluate(()=>__monarch.controls.chapter.blocks);i++){await page.keyboard.press('Enter');await page.waitForTimeout(180);}
 assert.equal(await page.evaluate(()=>__monarch.controls.chapter.blocks),false);
 const start=await page.evaluate(()=>__monarch.model.state.player.x);
 await page.keyboard.down('d');await page.waitForTimeout(700);await page.keyboard.up('d');
 const moved=await page.evaluate(()=>__monarch.model.state.player.x);assert(moved>start+10,'D should move right');
 await page.keyboard.down('a');await page.waitForTimeout(500);await page.keyboard.up('a');assert(await page.evaluate(()=>__monarch.model.state.player.x)<moved,'A should move left');
 // 靠近工具摊，用真实 E 输入购买，验证松开后停止连续投币。
 await page.evaluate(()=>{const m=__monarch.model,b=m.state.buildings.find(b=>b.kind==='worker');if(!b)throw Error('worker stall missing');m.cancelPledge();m.state.player.x=b.x;m.state.gold=30;__monarch.controls.chapter.director.skipGuide(true);__monarch.view.camera=b.x;});
 await page.waitForTimeout(300);
 const contextBefore=await page.evaluate(()=>__monarch.model.context());
 assert(contextBefore.actions.some(a=>a.type!=='whip'),'stall must offer interaction');
 await page.keyboard.down('e');await page.waitForTimeout(450);await page.keyboard.up('e');
 const paid=await page.evaluate(()=>__monarch.model.state.gold);assert(paid<30,'E should spend coins');
 assert.equal(await page.evaluate(()=>__monarch.controls.held),null,'key release must stop repeat');
 // 暂停冻结世界。用正常暂停菜单切换回中文，不改变战役。
 await page.keyboard.press('Escape');await page.waitForFunction(()=>__monarch.menus.phase==='open');
 const paused=await page.evaluate(()=>JSON.stringify(__monarch.model.state));
 const w=await page.evaluate(()=>__monarch.view.width);
 await click(w-300,202+78);await page.waitForTimeout(350);
 assert.equal(await page.evaluate(()=>__monarch.platform.language),'zh-CN');
 assert.equal(await page.evaluate(()=>JSON.stringify(__monarch.model.state)),paused,'language change must not change paused campaign');
 await page.screenshot({path:path.join(out,'pause-zh.png')});
 await page.keyboard.press('Escape');await page.waitForFunction(()=>__monarch.menus.phase==='closed');
 await page.keyboard.press('m');await page.waitForTimeout(300);await page.screenshot({path:path.join(out,'mounts-zh.png')});await page.keyboard.press('m');
 // Tab 不得让页面滚动或焦点离开输入系统。
 await page.keyboard.press('Tab');await page.keyboard.down('d');await page.waitForTimeout(200);await page.keyboard.up('d');
 await page.screenshot({path:path.join(out,'gameplay-zh.png')});
 // 英文暂停和场景中的动态文本，再核对一遍缺失词条。
 await page.keyboard.press('Escape');await page.waitForFunction(()=>__monarch.menus.phase==='open');
 await click(w-300,202+78);await page.waitForTimeout(300);
 await page.screenshot({path:path.join(out,'pause-en.png')});
 await page.keyboard.press('Escape');await page.waitForFunction(()=>__monarch.menus.phase==='closed');
 await page.waitForTimeout(600);await page.screenshot({path:path.join(out,'gameplay-en.png')});
 const missing=await page.evaluate(()=>[...__monarch.missingTranslations]);assert.deepEqual(missing,[],'runtime text should be translated');
 await page.evaluate(()=>__monarch.save());
 await page.reload();await page.waitForFunction(()=>globalThis.__monarch?.menus?.phase==='open',null,{timeout:120000});
 assert.equal(await page.evaluate(()=>__monarch.platform.language),'en','language must persist after reload');
 const persistedDay=await page.evaluate(()=>__monarch.model.state.day);
 await page.setViewportSize({width:1920,height:1080});await page.waitForTimeout(500);await page.screenshot({path:path.join(out,'main-en-1080p.png')});
 assert.deepEqual(errors,[]);
 fs.writeFileSync(path.join(out,'browser-results.json'),JSON.stringify({passed:true,checks:['normal menu language switch','English opening dialogue','A and D movement','E purchase and release','pause freeze','language state isolation','mount panel','Tab input','preference and campaign persistence','1280x720 and 1920x1080 layouts'],persistedDay,errors,missing},null,2));
 console.log('PC browser checks passed');await browser.close();
})().catch(error=>{fs.writeFileSync(path.join(out,'browser-failure.txt'),error.stack||String(error));console.error(error);process.exitCode=1;});
