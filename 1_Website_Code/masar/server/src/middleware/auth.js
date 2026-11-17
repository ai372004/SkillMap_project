import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { User } from '../models/User.js';
import { forbidden, unauthorized } from '../utils/httpError.js';

const SEEN_EVERY_MS = 60 * 60 * 1000;

export function signToken(user) {
  return jwt.sign({ sub: user.id, role: user.role, v: user.tokenVersion || 0 }, env.jwtSecret, { expiresIn: env.jwtExpiresIn });
}

// Reads "Authorization: Bearer <token>" and loads the user into req.user.
export async function requireAuth(req, _res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) throw unauthorized();

  let payload;
  try {
    payload = jwt.verify(token, env.jwtSecret);
  } catch {
    throw unauthorized('INVALID_TOKEN', 'Session expired, please log in again');
  }

  const user = await User.findById(payload.sub).select('+tokenVersion');
  if (!user) throw unauthorized('INVALID_TOKEN', 'Account no longer exists');
  // A password change or reset raises tokenVersion and signs out older sessions.
  if ((payload.v || 0) !== (user.tokenVersion || 0)) throw unauthorized('INVALID_TOKEN', 'Session expired, please log in again');

  // Record activity, but write at most once an hour per student.
  if (!user.lastSeenAt || Date.now() - user.lastSeenAt.getTime() > SEEN_EVERY_MS) {
    user.lastSeenAt = new Date();
    await User.updateOne({ _id: user._id }, { $set: { lastSeenAt: user.lastSeenAt } });
  }

  req.user = user;
  next();
}

export function requireAdmin(req, _res, next) {
  if (req.user?.role !== 'admin') throw forbidden('ADMIN_ONLY', 'Admins only');
  next();
}
