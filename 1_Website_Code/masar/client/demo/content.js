// Browser copy of server/src/content/index.js for the offline demo: the same
// JSON files and helpers, imported directly instead of read from disk.
// The scoring, badge and plan modules from the server import this file instead
// (see vite.demo.config.js), so the demo scores answers exactly like the server.
import TRACKS_JSON from '../../server/src/content/tracks.json';
import TRACK_QUIZ_JSON from '../../server/src/content/track-quiz.json';
import uiux from '../../server/src/content/uiux.json';
import frontend from '../../server/src/content/frontend.json';
import backend from '../../server/src/content/backend.json';
import data from '../../server/src/content/data.json';

export const TRACKS = TRACKS_JSON;
export const TRACK_IDS = TRACKS.map((t) => t.id);
export const TRACK_QUIZ = TRACK_QUIZ_JSON;

const trackContent = { uiux, frontend, backend, data };

export const isTrack = (id) => TRACK_IDS.includes(id);
export const getTrack = (id) => TRACKS.find((t) => t.id === id) || null;
export const getTrackContent = (id) => trackContent[id] || null;

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

export function publicLevelTest(trackId) {
  const content = getTrackContent(trackId);
  if (!content) return null;
  return content.levelTest.map((q) => ({ id: q.id, difficulty: q.difficulty, q: q.q, options: shuffle(q.options) }));
}
