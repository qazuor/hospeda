import type Redis from 'ioredis';
import { expect, it, vi } from 'vitest';
import { createMercadoPagoRedisCoolDownStore } from '../../src/utils/mp-cooldown-redis-store';

it('treats a non-numeric shared cool-down as zero', async () => {
    const client = {
        status: 'ready',
        get: vi.fn(async () => 'garbage'),
        eval: vi.fn(async () => 1),
        on: vi.fn()
    } as unknown as Redis;
    const store = createMercadoPagoRedisCoolDownStore({
        redisUrl: 'redis://unused',
        client,
        now: () => 100
    });
    store.extend({ until: 500 });
    await expect(store.refresh?.()).resolves.toEqual({ fallback: false });
    expect(Number.isFinite(store.until())).toBe(true);
    expect(store.until()).toBe(500);
});
