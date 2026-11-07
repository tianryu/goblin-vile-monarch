const {chromium}=require('playwright');const fs=require('node:fs');
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true,args:['--enable-webgl','--use-angle=swiftshader']});
 const page=await browser.newPage({viewport:{width:844,height:390},deviceScaleFactor:2});const errors=[];
 page.on('console',m=>{if(m.type()==='error'&&!m.text().includes('404'))errors.push(m.text())});page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:42819/');await page.waitForFunction(()=>window.__goblinState,{timeout:60000});
 await page.evaluate(()=>window.goblinQaCommand(JSON.stringify({op:'stress'})));await page.waitForTimeout(2000);
 await page.evaluate(()=>{window.__frameTimes=[];window.__lastFrame=0;function loop(t){if(window.__lastFrame)window.__frameTimes.push(t-window.__lastFrame);window.__lastFrame=t;requestAnimationFrame(loop)}requestAnimationFrame(loop)});
 const samples=[];
 const duration=Number(process.env.STRESS_SECONDS||300);
 for(let i=0;i<duration/10;i++){await page.waitForTimeout(10000);samples.push(await page.evaluate(()=>({elapsed:performance.now(),state:window.__goblinState,jsHeap:performance.memory?.usedJSHeapSize||null})));if(i%6===0)console.log(`Stress ${Math.round((i+1)*10)}s, visible ${samples.at(-1).state.visible_objects}`)}
 const frames=await page.evaluate(()=>window.__frameTimes);frames.sort((a,b)=>a-b);
 const q=p=>frames[Math.min(frames.length-1,Math.floor(p*frames.length))];
 const session=await browser.newBrowserCDPSession();const processes=await session.send('SystemInfo.getProcessInfo');
 const report={scope:'V5 desktop Edge software WebGL at DPR2, native canvas and 60 friendly units plus 40 durable enemies. Duration is explicit. Not phone/TapTap performance.',device_scale_factor:2,duration_seconds:duration,frame_count:frames.length,frame_interval_ms:{p50:q(.5),p95:q(.95),p99:q(.99),max:frames.at(-1)},samples,processes:processes.processInfo,errors:[...new Set(errors)]};
 fs.writeFileSync('qa/godot/stress-browser-v5.json',JSON.stringify(report,null,2));await page.screenshot({path:'qa/interaction-v5/stress-dpr2.png'});console.log(JSON.stringify({frame_interval_ms:report.frame_interval_ms,errors:report.errors,samples:samples.length}));await browser.close();process.exitCode=report.errors.length?1:0;
})().catch(e=>{console.error(e);process.exitCode=1});
