// Browser player: plays the song and draws the MV in sync.
// URL options: ?t=SECONDS (start position), ?offset=SECONDS (lyric timing),
// ?render=1 (headless mode used by tools/render.mjs).

import { loadMV } from './mv.js';

const params = new URLSearchParams(location.search);
const canvas = document.getElementById('mv');
const ctx = canvas.getContext('2d');

const mvPromise = loadMV({ lyricOffset: parseFloat(params.get('offset')) || 0 });

if (params.has('render')) {
  document.body.classList.add('render');
  window.MV = {
    ready: mvPromise.then((mv) => ({ duration: mv.duration })),
    async frame(t, type = 'image/jpeg', quality = 0.95) {
      const mv = await mvPromise;
      mv.render(ctx, t);
      return canvas.toDataURL(type, quality);
    },
  };
} else {
  startPlayer();
}

function fmt(s) {
  s = Math.max(0, Math.floor(s));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

async function startPlayer() {
  const audio = document.getElementById('audio');
  const start = document.getElementById('start');
  const status = document.getElementById('status');
  const controls = document.getElementById('controls');
  const toggle = document.getElementById('toggle');
  const seek = document.getElementById('seek');
  const time = document.getElementById('time');

  let mv;
  try {
    mv = await mvPromise;
  } catch (err) {
    status.textContent = '読み込みに失敗しました: ' + err.message;
    return;
  }
  if (mv.meta.title) document.getElementById('title').textContent = mv.meta.title;
  status.textContent = [mv.meta.artist, ...mv.meta.credits].filter(Boolean).join(' / ') || 'ready';
  start.classList.remove('loading');
  seek.max = String(mv.duration);
  const t0 = parseFloat(params.get('t')) || 0;
  audio.currentTime = t0;
  mv.render(ctx, t0);

  // audio.currentTime advances in coarse steps; interpolate between updates
  let anchorAudio = t0;
  let anchorPerf = performance.now();
  const now = () => {
    if (audio.paused) return audio.currentTime;
    const est = anchorAudio + (performance.now() - anchorPerf) / 1000;
    if (Math.abs(est - audio.currentTime) > 0.08) {
      anchorAudio = audio.currentTime;
      anchorPerf = performance.now();
      return anchorAudio;
    }
    return est;
  };
  const resync = () => {
    anchorAudio = audio.currentTime;
    anchorPerf = performance.now();
  };
  ['play', 'seeked', 'playing'].forEach((e) => audio.addEventListener(e, resync));

  let seeking = false;
  const loop = () => {
    const t = now();
    mv.render(ctx, t);
    if (!seeking) seek.value = String(t);
    time.textContent = `${fmt(t)} / ${fmt(mv.duration)}`;
    toggle.textContent = audio.paused ? '▶' : '⏸';
    requestAnimationFrame(loop);
  };

  const play = () => audio.play().catch(() => {});
  const togglePlay = () => (audio.paused ? play() : audio.pause());

  start.addEventListener('click', () => {
    start.remove();
    play();
    requestAnimationFrame(loop);
    showControls();
  });
  toggle.addEventListener('click', togglePlay);
  seek.addEventListener('input', () => {
    seeking = true;
    audio.currentTime = parseFloat(seek.value);
    resync();
  });
  seek.addEventListener('change', () => (seeking = false));
  document.getElementById('full').addEventListener('click', () => {
    if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen().catch(() => {});
  });
  document.addEventListener('keydown', (e) => {
    if (document.getElementById('start')) return;
    if (e.code === 'Space') {
      e.preventDefault();
      togglePlay();
    } else if (e.code === 'ArrowRight' || e.code === 'ArrowLeft') {
      audio.currentTime = Math.max(0, audio.currentTime + (e.code === 'ArrowRight' ? 5 : -5));
      resync();
    } else if (e.key === 'f') {
      document.getElementById('full').click();
    }
  });

  let hideTimer;
  function showControls() {
    controls.classList.remove('hidden');
    clearTimeout(hideTimer);
    hideTimer = setTimeout(() => !audio.paused && controls.classList.add('hidden'), 2500);
  }
  document.addEventListener('pointermove', showControls);
  document.addEventListener('pointerdown', showControls);
  audio.addEventListener('pause', showControls);
}
