// Renderizador quadro a quadro: Chromium (Playwright) -> frames -> ffmpeg.
// Uso:
//   node render.mjs stills 0.5 3.2 12          -> PNGs em out/stills/
//   node render.mjs video [inicio] [fim]       -> out/video_raw.mp4 (sem áudio)
import { chromium } from 'playwright';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import sharp from 'sharp';
import { fileURLToPath } from 'url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(ROOT, 'out');
const W = 1080, H = 1920, FPS = 30;
fs.mkdirSync(path.join(OUT, 'stills'), { recursive: true });

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.ttf': 'font/ttf', '.png': 'image/png', '.jpg': 'image/jpeg' };
const server = http.createServer((req, res) => {
  const f = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  if (!f.startsWith(ROOT)) { res.statusCode = 403; return res.end(); }
  fs.readFile(f, (err, buf) => {
    if (err) { res.statusCode = 404; return res.end(); }
    res.setHeader('Content-Type', MIME[path.extname(f)] || 'application/octet-stream'); res.end(buf);
  });
});
await new Promise(r => server.listen(0, r));
const port = server.address().port;

const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-gpu-vsync'] });
const page = await browser.newPage({ viewport: { width: W, height: H } });
page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') console.log('[page]', m.text()); });
page.on('pageerror', e => console.log('[pageerror]', e.message));
await page.goto(`http://localhost:${port}/composition/index.html`);
await page.waitForFunction(() => window.ready === true, null, { timeout: 120000 });
const cdp = await page.context().newCDPSession(page);

async function capture(t, tc = t) {
  await page.evaluate(([t, tc]) => window.renderAt(t, tc), [t, tc]);
  const r = await cdp.send('Page.captureScreenshot', { format: 'png', optimizeForSpeed: true, captureBeyondViewport: false });
  return Buffer.from(r.data, 'base64');
}

const mode = process.argv[2] || 'stills';
if (mode === 'stills') {
  for (const a of process.argv.slice(3)) {
    const t = parseFloat(a); const t0 = Date.now();
    const png = await capture(t);
    fs.writeFileSync(path.join(OUT, 'stills', `t${t.toFixed(2).padStart(6, '0')}.png`), png);
    console.log('still', t, (Date.now() - t0) + 'ms');
  }
} else if (mode === 'video') {
  const tA = parseFloat(process.argv[3] ?? '0'), tB = parseFloat(process.argv[4] ?? '35');
  const name = process.argv[5] || 'video_raw';
  const f0 = Math.round(tA * FPS), f1 = Math.round(tB * FPS);
  const samplesAt = await page.evaluate(() => window.SHUTTER_SAMPLES ? 'fn' : null);
  const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', `${W}x${H}`, '-r', String(FPS), '-i', '-',
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '9', '-pix_fmt', 'yuv444p', path.join(OUT, `${name}.mp4`)], { stdio: ['pipe', 'inherit', 'inherit'] });
  const acc = new Float32Array(W * H * 3);
  const t0 = Date.now();
  for (let f = f0; f < f1; f++) {
    const t = f / FPS;
    const n = samplesAt ? await page.evaluate(t => window.SHUTTER_SAMPLES(t), t) : 1;
    acc.fill(0);
    for (let k = 0; k < n; k++) {
      // obturador de 180°: amostras distribuídas em meio intervalo de quadro, centradas no quadro
      const ts = n === 1 ? t : t + ((k + 0.5) / n - 0.5) * (0.5 / FPS);
      const raw = await sharp(await capture(ts, t)).removeAlpha().raw().toBuffer();
      for (let i = 0; i < raw.length; i++) acc[i] += raw[i];
    }
    const out = Buffer.allocUnsafe(W * H * 3);
    for (let i = 0; i < out.length; i++) out[i] = Math.min(255, Math.round(acc[i] / n));
    if (!ff.stdin.write(out)) await new Promise(r => ff.stdin.once('drain', r));
    if ((f - f0) % 15 === 0) {
      const el = (Date.now() - t0) / 1000, done = f - f0 + 1;
      console.log(`frame ${f} t=${t.toFixed(2)} spp=${n} | ${(el / done).toFixed(2)}s/frame | eta ${((f1 - f - 1) * el / done / 60).toFixed(1)} min`);
    }
  }
  ff.stdin.end();
  await new Promise(r => ff.on('close', r));
  console.log('done', name, ((Date.now() - t0) / 60000).toFixed(1), 'min');
}
await browser.close();
server.close();
