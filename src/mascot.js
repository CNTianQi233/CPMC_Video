// "キューブ先生" — the MV's original mascot: a little ice cube in a
// mortarboard who teaches (very confident) arithmetic.

import { PAL, TAU, clamp } from './gfx.js';

/**
 * @param o.mood   'normal' | 'happy' | 'spiral' | 'shock' | 'sleepy'
 * @param o.squash beat pulse 0..1 for squash & stretch
 * @param o.pointer draw the teacher's pointer stick
 * @param o.wave   0..1 waving arm amount
 */
export function drawMascot(ctx, x, y, s, t, o = {}) {
  const mood = o.mood || 'normal';
  const sq = clamp(o.squash || 0);
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(o.tilt || 0);
  ctx.scale(1 + sq * 0.07, 1 - sq * 0.07);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  const lw = s * 0.035;

  // shadow
  ctx.fillStyle = 'rgba(10,30,80,0.25)';
  ctx.beginPath();
  ctx.ellipse(0, s * 0.52, s * 0.45, s * 0.07, 0, 0, TAU);
  ctx.fill();

  // feet
  ctx.fillStyle = '#5fb9ef';
  ctx.strokeStyle = PAL.deep;
  ctx.lineWidth = lw;
  for (const sx of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(sx * s * 0.2, s * 0.47, s * 0.11, s * 0.065, 0, 0, TAU);
    ctx.fill();
    ctx.stroke();
  }

  // arms
  const wave = o.wave || 0;
  ctx.strokeStyle = PAL.deep;
  ctx.lineWidth = s * 0.045;
  const armL = -0.5 - wave * (1.6 + Math.sin(t * 12) * 0.35);
  const armR = o.pointer ? -0.9 + Math.sin(t * 4) * 0.12 : 0.5;
  const arms = [
    [-1, armL],
    [1, armR],
  ];
  for (const [sx, a] of arms) {
    const bx = sx * s * 0.47;
    const by = s * 0.08;
    const ex = bx + sx * Math.cos(a) * s * 0.22;
    const ey = by + Math.sin(a) * s * 0.22 * (sx < 0 ? 1 : 1);
    ctx.beginPath();
    ctx.moveTo(bx, by);
    ctx.lineTo(ex, ey);
    ctx.stroke();
    ctx.fillStyle = PAL.frost;
    ctx.beginPath();
    ctx.arc(ex, ey, s * 0.055, 0, TAU);
    ctx.fill();
    ctx.lineWidth = lw * 0.8;
    ctx.stroke();
    ctx.lineWidth = s * 0.045;
    if (sx > 0 && o.pointer) {
      ctx.save();
      ctx.strokeStyle = '#a0672f';
      ctx.lineWidth = s * 0.03;
      ctx.beginPath();
      ctx.moveTo(ex, ey);
      ctx.lineTo(ex + Math.cos(a - 0.5) * s * 0.55, ey + Math.sin(a - 0.5) * s * 0.55);
      ctx.stroke();
      ctx.fillStyle = PAL.red;
      ctx.beginPath();
      ctx.arc(ex + Math.cos(a - 0.5) * s * 0.55, ey + Math.sin(a - 0.5) * s * 0.55, s * 0.025, 0, TAU);
      ctx.fill();
      ctx.restore();
    }
  }

  // body: rounded ice cube
  const bw = s;
  const bh = s * 0.9;
  const g = ctx.createLinearGradient(-bw / 2, -bh / 2, bw / 2, bh / 2);
  g.addColorStop(0, '#f2fcff');
  g.addColorStop(0.45, '#b9e8ff');
  g.addColorStop(1, '#6cc2f2');
  ctx.fillStyle = g;
  ctx.strokeStyle = PAL.deep;
  ctx.lineWidth = lw;
  ctx.beginPath();
  ctx.roundRect(-bw / 2, -bh / 2, bw, bh, s * 0.2);
  ctx.fill();
  ctx.stroke();
  // facets / shine
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.beginPath();
  ctx.moveTo(-bw * 0.38, -bh * 0.36);
  ctx.lineTo(-bw * 0.16, -bh * 0.36);
  ctx.lineTo(-bw * 0.38, -bh * 0.08);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.beginPath();
  ctx.roundRect(bw * 0.24, bh * 0.08, bw * 0.08, bh * 0.26, s * 0.04);
  ctx.fill();
  ctx.strokeStyle = 'rgba(31,95,209,0.25)';
  ctx.lineWidth = lw * 0.6;
  ctx.beginPath();
  ctx.moveTo(bw * 0.2, -bh * 0.42);
  ctx.lineTo(bw * 0.4, -bh * 0.22);
  ctx.stroke();

  // cheeks
  ctx.fillStyle = 'rgba(255,120,170,0.55)';
  for (const sx of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(sx * s * 0.3, s * 0.12, s * 0.075, s * 0.045, 0, 0, TAU);
    ctx.fill();
  }

  // eyes
  const ey = -s * 0.02;
  ctx.strokeStyle = '#18213d';
  ctx.fillStyle = '#18213d';
  ctx.lineWidth = s * 0.03;
  for (const sx of [-1, 1]) {
    const ex = sx * s * 0.19 + (o.lookX || 0) * s * 0.03;
    if (mood === 'happy') {
      ctx.beginPath();
      ctx.arc(ex, ey + s * 0.03, s * 0.065, Math.PI * 1.15, Math.PI * 1.85);
      ctx.stroke();
    } else if (mood === 'sleepy') {
      ctx.beginPath();
      ctx.moveTo(ex - s * 0.06, ey);
      ctx.quadraticCurveTo(ex, ey + s * 0.04, ex + s * 0.06, ey);
      ctx.stroke();
    } else if (mood === 'spiral') {
      ctx.lineWidth = s * 0.018;
      ctx.beginPath();
      const rot = t * 9 * sx;
      for (let k = 0; k <= 40; k++) {
        const a = rot + (k / 40) * TAU * 2.4;
        const r = (k / 40) * s * 0.085;
        ctx.lineTo(ex + Math.cos(a) * r, ey + Math.sin(a) * r);
      }
      ctx.stroke();
      ctx.lineWidth = s * 0.03;
    } else if (mood === 'shock') {
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(ex, ey, s * 0.08, 0, TAU);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#18213d';
      ctx.beginPath();
      ctx.arc(ex, ey, s * 0.025, 0, TAU);
      ctx.fill();
    } else {
      ctx.beginPath();
      ctx.ellipse(ex, ey, s * 0.06, s * 0.08, 0, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(ex - s * 0.02, ey - s * 0.03, s * 0.022, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#18213d';
    }
  }

  // mouth
  ctx.strokeStyle = '#18213d';
  ctx.lineWidth = s * 0.025;
  ctx.beginPath();
  if (mood === 'shock') {
    ctx.fillStyle = '#7a2340';
    ctx.ellipse(0, s * 0.16, s * 0.05, s * 0.065, 0, 0, TAU);
    ctx.fill();
    ctx.stroke();
  } else if (mood === 'happy' || o.open) {
    ctx.fillStyle = '#7a2340';
    ctx.moveTo(-s * 0.08, s * 0.12);
    ctx.quadraticCurveTo(0, s * 0.26, s * 0.08, s * 0.12);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else {
    ctx.moveTo(-s * 0.06, s * 0.13);
    ctx.quadraticCurveTo(-s * 0.03, s * 0.17, 0, s * 0.13);
    ctx.quadraticCurveTo(s * 0.03, s * 0.17, s * 0.06, s * 0.13);
    ctx.stroke();
  }

  // sweat drop
  if (o.sweat) {
    ctx.fillStyle = '#9fe3ff';
    ctx.strokeStyle = PAL.deep;
    ctx.lineWidth = lw * 0.6;
    const dy = (t * 1.5) % 1;
    ctx.beginPath();
    const sx = s * 0.52;
    const sy = -s * 0.25 + dy * s * 0.15;
    ctx.moveTo(sx, sy - s * 0.09);
    ctx.quadraticCurveTo(sx + s * 0.06, sy + s * 0.02, sx, sy + s * 0.04);
    ctx.quadraticCurveTo(sx - s * 0.06, sy + s * 0.02, sx, sy - s * 0.09);
    ctx.fill();
    ctx.stroke();
  }

  // mortarboard
  ctx.save();
  ctx.translate(0, -bh / 2 - s * 0.02);
  ctx.rotate(-0.12);
  ctx.fillStyle = '#1b2a55';
  ctx.strokeStyle = '#0b1530';
  ctx.lineWidth = lw * 0.7;
  ctx.beginPath();
  ctx.roundRect(-s * 0.22, -s * 0.06, s * 0.44, s * 0.12, s * 0.03);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(-s * 0.48, -s * 0.1);
  ctx.lineTo(0, -s * 0.25);
  ctx.lineTo(s * 0.48, -s * 0.1);
  ctx.lineTo(0, s * 0.03);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  const sw = Math.sin(t * 5) * 0.25 + (o.squash || 0) * 0.4;
  ctx.strokeStyle = PAL.yellow;
  ctx.lineWidth = s * 0.022;
  ctx.beginPath();
  ctx.moveTo(0, -s * 0.12);
  ctx.lineTo(s * 0.3, -s * 0.1);
  const tx = s * 0.3 + Math.sin(sw) * s * 0.18;
  const ty = -s * 0.1 + Math.cos(sw) * s * 0.18;
  ctx.lineTo(tx, ty);
  ctx.stroke();
  ctx.fillStyle = PAL.yellow;
  ctx.beginPath();
  ctx.ellipse(tx, ty + s * 0.03, s * 0.03, s * 0.05, -sw, 0, TAU);
  ctx.fill();
  ctx.restore();

  ctx.restore();
}
