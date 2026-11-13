// أدوات مشتركة لسكربتات الموقع: قراءة البيانات، وتنزيل الصور من Drive، وتجهيز نسخها.
import { readFile, writeFile, mkdir, access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import sharp from 'sharp';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const EPISODES_FILE = path.join(ROOT, 'src/data/episodes.json');
export const SITE_FILE = path.join(ROOT, 'src/data/site.json');
export const PUBLIC = path.join(ROOT, 'public');
const POSTERS = path.join(PUBLIC, 'img/posters');
const OG = path.join(PUBLIC, 'img/og');
const LOGOS = path.join(PUBLIC, 'img/logos');
const ICONS = path.join(PUBLIC, 'icons');

export async function readJSON(file) {
  return JSON.parse(await readFile(file, 'utf8'));
}

export async function writeEpisodes(list) {
  await writeFile(EPISODES_FILE, JSON.stringify(list, null, 2) + '\n', 'utf8');
}

const exists = (p) => access(p).then(() => true, () => false);

/** يستخرج معرّف الملف من رابط Drive بأي صيغة، أو يعيد المعرّف نفسه إن لصقه المستخدم مباشرة. */
export function extractDriveId(input) {
  const s = String(input || '').trim();
  const m =
    s.match(/\/d\/([A-Za-z0-9_-]{20,})/) ||
    s.match(/[?&]id=([A-Za-z0-9_-]{20,})/) ||
    s.match(/^([A-Za-z0-9_-]{20,})$/);
  return m ? m[1] : '';
}

/** ينزّل صورة عامة من Drive ويتحقق أنها صورة فعلًا وليست صفحة تسجيل دخول. */
export async function downloadDriveImage(id, size = 'w1920') {
  const url = `https://drive.google.com/thumbnail?id=${id}&sz=${size}`;
  let res;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      res = await fetch(url, { redirect: 'follow' });
      if (res.ok) break;
    } catch (err) {
      if (attempt === 3) throw err;
    }
    await new Promise((r) => setTimeout(r, 800 * attempt));
  }
  const type = res?.headers.get('content-type') || '';
  if (!res?.ok || !type.startsWith('image/')) {
    throw new Error(
      `تعذّر تنزيل الصورة ذات المعرّف ${id} (الحالة ${res?.status}). ` +
        'تأكد أن الملف موجود في مجلد Drive العام وأن مشاركته «أي شخص لديه الرابط».'
    );
  }
  return Buffer.from(await res.arrayBuffer());
}

/** يجهّز غلاف الحلقة: نسختان للويب (480 و960) وصورة معاينة لواتساب 1200×675. */
export async function buildPoster(ep, { force = false } = {}) {
  if (!ep.poster) return false;
  await mkdir(POSTERS, { recursive: true });
  await mkdir(OG, { recursive: true });
  const small = path.join(POSTERS, `${ep.id}-480.webp`);
  const large = path.join(POSTERS, `${ep.id}-960.webp`);
  const og = path.join(OG, `${ep.id}.jpg`);
  if (!force && (await exists(small)) && (await exists(large)) && (await exists(og))) return false;

  const buf = await downloadDriveImage(ep.poster);
  const base = sharp(buf).rotate();
  await base
    .clone()
    .resize(480, 270, { fit: 'cover' })
    .webp({ quality: 80 })
    .toFile(small);
  await base
    .clone()
    .resize(960, 540, { fit: 'cover', kernel: 'lanczos3' })
    .sharpen({ sigma: 0.6 })
    .webp({ quality: 80 })
    .toFile(large);
  await base
    .clone()
    .resize(1200, 675, { fit: 'cover', kernel: 'lanczos3' })
    .sharpen({ sigma: 0.7 })
    .jpeg({ quality: 82, mozjpeg: true, progressive: true })
    .toFile(og);
  return true;
}

/** ينزّل الشعارات الثلاثة ويحفظها بصيغة webp، ويولّد أيقونات الموقع من شعار المدرسة. */
export async function buildLogos(site, { force = false } = {}) {
  await mkdir(LOGOS, { recursive: true });
  await mkdir(ICONS, { recursive: true });
  let changed = false;
  for (const logo of site.logos) {
    const webp = path.join(LOGOS, `${logo.key}.webp`);
    const png = path.join(LOGOS, `${logo.key}.png`);
    if (!force && (await exists(webp)) && (await exists(png))) continue;
    const buf = await downloadDriveImage(logo.drive, 'w800');
    const img = sharp(buf).trim({ threshold: 4 });
    const { height } = await img.clone().metadata();
    const target = Math.min(height || 192, 192);
    await img.clone().resize({ height: target }).webp({ quality: 90, alphaQuality: 90 }).toFile(webp);
    await img.clone().resize({ height: target }).png({ compressionLevel: 9 }).toFile(png);
    changed = true;
  }

  const schoolPng = path.join(LOGOS, 'school.png');
  const iconTargets = [
    ['icon-192.png', 192, 0.78],
    ['icon-512.png', 512, 0.78],
    ['maskable-512.png', 512, 0.6],
    ['apple-touch-icon.png', 180, 0.74],
    ['favicon-32.png', 32, 0.92],
  ];
  for (const [name, size, ratio] of iconTargets) {
    const out = path.join(ICONS, name);
    if (!force && !changed && (await exists(out))) continue;
    const inner = Math.round(size * ratio);
    const logo = await sharp(schoolPng)
      .resize({ width: inner, height: inner, fit: 'inside', kernel: 'lanczos3' })
      .toBuffer();
    await sharp({ create: { width: size, height: size, channels: 4, background: '#FFFFFF' } })
      .composite([{ input: logo, gravity: 'center' }])
      .png({ compressionLevel: 9 })
      .toFile(out);
  }
  return changed;
}

export function toSeconds(dur) {
  const [m, s] = String(dur).split(':').map(Number);
  return m * 60 + s;
}
