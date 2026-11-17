// Scoring logic (owned by the Data team).
//
// 1) Track quiz: every option gives points to one or more tracks
//    (3 points to its main track, sometimes 1 point to a related one).
//    A track's match percentage = points it got / most points it could get.
//    The track with the highest percentage is recommended.
//
// 2) Level test: questions are weighted by difficulty
//    (easy = 1, medium = 2, hard = 3, so 15 questions = 30 points).
//    The weighted percentage decides the level.
import { TRACK_IDS, TRACK_QUIZ, getTrackContent } from '../content/index.js';

export const DIFFICULTY_WEIGHTS = { easy: 1, medium: 2, hard: 3 };

// A student needs at least `min` percent to reach a level.
export const LEVELS = [
  { id: 'beginner', min: 0, name: { ar: 'مبتدئ', en: 'Beginner' } },
  { id: 'intermediate', min: 50, name: { ar: 'متوسط', en: 'Intermediate' } },
  { id: 'advanced', min: 80, name: { ar: 'متقدم', en: 'Advanced' } },
];

// If the top two tracks are this close, we tell the student both fit.
export const CLOSE_MATCH_GAP = 10;

export class ScoringError extends Error {
  constructor(message, details) {
    super(message);
    this.details = details;
  }
}

function findMissing(questions, answers) {
  return questions
    .filter((q) => !q.options.some((o) => o.id === answers?.[q.id]))
    .map((q) => q.id);
}

// Keeps only the answers to known questions (safe to store).
function cleanAnswers(questions, answers) {
  return Object.fromEntries(questions.map((q) => [q.id, answers[q.id]]));
}

export function levelFromPercent(percent) {
  let result = LEVELS[0];
  for (const level of LEVELS) if (percent >= level.min) result = level;
  return result.id;
}

/**
 * The student's own answers that point most strongly to `track`, so the
 * result page can say why a track was suggested. Strongest first, then in
 * question order. Unknown or missing answers are skipped.
 */
export function explainTrack(answers, track, quiz = TRACK_QUIZ, limit = 3) {
  if (!answers || !track) return [];
  const picks = [];
  quiz.questions.forEach((question, order) => {
    const chosen = question.options.find((o) => o.id === answers[question.id]);
    const got = chosen?.points?.[track] || 0;
    if (got > 0) picks.push({ got, order, question, chosen });
  });
  picks.sort((a, b) => b.got - a.got || a.order - b.order);
  return picks.slice(0, limit).map(({ question, chosen }) => ({
    questionId: question.id,
    question: question.q,
    answer: chosen.text,
  }));
}

export function scoreTrackQuiz(answers, quiz = TRACK_QUIZ) {
  const missing = findMissing(quiz.questions, answers);
  if (missing.length) throw new ScoringError('Please answer every question', { missing });

  const totals = Object.fromEntries(TRACK_IDS.map((t) => [t, { raw: 0, max: 0, primaryPicks: 0 }]));

  for (const question of quiz.questions) {
    const chosen = question.options.find((o) => o.id === answers[question.id]);
    for (const track of TRACK_IDS) {
      const best = Math.max(...question.options.map((o) => o.points[track] || 0));
      const got = chosen.points[track] || 0;
      totals[track].max += best;
      totals[track].raw += got;
      if (got > 0 && got === best) totals[track].primaryPicks += 1;
    }
  }

  const scores = TRACK_IDS.map((track, order) => {
    const { raw, max, primaryPicks } = totals[track];
    return { track, raw, max, primaryPicks, percent: max ? Math.round((raw / max) * 100) : 0, order };
  });

  // Highest percentage first; ties go to more direct picks, then to raw points.
  scores.sort((a, b) => b.percent - a.percent || b.primaryPicks - a.primaryPicks || b.raw - a.raw || a.order - b.order);
  const ranked = scores.map(({ order, ...rest }) => rest);

  return {
    answers: cleanAnswers(quiz.questions, answers),
    scores: ranked,
    recommendedTrack: ranked[0].track,
    closeMatch: ranked.length > 1 && ranked[0].percent - ranked[1].percent < CLOSE_MATCH_GAP,
  };
}

export function scoreLevelTest(trackId, answers) {
  const content = getTrackContent(trackId);
  if (!content) throw new ScoringError('Unknown track');

  const questions = content.levelTest;
  const missing = findMissing(questions, answers);
  if (missing.length) throw new ScoringError('Please answer every question', { missing });

  let correctCount = 0;
  let weightedScore = 0;
  let maxScore = 0;
  const byDifficulty = {};

  const review = questions.map((q) => {
    const weight = DIFFICULTY_WEIGHTS[q.difficulty] || 1;
    const isCorrect = answers[q.id] === q.answer;
    maxScore += weight;
    byDifficulty[q.difficulty] ??= { correct: 0, total: 0 };
    byDifficulty[q.difficulty].total += 1;
    if (isCorrect) {
      correctCount += 1;
      weightedScore += weight;
      byDifficulty[q.difficulty].correct += 1;
    }
    return { id: q.id, chosen: answers[q.id], correct: q.answer, isCorrect, explain: q.explain };
  });

  const percent = Math.round((weightedScore / maxScore) * 100);

  return {
    answers: cleanAnswers(questions, answers),
    correctCount,
    total: questions.length,
    weightedScore,
    maxScore,
    percent,
    level: levelFromPercent(percent),
    byDifficulty,
    review,
  };
}
