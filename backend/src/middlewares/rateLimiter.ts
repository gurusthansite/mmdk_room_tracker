import { Request, Response, NextFunction } from 'express';

interface AttemptRecord {
  count: number;
  firstAttemptTime: number;
  blockedUntil?: number;
}

const attemptsMap = new Map<string, AttemptRecord>();

const WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const MAX_ATTEMPTS = 5;            // 5 failed attempts
const BLOCK_DURATION_MS = 15 * 60 * 1000; // Block for 15 minutes

export function getClientIp(req: Request): string {
  // 1. Prefer x-real-ip if set by edge reverse proxies (Vercel, Cloudflare)
  const realIp = req.headers['x-real-ip'];
  if (typeof realIp === 'string' && realIp.trim()) {
    return realIp.trim();
  }
  // 2. Trust proxy configured in Express (req.ip resolves the verified client address)
  if (req.ip) {
    return req.ip;
  }
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim();
  }
  return req.socket.remoteAddress || '127.0.0.1';
}

export function loginRateLimiter(req: Request, res: Response, next: NextFunction) {
  const ip = getClientIp(req);
  const now = Date.now();
  const record = attemptsMap.get(ip);

  if (record) {
    if (record.blockedUntil && record.blockedUntil > now) {
      const waitSeconds = Math.ceil((record.blockedUntil - now) / 1000);
      return res.status(429).json({
        success: false,
        message: `Too many failed login attempts. Please try again after ${waitSeconds} seconds.`,
        retryAfterSeconds: waitSeconds,
      });
    }

    // Reset if window has elapsed
    if (now - record.firstAttemptTime > WINDOW_MS) {
      attemptsMap.delete(ip);
    }
  }

  next();
}

export function recordFailedLogin(ip: string) {
  const now = Date.now();
  const record = attemptsMap.get(ip) || { count: 0, firstAttemptTime: now };

  record.count += 1;

  if (record.count >= MAX_ATTEMPTS) {
    record.blockedUntil = now + BLOCK_DURATION_MS;
  }

  attemptsMap.set(ip, record);
}

export function resetLoginAttempts(ip: string) {
  attemptsMap.delete(ip);
}

// ----------------------------------------------------------------------------
// GENERAL API RATE LIMITER (DoS Protection for all /api endpoints)
// ----------------------------------------------------------------------------
const generalApiMap = new Map<string, { count: number; windowStart: number }>();
const API_WINDOW_MS = 60 * 1000; // 1 minute
const MAX_API_REQUESTS = 600;    // 600 req/min per IP

export function generalApiRateLimiter(req: Request, res: Response, next: NextFunction) {
  const ip = getClientIp(req);
  const now = Date.now();
  const entry = generalApiMap.get(ip);

  if (!entry || now - entry.windowStart > API_WINDOW_MS) {
    generalApiMap.set(ip, { count: 1, windowStart: now });
    return next();
  }

  entry.count += 1;
  if (entry.count > MAX_API_REQUESTS) {
    const retrySec = Math.ceil((entry.windowStart + API_WINDOW_MS - now) / 1000);
    return res.status(429).json({
      success: false,
      message: `API rate limit exceeded. Please wait ${retrySec} seconds before sending more requests.`,
      retryAfterSeconds: retrySec,
    });
  }

  next();
}
