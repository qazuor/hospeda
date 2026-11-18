/**
 * @file confirmation-token-store.stash.test.ts
 * @description The optional server-side stash of the generalized confirmation
 * store (HOS-2335 §5.2/§7, HOS-2329): `create_listing` keeps the point it
 * resolved from a Maps link next to the token. The stash is bound into the
 * digest, returned once by a successful consumption, never by a failed one, and
 * a value issued without a stash keeps the exact pre-stash format.
 */
import { createHash } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../src/utils/logger', () => ({
    apiLogger: { warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn() }
}));
vi.mock('../../../src/utils/redis', () => ({ getRedisClient: vi.fn() }));

import { canonicalJson } from '../../../src/mcp/tools/canonical-json';
import {
    type ConfirmationRedis,
    consumeConfirmationToken,
    issueConfirmationToken
} from '../../../src/mcp/tools/confirmation-token-store';

function makeFakeRedis() {
    const data = new Map<string, string>();
    const redis = {
        set: vi.fn(async (key: string, value: string) => {
            data.set(key, value);
            return 'OK';
        }),
        getdel: vi.fn(async (key: string) => {
            const value = data.get(key) ?? null;
            data.delete(key);
            return value;
        })
    };
    return { redis: redis as unknown as ConfirmationRedis, data };
}

const BINDING = {
    userId: 'user-1',
    clientId: 'client-1',
    tool: 'create_listing',
    subjectId: 'accommodation',
    payload: { name: 'Casa del Río', mapsUrl: 'https://maps.app.goo.gl/abc' }
};
const STASH = { point: { lat: -32.48, lng: -58.23 } };

describe('confirmation-token-store stash', () => {
    let fake: ReturnType<typeof makeFakeRedis>;
    let deps: { getRedis: () => Promise<ConfirmationRedis | undefined> };

    beforeEach(() => {
        fake = makeFakeRedis();
        deps = { getRedis: async () => fake.redis };
    });

    async function issue(stash?: typeof STASH) {
        const issued = await issueConfirmationToken({
            ...BINDING,
            ...deps,
            ...(stash ? { stash } : {})
        });
        if (!issued.ok) throw new Error('expected a token');
        return issued.token;
    }

    it('returns the stash once, with the binding it was issued for', async () => {
        // Arrange
        const token = await issue(STASH);

        // Act
        const first = await consumeConfirmationToken({ ...BINDING, token, ...deps });
        const second = await consumeConfirmationToken({ ...BINDING, token, ...deps });

        // Assert
        expect(first).toEqual({ ok: true, stash: STASH });
        expect(second).toEqual({ ok: false, reason: 'INVALID' });
    });

    it('never hands the stash to a mismatching binding, and burns the token', async () => {
        // Arrange
        const token = await issue(STASH);

        // Act
        const altered = await consumeConfirmationToken({
            ...BINDING,
            payload: { ...BINDING.payload, name: 'Otra casa' },
            token,
            ...deps
        });
        const retried = await consumeConfirmationToken({ ...BINDING, token, ...deps });

        // Assert
        expect(altered).toEqual({ ok: false, reason: 'INVALID' });
        expect(retried).toEqual({ ok: false, reason: 'INVALID' });
    });

    it('binds the stash: a stored value whose stash was swapped is refused', async () => {
        // Arrange: rewrite the stored stash to another point, keeping the digest.
        const token = await issue(STASH);
        const [key, value] = [...fake.data.entries()][0] ?? ['', ''];
        const digest = value.split('.')[0];
        const forged = Buffer.from(canonicalJson({ point: { lat: -34.6, lng: -58.4 } })).toString(
            'base64url'
        );
        fake.data.set(key, `${digest}.${forged}`);

        // Act
        const result = await consumeConfirmationToken({ ...BINDING, token, ...deps });

        // Assert
        expect(result).toEqual({ ok: false, reason: 'INVALID' });
    });

    it('refuses a stored value whose stash does not decode', async () => {
        // Arrange
        const token = await issue(STASH);
        const [key, value] = [...fake.data.entries()][0] ?? ['', ''];
        fake.data.set(key, `${value.split('.')[0]}.%%%not-base64-json`);

        // Act / Assert
        expect(await consumeConfirmationToken({ ...BINDING, token, ...deps })).toEqual({
            ok: false,
            reason: 'INVALID'
        });
    });

    it('keeps the pre-stash format when nothing is stashed: the value is a bare sha256 hex digest', async () => {
        // Arrange / Act
        const token = await issue();
        const [value] = [...fake.data.values()];

        // Assert
        expect(value).toMatch(/^[0-9a-f]{64}$/);
        expect(await consumeConfirmationToken({ ...BINDING, token, ...deps })).toEqual({
            ok: true
        });
    });

    it('stores the stash in the value only, never the token', async () => {
        // Arrange / Act
        const token = await issue(STASH);
        const [key] = [...fake.data.keys()];

        // Assert
        expect(key).toBe(
            `mcp:confirm:create_listing:${createHash('sha256').update(token).digest('hex')}`
        );
        expect([...fake.data.values()][0]).not.toContain(token);
    });
});
