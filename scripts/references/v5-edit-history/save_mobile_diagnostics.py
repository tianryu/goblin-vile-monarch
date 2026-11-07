from pathlib import Path
p=Path('scripts/test_godot_mobile_v5.cjs');s=p.read_text(encoding='utf-8-sig')
s=s.replace('let browser;','let browser,activeReport,activePage;').replace("const check=(n,ok)","activeReport=report;const check=(n,ok)").replace('const p=await ctx.newPage();','const p=await ctx.newPage();activePage=p;')
s=s.replace("console.error(e);if(browser)","console.error(e);if(activeReport){activeReport.exception=String(e);if(activePage){activeReport.last_state=await activePage.evaluate(()=>window.__goblinState);await activePage.screenshot({path:'qa/interaction-v5/mobile-failure.png'})}fs.writeFileSync('qa/godot/mobile-layout-v5-tests.json',JSON.stringify(activeReport,null,2))}if(browser)")
p.write_text(s,encoding='utf-8')

