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

/**
 * The song is decoded once and played from a buffer, so seeking works with
 * any static server (no HTTP Range support needed) and the clock is
 * sample-accurate.
 */
async function loadSong(url) {
  const actx = new AudioContext();
  const buffer = await fetch(url)
    .then((r) => {
      if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`);
      return r.arrayBuffer();
    })
    .then((b) => actx.decodeAudioData(b));

  let src = null;
  let startedAt = 0;
  let offset = 0;
  const latency = () => (actx.outputLatency || 0) + (actx.baseLatency || 0);

  const song = {
    duration: buffer.duration,
    get playing() {
      return src !== null;
    },
    /** song position of what is being heard right now */
    now() {
      if (!src) return offset;
      return Math.min(buffer.duration, Math.max(0, actx.currentTime - startedAt - latency()));
    },
    play() {
      if (src) return;
      if (offset >= buffer.duration) offset = 0;
      actx.resume();
      const node = actx.createBufferSource();
      node.buffer = buffer;
      node.connect(actx.destination);
      node.onended = () => {
        if (src !== node) return; // stopped by pause/seek
        src = null;
        offset = buffer.duration;
      };
      node.start(0, offset);
      startedAt = actx.currentTime - offset;
      src = node;
    },
    pause() {
      if (!src) return;
      offset = song.now();
      const node = src;
      src = null;
      node.stop();
    },
    seek(t) {
      const was = !!src;
      song.pause();
      offset = Math.min(buffer.duration, Math.max(0, t));
      if (was) song.play();
    },
  };
  return song;
}

async function startPlayer() {
  const start = document.getElementById('start');
  const status = document.getElementById('status');
  const controls = document.getElementById('controls');
  const toggle = document.getElementById('toggle');
  const seek = document.getElementById('seek');
  const time = document.getElementById('time');

  let mv;
  let song;
  try {
    [mv, song] = await Promise.all([mvPromise, loadSong('assets/song.mp3')]);
  } catch (err) {
    status.textContent = '読み込みに失敗しました: ' + err.message;
    return;
  }
  if (mv.meta.title) document.getElementById('title').textContent = mv.meta.title;
  status.textContent = [mv.meta.artist, ...mv.meta.credits].filter(Boolean).join(' / ') || 'ready';
  start.classList.remove('loading');
  seek.max = String(song.duration);
  song.seek(parseFloat(params.get('t')) || 0);
  mv.render(ctx, song.now());

  let seeking = false;
  const loop = () => {
    const t = song.now();
    mv.render(ctx, t);
    if (!seeking) seek.value = String(t);
    time.textContent = `${fmt(t)} / ${fmt(song.duration)}`;
    toggle.textContent = song.playing ? '⏸' : '▶';
    requestAnimationFrame(loop);
  };

  const togglePlay = () => {
    if (song.playing) song.pause();
    else song.play();
    showControls();
  };

  start.addEventListener('click', () => {
    start.remove();
    song.play();
    requestAnimationFrame(loop);
    showControls();
  });
  toggle.addEventListener('click', togglePlay);
  seek.addEventListener('input', () => {
    seeking = true;
    song.seek(parseFloat(seek.value));
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
      song.seek(song.now() + (e.code === 'ArrowRight' ? 5 : -5));
      showControls();
    } else if (e.key === 'f') {
      document.getElementById('full').click();
    }
  });

  let hideTimer;
  function showControls() {
    controls.classList.remove('hidden');
    clearTimeout(hideTimer);
    hideTimer = setTimeout(() => song.playing && controls.classList.add('hidden'), 2500);
  }
  document.addEventListener('pointermove', showControls);
  document.addEventListener('pointerdown', showControls);
}
