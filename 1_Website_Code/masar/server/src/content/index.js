// Loads the platform content (tracks, questions, tasks, plans, resources)
// from the JSON files in this folder, and prepares safe public versions of it.
// Each track team edits its own JSON file only.
import { readFileSync } from 'node:fs';

const load = (file) => JSON.parse(readFileSync(new URL(file, import.meta.url), 'utf8'));

export const TRACKS = load('./tracks.json');
export const TRACK_IDS = TRACKS.map((t) => t.id);
export const TRACK_QUIZ = load('./track-quiz.json');

const trackContent = Object.fromEntries(TRACK_IDS.map((id) => [id, load(`./${id}.json`)]));

export const isTrack = (id) => TRACK_IDS.includes(id);

export function getTrack(id) {
  return TRACKS.find((t) => t.id === id) || null;
}

export function getTrackContent(id) {
  return trackContent[id] || null;
}

export function findTask(taskId) {
  for (const id of TRACK_IDS) {
    const task = trackContent[id].tasks.find((t) => t.id === taskId);
    if (task) return { ...task, track: id };
  }
  return null;
}

function shuffle(list) {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

// Track quiz without the points, with options shuffled so the
// tracks don't always appear in the same position.
export function publicTrackQuiz() {
  return {
    info: TRACK_QUIZ.info,
    questions: TRACK_QUIZ.questions.map((q) => ({
      id: q.id,
      q: q.q,
      options: shuffle(q.options.map(({ id, text }) => ({ id, text }))),
    })),
  };
}

// Level test without the correct answers or explanations.
export function publicLevelTest(trackId) {
  const content = getTrackContent(trackId);
  if (!content) return null;
  return content.levelTest.map((q) => ({
    id: q.id,
    difficulty: q.difficulty,
    q: q.q,
    options: shuffle(q.options),
  }));
}
