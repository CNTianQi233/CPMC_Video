// Ties lyrics, audio features and scenes together into render(ctx, t).

import { parseLRC } from './lrc.js';
import { loadFeatures } from './features.js';
import { createLyrics } from './lyrics.js';
import { createScenes } from './scenes.js';
import { W, H, FONT_JP, FONT_CN, FONT_DISPLAY } from './gfx.js';

export { W, H };

export async function loadMV({ base = './assets/', lyricOffset = 0 } = {}) {
  const [lrcText, analysis] = await Promise.all([
    fetch(base + 'lyrics.lrc').then((r) => r.text()),
    fetch(base + 'analysis.json').then((r) => r.json()),
  ]);
  const portrait = await loadImage(base + 'character.png');
  const mv = createMV(lrcText, analysis, { lyricOffset, portrait });
  await loadFonts(mv);
  return mv;
}

/** Optional user-supplied illustration; resolves to null when absent. */
function loadImage(url) {
  if (typeof Image === 'undefined') return Promise.resolve(null);
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img.naturalWidth ? img : null);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

async function loadFonts(mv) {
  if (typeof document === 'undefined' || !document.fonts) return;
  const jp = mv.lines.map((l) => l.text).join('') + (mv.meta.title || '') + (mv.meta.artist || '') + mv.meta.credits.join('');
  const cn = mv.lines.map((l) => l.trans).join('');
  await Promise.all([
    document.fonts.load(`900 64px ${FONT_JP}`, jp),
    document.fonts.load(`700 64px ${FONT_JP}`, jp),
    document.fonts.load(`400 64px ${FONT_CN}`, cn || '中'),
    document.fonts.load(`400 64px ${FONT_DISPLAY}`, '0123456789PERFECT'),
  ]).catch(() => {});
}

export function createMV(lrcText, analysis, { lyricOffset = 0, portrait = null } = {}) {
  const { meta, lines } = parseLRC(lrcText);
  const feats = loadFeatures(analysis);
  const lyrics = createLyrics(lines, feats);
  const scenes = createScenes({ feats, lyrics, meta, portrait });

  function render(ctx, t) {
    const sc = scenes.at(t);
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    const cam = sc.camera && sc.camera(t, sc);
    if (cam) {
      ctx.translate(W / 2 + (cam.x || 0), H / 2 + (cam.y || 0));
      if (cam.r) ctx.rotate(cam.r);
      ctx.scale(cam.z || 1, cam.z || 1);
      ctx.translate(-W / 2, -H / 2);
    }
    sc.draw(ctx, t, t - sc.start, sc);
    ctx.restore();

    ctx.save();
    scenes.spells(ctx, t);
    scenes.finish(ctx);
    lyrics.draw(ctx, t + lyricOffset, sc.lyrics, { tokens: sc.tokens, cx: sc.lyricCx, maxW: sc.lyricMaxW });
    scenes.overlay(ctx, t, sc);
    ctx.restore();
  }

  return { meta, lines, feats, duration: feats.duration, render, scenes };
}
