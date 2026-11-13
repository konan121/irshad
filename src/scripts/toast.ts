let timer: number | undefined;

/** يعرض رسالة قصيرة أسفل الشاشة، ويقرؤها قارئ الشاشة عبر aria-live. */
export function toast(message: string) {
  const el = document.querySelector<HTMLElement>('[data-toast]');
  const live = document.querySelector<HTMLElement>('[data-live]');
  if (live) live.textContent = message;
  if (!el) return;
  el.textContent = message;
  el.classList.add('show');
  window.clearTimeout(timer);
  timer = window.setTimeout(() => el.classList.remove('show'), 2400);
}
