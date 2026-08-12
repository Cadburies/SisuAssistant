#!/usr/bin/env python3
"""Receives base64 PCM audio chunks from tcamera (LilyGo T-Camera, issue
#33) via an HA webhook + shell_command, appends each to a per-clip raw
file, wraps it as a playable .wav once the "final" chunk arrives.

16kHz / 16-bit / mono PCM -- must match tcamera.yaml's `microphone:`
sample_rate/bits_per_sample exactly, or the resulting .wav will play back
at the wrong pitch/speed even though the bytes themselves are correct.

Usage:
  tcamera_audio_receiver.py <clip_id> <seq> <final:true|false> <base64_pcm>
"""
from __future__ import annotations

import base64
import struct
import sys
from pathlib import Path

CLIPS_DIR = Path("/config/www/dinghy_clips")
SAMPLE_RATE = 16000
BITS_PER_SAMPLE = 16
CHANNELS = 1


def _write_wav_header(f, data_len: int) -> None:
    byte_rate = SAMPLE_RATE * CHANNELS * BITS_PER_SAMPLE // 8
    block_align = CHANNELS * BITS_PER_SAMPLE // 8
    f.write(b"RIFF")
    f.write(struct.pack("<I", 36 + data_len))
    f.write(b"WAVE")
    f.write(b"fmt ")
    f.write(struct.pack("<IHHIIHH", 16, 1, CHANNELS, SAMPLE_RATE, byte_rate, block_align, BITS_PER_SAMPLE))
    f.write(b"data")
    f.write(struct.pack("<I", data_len))


def main() -> None:
    if len(sys.argv) < 5:
        print("usage: tcamera_audio_receiver.py <clip_id> <seq> <final> <base64_pcm>", file=sys.stderr)
        sys.exit(1)

    clip_id, seq, final, data_b64 = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4]
    CLIPS_DIR.mkdir(parents=True, exist_ok=True)

    raw_path = CLIPS_DIR / f"clip_{clip_id}.raw"
    try:
        pcm = base64.b64decode(data_b64)
    except Exception as err:  # noqa: BLE001 -- log and bail, don't crash the shell_command
        print(f"base64 decode failed (clip {clip_id} seq {seq}): {err}", file=sys.stderr)
        sys.exit(1)

    with open(raw_path, "ab") as f:
        f.write(pcm)

    if final.strip().lower() in ("true", "1"):
        wav_path = CLIPS_DIR / f"clip_{clip_id}.wav"
        data = raw_path.read_bytes()
        with open(wav_path, "wb") as f:
            _write_wav_header(f, len(data))
            f.write(data)
        raw_path.unlink()
        print(f"wrote {wav_path} ({len(data)} bytes PCM)")


if __name__ == "__main__":
    main()
