// Lyric renderer. Lines come from the LRC file at runtime; this module only
// decides how a line looks (karaoke wipe, pop-in, big chant mode, ...).

import { W, H, PAL, FONT_JP, FONT_CN, FONT_DISPLAY, clamp, inv, easeBack, easeOut, fract, rand, nine } from './gfx.js';

const SPACE = 0.45; // width of a phrase gap, in em

export function createLyrics(lines, feats) {
  const cache = new Map();

  function layout(ctx, text, size, family, weight) {
    const key = `${weight}|${size}|${family}|${text}`;
    let l = cache.get(key);
    if (l) return l;
    ctx.font = `${weight} ${size}px ${family}`;
    const chars = [...text];
    const widths = chars.map((c) => (c === ' ' ? size * SPACE : ctx.measureText(c).width));
    const total = widths.reduce((a, b) => a + b, 0);
    l = { chars, widths, total, size, family, weight };
    cache.set(key, l);
    return l;
  }

  function fit(ctx, text, size, family, weight, maxW) {
    const l = layout(ctx, text, size, family, weight);
    if (l.total <= maxW) return l;
    return layout(ctx, text, Math.floor((size * maxW) / l.total), family, weight);
  }

  function lineAt(t) {
    let lo = 0;
    let hi = lines.length - 1;
    let found = -1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (lines[mid].start <= t) {
        found = mid;
        lo = mid + 1;
      } else hi = mid - 1;
    }
    if (found < 0) return null;
    const l = lines[found];
    return t < l.end ? l : null;
  }

  /**
   * Draws characters of a laid-out line in four passes (outer outline, inner
   * outline, fill, karaoke highlight) so outlines never cover neighbours.
   * `fx(i)` returns per-character {dx, dy, s, r, a}.
   */
  function drawChars(ctx, l, cx, cy, fx, o) {
    const x0 = cx - l.total / 2;
    const xs = [];
    let x = x0;
    for (let i = 0; i < l.chars.length; i++) {
      xs.push(x + l.widths[i] / 2);
      x += l.widths[i];
    }
    const size = l.size;
    ctx.font = `${l.weight} ${size}px ${l.family}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    const fxs = l.chars.map((_, i) => fx(i));

    const pass = (fn) => {
      for (let i = 0; i < l.chars.length; i++) {
        const c = l.chars[i];
        const f = fxs[i];
        if (c === ' ' || f.a <= 0) continue;
        ctx.save();
        ctx.globalAlpha *= f.a;
        ctx.translate(xs[i] + (f.dx || 0), cy + (f.dy || 0));
        if (f.r) ctx.rotate(f.r);
        if (f.s !== 1) ctx.scale(f.s, f.s);
        fn(c);
        ctx.restore();
      }
    };

    if (o.shadow) {
      ctx.strokeStyle = o.shadow;
      ctx.fillStyle = o.shadow;
      ctx.lineWidth = size * 0.34;
      pass((c) => {
        ctx.translate(size * 0.06, size * 0.08);
        ctx.strokeText(c, 0, 0);
      });
    }
    ctx.strokeStyle = o.outer || PAL.frost;
    ctx.lineWidth = size * 0.3;
    pass((c) => ctx.strokeText(c, 0, 0));
    ctx.strokeStyle = o.stroke || PAL.navy;
    ctx.lineWidth = size * 0.15;
    pass((c) => ctx.strokeText(c, 0, 0));

    const base = ctx.createLinearGradient(0, -size / 2, 0, size / 2);
    base.addColorStop(0, '#ffffff');
    base.addColorStop(1, o.baseBottom || '#d6f1ff');
    ctx.fillStyle = base;
    pass((c) => ctx.fillText(c, 0, 0));

    if (o.wipe > 0) {
      const hi = ctx.createLinearGradient(0, -size / 2, 0, size / 2);
      hi.addColorStop(0, o.hiTop || '#fff8c2');
      hi.addColorStop(1, o.hiBottom || '#ffc23c');
      ctx.save();
      ctx.beginPath();
      ctx.rect(x0 - size, cy - size * 2, size + l.total * o.wipe, size * 4);
      ctx.clip();
      ctx.fillStyle = hi;
      pass((c) => ctx.fillText(c, 0, 0));
      ctx.restore();
    }
  }

  function drawTrans(ctx, line, t, x, y, size, maxW, alpha) {
    if (!line.trans || alpha <= 0) return;
    const l = fit(ctx, line.trans, size, FONT_CN, 400, maxW);
    ctx.save();
    ctx.globalAlpha *= alpha;
    ctx.font = `400 ${l.size}px ${FONT_CN}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = PAL.navy;
    ctx.lineWidth = l.size * 0.22;
    ctx.strokeText(line.trans, x, y);
    ctx.fillStyle = '#fff3a6';
    ctx.fillText(line.trans, x, y);
    ctx.restore();
  }

  const isTokens = (text) => /^[\d\s]+$/.test(text) && /\s/.test(text.trim());

  function drawBottom(ctx, line, t) {
    const lt = t - line.start;
    const dur = line.end - line.start;
    const out = inv(line.end - 0.14, line.end, t);
    const l = fit(ctx, line.text, 74, FONT_JP, 900, 1720);
    const wipe = clamp(lt / Math.max(0.5, dur * 0.85));
    ctx.save();
    ctx.globalAlpha *= 1 - out;
    drawChars(
      ctx,
      l,
      W / 2,
      930,
      (i) => {
        const k = clamp((lt - i * 0.022) / 0.22);
        return { dy: (1 - easeBack(k)) * 26 - out * 10, s: 0.6 + 0.4 * easeBack(k), a: clamp(k * 3) };
      },
      { wipe },
    );
    drawTrans(ctx, line, t, W / 2, 1014, 46, 1720, clamp((lt - 0.08) / 0.25));
    ctx.restore();
  }

  function drawBig(ctx, line, t, rap, cx = W / 2, maxW = 1760) {
    const lt = t - line.start;
    const dur = line.end - line.start;
    const out = inv(line.end - 0.12, line.end, t);
    const l = fit(ctx, line.text, rap ? 170 : 190, FONT_JP, 900, maxW);
    const n = l.chars.length;
    const stagger = rap ? Math.min(0.06, (dur * 0.45) / n) : 0.035;
    const beat = feats.beat(t);
    const pulse = Math.exp(-6 * fract(beat));
    const shake = rap ? pulse * 10 : 0;
    const sx = (rand(Math.floor(beat), 3) - 0.5) * shake;
    const sy = (rand(Math.floor(beat), 4) - 0.5) * shake;
    const wipe = clamp(lt / Math.max(0.5, dur * 0.85));
    const cy = rap ? 470 : 450;
    ctx.save();
    ctx.globalAlpha *= 1 - out;
    drawChars(
      ctx,
      l,
      cx + sx,
      cy + sy,
      (i) => {
        const k = clamp((lt - i * stagger) / (rap ? 0.12 : 0.24));
        if (rap) {
          return { s: 1 + (1 - easeOut(k)) * 1.3 + out * 0.3, a: clamp(k * 2), r: (1 - k) * (rand(i, 5) - 0.5) * 0.8 };
        }
        const wave = Math.exp(-5 * fract(beat - i * 0.07)) * l.size * 0.14;
        return { dy: -wave + (1 - easeBack(k)) * 60, s: (0.4 + 0.6 * easeBack(k)) * (1 + out * 0.4), a: clamp(k * 3) };
      },
      { wipe, shadow: rap ? 'rgba(255,60,140,0.85)' : 'rgba(12,31,79,0.55)', hiTop: '#ffffff', hiBottom: '#7ff3ff' },
    );
    drawTrans(ctx, line, t, cx, cy + l.size * 0.5 + 72, 62, maxW - 60, clamp((lt - 0.1) / 0.25));
    ctx.restore();
  }

  /** Space-separated digits ("1 2 9"): count them out one beat-pair at a time. */
  function tokenTimes(line) {
    const toks = line.text.trim().split(/\s+/);
    const t0 = feats.snap(line.start);
    return toks.map((tok, i) => ({ tok, t: t0 + i * 2 * feats.period }));
  }

  function drawTokens(ctx, line, t) {
    const items = tokenTimes(line);
    const out = inv(line.end - 0.15, line.end, t);
    const n = items.length;
    const beat = feats.beat(t);
    ctx.save();
    ctx.globalAlpha *= 1 - out;
    items.forEach(({ tok, t: tt }, i) => {
      const k = clamp((t - tt) / 0.28);
      if (k <= 0) return;
      const x = W / 2 + (i - (n - 1) / 2) * 400;
      const bounce = t > items[n - 1].t + 0.3 ? Math.exp(-6 * fract(beat + i * 0.25)) * 30 : 0;
      const s = easeBack(k);
      ctx.save();
      ctx.translate(x, 430 - bounce);
      ctx.scale(s, s);
      ctx.rotate((1 - k) * 0.6 * (i % 2 ? 1 : -1));
      if (tok === '9') {
        nine(ctx, 0, 0, 170, { bg: PAL.yellow, ring: PAL.red, color: PAL.red });
      } else {
        ctx.font = `320px ${FONT_DISPLAY}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.lineJoin = 'round';
        ctx.strokeStyle = PAL.frost;
        ctx.lineWidth = 56;
        ctx.strokeText(tok, 0, 10);
        ctx.strokeStyle = PAL.navy;
        ctx.lineWidth = 26;
        ctx.strokeText(tok, 0, 10);
        ctx.fillStyle = i % 2 ? PAL.pink : PAL.ice;
        ctx.fillText(tok, 0, 10);
      }
      ctx.restore();
    });
    ctx.restore();
  }

  function backdrop(ctx, alpha) {
    if (alpha <= 0) return;
    const g = ctx.createLinearGradient(0, 820, 0, H);
    g.addColorStop(0, 'rgba(8,20,56,0)');
    g.addColorStop(0.45, `rgba(8,20,56,${0.42 * alpha})`);
    g.addColorStop(1, `rgba(8,20,56,${0.62 * alpha})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 820, W, H - 820);
  }

  return {
    lineAt,
    tokenTimes,
    /** mode: 'bottom' | 'big' | 'rap' | 'none'; tokens: allow the digit count-out */
    draw(ctx, t, mode, { tokens = true, cx, maxW } = {}) {
      if (mode === 'none') return;
      const line = lineAt(t);
      if (mode === 'bottom') {
        // keep the backdrop steady across short gaps between lines
        const near = line || lineAt(t - 0.4) || lineAt(t + 0.4);
        backdrop(ctx, near ? 1 : 0);
      }
      if (!line) return;
      if (tokens && isTokens(line.text)) return drawTokens(ctx, line, t);
      if (mode === 'big' || mode === 'rap') return drawBig(ctx, line, t, mode === 'rap', cx, maxW);
      drawBottom(ctx, line, t);
    },
  };
}
