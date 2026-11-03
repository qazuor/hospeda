import type Redis from 'ioredis';
import { describe, expect, it, vi } from 'vitest';
import { createMercadoPagoRedisCoolDownStore } from '../../src/utils/mp-cooldown-redis-store';

function fakeClient(args: { status?: string; get?: () => Promise<string | null> }): Redis {
    return {
        status: args.status ?? 'ready',
        get: vi.fn(args.get ?? (async () => null)),
        eval: vi.fn(async () => 1),
        on: vi.fn(),
        connect: vi.fn(async () => undefined)
    } as unknown as Redis;
}

describe('Redis shared provider cool-down', () => {
    it('returns fallback immediately when Redis is not ready and extend stays fail-open', async () => {
        const now = 100;
        const client = fakeClient({ status: 'connecting' });
        const store = createMercadoPagoRedisCoolDownStore({
            redisUrl: 'redis://unused',
            client,
            now: () => now
        });
        expect(await store.refresh?.()).toEqual({ fallback: true });
        store.extend({ until: 500 });
        expect(store.until()).toBe(500);
        expect(client.get).not.toHaveBeenCalled();
    });

    it('bounds slow reads, caches successful reads, and never throws from extend', async () => {
        const client = fakeClient({
            get: () => new Promise((resolve) => setTimeout(() => resolve('500'), 80))
        });
        const store = createMercadoPagoRedisCoolDownStore({
            redisUrl: 'redis://unused',
            client,
            timeoutMs: 10,
            now: () => 100
        });
        const start = Date.now();
        expect(await store.refresh?.()).toEqual({ fallback: true });
        expect(Date.now() - start).toBeLessThan(50);
        store.extend({ until: 600 });
        expect(store.until()).toBe(600);
    });

    it('does not close a Redis client injected by its caller', async () => {
        const client = fakeClient({ status: 'ready' });
        const quit = vi.fn(async () => 'OK');
        const disconnect = vi.fn();
        Object.assign(client, { quit, disconnect });
        const store = createMercadoPagoRedisCoolDownStore({
            redisUrl: 'redis://unused',
            client
        });
        await store.close?.();
        expect(quit).not.toHaveBeenCalled();
        expect(disconnect).not.toHaveBeenCalled();
    });

    it('uses the cache and atomically extends the shared key without throwing', async () => {
        let now = 1000;
        const client = fakeClient({ get: async () => '1500' });
        const store = createMercadoPagoRedisCoolDownStore({
            redisUrl: 'redis://unused',
            client,
            now: () => now
        });
        await expect(store.refresh?.()).resolves.toEqual({ fallback: false });
        now += 100;
        await expect(store.refresh?.()).resolves.toEqual({ fallback: false });
        expect(client.get).toHaveBeenCalledTimes(1);
        store.extend({ until: 2000 });
        expect(client.eval).toHaveBeenCalledWith(
            "local c = tonumber(redis.call('GET', KEYS[1]) or '0'); local n = tonumber(ARGV[1]); if n > c then redis.call('SET', KEYS[1], ARGV[1], 'PX', ARGV[2]); return 1 end; return 0",
            1,
            'mp:cooldown-until',
            '2000',
            '900'
        );
    });

    it('logs once per outage and once on recovery (kills per-request warnings)', async () => {
        const client = fakeClient({ status: 'connecting' });
        const warn = vi.fn();
        const info = vi.fn();
        const store = createMercadoPagoRedisCoolDownStore({
            redisUrl: 'redis://unused',
            client,
            logger: { warn, info } as never
        });
        await store.refresh?.();
        const onError = vi.mocked(client.on).mock.calls[0]?.[1];
        onError?.(new Error('connection failed'));
        await store.refresh?.();
        await store.refresh?.();
        expect(warn).toHaveBeenCalledTimes(1);
        Object.defineProperty(client, 'status', { value: 'ready' });
        await store.refresh?.();
        expect(info).toHaveBeenCalledTimes(1);
    });
});
