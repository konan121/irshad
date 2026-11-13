// أدوات العربية: الأرقام الهندية، والتواريخ، والجمع، وتطبيع النص للبحث.

const DIGITS = '٠١٢٣٤٥٦٧٨٩';
const MONTHS = [
  'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
  'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر',
];

/** يحوّل الأرقام اللاتينية إلى أرقام عربية الشكل: 2026 ← ٢٠٢٦ */
export function arNum(value: string | number): string {
  return String(value).replace(/[0-9]/g, (d) => DIGITS[Number(d)]);
}

/** 2026-11-06 ← ٦ نوفمبر ٢٠٢٦ */
export function arDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return `${arNum(d)} ${MONTHS[m - 1]} ${arNum(y)}`;
}

/** 2:29 ← ٢:٢٩ */
export function arDuration(dur: string): string {
  return arNum(dur);
}

/** نص مقروء للمدة لقارئ الشاشة: 2:29 ← دقيقتان و٢٩ ثانية */
export function spokenDuration(dur: string): string {
  const [m, s] = dur.split(':').map(Number);
  const mins = m === 1 ? 'دقيقة' : m === 2 ? 'دقيقتان' : `${arNum(m)} دقائق`;
  return s ? `${mins} و${arNum(s)} ثانية` : mins;
}

export function toSeconds(dur: string): number {
  const [m, s] = dur.split(':').map(Number);
  return m * 60 + s;
}

/** تمييز العدد مع المعدود حسب قواعد العربية (١، ٢، ٣–١٠، ١١ فأكثر). */
export function countLabel(n: number, one: string, two: string, few: string, many: string): string {
  if (n === 1) return one;
  if (n === 2) return two;
  const mod100 = n % 100;
  if (mod100 >= 3 && mod100 <= 10) return few;
  return many;
}

export const episodesWord = (n: number) => countLabel(n, 'حلقة', 'حلقتان', 'حلقات', 'حلقة');
export const minutesWord = (n: number) => countLabel(n, 'دقيقة', 'دقيقتان', 'دقائق', 'دقيقة');

/** عبارة كاملة للعدد: ١ حلقة واحدة، ٢ حلقتان، ٨ حلقات */
export function episodesPhrase(n: number): string {
  if (n === 0) return 'لا توجد حلقات';
  if (n === 1) return 'حلقة واحدة';
  if (n === 2) return 'حلقتان';
  return `${arNum(n)} ${episodesWord(n)}`;
}

/** تطبيع النص العربي للبحث: حذف التشكيل والتطويل وتوحيد الهمزات والتاء المربوطة والياء. */
export function normalizeArabic(text: string): string {
  return text
    .toLowerCase()
    .replace(/[ً-ٰٟۖ-ۭ]/g, '')
    .replace(/ـ/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/[٠-٩]/g, (d) => String(DIGITS.indexOf(d)))
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
