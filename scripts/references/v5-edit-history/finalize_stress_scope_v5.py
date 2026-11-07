from pathlib import Path
p=Path('scripts/test_godot_stress_v5.cjs');s=p.read_text(encoding='utf-8')
s=s.replace("scope:'V5 five-minute desktop Edge software WebGL at DPR2, native canvas and 60 friendly units plus 40 durable enemies. Not phone/TapTap performance.'","scope:'V5 desktop Edge software WebGL at DPR2, native canvas and 60 friendly units plus 40 durable enemies. Duration is explicit. Not phone/TapTap performance.',device_scale_factor:2")
s=s.replace("await browser.close();\n","await browser.close();process.exitCode=report.errors.length?1:0;\n")
p.write_text(s,encoding='utf-8')

