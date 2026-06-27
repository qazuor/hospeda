/**
 * Tests for photo limit enforcement — SPEC-204 T-014 relational table counting.
 *
 * After SPEC-204, enforcePhotoLimit() counts visible rows from the relational
 * `accommodation_media` table via `accommodationMediaModel.findByAccommodation({
 * accommodationId, state: 'visible' })` and reads `.total`. The JSONB blob is no
 * longer the source of truth for the count. These tests mock the model directly
 * and verify allow/block behaviour at the limit boundary.
 *
 * @module test/middlewares/limit-enforcement-photo
 */
import { LimitKey } from '@repo/billing';
import { RoleEnum, ServiceErrorCode } from '@repo/schemas';
import { type Actor, ServiceError } from '@repo/service-core';
import type { Context, Next } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { enforcePhotoLimit } from '../../src/middlewares/limit-enforcement';
import type { AppBindings } from '../../src/types';

// ---------------------------------------------------------------------------
// Hoist model mock so vi.mock() can reference it
// ---------------------------------------------------------------------------

const { mockFindByAccommodation } = vi.hoisted(() => ({
    mockFindByAccommodation: vi.fn()
}));

// Mock @repo/db — spread real module so unrelated exports stay intact.
// Only stub accommodationMediaModel.findByAccommodation (SPEC-204 table read).
vi.mock('@repo/db', async (importOriginal) => {
    const actual = await importOriginal<Record<string, unknown>>();
    return {
        ...actual,
        accommodationMediaModel: {
            findByAccommodation: mockFindByAccommodation
        }
    };
});

// Mock @repo/service-core with importOriginal so ServiceError instanceof checks
// in the middleware work correctly even when tests run in the same vitest fork
// as limit-enforcement.test.ts (which also mocks @repo/service-core). Without
// this, the mock from the other file can contaminate this one via module cache.
vi.mock('@repo/service-core', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@repo/service-core')>();
    return {
        ...actual
        // ServiceError is the real class from `actual` so `instanceof` checks and
        // property access (code, details, message) work as expected.
    };
});

vi.mock('../../src/utils/actor', () => ({
    getActorFromContext: vi.fn()
}));

vi.mock('../../src/utils/logger', () => ({
    apiLogger: {
        error: vi.fn(),
        warn: vi.fn(),
        info: vi.fn(),
        debug: vi.fn()
    }
}));

import { getActorFromContext } from '../../src/utils/actor';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Creates a mock Hono context with configurable limits map and params. */
function createMockContext(
    params: Record<string, string> = {},
    limitsMap: Map<LimitKey, number> = new Map()
): Context<AppBindings> {
    return {
        req: {
            param: (key: string) => params[key] ?? ''
        },
        get: (key: string) => {
            if (key === 'userLimits') return limitsMap;
            return undefined;
        },
        header: vi.fn()
    } as unknown as Context<AppBindings>;
}

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const BASE_ACTOR: Actor = {
    id: 'user-123',
    role: RoleEnum.HOST,
    permissions: []
};

describe('enforcePhotoLimit - relational table counting (SPEC-204)', () => {
    let mockNext: Next;
    let mockLimitsMap: Map<LimitKey, number>;

    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(getActorFromContext).mockReturnValue(BASE_ACTOR);

        mockNext = vi.fn().mockResolvedValue(undefined);
        mockLimitsMap = new Map<LimitKey, number>();
        mockLimitsMap.set(LimitKey.MAX_PHOTOS_PER_ACCOMMODATION, 10);
    });

    // -----------------------------------------------------------------------
    // Core allow/block behaviour driven by the table's visible total
    // -----------------------------------------------------------------------

    describe('table-based counting: allow when total is below the limit', () => {
        it('should allow when visible total (4) is below limit (10)', async () => {
            // Arrange: table reports 4 visible rows — well below the limit of 10.
            // Previously this test set up a JSONB blob with gallery + featuredImage;
            // the middleware now ignores media shape entirely and reads .total only.
            mockFindByAccommodation.mockResolvedValue({ total: 4 });

            const c = createMockContext({ id: 'acc-1' }, mockLimitsMap);

            // Act
            await enforcePhotoLimit()(c, mockNext);

            // Assert
            expect(mockNext).toHaveBeenCalled();
            expect(mockFindByAccommodation).toHaveBeenCalledWith({
                accommodationId: 'acc-1',
                state: 'visible'
            });
        });

        it('should allow when visible total is 0 (no photos yet)', async () => {
            // Replaces the old "count 0 when media field is null/undefined" tests.
            // The table returns 0 rows — the middleware uses that count directly.
            mockFindByAccommodation.mockResolvedValue({ total: 0 });

            const c = createMockContext({ id: 'acc-1' }, mockLimitsMap);
            await enforcePhotoLimit()(c, mockNext);

            expect(mockNext).toHaveBeenCalled();
        });

        it('should allow when visible total is 1 and limit is 10', async () => {
            // Single visible row (featured image or any photo) — still under limit.
            mockFindByAccommodation.mockResolvedValue({ total: 1 });

            const c = createMockContext({ id: 'acc-1' }, mockLimitsMap);
            await enforcePhotoLimit()(c, mockNext);

            expect(mockNext).toHaveBeenCalled();
        });

        it('should allow when visible total equals limit minus 1 (boundary below)', async () => {
            // One slot remaining — upload should still be permitted.
            mockFindByAccommodation.mockResolvedValue({ total: 9 });

            const c = createMockContext({ id: 'acc-1' }, mockLimitsMap);
            await enforcePhotoLimit()(c, mockNext);

            expect(mockNext).toHaveBeenCalled();
        });
    });

    describe('table-based counting: block when total reaches or exceeds the limit', () => {
        it('should block (throw ServiceError) when visible total equals the limit', async () => {
            // Replaces multiple old blob-based "at limit" tests.
            // Table reports total === limit → upload gate fires.
            mockFindByAccommodation.mockResolvedValue({ total: 10 });

            const c = createMockContext({ id: 'acc-1' }, mockLimitsMap);

            await expect(enforcePhotoLimit()(c, mockNext)).rejects.toThrow(ServiceError);
            expect(mockNext).not.toHaveBeenCalled();
        });

        it('should block with LIMIT_REACHED code and correct details (currentCount, maxAllowed)', async () => {
            // Validate the ServiceError shape: code, details.limitKey, counts, audience.
            mockFindByAccommodation.mockResolvedValue({ total: 5 });
            mockLimitsMap.set(LimitKey.MAX_PHOTOS_PER_ACCOMMODATION, 5);

            const c = createMockContext({ id: 'acc-1' }, mockLimitsMap);

            const promise = enforcePhotoLimit()(c, mockNext);
            await expect(promise).rejects.toBeInstanceOf(ServiceError);

            // Capture the thrown error to inspect its shape.
            const thrown = await promise.catch((e: unknown) => e);
            const serviceError = thrown as ServiceError;
            expect(serviceError.code).toBe(ServiceErrorCode.LIMIT_REACHED);
            expect(serviceError.details).toMatchObject({
                limitKey: LimitKey.MAX_PHOTOS_PER_ACCOMMODATION,
                currentCount: 5,
                maxAllowed: 5,
                upgradeAudience: 'host'
            });
        });

        it('should block when visible total (3) equals a low limit (3)', async () => {
            // Replaces the old "count only featured when no gallery" (limit=1) and
            // "count only gallery when no featured" (limit=2) tests. The middleware
            // never inspects blob shape — the table count is the single authority.
            mockFindByAccommodation.mockResolvedValue({ total: 3 });
            mockLimitsMap.set(LimitKey.MAX_PHOTOS_PER_ACCOMMODATION, 3);

            const c = createMockContext({ id: 'acc-1' }, mockLimitsMap);

            await expect(enforcePhotoLimit()(c, mockNext)).rejects.toThrow(ServiceError);
        });

        it('should block using only visible-row total (archived/video rows are not visible)', async () => {
            // Replaces "should ignore videos" and "should NOT count archivedGallery".
            // The `state:'visible'` filter on the DB query already excludes archived
            // and non-photo rows. The middleware receives whatever total the model
            // returns — this test confirms it uses that total as-is.
            // Table returns 3 visible rows (after the DB-side filter), limit is 3 → block.
            mockFindByAccommodation.mockResolvedValue({ total: 3 });
            mockLimitsMap.set(LimitKey.MAX_PHOTOS_PER_ACCOMMODATION, 3);

            const c = createMockContext({ id: 'acc-1' }, mockLimitsMap);

            await expect(enforcePhotoLimit()(c, mockNext)).rejects.toThrow(ServiceError);
            // Confirm the model was called with state:'visible' so the DB-level filter is applied.
            expect(mockFindByAccommodation).toHaveBeenCalledWith({
                accommodationId: 'acc-1',
                state: 'visible'
            });
        });
    });

    describe('error handling and passthrough', () => {
        it('should continue (call next) when findByAccommodation rejects unexpectedly', async () => {
            // A DB failure on the count query must not block the upload.
            mockFindByAccommodation.mockRejectedValue(new Error('DB connection lost'));

            const c = createMockContext({ id: 'acc-1' }, mockLimitsMap);
            await enforcePhotoLimit()(c, mockNext);

            expect(mockNext).toHaveBeenCalled();
        });

        it('should continue when accommodation ID is missing from params', async () => {
            const c = createMockContext({}, mockLimitsMap); // no 'id' param
            await enforcePhotoLimit()(c, mockNext);

            expect(mockNext).toHaveBeenCalled();
            expect(mockFindByAccommodation).not.toHaveBeenCalled();
        });

        it('should continue when actor is not authenticated', async () => {
            vi.mocked(getActorFromContext).mockReturnValue({
                id: '',
                role: RoleEnum.GUEST,
                permissions: []
            });

            const c = createMockContext({ id: 'acc-1' }, mockLimitsMap);
            await enforcePhotoLimit()(c, mockNext);

            expect(mockNext).toHaveBeenCalled();
            expect(mockFindByAccommodation).not.toHaveBeenCalled();
        });

        it('should allow unlimited when no limit is configured (unlimited plan)', async () => {
            // No entry in limits map → checkLimit returns unlimited (-1) → always allowed.
            mockFindByAccommodation.mockResolvedValue({ total: 100 });

            const emptyLimitsMap = new Map<LimitKey, number>();
            const c = createMockContext({ id: 'acc-1' }, emptyLimitsMap);
            await enforcePhotoLimit()(c, mockNext);

            expect(mockNext).toHaveBeenCalled();
        });
    });
});
