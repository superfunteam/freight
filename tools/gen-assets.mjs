#!/usr/bin/env node
/*
  Generates the social/OG image and the favicon + app-icon set into public/.
  Run: node tools/gen-assets.mjs   (needs playwright + a Chromium it can find)
*/
import { createRequire } from 'module';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const here = path.dirname(fileURLToPath(import.meta.url));
const pub = path.resolve(here, '..', 'public');

// Use a local playwright if installed, otherwise fall back to a global one (npm root -g).
const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); }
catch {
  const { execSync } = await import('child_process');
  const globalRoot = execSync('npm root -g').toString().trim();
  ({ chromium } = require(path.join(globalRoot, 'playwright')));
}

// Tiny static server so the page can load the vendored fonts.
const types = { '.woff2': 'font/woff2', '.css': 'text/css', '.html': 'text/html' };
const server = http.createServer((req, res) => {
  const f = path.join(pub, req.url.split('?')[0]);
  if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream', 'access-control-allow-origin': '*' });
  fs.createReadStream(f).pipe(res);
}).listen(0);
const base = `http://localhost:${server.address().port}`;

const fontCss = `
  @font-face { font-family: 'Alfa Slab One'; src: url(${base}/fonts/alfa-slab-one-400.woff2) format('woff2'); }
  @font-face { font-family: 'Nunito'; font-weight: 200 1000; src: url(${base}/fonts/nunito-variable.woff2) format('woff2'); }
  * { box-sizing: border-box; margin: 0; }
  body { font-family: 'Nunito', sans-serif; }
`;

const ogHtml = `<!doctype html><html><head><style>${fontCss}
  .og { width: 1200px; height: 630px; position: relative; overflow: hidden;
        background: linear-gradient(#7ec8f5 0%, #d9f1ff 60%, #5faa5e 60%, #5faa5e 100%); }
  .sun { position: absolute; right: 70px; top: 36px; width: 150px; height: 150px; border-radius: 50%; background: #ffd23f;
         box-shadow: 0 0 0 26px rgba(255,210,63,.25), 0 0 0 56px rgba(255,210,63,.12); }
  .hill { position: absolute; border-radius: 50%; background: #9fd49b; }
  .h1 { left: -200px; top: 250px; width: 900px; height: 340px; }
  .h2 { left: 500px; top: 280px; width: 1000px; height: 320px; }
  .cloud { position: absolute; background: #fff; border-radius: 60px; width: 150px; height: 50px; }
  .cloud::before { content:''; position:absolute; background:#fff; border-radius:50%; width:70px; height:70px; left:20px; top:-34px; }
  .cloud::after { content:''; position:absolute; background:#fff; border-radius:50%; width:48px; height:48px; left:78px; top:-20px; }
  .badge { position: absolute; left: 80px; top: 96px; font-size: 20px; letter-spacing: 6px; text-transform: uppercase; font-weight: 900;
           background: #1f2a3a; color: #ffd23f; padding: 10px 20px; border-radius: 6px; transform: rotate(-2deg); }
  .logo { position: absolute; left: 70px; top: 128px; font-family: 'Alfa Slab One', serif; font-size: 150px; line-height: 1; color: #e63946;
          -webkit-text-stroke: 4px #1f2a3a; text-shadow: 8px 8px 0 #1f2a3a, 16px 16px 0 #ffd23f; letter-spacing: 4px; transform: rotate(-3deg); }
  .tag { position: absolute; left: 82px; top: 300px; font-size: 38px; font-weight: 900; color: #1f2a3a; }
  .tag em { font-style: normal; color: #e63946; text-decoration: underline wavy #ffd23f; }
  .ground { position: absolute; left: 0; right: 0; bottom: 0; height: 250px; background: #5faa5e; }
  .ballast { position: absolute; left: 0; right: 0; bottom: 60px; height: 40px; background: #b9a98f; }
  .ties { position: absolute; left: 0; right: 0; bottom: 68px; height: 26px; background: repeating-linear-gradient(90deg, #6b4a2b 0 18px, transparent 18px 48px); }
  .rail { position: absolute; left: 0; right: 0; height: 6px; background: #4a4f57; }
  .train { position: absolute; left: 30px; bottom: 96px; display: flex; gap: 16px; align-items: flex-end; transform: scale(.86); transform-origin: bottom left; }
  .car { width: 150px; height: 96px; border: 5px solid #1f2a3a; border-radius: 12px; display: flex; align-items: center; justify-content: center;
         font-size: 58px; position: relative; box-shadow: inset 0 -12px 0 rgba(0,0,0,.15), inset 0 6px 0 rgba(255,255,255,.25); }
  .car::before { content:''; position:absolute; left:10px; right:10px; top:-11px; height:8px; background:#1f2a3a; border-radius:4px 4px 0 0; }
  .car .slot { width: 84px; height: 66px; border-radius: 10px; background: #fff; border: 3px solid #1f2a3a; display:flex; align-items:center; justify-content:center; }
  .car .slot.q { background: rgba(0,0,0,.3); border: 3px dashed #fff; color: #fff; font-family: 'Alfa Slab One'; font-size: 40px; }
  .wheel { position: absolute; bottom: -20px; width: 28px; height: 28px; border-radius: 50%; background: #2b2f36; border: 5px solid #8b929c; }
  .w1 { left: 16px; } .w2 { right: 16px; }
  .loco { width: 220px; height: 96px; position: relative; }
  .cab { position: absolute; left: 0; top: -22px; bottom: 0; width: 80px; background: #e63946; border: 5px solid #1f2a3a; border-radius: 12px 12px 6px 6px; }
  .cab::before { content:''; position:absolute; left:12px; right:12px; top:14px; height:30px; background:#d9f1ff; border:3px solid #1f2a3a; border-radius:4px; }
  .boiler { position: absolute; left: 74px; right: 0; top: 14px; bottom: 0; background: #1f2a3a; border-radius: 8px 34px 34px 8px; box-shadow: inset 0 9px 0 rgba(255,255,255,.18); }
  .boiler::after { content:''; position:absolute; right:10px; top:50%; transform:translateY(-50%); width:20px; height:20px; border-radius:50%; background:#ffd23f; box-shadow:0 0 16px #ffd23f; }
  .stack { position: absolute; right: 34px; top: -12px; width: 24px; height: 32px; background: #1f2a3a; border-radius: 6px 6px 0 0; }
  .stack::before { content:''; position:absolute; left:-6px; right:-6px; top:-8px; height:12px; background:#1f2a3a; border-radius:4px; }
  .dome { position: absolute; right: 90px; top: 2px; width: 32px; height: 20px; background: #ffd23f; border: 4px solid #1f2a3a; border-radius: 12px 12px 0 0; }
  .puff { position: absolute; border-radius: 50%; background: rgba(255,255,255,.9); }
  .url { position: absolute; right: 60px; bottom: 22px; font-size: 22px; font-weight: 900; color: #fff; letter-spacing: 1px; opacity: .9; }
</style></head><body>
<div class="og">
  <div class="sun"></div>
  <div class="hill h1"></div><div class="hill h2"></div>
  <div class="cloud" style="left:620px; top:120px"></div>
  <div class="cloud" style="left:880px; top:230px; transform:scale(.7)"></div>
  <div class="badge">Rail Yard Loading Co.</div>
  <div class="logo">FREIGHT</div>
  <div class="tag">How long can <em>you</em> build your train?!</div>
  <div class="ground"></div>
  <div class="ballast"></div><div class="ties"></div>
  <div class="rail" style="bottom:88px"></div><div class="rail" style="bottom:70px"></div>
  <div class="train">
    <div class="car" style="background:#8e5cff"><div class="slot q">?</div><div class="wheel w1"></div><div class="wheel w2"></div></div>
    <div class="car" style="background:#2a9d8f"><div class="slot">🍉</div><div class="wheel w1"></div><div class="wheel w2"></div></div>
    <div class="car" style="background:#e8a33d"><div class="slot">🧅</div><div class="wheel w1"></div><div class="wheel w2"></div></div>
    <div class="car" style="background:#3a86ff"><div class="slot">☕</div><div class="wheel w1"></div><div class="wheel w2"></div></div>
    <div class="car" style="background:#d9534f"><div class="slot">🌾</div><div class="wheel w1"></div><div class="wheel w2"></div></div>
    <div class="car" style="background:#c95d9a"><div class="slot">🪵</div><div class="wheel w1"></div><div class="wheel w2"></div></div>
    <div class="loco">
      <div class="cab"></div><div class="boiler"></div><div class="dome"></div><div class="stack"></div>
      <div class="wheel" style="left:10px;bottom:-20px"></div><div class="wheel" style="left:50px;bottom:-20px"></div>
      <div class="wheel" style="left:120px;bottom:-20px;width:36px;height:36px"></div><div class="wheel" style="left:168px;bottom:-20px;width:36px;height:36px"></div>
      <div class="puff" style="right:-10px; top:-50px; width:36px; height:36px"></div>
      <div class="puff" style="right:-50px; top:-95px; width:52px; height:52px; opacity:.8"></div>
      <div class="puff" style="right:-110px; top:-150px; width:72px; height:72px; opacity:.6"></div>
    </div>
  </div>
</div></body></html>`;

// Icon: yellow tile, navy border, the game's locomotive.
const iconHtml = (size, maskable) => `<!doctype html><html><head><style>${fontCss}
  .tile { width: ${size}px; height: ${size}px; position: relative; overflow: hidden;
          background: ${maskable ? '#ffd23f' : 'linear-gradient(#7ec8f5, #d9f1ff)'}; border-radius: ${maskable ? 0 : Math.round(size * 0.22)}px; }
  .ground { position:absolute; left:0; right:0; bottom:0; height:${size * 0.3}px; background:#5faa5e; }
  .rail { position:absolute; left:0; right:0; bottom:${size * 0.22}px; height:${Math.max(2, size * 0.035)}px; background:#4a4f57; }
  .loco { position:absolute; left:${size * 0.12}px; bottom:${size * 0.25}px; width:${size * 0.76}px; height:${size * 0.34}px; }
  .cab { position:absolute; left:0; top:-${size * 0.08}px; bottom:0; width:${size * 0.28}px; background:#e63946; border:${Math.max(2, size * 0.028)}px solid #1f2a3a; border-radius:${size * 0.05}px ${size * 0.05}px ${size * 0.02}px ${size * 0.02}px; }
  .boiler { position:absolute; left:${size * 0.26}px; right:0; top:${size * 0.05}px; bottom:0; background:#1f2a3a; border-radius:${size * 0.03}px ${size * 0.13}px ${size * 0.13}px ${size * 0.03}px; box-shadow: inset 0 ${size * 0.03}px 0 rgba(255,255,255,.2); }
  .lamp { position:absolute; right:${size * 0.04}px; top:${size * 0.15}px; width:${size * 0.07}px; height:${size * 0.07}px; border-radius:50%; background:#ffd23f; }
  .stack { position:absolute; right:${size * 0.12}px; top:-${size * 0.06}px; width:${size * 0.09}px; height:${size * 0.12}px; background:#1f2a3a; border-radius:${size * 0.02}px ${size * 0.02}px 0 0; }
  .wheel { position:absolute; bottom:-${size * 0.07}px; width:${size * 0.13}px; height:${size * 0.13}px; border-radius:50%; background:#2b2f36; border:${Math.max(2, size * 0.025)}px solid #8b929c; }
  .puff { position:absolute; border-radius:50%; background:#fff; }
</style></head><body><div class="tile">
  <div class="ground"></div><div class="rail"></div>
  <div class="loco"><div class="cab"></div><div class="boiler"></div><div class="lamp"></div><div class="stack"></div>
    <div class="wheel" style="left:${size * 0.02}px"></div><div class="wheel" style="left:${size * 0.2}px"></div><div class="wheel" style="left:${size * 0.42}px"></div><div class="wheel" style="left:${size * 0.6}px"></div>
    <div class="puff" style="right:${size * 0.02}px; top:-${size * 0.2}px; width:${size * 0.12}px; height:${size * 0.12}px"></div>
    <div class="puff" style="right:-${size * 0.06}px; top:-${size * 0.34}px; width:${size * 0.17}px; height:${size * 0.17}px; opacity:.75"></div>
  </div></div></body></html>`;

const browser = await chromium.launch();
async function shot(html, w, h, file) {
  const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  await page.setContent(html, { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: path.join(pub, file), omitBackground: true, clip: { x: 0, y: 0, width: w, height: h } });
  await page.close();
  console.log('wrote', file);
}

await shot(ogHtml, 1200, 630, 'og.png');
for (const s of [16, 32, 48, 180, 192, 512]) {
  await shot(iconHtml(s, false), s, s, s === 180 ? 'apple-touch-icon.png' : `icon-${s}.png`);
}
await shot(iconHtml(512, true), 512, 512, 'icon-maskable-512.png');
await browser.close();
server.close();

// favicon.ico: an ICO container holding PNG images (supported by every modern browser).
function ico(files) {
  const pngs = files.map(f => fs.readFileSync(path.join(pub, f.file)));
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); header.writeUInt16LE(1, 2); header.writeUInt16LE(files.length, 4);
  const dir = Buffer.alloc(16 * files.length);
  let offset = 6 + dir.length;
  files.forEach((f, i) => {
    const b = i * 16;
    dir.writeUInt8(f.size >= 256 ? 0 : f.size, b); dir.writeUInt8(f.size >= 256 ? 0 : f.size, b + 1);
    dir.writeUInt8(0, b + 2); dir.writeUInt8(0, b + 3);
    dir.writeUInt16LE(1, b + 4); dir.writeUInt16LE(32, b + 6);
    dir.writeUInt32LE(pngs[i].length, b + 8); dir.writeUInt32LE(offset, b + 12);
    offset += pngs[i].length;
  });
  return Buffer.concat([header, dir, ...pngs]);
}
fs.writeFileSync(path.join(pub, 'favicon.ico'), ico([{ file: 'icon-16.png', size: 16 }, { file: 'icon-32.png', size: 32 }, { file: 'icon-48.png', size: 48 }]));
fs.unlinkSync(path.join(pub, 'icon-48.png'));
console.log('wrote favicon.ico');
