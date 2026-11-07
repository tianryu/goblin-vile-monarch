from pathlib import Path
p=Path('scripts/test_godot_mobile_v5.cjs');s=p.read_text(encoding='utf-8')
s=s.replace("if(p==='paddingBottom')return'12px'","if(p==='paddingBottom')return String(window.__testBottom||12)+'px'")
anchor="await p.setViewportSize({width:390,height:844});"
replace="""await p.evaluate(()=>window.__testBottom=34);await p.setViewportSize({width:845,height:390});await p.waitForTimeout(250);await cmd({op:'scene'});
for(const kind of ['tools','gold','army','mount','prison','steal','rally']){
 await cmd({op:'open',kind});const info=await state();let bad=info.cards.some(c=>{const a=c.CardArt,t=c.CardTitle,d=c.CardDetail,r=c.CardPrice;return a[1]+a[3]>t[1]-2||t[1]+t[3]>d[1]-2||(r&&d[1]+d[3]>r[1]-3)});
 check('Large bottom safe area keeps '+kind+' card content separate',!bad&&info.cards.length>0);await p.screenshot({path:'qa/interaction-v5/safe-'+kind+'.png'});
}
"""+anchor
s=s.replace(anchor,replace)
p.write_text(s,encoding='utf-8')
p=Path('scripts/write_v5_handoff.py');s=p.read_text(encoding='utf-8')
s=s.replace("原生UI4项、浏览器99项、DPR2和模拟安全区14项","原生UI{a['reports']['ui-native-v5-tests']['passes']}项、浏览器99项、DPR2和模拟安全区{a['reports']['mobile-layout-v5-tests']['passes']}项")
p.write_text(s,encoding='utf-8')

