import type { CoolDownStore } from '@repo/payments';
import type Redis from 'ioredis';
import { apiLogger } from './logger';

/** Create a Redis backed cool-down store with bounded, fail-open refreshes. */
export function createMercadoPagoRedisCoolDownStore(args: {
    readonly redisUrl: string;
    readonly client?: Redis;
    readonly now?: () => number;
    readonly timeoutMs?: number;
    readonly cacheMs?: number;
    readonly logger?: Pick<typeof apiLogger, 'warn' | 'info'>;
}): CoolDownStore {
    const now = args.now ?? Date.now;
    const timeoutMs = args.timeoutMs ?? 50;
    const cacheMs = args.cacheMs ?? 250;
    const logger = args.logger ?? apiLogger;
    let client = args.client;
    let localUntil = 0;
    let sharedUntil = 0;
    let lastRead = Number.NEGATIVE_INFINITY;
    let failed = false;
    const initialize = async (): Promise<void> => {
        if (client) return;
        const { default: RedisClient } = await import('ioredis');
        client = new RedisClient(args.redisUrl, {
            lazyConnect: true,
            enableOfflineQueue: false,
            commandTimeout: timeoutMs,
            maxRetriesPerRequest: 0,
            retryStrategy: (times) => Math.min(times * 200, 5000)
        });
        client.on('error', () => {
            failed = true;
        });
        void client.connect().catch(() => {
            failed = true;
        });
    };
    void initialize().catch(() => {
        failed = true;
    });
    return {
        extend: ({ until }) => {
            localUntil = Math.max(localUntil, until);
            if (client?.status !== 'ready') return;
            const ttl = Math.max(1, until - now());
            void client
                .eval(
                    "local c = tonumber(redis.call('GET', KEYS[1]) or '0'); local n = tonumber(ARGV[1]); if n > c then redis.call('SET', KEYS[1], ARGV[1], 'PX', ARGV[2]); return 1 end; return 0",
                    1,
                    'mp:cooldown-until',
                    String(until),
                    String(ttl)
                )
                .catch(() => {
                    failed = true;
                });
        },
        until: () => Math.max(localUntil, sharedUntil),
        refresh: async () => {
            if (now() - lastRead < cacheMs) return { fallback: false };
            if (client?.status !== 'ready') {
                if (!failed)
                    logger.warn({
                        message: '[mp-governor] Redis cool-down unavailable; using local state'
                    });
                failed = true;
                return { fallback: true };
            }
            try {
                let timeout: ReturnType<typeof setTimeout> | undefined;
                const value = await Promise.race([
                    client.get('mp:cooldown-until'),
                    new Promise<never>((_, reject) => {
                        timeout = setTimeout(
                            () => reject(new Error('Redis cool-down read timed out')),
                            timeoutMs
                        );
                    })
                ]).finally(() => {
                    if (timeout) clearTimeout(timeout);
                });
                sharedUntil = Math.max(sharedUntil, Number(value ?? 0));
                lastRead = now();
                if (failed) logger.info({ message: '[mp-governor] Redis cool-down recovered' });
                failed = false;
                return { fallback: false };
            } catch {
                if (!failed)
                    logger.warn({
                        message: '[mp-governor] Redis cool-down unavailable; using local state'
                    });
                failed = true;
                return { fallback: true };
            }
        }
    };
}
