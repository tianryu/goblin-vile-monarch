const { chromium } = require('playwright');
const fs = require('node:fs'), path = require('node:path');
const prefix = fs.readFileSync(path.resolve(__dirname, '../playtest-fix-20261105/verify-browser.cjs'), 'utf8').split('async function verify()')[0];
async function sample(browser, build) {
    const server = new Function('require', '__dirname', prefix.replace('cocos/build/playtest-fix-20261105', 'cocos/build/' + build) + '\nreturn server;')(require, __dirname);
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const page = await browser.newPage({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 2 });
    try {
        await page.addInitScript(() => { window.__MONARCH_QA__ = true; });
        await page.goto('http://127.0.0.1:' + server.address().port);
        await page.waitForFunction(() => !!window.__monarch);
        await page.evaluate(async () => {
            window.perfCC = await System.import('cc');
            const { model: m, menus } = __monarch;
            Object.assign(m.state.chapter.seen, { opening: true, expedition: true, trader: true, general: true });
            m.state.chapter.guidesSkipped = true;
            menus.close('continue');
        });
        await page.waitForFunction(() => !__monarch.menus.blocks);
        await page.evaluate(() => __monarch.model.pause('qa', true));
        await page.waitForTimeout(800);
        return await page.evaluate(async () => {
            const v = __monarch.view, proto = window.perfCC.Node.prototype;
            const oldScale = proto.setScale, oldPosition = proto.setPosition, render = v.render;
            const result = { renders: 0, scaleCalls: 0, positionCalls: 0 };
            proto.setScale = function(...args) { result.scaleCalls++; return oldScale.apply(this, args); };
            proto.setPosition = function(...args) { result.positionCalls++; return oldPosition.apply(this, args); };
            try {
                await new Promise(resolve => {
                    v.render = function(...args) {
                        render.apply(this, args);
                        if (++result.renders === 30) resolve();
                    };
                });
            } finally {
                v.render = render;
                proto.setScale = oldScale;
                proto.setPosition = oldPosition;
            }
            return result;
        });
    } finally { await page.close(); server.close(); }
}
(async () => {
    const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--use-angle=d3d11'] });
    try {
        const results = {};
        for (const build of ['hero-motion-20261105', 'performance-20261105']) results[build] = await sample(browser, build);
        fs.writeFileSync(path.join(__dirname, 'transform-counts.json'), JSON.stringify(results, null, 2));
        console.log(results);
    } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
