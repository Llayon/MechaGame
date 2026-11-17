#!/usr/bin/env python3
"""Import only verified CC0 Freesound previews and official Kenney Impact Sounds."""
import hashlib
import html
import json
import re
import subprocess
import tempfile
import zipfile
from pathlib import Path
from urllib.request import urlopen, Request

OUT = Path("public/assets/audio/industrial-v1")
OUT.mkdir(parents=True, exist_ok=True)
UA = {"User-Agent": "Mozilla/5.0 MechaGame-CC0-Importer", "Accept": "*/*"}
SOUNDS = [
    ("diesel", 237292, "AugustSandberg", 9.0, 7.0),
    ("steps", 557594, "Breviceps", 0.0, 6.0),
    ("hydraulic", 212941, "nuckan", 0.3, 4.0),
    ("gun", 165394, "ShawnyBoy", 0.0, 2.8),
    ("tank", 127845, "GaryQ", 0.0, 4.1),
]
KENNEY = "https://kenney.nl/media/pages/assets/impact-sounds/87b4ddecda-1677589768/kenney_impact-sounds.zip"

def download(url):
    with urlopen(Request(url, headers=UA), timeout=60) as r:
        data = r.read()
        print("download", len(data), url[:140], flush=True)
        return data

def freesound(name, sid, author, tmp):
    page = f"https://freesound.org/people/{author}/sounds/{sid}/"
    raw = download(page).decode("utf-8", errors="replace")
    if "Creative Commons 0" not in raw:
        raise RuntimeError(f"CC0 license missing on {page}")
    s = html.unescape(raw).replace(r"\/", "/").replace(r"\u002F", "/")
    urls = re.findall(r'https?://[^\s"<>\\]+?\.(?:mp3|ogg)', s)
    urls = [u for u in urls if "freesound" in u and ("-hq." in u or "preview" in u)]
    urls.sort(key=lambda u: (0 if "-hq." in u else 1, 0 if u.endswith(".ogg") else 1))
    if not urls:
        excerpts = re.findall(r'.{0,100}(?:preview|hq\.mp3|hq\.ogg).{0,100}', s, re.I)
        print("MISSING PREVIEW:", excerpts[:12], flush=True)
        raise RuntimeError("Cannot locate Freesound preview " + page)
    url = urls[0]
    path = tmp / (name + (".ogg" if url.endswith(".ogg") else ".mp3"))
    path.write_bytes(download(url))
    return path, {"sourcePage": page, "author": author, "license": "CC0",
                  "previewUrl": url, "sourceSha256": hashlib.sha256(path.read_bytes()).hexdigest()}

def encode(src, output, start, duration, lo=11000, hi=35):
    args = ["ffmpeg", "-nostdin", "-y", "-hide_banner", "-loglevel", "error", "-ss", str(start),
            "-i", str(src), "-t", str(duration), "-vn", "-ac", "1", "-ar", "32000",
            "-af", f"highpass=f={hi},lowpass=f={lo},alimiter=limit=0.88",
            "-c:a", "libvorbis", "-q:a", "3", str(OUT / output)]
    subprocess.run(args, check=True)
    data = (OUT / output).read_bytes()
    if len(data) < 900: raise RuntimeError(f"Bad audio output {output}: {len(data)} bytes")
    # Safari/iOS before 18.4 cannot reliably decode Ogg Vorbis.
    # Encode MP3 directly from the source with identical trimming and EQ.
    mp3_path = (OUT / output).with_suffix(".mp3")
    mp3_args = list(args)
    codec_idx = mp3_args.index("-c:a")
    mp3_args[codec_idx + 1] = "libmp3lame"
    quality_idx = mp3_args.index("-q:a")
    mp3_args[quality_idx:quality_idx + 2] = ["-b:a", "96k"]
    mp3_args[-1] = str(mp3_path)
    subprocess.run(mp3_args, check=True)
    mp3_data = mp3_path.read_bytes()
    if len(mp3_data) < 900: raise RuntimeError("Bad MP3 output " + str(mp3_path))
    return {
        "file": output, "size": len(data), "sha256": hashlib.sha256(data).hexdigest(),
        "mp3File": mp3_path.name, "mp3Size": len(mp3_data),
        "mp3Sha256": hashlib.sha256(mp3_data).hexdigest(),
    }

def main():
    manifest = []
    with tempfile.TemporaryDirectory() as td:
        tmp = Path(td)
        for name, sid, author, start, duration in SOUNDS:
            file, meta = freesound(name, sid, author, tmp)
            if name == "diesel":
                outputs = [encode(file, "diesel_idle.ogg", start, duration, lo=1900, hi=28)]
            elif name == "steps":
                outputs = [encode(file, f"mech_step_{i}.ogg", offset, .90, lo=6000)
                           for i, offset in enumerate([0.0, 1.2, 3.0], 1)]
            elif name == "hydraulic":
                outputs = [encode(file, "hydraulic_a.ogg", .3, 1.2, lo=6500, hi=80),
                           encode(file, "hydraulic_b.ogg", 2.2, 1.2, lo=6500, hi=80)]
            elif name == "gun":
                outputs = [encode(file, f"autocannon_{i}.ogg", offset, .23, lo=10500)
                           for i, offset in enumerate([.04, .28, .52], 1)]
            else:
                outputs = [encode(file, "heavy_cannon.ogg", 0, duration, lo=10500, hi=25)]
            manifest.append({**meta, "outputs": outputs})
        outputs = []
        for src, dst in [
            ("impactMetal_heavy_000.ogg", "armor_hit_1.ogg"),
            ("impactMetal_heavy_002.ogg", "armor_hit_2.ogg"),
            ("impactPlate_heavy_000.ogg", "foot_metal.ogg"),
            ("impactPlate_heavy_001.ogg", "recoil.ogg"),
            ("impactMining_000.ogg", "explosion_debris.ogg"),
        ]:
            # This mirror retains the unchanged official CC0 Kenney OGG files.
            url = ("https://raw.githubusercontent.com/GeorgeQLe/assets-sfx-combat/main/"
                   "assets/kenney/impact-sounds/Audio/" + src)
            p = tmp / src
            p.write_bytes(download(url))
            outputs.append({"sourceFile": url, "output": encode(p, dst, 0, 4.0)})
        manifest.append({"sourcePage": "https://kenney.nl/assets/impact-sounds",
                        "author": "Kenney", "license": "CC0",
                        "mirror": "https://github.com/GeorgeQLe/assets-sfx-combat",
                        "outputs": outputs})
    (OUT / "SOURCES.json").write_text(json.dumps(manifest, indent=2) + "\n")
    print("IMPORTED", len(list(OUT.glob("*.ogg"))), "OGG and", len(list(OUT.glob("*.mp3"))), "MP3 files",
          sum(p.stat().st_size for p in OUT.glob("*.ogg")), "bytes", flush=True)

if __name__ == "__main__":
    main()
