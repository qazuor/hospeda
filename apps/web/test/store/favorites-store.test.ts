/**
 * @file favorites-store.test.ts
 * @description Unit tests for the shared favorites store (HOS-369 WB0-2).
 *
 * Coverage:
 * - Batching: registrations inside the window collapse into ONE bulk request
 * - Grouping: one request per entity type
 * - Dedupe: repeated registrations, and entities already resolved or in flight
 * - Session: guests issue no request at all; the `/auth/me` cache is read first
 * - Result application: per-entity status, missing entries, failures, throws
 * - Publication: `setFavoriteStatus` reaches every island showing that entity
 * - Listener isolation: resolving one entity does not re-render the others
 * - SSR: the server snapshot is the anonymous, settled variant
 */

import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthMeSnapshot } from '../../src/lib/auth-cache';
import {
    getFavoriteStatus,
    getServerFavoriteStatus,
    requestFavoriteStatus,
    resetFavoritesStore,
    setFavoriteStatus,
    useFavoriteStatus
} from '../../src/store/favorites-store';

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

const mockCheckBulk = vi.fn();
const mockReadCachedAuthMe = vi.fn();
const mockFetchAuthMe = vi.fn();
const mockWriteCachedAuthMe = vi.fn();

vi.mock('../../src/lib/api/endpoints-protected', () => ({
    userBookmarksApi: {
        checkBulk: (...args: unknown[]) => mockCheckBulk(...args)
    }
}));

vi.mock('../../src/lib/auth-cache', () => ({
    readCachedAuthMe: () => mockReadCachedAuthMe(),
    fetchAuthMe: () => mockFetchAuthMe(),
    writeCachedAuthMe: (...args: unknown[]) => mockWriteCachedAuthMe(...args),
    // `test/setup.ts` calls this in a global afterEach; the mock must provide it.
    resetInFlightAuthMe: () => undefined
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** The batch window used by the store; tests advance timers past it to flush. */
const BATCH_WINDOW_MS = 50;

/** Build an `/auth/me` snapshot with the given session state. */
function buildAuthSnapshot(isAuthenticated: boolean): AuthMeSnapshot {
    return {
        isAuthenticated,
        user: isAuthenticated ? { id: 'user-1', name: 'Ana', email: 'ana@example.com' } : null,
        permissions: [],
        roles: isAuthenticated ? ['USER'] : [],
        cachedAt: Date.now()
    };
}

/** Advance past the batch window and let the resulting promise chain settle. */
async function flushBatch(): Promise<void> {
    await act(async () => {
        await vi.advanceTimersByTimeAsync(BATCH_WINDOW_MS);
    });
}

/** A successful `checkBulk` response carrying the given checks map. */
function bulkOk(checks: Record<string, { isBookmarked: boolean; bookmarkId: string | null }>): {
    ok: true;
    data: { checks: Record<string, unknown> };
} {
    return { ok: true, data: { checks } };
}

beforeEach(() => {
    vi.useFakeTimers();
    resetFavoritesStore();
    mockCheckBulk.mockReset();
    mockReadCachedAuthMe.mockReset();
    mockFetchAuthMe.mockReset();
    mockWriteCachedAuthMe.mockReset();
    // Default: an authenticated visitor, resolved from the fresh session cache.
    mockReadCachedAuthMe.mockReturnValue(buildAuthSnapshot(true));
    mockCheckBulk.mockResolvedValue(bulkOk({}));
});

afterEach(() => {
    vi.useRealTimers();
});

// ---------------------------------------------------------------------------
// Batching
// ---------------------------------------------------------------------------

describe('favorites-store batching', () => {
    it('should collapse registrations inside the window into a single bulk request', async () => {
        // Arrange
        const entityIds = ['acc-1', 'acc-2', 'acc-3'];

        // Act
        for (const entityId of entityIds) {
            requestFavoriteStatus({ entityType: 'ACCOMMODATION', entityId });
        }
        await flushBatch();

        // Assert
        expect(mockCheckBulk).toHaveBeenCalledTimes(1);
        expect(mockCheckBulk).toHaveBeenCalledWith({
            entityType: 'ACCOMMODATION',
            entityIds
        });
    });

    it('should not issue any request before the batch window elapses', () => {
        // Arrange / Act
        requestFavoriteStatus({ entityType: 'ACCOMMODATION', entityId: 'acc-1' });
        vi.advanceTimersByTime(BATCH_WINDOW_MS - 1);

        // Assert
        expect(mockCheckBulk).not.toHaveBeenCalled();
    });

    it('should mark a registered entity as resolving until the batch settles', async () => {
        // Arrange
        const ref = { entityType: 'ACCOMMODATION', entityId: 'acc-1' } as const;

        // Act
        requestFavoriteStatus(ref);

        // Assert
        expect(getFavoriteStatus(ref).isResolving).toBe(true);

        // Act
        await flushBatch();

        // Assert
        expect(getFavoriteStatus(ref).isResolving).toBe(false);
    });

    it('should issue one request per entity type', async () => {
        // Arrange / Act
        requestFavoriteStatus({ entityType: 'ACCOMMODATION', entityId: 'acc-1' });
        requestFavoriteStatus({ entityType: 'EVENT', entityId: 'evt-1' });
        requestFavoriteStatus({ entityType: 'ACCOMMODATION', entityId: 'acc-2' });
        await flushBatch();

        // Assert
        expect(mockCheckBulk).toHaveBeenCalledTimes(2);
        expect(mockCheckBulk).toHaveBeenCalledWith({
            entityType: 'ACCOMMODATION',
            entityIds: ['acc-1', 'acc-2']
        });
        expect(mockCheckBulk).toHaveBeenCalledWith({
            entityType: 'EVENT',
            entityIds: ['evt-1']
        });
    });

    it('should send a repeated registration of the same entity only once', async () => {
        // Arrange / Act
        requestFavoriteStatus({ entityType: 'ACCOMMODATION', entityId: 'acc-1' });
        requestFavoriteStatus({ entityType: 'ACCOMMODATION', entityId: 'acc-1' });
        await flushBatch();

        // Assert
        expect(mockCheckBulk).toHaveBeenCalledWith({
            entityType: 'ACCOMMODATION',
            entityIds: ['acc-1']
        });
    });

    it('should not re-request an entity that already resolved in this page load', async () => {
        // Arrange
        const ref = { entityType: 'ACCOMMODATION', entityId: 'acc-1' } as const;
        requestFavoriteStatus(ref);
        await flushBatch();
        expect(mockCheckBulk).toHaveBeenCalledTimes(1);

        // Act — a second island for the same entity mounts later.
        requestFavoriteStatus(ref);
        await flushBatch();

        // Assert
        expect(mockCheckBulk).toHaveBeenCalledTimes(1);
    });

    it('should start a new batch for registrations arriving after a flush', async () => {
        // Arrange
        requestFavoriteStatus({ entityType: 'ACCOMMODATION', entityId: 'acc-1' });
        await flushBatch();

        // Act — a card scrolled into view after the first batch went out.
        requestFavoriteStatus({ entityType: 'ACCOMMODATION', entityId: 'acc-2' });
        await flushBatch();

        // Assert
        expect(mockCheckBulk).toHaveBeenCalledTimes(2);
        expect(mockCheckBulk).toHaveBeenLastCalledWith({
            entityType: 'ACCOMMODATION',
            entityIds: ['acc-2']
        });
    });
});

// ---------------------------------------------------------------------------
// Session resolution
// ---------------------------------------------------------------------------

describe('favorites-store session resolution', () => {
    it('should issue no favorites request at all for a guest', async () => {
        // Arrange
        mockReadCachedAuthMe.mockReturnValue(buildAuthSnapshot(false));
        const ref = { entityType: 'ACCOMMODATION', entityId: 'acc-1' } as const;

        // Act
        requestFavoriteStatus(ref);
        await flushBatch();

        // Assert
        expect(mockCheckBulk).not.toHaveBeenCalled();
        expect(getFavoriteStatus(ref)).toEqual({
            isFavorited: false,
            bookmarkId: null,
            isResolving: false
        });
    });

    it('should read the session from the cache without fetching when it is fresh', async () => {
        // Arrange / Act
        requestFavoriteStatus({ entityType: 'ACCOMMODATION', entityId: 'acc-1' });
        await flushBatch();

        // Assert
        expect(mockFetchAuthMe).not.toHaveBeenCalled();
    });

    it('should fetch and persist the session when the cache is cold', async () => {
        // Arrange
        const snapshot = buildAuthSnapshot(true);
        mockReadCachedAuthMe.mockReturnValue(null);
        mockFetchAuthMe.mockResolvedValue(snapshot);

        // Act
        requestFavoriteStatus({ entityType: 'ACCOMMODATION', entityId: 'acc-1' });
        await flushBatch();

        // Assert
        expect(mockFetchAuthMe).toHaveBeenCalledTimes(1);
        expect(mockWriteCachedAuthMe).toHaveBeenCalledWith(snapshot);
        expect(mockCheckBulk).toHaveBeenCalledTimes(1);
    });
});

// ---------------------------------------------------------------------------
// Result application
// ---------------------------------------------------------------------------

describe('favorites-store result application', () => {
    it('should apply the per-entity favorited state and bookmark id', async () => {
        // Arrange
        mockCheckBulk.mockResolvedValue(
            bulkOk({
                'acc-1': { isBookmarked: true, bookmarkId: 'bm-1' },
                'acc-2': { isBookmarked: false, bookmarkId: null }
            })
        );

        // Act
        requestFavoriteStatus({ entityType: 'ACCOMMODATION', entityId: 'acc-1' });
        requestFavoriteStatus({ entityType: 'ACCOMMODATION', entityId: 'acc-2' });
        await flushBatch();

        // Assert
        expect(getFavoriteStatus({ entityType: 'ACCOMMODATION', entityId: 'acc-1' })).toEqual({
            isFavorited: true,
            bookmarkId: 'bm-1',
            isResolving: false
        });
        expect(getFavoriteStatus({ entityType: 'ACCOMMODATION', entityId: 'acc-2' })).toEqual({
            isFavorited: false,
            bookmarkId: null,
            isResolving: false
        });
    });

    it('should resolve an entity missing from the response as not favorited', async () => {
        // Arrange
        mockCheckBulk.mockResolvedValue(
            bulkOk({ 'acc-1': { isBookmarked: true, bookmarkId: 'bm-1' } })
        );

        // Act
        requestFavoriteStatus({ entityType: 'ACCOMMODATION', entityId: 'acc-1' });
        requestFavoriteStatus({ entityType: 'ACCOMMODATION', entityId: 'acc-missing' });
        await flushBatch();

        // Assert
        expect(getFavoriteStatus({ entityType: 'ACCOMMODATION', entityId: 'acc-missing' })).toEqual(
            {
                isFavorited: false,
                bookmarkId: null,
                isResolving: false
            }
        );
    });

    it('should settle as not favorited when the request fails', async () => {
        // Arrange
        mockCheckBulk.mockResolvedValue({
            ok: false,
            error: { status: 500, code: 'INTERNAL_ERROR' }
        });
        const ref = { entityType: 'ACCOMMODATION', entityId: 'acc-1' } as const;

        // Act
        requestFavoriteStatus(ref);
        await flushBatch();

        // Assert — settled, not stuck busy: the heart must stay clickable.
        expect(getFavoriteStatus(ref)).toEqual({
            isFavorited: false,
            bookmarkId: null,
            isResolving: false
        });
    });

    it('should settle as not favorited when the request throws', async () => {
        // Arrange
        mockCheckBulk.mockRejectedValue(new Error('network down'));
        const ref = { entityType: 'EVENT', entityId: 'evt-1' } as const;

        // Act
        requestFavoriteStatus(ref);
        await flushBatch();

        // Assert
        expect(getFavoriteStatus(ref)).toEqual({
            isFavorited: false,
            bookmarkId: null,
            isResolving: false
        });
    });

    it('should settle every entity when the session resolution throws', async () => {
        // Arrange
        mockReadCachedAuthMe.mockReturnValue(null);
        mockFetchAuthMe.mockRejectedValue(new Error('unexpected'));
        const ref = { entityType: 'ACCOMMODATION', entityId: 'acc-1' } as const;

        // Act
        requestFavoriteStatus(ref);
        await flushBatch();

        // Assert
        expect(getFavoriteStatus(ref).isResolving).toBe(false);
        expect(mockCheckBulk).not.toHaveBeenCalled();
    });
});

// ---------------------------------------------------------------------------
// Publication and listeners
// ---------------------------------------------------------------------------

describe('favorites-store publication', () => {
    it('should publish a status change to every island showing that entity', async () => {
        // Arrange — the same accommodation rendered as a card and in a map popup.
        const card = renderHook(() =>
            useFavoriteStatus({ entityType: 'ACCOMMODATION', entityId: 'acc-1' })
        );
        const popup = renderHook(() =>
            useFavoriteStatus({ entityType: 'ACCOMMODATION', entityId: 'acc-1' })
        );
        await flushBatch();

        // Act — the user toggles the heart on one of them.
        act(() => {
            setFavoriteStatus({
                entityType: 'ACCOMMODATION',
                entityId: 'acc-1',
                isFavorited: true,
                bookmarkId: 'bm-1'
            });
        });

        // Assert
        expect(card.result.current.isFavorited).toBe(true);
        expect(popup.result.current.isFavorited).toBe(true);
        expect(popup.result.current.bookmarkId).toBe('bm-1');
    });

    it('should not notify listeners of unrelated entities', async () => {
        // Arrange
        mockCheckBulk.mockResolvedValue(
            bulkOk({ 'acc-1': { isBookmarked: true, bookmarkId: 'bm-1' } })
        );
        requestFavoriteStatus({ entityType: 'ACCOMMODATION', entityId: 'acc-1' });
        requestFavoriteStatus({ entityType: 'ACCOMMODATION', entityId: 'acc-2' });
        await flushBatch();

        const other = renderHook(() =>
            useFavoriteStatus({ entityType: 'ACCOMMODATION', entityId: 'acc-2' })
        );
        const rendersBefore = other.result.current;

        // Act — change only acc-1.
        act(() => {
            setFavoriteStatus({
                entityType: 'ACCOMMODATION',
                entityId: 'acc-1',
                isFavorited: false,
                bookmarkId: null
            });
        });

        // Assert — acc-2's snapshot is the same object reference, so React had
        // nothing to re-render.
        expect(other.result.current).toBe(rendersBefore);
    });

    it('should keep the snapshot reference stable when a write changes nothing', async () => {
        // Arrange
        const ref = { entityType: 'ACCOMMODATION', entityId: 'acc-1' } as const;
        requestFavoriteStatus(ref);
        await flushBatch();
        const before = getFavoriteStatus(ref);

        // Act — write the identical status again.
        setFavoriteStatus({ ...ref, isFavorited: false, bookmarkId: null });

        // Assert
        expect(getFavoriteStatus(ref)).toBe(before);
    });
});

// ---------------------------------------------------------------------------
// Hook + SSR
// ---------------------------------------------------------------------------

describe('useFavoriteStatus', () => {
    it('should register the entity on mount and expose the resolved status', async () => {
        // Arrange
        mockCheckBulk.mockResolvedValue(
            bulkOk({ 'acc-1': { isBookmarked: true, bookmarkId: 'bm-1' } })
        );

        // Act
        const { result } = renderHook(() =>
            useFavoriteStatus({ entityType: 'ACCOMMODATION', entityId: 'acc-1' })
        );

        // Assert — busy while the batch is in flight.
        expect(result.current.isResolving).toBe(true);

        // Act
        await flushBatch();

        // Assert
        expect(mockCheckBulk).toHaveBeenCalledTimes(1);
        expect(result.current).toEqual({
            isFavorited: true,
            bookmarkId: 'bm-1',
            isResolving: false
        });
    });

    it('should share one request across many islands on the same page', async () => {
        // Arrange — a 3-card listing.
        const ids = ['acc-1', 'acc-2', 'acc-3'];

        // Act
        for (const entityId of ids) {
            renderHook(() => useFavoriteStatus({ entityType: 'ACCOMMODATION', entityId }));
        }
        await flushBatch();

        // Assert — one bulk call, not one per card.
        expect(mockCheckBulk).toHaveBeenCalledTimes(1);
        expect(mockCheckBulk).toHaveBeenCalledWith({
            entityType: 'ACCOMMODATION',
            entityIds: ids
        });
    });
});

describe('getServerFavoriteStatus', () => {
    it('should return the anonymous, settled variant', () => {
        // Arrange / Act
        const status = getServerFavoriteStatus();

        // Assert — SSR must render the un-favorited heart, never a busy one.
        expect(status).toEqual({ isFavorited: false, bookmarkId: null, isResolving: false });
    });
});

describe('resetFavoritesStore', () => {
    it('should drop cached statuses so a later registration re-requests', async () => {
        // Arrange
        const ref = { entityType: 'ACCOMMODATION', entityId: 'acc-1' } as const;
        requestFavoriteStatus(ref);
        await flushBatch();

        // Act
        resetFavoritesStore();
        requestFavoriteStatus(ref);
        await flushBatch();

        // Assert
        expect(mockCheckBulk).toHaveBeenCalledTimes(2);
    });
});
