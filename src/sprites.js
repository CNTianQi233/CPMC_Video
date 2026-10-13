// Character sprites with expression / pose variants ("差分").
//
// Characters are described in assets/characters/characters.json. Each one is
// built from grid sheets (one image holding many variants) and/or single
// files. Solid backgrounds are keyed out, every cell is trimmed to its
// content, and poses are drawn anchored at the bottom centre (the feet).

import { makeCanvas } from './gfx.js';

/** Every state the MV asks for, in the default 4×4 sheet order. */
export const STATES = [
  'normal', 'happy', 'smug', 'angry',
  'shock', 'dizzy', 'sleepy', 'think',
  'point', 'wave', 'cast', 'jump',
  'shiver', 'victory', 'nervous', 'bow',
];

/** When a sheet lacks a state, the closest available one is used instead. */
const FALLBACK = {
  happy: ['smug', 'victory', 'wave'],
  smug: ['happy', 'victory'],
  angry: ['smug', 'shock'],
  shock: ['nervous', 'dizzy'],
  dizzy: ['shock', 'nervous'],
  sleepy: ['happy', 'bow'],
  think: ['nervous', 'normal'],
  point: ['cast', 'smug', 'happy'],
  wave: ['happy', 'victory'],
  cast: ['point', 'smug', 'happy'],
  jump: ['victory', 'happy', 'wave'],
  shiver: ['nervous', 'shock'],
  victory: ['happy', 'jump', 'wave'],
  nervous: ['shock', 'think'],
  bow: ['happy', 'sleepy'],
};

function loadImage(url) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img.naturalWidth ? img : null);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

function toCanvas(img) {
  const c = makeCanvas(img.naturalWidth, img.naturalHeight);
  c.getContext('2d', { willReadFrequently: true }).drawImage(img, 0, 0);
  return c;
}

function parseColor(s) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(s).trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Background colour from the image corners, or null if already transparent. */
function detectKey(data, w, h) {
  const n = 6;
  const corners = [
    [0, 0],
    [w - n, 0],
    [0, h - n],
    [w - n, h - n],
  ].map(([x0, y0]) => {
    let r = 0;
    let g = 0;
    let b = 0;
    let a = 0;
    for (let y = y0; y < y0 + n; y++) {
      for (let x = x0; x < x0 + n; x++) {
        const i = (y * w + x) * 4;
        r += data[i];
        g += data[i + 1];
        b += data[i + 2];
        a += data[i + 3];
      }
    }
    const k = n * n;
    return [r / k, g / k, b / k, a / k];
  });
  if (corners.some((c) => c[3] < 200)) return null;
  const avg = [0, 1, 2].map((c) => corners.reduce((s, k) => s + k[c], 0) / 4);
  const spread = Math.max(...corners.map((k) => Math.hypot(k[0] - avg[0], k[1] - avg[1], k[2] - avg[2])));
  return spread < 40 ? avg : null;
}

/** Removes the key colour; edge pixels are un-blended so no fringe remains. */
function chromaKey(data, key, tol, soft) {
  for (let i = 0; i < data.length; i += 4) {
    const dist = Math.hypot(data[i] - key[0], data[i + 1] - key[1], data[i + 2] - key[2]);
    if (dist <= tol) {
      data[i + 3] = 0;
    } else if (dist < tol + soft) {
      const a = (dist - tol) / soft;
      for (let c = 0; c < 3; c++) {
        const v = (data[i + c] - key[c] * (1 - a)) / a;
        data[i + c] = v < 0 ? 0 : v > 255 ? 255 : v;
      }
      data[i + 3] = Math.round(data[i + 3] * a);
    }
  }
}

function prepare(img, keyOpt, tol, soft) {
  const c = toCanvas(img);
  if (keyOpt === null || keyOpt === false || keyOpt === 'none') return c;
  const g = c.getContext('2d', { willReadFrequently: true });
  const id = g.getImageData(0, 0, c.width, c.height);
  const key = keyOpt && keyOpt !== 'auto' ? parseColor(keyOpt) : detectKey(id.data, c.width, c.height);
  if (!key) return c;
  chromaKey(id.data, key, tol, soft);
  g.putImageData(id, 0, 0);
  return c;
}

/**
 * Crops a cell to the character. Pixels are grouped into connected blobs;
 * small blobs that touch the cell edge (a neighbour poking in) or float far
 * from the character (specks) are erased, the rest is kept and trimmed.
 */
function trim(src, x0, y0, w, h) {
  const id = src.getContext('2d', { willReadFrequently: true }).getImageData(x0, y0, w, h);
  const data = id.data;
  const n = w * h;
  const label = new Int32Array(n).fill(-1);
  const stack = new Int32Array(n);
  const blobs = [];
  for (let start = 0; start < n; start++) {
    if (label[start] !== -1 || data[start * 4 + 3] <= 24) continue;
    const b = { count: 0, minX: w, minY: h, maxX: 0, maxY: 0, edge: false };
    const k = blobs.length;
    let sp = 0;
    stack[sp++] = start;
    label[start] = k;
    while (sp) {
      const i = stack[--sp];
      const x = i % w;
      const y = (i - x) / w;
      b.count++;
      if (x < b.minX) b.minX = x;
      if (x > b.maxX) b.maxX = x;
      if (y < b.minY) b.minY = y;
      if (y > b.maxY) b.maxY = y;
      if (x === 0 || y === 0 || x === w - 1 || y === h - 1) b.edge = true;
      if (x > 0 && label[i - 1] === -1 && data[(i - 1) * 4 + 3] > 24) (label[i - 1] = k), (stack[sp++] = i - 1);
      if (x < w - 1 && label[i + 1] === -1 && data[(i + 1) * 4 + 3] > 24) (label[i + 1] = k), (stack[sp++] = i + 1);
      if (y > 0 && label[i - w] === -1 && data[(i - w) * 4 + 3] > 24) (label[i - w] = k), (stack[sp++] = i - w);
      if (y < h - 1 && label[i + w] === -1 && data[(i + w) * 4 + 3] > 24) (label[i + w] = k), (stack[sp++] = i + w);
    }
    blobs.push(b);
  }
  if (!blobs.length) return null;
  const main = blobs.reduce((a, b) => (b.count > a.count ? b : a));
  // Expression marks (?, !, sweat drops, swirl lines) float free of the body
  // and must stay; only edge intrusions and tiny far-away specks go.
  const near = Math.min(w, h) * 0.12;
  const speck = Math.max(40, Math.round(w * h * 0.0002));
  const keep = blobs.map((b) => {
    if (b === main) return true;
    const big = b.count >= main.count * 0.05;
    if (big) return true;
    if (b.edge) return false;
    if (b.count >= speck) return true;
    const dx = Math.max(0, main.minX - b.maxX, b.minX - main.maxX);
    const dy = Math.max(0, main.minY - b.maxY, b.minY - main.maxY);
    return Math.hypot(dx, dy) <= near;
  });
  let left = w;
  let top = h;
  let right = 0;
  let bottom = 0;
  blobs.forEach((b, k) => {
    if (!keep[k]) return;
    left = Math.min(left, b.minX);
    top = Math.min(top, b.minY);
    right = Math.max(right, b.maxX);
    bottom = Math.max(bottom, b.maxY);
  });
  for (let i = 0; i < n; i++) {
    const k = label[i];
    if (k !== -1 && !keep[k]) data[i * 4 + 3] = 0;
  }
  const bw = right - left + 1;
  const bh = bottom - top + 1;
  const cell = makeCanvas(w, h);
  cell.getContext('2d').putImageData(id, 0, 0);
  const out = makeCanvas(bw, bh);
  out.getContext('2d').drawImage(cell, left, top, bw, bh, 0, 0, bw, bh);
  return { img: out, w: bw, h: bh };
}

async function buildCharacter(id, def, dir) {
  const poses = new Map();
  const tol = def.keyTolerance ?? 80;
  const soft = def.keySoftness ?? 60;
  for (const sh of def.sheets || []) {
    const img = await loadImage(dir + sh.file);
    if (!img) {
      console.warn(`[sprites] ${id}: cannot load ${sh.file}`);
      continue;
    }
    const cv = prepare(img, sh.key ?? def.key ?? 'auto', tol, soft);
    const [cols, rows] = sh.grid || [4, 4];
    const cw = cv.width / cols;
    const ch = cv.height / rows;
    const inset = Math.round(Math.min(cw, ch) * (sh.inset ?? 0.01));
    (sh.cells || STATES).forEach((name, i) => {
      const cx = i % cols;
      const cy = Math.floor(i / cols);
      if (!name || cy >= rows) return;
      const p = trim(cv, Math.round(cx * cw) + inset, Math.round(cy * ch) + inset, Math.floor(cw) - 2 * inset, Math.floor(ch) - 2 * inset);
      if (p) poses.set(name, p);
    });
  }
  for (const [name, file] of Object.entries(def.files || {})) {
    const img = await loadImage(dir + file);
    if (!img) {
      console.warn(`[sprites] ${id}: cannot load ${file}`);
      continue;
    }
    const cv = prepare(img, def.key ?? 'auto', tol, soft);
    const p = trim(cv, 0, 0, cv.width, cv.height);
    if (p) poses.set(name, p);
  }
  if (!poses.size) return null;
  const ref = poses.get('normal') || poses.values().next().value;
  return {
    id,
    name: def.name || id,
    poses,
    refH: ref.h,
    scale: def.scale ?? 1,
    flip: !!def.flip,
    /** @returns {{pose, exact: boolean}} */
    pick(state) {
      if (poses.has(state)) return { pose: poses.get(state), exact: true };
      for (const f of FALLBACK[state] || []) if (poses.has(f)) return { pose: poses.get(f), exact: false };
      return { pose: ref, exact: false };
    },
  };
}

/**
 * Loads assets/characters/characters.json (or the older single
 * assets/character.png). Roles without a character keep the built-in art.
 */
export async function loadCast(base) {
  if (typeof Image === 'undefined') return { chars: {}, cast: {} };
  const dir = base + 'characters/';
  const manifest = await fetch(dir + 'characters.json')
    .then((r) => (r.ok ? r.json() : null))
    .catch(() => null);
  if (manifest) {
    const chars = {};
    for (const [id, def] of Object.entries(manifest.characters || {})) {
      const c = await buildCharacter(id, def, dir);
      if (c) chars[id] = c;
    }
    const cast = {};
    if (!manifest.cast) {
      const first = Object.values(chars)[0];
      if (first) cast.main = first;
    }
    for (const [role, v] of Object.entries(manifest.cast || {})) {
      if (Array.isArray(v)) cast[role] = v.map((id) => chars[id] || null);
      else if (v && chars[v]) cast[role] = chars[v];
    }
    return { chars, cast };
  }
  const legacy = await buildCharacter('main', { files: { normal: 'character.png' } }, base);
  return legacy ? { chars: { main: legacy }, cast: { main: legacy } } : { chars: {}, cast: {} };
}

/** Height a pose is drawn at for actor size `s` (matches drawCharacter). */
export function poseHeight(ch, state, s) {
  const { pose } = ch.pick(state);
  return (pose.h * s * 1.35 * ch.scale) / ch.refH;
}

/**
 * Draws a pose with its feet at (x, y + 0.52·s), the same footprint as the
 * built-in mascot of size s. Returns the drawn box and whether the exact
 * state existed.
 */
export function drawCharacter(ctx, ch, state, x, y, s, o = {}) {
  const { pose, exact } = ch.pick(state);
  const k = (s * 1.35 * ch.scale) / ch.refH;
  const w = pose.w * k;
  const h = pose.h * k;
  const sq = Math.max(0, Math.min(1, o.squash || 0));
  const flip = (o.flip ? -1 : 1) * (ch.flip ? -1 : 1);
  ctx.save();
  ctx.translate(x, y + s * 0.52);
  if (o.tilt) ctx.rotate(o.tilt);
  ctx.scale(flip * (1 + sq * 0.05), 1 - sq * 0.05);
  ctx.drawImage(pose.img, -w / 2, -h, w, h);
  ctx.restore();
  return { exact, top: y + s * 0.52 - h, w, h };
}
