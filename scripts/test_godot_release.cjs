const {chromium}=require('playwright');const fs=require('node:fs');const crypto=require('node:crypto');
let activeBrowser;
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true,args:['--enable-webgl','--use-angle=swiftshader']});
 activeBrowser=browser;
 const page=await browser.newPage({viewport:{width:844,height:390},hasTouch:true,deviceScaleFactor:1});
 const errors=[];page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:42820/');await page.waitForFunction(()=>!document.getElementById('status'),undefined,{timeout:60000});
 await page.waitForTimeout(600);await page.screenshot({path:'qa/godot/release-start.png'});
 const hooks=await page.evaluate(()=>({qa:typeof window.goblinQaCommand,state:typeof window.__goblinState,adProvider:typeof window.GoblinRewardedAds}));
 await page.touchscreen.tap(735,346);await page.waitForTimeout(300);const before=await page.screenshot();
 await page.keyboard.down('d');await page.waitForTimeout(1500);await page.keyboard.up('d');await page.keyboard.press('e');await page.waitForTimeout(350);
 const after=await page.screenshot({path:'qa/godot/release-play.png'});
 await page.reload();await page.waitForFunction(()=>!document.getElementById('status'),undefined,{timeout:60000});await page.waitForTimeout(400);
 await page.goto('http://127.0.0.1:42820/nested/monarch/');await page.waitForFunction(()=>!document.getElementById('status'),undefined,{timeout:60000});await page.waitForTimeout(300);
 const pack=fs.readFileSync('build/release-web/index.pck');
 const tests={release_boot:true,no_debug_entry:hooks.qa==='undefined'&&hooks.state==='undefined',no_mock_ads:hooks.adProvider==='undefined',input_changes_render:crypto.createHash('sha256').update(before).digest('hex')!==crypto.createHash('sha256').update(after).digest('hex'),nested_path_boot:true,no_raw_sources:!pack.includes(Buffer.from('game/art/source/')),no_model_test_scripts:!pack.includes(Buffer.from('game/tests_model')),no_legacy_js:!pack.includes(Buffer.from('src/main.js')),no_console_errors:errors.length===0};
 const report={scope:'Local release export tested in desktop Edge. Not physical phone or TapTap live evidence.',tests,hooks,errors};fs.writeFileSync('qa/godot/release-smoke.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));await browser.close();process.exitCode=Object.values(tests).every(Boolean)?0:1;
})().catch(async e=>{console.error(e);if(activeBrowser)await activeBrowser.close();process.exitCode=1});
