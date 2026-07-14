/**
 * @file auth-cache.test.ts
 * @description Unit tests for the shared `/auth/me` cache module extracted
 * from `UserMenu.client.tsx` (HOS-131) so `MobileMenu.client.tsx` can reuse
 * the exact same fetch/cache pattern instead of a second mechanism.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    AUTH_ME_CACHE_KEY,
    AUTH_ME_CACHE_TTL_MS,
    type AuthMeSnapshot,
    fetchAuthMe,
    readCachedAuthMe,
    writeCachedAuthMe
} from '../../src/lib/auth-cache';

vi.mock('../../src/lib/env', () => ({
    getApiUrl: () => 'https://api.test'
}));

const SNAPSHOT: AuthMeSnapshot = {
    isAuthenticated: true,
    user: { id: 'u1', name: 'Test User', email: 'test@example.com' },
    permissions: ['accommodation.create'],
    role: 'HOST',
    cachedAt: Date.now()
};

describe('readCachedAuthMe / writeCachedAuthMe', () => {
    beforeEach(() => {
        sessionStorage.clear();
    });

    afterEach(() => {
        sessionStorage.clear();
    });

    it('returns null when nothing is cached', () => {
        expect(readCachedAuthMe()).toBeNull();
    });

    it('round-trips a snapshot written via writeCachedAuthMe', () => {
        writeCachedAuthMe(SNAPSHOT);
        expect(readCachedAuthMe()).toEqual(SNAPSHOT);
    });

    it('returns null for an expired snapshot (past AUTH_ME_CACHE_TTL_MS)', () => {
        sessionStorage.setItem(
            AUTH_ME_CACHE_KEY,
            JSON.stringify({ ...SNAPSHOT, cachedAt: Date.now() - AUTH_ME_CACHE_TTL_MS - 1 })
        );
        expect(readCachedAuthMe()).toBeNull();
    });

    it('returns null for unparsable JSON', () => {
        sessionStorage.setItem(AUTH_ME_CACHE_KEY, 'not-json');
        expect(readCachedAuthMe()).toBeNull();
    });
});

describe('fetchAuthMe', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('maps an authenticated response to a full snapshot', async () => {
        global.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({
                data: {
                    actor: {
                        id: 'u1',
                        name: 'Test User',
                        email: 'test@example.com',
                        image: 'https://img.test/avatar.png',
                        role: 'HOST',
                        permissions: ['accommodation.create']
                    },
                    isAuthenticated: true
                }
            })
        }) as unknown as typeof fetch;

        const snapshot = await fetchAuthMe();
        expect(snapshot.isAuthenticated).toBe(true);
        expect(snapshot.user).toEqual({
            id: 'u1',
            name: 'Test User',
            email: 'test@example.com',
            avatarUrl: 'https://img.test/avatar.png'
        });
        expect(snapshot.permissions).toEqual(['accommodation.create']);
        expect(snapshot.role).toBe('HOST');
    });

    it('resolves to a guest snapshot on a non-ok response', async () => {
        global.fetch = vi.fn().mockResolvedValue({ ok: false }) as unknown as typeof fetch;

        const snapshot = await fetchAuthMe();
        expect(snapshot).toMatchObject({
            isAuthenticated: false,
            user: null,
            permissions: [],
            role: null
        });
    });

    it('resolves to a guest snapshot when isAuthenticated is false', async () => {
        global.fetch = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({ data: { actor: null, isAuthenticated: false } })
        }) as unknown as typeof fetch;

        const snapshot = await fetchAuthMe();
        expect(snapshot.isAuthenticated).toBe(false);
        expect(snapshot.user).toBeNull();
    });

    it('uses the explicit apiUrl param over getApiUrl() when provided', async () => {
        const fetchMock = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({ data: { actor: null, isAuthenticated: false } })
        });
        global.fetch = fetchMock as unknown as typeof fetch;

        await fetchAuthMe({ apiUrl: 'https://custom.test' });
        expect(fetchMock).toHaveBeenCalledWith(
            'https://custom.test/api/v1/public/auth/me',
            expect.objectContaining({ credentials: 'include' })
        );
    });
});

describe('fetchAuthMe in-flight dedup (HOS-160 lever D)', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('collapses two concurrent callers onto a single network request', async () => {
        // Arrange: a fetch that stays pending until resolved, so both callers
        // are genuinely in-flight at once (the cold-load UserMenu + MobileMenu race).
        let resolveFetch: (r: unknown) => void = () => undefined;
        const fetchMock = vi.fn(
            () =>
                new Promise((resolve) => {
                    resolveFetch = resolve;
                })
        );
        global.fetch = fetchMock as unknown as typeof fetch;

        // Act: two callers in the same tick, empty cache.
        const p1 = fetchAuthMe();
        const p2 = fetchAuthMe();

        // Assert: only one request went out while both were pending.
        expect(fetchMock).toHaveBeenCalledTimes(1);

        resolveFetch({
            ok: true,
            json: async () => ({ data: { actor: null, isAuthenticated: false } })
        });
        const [s1, s2] = await Promise.all([p1, p2]);

        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(s1).toEqual(s2);
    });

    it('re-fetches on a subsequent call once the previous one has settled', async () => {
        const fetchMock = vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({ data: { actor: null, isAuthenticated: false } })
        });
        global.fetch = fetchMock as unknown as typeof fetch;

        await fetchAuthMe();
        await fetchAuthMe();

        // Dedup only collapses concurrent callers; sequential calls re-fetch
        // (TTL caching is the hook layer's job, not this module's).
        expect(fetchMock).toHaveBeenCalledTimes(2);
    });
});
