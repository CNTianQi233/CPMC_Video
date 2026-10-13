// Audio features pre-computed by tools/analyze_audio.py.

function decodeU8(b64) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function loadFeatures(json) {
  const fps = json.fps;
  const tracks = {};
  for (const k of ['rms', 'bass', 'high', 'onset']) tracks[k] = decodeU8(json[k]);
  const spec = decodeU8(json.spec);
  const bands = json.bands;
  const frames = json.frames;
  const period = 60 / json.bpm;

  const sample = (arr, t) => {
    const f = Math.max(0, Math.min(frames - 1.001, t * fps));
    const i = Math.floor(f);
    const a = f - i;
    return (arr[i] * (1 - a) + arr[i + 1] * a) / 255;
  };

  return {
    duration: json.duration,
    bpm: json.bpm,
    offset: json.beatOffset,
    period,
    /** feature value in 0..1, smoothed over `win` seconds when given */
    at(name, t, win = 0) {
      const arr = tracks[name];
      if (!win) return sample(arr, t);
      let s = 0;
      for (let k = 0; k < 5; k++) s += sample(arr, t - win * (k / 4));
      return s / 5;
    },
    /** spectrum for the equaliser: Float32Array of `bands` values in 0..1 */
    spectrum(t, out = new Float32Array(bands)) {
      const f = Math.max(0, Math.min(frames - 1, Math.round(t * fps)));
      for (let b = 0; b < bands; b++) out[b] = spec[f * bands + b] / 255;
      return out;
    },
    bands,
    /** position in beats (float) */
    beat(t) {
      return (t - json.beatOffset) / period;
    },
    /** nearest beat time to t */
    snap(t) {
      return json.beatOffset + Math.round((t - json.beatOffset) / period) * period;
    },
  };
}
