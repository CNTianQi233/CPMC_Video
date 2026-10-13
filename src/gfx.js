// Small, stateless drawing helpers shared by the scenes.

export const W = 1920;
export const H = 1080;

export const FONT_JP = '"MV JP", "Zen Maru Gothic", "Hiragino Maru Gothic ProN", "Noto Sans JP", sans-serif';
export const FONT_CN = '"MV CN", "ZCOOL KuaiLe", "Noto Sans SC", "Microsoft YaHei", sans-serif';
export const FONT_DISPLAY = '"MV Display", "Dela Gothic One", "MV JP", sans-serif';

export const PAL = {
  navy: '#0c1f4f',
  deep: '#14306e',
  blue: '#1f5fd1',
  ice: '#7fdcff',
  frost: '#e9f9ff',
  pink: '#ff5fa2',
  yellow: '#ffe14d',
  orange: '#ff9f1a',
  violet: '#7a5cff',
  red: '#ff3b4f',
  chalk: '#f4f7f2',
  board: '#21503f',
};

export const clamp = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, k) => a + (b - a) * k;
export const inv = (a, b, v) => clamp((v - a) / (b - a));
export const smooth = (k) => k * k * (3 - 2 * k);
export const easeOut = (k) => 1 - Math.pow(1 - k, 3);
export const easeIn = (k) => k * k * k;
export const easeInOut = (k) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);
export const easeBack = (k) => {
  const c = 1.70158;
  return 1 + (c + 1) * Math.pow(k - 1, 3) + c * Math.pow(k - 1, 2);
};
export const easeElastic = (k) =>
  k <= 0 ? 0 : k >= 1 ? 1 : Math.pow(2, -10 * k) * Math.sin((k * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1;
export const fract = (v) => v - Math.floor(v);
export const TAU = Math.PI * 2;

/** Deterministic hash -> [0, 1). Same inputs always give the same value. */
export function rand(i, salt = 0) {
  let h = Math.imul((i | 0) ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul((salt + 1) | 0, 0xc2b2ae35);
  h ^= h >>> 16;
  h = Math.imul(h, 0x7feb352d);
  h ^= h >>> 15;
  h = Math.imul(h, 0x846ca68b);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

export function makeCanvas(w, h) {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h);
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

export function star(ctx, x, y, r1, r2, n = 5, rot = -Math.PI / 2) {
  ctx.beginPath();
  for (let i = 0; i < n * 2; i++) {
    const r = i % 2 ? r2 : r1;
    const a = rot + (i * Math.PI) / n;
    ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
  }
  ctx.closePath();
}

export function sparkle(ctx, x, y, r, color = '#fff', alpha = 1) {
  if (r <= 0 || alpha <= 0) return;
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x, y - r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.quadraticCurveTo(x, y, x, y + r);
  ctx.quadraticCurveTo(x, y, x - r, y);
  ctx.quadraticCurveTo(x, y, x, y - r);
  ctx.fill();
  ctx.restore();
}

/** Text with layered outlines in the usual anime-MV style. */
export function outlined(ctx, text, x, y, o = {}) {
  const size = o.size || 64;
  ctx.font = `${o.weight || 900} ${size}px ${o.family || FONT_JP}`;
  ctx.textAlign = o.align || 'center';
  ctx.textBaseline = o.baseline || 'middle';
  ctx.lineJoin = 'round';
  if (o.shadow) {
    ctx.fillStyle = o.shadow;
    ctx.strokeStyle = o.shadow;
    ctx.lineWidth = size * 0.22;
    const d = size * 0.07;
    ctx.strokeText(text, x + d, y + d);
  }
  if (o.outer !== null) {
    ctx.strokeStyle = o.outer || PAL.frost;
    ctx.lineWidth = size * 0.3;
    ctx.strokeText(text, x, y);
  }
  ctx.strokeStyle = o.stroke || PAL.navy;
  ctx.lineWidth = size * 0.16;
  ctx.strokeText(text, x, y);
  ctx.fillStyle = o.fill || '#fff';
  ctx.fillText(text, x, y);
}

/** The circled nine emblem. */
export function nine(ctx, x, y, r, o = {}) {
  ctx.save();
  ctx.translate(x, y);
  if (o.rot) ctx.rotate(o.rot);
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, TAU);
  ctx.fillStyle = o.bg || PAL.frost;
  ctx.fill();
  ctx.lineWidth = r * 0.16;
  ctx.strokeStyle = o.ring || PAL.blue;
  ctx.stroke();
  ctx.font = `${r * 1.25}px ${FONT_DISPLAY}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = o.color || PAL.blue;
  ctx.fillText('9', 0, r * 0.06);
  ctx.restore();
}

/** Six-armed snowflake sprite, rendered once and reused. */
export function makeSnowflake(size, color = '#ffffff') {
  const c = makeCanvas(size, size);
  const g = c.getContext('2d');
  g.translate(size / 2, size / 2);
  g.strokeStyle = color;
  g.lineCap = 'round';
  g.lineWidth = size * 0.06;
  const r = size * 0.44;
  for (let i = 0; i < 6; i++) {
    g.save();
    g.rotate((i * Math.PI) / 3);
    g.beginPath();
    g.moveTo(0, 0);
    g.lineTo(0, -r);
    for (const k of [0.45, 0.72]) {
      g.moveTo(0, -r * k);
      g.lineTo(r * 0.22, -r * (k + 0.17));
      g.moveTo(0, -r * k);
      g.lineTo(-r * 0.22, -r * (k + 0.17));
    }
    g.stroke();
    g.restore();
  }
  return c;
}

/** Soft round glow sprite (white core, transparent edge). */
export function makeGlow(size, color = '255,255,255') {
  const c = makeCanvas(size, size);
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gr.addColorStop(0, `rgba(${color},1)`);
  gr.addColorStop(0.35, `rgba(${color},0.45)`);
  gr.addColorStop(1, `rgba(${color},0)`);
  g.fillStyle = gr;
  g.fillRect(0, 0, size, size);
  return c;
}

export function drawSprite(ctx, img, x, y, size, rot = 0, alpha = 1) {
  if (alpha <= 0 || size <= 0) return;
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.translate(x, y);
  if (rot) ctx.rotate(rot);
  ctx.drawImage(img, -size / 2, -size / 2, size, size);
  ctx.restore();
}

export function vGradient(ctx, stops, y0 = 0, y1 = H) {
  const g = ctx.createLinearGradient(0, y0, 0, y1);
  stops.forEach((c, i) => g.addColorStop(i / (stops.length - 1), c));
  return g;
}

export function fillBg(ctx, stops) {
  ctx.fillStyle = vGradient(ctx, stops);
  ctx.fillRect(0, 0, W, H);
}

export function radialBg(ctx, cx, cy, r, inner, outer) {
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
  g.addColorStop(0, inner);
  g.addColorStop(1, outer);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
}

/** Rotating sunburst wedges. */
export function rays(ctx, cx, cy, n, rot, color, alpha = 1, len = 2400) {
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.fillStyle = color;
  ctx.beginPath();
  for (let i = 0; i < n; i++) {
    const a0 = rot + (i * TAU) / n;
    const a1 = a0 + Math.PI / n;
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(a0) * len, cy + Math.sin(a0) * len);
    ctx.lineTo(cx + Math.cos(a1) * len, cy + Math.sin(a1) * len);
    ctx.closePath();
  }
  ctx.fill();
  ctx.restore();
}

/** Flat-topped hexagon lattice, the "ice" texture. */
export function hexGrid(ctx, size, offX, offY, color, lw = 2) {
  const w = size * 1.5;
  const h = size * Math.sqrt(3);
  ctx.beginPath();
  const ox = ((offX % w) + w) % w;
  const oy = ((offY % h) + h) % h;
  for (let col = -2; col * w < W + w * 2; col++) {
    for (let row = -2; row * h < H + h * 2; row++) {
      const cx = col * w + ox - w;
      const cy = row * h + oy - h + (col & 1 ? h / 2 : 0);
      for (let k = 0; k < 3; k++) {
        const a0 = (k * Math.PI) / 3;
        const a1 = ((k + 1) * Math.PI) / 3;
        ctx.moveTo(cx + Math.cos(a0) * size, cy + Math.sin(a0) * size);
        ctx.lineTo(cx + Math.cos(a1) * size, cy + Math.sin(a1) * size);
      }
    }
  }
  ctx.strokeStyle = color;
  ctx.lineWidth = lw;
  ctx.stroke();
}

/** Red "hanko" style stamp with a single short label. */
export function stamp(ctx, x, y, r, label, k, o = {}) {
  if (k <= 0) return;
  const s = k < 1 ? lerp(2.4, 1, easeOut(k)) : 1;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(o.rot ?? -0.18);
  ctx.scale(s, s);
  ctx.globalAlpha *= clamp(k * 3);
  const col = o.color || PAL.red;
  ctx.lineWidth = r * 0.1;
  ctx.strokeStyle = col;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, TAU);
  ctx.stroke();
  ctx.lineWidth = r * 0.04;
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.84, 0, TAU);
  ctx.stroke();
  ctx.fillStyle = col;
  ctx.font = `${o.size || r * 0.62}px ${o.family || FONT_DISPLAY}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, 0, r * 0.04);
  ctx.restore();
}

/** Expanding puff of cloud circles: the "it never existed" gag. */
export function poof(ctx, x, y, k, scale = 1) {
  if (k <= 0 || k >= 1) return;
  ctx.save();
  ctx.globalAlpha *= 1 - smooth(inv(0.55, 1, k));
  ctx.fillStyle = '#ffffff';
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * TAU + rand(i, 7) * 0.4;
    const d = easeOut(k) * (140 + rand(i, 8) * 160) * scale;
    const r = (60 + rand(i, 9) * 70) * scale * (1 - k * 0.4);
    ctx.beginPath();
    ctx.arc(x + Math.cos(a) * d, y + Math.sin(a) * d * 0.7, r, 0, TAU);
    ctx.fill();
  }
  ctx.beginPath();
  ctx.arc(x, y, 150 * scale * (1 - k * 0.5), 0, TAU);
  ctx.fill();
  ctx.restore();
}
