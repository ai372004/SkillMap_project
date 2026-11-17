import { useLang } from '../i18n/LanguageContext.jsx';

// Result count plus previous / next for paged admin lists.
export default function Pager({ page, pages, total, onChange, label }) {
  const { t } = useLang();
  if (!total) return null;
  return (
    <nav className="pager" aria-label={label}>
      <p className="pager__info">
        {t('admin.results', { n: total })}
        {pages > 1 && <> · {t('admin.pageOf', { page, pages })}</>}
      </p>
      {pages > 1 && (
        <div className="pager__buttons">
          <button
            type="button"
            className="btn btn--small btn--ghost"
            onClick={() => onChange(page - 1)}
            disabled={page <= 1}
          >
            {t('common.back')}
          </button>
          <button
            type="button"
            className="btn btn--small btn--ghost"
            onClick={() => onChange(page + 1)}
            disabled={page >= pages}
          >
            {t('common.next')}
          </button>
        </div>
      )}
    </nav>
  );
}
