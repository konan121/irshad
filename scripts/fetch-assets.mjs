// ينزّل الأغلفة والشعارات من Drive إلى public/ مرة واحدة، حتى لا يعتمد الموقع على Drive في كل زيارة.
// الاستخدام:  npm run assets            (ينزّل الناقص فقط)
//             npm run assets -- --force (يعيد تنزيل كل شيء)
import { readJSON, EPISODES_FILE, SITE_FILE, buildPoster, buildLogos } from './lib.mjs';

export async function fetchAssets({ force = false, only = null } = {}) {
  const [episodes, site] = await Promise.all([readJSON(EPISODES_FILE), readJSON(SITE_FILE)]);
  const logosChanged = await buildLogos(site, { force });
  if (logosChanged) console.log('✓ الشعارات والأيقونات');
  for (const ep of episodes) {
    if (only && ep.id !== only) continue;
    if (!ep.poster) continue;
    const done = await buildPoster(ep, { force });
    if (done) console.log(`✓ غلاف «${ep.title}»`);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const force = process.argv.includes('--force');
  fetchAssets({ force })
    .then(() => console.log('اكتمل تجهيز الصور.'))
    .catch((err) => {
      console.error('✗', err.message);
      process.exit(1);
    });
}
