from pathlib import Path
s=Path('game/tests_campaign.gd').read_text(encoding='utf-8-sig')
s=s.replace('var recruits_role="hunter"','var recruits_role="hunter"\nvar payment_cooldown=0.0')
s=s.replace('if destination.is_empty() or step%100==0:', 'if destination.is_empty() or (step%100==0 and m.state.payment.is_empty()):')
s=s.replace('\t\t\t\t\t\tvar b=m.by_id(m.state.buildings,destination.id);m.act(m.describe_building(b))','\t\t\t\t\t\tvar b=m.by_id(m.state.buildings,destination.id)\n\t\t\t\t\t\tpayment_cooldown-=0.1\n\t\t\t\t\t\tif payment_cooldown<=0:\n\t\t\t\t\t\t\tvar r=m.contribute(m.describe_building(b));payment_cooldown=0.2\n\t\t\t\t\t\t\tif not r.get("ok",false) or r.get("completed",false):destination={}')
s=s.replace('\t\t\t\tdestination={}','\t\t\t\tif not destination.is_empty() and destination.kind!="build":destination={}')
s=s.replace('campaign-bot.json','interaction-campaign-bot.json').replace('real economy, no ads or resource injection','real economy, one-coin contribution input every 0.2 seconds, no ads or resource injection')
s=s.replace('f.close();quit()','f.close();quit(0 if reports.all(func(r):return r.stats.status=="won" and r.receipts==0) else 1)')
Path('game/tests_campaign_v5.gd').write_text(s,encoding='utf-8')

