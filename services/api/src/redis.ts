import { createRequire } from 'node:module';
import type { Redis as RedisClient, RedisOptions } from 'ioredis';

const require = createRequire(import.meta.url);
const Redis = require('ioredis') as new (url: string, options: RedisOptions) => RedisClient;

export const redisConnection = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
  lazyConnect: true,
  maxRetriesPerRequest: null,
  retryStrategy: (attempt: number) => Math.min(attempt * 250, 5000),
});

redisConnection.on('error', (error: Error) => {
  console.error('Redis connection error', error.message);
});

export async function connectRedis() {
  if (redisConnection.status === 'wait') await redisConnection.connect();
  await redisConnection.ping();
}

export async function disconnectRedis() {
  if (redisConnection.status !== 'end') await redisConnection.quit();
}