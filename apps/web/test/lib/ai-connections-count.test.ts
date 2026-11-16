/**
 * @file ai-connections-count.test.ts
 * @description Unit tests for the shared AI connection count (HOS-2184 T-028).
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getAiConnectionCount, resetAiConnectionCount } from '../../src/lib/ai-connections-count';

vi.mock('../../src/lib/env', () => ({ getApiUrl: () => 'https://api.x' }));

const item = {
    clientId: 'c',
    name: null,
    uri: null,
    logoUri: null,
    scopes: [],
    connectedAt: null,
    lastUsedAt: null
};

function ok(items: readonly object[]): Response {
    return { ok: true, json: async () => ({ success: true, data: { items } }) } as Response;
}

describe('getAiConnectionCount', () => {
    beforeEach(() => {
        resetAiConnectionCount();
    });

    it('counts the connections', async () => {
        const fetchImpl = vi.fn().mockResolvedValue(ok([item, item]));
        expect(await getAiConnectionCount({ fetchImpl })).toBe(2);
        expect(fetchImpl.mock.calls[0]?.[0]).toBe('https://api.x/api/v1/protected/ai-connections');
    });

    it('fetches once per page load for any number of callers', async () => {
        const fetchImpl = vi.fn().mockResolvedValue(ok([item]));
        const counts = await Promise.all([
            getAiConnectionCount({ fetchImpl }),
            getAiConnectionCount({ fetchImpl }),
            getAiConnectionCount({ fetchImpl })
        ]);
        expect(counts).toEqual([1, 1, 1]);
        expect(fetchImpl).toHaveBeenCalledTimes(1);
    });

    it.each([
        ['a network error', () => vi.fn().mockRejectedValue(new Error('down'))],
        ['a non-2xx answer', () => vi.fn().mockResolvedValue({ ok: false } as Response)],
        [
            'a malformed body',
            () => vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) } as Response)
        ]
    ])('is 0 on %s', async (_label, make) => {
        expect(await getAiConnectionCount({ fetchImpl: make() })).toBe(0);
    });
});
