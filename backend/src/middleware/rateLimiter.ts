import rateLimit from 'express-rate-limit';
import { HttpStatus } from '../utils/httpStatus';
import { config } from '../config';

// Bypass rate limiting entirely for tests
const bypassLimiter = (req: any, res: any, next: any) => next();

// Rate limiter for public SOS endpoint: 5 requests per 15 minutes per IP
export const publicSOSLimiter = config.isTest ? bypassLimiter : rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 requests per `window` (here, per 15 minutes)
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  handler: (req, res) => {
    res.status(HttpStatus.TOO_MANY_REQUESTS).json({
      success: false,
      error: {
        message: 'Too many SOS requests from this IP, please try again after 15 minutes.',
      },
    });
  },
});

// Rate limiter for login endpoint: 10 requests per 15 minutes per IP
export const loginLimiter = config.isTest ? bypassLimiter : rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Limit each IP to 10 requests per `window` (here, per 15 minutes)
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  handler: (req, res) => {
    res.status(HttpStatus.TOO_MANY_REQUESTS).json({
      success: false,
      error: {
        message: 'Too many login attempts from this IP, please try again after 15 minutes.',
      },
    });
  },
});
