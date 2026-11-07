const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const base = 'http://127.0.0.1:42961/';
const key = 'goblin-monarch-cocos-v9-qa';
(async () => {
  const browser = await chromium.launch({ channel:'msedge', headless:true, args:['--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
  const errors = [];
  try {
    const context = await browser.newContext({viewport:{width:844,height:390},hasTouch:true});
    await context.addInitScript(() => { window.__MONARCH_QA__=true; });
    const page = await context.newPage();
    page.on('pageerror',e=>errors.push(e.message));
    const ready = () => page.waitForFunction(() => window.__monarch?.checkpoint==='reward-sign-20261104',null,{timeout:40000});
    await page.goto(base);
    await ready();
    const initial = await page.evaluate(() => {
      const {model:m,platform:p} = __monarch;
      const s = m.state;
      const pile = s.buildings.find(b=>b.kind==='gear');
      const forge = s.buildings.find(b=>b.kind==='forge');
      const wall = s.buildings.find(b=>b.kind==='wall');
      const fresh = [pile.x,forge.x];
      s.revision=19;
      pile.x=-108; forge.x=-248; wall.x+=11;
      s.gearStock=5; forge.level=1;
      s.chapter.seen.opening=true; s.chapter.seen.trader=true; s.chapter.guidesSkipped=true; delete s.chapter.dialogue;
      __monarch.save();
      return {fresh,wall:wall.x,originalGold:s.gold,ads:p.adsReady,forgeId:forge.id};
    });
    assert.deepEqual(initial.fresh,[896,846]); assert.equal(initial.ads,false);
    await page.goto(base+'?mockAds=1');
    await ready();
    const migration=await page.evaluate(() => {
      const {model:m,menus,platform:p}=__monarch, s=m.state;
      menus.close('continue');
      return {pile:s.buildings.find(b=>b.kind==='gear').x,forge:m.forge.x,wall:s.buildings.find(b=>b.kind==='wall').x,
        stock:s.gearStock,level:m.forge.level,id:m.forge.id,mock:p.mockAds};
    });
    assert.deepEqual(migration,{pile:896,forge:846,wall:initial.wall,stock:5,level:1,id:initial.forgeId,mock:true});
    await page.waitForFunction(()=>__monarch.controls.rewardRise===1);
    const tap = async (name) => {
      await page.waitForFunction(name => __monarch.view.painter.nodes.has('control:'+name+'@ui_button_v5'),name);
      const point = await page.evaluate(name => {
        const {view:v}=__monarch;
        const d=v.painter.nodes.get('control:'+name+'@ui_button_v5');
        const canvas=document.querySelector('canvas').getBoundingClientRect();
        return {x:canvas.left+(d.node.position.x+v.width/2)*canvas.width/v.width,
          y:canvas.top+(v.height/2-d.node.position.y-d.transform.height/2)*canvas.height/v.height};
      },name);
      await page.touchscreen.tap(point.x,point.y);
    };
    const count = () => page.evaluate(() => __monarch.model.state.adReceipts.length);
    await page.screenshot({path:path.join(__dirname,'reward-sign.png')});
    await tap('adGold');
    await page.waitForFunction(()=>__monarch.platform.mockRewardSeconds>0);
    await tap('mockComplete');
    assert.equal(await count(),0);
    await tap('mockCancel');
    await page.waitForFunction(()=>!__monarch.controls.adBusy);
    assert.equal(await count(),0);
    await page.waitForFunction(()=>__monarch.controls.rewardRise===1);
    await tap('adGold');
    await page.waitForFunction(()=>__monarch.controls.handlers.has('mockComplete'));
    await page.screenshot({path:path.join(__dirname,'mock-ad.png')});
    await tap('mockComplete');
    await page.waitForFunction(()=>!__monarch.controls.adBusy);
    const storage=await page.evaluate(key=>[
      JSON.parse(localStorage.getItem(key)).gold,
      JSON.parse(localStorage.getItem(key+':mock-ads')).gold,
      __monarch.model.state.adReceipts.length
    ],key);
    assert.deepEqual(storage,[initial.originalGold,initial.originalGold+10,1]);
    await page.waitForFunction(()=>__monarch.controls.rewardRise===1);
    await tap('adStamina');
    await page.waitForFunction(()=>__monarch.controls.handlers.has('mockComplete'));
    await tap('mockComplete');
    await page.waitForFunction(()=>!__monarch.controls.adBusy);
    assert.equal(await count(),2);
    assert.ok(await page.evaluate(()=>__monarch.model.infiniteStaminaSeconds>599));
    await page.evaluate(()=>{
      const {model:m,view:v}=__monarch,s=m.state;
      s.player.x=s.player.prevX=m.forge.x+180; v.camera=m.forge.x;
      s.trader.x=s.trader.prevX=560;s.trader.phase='trading';s.trader.present=true;s.trader.visitDay=s.day;
    });
    await page.waitForTimeout(460);
    await page.screenshot({path:path.join(__dirname,'cave-layout.png')});
    const guides=await page.evaluate(()=>{
      const {model:m,controls}=__monarch, director=controls.chapter.director,s=m.state;
      s.chapter.guidesSkipped=false;
      Object.assign(s.chapter.done,{hammer:true,bow:true,wall:true,tower:true});
      return ['lure','brute'].map(kind=>{
        director.hint=undefined;
        s.player.x=s.buildings.find(b=>b.kind===kind).x;
        const guide=director.chooseGuide(false);
        return [guide.key,!!guide.target,!!guide.action];
      });
    });
    assert.deepEqual(guides,[['facility:lure',false,false],['facility:brute',false,false]]);
    assert.deepEqual(errors,[]);
    fs.writeFileSync(path.join(__dirname,'report.json'),JSON.stringify({migration,storage,guides,errors},null,2));
    console.log('PASS 844x390: tap, cancel, complete, separate saves, stamina, layout migration, one-shot signs');
  } finally { await browser.close(); }
})().catch(e=>{console.error(e);process.exitCode=1;});
