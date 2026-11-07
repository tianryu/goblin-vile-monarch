from pathlib import Path
from collections import Counter
from hashlib import sha256
from zipfile import ZipFile, ZIP_DEFLATED
from PIL import Image
from imageio_ffmpeg import get_ffmpeg_exe
import json
import re
import subprocess
import sys

root = Path(__file__).resolve().parents[3]
project = root / 'cocos'
delivery = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else root / 'release/taptap-20261104-r1'
materials = delivery / 'materials'
artifact = delivery / 'game.zip'

def size(dir_path, suffixes=None):
    return sum(p.stat().st_size for p in dir_path.rglob('*') if p.is_file()
               and (suffixes is None or p.suffix in suffixes))

with ZipFile(artifact) as z:
    assert z.testzip() is None
    names = z.namelist()
    assert not any(n.endswith(('.map','.meta')) or 'non-export/' in n for n in names)
    game = json.loads(z.read('game.json'))
    assert game['deviceOrientation'] == 'landscape' and game['productVersion'] == '0.10.0'
    assert game['subPackages'] == [{'name':'resources','root':'subpackages/resources/'}]
    assert 'subpackages/resources/game.js' in names and 'game.js' in names
    settings_path, = (n for n in names if re.fullmatch(r'src/settings\.[a-f0-9]+\.json',n))
    settings = json.loads(z.read(settings_path))
    assert settings['engine']['debug'] is False
    assert settings['assets']['subpackages'] == ['resources']
    if (delivery / 'credits-ai.png').exists():
        assert any(b'OpenAI ImageGen' in z.read(n) for n in names if n.endswith('.js'))
    version = settings['assets']['bundleVers']['resources']
    resource_index = json.loads(z.read(f'subpackages/resources/config.{version}.json'))
    paths = {item[0] for item in resource_index['paths'].values()}
    for item in ('art/title_wordmark','audio/sword_heavy','fonts/GoblinHand','fonts/WenKai-OFL','licenses/Cocos-LICENSE','licenses/third-party-notices'):
        assert item in paths, item
    retirement = json.loads((project/'non-export/20261104-store/retired-resources/inventory.json').read_text(encoding='utf8'))
    for item in retirement:
        assert Path(item['resource']).with_suffix('').as_posix() not in paths, item
    reference = (project/'assets/resources/audio/sword_heavy.ogg').read_bytes()
    assert any(z.read(n) == reference for n in names if n.endswith('.ogg'))
    main_bytes = sum(f.file_size for f in z.infolist() if not f.filename.startswith('subpackages/'))
    main_compressed = sum(f.compress_size for f in z.infolist() if not f.filename.startswith('subpackages/'))
    sub_bytes = sum(f.file_size for f in z.infolist() if f.filename.startswith('subpackages/'))
    assert main_bytes < 4_000_000, main_bytes
    assert artifact.stat().st_size < 20_000_000, artifact.stat().st_size

spec = {
    'icon-1024.png':((1024,1024),None),
    'promo-16x9.jpg':((1920,1080),4),
    'promo-1x1.jpg':((1440,1440),4),
    'windows-cover-landscape.jpg':((460,215),3),
    'windows-cover-portrait.jpg':((600,900),3),
    'windows-library-background.jpg':((3840,1240),10),
    'windows-promo-landscape-no-logo.jpg':((1920,1080),6),
    'windows-promo-portrait-no-logo.jpg':((720,1080),6),
    'editorial-1920x1280-review-only.jpg':((1920,1280),None),
    **{name:((1920,1080),4) for name in ('01-outpost.jpg','02-defense.jpg','03-siege.jpg')},
}
images = {}
for name,(dimensions,limit) in spec.items():
    f = materials / name
    with Image.open(f) as im:
        assert im.size == dimensions, (name, im.size)
        if name.startswith('icon-'):
            assert im.mode=='RGB'
        im.verify()
    assert not limit or f.stat().st_size <= limit*1_000_000
    images[name] = {'size':dimensions,'bytes':f.stat().st_size}
logo = materials/'windows-logo.png'
with Image.open(logo) as im:
    assert im.width >= 1280 or im.height >= 720
    assert im.getchannel('A').getextrema() == (0,255)
    images[logo.name] = {'size':im.size,'bytes':logo.stat().st_size}
assert logo.stat().st_size < 4_000_000
assert len({sha256((materials/name).read_bytes()).digest() for name in spec if name[:2] in ('01','02','03')}) == 3
def inspect_video(path, with_audio=False):
    audio_options = ['-map','0:a:0','-af','volumedetect'] if with_audio else []
    decode = subprocess.run([get_ffmpeg_exe(),'-hide_banner','-xerror','-i',str(path),'-map','0:v:0',*audio_options,'-f','null','-'],
                            text=True,capture_output=True,check=True)
    assert 'Video: h264' in decode.stderr and '1920x1080' in decode.stderr
    duration = re.search(r'Duration: (\d+):(\d+):(\d+\.\d+)',decode.stderr)
    seconds = int(duration[1])*3600+int(duration[2])*60+float(duration[3])
    info = {'dimensions':[1920,1080],'codec':'H.264','durationSeconds':seconds,'bytes':path.stat().st_size}
    if with_audio:
        assert 'Audio: aac' in decode.stderr
        mean_volume = float(re.search(r'mean_volume: (-?\d+\.\d+) dB',decode.stderr)[1])
        assert mean_volume > -40, mean_volume
        info.update(audioCodec='AAC', audioMeanDbfs=mean_volume)
    return info

long_video = delivery/'gameplay-long-1920x1080.mp4'
video_info = inspect_video(materials/'gameplay-1920x1080.mp4', with_audio=long_video.exists())
assert 15 < video_info['durationSeconds'] <= 1800
if long_video.exists():
    long_info = inspect_video(long_video, with_audio=True)
    assert 55 < video_info['durationSeconds'] < 65
    assert 110 < long_info['durationSeconds'] < 125
assets = project/'assets'
native = {'.png','.ogg','.json','.ttf','.txt','.effect'}
archive = delivery/'store-materials.zip'
with ZipFile(archive,'w',ZIP_DEFLATED,compresslevel=6) as z:
    for f in sorted(materials.iterdir()):
        z.write(f,'materials/'+f.name)
    for name in ('上架物料说明.md','美术生成记录.md'):
        z.write(delivery/name,name)

report = {'projectCoreBytes': sum(size(project/name) for name in ('assets','config','settings','build-templates'))+(project/'package.json').stat().st_size,
          'projectFolderBytes':size(project), 'runtimeResourceBytes':size(assets/'resources',native),
          'removedFileCount':len(retirement),'removedBytes':sum(x['bytes'] for x in retirement),
          'gameZipBytes':artifact.stat().st_size,'gameZipSha256':sha256(artifact.read_bytes()).hexdigest(),
          'mainPackageBytes':main_bytes,'mainCompressedContentBytes':main_compressed,'resourceSubpackageBytes':sub_bytes,
          'materialsZipBytes':archive.stat().st_size,'images':images,
          'video':video_info}
if long_video.exists():
    report['longVideo'] = long_info
(delivery/'verification.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
print(json.dumps({k:v for k,v in report.items() if k!='images'}, ensure_ascii=False,indent=2))
