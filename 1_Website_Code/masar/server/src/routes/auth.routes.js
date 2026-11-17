import { Router } from 'express';
import bcrypt from 'bcryptjs';
import rateLimit from 'express-rate-limit';
import { User } from '../models/User.js';
import { requireAuth, signToken } from '../middleware/auth.js';
import { badRequest, conflict, unauthorized } from '../utils/httpError.js';

const router = Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: Number(process.env.AUTH_RATE_LIMIT) || 30,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: { code: 'TOO_MANY_ATTEMPTS', message: 'Too many attempts, try again later' } },
});

router.post('/register', authLimiter, async (req, res) => {
  const name = String(req.body?.name || '').trim();
  const email = String(req.body?.email || '').trim().toLowerCase();
  const password = String(req.body?.password || '');
  const university = String(req.body?.university || '').trim();
  const academicYear = String(req.body?.academicYear || '').trim();

  const fields = [];
  if (name.length < 2 || name.length > 80) fields.push('name');
  if (!EMAIL_RE.test(email) || email.length > 120) fields.push('email');
  if (password.length < 8 || password.length > 72) fields.push('password');
  if (fields.length) throw badRequest('VALIDATION', 'Invalid data', { fields });

  if (await User.exists({ email })) throw conflict('EMAIL_TAKEN', 'This email is already registered');

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await User.create({ name, email, passwordHash, university, academicYear, lastSeenAt: new Date() });

  res.status(201).json({ token: signToken(user), user });
});

router.post('/login', authLimiter, async (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  const password = String(req.body?.password || '');
  if (!email || !password) throw badRequest('VALIDATION', 'Email and password are required', { fields: ['email', 'password'] });

  const user = await User.findOne({ email }).select('+passwordHash +tokenVersion');
  const ok = user && (await bcrypt.compare(password, user.passwordHash));
  if (!ok) throw unauthorized('INVALID_CREDENTIALS', 'Wrong email or password');

  user.lastSeenAt = new Date();
  await User.updateOne({ _id: user._id }, { $set: { lastSeenAt: user.lastSeenAt } });
  res.json({ token: signToken(user), user });
});

router.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user });
});

// Update your own profile (not email or role).
router.patch('/me', requireAuth, async (req, res) => {
  const name = String(req.body?.name ?? req.user.name).trim();
  const university = String(req.body?.university ?? req.user.university ?? '').trim();
  const academicYear = String(req.body?.academicYear ?? req.user.academicYear ?? '').trim();

  const fields = [];
  if (name.length < 2 || name.length > 80) fields.push('name');
  if (university.length > 120) fields.push('university');
  if (academicYear.length > 40) fields.push('academicYear');
  if (fields.length) throw badRequest('VALIDATION', 'Invalid data', { fields });

  Object.assign(req.user, { name, university, academicYear });
  await req.user.save();
  res.json({ user: req.user });
});

// Change your password. Other sessions are signed out; this one gets a fresh token.
router.post('/change-password', authLimiter, requireAuth, async (req, res) => {
  const currentPassword = String(req.body?.currentPassword || '');
  const newPassword = String(req.body?.newPassword || '');
  if (newPassword.length < 8 || newPassword.length > 72) throw badRequest('VALIDATION', 'Invalid data', { fields: ['newPassword'] });

  const user = await User.findById(req.user._id).select('+passwordHash +tokenVersion');
  if (!(await bcrypt.compare(currentPassword, user.passwordHash))) {
    throw badRequest('WRONG_PASSWORD', 'Current password is wrong', { fields: ['currentPassword'] });
  }
  if (await bcrypt.compare(newPassword, user.passwordHash)) {
    throw badRequest('SAME_PASSWORD', 'Choose a password different from the current one', { fields: ['newPassword'] });
  }

  user.passwordHash = await bcrypt.hash(newPassword, 10);
  user.tokenVersion = (user.tokenVersion || 0) + 1;
  user.mustChangePassword = false;
  await user.save();
  res.json({ token: signToken(user), user });
});

export default router;
