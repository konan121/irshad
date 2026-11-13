// إضافة حلقة جديدة إلى الموقع خطوة بخطوة.
// الاستخدام:  npm run add-episode
// (اختياري للأتمتة) npm run add-episode -- --title "…" --template 1,4 --duration 2:33 --summary "…" --video <رابط> --poster <رابط> --yes
import readline from 'node:readline/promises';
import { stdin, stdout, argv, exit } from 'node:process';
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  ROOT, EPISODES_FILE, SITE_FILE, readJSON, writeEpisodes, extractDriveId, buildPoster, downloadDriveImage,
} from './lib.mjs';

// ---------- أدوات ----------
const flags = {};
for (let i = 2; i < argv.length; i++) {
  const a = argv[i];
  if (!a.startsWith('--')) continue;
  const key = a.slice(2);
  const next = argv[i + 1];
  if (next === undefined || next.startsWith('--')) flags[key] = true;
  else { flags[key] = next; i++; }
}

const latinDigits = (s) => String(s ?? '').replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/[،]/g, ',');
const color = (code) => (s) => (stdout.isTTY ? `\x1b[${code}m${s}\x1b[0m` : s);
const bold = color('1');
const green = color('32');
const red = color('31');
const plum = color('35');

const rl = readline.createInterface({ input: stdin, output: stdout });
async function ask(question, { def = '', flag, validate } = {}) {
  if (flag && flags[flag] !== undefined && flags[flag] !== true) {
    const v = String(flags[flag]).trim();
    const err = validate?.(v);
    if (err) { console.error(red('✗ ' + err)); exit(1); }
    return v;
  }
  for (;;) {
    const hint = def ? ` [${def}]` : '';
    const ans = (await rl.question(`${bold(question)}${hint}: `)).trim() || def;
    const err = validate?.(ans);
    if (!err) return ans;
    console.log(red('  ✗ ' + err));
  }
}
async function yesNo(question, def = true) {
  if (flags.yes) return true;
  const ans = (await rl.question(`${bold(question)} [${def ? 'ن/ل' : 'ل/ن'}]: `)).trim();
  if (!ans) return def;
  return /^(ن|نعم|y|yes|ا|اي|أي)$/i.test(ans);
}
function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { cwd: ROOT, stdio: 'inherit', ...opts });
  return r.status === 0;
}
function todayMuscat() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Muscat' }).format(new Date());
}
async function drivePublic(id) {
  try {
    const res = await fetch(`https://drive.google.com/file/d/${id}/preview`, { redirect: 'manual' });
    return res.status === 200;
  } catch {
    return false;
  }
}

// ---------- البداية ----------
const site = await readJSON(SITE_FILE);
const episodes = await readJSON(EPISODES_FILE);

console.log('\n' + plum(bold('الركن الإرشادي — إضافة حلقة جديدة')));
console.log(plum('────────────────────────────────────'));
console.log('اضغط Enter لقبول القيمة المقترحة بين القوسين [ ].\n');

let draft = null;
const drafts = episodes.filter((e) => e.draft);
if (flags.draft) {
  draft = episodes.find((e) => e.id === flags.draft) || null;
} else if (drafts.length && !flags.title) {
  for (const d of drafts) {
    if (await yesNo(`توجد مسودة محفوظة: «${d.title}». هل تريد نشرها الآن؟`)) { draft = d; break; }
  }
}

const title = await ask('عنوان الحلقة', {
  def: draft?.title, flag: 'title',
  validate: (v) => (v.length < 2 ? 'اكتب عنوانًا.' : null),
});

console.log('\nالقوالب:');
site.templates.forEach((t, i) => console.log(`  ${i + 1}) ${t}`));
const defTpl = draft ? site.templates.map((t, i) => (draft.template.includes(t) ? i + 1 : 0)).filter(Boolean).join(',') : '';
const tplAns = await ask('رقم القالب (أو رقمان مثل 1,4 لقالب مركّب)', {
  def: defTpl, flag: 'template',
  validate: (v) => {
    const nums = latinDigits(v).split(/[,\s]+/).filter(Boolean).map(Number);
    if (!nums.length || nums.some((n) => !(n >= 1 && n <= site.templates.length))) return `اختر رقمًا من 1 إلى ${site.templates.length}.`;
    return null;
  },
});
const template = latinDigits(tplAns).split(/[,\s]+/).filter(Boolean).map((n) => site.templates[Number(n) - 1]).join(' ← ');

const duration = latinDigits(await ask('المدة (دقائق:ثوانٍ، مثل 2:33)', {
  def: draft?.duration, flag: 'duration',
  validate: (v) => (/^\d{1,2}:[0-5]\d$/.test(latinDigits(v)) ? null : 'اكتب المدة بالشكل 2:33'),
}));

const date = latinDigits(await ask('تاريخ النشر (سنة-شهر-يوم)', {
  def: draft?.date || todayMuscat(), flag: 'date',
  validate: (v) => (/^\d{4}-\d{2}-\d{2}$/.test(latinDigits(v)) && !isNaN(Date.parse(latinDigits(v))) ? null : 'اكتب التاريخ بالشكل 2026-11-08'),
}));

const summary = await ask('الملخص (جملتان أو ثلاث)', {
  def: draft && draft.summary.length > 40 ? draft.summary : '', flag: 'summary',
  validate: (v) => (v.length < 20 ? 'الملخص قصير جدًا، اكتب جملة أو جملتين على الأقل.' : null),
});

const videoAns = await ask('رابط Drive للفيديو', {
  def: draft?.drive, flag: 'video',
  validate: (v) => (extractDriveId(v) ? null : 'لم أتعرّف على الرابط. انسخه من Drive: مشاركة ← نسخ الرابط.'),
});
const drive = extractDriveId(videoAns);

const posterAns = await ask('رابط Drive للغلاف (صورة)', {
  def: draft?.poster, flag: 'poster',
  validate: (v) => (extractDriveId(v) ? null : 'لم أتعرّف على الرابط. انسخه من Drive: مشاركة ← نسخ الرابط.'),
});
const poster = extractDriveId(posterAns);

// ---------- التحقق من الروابط ----------
console.log('\nأتحقق من الروابط…');
if (await drivePublic(drive)) console.log(green('  ✓ الفيديو متاح للعامة'));
else {
  console.log(red('  ✗ لا يمكن فتح الفيديو دون تسجيل دخول. اجعل مشاركته «أي شخص لديه الرابط» في Drive.'));
  if (!(await yesNo('هل تريد المتابعة رغم ذلك؟', false))) exit(1);
}
try {
  await downloadDriveImage(poster, 'w200');
  console.log(green('  ✓ الغلاف متاح'));
} catch (err) {
  console.log(red('  ✗ ' + err.message));
  exit(1);
}

// ---------- المراجعة والحفظ ----------
const id = draft?.id || 'ir' + String(Math.max(0, ...episodes.map((e) => Number(e.id.replace(/\D/g, '')) || 0)) + 1).padStart(2, '0');
const ep = { id, title, template, duration, date, drive, poster, summary, draft: false };

console.log('\n' + bold('مراجعة الحلقة:'));
console.log(`  العنوان: ${title}\n  القالب:  ${template}\n  المدة:   ${duration}\n  التاريخ: ${date}\n  الملخص:  ${summary}`);
if (!(await yesNo('\nهل البيانات صحيحة وأحفظها؟'))) { console.log('أُلغيت الإضافة. لم يتغيّر شيء.'); exit(0); }

const next = draft ? episodes.map((e) => (e.id === id ? ep : e)) : [ep, ...episodes];
next.sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
await writeEpisodes(next);
console.log(green('✓ حُفظت الحلقة في src/data/episodes.json'));

console.log('أجهّز الغلاف وصورة المعاينة…');
await buildPoster(ep, { force: true });
console.log(green('✓ الغلاف جاهز'));

if (!flags['no-build']) {
  console.log('أبني الموقع…');
  if (!run('npm', ['run', 'build', '--silent'])) { console.log(red('✗ فشل البناء. راجع الرسالة أعلاه.')); exit(1); }
  console.log(green('✓ البناء نجح'));
}

// ---------- الرفع ----------
const wantPush = flags.push === true || (!flags['no-push'] && !flags.yes && (await yesNo('\nهل أرفع الحلقة إلى الموقع الآن؟')));
if (wantPush) {
  const ghCandidates = [path.join(os.homedir(), '.local/bin/gh'), '/opt/homebrew/bin/gh', '/usr/local/bin/gh'];
  const gh = ghCandidates.find((p) => existsSync(p));
  const cred = gh ? ['-c', 'credential.helper=', '-c', `credential.helper=!"${gh}" auth git-credential`] : [];
  run('git', ['add', 'src/data/episodes.json', 'public/img']);
  run('git', ['commit', '-m', `إضافة حلقة: ${title}`]);
  if (run('git', [...cred, 'push'])) {
    console.log(green(`\n✓ رُفعت الحلقة. ستظهر على الموقع خلال دقيقتين تقريبًا:`));
    console.log(`  ${site.siteUrl}ep/${id}/`);
  } else {
    console.log(red('\n✗ تعذّر الرفع. تأكد من تسجيل الدخول: ~/.local/bin/gh auth login'));
  }
} else {
  console.log(`\nلرفعها لاحقًا:\n  git add src/data/episodes.json public/img && git commit -m "إضافة حلقة: ${title}" && git push`);
}
rl.close();
