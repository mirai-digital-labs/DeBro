import { Request, Response, NextFunction } from 'express';

/**
 * Standard OWASP Recommended HTTP Security Headers
 */
export function securityHeadersMiddleware(req: Request, res: Response, next: NextFunction) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.removeHeader('X-Powered-By');
  next();
}

interface RateLimitRecord {
  count: number;
  resetTime: number;
}

/**
 * Sliding Window In-Memory Rate Limiter
 */
export function createRateLimiter(options: {
  windowMs: number;
  maxRequests: number;
  message?: string;
  skipCondition?: (req: Request) => boolean;
}) {
  const store = new Map<string, RateLimitRecord>();

  // Cleanup expired entries periodically
  setInterval(() => {
    const now = Date.now();
    for (const [key, record] of store.entries()) {
      if (now > record.resetTime) {
        store.delete(key);
      }
    }
  }, options.windowMs).unref();

  return (req: Request, res: Response, next: NextFunction) => {
    if (options.skipCondition && options.skipCondition(req)) {
      return next();
    }

    const clientIp =
      (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1';
    const key = `${clientIp}_${req.baseUrl || req.path}`;
    const now = Date.now();

    let record = store.get(key);
    if (!record || now > record.resetTime) {
      record = {
        count: 1,
        resetTime: now + options.windowMs,
      };
      store.set(key, record);
    } else {
      record.count++;
    }

    const remaining = Math.max(0, options.maxRequests - record.count);
    const resetSeconds = Math.ceil((record.resetTime - now) / 1000);

    res.setHeader('X-RateLimit-Limit', options.maxRequests);
    res.setHeader('X-RateLimit-Remaining', remaining);
    res.setHeader('X-RateLimit-Reset', resetSeconds);

    if (record.count > options.maxRequests) {
      return res.status(429).json({
        success: false,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message:
            options.message ||
            `Too many requests from this client. Please retry after ${resetSeconds} seconds.`,
          retryAfterSeconds: resetSeconds,
        },
      });
    }

    next();
  };
}
