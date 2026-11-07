import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { config } from './config';
import apiRouter from './routes';
import { errorHandler } from './middlewares/errorHandler';
import { generalApiRateLimiter } from './middlewares/rateLimiter';

export function createApp() {
  const app = express();

  // Production Hardening: Disable X-Powered-By fingerprint
  app.disable('x-powered-by');

  // Trust first proxy hop (Vercel Edge Rewrite Proxy / Railway ingress)
  app.set('trust proxy', 1);

  // Security Headers Middleware
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    if (config.nodeEnv === 'production') {
      res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }
    next();
  });

  // CORS configuration with credentials support
  app.use(
    cors({
      origin: (origin, callback) => {
        // Allow requests with no origin (like mobile apps, curl, or server-to-server)
        if (!origin) return callback(null, true);
        if (
          config.allowedOrigins.includes('*') ||
          config.allowedOrigins.indexOf(origin) !== -1 ||
          origin.endsWith('.vercel.app') ||
          config.nodeEnv !== 'production'
        ) {
          return callback(null, true);
        }
        return callback(new Error('Blocked by CORS policy: Origin not allowed'));
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
    })
  );

  app.use(cookieParser());
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // General DoS Protection Rate Limiting
  app.use('/api', generalApiRateLimiter);

  // API router
  app.use('/api', apiRouter);

  // Fallback 404
  app.use((req, res) => {
    res.status(404).json({
      success: false,
      message: `Cannot ${req.method} ${req.originalUrl}`,
    });
  });

  // Global Error Handler
  app.use(errorHandler);

  return app;
}
