import { randomUUID } from "crypto";

type RedisLike = {
  set(
    key: string,
    value: string,
    mode: "EX",
    ttl: number,
    flag: "NX",
  ): Promise<"OK" | null>;
  eval(
    script: string,
    numKeys: number,
    key: string,
    arg: string,
  ): Promise<number>;
};

const memoryLocks = new Map<string, { token: string; expiresAt: number }>();

function memoryAcquire(key: string, token: string, ttlSec: number): boolean {
  const now = Date.now();
  const existing = memoryLocks.get(key);
  if (existing && existing.expiresAt > now) return false;
  memoryLocks.set(key, { token, expiresAt: now + ttlSec * 1000 });
  return true;
}

function memoryRelease(key: string, token: string): void {
  const existing = memoryLocks.get(key);
  if (existing?.token === token) memoryLocks.delete(key);
}

let redisClient: RedisLike | null | undefined;

async function getRedis(): Promise<RedisLike | null> {
  if (redisClient !== undefined) return redisClient;
  const url = process.env.REDIS_URL;
  if (!url) {
    redisClient = null;
    return null;
  }
  try {
    const { default: Redis } = await import("ioredis");
    redisClient = new Redis(url, {
      maxRetriesPerRequest: 1,
      lazyConnect: true,
      enableOfflineQueue: false,
    }) as unknown as RedisLike;
    return redisClient;
  } catch {
    redisClient = null;
    return null;
  }
}

export type SlotLock = {
  key: string;
  token: string;
  release: () => Promise<void>;
};

export async function acquireSlotLock(
  tenantId: string,
  staffId: string,
  startsAtIso: string,
  ttlSec = 15,
): Promise<SlotLock | null> {
  const key = `t:${tenantId}:lock:staff:${staffId}:${startsAtIso}`;
  const token = randomUUID();
  const redis = await getRedis();

  if (redis) {
    try {
      const ok = await redis.set(key, token, "EX", ttlSec, "NX");
      if (ok !== "OK") return null;
      return {
        key,
        token,
        release: async () => {
          const script = `
            if redis.call("get", KEYS[1]) == ARGV[1] then
              return redis.call("del", KEYS[1])
            else return 0 end`;
          await redis.eval(script, 1, key, token);
        },
      };
    } catch {
      // fall through to memory lock
    }
  }

  if (!memoryAcquire(key, token, ttlSec)) return null;
  return {
    key,
    token,
    release: async () => memoryRelease(key, token),
  };
}
