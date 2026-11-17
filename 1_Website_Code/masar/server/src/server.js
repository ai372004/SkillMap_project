import mongoose from 'mongoose';
import { checkEnv, env } from './config/env.js';
import { createApp } from './app.js';
import { ensureAdmin } from './services/ensureAdmin.js';

checkEnv();

try {
  await mongoose.connect(env.mongoUri);
  console.log('Connected to MongoDB');
} catch (err) {
  console.error('Could not connect to MongoDB. Check MONGO_URI in .env');
  console.error(err.message);
  process.exit(1);
}

await ensureAdmin();

createApp().listen(env.port, () => {
  console.log(`Masar API running on http://localhost:${env.port}`);
});
