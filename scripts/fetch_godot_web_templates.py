"""Fetch selected official export-template ZIP entries using HTTP range requests."""
from pathlib import Path
import urllib.request, struct, zlib, zipfile, io, json, time

URL='https://godot-releases.nbg1.your-objectstorage.com/4.7.2-stable/Godot_v4.7.2-stable_export_templates.tpz'
DEST=Path('C:/Users/田煜/AppData/Roaming/Godot/export_templates/4.7.2.stable')
def request(start=None,end=None,suffix=None):
    headers={'User-Agent':'GoblinMonarch-build/1.0'}
    if suffix: headers['Range']=f'bytes=-{suffix}'
    elif start is not None: headers['Range']=f'bytes={start}-{end}'
    last=None
    for attempt in range(3):
        try:
            with urllib.request.urlopen(urllib.request.Request(URL,headers=headers),timeout=90) as r:
                data=r.read(); cr=r.headers.get('Content-Range','')
                if (suffix or start is not None) and r.status!=206: raise RuntimeError('Server did not support partial download')
                return data,cr
        except Exception as e: last=e; time.sleep(attempt+1)
    raise last

tail,cr=request(suffix=131072)
p=tail.rfind(b'PK\x05\x06')
if p<0: raise RuntimeError('Missing ZIP central directory')
_,_,_,count_disk,count,total_size,offset,comment=struct.unpack_from('<4s4H2IH',tail,p)
directory,_=request(offset,offset+total_size-1)
entries=[]; pos=0
while pos<len(directory) and directory[pos:pos+4]==b'PK\x01\x02':
    fields=struct.unpack_from('<4s6H3I5H2I',directory,pos)
    method,crc,csize,usize=fields[4],fields[7],fields[8],fields[9]
    nl,el,cl=fields[10:13]; local=fields[16]
    name=directory[pos+46:pos+46+nl].decode('utf8')
    entries.append((name,method,crc,csize,usize,local)); pos+=46+nl+el+cl
selected=[e for e in entries if e[0].split('/')[-1] in ('web_nothreads_release.zip','web_nothreads_debug.zip','version.txt')]
if not any('web_nothreads_release.zip' in e[0] for e in selected):
    raise RuntimeError('Expected single-thread templates missing: '+str([e[0] for e in entries if 'web' in e[0]]))
DEST.mkdir(parents=True,exist_ok=True)
report=[]
for name,method,crc,csize,usize,local in selected:
    target=DEST/name.split('/')[-1]
    if target.exists() and target.stat().st_size==usize:
        print('Already present: '+target.name,flush=True);continue
    print('Fetching '+name+' '+str(round(csize/1048576,2))+' MiB',flush=True)
    header,_=request(local,local+29)
    fn,extra=struct.unpack_from('<HH',header,26)
    start=local+30+fn+extra
    compressed,_=request(start,start+csize-1)
    data=zlib.decompress(compressed,-15) if method==8 else compressed
    if len(data)!=usize or zlib.crc32(data)&0xffffffff!=crc: raise RuntimeError('ZIP member checksum mismatch')
    if target.suffix=='.zip':
        with zipfile.ZipFile(io.BytesIO(data)) as archive:
            bad=archive.testzip()
            if bad: raise RuntimeError('Inner template archive corrupt: '+bad)
    target.write_bytes(data);report.append({'name':target.name,'bytes':len(data)})
    print('Installed '+target.name,flush=True)
Path('qa/godot/templates.json').write_text(json.dumps({'source':URL,'destination':str(DEST),'installed':report},indent=2),encoding='utf8')
