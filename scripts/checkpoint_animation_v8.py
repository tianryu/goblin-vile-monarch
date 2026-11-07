"""暂停归档：只记录已有任务与复制既有原片，不提交任何生成任务。"""
from pathlib import Path
from datetime import datetime,timezone,timedelta
import json,shutil,hashlib
ROOT=Path(__file__).resolve().parents[1];BASE=ROOT/'artifacts/animation-v8'
stamp=datetime.now(timezone.utc).astimezone(timezone(timedelta(hours=8),'Asia/Shanghai')).isoformat()
rows=[]
for record in sorted(BASE.glob('*/jobs/job.json')):
    data=json.loads(record.read_text('utf-8'));folder=record.parent.parent
    entry={'task':folder.name,'state':data.get('state'),'prompt_id':data.get('prompt_id'),'record':str(record.relative_to(ROOT)),'visual_status':'unreviewed unless separate manifest says otherwise'}
    if data.get('state')=='execution_complete_unreviewed':
        source=folder/'source/video.mp4'
        output=next((Path(o.get('fullpath',o.get('path',''))) for o in data.get('outputs',[]) if o.get('filename','').endswith('.mp4')),None)
        if output and output.is_file():
            source.parent.mkdir(exist_ok=True)
            if not source.exists():shutil.copy2(output,source)
            entry['source_sha256']=hashlib.sha256(source.read_bytes()).hexdigest()
            entry['source_matches_h3_output']=entry['source_sha256']==hashlib.sha256(output.read_bytes()).hexdigest()
            entry['source']=str(source.relative_to(ROOT))
    rows.append(entry)
plan=json.loads((BASE/'cohort-03.json').read_text('utf-8'));done={r['task'] for r in rows if r['state']=='execution_complete_unreviewed'}
pending=[t for t in plan['tasks'] if f"{t['asset']}-{t['action']}-{t.get('version','v01')}" not in done]
(BASE/'resume-pending.json').write_text(json.dumps({'purpose':'Only resume after explicit user instruction and removing PAUSED.json; these representative jobs have not started.','tasks':pending},ensure_ascii=False,indent=2),encoding='utf-8')
info={'status':'paused-by-explicit-user-request','paused_at':stamp,'user_request':'先暂停，做好记录，我要休息了，明天继续','queue_controllers':'stopped','h3_queue':'verified empty; last MonarchV8 task terminal and shared lock idle','h3_service':'to be stopped after archival','records':rows,'record_count':len(rows),'terminal_generated_count':sum(r['state']=='execution_complete_unreviewed' for r in rows),'unstarted_representative_tasks':pending,'release_preview':'42820 remains previous static release','development_preview':'42819 has 3 staged prototype clips and flat AI ground; not complete animation release'}
(BASE/'PAUSED.json').write_text(json.dumps(info,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({'records':len(rows),'terminal':info['terminal_generated_count'],'pending_unstarted':len(pending),'archive_mismatches':[r['task'] for r in rows if r.get('source_matches_h3_output') is False],'paused_at':stamp}))
