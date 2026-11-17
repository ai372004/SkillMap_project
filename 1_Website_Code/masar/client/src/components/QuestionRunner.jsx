import { useEffect, useRef, useState } from 'react';
import { useLang } from '../i18n/LanguageContext.jsx';
import { Rich, latinProps } from './Bits.jsx';
import { clearProgress, loadProgress, saveProgress } from '../quizProgress.js';

const AUTO_ADVANCE_MS = 450;
const MILESTONE_MS = 3200;

// The progress rail drawn as a small metro line: answered stations fill in
// the track colour and a "train" marks the current question.
function MetroProgress({ questions, answers, index, reviewing }) {
  const last = Math.max(1, questions.length - 1);
  const at = reviewing ? 100 : (index / last) * 100;
  return (
    <div className="metro" aria-hidden="true">
      <span className="metro__line" />
      <span className="metro__done" style={{ inlineSize: `${at}%` }} />
      {questions.map((q, i) => (
        <span
          key={q.id}
          className={`metro__stop${answers[q.id] ? ' is-answered' : ''}`}
          style={{ insetInlineStart: `${(i / last) * 100}%` }}
        />
      ))}
      <span className="metro__train" style={{ insetInlineStart: `${at}%` }} />
    </div>
  );
}

// Encouragement at fixed points of a longer quiz.
function milestoneFor(nextIndex, total) {
  if (total < 8) return null;
  const left = total - nextIndex;
  if (left === 1) return { key: 'quiz.milestoneLast' };
  if (left === 3) return { key: 'quiz.milestoneNear', vars: { n: 3 } };
  if (nextIndex === Math.floor(total / 2)) return { key: 'quiz.milestoneHalf' };
  return null;
}

// Shows one question at a time, then a review step before submitting.
// Used for both the track questions and the level test.
// With `storageKey`, answers are saved as the student goes and restored if
// they come back later; the page clears them after a successful submit.
// With `autoAdvance`, a mouse or touch choice moves to the next question;
// keyboard choices never do, so arrow keys can still move between options.
export default function QuestionRunner({
  questions,
  color,
  finishLabel,
  onFinish,
  submitting,
  showDifficulty,
  storageKey,
  retakeNote,
  autoAdvance = false,
}) {
  const { t, pick } = useLang();
  const [restored] = useState(() => (storageKey ? loadProgress(storageKey, questions) : null));
  const [index, setIndex] = useState(restored?.index ?? 0);
  const [answers, setAnswers] = useState(restored?.answers ?? {});
  const [showResumed, setShowResumed] = useState(!!restored);
  const [reviewing, setReviewing] = useState(false);
  const [hint, setHint] = useState('');
  const [milestone, setMilestone] = useState(null);
  const headingRef = useRef(null);
  const reviewRef = useRef(null);
  const firstRender = useRef(true);
  const pointerChoice = useRef(false);
  const advanceTimer = useRef(null);

  const question = questions[index];
  const isLast = index === questions.length - 1;
  const chosen = answers[question.id];
  const answeredCount = Object.keys(answers).length;
  const missing = questions.filter((q) => !answers[q.id]);

  // Move focus to the new question (or the review) for keyboard and screen-reader users,
  // but not on first load, where the page title should be read first.
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    (reviewing ? reviewRef : headingRef).current?.focus({ preventScroll: true });
  }, [index, reviewing]);

  useEffect(() => {
    if (storageKey) saveProgress(storageKey, answers, question.id);
  }, [storageKey, answers, question.id]);

  useEffect(() => {
    if (!milestone) return undefined;
    const id = setTimeout(() => setMilestone(null), MILESTONE_MS);
    return () => clearTimeout(id);
  }, [milestone]);

  useEffect(() => () => clearTimeout(advanceTimer.current), []);

  const advanceFrom = (from) => {
    clearTimeout(advanceTimer.current);
    setShowResumed(false);
    setHint('');
    if (from >= questions.length - 1) {
      setReviewing(true);
      return;
    }
    setMilestone(milestoneFor(from + 1, questions.length));
    setIndex(from + 1);
  };

  const choose = (optionId) => {
    setAnswers((a) => ({ ...a, [question.id]: optionId }));
    setHint('');
    const byPointer = pointerChoice.current;
    pointerChoice.current = false;
    clearTimeout(advanceTimer.current);
    if (autoAdvance && byPointer && !isLast) {
      const from = index;
      advanceTimer.current = setTimeout(() => advanceFrom(from), AUTO_ADVANCE_MS);
    }
  };

  const goTo = (i) => {
    clearTimeout(advanceTimer.current);
    setShowResumed(false);
    setReviewing(false);
    setHint('');
    setIndex(i);
  };

  const next = () => {
    if (!chosen) return setHint(t('quiz.chooseFirst'));
    advanceFrom(index);
  };

  const submit = () => {
    if (missing.length) return setHint(t('quiz.unanswered', { n: missing.length }));
    onFinish(answers);
  };

  const startOver = () => {
    if (storageKey) clearProgress(storageKey);
    setAnswers({});
    setMilestone(null);
    goTo(0);
  };

  return (
    <div className="runner" style={{ '--track-base': color || 'var(--primary)' }}>
      {showResumed && (
        <div className="runner__resumed" role="status">
          <p>{t('quiz.resumed', { n: answeredCount, total: questions.length })}</p>
          <button type="button" className="link-button" onClick={startOver}>
            {t('quiz.startOver')}
          </button>
        </div>
      )}

      <MetroProgress questions={questions} answers={answers} index={index} reviewing={reviewing} />

      {reviewing ? (
        <section className="review" aria-labelledby="review-title">
          <h2 id="review-title" ref={reviewRef} tabIndex={-1} className="runner__title">
            {t('quiz.reviewTitle')}
          </h2>
          <p className="review__info">{t('quiz.reviewInfo', { n: answeredCount, total: questions.length })}</p>
          <ol className="review__grid">
            {questions.map((q, i) => {
              const done = !!answers[q.id];
              return (
                <li key={q.id}>
                  <button
                    type="button"
                    className={`review__cell${done ? ' is-answered' : ' is-missing'}`}
                    onClick={() => goTo(i)}
                    aria-label={t(done ? 'quiz.goToAnswered' : 'quiz.goToMissing', { n: i + 1 })}
                  >
                    {i + 1}
                  </button>
                </li>
              );
            })}
          </ol>
          {retakeNote && <p className="review__note">{retakeNote}</p>}
          <p className="runner__hint" role="status" aria-live="polite">
            {hint}
          </p>
          <div className="runner__actions">
            <button type="button" className="btn btn--ghost" onClick={() => goTo(index)} disabled={submitting}>
              {t('quiz.keepReviewing')}
            </button>
            <button type="button" className="btn btn--primary" onClick={submit} disabled={submitting}>
              {submitting ? t('common.loading') : finishLabel}
            </button>
          </div>
        </section>
      ) : (
        <>
          <div className="runner__meta">
            <span role="status" aria-live="polite" aria-atomic="true">
              {t('quiz.progress', { n: index + 1, total: questions.length })}
            </span>
            {showDifficulty && question.difficulty && (
              <span className={`difficulty difficulty--${question.difficulty}`}>
                {t(`difficulty.${question.difficulty}`)}
              </span>
            )}
          </div>

          <p className={`milestone${milestone ? ' is-visible' : ''}`} role="status" aria-live="polite">
            {milestone ? t(milestone.key, milestone.vars) : ''}
          </p>

          <fieldset className="runner__question" key={question.id}>
            <legend>
              <h2 ref={headingRef} tabIndex={-1} className="runner__title">
                <Rich text={pick(question.q)} />
              </h2>
            </legend>
            <div className="options">
              {question.options.map((o) => (
                <label
                  key={o.id}
                  className={`option${chosen === o.id ? ' is-chosen' : ''}`}
                  onPointerDown={() => {
                    pointerChoice.current = true;
                  }}
                >
                  <input
                    type="radio"
                    name={question.id}
                    value={o.id}
                    checked={chosen === o.id}
                    onChange={() => choose(o.id)}
                    onKeyDown={() => {
                      pointerChoice.current = false;
                    }}
                  />
                  <span className="option__mark" aria-hidden="true">
                    <svg viewBox="0 0 16 16" width="12" height="12" focusable="false">
                      <path d="M3.5 8.5l3 3 6-7" />
                    </svg>
                  </span>
                  <span className="option__text">
                    <span {...latinProps(pick(o.text))}>
                      <Rich text={pick(o.text)} />
                    </span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          <p className="runner__hint" role="status" aria-live="polite">
            {hint}
          </p>

          <div className="runner__actions">
            <button type="button" className="btn btn--ghost" onClick={() => goTo(index - 1)} disabled={index === 0}>
              {t('common.back')}
            </button>
            <span className="runner__count" aria-hidden="true">
              {answeredCount}/{questions.length}
            </span>
            <button type="button" className="btn btn--primary" onClick={next}>
              {isLast ? t('quiz.review') : t('common.next')}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
