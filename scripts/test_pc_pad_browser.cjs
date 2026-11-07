// 使用浏览器标准 Gamepad API 夹具，经 Cocos 的正式输入事件进入控制器；不是实体设备测试。
const {chromium}=require('playwright'),assert=require('assert'),fs=require('fs'),path=require('path');
const out=path.resolve(__dirname,'../qa/pc/controller');fs.mkdirSync(out,{recursive:true});
let testBrowser;
(async()=>{
 const browser=testBrowser=await chromium.launch({channel:'msedge',headless:true,args:['--use-gl=angle','--use-angle=swiftshader-webgl','--enable-webgl']});
 const page=await browser.newPage({viewport:{width:1280,height:720}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{
  globalThis.__MONARCH_QA__=true;
  globalThis.__pad={id:'Standard virtual gamepad',index:0,connected:false,mapping:'standard',timestamp:0,axes:[0,0,0,0],buttons:Array.from({length:17},()=>({pressed:false,touched:false,value:0}))};
  Object.defineProperty(navigator,'getGamepads',{value:()=>[__pad.connected?__pad:null]});
 });
 await page.goto('http://127.0.0.1:42833/?build=controller-trader');
 await page.waitForFunction(()=>globalThis.__monarch?.menus?.phase==='open',null,{timeout:120000});
 await page.evaluate(()=>{__pad.connected=true;const event=new Event('gamepadconnected');Object.defineProperty(event,'gamepad',{value:__pad});window.dispatchEvent(event);});
 const press=async(index,ms=160)=>{await page.evaluate(i=>{__pad.buttons[i]={value:1,pressed:true,touched:true};__pad.timestamp++;},index);await page.waitForTimeout(ms);};
 const release=async(index)=>{await page.evaluate(i=>{__pad.buttons[i]={value:0,pressed:false,touched:false};__pad.timestamp++;},index);await page.waitForTimeout(170);};
 const tap=async(index)=>{await press(index);await release(index);};
 await press(0,1100);assert.equal(await page.evaluate(()=>__monarch.controls.mode),'gamepad');
 assert(await page.evaluate(()=>__monarch.controls.chapter.blocks),'holding A across menu must not dismiss dialogue');await release(0);
 await tap(0);await page.waitForTimeout(300);assert(!(await page.evaluate(()=>__monarch.controls.chapter.blocks)));
 const start=await page.evaluate(()=>__monarch.model.state.player.x);
 await page.evaluate(()=>{__pad.axes[0]=1;__pad.timestamp++;});await page.waitForTimeout(500);
 assert(await page.evaluate(()=>__monarch.model.state.player.x)>start+20);
 await page.keyboard.down('a');await page.waitForTimeout(200);assert.equal(await page.evaluate(()=>__monarch.controls.mode),'keyboard');await page.keyboard.up('a');
 await page.evaluate(()=>{__pad.axes[0]=.1;__pad.timestamp++;});await page.waitForTimeout(180);assert.equal(await page.evaluate(()=>__monarch.model.input.axis),0);
 await tap(8);await page.waitForFunction(()=>__monarch.menus.phase==='open'&&__monarch.menus.navPage==='controls');
 await tap(1);await tap(13);await tap(0);assert.equal(await page.evaluate(()=>__monarch.platform.language),'en');await tap(13);await tap(13);await tap(0);await page.waitForTimeout(300);await page.screenshot({path:path.join(out,'help-en.png')});
 await tap(1);assert.equal(await page.evaluate(()=>__monarch.menus.navPage),'pause');
 await tap(1);await page.waitForFunction(()=>__monarch.menus.phase==='closed');
 // 商人由正式日期更新出现，金币仍需长按交互逐枚投入。
 await page.evaluate(()=>{const m=__monarch.model;m.state.day=2;m.state.time=1;m.state.gold=50;m.state.player.x=1870;__monarch.controls.chapter.director.skipGuide(true);__monarch.advance(8);m.state.player.x=m.state.mountTrader.x;__monarch.view.camera=m.state.player.x;});
 await page.waitForTimeout(200);
 for(let i=0;i<20&&await page.evaluate(()=>__monarch.model.context()?.id)!==-120;i++)await tap(3);
 assert.equal(await page.evaluate(()=>__monarch.model.context()?.id),-120);
 await page.screenshot({path:path.join(out,'merchant-en.png')});
 await press(0,200);try{await page.waitForFunction(()=>__monarch.model.state.player.mount==='lizard',null,{timeout:30000});}catch(e){console.log(await page.evaluate(()=>({gold:__monarch.model.state.gold,pledge:__monarch.model.state.pledge,merchant:__monarch.model.state.mountTrader,held:__monarch.controls.held,mode:__monarch.controls.mode,pause:[...__monarch.model.pauses]})));throw e;}await release(0);
 assert.equal(await page.evaluate(()=>__monarch.model.state.player.mount),'lizard');
 assert.equal(await page.evaluate(()=>__monarch.model.state.mountTrader.sold),true);
 const balance=await page.evaluate(()=>__monarch.model.state.gold);await tap(0);assert.equal(await page.evaluate(()=>__monarch.model.state.gold),balance);
 await page.evaluate(()=>{__pad.axes[0]=1;__pad.timestamp++;});await page.waitForTimeout(200);
 await page.evaluate(()=>{__pad.connected=false;const event=new Event('gamepaddisconnected');Object.defineProperty(event,'gamepad',{value:__pad});window.dispatchEvent(event);});
 await page.waitForFunction(()=>__monarch.menus.phase==='open');assert.equal(await page.evaluate(()=>__monarch.model.input.axis),0);assert.equal(await page.evaluate(()=>__monarch.controls.mode),'keyboard');
 // 键盘可以接手菜单，F1 打开说明，手柄不在场时不遗留运动。
 await page.keyboard.press('Escape');await page.waitForFunction(()=>__monarch.menus.phase==='closed');await page.keyboard.press('F1');await page.waitForFunction(()=>__monarch.menus.phase==='open');
 assert.equal(await page.evaluate(()=>__monarch.menus.navPage),'controls');
 await page.screenshot({path:path.join(out,'help-keyboard-en.png')});
 const missing=await page.evaluate(()=>[...__monarch.missingTranslations]);assert.deepEqual(missing,[]);assert.deepEqual(errors,[]);
 assert.equal(await page.evaluate(()=>typeof __monarch.platform.rewarded),'undefined');
 fs.writeFileSync(path.join(out,'browser.json'),JSON.stringify({passed:true,source:'Standard virtual Gamepad API through Cocos',checks:['held confirmation quarantine','A dialogue','stick movement','dead zone','Back help','D-pad menu navigation','A language switch','B back','Y target cycle','A coin hold purchase','no duplicate transaction','disconnect pause and reset','keyboard takeover','bilingual help','no PC ad API'],missing,errors},null,2));
 await browser.close();console.log('Gamepad browser checks passed');
})().catch(async e=>{await testBrowser?.close();fs.writeFileSync(path.join(out,'failure.txt'),e.stack||String(e));console.error(e);process.exitCode=1;});
