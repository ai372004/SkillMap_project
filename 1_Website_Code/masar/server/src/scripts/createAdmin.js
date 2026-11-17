// Creates the first admin account, or promotes an existing account to admin.
// Usage: npm run create-admin   (reads ADMIN_NAME, ADMIN_EMAIL, ADMIN_PASSWORD from .env)
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { checkEnv, env } from '../config/env.js';
import { User } from '../models/User.js';

checkEnv();

const name = process.env.ADMIN_NAME || 'Masar Admin';
const email = String(process.env.ADMIN_EMAIL || '').trim().toLowerCase();
const password = process.env.ADMIN_PASSWORD || '';

if (!email || password.length < 8) {
  console.error('Set ADMIN_EMAIL and ADMIN_PASSWORD (8+ characters) in .env first.');
  process.exit(1);
}

await mongoose.connect(env.mongoUri);

const passwordHash = await bcrypt.hash(password, 10);
const existing = await User.findOne({ email });

if (existing) {
  existing.role = 'admin';
  existing.passwordHash = passwordHash;
  await existing.save();
  console.log(`Updated ${email} and made it an admin.`);
} else {
  await User.create({ name, email, passwordHash, role: 'admin' });
  console.log(`Created admin account ${email}.`);
}

await mongoose.disconnect();
