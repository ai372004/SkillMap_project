import bcrypt from 'bcryptjs';
import { User } from '../models/User.js';

// On start-up, create the first supervisor account from ADMIN_* when the
// database has no admin yet. Hosting plans without a shell can't run
// "npm run create-admin", so this makes the first deployment self-contained.
export async function ensureAdmin() {
  if (await User.exists({ role: 'admin' })) return false;
  const email = String(process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD || '';
  if (!email || password.length < 8) return false;

  const passwordHash = await bcrypt.hash(password, 10);
  await User.create({ name: process.env.ADMIN_NAME || 'Masar Admin', email, passwordHash, role: 'admin' });
  console.log(`Created the first admin account (${email}).`);
  return true;
}
