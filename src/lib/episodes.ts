import raw from '../data/episodes.json';
import site from '../data/site.json';
import { toSeconds } from './ar';

export interface Episode {
  id: string;
  title: string;
  template: string;
  duration: string;
  date: string;
  drive: string;
  poster: string;
  summary: string;
  draft?: boolean;
}

/** الحلقات المنشورة فقط، من الأحدث إلى الأقدم. المسودات لا تظهر في أي مكان. */
export const episodes: Episode[] = (raw as Episode[])
  .filter((e) => !e.draft && e.drive && e.poster)
  .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));

/** القوالب التي تنتمي إليها الحلقة. «موقف وحلّ ← مهارة اليوم» تنتمي إلى القالبين معًا. */
export function tagsOf(ep: Episode): string[] {
  return site.templates.filter((t) => ep.template.includes(t));
}

export const totalSeconds = episodes.reduce((sum, e) => sum + toSeconds(e.duration), 0);
export const totalMinutes = Math.round(totalSeconds / 60);

export const base = import.meta.env.BASE_URL.endsWith('/')
  ? import.meta.env.BASE_URL
  : import.meta.env.BASE_URL + '/';

/** رابط داخلي يراعي مسار المستودع /irshad/ */
export const href = (p = '') => base + p.replace(/^\//, '');

/** رابط كامل لصفحة على الموقع المنشور (للمشاركة ووسوم المعاينة). */
export const absolute = (p = '') => new URL(p.replace(/^\//, ''), site.siteUrl).href;

export const epPath = (ep: Episode) => `ep/${ep.id}/`;
export const posterSrc = (ep: Episode, w: 480 | 960) => href(`img/posters/${ep.id}-${w}.webp`);
export const ogImage = (ep: Episode) => absolute(`img/og/${ep.id}.jpg`);
export const driveView = (ep: Episode) => `https://drive.google.com/file/d/${ep.drive}/view`;
export const drivePreview = (ep: Episode) => `https://drive.google.com/file/d/${ep.drive}/preview`;

export { site };
