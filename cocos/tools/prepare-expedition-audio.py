"""裁切和压缩已核对来源的音频，运行包只包含成品。"""
import json
from pathlib import Path
import subprocess
import sys
from zipfile import ZipFile

import numpy as np

ROOT = Path(__file__).resolve().parents[2]
QA = ROOT / "qa/cocos/audio-mix-20261104"
SOURCE = QA / "source"
OUTPUT = ROOT / "cocos/assets/resources/audio"
FFMPEG = sys.argv[1]
RATE = 24000
report = {}


def decode(source, audio_filter="highpass=f=45", start=0, duration=None):
    args = [FFMPEG, "-hide_banner", "-loglevel", "error"]
    if isinstance(source, bytes):
        args.extend(["-i", "pipe:0"])
    else:
        args.extend(["-i", str(source)])
    args.extend(["-ss", str(start)])
    if duration:
        args.extend(["-t", str(duration)])
    args.extend(["-vn", "-af", audio_filter, "-ac", "1", "-ar", str(RATE), "-f", "f32le", "pipe:1"])
    result = subprocess.run(args, input=source if isinstance(source, bytes) else None,
                            stdout=subprocess.PIPE, check=True)
    pcm = np.frombuffer(result.stdout, dtype="<f4").copy()
    if len(pcm) < RATE * .04 or not np.isfinite(pcm).all():
        raise ValueError("音频长度或采样异常")
    return pcm


def save(name, pcm, rms, loop_overlap=0, tail=0, quality=2):
    if loop_overlap:
        n = round(RATE * loop_overlap)
        blend = np.linspace(0, 1, n, dtype=np.float32)
        pcm = np.concatenate((pcm[-n:] * (1 - blend) + pcm[:n] * blend, pcm[n:-n]))
    if tail:
        n = min(len(pcm), round(RATE * tail))
        pcm[-n:] *= np.linspace(1, 0, n)
    peak = float(np.max(np.abs(pcm)))
    energy = float(np.sqrt(np.mean(pcm ** 2)))
    pcm *= min(rms / max(energy, .0001), .87 / max(peak, .0001))
    target = OUTPUT / f"{name}.ogg"
    subprocess.run([FFMPEG, "-y", "-loglevel", "error", "-f", "f32le", "-ar", str(RATE),
                    "-ac", "1", "-i", "pipe:0", "-c:a", "libvorbis", "-q:a", str(quality), str(target)],
                   input=pcm.astype("<f4").tobytes(), check=True)
    report[name] = {"seconds": round(len(pcm) / RATE, 3), "bytes": target.stat().st_size,
                    "peak": round(float(np.max(np.abs(pcm))), 4)}


def from_zip(path, basename):
    with ZipFile(path) as archive:
        member = next(name for name in archive.namelist() if Path(name).name == basename)
        return archive.read(member)


def wood(name):
    return subprocess.check_output(["tar.exe", "-xOf", str(SOURCE / "wood.7z"), f"wood_impact/{name}.mp3.flac"])


bard = decode(SOURCE / "bard.wav")
forest = decode(from_zip(SOURCE / "forest.zip", "Forest Whisper.wav"))
drums = decode(SOURCE / "war-drums.wav", "highpass=f=42,lowpass=f=4900")
save("bard", bard, .16, quality=3)
save("forest_theme", forest, .16, quality=3)
save("march_drums", drums, .16, quality=3)
# 一次鼓槌击打与集结动画同步，完整节奏只在队伍出发后循环。
save("drum_strike", drums[:round(RATE * .40)].copy(), .22, tail=.12)
save("birds", decode(SOURCE / "bird.mp3", "highpass=f=155", 15, 41), .15, 1.4)
save("crickets", decode(SOURCE / "night.mp3", "highpass=f=165", 8, 36), .12, 1.25)
save("stream", decode(SOURCE / "brook.mp3", "highpass=f=125", 2, 27), .14, 1)
save("fire_loop", decode(SOURCE / "campfire.mp3", "highpass=f=95,lowpass=f=3900", 1, 17), .13, .8)
save("hoof_soft", decode(OUTPUT / "hoof.ogg", "highpass=f=80,lowpass=f=1550"), .16, tail=.09)
save("wood_hit", decode(wood("impactwood07"), duration=.65), .18, tail=.07)
save("wood_break", decode(wood("crack07"), duration=1.3), .23, tail=.13)
save("sword_hit", decode(from_zip(SOURCE / "sword-full.zip", "sword.4.ogg")), .17, tail=.055)
save("shield_hit", decode(from_zip(SOURCE / "shield.zip", "sword_clash.3.ogg"), "highpass=f=90,lowpass=f=4600"), .19, tail=.08)
kenney = ROOT / "qa/downloads/RPGsounds_Kenney.zip"
save("chest_open", decode(from_zip(kenney, "doorOpen_2.ogg")), .17, tail=.08)
save("metal_latch", decode(from_zip(kenney, "metalLatch.ogg")), .16, tail=.07)
save("cart_creak", decode(from_zip(kenney, "creak2.ogg")), .16, tail=.09)
save("raid_horn", decode(SOURCE / "horn.mp3", "highpass=f=100,lowpass=f=2800", 0, 4.1), .17, tail=.55)
save("heartbeat", decode(SOURCE / "heart.mp3", "highpass=f=38,lowpass=f=1900", 0, 1.4), .17, tail=.15)
victory = bard[-round(RATE * 2.8):].copy()
victory[:round(RATE * .18)] *= np.linspace(0, 1, round(RATE * .18))
save("victory", victory, .16, tail=.4)
(QA / "audio-report.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
print(f"{len(report)} clips, {sum(clip['bytes'] for clip in report.values())} bytes")
