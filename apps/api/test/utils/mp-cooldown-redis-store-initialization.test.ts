import type Redis from 'ioredis';
import { describe, expect, it, vi } from 'vitest';
import { createMercadoPagoRedisCoolDownStore } from '../../src/utils/mp-cooldown-redis-store';

function makeClient(): Redis {
    return {
        status: 'connecting',
        get: vi.fn(async () => null),
        eval: vi.fn(async () => 1),
        on: vi.fn(),
        connect: vi.fn(async () => undefined)
    } as unknown as Redis;
}

describe('Redis cool-down initialization', () => {
    it('stays quiet until the first connection attempt settles', async () => {
        const client = makeClient();
        const warn = vi.fn();
        const info = vi.fn();
        const store = createMercadoPagoRedisCoolDownStore({
            redisUrl: 'redis://unused',
            client,
            logger: { warn, info } as never
        });
        await expect(store.refresh?.()).resolves.toEqual({ fallback: true });
        expect(warn).not.toHaveBeenCalled();
        Object.defineProperty(client, 'status', { value: 'ready' });
        await expect(store.refresh?.()).resolves.toEqual({ fallback: false });
        expect(warn).not.toHaveBeenCalled();
        expect(info).not.toHaveBeenCalled();
    });

    it('warns once after its first connection attempt fails', async () => {
        const client = makeClient();
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
        expect(info).not.toHaveBeenCalled();
    });
});
