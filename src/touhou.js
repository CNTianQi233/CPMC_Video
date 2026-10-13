// Touhou-flavoured set pieces: danmaku (bullet curtains), spell card
// declarations, the STG side panel, magic circles, yin-yang orbs and
// frozen frogs. Everything is a pure function of time.

import {
  W, H, PAL, FONT_JP, FONT_DISPLAY, TAU,
  clamp, lerp, easeOut, easeBack, makeCanvas, star, outlined, nine,
} from './gfx.js';

export const BULLET_COLORS = {
  red: '#ff3b4f',
  blue: '#2f6ee0',
  cyan: '#18c3ee',
  purple: '#9a5cff',
  yellow: '#ffb81a',
  green: '#22c45a',
  pink: '#ff4f9a',
  white: '#8aa6d6',
};

function sprite(size, draw) {
  const c = makeCanvas(size, size);
  const g = c.getContext('2d');
  g.translate(size / 2, size / 2);
  draw(g, size / 2);
  return c;
}

function makeBulletSprites() {
  const out = {};
  for (const [name, col] of Object.entries(BULLET_COLORS)) {
    out[name] = {
      orb: sprite(64, (g, r) => {
        const gr = g.createRadialGradient(0, 0, 0, 0, 0, r);
        gr.addColorStop(0, '#ffffff');
        gr.addColorStop(0.42, '#ffffff');
        gr.addColorStop(0.55, col);
        gr.addColorStop(0.78, col + '99');
        gr.addColorStop(1, col + '00');
        g.fillStyle = gr;
        g.beginPath();
        g.arc(0, 0, r, 0, TAU);
        g.fill();
      }),
      rice: sprite(64, (g, r) => {
        g.fillStyle = col + '66';
        g.beginPath();
        g.ellipse(0, 0, r, r * 0.55, 0, 0, TAU);
        g.fill();
        g.fillStyle = col;
        g.beginPath();
        g.ellipse(0, 0, r * 0.88, r * 0.42, 0, 0, TAU);
        g.fill();
        g.fillStyle = '#ffffff';
        g.beginPath();
        g.ellipse(r * 0.05, 0, r * 0.58, r * 0.2, 0, 0, TAU);
        g.fill();
      }),
      star: sprite(64, (g, r) => {
        g.fillStyle = col;
        g.strokeStyle = '#ffffff';
        g.lineWidth = r * 0.12;
        g.lineJoin = 'round';
        star(g, 0, 0, r * 0.92, r * 0.42, 5);
        g.fill();
        g.stroke();
        g.fillStyle = '#ffffff';
        star(g, 0, 0, r * 0.38, r * 0.17, 5);
        g.fill();
      }),
      amulet: sprite(64, (g, r) => {
        g.fillStyle = '#ffffff';
        g.strokeStyle = col;
        g.lineWidth = r * 0.14;
        g.beginPath();
        g.roundRect(-r * 0.85, -r * 0.42, r * 1.7, r * 0.84, r * 0.08);
        g.fill();
        g.stroke();
        g.fillStyle = col;
        g.fillRect(-r * 0.5, -r * 0.06, r * 1.0, r * 0.12);
        g.beginPath();
        g.arc(r * 0.45, 0, r * 0.16, 0, TAU);
        g.fill();
      }),
    };
  }
  return out;
}

/**
 * A volley is one burst of bullets: a ring (spread omitted) or a fan.
 * Bullets fly straight (optionally accelerating) or curve with `spin`.
 */
export function volley(t, x, y, n, o = {}) {
  const v = o.v ?? 300;
  const acc = o.acc ?? 0;
  const dist = 2900;
  const maxAge = acc > 0 ? (-v + Math.sqrt(v * v + 2 * acc * dist)) / acc : v > 0 ? dist / v : 10;
  return {
    t, x, y, n,
    a0: o.a0 ?? 0,
    spread: o.spread ?? null,
    v, acc,
    spin: o.spin ?? 0,
    type: o.type || 'orb',
    color: o.color || 'blue',
    size: o.size ?? 16,
    maxAge: o.spin ? Math.min(o.life ?? 8, maxAge) : maxAge,
  };
}

export function createDanmaku() {
  const sprites = makeBulletSprites();

  return {
    /** list must be sorted by time */
    draw(ctx, list, t, clip = null) {
      const minX = clip ? clip.x - 30 : -40;
      const minY = clip ? clip.y - 30 : -40;
      const maxX = clip ? clip.x + clip.w + 30 : W + 40;
      const maxY = clip ? clip.y + clip.h + 30 : H + 40;
      ctx.save();
      if (clip) {
        ctx.beginPath();
        ctx.rect(clip.x, clip.y, clip.w, clip.h);
        ctx.clip();
      }
      const base = ctx.getTransform();
      const alpha0 = ctx.globalAlpha;
      for (const vo of list) {
        if (vo.t > t) break;
        const age = t - vo.t;
        if (age > vo.maxAge) continue;
        const spr = sprites[vo.color][vo.type];
        const spawn = age < 0.14 ? 1 - age / 0.14 : 0;
        const sz = vo.size * 2 * (1 + spawn * 0.9);
        ctx.globalAlpha = alpha0 * (1 - spawn * 0.6);
        const d = vo.v * age + 0.5 * vo.acc * age * age;
        for (let k = 0; k < vo.n; k++) {
          let a = vo.a0;
          if (vo.spread === null) a += (k * TAU) / vo.n;
          else if (vo.n > 1) a += (k / (vo.n - 1) - 0.5) * vo.spread;
          let x;
          let y;
          let dir = a;
          if (vo.spin) {
            dir = a + vo.spin * age;
            const rr = vo.v / vo.spin;
            x = vo.x + rr * (Math.sin(dir) - Math.sin(a));
            y = vo.y - rr * (Math.cos(dir) - Math.cos(a));
          } else {
            x = vo.x + Math.cos(a) * d;
            y = vo.y + Math.sin(a) * d;
          }
          if (x < minX || x > maxX || y < minY || y > maxY) continue;
          ctx.setTransform(base);
          ctx.translate(x, y);
          if (vo.type === 'rice' || vo.type === 'amulet') ctx.rotate(dir);
          else if (vo.type === 'star') ctx.rotate(age * 5 + k);
          ctx.drawImage(spr, -sz / 2, -sz / 2, sz, sz);
        }
      }
      ctx.setTransform(base);
      ctx.restore();
    },
  };
}

// ------------------------------------------------------------------ props

export function yinyang(ctx, x, y, r, rot = 0) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#e2343f';
  ctx.beginPath();
  ctx.arc(0, 0, r, -Math.PI / 2, Math.PI / 2);
  ctx.arc(0, r / 2, r / 2, Math.PI / 2, (3 * Math.PI) / 2);
  ctx.arc(0, -r / 2, r / 2, Math.PI / 2, -Math.PI / 2, true);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(0, r / 2, r * 0.16, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#e2343f';
  ctx.beginPath();
  ctx.arc(0, -r / 2, r * 0.16, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = PAL.navy;
  ctx.lineWidth = Math.max(2, r * 0.08);
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, TAU);
  ctx.stroke();
  ctx.restore();
}

/** Spell-card style magic circle: rings, a hexagram and rotating rune marks. */
export function magicCircle(ctx, x, y, r, rot, color = '#7fdcff', alpha = 0.8) {
  ctx.save();
  ctx.translate(x, y);
  ctx.globalAlpha *= alpha;
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(2, r * 0.012);
  ctx.rotate(rot);
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, TAU);
  ctx.moveTo(r * 0.86, 0);
  ctx.arc(0, 0, r * 0.86, 0, TAU);
  ctx.moveTo(r * 0.42, 0);
  ctx.arc(0, 0, r * 0.42, 0, TAU);
  for (let k = 0; k < 2; k++) {
    for (let i = 0; i <= 3; i++) {
      const a = (i / 3) * TAU + (k * Math.PI) / 3 - Math.PI / 2;
      const px = Math.cos(a) * r * 0.86;
      const py = Math.sin(a) * r * 0.86;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
  }
  ctx.stroke();
  // rune ring, counter-rotating
  ctx.rotate(-rot * 2.2);
  ctx.lineWidth = Math.max(2, r * 0.016);
  ctx.beginPath();
  for (let i = 0; i < 36; i++) {
    const a = (i / 36) * TAU;
    const c = Math.cos(a);
    const s = Math.sin(a);
    const r0 = r * 0.89;
    const r1 = r * 0.97;
    switch (i % 4) {
      case 0:
        ctx.moveTo(c * r0, s * r0);
        ctx.lineTo(c * r1, s * r1);
        break;
      case 1:
        ctx.moveTo(c * r0 - s * r * 0.02, s * r0 + c * r * 0.02);
        ctx.lineTo(c * r1 + s * r * 0.02, s * r1 - c * r * 0.02);
        break;
      case 2:
        ctx.moveTo(c * (r0 + r1) / 2 + r * 0.012, s * (r0 + r1) / 2);
        ctx.arc(c * (r0 + r1) / 2, s * (r0 + r1) / 2, r * 0.012, 0, TAU);
        break;
      default:
        ctx.moveTo(c * r0, s * r0);
        ctx.lineTo(c * r1 - s * r * 0.025, s * r1 + c * r * 0.025);
        ctx.lineTo(c * r1 + s * r * 0.025, s * r1 - c * r * 0.025);
        ctx.closePath();
    }
  }
  ctx.stroke();
  ctx.restore();
}

/** A frog frozen solid in a block of ice. */
export function frozenFrog(ctx, x, y, s, t, i = 0) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(Math.sin(t * 1.5 + i) * 0.04 - 0.05 + i * 0.03);
  // frog
  ctx.lineJoin = 'round';
  ctx.strokeStyle = '#1d5a2a';
  ctx.lineWidth = s * 0.03;
  ctx.fillStyle = '#5ccf6a';
  ctx.beginPath();
  ctx.ellipse(0, s * 0.08, s * 0.32, s * 0.24, 0, 0, TAU);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#c9f2b8';
  ctx.beginPath();
  ctx.ellipse(0, s * 0.16, s * 0.18, s * 0.12, 0, 0, TAU);
  ctx.fill();
  for (const sx of [-1, 1]) {
    ctx.fillStyle = '#5ccf6a';
    ctx.beginPath();
    ctx.arc(sx * s * 0.16, -s * 0.12, s * 0.11, 0, TAU);
    ctx.fill();
    ctx.stroke();
    // frozen "x x" eyes
    ctx.strokeStyle = '#18213d';
    ctx.lineWidth = s * 0.025;
    ctx.beginPath();
    ctx.moveTo(sx * s * 0.16 - s * 0.045, -s * 0.165);
    ctx.lineTo(sx * s * 0.16 + s * 0.045, -s * 0.075);
    ctx.moveTo(sx * s * 0.16 + s * 0.045, -s * 0.165);
    ctx.lineTo(sx * s * 0.16 - s * 0.045, -s * 0.075);
    ctx.stroke();
    ctx.strokeStyle = '#1d5a2a';
    ctx.lineWidth = s * 0.03;
  }
  // ice block
  const g = ctx.createLinearGradient(-s / 2, -s / 2, s / 2, s / 2);
  g.addColorStop(0, 'rgba(235,250,255,0.75)');
  g.addColorStop(0.5, 'rgba(170,225,255,0.45)');
  g.addColorStop(1, 'rgba(120,200,245,0.6)');
  ctx.fillStyle = g;
  ctx.strokeStyle = 'rgba(31,95,209,0.85)';
  ctx.lineWidth = s * 0.03;
  ctx.beginPath();
  ctx.roundRect(-s / 2, -s / 2, s, s, s * 0.12);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.beginPath();
  ctx.moveTo(-s * 0.4, -s * 0.38);
  ctx.lineTo(-s * 0.12, -s * 0.38);
  ctx.lineTo(-s * 0.4, -s * 0.1);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/** The STG player: a pencil firing "+" shots. */
export function pencil(ctx, x, y, s, t) {
  // shots
  ctx.save();
  ctx.font = `${s * 0.5}px ${FONT_DISPLAY}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(127,240,255,0.85)';
  for (let k = 0; k < 14; k++) {
    const ph = (t * 6 + k / 14) % 1;
    const yy = y - s * 0.7 - ph * 900;
    ctx.fillText('+', x + (k % 2 ? -s * 0.18 : s * 0.18), yy);
  }
  ctx.restore();
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = PAL.navy;
  ctx.lineWidth = s * 0.05;
  ctx.lineJoin = 'round';
  ctx.fillStyle = '#ffd34d';
  ctx.beginPath();
  ctx.rect(-s * 0.13, -s * 0.25, s * 0.26, s * 0.6);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#ffb3cf';
  ctx.beginPath();
  ctx.roundRect(-s * 0.13, s * 0.35, s * 0.26, s * 0.16, s * 0.05);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#f2d2a9';
  ctx.beginPath();
  ctx.moveTo(-s * 0.13, -s * 0.25);
  ctx.lineTo(0, -s * 0.55);
  ctx.lineTo(s * 0.13, -s * 0.25);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = PAL.navy;
  ctx.beginPath();
  ctx.moveTo(-s * 0.045, -s * 0.45);
  ctx.lineTo(0, -s * 0.55);
  ctx.lineTo(s * 0.045, -s * 0.45);
  ctx.closePath();
  ctx.fill();
  // hitbox
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = PAL.red;
  ctx.lineWidth = s * 0.04;
  ctx.beginPath();
  ctx.arc(0, 0, s * 0.07, 0, TAU);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

// ------------------------------------------------------------ spell cards

/**
 * Full spell card declaration: a dark band, a magic circle and the
 * character portrait sweeping across. `drawActor(x, y, size)` draws the star.
 */
export function spellCutIn(ctx, t, t0, drawActor, color = '#7fdcff', restX = 1430) {
  const age = t - t0;
  if (age < 0 || age > 2.6) return;
  const kin = easeOut(clamp(age / 0.35));
  const kout = clamp((age - 2.05) / 0.55);
  ctx.save();
  ctx.globalAlpha *= 1 - kout;
  const y0 = 150;
  const h = 330;
  const x0 = lerp(W + 200, -200, kin);
  ctx.fillStyle = 'rgba(8,16,48,0.62)';
  ctx.beginPath();
  ctx.moveTo(x0 + 160, y0);
  ctx.lineTo(W + 200, y0);
  ctx.lineTo(W + 200, y0 + h);
  ctx.lineTo(x0, y0 + h);
  ctx.closePath();
  ctx.fill();
  ctx.save();
  ctx.clip();
  ctx.strokeStyle = 'rgba(255,255,255,0.12)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  for (let i = -10; i < 50; i++) {
    const x = i * 60 - ((age * 400) % 60);
    ctx.moveTo(x, y0);
    ctx.lineTo(x - 120, y0 + h);
  }
  ctx.stroke();
  ctx.restore();
  ctx.fillStyle = color;
  ctx.fillRect(x0 + 160, y0 - 6, W + 200, 6);
  ctx.fillRect(x0, y0 + h, W + 200, 6);
  const px = lerp(W + 400, restX, easeOut(clamp(age / 0.5))) - age * 50;
  magicCircle(ctx, px, y0 + h / 2, 300, age * 1.4, color, 0.7);
  drawActor(px, y0 + h / 2 + 30, 300);
  ctx.restore();
}

/** Spell card name in the top-right corner, sliding in like the games do. */
export function spellBanner(ctx, t, t0, t1, name, o = {}) {
  const age = t - t0;
  if (age < 0 || t > t1) return;
  const kin = easeOut(clamp(age / 0.6));
  const kout = clamp((t - (t1 - 0.3)) / 0.3);
  const right = o.right ?? W - 36;
  const y = lerp(o.fromY ?? 380, o.y ?? 52, easeOut(clamp((age - 0.4) / 0.7)));
  ctx.save();
  ctx.globalAlpha *= kin * (1 - kout);
  ctx.translate((1 - kin) * 300, 0);
  ctx.font = `900 40px ${FONT_JP}`;
  const w = ctx.measureText(name).width;
  const lg = ctx.createLinearGradient(right - w - 80, 0, right, 0);
  lg.addColorStop(0, 'rgba(8,16,48,0)');
  lg.addColorStop(0.3, 'rgba(8,16,48,0.7)');
  lg.addColorStop(1, 'rgba(8,16,48,0.85)');
  ctx.fillStyle = lg;
  ctx.fillRect(right - w - 80, y - 30, w + 100, 60);
  ctx.fillStyle = o.color || '#7fdcff';
  ctx.fillRect(right - w - 40, y + 30, w + 60, 3);
  outlined(ctx, name, right, y, { size: 40, align: 'right', fill: '#ffffff', outer: null, stroke: '#14204a' });
  ctx.font = `400 22px ${FONT_DISPLAY}`;
  ctx.textAlign = 'right';
  ctx.fillStyle = '#cfe9ff';
  ctx.fillText(`Bonus ${o.bonus || '9,999,999'}    History 09/09`, right, y + 52);
  ctx.restore();
}

// --------------------------------------------------------------- STG frame

export const PLAYFIELD = { x: 60, y: 30, w: 1200, h: 1020 };

function panelStars(ctx, x, y, n, filled, color) {
  for (let i = 0; i < n; i++) {
    ctx.fillStyle = i < filled ? color : 'rgba(255,255,255,0.15)';
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    star(ctx, x + i * 46, y, 20, 9, 5);
    ctx.fill();
    if (i < filled) ctx.stroke();
  }
}

/** Frame around the playfield plus the score panel on the right. */
export function stgFrame(ctx, t, t0, beat, o = {}) {
  const pf = PLAYFIELD;
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, W, H);
  ctx.rect(pf.x, pf.y, pf.w, pf.h);
  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, '#14306e');
  g.addColorStop(1, '#0a1640');
  ctx.fillStyle = g;
  ctx.fill('evenodd');
  ctx.clip('evenodd');
  ctx.strokeStyle = 'rgba(127,220,255,0.12)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let i = -30; i < 60; i++) {
    ctx.moveTo(i * 48, 0);
    ctx.lineTo(i * 48 + H, H);
    ctx.moveTo(i * 48, H);
    ctx.lineTo(i * 48 + H, 0);
  }
  ctx.stroke();
  ctx.restore();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 4;
  ctx.strokeRect(pf.x - 2, pf.y - 2, pf.w + 4, pf.h + 4);

  const el = Math.max(0, t - t0);
  const beats = Math.max(0, Math.floor(beat));
  const score = String(Math.floor(el * 271828) * 10 + beats * 90).padStart(10, '0');
  const rows = [
    ['HiScore', '9999999999', '#ffffff'],
    ['Score', score, '#ffffff'],
  ];
  const lx = 1330;
  const rx = 1860;
  ctx.textBaseline = 'middle';
  rows.forEach(([label, value, col], i) => {
    const y = 110 + i * 64;
    ctx.font = `400 34px ${FONT_DISPLAY}`;
    ctx.textAlign = 'left';
    ctx.fillStyle = i ? '#cfe9ff' : '#ffb3d4';
    ctx.fillText(label, lx, y);
    ctx.textAlign = 'right';
    ctx.fillStyle = col;
    ctx.fillText(value, rx, y);
  });
  ctx.font = `400 34px ${FONT_DISPLAY}`;
  ctx.textAlign = 'left';
  ctx.fillStyle = '#ffb3d4';
  ctx.fillText('Player', lx, 280);
  panelStars(ctx, 1560, 280, 6, 3, PAL.pink);
  ctx.fillStyle = '#b8ffcf';
  ctx.fillText('Bomb', lx, 340);
  panelStars(ctx, 1560, 340, 6, 2, '#3fd46a');
  const stats = [
    ['Power', o.power || '4.00', PAL.yellow],
    ['Graze', String(Math.floor(el * 37 + beats * 3)), '#ffffff'],
    ['Point', String(9 + Math.floor(beats / 2)), '#7fdcff'],
  ];
  stats.forEach(([label, value, col], i) => {
    const y = 430 + i * 60;
    ctx.textAlign = 'left';
    ctx.fillStyle = '#cfe9ff';
    ctx.fillText(label, lx, y);
    ctx.textAlign = 'right';
    ctx.fillStyle = col;
    ctx.fillText(value, rx, y);
  });
  // logo
  nine(ctx, 1595, 760, 92, { bg: PAL.frost, ring: PAL.blue, color: PAL.blue, rot: Math.sin(t) * 0.1 });
  outlined(ctx, '東方算数教室', 1595, 905, { size: 66, family: FONT_DISPLAY, weight: 400, fill: '#ffffff', stroke: PAL.blue, outer: null });
  ctx.font = `700 28px ${FONT_JP}`;
  ctx.textAlign = 'center';
  ctx.fillStyle = '#cfe9ff';
  ctx.fillText('〜 Perfect Math Class.', 1595, 965);
}

/** Boss HP bar, spell timer and enemy marker inside the playfield. */
export function stgBossHud(ctx, t, t0, t1, bossX) {
  const pf = PLAYFIELD;
  const k = clamp((t - t0) / (t1 - t0));
  ctx.save();
  ctx.fillStyle = 'rgba(8,16,48,0.6)';
  ctx.fillRect(pf.x + 70, pf.y + 16, pf.w - 190, 12);
  const hp = ctx.createLinearGradient(pf.x + 70, 0, pf.x + pf.w - 120, 0);
  hp.addColorStop(0, '#ff8fb8');
  hp.addColorStop(1, '#ffffff');
  ctx.fillStyle = hp;
  ctx.fillRect(pf.x + 70, pf.y + 16, (pf.w - 190) * (1 - k), 12);
  ctx.font = `400 30px ${FONT_DISPLAY}`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#ffffff';
  ctx.fillText('9', pf.x + 24, pf.y + 24);
  ctx.textAlign = 'right';
  ctx.fillStyle = PAL.yellow;
  ctx.fillText(String(Math.max(0, Math.ceil(t1 - t))).padStart(2, '0'), pf.x + pf.w - 18, pf.y + 24);
  // enemy marker
  ctx.fillStyle = 'rgba(255,79,154,0.85)';
  ctx.fillRect(bossX - 46, pf.y + pf.h - 22, 92, 22);
  ctx.font = `400 16px ${FONT_DISPLAY}`;
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffffff';
  ctx.fillText('ENEMY', bossX, pf.y + pf.h - 11);
  ctx.restore();
}

