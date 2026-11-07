const {chromium}=require('playwright');
const fs=require('node:fs');
(async()=>{
  const browser=await chromium.launch({channel:'msedge',headless:true,args:['--enable-webgl','--use-angle=swiftshader']});
  const page=await browser.newPage({viewport:{width:1280,height:640}});
  const log=[];page.on('console',m=>log.push(m.type()+': '+m.text()));page.on('pageerror',e=>log.push('ERROR '+e.message));
  await page.goto('http://127.0.0.1:42819/',{waitUntil:'load'});
  try{await page.waitForFunction(()=>!!window.__goblinState,{timeout:45000})}catch{}
  await page.screenshot({path:'qa/godot/boot.png'});
  fs.writeFileSync('qa/godot/boot.json',JSON.stringify({state:await page.evaluate(()=>window.__goblinState||null),log},null,2));
  console.log(JSON.stringify({state:await page.evaluate(()=>window.__goblinState||null),log:log.slice(-25)}));
  await browser.close();
})();
