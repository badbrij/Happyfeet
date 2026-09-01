import { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';

// 1. Auth Rate Limiter (Login, Register, OTP) - Max 15 requests / 15 minutes
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many authentication attempts. Please try again after 15 minutes.'
  }
});

// 2. Step Sync Rate Limiter - Max 30 sync requests / 15 minutes
export const stepSyncRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Step synchronization rate limit exceeded. Please wait a moment before syncing again.'
  }
});

// 3. Admin Rate Limiter - Max 40 requests / 15 minutes
export const adminRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 40,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Admin operation rate limit exceeded.'
  }
});

// 4. Global API Rate Limiter - Max 150 requests / 15 minutes
export const globalApiRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 150,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many API requests from this IP address. Please slow down.'
  }
});

// 5. Input Sanitizer & XSS Filter Middleware
export const sanitizeInputs = (req: Request, _res: Response, next: NextFunction) => {
  const sanitizeObject = (obj: any) => {
    if (!obj || typeof obj !== 'object') return;

    for (const key in obj) {
      if (typeof obj[key] === 'string') {
        // Strip dangerous script tags and inline event handlers
        obj[key] = obj[key]
          .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
          .replace(/javascript:/gi, '')
          .replace(/onerror=/gi, '')
          .replace(/onload=/gi, '');
      } else if (typeof obj[key] === 'object') {
        sanitizeObject(obj[key]);
      }
    }
  };

  if (req.body) sanitizeObject(req.body);
  if (req.query) sanitizeObject(req.query);
  if (req.params) sanitizeObject(req.params);

  next();
};

// 6. Production Error Suppressor (Hides internal stack traces in production)
export const secureErrorHandler = (err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('🛡️ [SECURITY AUDIT SERVER ERROR]', err.message);
  
  const isDev = process.env.NODE_ENV === 'development';
  res.status(500).json({
    error: 'Internal Server Error',
    message: isDev ? err.message : 'An unexpected error occurred. Request logged securely.'
  });
};
