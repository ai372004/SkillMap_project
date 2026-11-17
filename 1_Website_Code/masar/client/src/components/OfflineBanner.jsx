import { useEffect, useState } from 'react';
import { useLang } from '../i18n/LanguageContext.jsx';

// A small bar while the browser reports it is offline.
export default function OfflineBanner() {
  const { t } = useLang();
  const [online, setOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine));

  useEffect(() => {
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener('online', up);
    window.addEventListener('offline', down);
    return () => {
      window.removeEventListener('online', up);
      window.removeEventListener('offline', down);
    };
  }, []);

  if (online) return null;
  return (
    <div className="offline" role="status" aria-live="polite">
      {t('common.offline')}
    </div>
  );
}
