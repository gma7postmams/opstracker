/**
 * Runs synchronously in <head>, before React hydrates, so the page never
 * flashes light-then-dark (or vice versa) on load. Kept as a plain string
 * rather than a .ts file bundled normally, since it must execute inline.
 */
export const THEME_INIT_SCRIPT = `
(function () {
  try {
    var stored = localStorage.getItem('opslog-theme') || 'system';
    var dark = stored === 'dark' ||
      (stored === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
  } catch (e) {}
})();
`;
