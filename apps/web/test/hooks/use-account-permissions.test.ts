/**
 * @file use-account-permissions.test.ts
 * @description Unit tests for the shared `/auth/me` resolution hook,
 * extracted from `UserMenu.client.tsx` so `MobileMenu.client.tsx` (HOS-131
 * §6.5) can reuse the exact same cache-first pattern. Covers both modes:
 * - SSR-reconciling mode (`initialUser` passed — UserMenu AND MobileMenu).
 * - Simple mode (`initialUser` omitted entirely).
 *
 * Also covers `syncAuthenticatedAttribute`: MobileMenu is in
 * SSR-reconciling mode but must NOT also write `<html
 * data-user-authenticated>` — that stays UserMenu's exclusive
 * responsibility.
 */

import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAccountPermissions } from '../../src/hooks/use-account-permissions';
import { AUTH_ME_CACHE_KEY } from '../../src/lib/auth-cache';

function mockFetchOnce(body: unknown, ok = true) {
    global.fetch = vi.fn().mockResolvedValue({
        ok,
        json: async () => body
    }) as unknown as typeof fetch;
}

const AUTHENTICATED_RESPONSE = {
    data: {
        actor: {
            id: 'u1',
            name: 'Test User',
            email: 'test@example.com',
            role: 'HOST',
            permissions: ['accommodation.create']
        },
        isAuthenticated: true
    }
};

const GUEST_RESPONSE = {
    data: { actor: null, isAuthenticated: false }
};

describe('useAccountPermissions — SSR-reconciling mode (initialUser passed)', () => {
    beforeEach(() => {
        sessionStorage.clear();
        document.documentElement.removeAttribute('data-user-authenticated');
    });

    afterEach(() => {
        vi.restoreAllMocks();
        sessionStorage.clear();
        document.documentElement.removeAttribute('data-user-authenticated');
    });

    it('applies a fresh cache that agrees with initialUser, without fetching', async () => {
        sessionStorage.setItem(
            AUTH_ME_CACHE_KEY,
            JSON.stringify({
                isAuthenticated: true,
                user: { id: 'u1', name: 'Cached User', email: 'cached@example.com' },
                permissions: ['accommodation.create'],
                role: 'HOST',
                cachedAt: Date.now()
            })
        );
        const fetchMock = vi.fn();
        global.fetch = fetchMock as unknown as typeof fetch;

        const { result } = renderHook(() =>
            useAccountPermissions({
                initialUser: { id: 'u1', name: 'Cached User', email: 'cached@example.com' }
            })
        );

        await waitFor(() => {
            expect(result.current.permissions).toEqual(['accommodation.create']);
        });
        expect(result.current.role).toBe('HOST');
        expect(fetchMock).not.toHaveBeenCalled();
        expect(document.documentElement.getAttribute('data-user-authenticated')).toBe('true');
    });

    it('discards a fresh GUEST cache that contradicts an authenticated initialUser and refetches', async () => {
        sessionStorage.setItem(
            AUTH_ME_CACHE_KEY,
            JSON.stringify({
                isAuthenticated: false,
                user: null,
                permissions: [],
                role: null,
                cachedAt: Date.now()
            })
        );
        const fetchMock = vi
            .fn()
            .mockResolvedValue({ ok: true, json: async () => AUTHENTICATED_RESPONSE });
        global.fetch = fetchMock as unknown as typeof fetch;

        renderHook(() =>
            useAccountPermissions({
                initialUser: { id: 'u1', name: 'Test User', email: 'test@example.com' }
            })
        );

        await waitFor(() => {
            expect(fetchMock).toHaveBeenCalledTimes(1);
        });
    });

    it('fetches and sets data-user-authenticated when the cache is absent', async () => {
        mockFetchOnce(AUTHENTICATED_RESPONSE);

        const { result } = renderHook(() => useAccountPermissions({ initialUser: null }));

        await waitFor(() => {
            expect(result.current.permissions).toEqual(['accommodation.create']);
        });
        expect(document.documentElement.getAttribute('data-user-authenticated')).toBe('true');
    });

    it('resolves to empty permissions (fail-closed) on a network error', async () => {
        global.fetch = vi
            .fn()
            .mockRejectedValue(new Error('network down')) as unknown as typeof fetch;

        const { result } = renderHook(() => useAccountPermissions({ initialUser: null }));

        await waitFor(() => {
            expect(result.current.permissions).toEqual([]);
        });
    });
});

describe('useAccountPermissions — syncAuthenticatedAttribute opt-out (MobileMenu)', () => {
    beforeEach(() => {
        sessionStorage.clear();
        document.documentElement.removeAttribute('data-user-authenticated');
    });

    afterEach(() => {
        vi.restoreAllMocks();
        sessionStorage.clear();
        document.documentElement.removeAttribute('data-user-authenticated');
    });

    it('does NOT write data-user-authenticated when syncAuthenticatedAttribute is false, even in SSR-reconciling mode', async () => {
        mockFetchOnce(AUTHENTICATED_RESPONSE);

        const { result } = renderHook(() =>
            useAccountPermissions({ initialUser: null, syncAuthenticatedAttribute: false })
        );

        await waitFor(() => {
            expect(result.current.permissions).toEqual(['accommodation.create']);
        });
        expect(document.documentElement.hasAttribute('data-user-authenticated')).toBe(false);
    });

    it('still reconciles a mismatched cache against initialUser when the attribute write is suppressed', async () => {
        sessionStorage.setItem(
            AUTH_ME_CACHE_KEY,
            JSON.stringify({
                isAuthenticated: false,
                user: null,
                permissions: [],
                role: null,
                cachedAt: Date.now()
            })
        );
        const fetchMock = vi
            .fn()
            .mockResolvedValue({ ok: true, json: async () => AUTHENTICATED_RESPONSE });
        global.fetch = fetchMock as unknown as typeof fetch;

        renderHook(() =>
            useAccountPermissions({
                initialUser: { id: 'u1', name: 'Test User', email: 'test@example.com' },
                syncAuthenticatedAttribute: false
            })
        );

        await waitFor(() => {
            expect(fetchMock).toHaveBeenCalledTimes(1);
        });
        expect(document.documentElement.hasAttribute('data-user-authenticated')).toBe(false);
    });

    it('seeds role from initialRole on first render, before any effect runs', () => {
        // Never-resolving fetch: only the synchronous initial state is asserted.
        global.fetch = vi.fn(() => new Promise(() => {})) as unknown as typeof fetch;

        const { result } = renderHook(() =>
            useAccountPermissions({
                initialUser: { id: 'u1', name: 'Test User', email: 'test@example.com' },
                initialRole: 'HOST',
                syncAuthenticatedAttribute: false
            })
        );

        expect(result.current.role).toBe('HOST');
    });
});

describe('useAccountPermissions — simple mode (initialUser omitted)', () => {
    beforeEach(() => {
        sessionStorage.clear();
        document.documentElement.removeAttribute('data-user-authenticated');
    });

    afterEach(() => {
        vi.restoreAllMocks();
        sessionStorage.clear();
        document.documentElement.removeAttribute('data-user-authenticated');
    });

    it('trusts a fresh, authenticated cache directly without fetching', async () => {
        sessionStorage.setItem(
            AUTH_ME_CACHE_KEY,
            JSON.stringify({
                isAuthenticated: true,
                user: { id: 'u1', name: 'Cached User', email: 'cached@example.com' },
                permissions: ['commerce.editOwn'],
                role: 'COMMERCE_OWNER',
                cachedAt: Date.now()
            })
        );
        const fetchMock = vi.fn();
        global.fetch = fetchMock as unknown as typeof fetch;

        const { result } = renderHook(() => useAccountPermissions());

        await waitFor(() => {
            expect(result.current.permissions).toEqual(['commerce.editOwn']);
        });
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('never writes data-user-authenticated — that stays UserMenu-only', async () => {
        mockFetchOnce(AUTHENTICATED_RESPONSE);

        const { result } = renderHook(() => useAccountPermissions());

        await waitFor(() => {
            expect(result.current.permissions).toEqual(['accommodation.create']);
        });
        expect(document.documentElement.hasAttribute('data-user-authenticated')).toBe(false);
    });

    it('fetches when no cache is present', async () => {
        const fetchMock = vi
            .fn()
            .mockResolvedValue({ ok: true, json: async () => AUTHENTICATED_RESPONSE });
        global.fetch = fetchMock as unknown as typeof fetch;

        const { result } = renderHook(() => useAccountPermissions());

        await waitFor(() => {
            expect(fetchMock).toHaveBeenCalledTimes(1);
            expect(result.current.permissions).toEqual(['accommodation.create']);
        });
    });

    it('ignores a stale (non-authenticated) cache and refetches', async () => {
        sessionStorage.setItem(
            AUTH_ME_CACHE_KEY,
            JSON.stringify({
                isAuthenticated: false,
                user: null,
                permissions: [],
                role: null,
                cachedAt: Date.now()
            })
        );
        const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => GUEST_RESPONSE });
        global.fetch = fetchMock as unknown as typeof fetch;

        renderHook(() => useAccountPermissions());

        await waitFor(() => {
            expect(fetchMock).toHaveBeenCalledTimes(1);
        });
    });

    it('never fetches when skip is true', async () => {
        const fetchMock = vi.fn();
        global.fetch = fetchMock as unknown as typeof fetch;

        const { result } = renderHook(() => useAccountPermissions({ skip: true }));

        // Give effects a tick to flush.
        await new Promise<void>((resolve) => setTimeout(resolve, 20));

        expect(fetchMock).not.toHaveBeenCalled();
        expect(result.current.permissions).toBeNull();
    });
});
