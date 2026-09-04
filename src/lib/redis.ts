import Redis from "ioredis";

type LockStore = Map<string, { token: string; expiresAt: number }>;

const memoryLocks: LockStore = new Map();

let redisClient: Redis | null = null;

function getRedis(): Redis | null {
  const url = process.env.REDIS_URL;
  if (!url) return null;

  if (!redisClient) {
    redisClient = new Redis(url, {
      maxRetriesPerRequest: 1,
      lazyConnect: true,
      enableOfflineQueue: false,
    });
  }
  return redisClient;
}

function purgeExpiredMemoryLocks(now = Date.now()): void {
  for (const [key, value] of memoryLocks) {
    if (value.expiresAt <= now) memoryLocks.delete(key);
  }
}

export async function acquireLock(
  key: string,
  token: string,
  ttlSeconds = 15,
): Promise<boolean> {
  const redis = getRedis();
  if (redis) {
    try {
      if (redis.status !== "ready") await redis.connect();
      const result = await redis.set(key, token, "EX", ttlSeconds, "NX");
      return result === "OK";
    } catch {
      // Fall through to in-memory lock when Redis is unreachable.
    }
  }

  purgeExpiredMemoryLocks();
  const existing = memoryLocks.get(key);
  const now = Date.now();
  if (existing && existing.expiresAt > now) return false;
  memoryLocks.set(key, { token, expiresAt: now + ttlSeconds * 1000 });
  return true;
}

export async function releaseLock(key: string, token: string): Promise<void> {
  const redis = getRedis();
  if (redis) {
    try {
      if (redis.status !== "ready") await redis.connect();
      const script = `
        if redis.call("get", KEYS[1]) == ARGV[1] then
          return redis.call("del", KEYS[1])
        else
          return 0
        end`;
      await redis.eval(script, 1, key, token);
      return;
    } catch {
      // Fall through to memory release.
    }
  }

  const existing = memoryLocks.get(key);
  if (existing?.token === token) memoryLocks.delete(key);
}
