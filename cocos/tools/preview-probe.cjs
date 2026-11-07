const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
(async () => {
  const out = path.resolve(__dirname, '../../qa/cocos');
  const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 600 }, deviceScaleFactor: 1 });
  const logs = [];
  page.on('console', m => { logs.push({ type: m.type(), text: m.text() }); });
  page.on('pageerror', e => logs.push({ type: 'pageerror', text: e.stack }));
  await page.addInitScript(() => { globalThis.__MONARCH_QA__ = true; });
  try {
    await page.goto(process.env.MONARCH_PREVIEW_URL || 'http://127.0.0.1:7456/?scene=ed9c19c0-f798-4d1c-9717-015ca7d55722', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => !!globalThis.__monarch?.view, null, { timeout: 60000 });
    await page.waitForTimeout(1000);
    await page.evaluate(() => globalThis.__monarch.model.pause('qa', true));
    await page.screenshot({ path: path.join(out, 'first-cocos-runtime.png') });
    const state = await page.evaluate(() => ({ engine: __monarch.engine, target: __monarch.target, context: __monarch.model.context(), population: __monarch.model.population, size: [__monarch.view.width, __monarch.view.height], nodes: __monarch.view.painter.nodes.size }));
    fs.writeFileSync(path.join(out, 'preview-first.json'), JSON.stringify({ ...state, logs }, null, 2));
    console.log(JSON.stringify({ state, errors: logs.filter(l => ['error','pageerror'].includes(l.type)) }, null, 2));
  } catch (error) {
    fs.writeFileSync(path.join(out, 'preview-first-failure.json'), JSON.stringify({ error: String(error), logs }, null, 2));
    await page.screenshot({ path: path.join(out, 'first-cocos-failure.png') });
    console.error(error); process.exitCode = 1;
  } finally { await browser.close(); }
})();
