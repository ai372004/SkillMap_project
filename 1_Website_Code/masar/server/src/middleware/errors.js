import mongoose from 'mongoose';
import { HttpError } from '../utils/httpError.js';
import { ScoringError } from '../services/scoring.js';

export function notFoundHandler(req, res) {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: `No route for ${req.method} ${req.originalUrl}` } });
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, _req, res, _next) {
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: { code: err.code, message: err.message, details: err.details } });
  }
  if (err instanceof ScoringError) {
    return res.status(400).json({ error: { code: 'INCOMPLETE_ANSWERS', message: err.message, details: err.details } });
  }
  if (err instanceof mongoose.Error.ValidationError) {
    const fields = Object.keys(err.errors);
    return res.status(400).json({ error: { code: 'VALIDATION', message: 'Invalid data', details: { fields } } });
  }
  if (err instanceof mongoose.Error.CastError) {
    return res.status(400).json({ error: { code: 'INVALID_ID', message: 'Invalid id' } });
  }
  if (err?.code === 11000) {
    return res.status(409).json({ error: { code: 'DUPLICATE', message: 'This record already exists' } });
  }
  if (err?.type === 'entity.parse.failed') {
    return res.status(400).json({ error: { code: 'INVALID_JSON', message: 'Request body is not valid JSON' } });
  }
  console.error(err);
  return res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Something went wrong' } });
}
