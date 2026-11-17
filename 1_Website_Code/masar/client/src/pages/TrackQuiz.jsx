import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useLang } from '../i18n/LanguageContext.jsx';
import { useAuth } from '../auth/AuthContext.jsx';
import { useAsync } from '../hooks.js';
import { ErrorState, FormError, Loading } from '../components/States.jsx';
import QuestionRunner from '../components/QuestionRunner.jsx';
import { clearProgress, progressKey } from '../quizProgress.js';

export default function TrackQuiz() {
  const { t, pick } = useLang();
  const { user, setUser } = useAuth();
  const storageKey = progressKey(user?.id, 'track-quiz');
  const navigate = useNavigate();
  const quiz = useAsync(() => api('/track-quiz'), []);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  if (quiz.loading) return <Loading shape="quiz" />;
  if (quiz.error) return <ErrorState error={quiz.error} onRetry={quiz.reload} />;

  const finish = async (answers) => {
    setSubmitting(true);
    setError(null);
    try {
      const d = await api('/track-quiz/submit', { method: 'POST', body: { answers } });
      clearProgress(storageKey);
      setUser(d.user);
      navigate('/track-result', { state: { result: d.result } });
    } catch (err) {
      setError(err);
      setSubmitting(false);
    }
  };

  return (
    <div className="page page--narrow">
      <header className="page-head">
        <h1 className="page-title">{t('quiz.trackTitle')}</h1>
        <p className="page-lead">{pick(quiz.data.info)}</p>
      </header>
      <QuestionRunner
        questions={quiz.data.questions}
        finishLabel={t('quiz.finishTrack')}
        onFinish={finish}
        submitting={submitting}
        storageKey={storageKey}
        retakeNote={t('quiz.retakeTrack')}
        autoAdvance
      />
      <FormError error={error} />
    </div>
  );
}
