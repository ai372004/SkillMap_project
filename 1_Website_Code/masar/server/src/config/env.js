import 'dotenv/config';

const required = ['MONGO_URI', 'JWT_SECRET'];

export function checkEnv() {
  const missing = required.filter((key) => !process.env[key]);
  if (missing.length) {
    throw new Error(`Missing environment variables: ${missing.join(', ')}. Copy .env.example to .env and fill it in.`);
  }
  if (process.env.NODE_ENV === 'production') {
    const secret = process.env.JWT_SECRET;
    if (secret.length < 32 || secret.startsWith('change-me')) {
      throw new Error('JWT_SECRET must be a random string of at least 32 characters in production.');
    }
  }
}

export const env = {
  port: Number(process.env.PORT) || 5000,
  mongoUri: process.env.MONGO_URI,
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  clientUrls: (process.env.CLIENT_URL || 'http://localhost:5173')
    .split(',')
    .map((url) => url.trim())
    .filter(Boolean),
  isProduction: process.env.NODE_ENV === 'production',
};
