// Renders promo/index.html frame by frame into the social-media videos in promo/videos/.
// No dependencies: drives the installed Google Chrome over --remote-debugging-pipe and
// pipes PNG frames into ffmpeg. The soundtrack is mixed from assets/sounds/ (cue times
// come from the page's AUDIO list).
//
//   node promo/render.mjs reel                 → promo/videos/glove-mode-reel-9x16.mp4
//   node promo/render.mjs feed                 → promo/videos/glove-mode-feed-4x5.mp4
//   node promo/render.mjs reel --stills 3,12   → PNG stills in the temp dir (path printed)
//   node promo/render.mjs serve                → preview URL to open in a browser
//
// Needs Chrome (or CHROME=/path/to/chrome), ffmpeg on PATH, `npm install` done (Ionicons
// font) and network access for Google Fonts.
import { spawn } from 'node:child_process';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..'); // the app: index.html imports ../data/combos.js
const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const FPS = Number(process.env.FPS || 30);
const FORMATS = {
  reel: { width: 1080, height: 1920, name: 'glove-mode-reel-9x16' },
  feed: { width: 1080, height: 1350, name: 'glove-mode-feed-4x5' },
};

const mode = process.argv[2] || 'reel';
const stillsAt = process.argv.indexOf('--stills');
const stills = stillsAt > 0 ? process.argv[stillsAt + 1].split(',').map(Number) : null;

// ── static server (127.0.0.1 only, files under the app folder only) ─────────
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.png': 'image/png',
  '.ttf': 'font/ttf', '.json': 'application/json', '.wav': 'audio/wav' };
function serve() {
  const server = http.createServer((req, res) => {
    const file = path.normalize(path.join(root, decodeURIComponent(new URL(req.url, 'http://x').pathname)));
    if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
      res.writeHead(404).end();
      return;
    }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server)));
}

const server = await serve();
const base = `http://127.0.0.1:${server.address().port}/promo/index.html`;
if (mode === 'serve') {
  console.log(`${base}?format=reel\n${base}?format=feed\n(?t=12.5 freezes on a moment; Ctrl+C to stop)`);
} else {
  await render(FORMATS[mode] ?? process.exit(console.error(`unknown format "${mode}" (reel | feed | serve)`) ?? 1), mode);
  server.close();
}

// ── Chrome over the DevTools pipe ───────────────────────────────────────────
function launchChrome() {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'promo-chrome-'));
  const proc = spawn(CHROME, [
    '--headless=new', '--remote-debugging-pipe', `--user-data-dir=${profile}`, '--no-first-run',
    '--no-default-browser-check', '--hide-scrollbars', '--mute-audio', '--force-color-profile=srgb',
    '--font-render-hinting=none', 'about:blank',
  ], { stdio: ['ignore', 'ignore', 'ignore', 'pipe', 'pipe'] });
  const pending = new Map();
  let nextId = 0;
  let chunks = [];
  proc.stdio[4].on('data', (data) => {
    let start = 0;
    for (let i = data.indexOf(0); i !== -1; i = data.indexOf(0, start)) {
      chunks.push(data.subarray(start, i));
      const msg = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      chunks = [];
      start = i + 1;
      const waiter = pending.get(msg.id);
      if (!waiter) continue;
      pending.delete(msg.id);
      if (msg.error) waiter.reject(new Error(`${waiter.method}: ${msg.error.message}`));
      else waiter.resolve(msg.result);
    }
    if (start < data.length) chunks.push(data.subarray(start));
  });
  const send = (method, params = {}, sessionId) => new Promise((resolve, reject) => {
    const id = ++nextId;
    pending.set(id, { resolve, reject, method });
    proc.stdio[3].write(JSON.stringify({ id, method, params, ...(sessionId && { sessionId }) }) + '\0');
  });
  const close = () => {
    proc.kill();
    fs.rmSync(profile, { recursive: true, force: true });
  };
  return { send, close };
}

async function render(format, key) {
  const chrome = launchChrome();
  try {
    const { targetId } = await chrome.send('Target.createTarget', { url: 'about:blank' });
    const { sessionId } = await chrome.send('Target.attachToTarget', { targetId, flatten: true });
    const page = (method, params) => chrome.send(method, params, sessionId);
    const evaluate = async (expression) => {
      const { result, exceptionDetails } = await page('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
      if (exceptionDetails) throw new Error(exceptionDetails.exception?.description || exceptionDetails.text);
      return result.value;
    };
    await page('Emulation.setDeviceMetricsOverride', { width: format.width, height: format.height, deviceScaleFactor: 1, mobile: false });
    await page('Page.navigate', { url: `${base}?render&format=${key}` });
    for (let waited = 0; !(await evaluate('window.READY === true').catch(() => false)); waited += 200) {
      if (waited > 60000) throw new Error('page never became ready (fonts or combos failed to load?)');
      await new Promise((r) => setTimeout(r, 200));
    }
    const { dur, audio } = await evaluate('({ dur: window.DUR, audio: window.AUDIO })');
    const frame = async (t) => {
      await evaluate(`window.renderAt(${t})`);
      const { data } = await page('Page.captureScreenshot', { format: 'png' });
      return Buffer.from(data, 'base64');
    };

    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'promo-'));
    if (stills) {
      for (const t of stills) fs.writeFileSync(path.join(tmp, `${key}-${t}.png`), await frame(t));
      console.log(`stills in ${tmp}`);
      return;
    }

    const soundtrack = path.join(tmp, 'audio.wav');
    await mixAudio(audio, dur, soundtrack);
    const outDir = path.join(here, 'videos');
    fs.mkdirSync(outDir, { recursive: true });
    const outFile = path.join(outDir, `${format.name}.mp4`);
    const ff = spawn('ffmpeg', [
      '-y', '-loglevel', 'error',
      '-f', 'image2pipe', '-framerate', String(FPS), '-i', '-', '-i', soundtrack,
      '-vf', 'scale=out_color_matrix=bt709:out_range=tv,format=yuv420p',
      '-c:v', 'libx264', '-preset', 'slow', '-crf', '16', '-profile:v', 'high', '-level', '4.2',
      '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv',
      '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-shortest', '-movflags', '+faststart', outFile,
    ], { stdio: ['pipe', 'inherit', 'inherit'] });
    const done = new Promise((resolve, reject) => ff.on('close', (code) => (code ? reject(new Error(`ffmpeg exited ${code}`)) : resolve())));
    const frames = Math.round(dur * FPS);
    for (let i = 0; i < frames; i++) {
      if (!ff.stdin.write(await frame(i / FPS))) await new Promise((r) => ff.stdin.once('drain', r));
      if (i % 30 === 0) process.stdout.write(`\r${key}: ${i}/${frames} frames`);
    }
    ff.stdin.end();
    await done;
    fs.rmSync(tmp, { recursive: true, force: true });
    console.log(`\r${key}: ${path.relative(process.cwd(), outFile)}`);
  } finally {
    chrome.close();
  }
}

// Mix the page's sound cues (from assets/sounds) into one stereo track of the video's length.
function mixAudio(cues, dur, outFile) {
  const inputs = cues.flatMap((c) => ['-i', path.join(root, 'assets', 'sounds', c.file)]);
  const delays = cues.map((c, i) => `[${i}]adelay=${Math.round(c.t * 1000)}:all=1[a${i}]`).join(';');
  const mix = `${cues.map((_, i) => `[a${i}]`).join('')}amix=inputs=${cues.length}:normalize=0,`
    + `apad=whole_dur=${dur},atrim=0:${dur},aformat=sample_rates=48000:channel_layouts=stereo`;
  return new Promise((resolve, reject) => {
    const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', ...inputs, '-filter_complex', `${delays};${mix}`, outFile], { stdio: 'inherit' });
    ff.on('close', (code) => (code ? reject(new Error(`ffmpeg (audio) exited ${code}`)) : resolve()));
  });
}
