"""串行调用全局H3入口；不直接POST，不另开实例，不自动批准生成结果。"""
from pathlib import Path
import subprocess,json,time,argparse,sys
ROOT=Path(__file__).resolve().parents[1]
TOOL=Path.home()/'.codex/skills/minimax-h3-local/scripts/h3_local.py'

def run(plan_path,after=None):
    # 用户暂停后不得自动续跑；只有收到明确恢复指令才移除该标记。
    pause_file=ROOT/'artifacts/animation-v8/PAUSED.json'
    if pause_file.exists():print('PAUSED_BY_USER',flush=True);return
    if after:
        predecessor=json.loads(Path(after).read_text('utf-8'))
        print('WAITING_FOR_PREDECESSOR',str(after),flush=True)
        while True:
            if pause_file.exists():print('PAUSED_BY_USER',flush=True);return
            complete=True
            for task in predecessor['tasks']:
                record=ROOT/'artifacts/animation-v8'/f"{task['asset']}-{task['action']}-{task.get('version','v01')}"/'jobs/job.json'
                if not record.exists():complete=False;continue
                state=json.loads(record.read_text('utf-8')).get('state')
                if state in ['execution_failed','submission_needs_review','submission_outcome_unknown']:raise RuntimeError('Predecessor needs inspection: '+str(record))
                if state!='execution_complete_unreviewed':complete=False
            if complete:break
            time.sleep(40)
    plan=json.loads(Path(plan_path).read_text('utf-8'))
    for i,task in enumerate(plan['tasks']):
        if pause_file.exists():print('PAUSED_BY_USER',flush=True);return
        name,action=task['asset'],task['action'];version=task.get('version','v01')
        folder=ROOT/'artifacts/animation-v8'/f'{name}-{action}-{version}'
        if not (folder/'input.json').exists():
            subprocess.run([sys.executable,'-X','utf8',str(ROOT/'scripts/prepare_animation_v8.py'),name,action,'--version',version],check=True,cwd=ROOT,capture_output=True)
        (folder/'jobs').mkdir(exist_ok=True)
        graph=folder/'jobs/api.json';record=folder/'jobs/job.json'
        log=open(folder/'jobs/queue-tool.log','a',encoding='utf-8')
        def cli(args):
            result=subprocess.run([sys.executable,'-X','utf8',str(TOOL)]+args,cwd=ROOT,stdout=log,stderr=log)
            log.flush();return result.returncode
        if not graph.exists():
            metadata=json.loads((folder/'input.json').read_text('utf-8'));inp=metadata['input_relative']
            args=['prepare','--route','single8','--prompt-file',str(folder/'prompt.txt'),'--seconds',str(task.get('seconds',2)),
                    '--seed',str(task.get('seed',731900+i)),'--prefix','MonarchV8/'+folder.name,
                    '--first-frame',inp,'--out',str(graph)]
            # 起身等单次动作使用独立结尾参考，不能把倒地片倒放冒充恢复。
            if metadata.get('end_frame_relative'):args+=['--last-frame',metadata['end_frame_relative']]
            elif task.get('loop',True):args+=['--last-frame',inp]
            if cli(args)!=0:raise RuntimeError('Preparation failed '+folder.name)
        print('START',folder.name,flush=True)
        status_failures=0
        while True:
            if record.exists():
                # 归档完成记录不再查询新服务的空history，避免恢复时抹掉原任务状态。
                state=json.loads(record.read_text('utf-8')).get('state')
                if state=='execution_complete_unreviewed':break
                code=cli(['status','--record',str(record)])
                if code!=0:
                    status_failures+=1
                    print('STATUS_UNAVAILABLE',folder.name,status_failures,flush=True)
                    if status_failures>=3:
                        raise RuntimeError('Status unavailable three times; retain accepted job and shared lease for evidence-based recovery: '+folder.name)
                    time.sleep(40)
                    continue
                status_failures=0
                state=json.loads(record.read_text('utf-8')).get('state')
                if state=='execution_complete_unreviewed':break
                if state not in ['accepted','queued_or_running','submitting','intent_recorded']:
                    raise RuntimeError('Stop to inspect existing job '+folder.name+' '+str(state))
            else:
                submit=['submit','--graph',str(graph),'--record',str(record),'--owner','MonarchV8/'+folder.name,'--wait-seconds','0']
                # 内存恢复批次只在共享锁保护的空队列事务中卸载闲置模型，不在外部抢占显卡。
                if task.get('unload_idle',False):submit+=['--unload-idle']
                if cli(submit)!=0:
                    raise RuntimeError('Submission needs inspection; never retry automatically: '+folder.name)
            time.sleep(40)
        log.close();print('GENERATED_UNREVIEWED',folder.name,flush=True)
    print('QUEUE_GENERATION_COMPLETE_REVIEW_REQUIRED',flush=True)

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('plan');p.add_argument('--after');a=p.parse_args();run(a.plan,a.after)
