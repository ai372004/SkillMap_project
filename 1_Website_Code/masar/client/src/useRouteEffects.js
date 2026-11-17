import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useLang } from './i18n/LanguageContext.jsx';

// Page-level behaviour that every screen shares:
// - scroll to the top and move focus to the main region on navigation
// - set the document title from the route
const TITLE_KEYS = [
  ['/admin', 'admin.title'],
  ['/dashboard', 'nav.dashboard'],
  ['/track-quiz', 'quiz.trackTitle'],
  ['/track-result', 'trackResult.title'],
  ['/level-test', 'quiz.levelShort'],
  ['/level-result', 'levelResult.short'],
  ['/plan', 'nav.plan'],
  ['/tasks', 'nav.tasks'],
  ['/account', 'account.title'],
  ['/login', 'auth.loginTitle'],
  ['/register', 'auth.registerTitle'],
];

export function useRouteEffects() {
  const { pathname } = useLocation();
  const { t, lang } = useLang();

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    const main = document.getElementById('main');
    // Keep the browser's own focus on the first load; move it on later navigations.
    if (main && document.activeElement && document.activeElement !== document.body) main.focus({ preventScroll: true });
  }, [pathname]);

  useEffect(() => {
    const match = TITLE_KEYS.find(([prefix]) => pathname === prefix || pathname.startsWith(prefix + '/'));
    const brand = 'skillmap';
    document.title = match
      ? `${t(match[1])} | ${brand}`
      : lang === 'ar'
        ? 'skillmap | منصة المسارات التقنية'
        : 'skillmap | Tech track guidance';
  }, [pathname, lang, t]);
}
