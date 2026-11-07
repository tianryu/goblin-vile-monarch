from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
import argparse
import json
import subprocess

from imageio_ffmpeg import get_ffmpeg_exe


here = Path(__file__).resolve().parent
root = here.parents[2]
capture = here / 'mobile-capture'
music = root / 'cocos/assets/resources/audio/forest_theme.ogg'
ffmpeg = get_ffmpeg_exe()


def encode(source, output, clips):
    if clips:
        video_audio = []
        for i, (start, end) in enumerate(clips):
            video_audio.extend([
                f'[0:v]trim=start={start}:end={end},setpts=PTS-STARTPTS[v{i}]',
                f'[0:a]atrim=start={start}:end={end},asetpts=PTS-STARTPTS,'
                f'afade=d=0.025,afade=t=out:st={end - start - 0.025:.3f}:d=0.025[a{i}]',
            ])
        joined = ''.join(f'[v{i}][a{i}]' for i in range(len(clips)))
        video_audio.append(f'{joined}concat=n={len(clips)}:v=1:a=1[video][effects]')
        video, effects = '[video]', '[effects]'
        duration = sum(end - start for start, end in clips)
    else:
        video_audio = []
        video, effects = '[0:v]', '[0:a]'
        duration = 120
    video_audio.extend([
        f'{video}fps=30,format=yuv420p[outv]',
        f'{effects}aresample=48000,volume=1.85[sfx]',
        f'[1:a]aresample=48000,volume=0.27,afade=t=in:d=0.2,afade=t=out:st={duration - 0.55:.3f}:d=0.55[music]',
        '[sfx][music]amix=inputs=2:duration=first:normalize=0,alimiter=limit=0.92:level=false:latency=true[outa]',
    ])
    subprocess.run([
        ffmpeg, '-hide_banner', '-loglevel', 'warning', '-nostats', '-y', '-i', str(source),
        '-stream_loop', '-1', '-i', str(music), '-filter_complex_threads', '2',
        '-filter_complex', ';'.join(video_audio), '-map', '[outv]', '-map', '[outa]',
        '-c:v', 'libx264', '-preset', 'veryfast', '-threads', '4', '-crf', '18',
        '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-movflags', '+faststart',
        str(output),
    ], check=True)


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--cuts', type=Path, default=capture / 'cuts.json')
    parser.add_argument('--source', type=Path, default=capture / 'take.webm')
    args = parser.parse_args()
    clips = json.loads(args.cuts.read_text(encoding='utf-8'))
    with ThreadPoolExecutor(max_workers=2) as pool:
        short = pool.submit(encode, args.source, capture / 'gameplay-edited.mp4', clips)
        long = pool.submit(encode, args.source, capture / 'gameplay-long.mp4', [])
        short.result()
        long.result()
