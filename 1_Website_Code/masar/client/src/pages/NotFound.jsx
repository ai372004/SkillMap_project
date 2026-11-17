import { Link } from 'react-router-dom';
import { useLang } from '../i18n/LanguageContext.jsx';
import EmptyState from '../components/EmptyState.jsx';

export default function NotFound() {
  const { t } = useLang();
  return (
    <div className="page page--narrow not-found">
      <EmptyState art="lost" title={t('notFound.title')} text={t('notFound.text')} headingLevel={1}>
        <Link to="/" className="btn btn--primary">
          {t('notFound.back')}
        </Link>
      </EmptyState>
    </div>
  );
}
