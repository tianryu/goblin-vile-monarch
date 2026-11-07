const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const url = 'http://127.0.0.1:42828/field-recovery-20261104/';
const key = 'goblin-monarch-cocos-v9-qa';
(async () => {
  const browser = await chromium.launch({channel:'msedge',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  const errors=[];
  try {
    const page = await browser.newPage({viewport:{width:844,height:390},hasTouch:true});
    page.on('pageerror',e=>errors.push(e.message));
    await page.addInitScript(()=>{window.__MONARCH_QA__=true;});
    const boot = async target => {
      await page.goto(target);
      await page.waitForFunction(()=>window.__monarch?.checkpoint==='field-recovery-20261104');
      await page.waitForFunction(()=>window.__monarch.menus.phase==='open');
    };
    const tap = async (name, asset='ui_button_v5', enabled=true) => {
      await page.waitForFunction(({name,asset,enabled})=>{
        const {controls,view}=__monarch;
        return view.painter.nodes.has('control:'+name+'@'+asset)&&(!enabled||controls.handlers.has(name));
      },{name,asset,enabled});
      const point=await page.evaluate(({name,asset})=>{
        const {view:v}=__monarch,d=v.painter.nodes.get('control:'+name+'@'+asset);
        const canvas=document.querySelector('canvas').getBoundingClientRect();
        return {x:canvas.left+(d.node.position.x+v.width/2)*canvas.width/v.width,
                y:canvas.top+(v.height/2-d.node.position.y+(d.transform.anchorY-.5)*d.transform.height)*canvas.height/v.height};
      },{name,asset});
      await page.touchscreen.tap(point.x,point.y);
    };
    await boot(url);
    await page.evaluate(()=>{__monarch.model.state.day=8;__monarch.model.state.gold=17;__monarch.save();});
    await boot(url);
    await tap('menu:main:new');
    await page.waitForFunction(()=>__monarch.view.painter.nodes.get('text:newSaveWarning')?.opacity.opacity > 235);
    await page.screenshot({path:path.join(__dirname,'new-campaign.png')});
    assert.equal(await page.evaluate(()=>__monarch.model.state.day),8);
    await tap('menu:newCancel');
    await page.waitForFunction(()=>!__monarch.menus.confirmNew);
    assert.equal(await page.evaluate(key=>JSON.parse(localStorage.getItem(key)).day,key),8);
    await tap('menu:main:new');
    await tap('menu:newConfirm');
    await page.waitForFunction(()=>!__monarch.menus.blocks);
    assert.deepEqual(await page.evaluate(key=>[__monarch.model.population,__monarch.model.populationLimit,
      JSON.parse(localStorage.getItem(key)).day,JSON.parse(localStorage.getItem(key+':backup')).day],key),[6,15,1,1]);
    await page.evaluate(()=>{const {model:m,controls:c}=__monarch; m.state.chapter.guidesSkipped=true;
      if(c.chapter.director.dialogue)c.chapter.director.advance(true);else m.state.chapter.seen.opening=true;
    });
    await page.waitForFunction(()=>__monarch.controls.rewardRise===.55);
    assert.ok(await page.evaluate(()=>__monarch.view.painter.nodes.has('control:adGold@price_board')));
    await page.screenshot({path:path.join(__dirname,'cave-wall-and-reward-signs.png')});
    await page.evaluate(()=>{const {model:m}=__monarch;m.state.player.x=m.state.player.prevX=3950;});
    await tap('returnHome','ui_action_ring');
    await page.waitForFunction(()=>Math.abs(__monarch.model.state.player.x-__monarch.model.hall.x)<100);
    assert.ok(await page.evaluate(()=>__monarch.model.returnHomeSeconds>119));
    await page.evaluate(()=>{const {model:m}=__monarch, s=m.state;s.player.x=s.player.prevX=3980;
      const e=m.makeEnemy('human',3980,0);e.state='dead';e.hp=0;e.coinLoot=1;m.rebuildEnemyCache();m.selectionX=NaN;
    });
    await page.waitForFunction(()=>__monarch.view.context?.kind==='corpse');
    const gold=await page.evaluate(()=>__monarch.model.state.gold);
    await tap('action0','ui_action_ring');
    assert.equal(await page.evaluate(()=>__monarch.model.state.gold),gold+1);
    await page.evaluate(()=>{__monarch.model.state.player.hp=20;});
    await page.waitForFunction(()=>__monarch.view.lowHealthAlpha>.48);
    await page.screenshot({path:path.join(__dirname,'low-health.png')});
    await page.evaluate(()=>{
      const {model:m,view}=__monarch,p=m.state.player;
      view.camera=p.x;p.hp=m.playerMaxHp;
      const giant=m.makeEnemy('human',p.x+50,0,999,{id:m.id(),hero:'heavy',kind:'human',sourceCamp:0});
      giant.spells=0;giant.cooldown=0;
    });
    await page.waitForFunction(()=>__monarch.model.state.enemies.some(e=>e.hero==='heavy'&&e.windup?.left<.75));
    await page.screenshot({path:path.join(__dirname,'heavy-slam-warning.png')});
    await page.waitForFunction(()=>__monarch.model.state.effects.some(e=>e.kind==='slamImpact'&&e.age>.08));
    await page.screenshot({path:path.join(__dirname,'heavy-slam-impact.png')});
    await page.evaluate(()=>{__monarch.model.state.day=6;__monarch.model.finish('lost');});
    await tap('resultRestart');
    await page.waitForFunction(()=>__monarch.model.state.status==='playing');
    assert.deepEqual(await page.evaluate(()=>[__monarch.model.state.day,__monarch.model.population,__monarch.model.state.gold]),[6,3,0]);
    assert.ok(await page.evaluate(()=>__monarch.model.truceSeconds>239));
    await boot(url+'?mockAds=1');
    await tap('menu:main:continue');
    await tap('adGold','price_board');
    await page.waitForFunction(()=>__monarch.controls.handlers.has('mockCancel'));
    await tap('mockCancel');
    await page.waitForFunction(()=>!__monarch.controls.adBusy);
    const pop=await page.evaluate(()=>{
      const m=__monarch.model,pop=m.population;
      m.state.gold=12;m.state.player.hp=0;m.finish('lost');return pop;
    });
    await tap('resultRevive');
    await tap('mockComplete');
    await page.waitForFunction(()=>!__monarch.controls.adBusy&&__monarch.model.state.status==='playing');
    assert.deepEqual(await page.evaluate(()=>[__monarch.model.population,__monarch.model.state.gold,__monarch.model.state.player.hp]),[pop,12,100]);
    assert.ok(await page.evaluate(()=>__monarch.model.truceSeconds>239));
    assert.deepEqual(errors,[]);
    fs.writeFileSync(path.join(__dirname,'browser-report.json'),JSON.stringify({checks:['fresh UI and cave wall','new campaign warning and cancel','main and backup replaced','touch recall','touch corpse pickup','low-health tint','slam warning and impact','both revival buttons and truce','old reward style and mock cancellation'],viewport:[844,390],errors},null,2));
    console.log('Browser checks passed on 42828');
  } finally { await browser.close(); }
})().catch(e=>{console.error(e);process.exitCode=1;});
