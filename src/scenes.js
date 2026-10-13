// Scene timeline for the MV. Every scene is a pure function of time `t`
// (seconds into the song), so the player can seek freely and the offline
// renderer produces exactly the same frames.

import {
  W, H, PAL, FONT_JP, FONT_DISPLAY, TAU,
  clamp, lerp, inv, smooth, easeOut, easeIn, easeInOut, easeBack, easeElastic, fract, rand,
  makeCanvas, star, sparkle, outlined, nine, makeSnowflake, makeGlow, drawSprite,
  vGradient, fillBg, radialBg, rays, hexGrid, stamp, poof,
} from './gfx.js';
import { drawMascot } from './mascot.js';

// [name, start, end, options]. Boundaries follow the LRC timestamps.
const TIMELINE = [
  ['intro', 0, 11],
  ['sparkle', 11, 23],
  ['baka', 23, 45, { variant: 0 }],
  ['bus', 45, 67],
  ['stage', 67, 77, { variant: 0 }],
  ['clock', 77, 100, { variant: 0 }],
  ['baka', 100, 121, { variant: 1 }],
  ['pot', 121, 143],
  ['cosmos', 143, 154],
  ['laugh', 154, 174],
  ['server', 174, 187],
  ['rap', 187, 209],
  ['number', 209, 215],
  ['stage', 215, 225, { variant: 1 }],
  ['clock', 225, 248, { variant: 1 }],
  ['baka', 248, 269, { variant: 2 }],
  ['outro', 269, Infinity],
];

const LYRIC_MODE = { baka: 'big', rap: 'rap' };

const COMMENTS = [
  'wwwww', 'www', '草', '8888888', '天才!?', 'かわいい', '？？？', 'wwwwwwwww',
  '算数とは…', 'ｗ', '9', '天才あらわる', 'ここすき', '9999', '←わかる', 'えぇ…',
];

const commas = (s) => s.replace(/\B(?=(\d{3})+(?!\d))/g, ',');

export function createScenes({ feats, lyrics, meta }) {
  const flake = makeSnowflake(128);
  const glowW = makeGlow(256);
  const glowC = makeGlow(256, '127,220,255');
  const glowP = makeGlow(256, '255,95,162');
  const glowV = makeGlow(256, '122,92,255');
  const glowY = makeGlow(256, '255,225,77');
  const frost = makeFrost();
  const vignette = makeVignette();

  const pulse = (t, k = 6) => {
    const b = feats.beat(t);
    return b < 0 ? 0 : Math.exp(-k * fract(b));
  };
  const beatI = (t) => Math.floor(feats.beat(t));
  const P = feats.period;

  // ---------------------------------------------------------------- shared

  function snow(ctx, tw, o = {}) {
    const n = o.n ?? 70;
    const alpha = o.alpha ?? 0.85;
    const wind = o.wind ?? 0.35;
    ctx.fillStyle = o.color || '#ffffff';
    for (let i = 0; i < n; i++) {
      const r3 = rand(i, 13);
      const size = 3 + r3 * r3 * 24;
      const vy = 40 + r3 * 110;
      const y = ((rand(i, 12) * (H + 80) + tw * vy) % (H + 80)) - 40;
      const span = W + 200;
      const x = ((((rand(i, 11) * span + tw * wind * vy + Math.sin(tw * (0.6 + rand(i, 14)) + i) * 30) % span) + span) % span) - 100;
      if (size > 15) {
        drawSprite(ctx, flake, x, y, size * 2.2, tw * (rand(i, 15) - 0.5) * 2, alpha);
      } else {
        ctx.globalAlpha = alpha * (0.5 + r3);
        ctx.beginPath();
        ctx.arc(x, y, size * 0.5, 0, TAU);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
    }
  }

  function twinkles(ctx, t, n, salt, o = {}) {
    const cols = o.colors || ['#ffffff', PAL.yellow, PAL.ice];
    for (let i = 0; i < n; i++) {
      const x = rand(i, salt) * W;
      const y = rand(i, salt + 1) * (o.maxY || H);
      const tw = 0.5 + 0.5 * Math.sin(t * (2 + rand(i, salt + 2) * 3) + i);
      const r = (o.size || 10) * (0.4 + rand(i, salt + 3)) * (0.5 + tw * 0.7 + pulse(t + rand(i, salt + 4) * 0.2) * 0.3);
      sparkle(ctx, x, y, r, cols[i % cols.length], 0.4 + tw * 0.6);
    }
  }

  function chalk(ctx, text, x, y, size, o = {}) {
    ctx.font = `${o.weight || 700} ${size}px ${o.family || FONT_JP}`;
    ctx.textAlign = o.align || 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = o.color || 'rgba(244,247,242,0.92)';
    ctx.fillText(text, x, y);
    ctx.save();
    ctx.globalAlpha *= 0.3;
    ctx.fillText(text, x + 2, y - 1.5);
    ctx.restore();
  }

  function reveal(ctx, k, x0, x1, fn) {
    if (k <= 0) return;
    ctx.save();
    ctx.beginPath();
    ctx.rect(x0, -1e4, (x1 - x0) * clamp(k), 2e4);
    ctx.clip();
    fn();
    ctx.restore();
  }

  function chalkCircle(ctx, x, y, r, k, color = 'rgba(255,120,150,0.95)', lw = 6) {
    if (k <= 0) return;
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = lw;
    ctx.lineCap = 'round';
    ctx.beginPath();
    const a0 = -2.2;
    const steps = 40;
    for (let i = 0; i <= steps * clamp(k); i++) {
      const a = a0 + (i / steps) * TAU * 1.08;
      const rr = r * (1 + 0.06 * Math.sin(a * 3));
      ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr * 0.86);
    }
    ctx.stroke();
    ctx.restore();
  }

  function board(ctx, x, y, w, h) {
    ctx.fillStyle = '#8f5f33';
    ctx.strokeStyle = '#4f3018';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.roundRect(x - 26, y - 26, w + 52, h + 52, 22);
    ctx.fill();
    ctx.stroke();
    const g = ctx.createLinearGradient(x, y, x + w, y + h);
    g.addColorStop(0, '#2d6a56');
    g.addColorStop(1, '#1a4436');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 8);
    ctx.fill();
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();
    ctx.fillStyle = 'rgba(255,255,255,0.035)';
    for (let i = 0; i < 9; i++) {
      ctx.beginPath();
      ctx.ellipse(x + rand(i, 31) * w, y + rand(i, 32) * h, 120 + rand(i, 33) * 200, 30 + rand(i, 34) * 50, rand(i, 35) - 0.5, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
    ctx.fillStyle = '#6e4523';
    ctx.fillRect(x + 60, y + h + 26, w - 120, 16);
    ctx.fillStyle = '#f4f7f2';
    ctx.fillRect(x + 200, y + h + 16, 52, 12);
    ctx.fillStyle = '#ff9cc4';
    ctx.fillRect(x + 290, y + h + 16, 40, 12);
  }

  function classroom(ctx, t) {
    fillBg(ctx, ['#dff5ff', '#b2e1f8', '#8fcbee']);
    hexGrid(ctx, 64, t * 6, t * 3, 'rgba(255,255,255,0.22)', 2);
    ctx.fillStyle = vGradient(ctx, ['#6aa9dc', '#3e74b4'], 790, H);
    ctx.fillRect(0, 790, W, H - 790);
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.fillRect(0, 790, W, 6);
    ctx.strokeStyle = 'rgba(20,48,110,0.22)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    for (let i = -8; i <= 8; i++) {
      ctx.moveTo(960 + i * 60, 796);
      ctx.lineTo(960 + i * 260, H);
    }
    ctx.stroke();
    board(ctx, 250, 80, 1420, 600);
  }

  function fitFont(ctx, text, size, family, weight, maxW) {
    ctx.font = `${weight} ${size}px ${family}`;
    const w = ctx.measureText(text).width;
    return w > maxW ? Math.floor((size * maxW) / w) : size;
  }

  function dust(ctx, t, n = 30) {
    ctx.fillStyle = '#ffffff';
    for (let i = 0; i < n; i++) {
      const x = (rand(i, 41) * W + Math.sin(t * 0.3 + i) * 40 + t * 10) % W;
      const y = (rand(i, 42) * H - t * (8 + rand(i, 43) * 14) + H * 10) % H;
      ctx.globalAlpha = 0.25 + 0.25 * Math.sin(t + i);
      ctx.beginPath();
      ctx.arc(x, y, 2 + rand(i, 44) * 3, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  // ------------------------------------------------------------------ intro

  const EQUATIONS = [
    ['1 + 1 = ', '9'],
    ['3 × 3 = ', '9'],
    ['100 − 1 = ', '9'],
  ];

  function intro(ctx, t) {
    classroom(ctx, t);
    const title = meta.title || 'さんすう教室';
    const ts = fitFont(ctx, title, 100, FONT_JP, 900, 1300);
    const k = easeInOut(inv(0.3, 2.6, t));
    reveal(ctx, k, 300, 1620, () => chalk(ctx, title, 960, 230, ts, { weight: 900 }));
    if (k > 0 && k < 1) {
      ctx.font = `900 ${ts}px ${FONT_JP}`;
      const tw = ctx.measureText(title).width;
      const px = 960 - tw / 2 + tw * k;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(px - 6, 230 + Math.sin(t * 40) * 18 - 10, 14, 34);
      for (let i = 0; i < 8; i++) {
        const a = rand(i + Math.floor(t * 20) * 8, 51) * TAU;
        sparkle(ctx, px + Math.cos(a) * 30, 250 + Math.sin(a) * 20, 6, '#fff', 0.6);
      }
    }
    // underline
    reveal(ctx, inv(2.4, 3.0, t), 520, 1400, () => {
      ctx.strokeStyle = 'rgba(255,225,77,0.9)';
      ctx.lineWidth = 7;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(520, 300);
      ctx.quadraticCurveTo(960, 318, 1400, 296);
      ctx.stroke();
    });
    const sub = [meta.artist, ...meta.credits].filter(Boolean).join('　/　');
    if (sub) {
      ctx.save();
      ctx.globalAlpha = inv(2.6, 3.3, t);
      chalk(ctx, sub, 960, 360, fitFont(ctx, sub, 40, FONT_JP, 700, 1200), { color: 'rgba(200,240,255,0.95)' });
      ctx.restore();
    }
    // chalk equations, every answer is (confidently) nine
    EQUATIONS.forEach(([lhs, ans], i) => {
      const t0 = feats.snap(3.6 + i * 2.2);
      const x = 480 + i * 470;
      const y = 520;
      ctx.font = `700 64px ${FONT_JP}`;
      const lw = ctx.measureText(lhs).width + 22;
      const aw = ctx.measureText(ans).width;
      const x0 = x - (lw + aw) / 2;
      reveal(ctx, inv(t0, t0 + 0.55, t), x0 - 10, x0 + lw + aw + 10, () => {
        chalk(ctx, lhs, x0, y, 64, { align: 'left' });
        chalk(ctx, ans, x0 + lw, y, 64, { align: 'left', color: PAL.yellow });
      });
      chalkCircle(ctx, x0 + lw + aw / 2, y, 40, inv(t0 + 0.5, t0 + 0.9, t), 'rgba(255,225,77,0.95)');
      const ck = inv(9.9 + i * 0.18, 10.15 + i * 0.18, t);
      if (ck > 0) {
        ctx.save();
        ctx.strokeStyle = 'rgba(255,90,120,0.95)';
        ctx.lineWidth = 10;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        const cx = x0 + lw + aw + 50;
        ctx.moveTo(cx, y - 6);
        ctx.lineTo(cx + 20 * Math.min(1, ck * 2), y + 20 * Math.min(1, ck * 2));
        if (ck > 0.5) ctx.lineTo(cx + 20 + 44 * (ck - 0.5) * 2, y + 20 - 60 * (ck - 0.5) * 2);
        ctx.stroke();
        ctx.restore();
      }
    });
    // the teacher arrives
    const mk = easeBack(inv(2.7, 3.5, t));
    const mx = lerp(2200, 1600, mk);
    const lt = t;
    drawMascot(ctx, mx, 680 - Math.abs(Math.sin(feats.beat(t) * Math.PI)) * (t > 3.5 ? 24 : 0), 250, t, {
      mood: lt > 6.8 && lt < 10.2 ? 'happy' : 'normal',
      pointer: true,
      squash: t > 3.5 ? pulse(t) : 0,
      lookX: -1,
    });
    dust(ctx, t);
    // fade in from black
    const fade = 1 - inv(0, 0.9, t);
    if (fade > 0) {
      ctx.fillStyle = `rgba(0,0,0,${fade})`;
      ctx.fillRect(0, 0, W, H);
    }
  }

  // ---------------------------------------------------------------- sparkle

  function diamond(ctx, x, y, R, spin, t) {
    const N = 8;
    const pts = [];
    for (let k = 0; k <= N; k++) {
      const a = spin + (k * TAU) / N;
      pts.push({
        a,
        gx: Math.sin(a) * R,
        gy: -0.12 * R + Math.cos(a) * R * 0.12,
        tx: Math.sin(a) * R * 0.58,
        ty: -0.5 * R + Math.cos(a) * R * 0.08,
        f: Math.cos(a),
      });
    }
    ctx.save();
    ctx.translate(x, y);
    ctx.lineJoin = 'round';
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth = 3;
    const order = [];
    for (let k = 0; k < N; k++) order.push(k);
    order.sort((a, b) => Math.cos(spin + ((a + 0.5) * TAU) / N) - Math.cos(spin + ((b + 0.5) * TAU) / N));
    for (const k of order) {
      const p = pts[k];
      const q = pts[k + 1];
      const face = Math.cos(spin + ((k + 0.5) * TAU) / N);
      if (face < -0.05) continue;
      const light = 55 + face * 35;
      const hue = 190 + 40 * Math.sin(spin * 2 + k);
      ctx.fillStyle = `hsl(${hue}, 90%, ${light}%)`;
      ctx.beginPath();
      ctx.moveTo(p.tx, p.ty);
      ctx.lineTo(q.tx, q.ty);
      ctx.lineTo(q.gx, q.gy);
      ctx.lineTo(p.gx, p.gy);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = `hsl(${hue + 20}, 85%, ${light - 12}%)`;
      ctx.beginPath();
      ctx.moveTo(p.gx, p.gy);
      ctx.lineTo(q.gx, q.gy);
      ctx.lineTo(0, R);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
    ctx.fillStyle = 'rgba(235,252,255,0.95)';
    ctx.beginPath();
    for (let k = 0; k < N; k++) ctx.lineTo(pts[k].tx, pts[k].ty);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  function medal(ctx, x, y, r, t, swing) {
    ctx.save();
    ctx.translate(x, -60);
    ctx.rotate(swing);
    const len = y + 60;
    ctx.fillStyle = PAL.blue;
    ctx.beginPath();
    ctx.moveTo(-110, 0);
    ctx.lineTo(-20, 0);
    ctx.lineTo(10, len - r * 0.8);
    ctx.lineTo(-60, len - r * 0.7);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = PAL.pink;
    ctx.beginPath();
    ctx.moveTo(110, 0);
    ctx.lineTo(20, 0);
    ctx.lineTo(-10, len - r * 0.8);
    ctx.lineTo(60, len - r * 0.7);
    ctx.closePath();
    ctx.fill();
    ctx.translate(0, len);
    const g = ctx.createRadialGradient(-r * 0.3, -r * 0.3, r * 0.1, 0, 0, r);
    g.addColorStop(0, '#fff6c2');
    g.addColorStop(0.6, '#ffcf3a');
    g.addColorStop(1, '#d58a12');
    ctx.fillStyle = g;
    star(ctx, 0, 0, r * 1.12, r * 0.98, 24, t);
    ctx.fill();
    ctx.strokeStyle = '#a4650a';
    ctx.lineWidth = 6;
    ctx.stroke();
    nine(ctx, 0, 0, r * 0.68, { bg: '#fff2a8', ring: '#c27c0e', color: '#c2272d' });
    ctx.restore();
  }

  function podium(ctx, k, t) {
    if (k <= 0) return;
    const y0 = lerp(H + 50, 0, easeOut(k));
    const blocks = [
      [-330, 230, '2', '#9fd8ff'],
      [330, 170, '3', '#ffb3d4'],
      [0, 330, '9', PAL.yellow],
    ];
    ctx.save();
    ctx.translate(960, y0);
    for (const [bx, bh, label, col] of blocks) {
      ctx.fillStyle = col;
      ctx.strokeStyle = PAL.navy;
      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.roundRect(bx - 160, 800 - bh, 320, bh + 300, 16);
      ctx.fill();
      ctx.stroke();
      if (label === '9') nine(ctx, bx, 800 - bh + 90, 62, { bg: '#fff', ring: PAL.red, color: PAL.red });
      else outlined(ctx, label, bx, 800 - bh + 80, { size: 96, family: FONT_DISPLAY, weight: 400, fill: '#fff', outer: null });
    }
    ctx.restore();
  }

  function sparkleScene(ctx, t, lt) {
    radialBg(ctx, 960, 420, 1300, '#3b3a9e', '#0a1040');
    rays(ctx, 960, 420, 18, t * 0.15, '#ffffff', 0.05);
    twinkles(ctx, t, 60, 61, { size: 14 });
    const p = pulse(t);
    drawSprite(ctx, glowC, 960, 420, 900 + p * 120, 0, 0.55);
    // 0..6: diamond, 6..9.2: medal, 9.2..: podium
    const dk = easeBack(inv(0, 0.5, lt)) * (1 - easeIn(inv(5.7, 6.2, lt)));
    if (dk > 0) {
      ctx.save();
      ctx.translate(960, 410);
      ctx.scale(dk * (1 + p * 0.05), dk * (1 + p * 0.05));
      diamond(ctx, 0, 0, 240, t * 1.3, t);
      ctx.restore();
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * TAU + t * 0.8;
        sparkle(ctx, 960 + Math.cos(a) * 320 * dk, 410 + Math.sin(a) * 250 * dk, 26 * p + 6, '#fff', dk);
      }
    }
    const mk = inv(6.0, 6.8, lt) * (1 - inv(9.0, 9.5, lt));
    if (mk > 0) {
      const swing = Math.sin((lt - 6) * 3.2) * 0.22 * Math.exp(-(lt - 6) * 0.6);
      medal(ctx, 960, lerp(-300, 400, easeElastic(inv(6.0, 6.9, lt))) - inv(9.0, 9.5, lt) * 900, 170, t, swing);
    }
    const pk = inv(9.2, 9.8, lt);
    if (pk > 0) {
      // rising arrow behind the podium
      const ay = lerp(H + 300, 120, easeOut(inv(9.3, 10.4, lt)));
      ctx.save();
      ctx.translate(960, ay);
      ctx.fillStyle = vGradient(ctx, [PAL.yellow, PAL.orange], 0, 700);
      ctx.strokeStyle = PAL.navy;
      ctx.lineWidth = 10;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(220, 220);
      ctx.lineTo(90, 220);
      ctx.lineTo(90, 700);
      ctx.lineTo(-90, 700);
      ctx.lineTo(-90, 220);
      ctx.lineTo(-220, 220);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
      podium(ctx, pk, t);
      for (let i = 0; i < 24; i++) {
        const x = rand(i, 71) * W;
        const y = ((rand(i, 72) * H + (lt - 9.2) * (300 + rand(i, 73) * 300)) % H);
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(lt * 4 + i);
        ctx.fillStyle = [PAL.pink, PAL.yellow, PAL.ice, '#fff'][i % 4];
        ctx.fillRect(-10, -5, 20, 10);
        ctx.restore();
      }
    }
  }

  // ------------------------------------------------------------------- baka

  const BAKA_PAL = [
    ['#2fd0ff', '#0d4fd8'],
    ['#ff6fb0', '#b8237a'],
    ['#ffe14d', '#ff8a1a'],
    ['#8a6bff', '#3a22b5'],
  ];

  function baka(ctx, t, lt, sc) {
    const v = sc.variant;
    const b = feats.beat(t);
    const bi = Math.floor(b);
    const p = pulse(t);
    const pal = BAKA_PAL[Math.floor(bi / (v === 2 ? 1 : 2)) % 4];
    radialBg(ctx, 960, 450, 1250, pal[0], pal[1]);
    rays(ctx, 960, 450, 20, t * 0.4 * (v === 1 ? -1 : 1), '#ffffff', 0.13);
    if (v === 1) {
      // checkerboard floor in perspective
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 700, W, H - 700);
      ctx.clip();
      const scroll = fract(b * 0.5);
      for (let row = 0; row < 10; row++) {
        const z0 = 1 + row - scroll;
        const z1 = z0 + 1;
        const ya = 700 + 2600 / (z1 + 2.2) - 2600 / 12;
        const yb = 700 + 2600 / (z0 + 2.2) - 2600 / 12;
        for (let col = -12; col < 12; col++) {
          if ((col + row) % 2 === 0) continue;
          const xa0 = 960 + (col * 260) / (z1 + 2.2) * 3;
          const xa1 = 960 + ((col + 1) * 260) / (z1 + 2.2) * 3;
          const xb0 = 960 + (col * 260) / (z0 + 2.2) * 3;
          const xb1 = 960 + ((col + 1) * 260) / (z0 + 2.2) * 3;
          ctx.fillStyle = 'rgba(255,255,255,0.22)';
          ctx.beginPath();
          ctx.moveTo(xa0, ya);
          ctx.lineTo(xa1, ya);
          ctx.lineTo(xb1, yb);
          ctx.lineTo(xb0, yb);
          ctx.closePath();
          ctx.fill();
        }
      }
      ctx.restore();
    }
    // pulse rings
    ctx.lineWidth = 14;
    for (let k = 0; k < 3; k++) {
      const ph = (fract(b) + k) / 3;
      ctx.strokeStyle = `rgba(255,255,255,${0.35 * (1 - ph)})`;
      ctx.beginPath();
      ctx.arc(960, 450, ph * 1500, 0, TAU);
      ctx.stroke();
    }
    // orbiting nines
    const n = 12;
    for (let i = 0; i < n; i++) {
      const a = t * 0.6 * (v === 1 ? -1 : 1) + (i * TAU) / n;
      const depth = (Math.sin(a) + 1) / 2;
      const r = 36 + depth * 44 + p * 10;
      nine(ctx, 960 + Math.cos(a) * 780, 450 + Math.sin(a) * 330, r, {
        rot: Math.sin(t * 3 + i) * 0.5,
        bg: i % 2 ? '#ffffff' : PAL.yellow,
        ring: i % 3 ? PAL.blue : PAL.pink,
        color: i % 3 ? PAL.blue : PAL.pink,
      });
    }
    if (v >= 1) {
      for (const [x, ph] of [
        [250, 0],
        [1670, 1],
      ]) {
        const hop = Math.abs(Math.sin(((b + ph) * Math.PI) / 2));
        drawMascot(ctx, x, 800 - hop * 120, 210, t, { mood: 'happy', squash: 1 - hop, wave: hop, tilt: (ph ? -1 : 1) * 0.1 });
      }
    }
    if (v === 2) {
      for (let i = 0; i < 70; i++) {
        const x = (rand(i, 81) * W + Math.sin(t * 2 + i) * 40) % W;
        const y = ((rand(i, 82) * (H + 100) + lt * (200 + rand(i, 83) * 260)) % (H + 100)) - 50;
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(t * (2 + rand(i, 84) * 4) + i);
        ctx.scale(1, Math.cos(t * 6 + i));
        ctx.fillStyle = [PAL.pink, PAL.yellow, PAL.ice, '#ffffff', PAL.violet][i % 5];
        ctx.fillRect(-12, -6, 24, 12);
        ctx.restore();
      }
    }
    // beat flash
    ctx.fillStyle = `rgba(255,255,255,${0.18 * p})`;
    ctx.fillRect(0, 0, W, H);
  }

  // -------------------------------------------------------------------- bus

  const STOP_GAP = 1800;
  const BUS_KEYS = [
    [45.0, 0],
    [47.95, 0],
    [50.0, 1],
    [53.95, 1],
    [55.0, 2],
    [56.95, 2],
  ];
  const POOF = feats.snap(64.35);
  const PAX = [
    { slot: 0, color: '#ff8fb8', hair: '#c94f7f', in: 47.15, out: 50.35 },
    { slot: 1, color: '#8fe08a', hair: '#3f9a48', in: 47.5, out: 55.25 },
    { slot: 2, color: '#b49bff', hair: '#6a4fd0', in: 47.85, out: 55.6 },
    { slot: 3, color: '#ffb35c', hair: '#c7741a', in: 53.25, out: 1e9, half: true },
  ];
  const BUS_LOG = [
    [47.2, '3'],
    [50.45, '3 − 1 = 2'],
    [53.35, '2 + 0.5 = 2.5'],
    [55.7, '2.5 − 2 = 0.5'],
  ];

  function busX(t) {
    if (t <= BUS_KEYS[0][0]) return 0;
    for (let i = 0; i < BUS_KEYS.length - 1; i++) {
      const [t0, x0] = BUS_KEYS[i];
      const [t1, x1] = BUS_KEYS[i + 1];
      if (t < t1) return STOP_GAP * lerp(x0, x1, smooth(inv(t0, t1, t)));
    }
    const [tl, xl] = BUS_KEYS[BUS_KEYS.length - 1];
    const tc = Math.min(t, POOF) - tl;
    const v = 900;
    const d = tc < 1 ? 0.5 * v * tc * tc : 0.5 * v + v * (tc - 1);
    return STOP_GAP * xl + d;
  }

  function passenger(ctx, cx, wy, p, t) {
    const kin = clamp((t - p.in) / 0.25);
    const kout = clamp((t - p.out) / 0.3);
    if (kin <= 0 || kout >= 1) return;
    const s = easeBack(kin);
    ctx.save();
    ctx.globalAlpha *= 1 - kout;
    ctx.translate(cx, wy + 52 - kout * 50);
    ctx.scale(s, s);
    if (p.half) {
      ctx.beginPath();
      ctx.rect(-60, -80, 60, 160);
      ctx.clip();
    }
    ctx.fillStyle = p.color;
    ctx.strokeStyle = PAL.navy;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.roundRect(-30, 6, 60, 60, 24);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#ffe2c8';
    ctx.beginPath();
    ctx.arc(0, -16, 24, 0, TAU);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = p.hair;
    ctx.beginPath();
    ctx.arc(0, -20, 24, Math.PI * 1.05, Math.PI * 1.95);
    ctx.fill();
    ctx.fillStyle = PAL.navy;
    ctx.beginPath();
    ctx.arc(-8, -12, 3.5, 0, TAU);
    ctx.arc(8, -12, 3.5, 0, TAU);
    ctx.fill();
    ctx.restore();
    if (p.half && kout <= 0) {
      ctx.save();
      ctx.globalAlpha *= kin;
      ctx.setLineDash([8, 8]);
      ctx.strokeStyle = 'rgba(12,31,79,0.6)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(cx, wy + 8);
      ctx.lineTo(cx, wy + 80);
      ctx.stroke();
      ctx.restore();
    }
  }

  function bus(ctx, x, y, wheelA, t, withPax = true) {
    ctx.save();
    ctx.lineJoin = 'round';
    ctx.strokeStyle = PAL.navy;
    // roof unit
    ctx.fillStyle = '#e9f1fa';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.roundRect(x - 140, y - 290, 220, 26, 8);
    ctx.fill();
    ctx.stroke();
    // body
    ctx.fillStyle = vGradient(ctx, ['#ffe680', '#ffc533'], y - 270, y - 40);
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.roundRect(x - 280, y - 270, 560, 228, 38);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#2f6ee0';
    ctx.fillRect(x - 276, y - 120, 552, 24);
    // windows + passengers
    for (let i = 0; i < 4; i++) {
      const wx = x - 252 + i * 112;
      const wy = y - 246;
      ctx.fillStyle = '#c9eeff';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.roundRect(wx, wy, 92, 84, 12);
      ctx.fill();
      ctx.save();
      ctx.clip();
      if (withPax) for (const p of PAX) if (p.slot === i) passenger(ctx, wx + 46, wy, p, t);
      ctx.fillStyle = 'rgba(255,255,255,0.45)';
      ctx.beginPath();
      ctx.moveTo(wx + 10, wy + 84);
      ctx.lineTo(wx + 40, wy);
      ctx.lineTo(wx + 56, wy);
      ctx.lineTo(wx + 26, wy + 84);
      ctx.fill();
      ctx.restore();
      ctx.beginPath();
      ctx.roundRect(wx, wy, 92, 84, 12);
      ctx.stroke();
    }
    // door
    ctx.fillStyle = '#a8dcf5';
    ctx.beginPath();
    ctx.roundRect(x + 196, y - 246, 64, 192, 10);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x + 228, y - 246);
    ctx.lineTo(x + 228, y - 54);
    ctx.stroke();
    // route sign
    ctx.fillStyle = '#18213d';
    ctx.beginPath();
    ctx.roundRect(x + 110, y - 266, 74, 30, 6);
    ctx.fill();
    ctx.fillStyle = PAL.yellow;
    ctx.font = `26px ${FONT_DISPLAY}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('9', x + 147, y - 250);
    // lights + bumper
    ctx.fillStyle = '#fff3a0';
    ctx.beginPath();
    ctx.arc(x + 270, y - 82, 15, 0, TAU);
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.stroke();
    ctx.fillStyle = '#c9d6e6';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.roundRect(x - 290, y - 64, 580, 20, 8);
    ctx.fill();
    ctx.stroke();
    // wheels
    for (const wx of [x - 170, x + 150]) {
      ctx.fillStyle = '#2a3554';
      ctx.beginPath();
      ctx.arc(wx, y - 44, 56, Math.PI, 0);
      ctx.fill();
      ctx.fillStyle = '#1d2a45';
      ctx.beginPath();
      ctx.arc(wx, y - 44, 44, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#d7e6f5';
      ctx.beginPath();
      ctx.arc(wx, y - 44, 24, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = '#7a8bab';
      ctx.lineWidth = 4;
      ctx.beginPath();
      for (let k = 0; k < 5; k++) {
        const a = wheelA + (k * TAU) / 5;
        ctx.moveTo(wx, y - 44);
        ctx.lineTo(wx + Math.cos(a) * 22, y - 44 + Math.sin(a) * 22);
      }
      ctx.stroke();
    }
    ctx.restore();
  }

  function busScene(ctx, t) {
    const bx = busX(t);
    const speed = (busX(t + 0.02) - bx) / 0.02;
    fillBg(ctx, ['#7fd0ff', '#bfe8ff', '#e6f7ff']);
    drawSprite(ctx, glowW, 1600, 140, 360, 0, 0.9);
    // far mountains
    ctx.save();
    const m0 = -bx * 0.06;
    for (let i = -1; i < 8; i++) {
      const x = (((m0 + i * 420) % 2940) + 2940) % 2940 - 400;
      const h = 220 + rand(i & 7, 91) * 160;
      ctx.fillStyle = '#9cc8ea';
      ctx.beginPath();
      ctx.moveTo(x - 300, 600);
      ctx.lineTo(x, 600 - h);
      ctx.lineTo(x + 300, 600);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.moveTo(x - 85, 600 - h + 85 * (h / 300));
      ctx.lineTo(x, 600 - h);
      ctx.lineTo(x + 85, 600 - h + 85 * (h / 300));
      ctx.lineTo(x + 30, 600 - h + 110 * (h / 300));
      ctx.lineTo(x - 20, 600 - h + 70 * (h / 300));
      ctx.fill();
    }
    ctx.restore();
    // hills + pines
    const h0 = -bx * 0.25;
    ctx.fillStyle = '#e9f7ff';
    ctx.beginPath();
    ctx.moveTo(0, 620);
    for (let x = 0; x <= W; x += 40) ctx.lineTo(x, 560 + Math.sin((x - h0) * 0.006) * 30);
    ctx.lineTo(W, 620);
    ctx.fill();
    for (let i = 0; i < 12; i++) {
      const x = ((((h0 + i * 230) % 2760) + 2760) % 2760) - 200;
      const s = 0.7 + rand(i, 92) * 0.6;
      ctx.fillStyle = '#2e7a74';
      ctx.beginPath();
      ctx.moveTo(x, 600 - 150 * s);
      ctx.lineTo(x + 50 * s, 600);
      ctx.lineTo(x - 50 * s, 600);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.moveTo(x, 600 - 150 * s);
      ctx.lineTo(x + 18 * s, 600 - 96 * s);
      ctx.lineTo(x - 18 * s, 600 - 96 * s);
      ctx.fill();
    }
    // road
    ctx.fillStyle = '#4d6e96';
    ctx.fillRect(0, 610, W, 190);
    ctx.fillStyle = '#d9ecf8';
    ctx.fillRect(0, 604, W, 10);
    ctx.fillStyle = '#ffffff';
    const d0 = -bx;
    for (let i = -1; i < 12; i++) {
      const x = (((d0 + i * 200) % 2400) + 2400) % 2400 - 200;
      ctx.fillRect(x, 770, 120, 10);
    }
    // stops
    for (let k = 0; k < 3; k++) {
      const sx = 1235 + k * STOP_GAP - bx;
      if (sx < -100 || sx > W + 100) continue;
      ctx.strokeStyle = '#8fa3bf';
      ctx.lineWidth = 10;
      ctx.beginPath();
      ctx.moveTo(sx, 640);
      ctx.lineTo(sx, 470);
      ctx.stroke();
      ctx.fillStyle = '#2f6ee0';
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 7;
      ctx.beginPath();
      ctx.arc(sx, 450, 50, 0, TAU);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#ffffff';
      ctx.font = `52px ${FONT_DISPLAY}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(k + 1), sx, 454);
    }
    // bus
    if (t < POOF + 0.05) {
      const shake = t > 63 ? Math.sin(t * 80) * 6 * inv(63, 64, t) : 0;
      const bob = Math.sin(t * 28) * 3 * clamp(speed / 500);
      bus(ctx, 900 + shake, 742 + bob, bx / 44, t);
    }
    // question marks / answer stamp
    const qk = inv(58, 58.3, t) * (1 - inv(60.8, 61, t));
    if (qk > 0) {
      for (let i = 0; i < 3; i++) {
        const hop = Math.abs(Math.sin((feats.beat(t) + i * 0.33) * Math.PI)) * 30;
        outlined(ctx, '?', 780 + i * 120, 380 - hop - i % 2 * 30, { size: 130 * qk, family: FONT_DISPLAY, weight: 400, fill: PAL.yellow });
      }
    }
    poof(ctx, 900, 600, inv(POOF, POOF + 1.1, t), 1.6);
    // "no bus" sign
    const nk = inv(POOF + 0.3, POOF + 0.7, t);
    if (nk > 0) {
      ctx.save();
      ctx.translate(960, 400);
      ctx.rotate(Math.sin(t * 5) * 0.06);
      ctx.scale(easeBack(nk), easeBack(nk));
      ctx.fillStyle = 'rgba(255,255,255,0.95)';
      ctx.beginPath();
      ctx.arc(0, 0, 220, 0, TAU);
      ctx.fill();
      ctx.save();
      ctx.scale(0.5, 0.5);
      bus(ctx, 0, 150, 0, t, false);
      ctx.restore();
      ctx.strokeStyle = PAL.red;
      ctx.lineWidth = 40;
      ctx.beginPath();
      ctx.arc(0, 0, 200, 0, TAU);
      ctx.moveTo(-141, -141);
      ctx.lineTo(141, 141);
      ctx.stroke();
      ctx.restore();
    }
    // passenger log
    const hk = inv(46.6, 47.2, t);
    if (hk > 0) {
      ctx.save();
      ctx.translate(lerp(-700, 0, easeOut(hk)), 0);
      ctx.fillStyle = 'rgba(20,60,48,0.92)';
      ctx.strokeStyle = '#8f5f33';
      ctx.lineWidth = 14;
      ctx.beginPath();
      ctx.roundRect(50, 40, 560, 360, 18);
      ctx.fill();
      ctx.stroke();
      chalk(ctx, 'PASSENGERS', 330, 90, 42, { family: FONT_DISPLAY, weight: 400, color: PAL.yellow });
      BUS_LOG.forEach(([tt, s], i) => {
        const k = inv(tt, tt + 0.45, t);
        const last = i === BUS_LOG.length - 1 || t < BUS_LOG[i + 1][0];
        reveal(ctx, k, 80, 600, () =>
          chalk(ctx, s, 90, 148 + i * 56, 44, { align: 'left', color: last ? '#ffffff' : 'rgba(244,247,242,0.55)' }),
        );
      });
      const zk = inv(61, 61.4, t);
      if (zk > 0) {
        ctx.strokeStyle = PAL.red;
        ctx.lineWidth = 8;
        ctx.beginPath();
        ctx.moveTo(80, 352);
        ctx.lineTo(80 + 500 * zk, 352);
        ctx.moveTo(80, 364);
        ctx.lineTo(80 + 500 * zk, 364);
        ctx.stroke();
      }
      ctx.restore();
    }
    stamp(ctx, 1450, 300, 150, '0人', inv(61, 61.35, t) * (1 - inv(POOF + 0.2, POOF + 0.5, t)));
    // front snow bank
    ctx.fillStyle = '#f2fbff';
    ctx.beginPath();
    ctx.moveTo(0, H);
    const f0 = -bx * 1.2;
    for (let x = 0; x <= W; x += 40) ctx.lineTo(x, 815 + Math.sin((x - f0) * 0.01) * 12 + Math.sin((x - f0) * 0.023) * 8);
    ctx.lineTo(W, H);
    ctx.fill();
    snow(ctx, t, { n: 50, alpha: 0.9 });
  }

  // ------------------------------------------------------------------ stage

  function stage(ctx, t, lt, sc) {
    const v = sc.variant;
    radialBg(ctx, 960, 300, 1300, v ? '#4a2c9c' : '#3a2c8c', '#0b0a2e');
    // back wall light strips
    ctx.fillStyle = 'rgba(127,220,255,0.06)';
    for (let i = 0; i < 9; i++) ctx.fillRect(140 + i * 210, 0, 60, 760);
    twinkles(ctx, t, 30, 101, { maxY: 600, size: 10 });
    // floor
    const g = ctx.createLinearGradient(0, 720, 0, H);
    g.addColorStop(0, '#5a3d9e');
    g.addColorStop(1, '#1c1240');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(960, 860, 980, 170, 0, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = '#ffd36b';
    ctx.lineWidth = 6;
    ctx.stroke();
    // spotlights
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const beams = [
      [380, -60, 'rgba(127,220,255,'],
      [960, -90, 'rgba(255,225,77,'],
      [1540, -60, 'rgba(255,95,162,'],
    ];
    beams.forEach(([sx, sy, col], i) => {
      const tx = 960 + Math.sin(t * 1.3 + i * 2.1) * 420;
      const ty = 820;
      const spread = 170;
      const gr = ctx.createLinearGradient(sx, sy, tx, ty);
      gr.addColorStop(0, col + '0.55)');
      gr.addColorStop(1, col + '0.05)');
      ctx.fillStyle = gr;
      ctx.beginPath();
      ctx.moveTo(sx - 20, sy);
      ctx.lineTo(sx + 20, sy);
      ctx.lineTo(tx + spread, ty);
      ctx.lineTo(tx - spread, ty);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = col + '0.25)';
      ctx.beginPath();
      ctx.ellipse(tx, ty, spread, 40, 0, 0, TAU);
      ctx.fill();
    });
    ctx.restore();
    // fireworks (second time round)
    if (v) {
      for (let k = 0; k < 4; k++) {
        const bi = beatI(t) - k;
        const t0 = feats.offset + bi * P;
        if (bi % 2) continue;
        const age = t - t0;
        if (age < 0 || age > 1.4) continue;
        const cx = 300 + rand(bi, 111) * 1320;
        const cy = 140 + rand(bi, 112) * 300;
        const col = [PAL.yellow, PAL.pink, PAL.ice, '#ffffff'][bi & 3];
        ctx.fillStyle = col;
        ctx.globalAlpha = 1 - age / 1.4;
        for (let j = 0; j < 22; j++) {
          const a = (j / 22) * TAU;
          const d = easeOut(age / 1.4) * 220;
          ctx.beginPath();
          ctx.arc(cx + Math.cos(a) * d, cy + Math.sin(a) * d + age * age * 80, 7, 0, TAU);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
      }
    }
    // mascot steps aside for the count-out
    const tok = lyrics.lineAt(sc.end - 1);
    const tokT = tok && /^[\d\s]+$/.test(tok.text) ? tok.start : sc.end;
    const side = smooth(inv(tokT - 0.4, tokT, t));
    const b = feats.beat(t);
    const hop = Math.abs(Math.sin((b * Math.PI) / 2));
    const mx = 960;
    const my = lerp(650, 830, side) - hop * lerp(70, 30, side);
    const ms = lerp(300, 190, side);
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * TAU + t * 1.2;
      ctx.fillStyle = i % 2 ? PAL.yellow : '#ffffff';
      star(ctx, mx + Math.cos(a) * ms * 0.95, my - ms * 0.1 + Math.sin(a) * ms * 0.7, 22 + pulse(t) * 10, 10);
      ctx.fill();
    }
    drawMascot(ctx, mx, my, ms, t, { mood: 'happy', squash: 1 - hop, wave: 0.6 + hop * 0.4 });
    // curtains
    const open = v ? 1 : easeInOut(inv(0, 1.2, lt));
    for (const side2 of [-1, 1]) {
      const cw = lerp(980, 260, open);
      const x0 = side2 < 0 ? 0 : W - cw;
      const cg = ctx.createLinearGradient(x0, 0, x0 + cw, 0);
      for (let k = 0; k <= 8; k++) cg.addColorStop(k / 8, k % 2 ? '#1d3f9e' : '#14307e');
      ctx.fillStyle = cg;
      ctx.beginPath();
      ctx.moveTo(x0, 0);
      ctx.lineTo(x0 + cw, 0);
      if (side2 < 0) ctx.quadraticCurveTo(x0 + cw - 40, 600, x0 + cw - 90, H);
      else ctx.quadraticCurveTo(x0 + 40, 600, x0 + 90, H);
      ctx.lineTo(side2 < 0 ? 0 : W, H);
      ctx.closePath();
      ctx.fill();
    }
    ctx.fillStyle = '#14307e';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(W, 0);
    ctx.lineTo(W, 70);
    for (let x = W; x >= 0; x -= 120) ctx.quadraticCurveTo(x - 60, 130, x - 120, 70);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#ffd36b';
    ctx.lineWidth = 6;
    ctx.stroke();
  }

  // ------------------------------------------------------------------ clock

  function makeFrost() {
    const c = makeCanvas(W, H);
    const g = c.getContext('2d');
    const fog = g.createRadialGradient(W / 2, H / 2, 420, W / 2, H / 2, 1150);
    fog.addColorStop(0, 'rgba(230,248,255,0)');
    fog.addColorStop(1, 'rgba(230,248,255,0.85)');
    g.fillStyle = fog;
    g.fillRect(0, 0, W, H);
    g.strokeStyle = 'rgba(255,255,255,0.65)';
    g.lineCap = 'round';
    let seed = 0;
    const branch = (x, y, a, len, depth) => {
      if (depth === 0 || len < 5) return;
      const x2 = x + Math.cos(a) * len;
      const y2 = y + Math.sin(a) * len;
      g.lineWidth = Math.max(1, depth * 0.9);
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x2, y2);
      g.stroke();
      const r = rand(seed++, 77);
      branch(x2, y2, a + 0.55 + r * 0.3, len * 0.6, depth - 1);
      branch(x2, y2, a - 0.55 - r * 0.3, len * 0.6, depth - 1);
      branch(x2, y2, a + (r - 0.5) * 0.25, len * 0.78, depth - 1);
    };
    for (let i = 0; i < 72; i++) {
      const e = i % 4;
      const u = rand(i, 70);
      let x;
      let y;
      let a;
      if (e === 0) [x, y, a] = [u * W, 0, Math.PI / 2];
      else if (e === 1) [x, y, a] = [u * W, H, -Math.PI / 2];
      else if (e === 2) [x, y, a] = [0, u * H, 0];
      else [x, y, a] = [W, u * H, Math.PI];
      branch(x, y, a + (rand(i, 71) - 0.5) * 0.9, 60 + rand(i, 72) * 90, 5);
    }
    return c;
  }

  // integrates a speed curve: 1 before t0, easing to `s1` at t1
  const warp = (t, t0, t1, s1) => {
    if (t <= t0) return t;
    const d = Math.min(t, t1) - t0;
    const span = t1 - t0;
    const base = t0 + d - ((1 - s1) * d * d) / (2 * span);
    return t > t1 ? base + (t - t1) * s1 : base;
  };

  function clockFace(ctx, cx, cy, R, t, tw, scramble) {
    // bells + legs
    ctx.fillStyle = '#ffd34d';
    ctx.strokeStyle = PAL.navy;
    ctx.lineWidth = 8;
    for (const s of [-1, 1]) {
      ctx.save();
      ctx.translate(cx + s * R * 0.62, cy - R * 0.86);
      ctx.rotate(s * 0.5 + Math.sin(t * 40) * 0.08);
      ctx.beginPath();
      ctx.arc(0, 0, R * 0.32, Math.PI, 0);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
      ctx.beginPath();
      ctx.moveTo(cx + s * R * 0.55, cy + R * 0.8);
      ctx.lineTo(cx + s * R * 0.75, cy + R * 1.1);
      ctx.stroke();
    }
    const rim = ctx.createLinearGradient(cx - R, cy - R, cx + R, cy + R);
    rim.addColorStop(0, '#5fa8ff');
    rim.addColorStop(1, '#1d3f9e');
    ctx.fillStyle = rim;
    ctx.beginPath();
    ctx.arc(cx, cy, R + 34, 0, TAU);
    ctx.fill();
    ctx.stroke();
    const face = ctx.createRadialGradient(cx - R * 0.3, cy - R * 0.3, 10, cx, cy, R);
    face.addColorStop(0, '#ffffff');
    face.addColorStop(1, '#d4eeff');
    ctx.fillStyle = face;
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = PAL.navy;
    ctx.lineWidth = 3;
    ctx.beginPath();
    for (let i = 0; i < 60; i++) {
      const a = (i / 60) * TAU;
      const r0 = i % 5 ? R * 0.92 : R * 0.86;
      ctx.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0);
      ctx.lineTo(cx + Math.cos(a) * R * 0.97, cy + Math.sin(a) * R * 0.97);
    }
    ctx.stroke();
    ctx.font = `${R * 0.17}px ${FONT_DISPLAY}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let h = 1; h <= 12; h++) {
      const a = (h / 12) * TAU - Math.PI / 2;
      const x = cx + Math.cos(a) * R * 0.72;
      const y = cy + Math.sin(a) * R * 0.72;
      if (h === 9) {
        nine(ctx, x, y, R * 0.12, { bg: PAL.yellow, ring: PAL.red, color: PAL.red });
        continue;
      }
      const label = scramble ? String(Math.floor(rand(h, beatI(t)) * 10)) : String(h);
      ctx.fillStyle = PAL.navy;
      ctx.fillText(label, x, y + 2);
    }
    const hand = (a, len, w, col) => {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(a);
      ctx.fillStyle = col;
      ctx.strokeStyle = PAL.navy;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.roundRect(-w / 2, -len, w, len + w, w / 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    };
    hand(tw * 0.9, R * 0.5, 26, PAL.navy);
    hand(tw * 3.1 + 1, R * 0.74, 18, PAL.blue);
    hand(tw * 7.3 + 2, R * 0.86, 8, PAL.red);
    ctx.fillStyle = PAL.yellow;
    ctx.beginPath();
    ctx.arc(cx, cy, 18, 0, TAU);
    ctx.fill();
    ctx.stroke();
  }

  function bubble(ctx, x, y, label, k, col) {
    if (k <= 0) return;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(easeBack(k), easeBack(k));
    ctx.fillStyle = col;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.arc(0, 0, 62, 0, TAU);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.font = `76px ${FONT_DISPLAY}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, 0, 4);
    ctx.restore();
  }

  function worksheet(ctx, x, y, rot, i) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#9cb7d8';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(-90, -115, 180, 230, 8);
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = '#c9dcf0';
    ctx.beginPath();
    for (let k = 0; k < 6; k++) {
      ctx.moveTo(-70, -60 + k * 30);
      ctx.lineTo(70, -60 + k * 30);
    }
    ctx.stroke();
    ctx.fillStyle = PAL.navy;
    ctx.font = `700 30px ${FONT_JP}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const a = 2 + Math.floor(rand(i, 121) * 8);
    const b = 2 + Math.floor(rand(i, 122) * 8);
    ctx.fillText(`${a} ${['+', '×', '−', '÷'][i % 4]} ${b} =`, 0, -85);
    ctx.fillStyle = PAL.red;
    ctx.font = `110px ${FONT_DISPLAY}`;
    ctx.fillText('?', 0, 30);
    ctx.restore();
  }

  function clockScene(ctx, t, lt, sc) {
    const v = sc.variant;
    const s0 = sc.start;
    const tw = warp(t, s0 + 16, s0 + 21.5, 0.04);
    // spiral background
    const base = v ? '#4a1f8f' : '#1a49a6';
    const arm = v ? '#7a3fd6' : '#2c6ee0';
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, W, H);
    const cx = 720;
    const cy = 430;
    const rot = tw * 1.1;
    ctx.fillStyle = arm;
    for (let k = 0; k < 12; k += 2) {
      ctx.beginPath();
      const a0 = rot + (k * TAU) / 12;
      for (let r = 0; r <= 1800; r += 90) ctx.lineTo(cx + Math.cos(a0 + r * 0.003) * r, cy + Math.sin(a0 + r * 0.003) * r);
      for (let r = 1800; r >= 0; r -= 90) {
        const a = a0 + TAU / 12 + r * 0.003;
        ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
      }
      ctx.fill();
    }
    drawSprite(ctx, v ? glowP : glowC, cx, cy, 1100, 0, 0.45);
    snow(ctx, tw, { n: 60, alpha: 0.75 });
    // worksheets fly past (problems keep coming)
    for (let i = 0; i < 12; i++) {
      const ti = s0 + 9 + i * 0.6;
      const age = t - ti;
      if (age < 0 || age > 4) continue;
      const x = W + 150 - age * (650 + rand(i, 123) * 250);
      const y = 120 + rand(i, 124) * 560;
      worksheet(ctx, x, y + Math.sin(age * 3 + i) * 30, age * (rand(i, 125) - 0.5) * 3, i);
    }
    const p = pulse(t);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(1 + p * 0.03, 1 + p * 0.03);
    ctx.translate(-cx, -cy);
    clockFace(ctx, cx, cy, 280, t, tw, lt > 9 && lt < 11);
    ctx.restore();
    // mascot: dizzy -> shocked -> shivering -> relaxed
    let mood = 'normal';
    if (lt >= 2.8 && lt < 9) mood = 'spiral';
    else if (lt >= 9 && lt < 16) mood = 'shock';
    else if (lt >= 16 && lt < 21) mood = 'sleepy';
    else if (lt >= 21) mood = 'happy';
    const shiver = lt >= 16 && lt < 21 ? Math.sin(t * 70) * 5 : 0;
    drawMascot(ctx, 1460 + shiver, 610 - Math.abs(Math.sin(feats.beat(tw) * Math.PI)) * (lt < 16 ? 40 : 0), 300, t, {
      mood,
      sweat: lt >= 2.8 && lt < 16,
      squash: lt < 16 ? p : 0,
      tilt: mood === 'spiral' ? Math.sin(t * 6) * 0.15 : 0,
      lookX: lt < 2.8 ? -1 : 0,
    });
    // two eyes, three hands
    const ek = inv(s0 + 5.2, s0 + 5.5, t) * (1 - inv(s0 + 8.8, s0 + 9.1, t));
    bubble(ctx, 1460, 330, '2', ek, PAL.pink);
    const hk = inv(s0 + 7, s0 + 7.3, t) * (1 - inv(s0 + 8.8, s0 + 9.1, t));
    bubble(ctx, 1040, 170, '3', hk, PAL.blue);
    if (hk > 0) outlined(ctx, '≠', 1250, 250, { size: 110 * hk, family: FONT_DISPLAY, weight: 400, fill: PAL.yellow });
    // the room freezes over
    const fk = smooth(inv(s0 + 16, s0 + 20, t));
    if (fk > 0) {
      const sc2 = lerp(1.35, 1, fk);
      ctx.save();
      ctx.globalAlpha = fk;
      ctx.translate(W / 2, H / 2);
      ctx.scale(sc2, sc2);
      ctx.drawImage(frost, -W / 2, -H / 2);
      ctx.restore();
    }
  }

  // -------------------------------------------------------------------- pot

  const SHATTER = feats.snap(126.05);
  const SHARDS = Array.from({ length: 30 }, (_, i) => {
    const x = 960 + (rand(i, 131) - 0.5) * 260;
    const y = 330 + rand(i, 132) * 300;
    const n = 3 + Math.floor(rand(i, 133) * 3);
    const r = 22 + rand(i, 134) * 30;
    const verts = Array.from({ length: n }, (_, k) => {
      const a = (k / n) * TAU + rand(i * 7 + k, 135) * 0.8;
      const rr = r * (0.6 + rand(i * 7 + k, 136) * 0.5);
      return [Math.cos(a) * rr, Math.sin(a) * rr];
    });
    return {
      x, y, verts,
      vx: (x - 960) * 4.5 + (rand(i, 137) - 0.5) * 400,
      vy: -500 - rand(i, 138) * 700,
      spin: (rand(i, 139) - 0.5) * 14,
      band: rand(i, 140) < 0.4,
    };
  });
  const FLOOR = 830;

  function vasePath(ctx) {
    ctx.beginPath();
    ctx.moveTo(-70, 640);
    ctx.bezierCurveTo(-200, 600, -190, 430, -78, 365);
    ctx.lineTo(-55, 340);
    ctx.lineTo(-78, 312);
    ctx.lineTo(78, 312);
    ctx.lineTo(55, 340);
    ctx.lineTo(78, 365);
    ctx.bezierCurveTo(190, 430, 200, 600, 70, 640);
    ctx.closePath();
  }

  function vase(ctx, t, crack) {
    ctx.save();
    ctx.translate(960, 0);
    vasePath(ctx);
    const g = ctx.createLinearGradient(-200, 0, 200, 0);
    g.addColorStop(0, '#a9c8ef');
    g.addColorStop(0.35, '#ffffff');
    g.addColorStop(1, '#a9c8ef');
    ctx.fillStyle = g;
    ctx.fill();
    ctx.save();
    ctx.clip();
    ctx.strokeStyle = '#2a5fb8';
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.moveTo(-200, 395);
    ctx.lineTo(200, 395);
    ctx.moveTo(-200, 590);
    ctx.lineTo(200, 590);
    ctx.stroke();
    ctx.lineWidth = 6;
    for (let k = -3; k <= 3; k++) {
      ctx.beginPath();
      ctx.arc(k * 60, 500, 26, Math.PI, 0);
      ctx.arc(k * 60 + 30, 500, 4, Math.PI, 0, true);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(k * 60 + 30, 540, 18, Math.PI, 0);
      ctx.stroke();
    }
    ctx.restore();
    vasePath(ctx);
    ctx.strokeStyle = PAL.navy;
    ctx.lineWidth = 6;
    ctx.stroke();
    if (crack > 0) {
      ctx.strokeStyle = '#18213d';
      ctx.lineWidth = 5;
      ctx.beginPath();
      const pts = [[10, 320], [-14, 380], [22, 430], [-30, 490], [18, 540], [-8, 600], [12, 638]];
      const n = Math.max(1, Math.floor(pts.length * crack));
      ctx.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < n; i++) ctx.lineTo(pts[i][0], pts[i][1]);
      if (crack > 0.5) {
        ctx.moveTo(22, 430);
        ctx.lineTo(90, 470);
        ctx.moveTo(-30, 490);
        ctx.lineTo(-110, 520);
      }
      ctx.stroke();
    }
    ctx.restore();
  }

  function shardPos(s, age) {
    const g = 2400;
    const dropY = FLOOR - 12 - s.y;
    // time when the shard reaches the floor
    const th = (-s.vy + Math.sqrt(s.vy * s.vy + 2 * g * dropY)) / g;
    if (age < th) return [s.x + s.vx * age, s.y + s.vy * age + 0.5 * g * age * age, s.spin * age];
    const slide = (1 - Math.exp(-(age - th) * 6)) * s.vx * 0.12;
    return [s.x + s.vx * th + slide, FLOOR - 12, s.spin * th];
  }

  function bill(ctx, x, y, rot) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.fillStyle = '#eaf6dc';
    ctx.strokeStyle = '#5a8a3a';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.roundRect(-66, -32, 132, 64, 6);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#5a8a3a';
    ctx.font = `40px ${FONT_DISPLAY}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('¥', 0, 2);
    ctx.restore();
  }

  function potScene(ctx, t, lt) {
    fillBg(ctx, ['#203a7a', '#162a5e', '#0f1c46']);
    hexGrid(ctx, 80, 0, t * 4, 'rgba(127,220,255,0.06)', 2);
    ctx.fillStyle = vGradient(ctx, ['#2a3f74', '#16234a'], FLOOR, H);
    ctx.fillRect(0, FLOOR, W, H - FLOOR);
    // spotlight
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const sg = ctx.createLinearGradient(0, 0, 0, FLOOR);
    sg.addColorStop(0, 'rgba(255,245,200,0.35)');
    sg.addColorStop(1, 'rgba(255,245,200,0.05)');
    ctx.fillStyle = sg;
    ctx.beginPath();
    ctx.moveTo(900, 0);
    ctx.lineTo(1020, 0);
    ctx.lineTo(1260, FLOOR);
    ctx.lineTo(660, FLOOR);
    ctx.fill();
    ctx.restore();
    const gone = inv(141.1, 141.6, t);
    const ghost = (draw) => {
      if (gone >= 1) return;
      ctx.save();
      ctx.globalAlpha *= 1 - gone;
      draw();
      ctx.restore();
    };
    // pedestal
    ctx.fillStyle = '#e9f1ff';
    ctx.strokeStyle = PAL.navy;
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.roundRect(760, 640, 400, 40, 8);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#c8d8f0';
    ctx.beginPath();
    ctx.rect(810, 680, 300, FLOOR - 700);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#e9f1ff';
    ctx.beginPath();
    ctx.roundRect(740, FLOOR - 24, 440, 30, 8);
    ctx.fill();
    ctx.stroke();
    // rabbit ears peeking from behind the pedestal (the innocent bystander)
    const rk = inv(132, 132.5, t) * (1 - inv(134.6, 135, t));
    if (rk > 0) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, W, 640);
      ctx.rect(1160, 640, 400, 400);
      ctx.clip();
      const ry = lerp(820, 600, easeBack(rk));
      for (const s of [-1, 1]) {
        ctx.save();
        ctx.translate(1190 + s * 30, ry - 80);
        ctx.rotate(s * 0.25 + Math.sin(t * 8 + s) * 0.08);
        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = PAL.navy;
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.ellipse(0, -60, 26, 80, 0, 0, TAU);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#ffb3cf';
        ctx.beginPath();
        ctx.ellipse(0, -55, 12, 58, 0, 0, TAU);
        ctx.fill();
        ctx.restore();
      }
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = PAL.navy;
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(1190, ry, 70, 0, TAU);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = PAL.navy;
      ctx.beginPath();
      ctx.arc(1168, ry - 10, 7, 0, TAU);
      ctx.arc(1212, ry - 10, 7, 0, TAU);
      ctx.fill();
      ctx.restore();
      // whistling notes
      for (let i = 0; i < 3; i++) {
        const age = fract((t - 132.4) * 0.8 + i / 3);
        outlined(ctx, '♪', 1290 + age * 120, ry - 80 - age * 160, { size: 60, family: FONT_JP, fill: PAL.yellow, outer: null });
      }
    }
    // the vase, its crack and the shatter
    const crack = inv(SHATTER - 0.6, SHATTER - 0.1, t);
    if (t < SHATTER) {
      vase(ctx, t, crack);
      // price tag
      const tk = easeBack(inv(121.2, 121.8, t));
      if (tk > 0) {
        const sw = Math.sin(t * 2.2) * 0.12;
        ctx.save();
        ctx.translate(1010, 350);
        ctx.rotate(sw);
        ctx.strokeStyle = '#c48a2a';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(120, 70);
        ctx.stroke();
        ctx.translate(120, 70);
        ctx.rotate(0.2);
        ctx.scale(tk, 1);
        ctx.fillStyle = '#fff6d6';
        ctx.beginPath();
        ctx.roundRect(-10, -10, 290, 76, 10);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#c2272d';
        ctx.font = `34px ${FONT_DISPLAY}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('¥1,000,000', 135, 28);
        ctx.restore();
      }
      // floating coins
      for (let i = 0; i < 10; i++) {
        const age = fract((t - 121) * 0.35 + i / 10);
        const x = 960 + Math.sin(i * 2.3 + t) * 320;
        const y = 640 - age * 520;
        ctx.save();
        ctx.globalAlpha = Math.sin(age * Math.PI) * 0.9;
        ctx.translate(x, y);
        ctx.scale(Math.cos(t * 3 + i), 1);
        ctx.fillStyle = '#ffd34d';
        ctx.strokeStyle = '#b8860b';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(0, 0, 26, 0, TAU);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#b8860b';
        ctx.font = `28px ${FONT_DISPLAY}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('¥', 0, 2);
        ctx.restore();
      }
    } else {
      ghost(() => {
        for (const s of SHARDS) {
          const [x, y, r] = shardPos(s, t - SHATTER);
          ctx.save();
          ctx.translate(x, y);
          ctx.rotate(r);
          ctx.fillStyle = s.band ? '#2a5fb8' : '#eaf4ff';
          ctx.strokeStyle = PAL.navy;
          ctx.lineWidth = 3;
          ctx.beginPath();
          for (const [vx, vy] of s.verts) ctx.lineTo(vx, vy);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
          ctx.restore();
        }
      });
      const sk = inv(SHATTER, SHATTER + 1.2, t);
      if (sk < 1) {
        const jit = (1 - sk) * 14;
        ctx.save();
        ctx.globalAlpha = 1 - smooth(inv(0.75, 1, sk));
        outlined(ctx, 'ガシャーン!!', 960 + (rand(beatI(t), 141) - 0.5) * jit, 220, {
          size: 150 * easeBack(clamp(sk * 5)),
          family: FONT_DISPLAY,
          weight: 400,
          fill: PAL.yellow,
          stroke: PAL.red,
        });
        ctx.restore();
      }
    }
    // the doctor's bag pays compensation
    const bk = inv(127, 127.6, t);
    if (bk > 0) {
      ghost(() => {
        const x = lerp(-200, 470, easeOut(bk));
        ctx.save();
        ctx.translate(x, 760);
        ctx.fillStyle = '#2a2f45';
        ctx.strokeStyle = '#0b0f1e';
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.roundRect(-130, -110, 260, 150, 24);
        ctx.fill();
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(0, -110, 50, Math.PI, 0);
        ctx.stroke();
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(-14, -78, 28, 84);
        ctx.fillRect(-42, -50, 84, 28);
        ctx.fillStyle = PAL.red;
        ctx.fillRect(-9, -73, 18, 74);
        ctx.fillRect(-37, -45, 74, 18);
        ctx.restore();
        for (let i = 0; i < 8; i++) {
          const t0 = 129 + i * P;
          const age = t - t0;
          if (age < 0) continue;
          const k = clamp(age / 0.6);
          const x0 = 470;
          const x1 = 1300 + (i % 4) * 30;
          const y1 = FLOOR - 40 - i * 16;
          const xx = lerp(x0, x1, k);
          const yy = lerp(700, y1, k) - Math.sin(k * Math.PI) * 300;
          bill(ctx, xx, yy, (1 - k) * 6 + (i % 2 ? 0.05 : -0.05));
        }
      });
    }
    // calculator
    const ck = inv(135, 135.4, t);
    if (ck > 0) {
      ghost(() => {
        ctx.save();
        ctx.translate(960, lerp(-200, 170, easeBack(ck)));
        ctx.fillStyle = '#1b2440';
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 8;
        ctx.beginPath();
        ctx.roundRect(-300, -90, 600, 180, 26);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#b7f5c4';
        ctx.beginPath();
        ctx.roundRect(-270, -62, 540, 124, 12);
        ctx.fill();
        const settled = t >= 138;
        const val = settled ? '0' : commas(String(Math.floor(rand(Math.floor(t * 14), 151) * 9e6) + 1e6));
        ctx.fillStyle = '#123d22';
        ctx.font = `64px ${FONT_DISPLAY}`;
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        ctx.fillText('¥' + val, 250, 6);
        ctx.restore();
      });
    }
    stamp(ctx, 1480, 330, 150, '0円', inv(138, 138.35, t) * (1 - gone));
    const qk = inv(140, 140.3, t) * (1 - gone);
    if (qk > 0) outlined(ctx, '?', 1480, 130, { size: 140 * easeBack(qk), family: FONT_DISPLAY, weight: 400, fill: PAL.yellow });
    poof(ctx, 960, 560, inv(141, 142.1, t), 2.2);
    // nothing was ever there
    const ok = inv(141.5, 142, t);
    if (ok > 0) {
      ctx.save();
      ctx.globalAlpha = ok;
      ctx.translate(960, 0);
      vasePath(ctx);
      ctx.setLineDash([18, 14]);
      ctx.strokeStyle = 'rgba(233,249,255,0.9)';
      ctx.lineWidth = 6;
      ctx.stroke();
      ctx.restore();
      outlined(ctx, '?', 960, 480, { size: 150 * easeBack(ok), family: FONT_DISPLAY, weight: 400, fill: PAL.ice });
    }
  }

  // ----------------------------------------------------------------- cosmos

  const FORMULAS = ['E = mc²', '∫ f(x) dx', 'π = 3.14…', 'a² + b² = c²', 'Σ 1/n²', 'e^iπ + 1 = 0', '√2', '∞', '1 + 1 = ?', 'φ = 1.618…', 'x = ?', '9'];

  function cosmos(ctx, t, lt, sc) {
    fillBg(ctx, ['#050a26', '#120c45', '#1d0f52']);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const neb = [glowV, glowC, glowP, glowV, glowC, glowP];
    neb.forEach((img, i) => {
      const x = 960 + Math.cos(t * 0.05 + i * 1.1) * 600;
      const y = 450 + Math.sin(t * 0.07 + i * 1.7) * 280;
      drawSprite(ctx, img, x, y, 1000, 0, 0.22);
    });
    ctx.restore();
    // warp starfield
    const speed = 0.12 + inv(sc.start + 4, sc.start + 8, t) * 0.25;
    ctx.fillStyle = '#ffffff';
    for (let i = 0; i < 260; i++) {
      const a = rand(i, 161) * TAU;
      const z = fract(rand(i, 162) - t * speed);
      const d = (0.04 + rand(i, 163) * 0.4) / Math.max(0.03, z);
      const x = 960 + Math.cos(a) * d * 520;
      const y = 450 + Math.sin(a) * d * 520;
      if (x < -10 || x > W + 10 || y < -10 || y > H + 10) continue;
      ctx.globalAlpha = clamp((1 - z) * 1.4);
      const r = (1 - z) * 3.2 + 0.4;
      ctx.fillRect(x - r / 2, y - r / 2, r, r);
    }
    ctx.globalAlpha = 1;
    // formulas orbiting the crystal of truth
    const items = FORMULAS.map((f, i) => {
      const a = t * 0.35 + (i * TAU) / FORMULAS.length;
      return { f, i, a, depth: Math.sin(a) };
    }).sort((p, q) => p.depth - q.depth);
    const drawItem = ({ f, i, a, depth }) => {
      const s = 0.7 + 0.35 * depth;
      const x = 960 + Math.cos(a) * 720;
      const y = 430 + Math.sin(a) * 250 - Math.cos(a) * 60;
      ctx.save();
      ctx.globalAlpha = 0.35 + 0.65 * ((depth + 1) / 2);
      if (f === '9') nine(ctx, x, y, 50 * s, { bg: PAL.yellow, ring: PAL.pink, color: PAL.pink });
      else outlined(ctx, f, x, y, { size: 56 * s, family: FONT_JP, fill: i % 2 ? PAL.ice : '#ffffff', outer: null, stroke: '#2a1a6e' });
      ctx.restore();
    };
    items.filter((it) => it.depth < 0).forEach(drawItem);
    const reelK = inv(sc.start + 5, sc.start + 5.5, t);
    const crystalA = 1 - reelK * 0.75;
    drawSprite(ctx, glowW, 960, 430, 620 + pulse(t) * 120, 0, 0.5 * crystalA);
    drawSprite(ctx, flake, 960, 430, 420 * (1 + pulse(t) * 0.04), t * 0.4, crystalA);
    items.filter((it) => it.depth >= 0).forEach(drawItem);
    // the secret number: three reels
    if (reelK > 0) {
      const line = lyrics.lineAt(sc.end - 1.5);
      const toks = line && /^[\d\s]+$/.test(line.text) ? lyrics.tokenTimes(line) : [];
      const stops = toks.length === 3 ? toks : [
        { tok: '1', t: sc.end - 3 },
        { tok: '2', t: sc.end - 2.3 },
        { tok: '9', t: sc.end - 1.6 },
      ];
      ctx.save();
      ctx.translate(960, 430);
      ctx.scale(easeBack(reelK), easeBack(reelK));
      ctx.fillStyle = '#ffcf3a';
      ctx.strokeStyle = '#a4650a';
      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.roundRect(-380, -170, 760, 340, 34);
      ctx.fill();
      ctx.stroke();
      stops.forEach(({ tok, t: ts }, i) => {
        const d = +tok;
        const x = (i - 1) * 240;
        const left = ts - t;
        let pos;
        if (left <= 0) pos = d + Math.sin(-left * 30) * 0.12 * Math.exp(left * 8);
        else if (left < 0.5) pos = d - 20 * left * left;
        else pos = d - 5 - 20 * (left - 0.5);
        ctx.save();
        ctx.beginPath();
        ctx.roundRect(x - 100, -130, 200, 260, 16);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
        ctx.clip();
        ctx.font = `200px ${FONT_DISPLAY}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const base = Math.floor(pos);
        for (let k = -1; k <= 1; k++) {
          const digit = (((base + k) % 10) + 10) % 10;
          const y = (base + k - pos) * 230;
          ctx.fillStyle = left <= 0 && digit === 9 ? PAL.red : PAL.navy;
          ctx.fillText(String(digit), x, y + 10);
        }
        const sh = ctx.createLinearGradient(0, -130, 0, 130);
        sh.addColorStop(0, 'rgba(0,0,0,0.35)');
        sh.addColorStop(0.25, 'rgba(0,0,0,0)');
        sh.addColorStop(0.75, 'rgba(0,0,0,0)');
        sh.addColorStop(1, 'rgba(0,0,0,0.35)');
        ctx.fillStyle = sh;
        ctx.fillRect(x - 100, -130, 200, 260);
        ctx.restore();
        ctx.strokeStyle = '#a4650a';
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.roundRect(x - 100, -130, 200, 260, 16);
        ctx.stroke();
      });
      ctx.restore();
      const last = stops[stops.length - 1].t;
      const jk = inv(last, last + 0.8, t);
      if (jk > 0 && jk < 1) {
        for (let i = 0; i < 16; i++) {
          const a = (i / 16) * TAU;
          const d = easeOut(jk) * 520;
          sparkle(ctx, 960 + Math.cos(a) * d, 430 + Math.sin(a) * d * 0.7, 30 * (1 - jk) + 6, i % 2 ? PAL.yellow : '#fff');
        }
      }
    }
  }

  // ------------------------------------------------------------------ laugh

  function danmaku(ctx, t, from, until, rate, o = {}) {
    const n = Math.ceil((until - from) / rate);
    const lanes = o.lanes || 12;
    const y0 = o.y0 ?? 70;
    const dy = o.dy ?? 62;
    for (let i = 0; i < n; i++) {
      const spawn = from + i * rate;
      const age = t - spawn;
      if (age < 0) break;
      const text = COMMENTS[Math.floor(rand(i, 171) * COMMENTS.length)];
      const speed = 420 + rand(i, 172) * 380;
      const x = W + 40 - age * speed;
      if (x < -900) continue;
      const lane = Math.floor(rand(i, 173) * lanes);
      const size = 46 + Math.floor(rand(i, 174) * 3) * 10;
      const fill = rand(i, 175) < 0.2 ? PAL.yellow : rand(i, 176) < 0.2 ? '#ffb3d4' : '#ffffff';
      outlined(ctx, text, x, y0 + lane * dy, { size, family: FONT_JP, fill, outer: null, stroke: 'rgba(12,31,79,0.9)', align: 'left' });
    }
  }

  function bunny(ctx, x, y, t, i) {
    ctx.save();
    ctx.translate(x, y);
    ctx.lineJoin = 'round';
    for (const s of [-1, 1]) {
      ctx.save();
      ctx.translate(s * 32, -60);
      ctx.rotate(s * 0.22 + Math.sin(t * 9 + i + s) * 0.12);
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = PAL.navy;
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.ellipse(0, -70, 24, 78, 0, 0, TAU);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#ffb3cf';
      ctx.beginPath();
      ctx.ellipse(0, -66, 11, 56, 0, 0, TAU);
      ctx.fill();
      ctx.restore();
    }
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = PAL.navy;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.ellipse(0, 0, 82, 72, 0, 0, TAU);
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = PAL.navy;
    ctx.lineWidth = 6;
    ctx.lineCap = 'round';
    // smug half-closed eyes
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(s * 28 - 14, -12);
      ctx.lineTo(s * 28 + 14, -12);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(-9, 16, 9, 0, Math.PI);
    ctx.arc(9, 16, 9, 0, Math.PI);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,120,170,0.55)';
    ctx.beginPath();
    ctx.ellipse(-50, 14, 14, 9, 0, 0, TAU);
    ctx.ellipse(50, 14, 14, 9, 0, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  function angerMark(ctx, x, y, s) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s, s);
    ctx.strokeStyle = PAL.red;
    ctx.lineWidth = 14;
    ctx.lineCap = 'round';
    for (let k = 0; k < 4; k++) {
      ctx.save();
      ctx.rotate((k * Math.PI) / 2);
      ctx.beginPath();
      ctx.moveTo(14, -48);
      ctx.quadraticCurveTo(14, -14, 48, -14);
      ctx.stroke();
      ctx.restore();
    }
    ctx.restore();
  }

  function laugh(ctx, t, lt) {
    fillBg(ctx, ['#ffb3d9', '#ffd6a8', '#fff3b0']);
    ctx.save();
    ctx.rotate(-0.35);
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    const off = (t * 120) % 160;
    for (let x = -1200; x < 2600; x += 160) ctx.fillRect(x + off, -400, 70, 2200);
    ctx.restore();
    // whack-a-bunny
    const bk = inv(159, 159.3, t) * (1 - inv(163, 163.4, t));
    if (bk > 0) {
      const holes = [300, 630, 960, 1290, 1620];
      ctx.save();
      ctx.globalAlpha = bk;
      for (const hx of holes) {
        ctx.fillStyle = '#5a3d6e';
        ctx.beginPath();
        ctx.ellipse(hx, 760, 120, 34, 0, 0, TAU);
        ctx.fill();
      }
      const bi = beatI(t);
      for (let k = 0; k < 3; k++) {
        const b = bi - k;
        const hole = holes[(b * 3 + 1) % 5];
        const age = t - (feats.offset + b * P);
        const up = age < 0.15 ? easeOut(age / 0.15) : age < 0.55 ? 1 : 1 - clamp((age - 0.55) / 0.2);
        if (up <= 0) continue;
        ctx.save();
        ctx.beginPath();
        ctx.rect(hole - 200, 0, 400, 760);
        ctx.clip();
        bunny(ctx, hole, 760 + 60 - up * 190, t, b);
        ctx.restore();
      }
      ctx.restore();
      angerMark(ctx, 1500, 210, (0.8 + pulse(t) * 0.25) * bk);
    }
    // video player with the play counter
    const vk = inv(163, 163.5, t);
    if (vk > 0) {
      const glitch = t > 170 ? inv(170, 170.2, t) : 0;
      ctx.save();
      ctx.translate(0, lerp(900, 0, easeOut(vk)));
      ctx.fillStyle = '#14182b';
      ctx.beginPath();
      ctx.roundRect(360, 100, 1200, 650, 22);
      ctx.fill();
      const vg = ctx.createLinearGradient(380, 120, 1540, 680);
      vg.addColorStop(0, '#2fd0ff');
      vg.addColorStop(1, '#7a5cff');
      ctx.fillStyle = vg;
      ctx.fillRect(380, 120, 1160, 560);
      rays(ctx, 960, 400, 14, t * 0.6, '#ffffff', 0.12, 900);
      nine(ctx, 960, 400, 150 * (1 + pulse(t) * 0.06), { rot: Math.sin(t * 2) * 0.2 });
      // controls
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.moveTo(400, 692);
      ctx.lineTo(430, 712);
      ctx.lineTo(400, 732);
      ctx.fill();
      ctx.fillStyle = '#3b425e';
      ctx.fillRect(460, 708, 760, 8);
      ctx.fillStyle = PAL.pink;
      ctx.fillRect(460, 708, 760 * fract((t - 163) / 11), 8);
      ctx.restore();
      if (glitch > 0) {
        for (let i = 0; i < 9; i++) {
          const y = 100 + rand(i + Math.floor(t * 15) * 9, 181) * 650;
          const h = 10 + rand(i, 182) * 40;
          const dx = (rand(i + Math.floor(t * 15) * 9, 183) - 0.5) * 120;
          ctx.drawImage(ctx.canvas, 360, y, 1200, h, 360 + dx, y, 1200, h);
        }
      }
      const mk = inv(169.8, 170.2, t);
      if (mk > 0) {
        stamp(ctx, 1560, 200, 130, '100万', mk, { color: PAL.pink, size: 64 });
      }
      if (t > 170.3) outlined(ctx, '!?', 1640, 560, { size: 170 * easeBack(inv(170.3, 170.7, t)), family: FONT_DISPLAY, weight: 400, fill: PAL.pink });
    }
    danmaku(ctx, t, 154, 174, lt < 9 ? 0.16 : 0.12);
    if (vk > 0) {
      const views = Math.round(1e6 * easeIn(inv(163.5, 169.8, t)));
      const label = '▶ ' + commas(String(views));
      ctx.save();
      ctx.translate(0, lerp(900, 0, easeOut(vk)));
      ctx.fillStyle = 'rgba(12,31,79,0.92)';
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.roundRect(1120, 640, 470, 96, 48);
      ctx.fill();
      ctx.stroke();
      outlined(ctx, label, 1355, 690, { size: 52, family: FONT_DISPLAY, weight: 400, fill: t >= 169.8 ? PAL.yellow : '#ffffff', outer: null });
      ctx.restore();
    }
  }

  // ----------------------------------------------------------------- server

  function server(ctx, t, lt) {
    fillBg(ctx, ['#071028', '#0b1a40', '#0c1d48']);
    // perspective grid floor
    ctx.strokeStyle = 'rgba(127,220,255,0.35)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = -14; i <= 14; i++) {
      ctx.moveTo(960 + i * 30, 540);
      ctx.lineTo(960 + i * 260, H);
    }
    const sc = fract(t * 1.2);
    for (let k = 0; k < 14; k++) {
      const z = k + 1 - sc;
      const y = 540 + 540 / z;
      if (y > H) continue;
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
    }
    ctx.stroke();
    const p = pulse(t);
    const out = easeIn(inv(179.4, 180.2, t));
    if (out < 1) {
      ctx.save();
      ctx.translate(0, out * 900);
      for (let r = 0; r < 3; r++) {
        const x = 480 + r * 480;
        const shake = (rand(r, beatI(t)) - 0.5) * 8 * p;
        ctx.fillStyle = '#1b2440';
        ctx.strokeStyle = '#5fa8ff';
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.roundRect(x - 160 + shake, 150, 320, 560, 14);
        ctx.fill();
        ctx.stroke();
        for (let u = 0; u < 10; u++) {
          const uy = 175 + u * 52;
          ctx.fillStyle = '#26315a';
          ctx.fillRect(x - 140 + shake, uy, 280, 40);
          for (let l = 0; l < 6; l++) {
            const on = rand(r * 97 + u * 13 + l, Math.floor(t * 12)) > 0.45;
            const hot = rand(r * 97 + u * 13 + l, 191) < 0.25;
            ctx.fillStyle = on ? (hot ? PAL.red : l % 3 ? '#4dff9a' : PAL.yellow) : '#0d1328';
            ctx.beginPath();
            ctx.arc(x - 110 + shake + l * 26, uy + 20, 7, 0, TAU);
            ctx.fill();
          }
          ctx.fillStyle = '#0d1328';
          ctx.fillRect(x + 60 + shake, uy + 12, 70, 16);
        }
        // heat shimmer
        ctx.strokeStyle = 'rgba(255,120,90,0.6)';
        ctx.lineWidth = 6;
        for (let k = 0; k < 3; k++) {
          ctx.beginPath();
          for (let y = 0; y < 100; y += 6) {
            ctx.lineTo(x - 60 + k * 60 + Math.sin(y * 0.12 - t * 10 + k) * 10, 130 - y);
          }
          ctx.stroke();
        }
      }
      const blink = Math.floor(t * 4) % 2;
      outlined(ctx, 'SERVER LOAD 999%', 960, 90, { size: 56, family: FONT_DISPLAY, weight: 400, fill: blink ? PAL.red : '#ffb3b3', outer: null });
      drawMascot(ctx, 1750, 790, 190, t, { mood: 'shock', sweat: true, squash: p, wave: 1 });
      ctx.restore();
    }
    // the instrumental break: circular equaliser + loading bar
    const ek = easeOut(inv(179.8, 180.6, t));
    if (ek > 0) {
      const spec = feats.spectrum(t);
      const bass = feats.at('bass', t, 0.05);
      const n = feats.bands;
      const R = (200 + bass * 30) * ek;
      ctx.save();
      ctx.lineCap = 'round';
      ctx.lineWidth = 16;
      for (let i = 0; i < n * 2; i++) {
        const b = i < n ? i : 2 * n - 1 - i;
        const a = (i / (n * 2)) * TAU - Math.PI / 2 + t * 0.2;
        const len = (20 + spec[b] * 230) * ek;
        const k = b / (n - 1);
        ctx.strokeStyle = `hsl(${lerp(190, 330, k)}, 95%, ${lerp(65, 70, k)}%)`;
        ctx.beginPath();
        ctx.moveTo(960 + Math.cos(a) * R, 430 + Math.sin(a) * R);
        ctx.lineTo(960 + Math.cos(a) * (R + len), 430 + Math.sin(a) * (R + len));
        ctx.stroke();
      }
      ctx.setLineDash([20, 26]);
      ctx.lineWidth = 4;
      ctx.strokeStyle = 'rgba(127,220,255,0.6)';
      ctx.beginPath();
      ctx.arc(960, 430, 470 * ek, t * 0.5, t * 0.5 + TAU);
      ctx.stroke();
      ctx.restore();
      drawSprite(ctx, glowC, 960, 430, 520 * (1 + p * 0.2), 0, 0.6 * ek);
      nine(ctx, 960, 430, 150 * ek * (1 + p * 0.07), { rot: Math.sin(t * 1.5) * 0.15 });
      // loading bar
      const prog = inv(180.2, 186.6, t);
      ctx.save();
      ctx.globalAlpha = ek;
      ctx.strokeStyle = PAL.ice;
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.roundRect(460, 890, 1000, 50, 25);
      ctx.stroke();
      const lg = ctx.createLinearGradient(460, 0, 1460, 0);
      lg.addColorStop(0, PAL.ice);
      lg.addColorStop(1, PAL.pink);
      ctx.fillStyle = lg;
      ctx.beginPath();
      ctx.roundRect(468, 898, Math.max(34, 984 * prog), 34, 17);
      ctx.fill();
      const label = prog < 1 ? `LOADING PERFECT MODE … ${Math.floor(prog * 100)}%` : 'READY!';
      outlined(ctx, label, 960, 840, { size: 44, family: FONT_DISPLAY, weight: 400, fill: prog < 1 ? '#ffffff' : PAL.yellow, outer: null });
      ctx.restore();
    }
  }

  // -------------------------------------------------------------------- rap

  function book(ctx, s) {
    ctx.fillStyle = '#2f6ee0';
    ctx.strokeStyle = PAL.navy;
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(0, 50 * s);
    ctx.lineTo(-110 * s, 30 * s);
    ctx.lineTo(-110 * s, -60 * s);
    ctx.lineTo(0, -40 * s);
    ctx.lineTo(110 * s, -60 * s);
    ctx.lineTo(110 * s, 30 * s);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(0, 38 * s);
    ctx.lineTo(-96 * s, 20 * s);
    ctx.lineTo(-96 * s, -52 * s);
    ctx.lineTo(0, -32 * s);
    ctx.lineTo(96 * s, -52 * s);
    ctx.lineTo(96 * s, 20 * s);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#9cb7d8';
    ctx.lineWidth = 3;
    ctx.beginPath();
    for (let k = 0; k < 4; k++) {
      ctx.moveTo(-80 * s, (-30 + k * 14) * s);
      ctx.lineTo(-16 * s, (-18 + k * 14) * s);
      ctx.moveTo(16 * s, (-18 + k * 14) * s);
      ctx.lineTo(80 * s, (-30 + k * 14) * s);
    }
    ctx.stroke();
  }

  function bulb(ctx, s) {
    drawSprite(ctx, glowY, 0, -20 * s, 260 * s, 0, 0.8);
    ctx.fillStyle = '#fff3a0';
    ctx.strokeStyle = PAL.navy;
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(0, -30 * s, 62 * s, Math.PI * 0.8, Math.PI * 2.2);
    ctx.lineTo(26 * s, 40 * s);
    ctx.lineTo(-26 * s, 40 * s);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#9aa8c4';
    ctx.beginPath();
    ctx.roundRect(-28 * s, 40 * s, 56 * s, 34 * s, 8 * s);
    ctx.fill();
    ctx.stroke();
  }

  function bowl(ctx, s) {
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = PAL.navy;
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(0, -10 * s, 80 * s, Math.PI, 0);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#2f6ee0';
    ctx.beginPath();
    ctx.moveTo(-100 * s, -10 * s);
    ctx.lineTo(100 * s, -10 * s);
    ctx.quadraticCurveTo(90 * s, 80 * s, 0, 80 * s);
    ctx.quadraticCurveTo(-90 * s, 80 * s, -100 * s, -10 * s);
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(-40 * s, 30 * s, 12 * s, 0, TAU);
    ctx.moveTo(52 * s, 30 * s);
    ctx.arc(40 * s, 30 * s, 12 * s, 0, TAU);
    ctx.stroke();
    ctx.strokeStyle = '#a0672f';
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.moveTo(30 * s, -50 * s);
    ctx.lineTo(130 * s, -120 * s);
    ctx.moveTo(50 * s, -40 * s);
    ctx.lineTo(140 * s, -100 * s);
    ctx.stroke();
  }

  function crown(ctx, s) {
    ctx.fillStyle = '#ffcf3a';
    ctx.strokeStyle = '#a4650a';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(-100 * s, 50 * s);
    ctx.lineTo(-110 * s, -50 * s);
    ctx.lineTo(-50 * s, 0);
    ctx.lineTo(0, -70 * s);
    ctx.lineTo(50 * s, 0);
    ctx.lineTo(110 * s, -50 * s);
    ctx.lineTo(100 * s, 50 * s);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    for (const [x, c] of [
      [-60, PAL.pink],
      [0, PAL.ice],
      [60, PAL.pink],
    ]) {
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.arc(x * s, 25 * s, 13 * s, 0, TAU);
      ctx.fill();
      ctx.stroke();
    }
  }

  function rap(ctx, t, lt) {
    const b = feats.beat(t);
    const bi = Math.floor(b);
    const p = pulse(t);
    fillBg(ctx, bi % 2 ? ['#0b1a4a', '#13235e'] : ['#13235e', '#1b2f78']);
    hexGrid(ctx, 90, t * 30, t * 12, `rgba(127,220,255,${0.12 + 0.25 * p})`, 3);
    // speed stripes
    ctx.save();
    ctx.translate(960, 540);
    ctx.rotate(-0.35);
    for (let i = 0; i < 12; i++) {
      const y = (rand(i, 201) - 0.5) * 1400;
      const len = 300 + rand(i, 202) * 600;
      const x = ((rand(i, 203) * 3000 + t * (1500 + rand(i, 204) * 1500)) % 3000) - 1500;
      ctx.fillStyle = i % 3 ? 'rgba(127,220,255,0.18)' : 'rgba(255,95,162,0.22)';
      ctx.fillRect(x, y, len, 10 + rand(i, 205) * 18);
    }
    ctx.restore();
    // icons in the corners for each part of the verse
    let icon = book;
    if (t >= 192 && t < 198) icon = null;
    else if (t >= 198 && t < 203) icon = bowl;
    else if (t >= 203) icon = crown;
    const corners = [
      [230, 200],
      [1690, 200],
      [230, 720],
      [1690, 720],
    ];
    if (icon) {
      corners.forEach(([x, y], i) => {
        const use = icon === book && (bi + i) % 2 ? bulb : icon;
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(Math.sin(t * 3 + i) * 0.15);
        const s = 1 + (bi % 4 === i ? p * 0.35 : 0);
        ctx.scale(s, s);
        use(ctx, 1);
        ctx.restore();
      });
    } else {
      // a head of solid ice
      drawSprite(ctx, glowC, 960, 470, 900, 0, 0.5);
      drawSprite(ctx, flake, 960, 470, 760 * (1 + p * 0.05), t * 0.6, 0.45);
    }
    // "wisdom" particles converge on the centre
    if (t < 192) {
      for (let i = 0; i < 40; i++) {
        const k = fract(rand(i, 211) + t * 0.6);
        const a = rand(i, 212) * TAU;
        const d = (1 - easeIn(k)) * 1100;
        sparkle(ctx, 960 + Math.cos(a) * d, 470 + Math.sin(a) * d * 0.6, 14, i % 2 ? PAL.yellow : PAL.ice, k);
      }
    }
    // PERFECT
    const pk = inv(207.9, 208.25, t);
    if (pk > 0) {
      ctx.save();
      ctx.globalAlpha = 0.85;
      outlined(ctx, 'PERFECT', 960, 200, {
        size: 240 * lerp(1.6, 1, easeOut(pk)) * (1 + p * 0.04),
        family: FONT_DISPLAY,
        weight: 400,
        fill: PAL.yellow,
        stroke: PAL.pink,
        outer: '#ffffff',
      });
      ctx.restore();
    }
  }

  // ----------------------------------------------------------------- number

  function numberScene(ctx, t, lt) {
    radialBg(ctx, 960, 450, 1300, '#fff0a8', '#ff8a1a');
    rays(ctx, 960, 450, 24, t * 0.3, '#ffffff', 0.22);
    // digit rain
    ctx.font = `44px ${FONT_DISPLAY}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let c = 0; c < 36; c++) {
      const x = 30 + c * 54;
      const sp = 200 + rand(c, 221) * 300;
      const y0 = ((rand(c, 222) * 1600 + lt * sp) % 1600) - 400;
      for (let k = 0; k < 7; k++) {
        ctx.fillStyle = `rgba(255,255,255,${0.5 - k * 0.06})`;
        ctx.fillText(rand(c * 31 + k, 223) < 0.5 ? '0' : '9', x, y0 - k * 52);
      }
    }
    const steps = clamp(Math.floor((t - 209.2) / P) + 1, 0, 14);
    const digits = '1' + '0'.repeat(steps * 3);
    const shown = commas(digits);
    const groups = shown.split(',');
    const rows = [];
    for (let i = 0; i < groups.length; i += 4) rows.push(groups.slice(i, i + 4).join(',') + (i + 4 < groups.length ? ',' : ''));
    const widest = rows.reduce((a, r) => (r.length > a.length ? r : a), '');
    const size = Math.min(170, Math.floor(420 / Math.max(1, rows.length)), fitFont(ctx, widest, 170, FONT_DISPLAY, 400, 1500));
    const p = pulse(t);
    rows.forEach((row, i) => {
      outlined(ctx, row, 960, 470 + (i - (rows.length - 1) / 2) * size * 1.1, {
        size: size * (1 + p * 0.05),
        family: FONT_DISPLAY,
        weight: 400,
        fill: '#ffffff',
        stroke: '#c2272d',
        outer: PAL.yellow,
      });
    });
    stamp(ctx, 1700, 150, 115, '9点', inv(212.3, 212.6, t), { rot: 0.2 });
  }

  // ------------------------------------------------------------------ outro

  function outro(ctx, t, lt) {
    classroom(ctx, t);
    // the test paper
    ctx.save();
    ctx.translate(620, 380);
    ctx.rotate(-0.06);
    const pk = easeBack(inv(269.2, 269.8, t));
    ctx.scale(pk, pk);
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#9cb7d8';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.roundRect(-230, -270, 460, 540, 10);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = PAL.navy;
    ctx.font = `900 40px ${FONT_JP}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('さんすう テスト', -200, -215);
    ctx.fillRect(-200, -185, 400, 4);
    ctx.font = `700 40px ${FONT_JP}`;
    ['1 + 1 = 9', '2 + 3 = 9', '4 × 2 = 9', '10 − 1 = 9'].forEach((q, i) => {
      ctx.fillStyle = PAL.navy;
      ctx.fillText(q, -200, -130 + i * 66);
      ctx.strokeStyle = 'rgba(255,59,79,0.9)';
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.arc(150, -130 + i * 66, 24, 0, TAU);
      ctx.stroke();
    });
    // score with a "hanamaru" flower circle
    const sk = inv(270.2, 271.2, t);
    if (sk > 0) {
      ctx.strokeStyle = PAL.red;
      ctx.lineWidth = 7;
      ctx.beginPath();
      for (let i = 0; i <= 120 * sk; i++) {
        const a = (i / 120) * TAU * 3;
        const r = 40 + i * 0.5 + Math.sin(a * 6) * 8;
        ctx.lineTo(90 + Math.cos(a) * r * 0.85, 170 + Math.sin(a) * r * 0.7);
      }
      ctx.stroke();
      ctx.fillStyle = PAL.red;
      ctx.font = `110px ${FONT_DISPLAY}`;
      ctx.textAlign = 'center';
      ctx.globalAlpha = clamp(sk * 2);
      ctx.fillText('9', 90, 175);
    }
    ctx.restore();
    // closing words on the board
    const title = meta.title || '';
    const ts = fitFont(ctx, title, 64, FONT_JP, 900, 760);
    reveal(ctx, inv(269.6, 271.4, t), 900, 1640, () => {
      chalk(ctx, title, 1270, 180, ts, { weight: 900 });
    });
    reveal(ctx, inv(271.4, 272.4, t), 1000, 1560, () => chalk(ctx, 'おしまい', 1270, 330, 120, { weight: 900, color: PAL.yellow }));
    const sub = [meta.artist, ...meta.credits].filter(Boolean).join('　/　');
    if (sub) {
      ctx.save();
      ctx.globalAlpha = inv(272.4, 273.2, t);
      chalk(ctx, sub, 1270, 470, fitFont(ctx, sub, 36, FONT_JP, 700, 700), { color: 'rgba(200,240,255,0.95)' });
      ctx.restore();
    }
    const b = feats.beat(Math.min(t, 270));
    drawMascot(ctx, 1580, 700 - Math.abs(Math.sin(b * Math.PI)) * 30, 260, t, { mood: 'happy', wave: 1, squash: t < 270 ? pulse(t) : 0 });
    snow(ctx, t, { n: 40, alpha: 0.6 });
    const fade = inv(276.0, 278.4, t);
    if (fade > 0) {
      ctx.fillStyle = `rgba(0,0,0,${fade})`;
      ctx.fillRect(0, 0, W, H);
    }
  }

  // --------------------------------------------------------------- timeline

  const DRAW = {
    intro,
    sparkle: sparkleScene,
    baka,
    bus: busScene,
    stage,
    clock: clockScene,
    pot: potScene,
    cosmos,
    laugh,
    server,
    rap,
    number: numberScene,
    outro,
  };

  const CAMERA = {
    baka(t) {
      const p = pulse(t);
      return { z: 1.02 + p * 0.03, r: Math.sin(t * 1.3) * 0.012 };
    },
    rap(t) {
      const p = pulse(t);
      const bi = beatI(t);
      return { z: 1.03 + p * 0.03, x: (rand(bi, 231) - 0.5) * 18 * p, y: (rand(bi, 232) - 0.5) * 18 * p };
    },
    number(t) {
      return { z: 1.02 + pulse(t) * 0.025 };
    },
  };

  const list = TIMELINE.map(([name, start, end, opts = {}]) => ({
    name,
    start,
    end,
    ...opts,
    draw: DRAW[name],
    camera: CAMERA[name],
    lyrics: LYRIC_MODE[name] || 'bottom',
    tokens: name !== 'cosmos',
  }));

  // extra white flashes on big moments
  const FLASHES = [SHATTER, POOF, 208.0, 212.3];

  return {
    list,
    at(t) {
      for (let i = list.length - 1; i >= 0; i--) if (t >= list[i].start) return list[i];
      return list[0];
    },
    /** drawn after the scene, before the lyrics */
    finish(ctx) {
      ctx.drawImage(vignette, 0, 0);
    },
    /** drawn on top of everything */
    overlay(ctx, t, sc) {
      let a = 0;
      if (sc.start > 0) a = Math.max(a, 0.7 * Math.exp(-(t - sc.start) * 7));
      for (const f of FLASHES) if (t >= f && t < f + 0.6) a = Math.max(a, 0.6 * Math.exp(-(t - f) * 8));
      if (a > 0.01) {
        ctx.fillStyle = `rgba(255,255,255,${a})`;
        ctx.fillRect(0, 0, W, H);
      }
    },
  };
}

function makeVignette() {
  const c = makeCanvas(W, H);
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(W / 2, H / 2, 560, W / 2, H / 2, 1250);
  gr.addColorStop(0, 'rgba(5,10,35,0)');
  gr.addColorStop(1, 'rgba(5,10,35,0.45)');
  g.fillStyle = gr;
  g.fillRect(0, 0, W, H);
  return c;
}
