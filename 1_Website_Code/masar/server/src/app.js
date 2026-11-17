import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import mongoose from 'mongoose';
import { env } from './config/env.js';
import authRoutes from './routes/auth.routes.js';
import contentRoutes from './routes/content.routes.js';
import studentRoutes from './routes/student.routes.js';
import adminRoutes from './routes/admin.routes.js';
import { errorHandler, notFoundHandler } from './middleware/errors.js';

export function createApp() {
  const app = express();

  app.set('trust proxy', 1);
  // Strict security headers. The React app has no inline scripts and loads nothing
  // from other sites; inline style attributes are allowed for track colours.
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:'],
          fontSrc: ["'self'", 'data:'],
          connectSrc: ["'self'"],
          objectSrc: ["'none'"],
          frameAncestors: ["'none'"],
          baseUri: ["'self'"],
          formAction: ["'self'"],
        },
      },
    })
  );
  // gzip every text response: the app's JavaScript shrinks to about a third.
  app.use(compression());
  app.use(cors({ origin: env.clientUrls }));
  app.use(express.json({ limit: '100kb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, db: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected' });
  });

  app.use('/api/auth', authRoutes);
  app.use('/api', contentRoutes);
  app.use('/api/admin', adminRoutes);
  app.use('/api', studentRoutes);
  app.use('/api', notFoundHandler);

  // In production the API can also serve the built React app (client/dist),
  // so the whole platform runs as one service.
  const clientDist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../client/dist');
  // Files in /assets have a content hash in their names, so browsers may keep
  // them for a year; index.html is always re-checked so a new deploy shows at once.
  if (existsSync(clientDist)) {
    const assetsDir = `${path.sep}assets${path.sep}`;
    app.use(
      express.static(clientDist, {
        setHeaders(res, filePath) {
          res.setHeader('Cache-Control', filePath.includes(assetsDir) ? 'public, max-age=31536000, immutable' : 'no-cache');
        },
      })
    );
    app.use((req, res, next) => {
      if (req.method !== 'GET') return next();
      res.setHeader('Cache-Control', 'no-cache');
      res.sendFile(path.join(clientDist, 'index.html'));
    });
  }

  app.use(errorHandler);
  return app;
}
