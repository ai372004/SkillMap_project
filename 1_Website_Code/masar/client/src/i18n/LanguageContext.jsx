import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { dict } from './dict.js';

const LanguageContext = createContext(null);
const STORAGE_KEY = 'masar.lang';

function readSavedLang() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved === 'en' || saved === 'ar' ? saved : 'ar';
  } catch {
    return 'ar';
  }
}

function lookup(obj, path) {
  return path.split('.').reduce((acc, key) => (acc === null || acc === undefined ? undefined : acc[key]), obj);
}

export function LanguageProvider({ children }) {
  const [lang, setLang] = useState(readSavedLang);

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch {
      /* storage may be blocked; the choice still works for this visit */
    }
  }, [lang]);

  // t('home.title') or t('quiz.progress', { n: 2, total: 15 })
  const t = useCallback(
    (key, vars) => {
      let value = lookup(dict[lang], key) ?? lookup(dict.ar, key) ?? key;
      if (typeof value === 'string' && vars) {
        value = value.replace(/\{(\w+)\}/g, (_, name) => vars[name] ?? `{${name}}`);
      }
      return value;
    },
    [lang]
  );

  // Picks the right language from content objects like { ar: '…', en: '…' }
  const pick = useCallback(
    (value) => (value && typeof value === 'object' ? (value[lang] ?? value.ar ?? '') : (value ?? '')),
    [lang]
  );

  const toggle = useCallback(() => setLang((l) => (l === 'ar' ? 'en' : 'ar')), []);

  const formatDate = useCallback(
    (date) =>
      new Intl.DateTimeFormat(lang === 'ar' ? 'ar-EG-u-nu-latn' : 'en-GB', { dateStyle: 'medium' }).format(
        new Date(date)
      ),
    [lang]
  );

  // "today", "yesterday", "3 days ago": for last-activity times.
  const formatAgo = useCallback(
    (date) => {
      const rtf = new Intl.RelativeTimeFormat(lang === 'ar' ? 'ar-EG-u-nu-latn' : 'en', { numeric: 'auto' });
      const days = Math.floor((Date.now() - new Date(date).getTime()) / 86400000);
      if (days < 30) return rtf.format(-Math.max(0, days), 'day');
      if (days < 365) return rtf.format(-Math.floor(days / 30), 'month');
      return rtf.format(-Math.floor(days / 365), 'year');
    },
    [lang]
  );

  const value = useMemo(
    () => ({ lang, setLang, toggle, t, pick, formatDate, formatAgo, dir: lang === 'ar' ? 'rtl' : 'ltr' }),
    [lang, toggle, t, pick, formatDate, formatAgo]
  );
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLang() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLang must be used inside LanguageProvider');
  return ctx;
}
