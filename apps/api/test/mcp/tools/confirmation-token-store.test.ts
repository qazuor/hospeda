/**
 * @file confirmation-token-store.test.ts
 * @description Binding, single-use, expiry and fail-closed behaviour of the
 * generalized MCP confirmation store (HOS-2335 spec §5.2).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockWarn } = vi.hoisted(() => ({ mockWarn: vi.fn() }));
vi.mock('../../../src/utils/logger', () => ({
    apiLogger: { warn: mockWarn, info: vi.fn(), error: vi.fn(), debug: vi.fn() }
}));
vi.mock('../../../src/utils/redis', () => ({ getRedisClient: vi.fn() }));

import {
    CONFIRMATION_TOKEN_TTL_SECONDS,
    type ConfirmationRedis,
    consumeConfirmationToken,
    issueConfirmationToken
} from '../../../src/mcp/tools/confirmation-token-store';

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
    tool: 'create_listing',
    subjectId: 'accommodation',
    payload: { name: 'Casa', guests: 4, tags: ['a', 'b'] }
};

describe('generalized confirmation-token-store', () => {
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

    it('issues a token with a 10 minute TTL and a per-tool key prefix, no plaintext token stored', async () => {
        const token = await issue();

        expect(token.length).toBeGreaterThanOrEqual(43);
        expect(CONFIRMATION_TOKEN_TTL_SECONDS).toBe(600);
        expect(fake.spies.set).toHaveBeenCalledWith(
            expect.stringMatching(/^mcp:confirm:create_listing:/),
            expect.any(String),
            'EX',
            600
        );
        expect([...fake.data.keys()].some((k) => k.includes(token))).toBe(false);
        expect([...fake.data.values()].some((v) => v.value.includes(token))).toBe(false);
    });

    it('honours an explicit key prefix', async () => {
        await issueConfirmationToken({ ...BINDING, ...deps, keyPrefix: 'legacy:' });

        expect([...fake.data.keys()][0]).toMatch(/^legacy:/);
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

    it('accepts a payload with the same values in a different key order', async () => {
        const token = await issue();

        const result = await consumeConfirmationToken({
            ...BINDING,
            payload: { tags: ['a', 'b'], guests: 4, name: 'Casa' },
            token,
            ...deps
        });

        expect(result).toEqual({ ok: true });
    });

    describe.each([
        ['user', { userId: 'user-2' }],
        ['OAuth client', { clientId: 'client-2' }],
        ['subject', { subjectId: 'venue' }],
        ['payload value', { payload: { name: 'Casa', guests: 5, tags: ['a', 'b'] } }],
        ['payload array order', { payload: { name: 'Casa', guests: 4, tags: ['b', 'a'] } }],
        ['payload extra field', { payload: { ...BINDING.payload, mapsUrl: 'x' } }]
    ])('binding to %s', (_label, override) => {
        it('rejects a different value and burns the token', async () => {
            const token = await issue();

            const altered = await consumeConfirmationToken({
                ...BINDING,
                ...override,
                token,
                ...deps
            });
            const original = await consumeConfirmationToken({ ...BINDING, token, ...deps });

            expect(altered).toEqual({ ok: false, reason: 'INVALID' });
            expect(original).toEqual({ ok: false, reason: 'INVALID' });
        });
    });

    it('rejects another tool without touching the other tool namespace', async () => {
        const token = await issue();

        const other = await consumeConfirmationToken({
            ...BINDING,
            tool: 'other_tool',
            token,
            ...deps
        });
        const original = await consumeConfirmationToken({ ...BINDING, token, ...deps });

        expect(other).toEqual({ ok: false, reason: 'INVALID' });
        expect(original).toEqual({ ok: true });
    });

    it('rejects another tool even under a shared key prefix', async () => {
        const shared = { ...deps, keyPrefix: 'shared:' };
        const issued = await issueConfirmationToken({ ...BINDING, ...shared });
        if (!issued.ok) throw new Error('expected a token');

        const result = await consumeConfirmationToken({
            ...BINDING,
            tool: 'other_tool',
            token: issued.token,
            ...shared
        });

        expect(result).toEqual({ ok: false, reason: 'INVALID' });
    });

    it('does not let fields bleed into each other', async () => {
        const token = await issue();

        const result = await consumeConfirmationToken({
            ...BINDING,
            userId: 'user-',
            clientId: `1|${BINDING.clientId}`,
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

    it('rejects an expired token and accepts one just before expiry', async () => {
        const expired = await issue();
        const fresh = await issue();
        fake.advance(CONFIRMATION_TOKEN_TTL_SECONDS * 1000 - 1);
        expect(await consumeConfirmationToken({ ...BINDING, token: fresh, ...deps })).toEqual({
            ok: true
        });
        fake.advance(2);

        expect(await consumeConfirmationToken({ ...BINDING, token: expired, ...deps })).toEqual({
            ok: false,
            reason: 'INVALID'
        });
    });

    describe('when Redis is down (fail closed)', () => {
        it('refuses to issue and consume without a client', async () => {
            const none = { getRedis: async () => undefined };

            expect(await issueConfirmationToken({ ...BINDING, ...none })).toEqual({
                ok: false,
                reason: 'UNAVAILABLE'
            });
            expect(await consumeConfirmationToken({ ...BINDING, token: 'any', ...none })).toEqual({
                ok: false,
                reason: 'UNAVAILABLE'
            });
        });

        it('refuses when SET or GETDEL throws', async () => {
            fake.spies.set.mockRejectedValueOnce(new Error('ECONNRESET'));
            expect(await issueConfirmationToken({ ...BINDING, ...deps })).toEqual({
                ok: false,
                reason: 'UNAVAILABLE'
            });
            const token = await issue();
            fake.spies.getdel.mockRejectedValueOnce(new Error('ECONNRESET'));

            expect(await consumeConfirmationToken({ ...BINDING, token, ...deps })).toEqual({
                ok: false,
                reason: 'UNAVAILABLE'
            });
        });

        it('never logs the token or the payload', async () => {
            const token = await issue();
            fake.spies.getdel.mockRejectedValueOnce(new Error('ECONNRESET'));
            await consumeConfirmationToken({ ...BINDING, token, ...deps });

            const logged = JSON.stringify(mockWarn.mock.calls);
            expect(mockWarn).toHaveBeenCalled();
            expect(logged).not.toContain(token);
            expect(logged).not.toContain('Casa');
        });
    });
});
