/**
 * @file useMyEntitlements.test.ts
 * @description Tests for the useMyEntitlements hook.
 * Verifies fetching, caching, has()/limit() logic, error handling, and fail-closed behavior.
 */

import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { clearEntitlementsCache, useMyEntitlements } from '@/hooks/useMyEntitlements';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock the Better Auth session hook so tests can drive authenticated vs guest.
const mockUseSession = vi.fn();
vi.mock('@/lib/auth-client', () => ({
    useSession: () => mockUseSession()
}));

/** An authenticated session snapshot (default for existing tests). */
const AUTHENTICATED = { data: { user: { id: 'user-1' } }, isPending: false };
/** A resolved guest (no session). */
const GUEST = { data: null, isPending: false };
/** Session still resolving. */
const SESSION_PENDING = { data: null, isPending: true };

function mockSuccessResponse(data: unknown) {
    return {
        ok: true,
        status: 200,
        json: () => Promise.resolve(data)
    };
}

function mockErrorResponse(status: number, message: string) {
    return {
        ok: false,
        status,
        json: () => Promise.resolve({ error: { message } })
    };
}

const ENTITLEMENTS_RESPONSE = {
    data: {
        entitlements: ['can_use_rich_description', 'publish_accommodations'],
        limits: { max_accommodations: 5 },
        plan: { slug: 'owner-pro', name: 'Owner Pro', status: 'active' },
        asOf: '2026-01-01T00:00:00Z'
    }
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useMyEntitlements', () => {
    beforeEach(() => {
        mockFetch.mockReset();
        clearEntitlementsCache();
        // Default to an authenticated session; guest-specific tests override this.
        mockUseSession.mockReturnValue(AUTHENTICATED);
    });

    it('fetches entitlements on mount and returns has() + limit()', async () => {
        mockFetch.mockResolvedValueOnce(mockSuccessResponse(ENTITLEMENTS_RESPONSE));

        const { result } = renderHook(() => useMyEntitlements());

        // Initially loading
        expect(result.current.isLoading).toBe(true);

        await waitFor(() => {
            expect(result.current.isLoading).toBe(false);
        });

        expect(result.current.error).toBeNull();
        expect(result.current.has('can_use_rich_description')).toBe(true);
        expect(result.current.has('publish_accommodations')).toBe(true);
        expect(result.current.has('view_basic_stats')).toBe(false);
        expect(result.current.limit('max_accommodations')).toBe(5);
        expect(result.current.limit('nonexistent')).toBe(-1);
        expect(result.current.plan).toEqual({
            slug: 'owner-pro',
            name: 'Owner Pro',
            status: 'active'
        });
    });

    it('returns error state on fetch failure', async () => {
        mockFetch.mockResolvedValueOnce(mockErrorResponse(401, 'Unauthorized'));

        const { result } = renderHook(() => useMyEntitlements());

        await waitFor(() => {
            expect(result.current.isLoading).toBe(false);
        });

        expect(result.current.error).toBeInstanceOf(Error);
        expect(result.current.error?.message).toBe('Unauthorized');
        // Fail-closed: has() returns false on error
        expect(result.current.has('can_use_rich_description')).toBe(false);
        expect(result.current.plan).toBeNull();
    });

    it('returns error state on network failure', async () => {
        mockFetch.mockRejectedValueOnce(new Error('Network error'));

        const { result } = renderHook(() => useMyEntitlements());

        await waitFor(() => {
            expect(result.current.isLoading).toBe(false);
        });

        expect(result.current.error).toBeInstanceOf(Error);
        expect(result.current.has('can_use_rich_description')).toBe(false);
    });

    it('does not refetch when hook is remounted within cache TTL', async () => {
        mockFetch.mockResolvedValueOnce(mockSuccessResponse(ENTITLEMENTS_RESPONSE));

        const { result, unmount } = renderHook(() => useMyEntitlements());

        await waitFor(() => {
            expect(result.current.isLoading).toBe(false);
        });

        expect(mockFetch).toHaveBeenCalledTimes(1);
        unmount();

        // Remount — should use cache
        const { result: result2 } = renderHook(() => useMyEntitlements());

        await waitFor(() => {
            expect(result2.current.isLoading).toBe(false);
        });

        // Still only 1 fetch — cached
        expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('returns empty entitlements when response has empty array', async () => {
        mockFetch.mockResolvedValueOnce(
            mockSuccessResponse({
                data: {
                    entitlements: [],
                    limits: {},
                    plan: null,
                    asOf: '2026-01-01T00:00:00Z'
                }
            })
        );

        const { result } = renderHook(() => useMyEntitlements());

        await waitFor(() => {
            expect(result.current.isLoading).toBe(false);
        });

        expect(result.current.has('can_use_rich_description')).toBe(false);
        expect(result.current.plan).toBeNull();
    });

    it('has() returns false while still loading (fail-closed)', () => {
        mockFetch.mockReturnValueOnce(new Promise(() => {})); // never resolves

        const { result } = renderHook(() => useMyEntitlements());

        // While loading, has() should return false (fail-closed)
        expect(result.current.isLoading).toBe(true);
        expect(result.current.has('can_use_rich_description')).toBe(false);
    });

    // HOS-109 T-005: a guest must never call the protected endpoint, which is
    // what caused the unauthenticated 401 → sustained 429 flood.
    it('does NOT fetch when there is no session (guest)', async () => {
        mockUseSession.mockReturnValue(GUEST);

        const { result } = renderHook(() => useMyEntitlements());

        await waitFor(() => {
            expect(result.current.isLoading).toBe(false);
        });

        expect(mockFetch).not.toHaveBeenCalled();
        // Fail-closed: guest sees the non-entitled variant.
        expect(result.current.has('can_use_rich_description')).toBe(false);
        expect(result.current.plan).toBeNull();
        expect(result.current.error).toBeNull();
    });

    it('stays loading and does NOT fetch while the session is resolving', () => {
        mockUseSession.mockReturnValue(SESSION_PENDING);

        const { result } = renderHook(() => useMyEntitlements());

        expect(result.current.isLoading).toBe(true);
        expect(mockFetch).not.toHaveBeenCalled();
        expect(result.current.has('can_use_rich_description')).toBe(false);
    });

    it('fetches once the session resolves from pending to authenticated', async () => {
        mockUseSession.mockReturnValue(SESSION_PENDING);
        mockFetch.mockResolvedValueOnce(mockSuccessResponse(ENTITLEMENTS_RESPONSE));

        const { result, rerender } = renderHook(() => useMyEntitlements());

        // Pending: no fetch yet.
        expect(mockFetch).not.toHaveBeenCalled();

        // Session resolves to authenticated → effect re-runs and fetches.
        mockUseSession.mockReturnValue(AUTHENTICATED);
        rerender();

        await waitFor(() => {
            expect(result.current.isLoading).toBe(false);
        });

        expect(mockFetch).toHaveBeenCalledTimes(1);
        expect(result.current.has('can_use_rich_description')).toBe(true);
    });

    it('clears entitlements when the session flips from authenticated to guest (sign-out)', async () => {
        mockFetch.mockResolvedValueOnce(mockSuccessResponse(ENTITLEMENTS_RESPONSE));

        const { result, rerender } = renderHook(() => useMyEntitlements());

        await waitFor(() => {
            expect(result.current.has('can_use_rich_description')).toBe(true);
        });

        // User signs out without a full reload while the island stays mounted.
        mockUseSession.mockReturnValue(GUEST);
        rerender();

        await waitFor(() => {
            expect(result.current.has('can_use_rich_description')).toBe(false);
        });
        expect(result.current.plan).toBeNull();
        expect(result.current.error).toBeNull();
    });
});
