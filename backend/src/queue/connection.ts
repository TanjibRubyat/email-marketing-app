import dotenv from 'dotenv';

dotenv.config();

/**
 * BullMQ bundles its OWN internal copy of ioredis. If we also install
 * ioredis directly and hand BullMQ a live connection instance from it,
 * TypeScript (correctly) rejects it - the two copies are structurally
 * different types even though they're "the same" library. The fix isn't
 * to silence the type error: it's to not construct our own ioredis
 * instance at all. We just hand BullMQ plain connection options, and let
 * it create its own internal client from them.
 */
function parseRedisUrl(url: string) {
  const parsed = new URL(url);
  return {
    host: parsed.hostname,
    port: parsed.port ? Number(parsed.port) : 6379,
    password: parsed.password || undefined,
    maxRetriesPerRequest: null as null, // required by BullMQ for blocking commands
  };
}

export const redisConnection = parseRedisUrl(process.env.REDIS_URL ?? 'redis://localhost:6379');
