#!/usr/bin/env node
// Offline renderer: drives index.html?render=1 in headless Chromium frame by
// frame and pipes the frames into ffmpeg together with the song.
//
//   node tools/render.mjs                      # full MV -> out/cirno_mv.mp4
//   node tools/render.mjs --from 23 --to 45    # a section only
//   node tools/render.mjs --stills 5,30,62     # PNG stills into out/stills/
//
// Options: --out FILE --fps N --from S --to S --workers N --crf N --stills LIST

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn, execSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next === undefined || next.startsWith('--')) out[key] = true;
      else out[key] = argv[++i];
    }
  }
  return out;
}

async function loadPlaywright() {
  try {
    return await import('playwright');
  } catch {
    // fall back to a globally installed copy
    const globalRoot = execSync('npm root -g').toString().trim();
    const require = createRequire(path.join(globalRoot, 'noop.js'));
    return require('playwright');
  }
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json',
  '.lrc': 'text/plain; charset=utf-8',
  '.woff2': 'font/woff2',
  '.mp3': 'audio/mpeg',
};

function serve() {
  const server = http.createServer((req, res) => {
    const url = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    const file = path.join(ROOT, url === '/' ? 'index.html' : url);
    if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      res.writeHead(404).end();
      return;
    }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server)));
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const fps = +(args.fps || 30);
  const workers = +(args.workers || 3);
  const { chromium } = await loadPlaywright();
  const server = await serve();
  const base = `http://127.0.0.1:${server.address().port}/index.html?render=1`;
  const browser = await chromium.launch();

  const pages = [];
  let duration = 0;
  for (let i = 0; i < (args.stills ? 1 : workers); i++) {
    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
    page.on('pageerror', (e) => console.error('[page]', e.message));
    await page.goto(base);
    ({ duration } = await page.evaluate(() => window.MV.ready));
    pages.push(page);
  }

  if (args.stills) {
    const dir = path.join(ROOT, 'out', 'stills');
    fs.mkdirSync(dir, { recursive: true });
    for (const t of String(args.stills).split(',').map(Number)) {
      const url = await pages[0].evaluate((tt) => window.MV.frame(tt, 'image/png'), t);
      const file = path.join(dir, `t${t.toFixed(2).padStart(7, '0')}.png`);
      fs.writeFileSync(file, Buffer.from(url.split(',')[1], 'base64'));
      console.log(file);
    }
    await browser.close();
    server.close();
    return;
  }

  const from = +(args.from || 0);
  const to = Math.min(+(args.to || duration), duration);
  const total = Math.ceil((to - from) * fps);
  const out = path.resolve(ROOT, args.out || 'out/cirno_mv.mp4');
  fs.mkdirSync(path.dirname(out), { recursive: true });

  const ff = spawn(
    'ffmpeg',
    [
      '-y', '-loglevel', 'error',
      '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'mjpeg', '-i', '-',
      '-ss', String(from), '-t', String(to - from), '-i', path.join(ROOT, 'assets', 'song.mp3'),
      '-map', '0:v', '-map', '1:a',
      '-c:v', 'libx264', '-preset', args.preset || 'medium', '-crf', String(args.crf || 18),
      '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '256k',
      '-shortest', '-movflags', '+faststart', out,
    ],
    { stdio: ['pipe', 'inherit', 'inherit'] },
  );
  const ffDone = new Promise((resolve, reject) =>
    ff.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg exited with ${code}`)))),
  );

  const grab = (i) => pages[i % pages.length].evaluate((tt) => window.MV.frame(tt, 'image/jpeg', 0.95), from + i / fps);
  const started = Date.now();
  const inflight = new Map();
  const ahead = pages.length * 2;
  for (let i = 0; i < Math.min(ahead, total); i++) inflight.set(i, grab(i));
  for (let i = 0; i < total; i++) {
    const url = await inflight.get(i);
    inflight.delete(i);
    if (i + ahead < total) inflight.set(i + ahead, grab(i + ahead));
    if (!ff.stdin.write(Buffer.from(url.slice(url.indexOf(',') + 1), 'base64'))) {
      await new Promise((r) => ff.stdin.once('drain', r));
    }
    if (i % fps === 0 || i === total - 1) {
      const el = (Date.now() - started) / 1000;
      const eta = (el / (i + 1)) * (total - i - 1);
      process.stdout.write(`\rframe ${i + 1}/${total}  ${((i + 1) / el).toFixed(1)} fps  eta ${Math.round(eta)}s   `);
    }
  }
  ff.stdin.end();
  await ffDone;
  await browser.close();
  server.close();
  console.log(`\nwrote ${path.relative(process.cwd(), out)}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
