"""只归档已完成原片并汇总真实状态；不提交模型、不批准素材、不改变暂停状态。"""
from pathlib import Path
from datetime import datetime,timezone,timedelta
import hashlib,json,shutil
ROOT=Path(__file__).resolve().parents[1]

def inventory():
    base=ROOT/'artifacts/animation-v8';rows=[]
    for record in sorted(base.glob('*/jobs/job.json')):
        job=json.loads(record.read_text('utf-8'));folder=record.parent.parent
        row={'task':folder.name,'state':job.get('state'),'record':str(record.relative_to(ROOT)).replace('\\','/'),'visual_status':'unreviewed unless an explicit candidate manifest or rejection says otherwise'}
        if row['state']=='execution_complete_unreviewed':
            original=Path(job['outputs'][0]['fullpath']);source=folder/'source/video.mp4'
            if not source.exists():shutil.copy2(original,source)
            source_hash=hashlib.sha256(source.read_bytes()).hexdigest()
            if original.exists() and hashlib.sha256(original.read_bytes()).hexdigest()!=source_hash:raise ValueError('Source archive changed: '+folder.name)
            row.update(source=str(source.relative_to(ROOT)).replace('\\','/'),source_sha256=source_hash)
        rows.append(row)
    runtime=json.loads((ROOT/'game/art/animation/manifest.json').read_text('utf-8'))
    required=json.loads((ROOT/'qa/godot/v8-required-character-inventory.json').read_text('utf-8'))['required']
    missing=[key for key in required if runtime['clips'].get(key,{}).get('review')!='accepted-desktop-engine']
    report={'updated_at':datetime.now(timezone(timedelta(hours=8))).isoformat(),'status':'desktop-core-characters-complete' if not missing else 'in-progress-checkpoint','user_resumed':True,
            'generated_terminal_count':sum(r['state']=='execution_complete_unreviewed' for r in rows),'runtime_clip_count':len(runtime['clips']),
            'runtime_clips':{k:v['review'] for k,v in runtime['clips'].items()},'records':rows,
            'required_core_character_states':len(required),'core_missing_or_pending':missing,
            'environment_production':'Deferred by latest user scope; existing accepted scenery stays.',
            'fire_mode':'procedural, no flame sprite sequence','limitations':'Generated count is not approval. Core states are desktop-engine accepted. This does not claim every optional per-rank reaction variant, physical phone performance, TapTap host or real ad playback.'}
    (base/'inventory-current.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps({k:report[k] for k in ['status','generated_terminal_count','runtime_clip_count']}))

if __name__=='__main__':inventory()
