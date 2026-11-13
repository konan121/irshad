// يولّد صورة معاينة الرئيسية (1200×630) التي تظهر عند مشاركة الرابط في واتساب.
// يعمل مرة واحدة محليًا (يحتاج Google Chrome مثبتًا)، والصورة الناتجة محفوظة في public/img/og/home.jpg
import { chromium } from 'playwright';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { ROOT, readJSON, SITE_FILE } from './lib.mjs';

const site = await readJSON(SITE_FILE);
// كل الملفات تُضمَّن داخل الصفحة (data URI) لأن المتصفح يمنع تحميل الملفات المحلية من صفحة فارغة.
const MIME = { woff2: 'font/woff2', png: 'image/png' };
const cache = {};
for (const p of [
  'fonts/messiri-arabic.woff2', 'fonts/messiri-latin.woff2', 'fonts/cairo-arabic.woff2', 'fonts/cairo-latin.woff2',
  'img/logos/moe.png', 'img/logos/school.png', 'img/logos/vision.png',
]) {
  const buf = await readFile(path.join(ROOT, 'public', p));
  cache[p] = `data:${MIME[p.split('.').pop()]};base64,${buf.toString('base64')}`;
}
const f = (p) => cache[p];

const html = `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><style>
@font-face{font-family:Messiri;src:url(${f('fonts/messiri-arabic.woff2')}) format('woff2');font-weight:400 700}
@font-face{font-family:Messiri;src:url(${f('fonts/messiri-latin.woff2')}) format('woff2');font-weight:400 700;unicode-range:U+0000-00FF,U+2000-206F}
@font-face{font-family:Cairo;src:url(${f('fonts/cairo-arabic.woff2')}) format('woff2');font-weight:200 1000}
@font-face{font-family:Cairo;src:url(${f('fonts/cairo-latin.woff2')}) format('woff2');font-weight:200 1000;unicode-range:U+0000-00FF,U+2000-206F}
*{box-sizing:border-box;margin:0}
body{width:1200px;height:630px;overflow:hidden;font-family:Cairo;color:#fff;
background:radial-gradient(circle at 10% 20%,rgba(255,255,255,.14),transparent 34%),radial-gradient(circle at 95% 115%,rgba(226,169,59,.35),transparent 40%),linear-gradient(118deg,#5B2163,#7d1d61 48%,#C2185B)}
.logos{height:150px;background:#fff;border-bottom:6px solid #E2A93B;display:grid;grid-template-columns:1fr auto 1fr;align-items:center;padding:0 56px}
.logos img:nth-child(1){height:84px;justify-self:start}.logos img:nth-child(2){height:122px}.logos img:nth-child(3){height:86px;justify-self:end}
.body{height:474px;padding:0 64px 8px;display:grid;gap:6px;justify-items:center;align-content:center;text-align:center}
h1{font-family:Messiri;font-weight:700;font-size:96px;line-height:1.15;text-shadow:0 4px 24px rgba(46,15,51,.35)}
.school{font-size:38px;font-weight:700}
.by{font-size:25px;opacity:.92}
.tag{margin-top:16px;background:#fff;color:#5B2163;border:3px solid #E2A93B;border-radius:999px;padding:2px 26px;font-size:27px;font-weight:800}
.num{unicode-bidi:isolate}
</style></head><body>
<div class="logos"><img src="${f('img/logos/moe.png')}"><img src="${f('img/logos/school.png')}"><img src="${f('img/logos/vision.png')}"></div>
<div class="body">
<h1>${site.name}</h1>
<p class="school">${site.school} <span class="num" dir="rtl">(${site.grades})</span></p>
<p class="by">إعداد الأخصائيتين الاجتماعيتين: ${site.specialists.join(' · ')}</p>
<p class="tag"><span class="num" dir="rtl">${site.hashtag}</span></p>
</div></body></html>`;

const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
await page.setContent(html, { waitUntil: 'load' });
await page.evaluate(() => document.fonts.ready);
const png = await page.screenshot({ type: 'png' });
await browser.close();
const out = path.join(ROOT, 'public/img/og/home.jpg');
await sharp(png).jpeg({ quality: 86, mozjpeg: true }).toFile(out);
console.log('✓', out);
