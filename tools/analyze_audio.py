#!/usr/bin/env python3
"""Pre-compute audio features for the MV renderer.

Decodes the song with ffmpeg, then writes assets/analysis.json containing:
  - bpm / beatOffset : a constant tempo grid fitted to the onset envelope
  - per-frame (FPS Hz) envelopes: rms, bass, high, onset  (uint8, base64)
  - a coarse log-frequency spectrum (BANDS bands per frame, uint8, base64)

Usage: python3 tools/analyze_audio.py [assets/song.mp3] [assets/analysis.json]
"""
import base64
import json
import subprocess
import sys

import numpy as np

SR = 22050
FPS = 60          # feature frame rate
BANDS = 24        # spectrum bands for the equaliser visual
NFFT = 2048


def decode(path):
    raw = subprocess.run(
        ["ffmpeg", "-v", "error", "-i", path, "-ac", "1", "-ar", str(SR),
         "-f", "f32le", "-"],
        check=True, capture_output=True).stdout
    return np.frombuffer(raw, dtype=np.float32)


def stft_mag(x, hop):
    n_frames = int(np.ceil(len(x) / hop))
    pad = np.concatenate([np.zeros(NFFT // 2, np.float32), x,
                          np.zeros(NFFT, np.float32)])
    win = np.hanning(NFFT).astype(np.float32)
    idx = np.arange(NFFT)[None, :] + (np.arange(n_frames) * hop)[:, None]
    frames = pad[idx] * win
    return np.abs(np.fft.rfft(frames, axis=1)).astype(np.float32)


def norm_u8(v, pct=99.5):
    hi = np.percentile(v, pct) or 1.0
    return np.clip(v / hi * 255, 0, 255).astype(np.uint8)


def b64(a):
    return base64.b64encode(np.ascontiguousarray(a).tobytes()).decode()


def fit_tempo(onset, fps, lo=90, hi=200):
    """Fit a constant tempo grid (bpm, phase) to the onset envelope.

    A coarse autocorrelation estimate is refined by scoring whole-song grids:
    a slightly wrong tempo drifts out of phase, so the true one scores highest.
    """
    o = onset - onset.mean()
    ac = np.correlate(o, o, mode="full")[len(o) - 1:]
    bpms = np.arange(lo, hi, 0.5)
    scores = [sum(ac[int(round(60.0 * fps / b * k))] for k in (1, 2, 4))
              for b in bpms]
    coarse = bpms[int(np.argmax(scores))]

    dur = len(onset) / fps
    best = (-np.inf, coarse, 0.0)
    for bpm in np.arange(coarse - 2, coarse + 2, 0.01):
        period = 60.0 / bpm
        phases = np.arange(0, period, 0.002)
        beats = np.arange(0, dur - period, period)
        idx = np.round((phases[:, None] + beats[None, :]) * fps).astype(int)
        s = onset[np.clip(idx, 0, len(onset) - 1)].mean(axis=1)
        i = int(np.argmax(s))
        if s[i] > best[0]:
            best = (s[i], bpm, phases[i])
    return float(best[1]), float(best[2])


def main():
    src = sys.argv[1] if len(sys.argv) > 1 else "assets/song.mp3"
    dst = sys.argv[2] if len(sys.argv) > 2 else "assets/analysis.json"
    x = decode(src)
    duration = len(x) / SR
    hop = SR / FPS
    # resample hop to an integer by working at a slightly different rate
    hop_i = int(round(hop))
    mag = stft_mag(x, hop_i)
    frame_t = np.arange(mag.shape[0]) * hop_i / SR
    # resample feature frames onto an exact FPS grid
    grid_t = np.arange(int(duration * FPS) + 1) / FPS

    freqs = np.fft.rfftfreq(NFFT, 1 / SR)
    power = mag ** 2

    def band(lo, hi):
        m = (freqs >= lo) & (freqs < hi)
        return np.sqrt(power[:, m].mean(axis=1))

    rms = np.sqrt(power.mean(axis=1))
    bass = band(30, 160)
    high = band(4000, 11000)

    logmag = np.log1p(mag * 10)
    flux = np.maximum(0, np.diff(logmag, axis=0, prepend=logmag[:1])).sum(axis=1)
    # local mean removal -> peaky onset envelope
    k = int(FPS * 0.5)
    kernel = np.ones(k) / k
    flux = np.maximum(0, flux - np.convolve(flux, kernel, mode="same"))

    edges = np.geomspace(40, 11000, BANDS + 1)
    spec = np.stack([np.sqrt(power[:, (freqs >= a) & (freqs < b)].mean(axis=1))
                     for a, b in zip(edges[:-1], edges[1:])], axis=1)
    spec = np.log1p(spec)

    def rs(v):
        return np.interp(grid_t, frame_t, v)

    rms, bass, high, flux = (rs(v) for v in (rms, bass, high, flux))
    spec = np.stack([rs(spec[:, i]) for i in range(BANDS)], axis=1)
    spec_lo = np.percentile(spec, 5, axis=0)
    spec_hi = np.percentile(spec, 99.5, axis=0)
    spec_n = np.clip((spec - spec_lo) / (spec_hi - spec_lo + 1e-9), 0, 1)

    bpm, phase = fit_tempo(flux, FPS)

    out = {
        "duration": duration,
        "fps": FPS,
        "frames": len(grid_t),
        "bpm": round(bpm, 3),
        "beatOffset": round(phase, 4),
        "rms": b64(norm_u8(rms)),
        "bass": b64(norm_u8(bass)),
        "high": b64(norm_u8(high)),
        "onset": b64(norm_u8(flux, 99.0)),
        "bands": BANDS,
        "spec": b64((spec_n * 255).astype(np.uint8)),
    }
    with open(dst, "w") as f:
        json.dump(out, f)
    print(f"duration={duration:.2f}s bpm={bpm:.2f} beatOffset={phase:.3f}s "
          f"frames={len(grid_t)} -> {dst}")


if __name__ == "__main__":
    main()
