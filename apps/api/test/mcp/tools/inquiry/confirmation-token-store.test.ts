/**
 * @file confirmation-token-store.test.ts
 * @description Single-use, binding and fail-closed behaviour of the
 * `reply_inquiry` confirmation token store (HOS-2184 T-022).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockWarn } = vi.hoisted(() => ({ mockWarn: vi.fn() }));
vi.mock('../../../../src/utils/logger', () => ({
    apiLogger: { warn: mockWarn, info: vi.fn(), error: vi.fn(), debug: vi.fn() }
}));
vi.mock('../../../../src/utils/redis', () => ({ getRedisClient: vi.fn() }));

import {
    CONFIRMATION_TOKEN_TTL_SECONDS,
    type ConfirmationRedis,
    consumeConfirmationToken,
    issueConfirmationToken
} from '../../../../src/mcp/tools/inquiry/confirmation-token-store';

/** In-memory Redis fake with TTL driven by an injected clock. */
function makeFakeRedis() {
    let nowMs = 0;
    const data = new Map<string, { value: string; expiresAt: number }>();
    const redis = {
        set: vi.fn(async (key: string, value: string, _ex: string, seconds: number) => {
            data.set(key, { value, expiresAt: nowMs + seconds * 1000 });
            return 'OK';
        }),
        getdel: vi.fn(async (key: string) => {
            const entry = data.get(key);
            data.delete(key);
            return entry && entry.expiresAt > nowMs ? entry.value : null;
        })
    };
    return {
        redis: redis as unknown as ConfirmationRedis,
        spies: redis,
        data,
        advance: (ms: number) => {
            nowMs += ms;
        }
    };
}

const BINDING = {
    userId: 'user-1',
    clientId: 'client-1',
    conversationId: 'conv-1',
    text: 'Hola, te espero el sábado.'
};

describe('confirmation-token-store', () => {
    let fake: ReturnType<typeof makeFakeRedis>;
    let deps: { getRedis: () => Promise<ConfirmationRedis | undefined> };

    beforeEach(() => {
        mockWarn.mockClear();
        fake = makeFakeRedis();
        deps = { getRedis: async () => fake.redis };
    });

    async function issue() {
        const issued = await issueConfirmationToken({ ...BINDING, ...deps });
        if (!issued.ok) throw new Error('expected a token');
        return issued.token;
    }

    it('issues an unguessable token with a 10 minute TTL and stores no plaintext token', async () => {
        const token = await issue();

        expect(token.length).toBeGreaterThanOrEqual(43);
        expect(fake.spies.set).toHaveBeenCalledWith(
            expect.any(String),
            expect.any(String),
            'EX',
            CONFIRMATION_TOKEN_TTL_SECONDS
        );
        expect(CONFIRMATION_TOKEN_TTL_SECONDS).toBe(600);
        expect([...fake.data.keys()].some((k) => k.includes(token))).toBe(false);
        expect([...fake.data.values()].some((v) => v.value.includes(token))).toBe(false);
    });

    it('issues different tokens each time', async () => {
        expect(await issue()).not.toBe(await issue());
    });

    it('consumes with the same binding exactly once', async () => {
        const token = await issue();

        const first = await consumeConfirmationToken({ ...BINDING, token, ...deps });
        const second = await consumeConfirmationToken({ ...BINDING, token, ...deps });

        expect(first).toEqual({ ok: true });
        expect(second).toEqual({ ok: false, reason: 'INVALID' });
    });

    it('lets only one of two concurrent consumers win', async () => {
        const token = await issue();

        const results = await Promise.all([
            consumeConfirmationToken({ ...BINDING, token, ...deps }),
            consumeConfirmationToken({ ...BINDING, token, ...deps })
        ]);

        expect(results.filter((r) => r.ok)).toHaveLength(1);
    });

    it('rejects altered text, and burns the token', async () => {
        const token = await issue();

        const altered = await consumeConfirmationToken({
            ...BINDING,
            text: `${BINDING.text} Gratis.`,
            token,
            ...deps
        });
        const original = await consumeConfirmationToken({ ...BINDING, token, ...deps });

        expect(altered).toEqual({ ok: false, reason: 'INVALID' });
        expect(original).toEqual({ ok: false, reason: 'INVALID' });
    });

    it('rejects another user', async () => {
        const token = await issue();

        const result = await consumeConfirmationToken({
            ...BINDING,
            userId: 'user-2',
            token,
            ...deps
        });

        expect(result).toEqual({ ok: false, reason: 'INVALID' });
    });

    it('rejects another OAuth client', async () => {
        const token = await issue();

        const result = await consumeConfirmationToken({
            ...BINDING,
            clientId: 'client-2',
            token,
            ...deps
        });

        expect(result).toEqual({ ok: false, reason: 'INVALID' });
    });

    it('rejects another conversation', async () => {
        const token = await issue();

        const result = await consumeConfirmationToken({
            ...BINDING,
            conversationId: 'conv-2',
            token,
            ...deps
        });

        expect(result).toEqual({ ok: false, reason: 'INVALID' });
    });

    it('does not let fields bleed into each other', async () => {
        const token = await issue();

        const result = await consumeConfirmationToken({
            userId: 'user-',
            clientId: BINDING.clientId,
            conversationId: `1|${BINDING.conversationId}`,
            text: BINDING.text,
            token,
            ...deps
        });

        expect(result).toEqual({ ok: false, reason: 'INVALID' });
    });

    it('rejects an unknown or empty token', async () => {
        expect(await consumeConfirmationToken({ ...BINDING, token: 'nope', ...deps })).toEqual({
            ok: false,
            reason: 'INVALID'
        });
        expect(await consumeConfirmationToken({ ...BINDING, token: '', ...deps })).toEqual({
            ok: false,
            reason: 'INVALID'
        });
    });

    it('rejects an expired token', async () => {
        const token = await issue();
        fake.advance(CONFIRMATION_TOKEN_TTL_SECONDS * 1000 + 1);

        const result = await consumeConfirmationToken({ ...BINDING, token, ...deps });

        expect(result).toEqual({ ok: false, reason: 'INVALID' });
    });

    it('accepts a token just before it expires', async () => {
        const token = await issue();
        fake.advance(CONFIRMATION_TOKEN_TTL_SECONDS * 1000 - 1);

        expect(await consumeConfirmationToken({ ...BINDING, token, ...deps })).toEqual({
            ok: true
        });
    });

    describe('when Redis is down (fail closed)', () => {
        it('refuses to issue without a client', async () => {
            const result = await issueConfirmationToken({
                ...BINDING,
                getRedis: async () => undefined
            });

            expect(result).toEqual({ ok: false, reason: 'UNAVAILABLE' });
        });

        it('refuses to consume without a client', async () => {
            const result = await consumeConfirmationToken({
                ...BINDING,
                token: 'any',
                getRedis: async () => undefined
            });

            expect(result).toEqual({ ok: false, reason: 'UNAVAILABLE' });
        });

        it('refuses when resolving the client throws', async () => {
            const result = await consumeConfirmationToken({
                ...BINDING,
                token: 'any',
                getRedis: async () => {
                    throw new Error('boom');
                }
            });

            expect(result).toEqual({ ok: false, reason: 'UNAVAILABLE' });
        });

        it('refuses to issue when SET throws', async () => {
            fake.spies.set.mockRejectedValueOnce(new Error('ECONNRESET'));

            expect(await issueConfirmationToken({ ...BINDING, ...deps })).toEqual({
                ok: false,
                reason: 'UNAVAILABLE'
            });
        });

        it('refuses to consume when GETDEL throws', async () => {
            const token = await issue();
            fake.spies.getdel.mockRejectedValueOnce(new Error('ECONNRESET'));

            expect(await consumeConfirmationToken({ ...BINDING, token, ...deps })).toEqual({
                ok: false,
                reason: 'UNAVAILABLE'
            });
        });

        it('never logs the token or the text', async () => {
            const token = await issue();
            fake.spies.getdel.mockRejectedValueOnce(new Error('ECONNRESET'));
            await consumeConfirmationToken({ ...BINDING, token, ...deps });

            const logged = JSON.stringify(mockWarn.mock.calls);
            expect(mockWarn).toHaveBeenCalled();
            expect(logged).not.toContain(token);
            expect(logged).not.toContain(BINDING.text);
        });
    });
});
