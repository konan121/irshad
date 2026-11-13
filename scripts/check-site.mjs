// فحص آلي للموقع بمتصفح Chrome الحقيقي، بمقاس iPhone 13 ومقاس آيفون 375×812 والكمبيوتر.
// الاستخدام:  npm run check-site -- https://konan121.github.io/irshad/  [--out مجلد_اللقطات]
import { chromium, devices } from 'playwright';
import { mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { ROOT, EPISODES_FILE } from './lib.mjs';

const args = process.argv.slice(2);
const BASE = (args.find((a) => a.startsWith('http')) || 'http://localhost:4322/irshad/').replace(/\/?$/, '/');
const outIdx = args.indexOf('--out');
const OUT = outIdx >= 0 ? path.resolve(args[outIdx + 1]) : path.join(ROOT, '.check');
await mkdir(OUT, { recursive: true });

const episodes = JSON.parse(await readFile(EPISODES_FILE, 'utf8')).filter((e) => !e.draft);
const pages = [
  { name: 'home', path: '' },
  { name: 'about', path: 'about/' },
  ...episodes.map((e) => ({ name: e.id, path: `ep/${e.id}/` })),
];

// أنماط تدل على رقم حلقة ظاهر للزائر
const EP_NUMBER = [
  /\bir\s?\d{1,3}\b/i,
  /(ال)?حلق(ة|ه)\s*(رقم\s*)?[0-9٠-٩]+/,
  /\b(episode|ep)\.?\s*\d+/i,
  /الحلقة\s+(الأولى|الثانية|الثالثة|الرابعة|الخامسة|السادسة|السابعة|الثامنة|التاسعة|العاشرة)/,
];

const results = [];
const fail = (page, msg) => results.push({ ok: false, page, msg });
const pass = (page, msg) => results.push({ ok: true, page, msg });

const browser = await chromium.launch({ channel: 'chrome' });
const profiles = [
  { label: 'iPhone 13', ctx: { ...devices['iPhone 13'], defaultBrowserType: undefined } },
  { label: 'iPhone 375', ctx: { ...devices['iPhone 13'], viewport: { width: 375, height: 812 }, defaultBrowserType: undefined } },
  { label: 'Desktop', ctx: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 } },
];
for (const p of profiles) delete p.ctx.defaultBrowserType;

for (const profile of profiles) {
  const context = await browser.newContext({ ...profile.ctx, locale: 'ar-OM' });
  for (const pg of pages) {
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
    const tag = `${profile.label} · ${pg.name}`;
    const res = await page.goto(BASE + pg.path, { waitUntil: 'networkidle' });
    if (res?.status() !== 200) { fail(tag, `الحالة ${res?.status()}`); await page.close(); continue; }

    // عرض أفقي زائد؟
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    overflow > 1 ? fail(tag, `تمرير أفقي زائد بمقدار ${overflow}px`) : pass(tag, 'لا تمرير أفقي');

    // أرقام الحلقات في النص الظاهر وخصائص الوصول
    const visible = await page.evaluate(() => {
      const attrs = [...document.querySelectorAll('[alt],[title],[aria-label]')]
        .map((el) => [el.getAttribute('alt'), el.getAttribute('title'), el.getAttribute('aria-label')].join(' '));
      return document.body.innerText + '\n' + document.title + '\n' + attrs.join('\n');
    });
    const hit = EP_NUMBER.map((re) => visible.match(re)).find(Boolean);
    hit ? fail(tag, `رقم حلقة ظاهر: «${hit[0]}»`) : pass(tag, 'لا رقم حلقة ظاهر');

    // كل الصور لها نص بديل
    const noAlt = await page.evaluate(() => [...document.images].filter((i) => !i.hasAttribute('alt')).length);
    noAlt ? fail(tag, `${noAlt} صورة بلا alt`) : pass(tag, 'كل الصور لها alt');

    // الخط العربي محمّل
    const fontOk = await page.evaluate(async () => {
      await document.fonts.ready;
      return document.fonts.check('16px "Cairo Variable"', 'ا') && document.fonts.check('700 30px "El Messiri Variable"', 'ا');
    });
    fontOk ? pass(tag, 'الخطوط محمّلة') : fail(tag, 'الخطوط لم تُحمَّل');

    if (profile.label === 'iPhone 13') {
      // وسوم المعاينة (Open Graph)
      const og = await page.evaluate(() => Object.fromEntries(
        [...document.querySelectorAll('meta[property^="og:"]')].map((m) => [m.getAttribute('property'), m.getAttribute('content')])
      ));
      for (const k of ['og:title', 'og:description', 'og:image', 'og:url']) {
        og[k] ? pass(tag, `${k} موجود`) : fail(tag, `${k} مفقود`);
      }
      if (og['og:image']) {
        const img = await fetch(og['og:image']).catch(() => null);
        const type = img?.headers.get('content-type') || '';
        const size = Number(img?.headers.get('content-length') || 0);
        img?.ok && type.startsWith('image/jpeg')
          ? pass(tag, `صورة المعاينة تعمل (${Math.round(size / 1024)}KB)`)
          : fail(tag, `صورة المعاينة لا تعمل: ${og['og:image']} (${img?.status})`);
      }

      // المشغّل: لا iframe قبل الضغط، ويظهر بعده
      const player = page.locator('[data-player]').first();
      if (await player.count()) {
        const before = await page.locator('iframe').count();
        before === 0 ? pass(tag, 'لا iframe قبل الضغط') : fail(tag, 'iframe محمّل قبل الضغط');
        await player.locator('.player-btn').click();
        const src = await page.locator('[data-player] iframe').getAttribute('src');
        /drive\.google\.com\/file\/d\/[\w-]+\/preview$/.test(src || '')
          ? pass(tag, 'المشغّل يظهر داخل الصفحة بعد الضغط')
          : fail(tag, `المشغّل لم يظهر (${src})`);
      }

      if (pg.name.startsWith('ir')) {
        const full = await page.locator('a', { hasText: 'تشغيل بملء الشاشة' }).getAttribute('href');
        full?.endsWith('/preview') ? pass(tag, 'زر ملء الشاشة يفتح /preview') : fail(tag, `زر ملء الشاشة: ${full}`);
        const dl = await page.locator('a', { hasText: 'تحميل 1080p' }).getAttribute('href');
        dl?.endsWith('/view') ? pass(tag, 'زر التحميل يفتح /view') : fail(tag, `زر التحميل: ${dl}`);
        const wa = await page.locator('a', { hasText: 'مشاركة عبر واتساب' }).getAttribute('href');
        wa?.startsWith('https://wa.me/?text=') && decodeURIComponent(wa).includes(`/ep/${pg.name}/`)
          ? pass(tag, 'رابط واتساب صحيح') : fail(tag, `رابط واتساب: ${wa}`);
        const more = await page.locator('section.more .card').count();
        more > 0 ? pass(tag, `«حلقات أخرى»: ${more}`) : fail(tag, '«حلقات أخرى» فارغ');
      }

      if (pg.name === 'home') {
        await page.locator('.fchip', { hasText: 'سؤال وجواب' }).click();
        const n1 = await page.locator('[data-grid] .card:not([hidden])').count();
        n1 === 1 ? pass(tag, 'التصفية حسب القالب تعمل') : fail(tag, `التصفية أعطت ${n1}`);
        await page.locator('.fchip', { hasText: 'الكل' }).click();
        await page.fill('#q', 'الحافلة');
        await page.waitForTimeout(400);
        const n2 = await page.locator('[data-grid] .card:not([hidden])').count();
        n2 === 1 ? pass(tag, 'البحث يعمل') : fail(tag, `البحث أعطى ${n2}`);
        await page.fill('#q', '');
        await page.waitForTimeout(400);
      }
    }

    errors.length ? fail(tag, `أخطاء في الصفحة: ${errors.join(' | ')}`) : pass(tag, 'لا أخطاء في وحدة التحكم');

    if (['home', 'about', episodes[0]?.id].includes(pg.name) && profile.label !== 'iPhone 375') {
      await page.goto(BASE + pg.path, { waitUntil: 'networkidle' });
      await page.evaluate(async () => {
        for (let y = 0; y < document.body.scrollHeight; y += 500) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 150)); }
        await Promise.all([...document.images].map((i) => (i.complete ? null : new Promise((r) => { i.onload = i.onerror = r; }))));
        window.scrollTo(0, 0);
      });
      await page.waitForTimeout(300);
      const file = path.join(OUT, `${profile.label.replace(/\s/g, '-')}-${pg.name}.png`);
      await page.screenshot({ path: file, fullPage: true });
    }
    await page.close();
  }
  await context.close();
}

// صفحة 404
{
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const res = await page.goto(BASE + 'no-such-page/');
  const txt = await page.locator('h1').textContent().catch(() => '');
  res?.status() === 404 && txt?.includes('غير موجودة') ? pass('404', 'صفحة 404 مخصصة') : fail('404', `الحالة ${res?.status()}`);
  await ctx.close();
}
await browser.close();

const bad = results.filter((r) => !r.ok);
console.log(`\nفحص ${BASE}\n✓ ناجح: ${results.length - bad.length}   ✗ فاشل: ${bad.length}`);
for (const r of bad) console.log(`  ✗ [${r.page}] ${r.msg}`);
console.log(`اللقطات في: ${OUT}`);
process.exit(bad.length ? 1 : 0);
