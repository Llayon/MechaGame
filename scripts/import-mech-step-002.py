#!/usr/bin/env python3
"""Import pgi's exact CC0 mech_step_002 sound linked by the user on Pixabay.

Original: https://freesound.org/people/pgi/sounds/213041/
Mirror/reference: https://pixabay.com/sound-effects/film-special-effects-mech-step-002-87150/
Use the public Freesound HQ preview and save OGG + MP3 for older Safari.
"""
import hashlib
import html
import json
import re
import subprocess
import tempfile
from pathlib import Path
from urllib.request import Request, urlopen

SOURCE = "https://freesound.org/people/pgi/sounds/213041/"
PIXABAY = "https://pixabay.com/sound-effects/film-special-effects-mech-step-002-87150/"
OUT = Path("public/assets/audio/industrial-v1")
NAME = "mech_step_002"
HEADERS = {"User-Agent": "Mozilla/5.0 (MechaGame step importer; educational game asset)"}


def fetch(url):
    with urlopen(Request(url, headers=HEADERS), timeout=55) as response:
        body = response.read()
        print("downloaded", len(body), url[:150], flush=True)
        return body


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    body = fetch(SOURCE).decode("utf-8", errors="replace")
    # Refuse importing if the original author did not publish this recording CC0.
    if "Creative Commons 0" not in body:
        raise RuntimeError("CC0 license missing on original Freesound sound page")
    markup = html.unescape(body).replace(r"\/", "/").replace(r"\u002F", "/")
    urls = re.findall(r'https?://[^\s"<>\\]+?\.(?:ogg|mp3)', markup)
    previews = [url for url in urls if "freesound" in url and
                ("-hq." in url or "preview" in url)]
    previews.sort(key=lambda u: (0 if "-hq." in u else 1, 0 if u.endswith(".ogg") else 1))
    if not previews:
        raise RuntimeError("HQ preview not found on exact pgi sound page")
    chosen = previews[0]
    with tempfile.TemporaryDirectory() as temporary:
        src = Path(temporary) / ("source.ogg" if chosen.endswith(".ogg") else "source.mp3")
        data = fetch(chosen)
        src.write_bytes(data)
        metadata = {
            "sourcePage": SOURCE, "pixabayPage": PIXABAY,
            "author": "pgi", "soundId": 213041, "license": "CC0",
            "previewUrl": chosen, "sourceSha256": hashlib.sha256(data).hexdigest(),
            "outputs": [],
        }
        for ext, codec, rate_opt, bitrate in [
            ("ogg", "libvorbis", "-q:a", "3"),
            ("mp3", "libmp3lame", "-b:a", "96k"),
        ]:
            output = OUT / (NAME + "." + ext)
            cmd = [
                "ffmpeg", "-nostdin", "-y", "-hide_banner", "-loglevel", "error",
                "-i", str(src), "-vn", "-ac", "1", "-ar", "32000",
                "-af", "highpass=f=35,lowpass=f=7200,alimiter=limit=0.87",
                "-c:a", codec, rate_opt, bitrate, str(output),
            ]
            subprocess.run(cmd, check=True)
            converted = output.read_bytes()
            if len(converted) < 900:
                raise RuntimeError("Output audio is empty: " + str(output))
            metadata["outputs"].append({
                "file": output.name, "size": len(converted),
                "sha256": hashlib.sha256(converted).hexdigest(),
            })
        path = OUT / "SOURCES.json"
        manifest = json.loads(path.read_text(encoding="utf-8"))
        manifest = [entry for entry in manifest if entry.get("soundId") != 213041]
        manifest.append(metadata)
        path.write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n",
                        encoding="utf-8")
        print("IMPORTED exact mech_step_002, OGG and MP3, CC0, files:",
              [o["file"] for o in metadata["outputs"]], flush=True)


if __name__ == "__main__":
    main()
