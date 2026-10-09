import { RateLimiterMemory, RateLimiterRedis, RateLimiterRes } from 'rate-limiter-flexible';
import { NextFunction, Request, Response } from 'express';
import { redisConnection } from './redis.js';

function createRateLimiter(keyPrefix: string, points: number, duration: number) {
  const limiter = new RateLimiterRedis({
    storeClient: redisConnection,
    keyPrefix,
    points,
    duration,
    blockDuration: duration,
    insuranceLimiter: new RateLimiterMemory({ keyPrefix, points, duration }),
  });

  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      await limiter.consume(req.ip || 'unknown');
      return next();
    } catch (error) {
      if (error instanceof RateLimiterRes) {
        res.setHeader('Retry-After', String(Math.ceil(error.msBeforeNext / 1000)));
        return res.status(429).json({ error: 'Too many requests', requestId: req.requestId });
      }
      return next(error);
    }
  };
}

export const apiRateLimit = createRateLimiter('shipit-api', 600, 60);
export const loginRateLimit = createRateLimiter('shipit-login', 10, 15 * 60);