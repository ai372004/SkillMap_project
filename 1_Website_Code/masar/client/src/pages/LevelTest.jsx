import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api.js';
import { useLang } from '../i18n/LanguageContext.jsx';
import { useAsync } from '../hooks.js';
import { ErrorState, FormError, Loading } from '../components/States.jsx';
import QuestionRunner from '../components/QuestionRunner.jsx';
import { useAuth } from '../auth/AuthContext.jsx';
import { clearProgress, progressKey } from '../quizProgress.js';

export default function LevelTest() {
  const { track: trackId } = useParams();
  const { t, pick, formatDate } = useLang();
  const navigate = useNavigate();
  const { user } = useAuth();
  const storageKey = progressKey(user?.id, `level-${trackId}`);
  const test = useAsync(() => api(`/tracks/${trackId}/level-test`), [trackId]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  if (test.loading) return <Loading shape="quiz" />;
  // Taken recently: the test reopens after a few days (see LEVEL_RETAKE_DAYS on the server).
  if (test.error?.code === 'RETAKE_TOO_SOON' && test.error.details?.retakeAt) {
    return (
      <div className="page page--narrow">
        <header className="page-head">
          <h1 className="page-title">{t('quiz.levelLockedTitle')}</h1>
          <p className="page-lead">{t('quiz.levelLocked', { date: formatDate(test.error.details.retakeAt) })}</p>
        </header>
        <div className="page-actions">
          <Link to="/plan" className="btn btn--primary">
            {t('levelResult.openPlan')}
          </Link>
          <Link to={`/level-result/${trackId}`} className="btn btn--ghost">
            {t('levelResult.short')}
          </Link>
        </div>
      </div>
    );
  }
  if (test.error) return <ErrorState error={test.error} onRetry={test.reload} />;

  const { track, questions } = test.data;

  const finish = async (answers) => {
    setSubmitting(true);
    setError(null);
    try {
      const d = await api(`/tracks/${trackId}/level-test/submit`, { method: 'POST', body: { answers } });
      clearProgress(storageKey);
      navigate(`/level-result/${trackId}`, { state: { result: d.result, review: d.review, questions } });
    } catch (err) {
      setError(err);
      setSubmitting(false);
    }
  };

  return (
    <div className="page page--narrow" style={{ '--track-base': track.color }}>
      <header className="page-head">
        <h1 className="page-title">{t('quiz.levelTitle', { track: pick(track.name) })}</h1>
        <p className="page-lead">{t('quiz.levelInfo')}</p>
      </header>
      <QuestionRunner
        questions={questions}
        color={track.color}
        finishLabel={t('quiz.finishLevel')}
        onFinish={finish}
        submitting={submitting}
        showDifficulty
        storageKey={storageKey}
        retakeNote={t('quiz.retakeLevel')}
      />
      <FormError error={error} />
    </div>
  );
}
