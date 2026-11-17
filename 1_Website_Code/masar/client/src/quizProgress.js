// Saves a student's answers while they work through a quiz, so closing the
// tab or losing the connection doesn't send them back to question 1.
// Stored per student and per quiz in this browser only; cleared on submit.
const PREFIX = 'masar.progress.';
const MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000;

export const progressKey = (userId, quiz) => `${PREFIX}${userId || 'guest'}.${quiz}`;

/**
 * Returns `{ answers, index }` restored for these questions, or null.
 * Answers that no longer match a question or option are dropped, so a
 * content update never leaves the quiz in an impossible state.
 */
export function loadProgress(key, questions) {
  let saved;
  try {
    saved = JSON.parse(localStorage.getItem(key) || 'null');
  } catch {
    return null;
  }
  if (!saved || typeof saved !== 'object' || Date.now() - (saved.at || 0) > MAX_AGE_MS) return null;

  const answers = {};
  for (const q of questions) {
    const choice = saved.answers?.[q.id];
    if (choice && q.options.some((o) => o.id === choice)) answers[q.id] = choice;
  }
  if (!Object.keys(answers).length) return null;

  const index = Math.max(
    0,
    questions.findIndex((q) => q.id === saved.current)
  );
  return { answers, index };
}

/** How many answers are saved for this quiz (0 when none or expired). */
export function savedAnswerCount(key) {
  try {
    const saved = JSON.parse(localStorage.getItem(key) || 'null');
    if (!saved || Date.now() - (saved.at || 0) > MAX_AGE_MS) return 0;
    return Object.keys(saved.answers || {}).length;
  } catch {
    return 0;
  }
}

export function hasProgress(key) {
  try {
    return !!localStorage.getItem(key);
  } catch {
    return false;
  }
}

export function saveProgress(key, answers, currentId) {
  try {
    if (!Object.keys(answers).length) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify({ answers, current: currentId, at: Date.now() }));
  } catch {
    /* storage blocked or full: the quiz still works, it just won't resume */
  }
}

export function clearProgress(key) {
  try {
    localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}
