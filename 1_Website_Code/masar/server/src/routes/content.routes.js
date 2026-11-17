// Public content that anyone can read, even before logging in.
import { Router } from 'express';
import { TRACKS, getTrackContent, isTrack, publicTrackQuiz } from '../content/index.js';
import { CLOSE_MATCH_GAP, DIFFICULTY_WEIGHTS, LEVELS } from '../services/scoring.js';
import { notFound } from '../utils/httpError.js';

const router = Router();

router.get('/config', (_req, res) => {
  res.json({ levels: LEVELS, difficultyWeights: DIFFICULTY_WEIGHTS, closeMatchGap: CLOSE_MATCH_GAP });
});

router.get('/tracks', (_req, res) => {
  res.json({ tracks: TRACKS });
});

router.get('/track-quiz', (_req, res) => {
  res.json(publicTrackQuiz());
});

router.get('/tracks/:track/resources', (req, res) => {
  if (!isTrack(req.params.track)) throw notFound('UNKNOWN_TRACK', 'Unknown track');
  res.json({ resources: getTrackContent(req.params.track).resources });
});

export default router;
