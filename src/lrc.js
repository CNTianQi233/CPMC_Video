// LRC parser tuned for the "original + translation" exports produced by common
// music apps: every original line is followed by its translation, and the
// translation is stamped either with the same time or with the next line's
// start time. Plain (untranslated) LRC files are handled as well.

const TIME_TAG = /\[(\d+):(\d+(?:[.:]\d+)?)\]/g;
const CREDIT = /^(词|曲|作词|作曲|编曲|編曲|作詞|歌|演唱|翻译|翻訳|lyrics|music|arrange[rd]?)\s*[:：]/i;

function readEntries(text) {
  const out = [];
  for (const raw of text.replace(/^﻿/, '').split(/\r?\n/)) {
    TIME_TAG.lastIndex = 0;
    const times = [];
    let m;
    let end = 0;
    while ((m = TIME_TAG.exec(raw)) && m.index === end) {
      times.push(+m[1] * 60 + parseFloat(m[2].replace(':', '.')));
      end = TIME_TAG.lastIndex;
    }
    if (!times.length) continue;
    const body = raw.slice(end).trim();
    for (const t of times) out.push({ t, text: body });
  }
  return out;
}

// Paired files stamp the translation with the original's time or with the
// next original's time. Plain files almost never line up that way.
function looksPaired(entries) {
  if (entries.length < 4 || entries.length % 2) return false;
  const n = entries.length / 2;
  let hits = 0;
  for (let i = 0; i < n; i++) {
    const a = entries[2 * i];
    const b = entries[2 * i + 1];
    const next = entries[2 * i + 2];
    if (Math.abs(b.t - a.t) < 0.02 || (next ? Math.abs(b.t - next.t) < 0.02 : b.t >= a.t)) hits++;
  }
  return hits / n >= 0.8;
}

/**
 * @returns {{meta: {title: string, artist: string, credits: string[]},
 *            lines: {index: number, start: number, end: number, text: string, trans: string}[]}}
 */
export function parseLRC(text, { maxHold = 6.5 } = {}) {
  const entries = readEntries(text);
  const pairs = looksPaired(entries)
    ? Array.from({ length: entries.length / 2 }, (_, i) => ({
        t: entries[2 * i].t,
        text: entries[2 * i].text,
        trans: entries[2 * i + 1].text,
        transT: entries[2 * i + 1].t,
      }))
    : entries.map((e) => ({ t: e.t, text: e.text, trans: '', transT: e.t }));

  const meta = { title: '', artist: '', credits: [] };
  const lines = [];
  for (const p of pairs) {
    if (!p.text) continue;
    if (!lines.length && p.t < 2) {
      const tm = !meta.title && p.text.match(/^(.+?)\s+-\s+(.+)$/);
      if (tm) {
        meta.title = tm[1];
        meta.artist = tm[2];
        continue;
      }
      if (CREDIT.test(p.text)) {
        meta.credits.push(p.text);
        continue;
      }
    }
    const prev = lines[lines.length - 1];
    if (prev && Math.abs(prev.start - p.t) < 0.02) {
      // Same timestamp: one sung phrase split over several LRC lines.
      prev.text += ' ' + p.text;
      if (p.trans) prev.trans = prev.trans ? prev.trans + ' ' + p.trans : p.trans;
      prev.transT = p.transT;
      continue;
    }
    lines.push({ start: p.t, text: p.text, trans: p.trans, transT: p.transT });
  }

  lines.forEach((l, i) => {
    const next = lines[i + 1];
    const end = next ? next.start : l.transT > l.start ? l.transT : l.start + 4;
    l.end = Math.min(end, l.start + maxHold);
    l.index = i;
    delete l.transT;
  });
  return { meta, lines };
}
