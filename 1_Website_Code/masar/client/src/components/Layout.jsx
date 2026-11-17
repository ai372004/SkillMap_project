import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useLang } from '../i18n/LanguageContext.jsx';
import { useAuth } from '../auth/AuthContext.jsx';
import { Logo } from './Bits.jsx';
import ErrorBoundary from './ErrorBoundary.jsx';
import OfflineBanner from './OfflineBanner.jsx';
import BadgeToast from './BadgeToast.jsx';
import { useRouteEffects } from '../useRouteEffects.js';
import { refreshNotifications, resetNotifications, useUnseenReplies } from '../notifications.js';
import { useTheme } from '../theme/ThemeContext.jsx';

export default function Layout() {
  const { t, toggle, lang } = useLang();
  const { user, ready, logout } = useAuth();
  const { theme, toggleTheme, allowDark } = useTheme();
  const themeLabel = theme === 'dark' ? t('nav.toLight') : t('nav.toDark');
  const location = useLocation();
  const navigate = useNavigate();
  // The mobile menu remembers the page it was opened on, so navigating closes it
  // without an effect.
  const [openedAt, setOpenedAt] = useState(null);
  const open = openedAt === location.pathname;
  const setOpen = (next) => setOpenedAt(next ? location.pathname : null);
  useRouteEffects();
  const unseen = useUnseenReplies();
  const isStudent = user && user.role !== 'admin';

  // Check for new supervisor replies and badges on every page change and when the tab regains focus.
  const studentId = isStudent ? user.id : null;
  useEffect(() => {
    if (!studentId) return resetNotifications();
    refreshNotifications(studentId);
    const onFocus = () => document.visibilityState === 'visible' && refreshNotifications(studentId);
    document.addEventListener('visibilitychange', onFocus);
    return () => document.removeEventListener('visibilitychange', onFocus);
  }, [studentId, location.pathname]);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <div className="shell">
      <a className="skip-link" href="#main">
        {lang === 'ar' ? 'انتقل إلى المحتوى' : 'Skip to content'}
      </a>
      <header className="topbar">
        <div className="topbar__inner">
          <Link
            to={!user ? '/' : user.role === 'admin' ? '/admin' : '/dashboard'}
            className="topbar__brand"
            aria-label={t('brand')}
          >
            <Logo />
          </Link>

          <button
            type="button"
            className="topbar__menu"
            aria-expanded={open}
            aria-controls="main-nav"
            onClick={() => setOpen(!open)}
          >
            <span className="sr-only">{t('nav.menu')}</span>
            <span className="burger" aria-hidden="true" />
          </button>

          <nav id="main-nav" className={`topbar__nav${open ? ' is-open' : ''}`}>
            {user?.role === 'admin' && <NavLink to="/admin">{t('nav.admin')}</NavLink>}
            {user && user.role !== 'admin' && (
              <>
                <NavLink to="/dashboard">{t('nav.dashboard')}</NavLink>
                <NavLink to="/plan">{t('nav.plan')}</NavLink>
                <NavLink to="/tasks">
                  {t('nav.tasks')}
                  {unseen > 0 && (
                    <span className="nav-badge">
                      <span aria-hidden="true">{unseen}</span>
                      <span className="sr-only">{t('nav.newReplies', { n: unseen })}</span>
                    </span>
                  )}
                </NavLink>
              </>
            )}
            {/* Until a saved session is checked we don't know which links to show,
                so neither set appears; this avoids a flash of "Log in" on refresh. */}
            {ready && !user && (
              <>
                <NavLink to="/login">{t('nav.login')}</NavLink>
                <NavLink to="/register" className="nav-cta">
                  {t('nav.register')}
                </NavLink>
              </>
            )}
            {/* Hidden while dark mode is switched off (DARK_MODE_ENABLED in ThemeContext.jsx). */}
            {allowDark && (
              <button
                type="button"
                className="theme-toggle"
                onClick={toggleTheme}
                aria-label={themeLabel}
                title={themeLabel}
              >
                {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
              </button>
            )}
            <button type="button" className="lang-toggle" onClick={toggle} lang={lang === 'ar' ? 'en' : 'ar'}>
              {t('nav.switchLang')}
            </button>
            {user && <NavLink to="/account">{t('nav.account')}</NavLink>}
            {user && (
              <button type="button" className="link-button" onClick={handleLogout}>
                {t('nav.logout')}
              </button>
            )}
          </nav>
        </div>
      </header>

      <OfflineBanner />

      <main id="main" className="main" tabIndex={-1}>
        <ErrorBoundary resetKey={location.pathname} lang={lang}>
          <Outlet />
        </ErrorBoundary>
      </main>

      <footer className="footer">
        <p>{t('common.footer')}</p>
      </footer>

      {isStudent && <BadgeToast />}
    </div>
  );
}

function MoonIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false">
      <path
        d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SunIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false">
      <circle cx="12" cy="12" r="4.5" fill="none" stroke="currentColor" strokeWidth="2" />
      <path
        d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}
