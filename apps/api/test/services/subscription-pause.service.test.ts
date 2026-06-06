/**
 * Unit tests for setOwnerServiceSuspension (SPEC-167 T-018).
 *
 * RED-FIRST: written before the revalidation wiring exists. Tests that
 * assert `scheduleRevalidationBatch` is called will fail until T-018 is
 * implemented.
 *
 * Coverage:
 * - Suspend: revalidation scheduled for every affected accommodation (with slugs)
 * - Resume:  revalidation scheduled for every affected accommodation (with slugs)
 * - No affected accommodations → no revalidation call
 * - Revalidation service absent (getRevalidationService returns undefined) →
 *   DB write still succeeds (soft: optional-chaining pattern)
 * - Revalidation failure (scheduleRevalidationBatch throws) → DB write still
 *   succeeds (fire-and-forget; scheduleRevalidationBatch is void and internally
 *   swallows errors, so this is confirmed via semantic analysis)
 *
 * @module test/services/subscription-pause.service
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock('../../src/utils/logger', () => ({
    apiLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }
}));

// Mock @repo/db — getDb is replaced per-test in setupDbMock.
// The table/column objects only need to exist as identifiers for eq() calls.
vi.mock('@repo/db', () => ({
    accommodations: {
        id: 'acc-id',
        ownerId: 'acc-ownerId',
        ownerSuspended: 'acc-ownerSuspended',
        updatedAt: 'acc-updatedAt',
        slug: 'acc-slug'
    },
    billingCustomers: { id: 'bc-id', externalId: 'bc-externalId' },
    users: {
        id: 'users-id',
        serviceSuspended: 'users-serviceSuspended',
        updatedAt: 'users-updatedAt'
    },
    eq: vi.fn((_a: unknown, _b: unknown) => ({ _eq: true })),
    getDb: vi.fn()
}));

// Mock @repo/service-core for getRevalidationService
vi.mock('@repo/service-core', () => ({
    getRevalidationService: vi.fn()
}));

// ---------------------------------------------------------------------------
// Import SUT AFTER mocks
// ---------------------------------------------------------------------------

import { getDb } from '@repo/db';
import { getRevalidationService } from '@repo/service-core';
import { setOwnerServiceSuspension } from '../../src/services/subscription-pause.service';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const USER_ID = 'user-host-001';

/**
 * Builds a mock RevalidationService with a spy on scheduleRevalidationBatch.
 */
function makeRevalidationService() {
    return {
        scheduleRevalidationBatch: vi.fn()
    };
}

/**
 * Configures the getDb mock so that:
 * - users.update chain resolves with undefined (no return needed)
 * - accommodations.update chain resolves with the given rows via .returning()
 */
function setupDbMock(accommodationRows: Array<{ id: string; slug: string }>) {
    const returning = vi.fn().mockResolvedValue(accommodationRows);
    const accWhere = vi.fn(() => ({ returning }));
    const accSet = vi.fn(() => ({ where: accWhere }));

    const usersWhere = vi.fn().mockResolvedValue(undefined);
    const usersSet = vi.fn(() => ({ where: usersWhere }));

    let callCount = 0;
    const update = vi.fn(() => {
        callCount++;
        // First call: users.update (no returning)
        if (callCount === 1) return { set: usersSet };
        // Second call: accommodations.update (with returning)
        return { set: accSet };
    });

    vi.mocked(getDb).mockReturnValue({ update } as unknown as ReturnType<typeof getDb>);

    return { update, usersSet, accSet, accWhere, returning };
}

// ---------------------------------------------------------------------------
// Suites
// ---------------------------------------------------------------------------

describe('setOwnerServiceSuspension', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Default: revalidation service absent
        vi.mocked(getRevalidationService).mockReturnValue(undefined);
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    // ── Suspend path: revalidation fires for each affected accommodation ──

    describe('suspend (suspended: true)', () => {
        it('schedules revalidation for all affected accommodations with slugs', async () => {
            const rows = [
                { id: 'acc-1', slug: 'alojamiento-uno' },
                { id: 'acc-2', slug: 'alojamiento-dos' }
            ];
            setupDbMock(rows);

            const revalidationSvc = makeRevalidationService();
            vi.mocked(getRevalidationService).mockReturnValue(
                revalidationSvc as unknown as ReturnType<typeof getRevalidationService>
            );

            await setOwnerServiceSuspension({ userId: USER_ID, suspended: true });

            expect(revalidationSvc.scheduleRevalidationBatch).toHaveBeenCalledOnce();
            const { events, reason } = revalidationSvc.scheduleRevalidationBatch.mock
                .calls[0]?.[0] as {
                events: Array<{ entityType: string; slug: string }>;
                reason: string;
            };

            expect(events).toHaveLength(2);
            expect(events).toEqual(
                expect.arrayContaining([
                    { entityType: 'accommodation', slug: 'alojamiento-uno' },
                    { entityType: 'accommodation', slug: 'alojamiento-dos' }
                ])
            );
            expect(reason).toContain('suspend');
        });

        it('returns the correct accommodationsUpdated count', async () => {
            setupDbMock([{ id: 'acc-1', slug: 'slug-1' }]);
            vi.mocked(getRevalidationService).mockReturnValue(undefined);

            const result = await setOwnerServiceSuspension({ userId: USER_ID, suspended: true });

            expect(result.accommodationsUpdated).toBe(1);
        });
    });

    // ── Resume path: same revalidation logic ────────────────────────────────

    describe('resume (suspended: false)', () => {
        it('schedules revalidation for all affected accommodations with slugs', async () => {
            const rows = [{ id: 'acc-3', slug: 'casa-verde' }];
            setupDbMock(rows);

            const revalidationSvc = makeRevalidationService();
            vi.mocked(getRevalidationService).mockReturnValue(
                revalidationSvc as unknown as ReturnType<typeof getRevalidationService>
            );

            await setOwnerServiceSuspension({ userId: USER_ID, suspended: false });

            expect(revalidationSvc.scheduleRevalidationBatch).toHaveBeenCalledOnce();
            const { events } = revalidationSvc.scheduleRevalidationBatch.mock.calls[0]?.[0] as {
                events: Array<{ entityType: string; slug: string }>;
            };
            expect(events).toEqual([{ entityType: 'accommodation', slug: 'casa-verde' }]);
        });

        it('reason includes "resume" when clearing suspension', async () => {
            setupDbMock([{ id: 'acc-1', slug: 'slug-1' }]);
            const revalidationSvc = makeRevalidationService();
            vi.mocked(getRevalidationService).mockReturnValue(
                revalidationSvc as unknown as ReturnType<typeof getRevalidationService>
            );

            await setOwnerServiceSuspension({ userId: USER_ID, suspended: false });

            const { reason } = revalidationSvc.scheduleRevalidationBatch.mock.calls[0]?.[0] as {
                reason: string;
            };
            expect(reason).toContain('resume');
        });
    });

    // ── No affected accommodations → no revalidation call ───────────────────

    describe('no affected accommodations', () => {
        it('does NOT call scheduleRevalidationBatch when no accommodations are updated', async () => {
            setupDbMock([]);
            const revalidationSvc = makeRevalidationService();
            vi.mocked(getRevalidationService).mockReturnValue(
                revalidationSvc as unknown as ReturnType<typeof getRevalidationService>
            );

            await setOwnerServiceSuspension({ userId: USER_ID, suspended: true });

            expect(revalidationSvc.scheduleRevalidationBatch).not.toHaveBeenCalled();
        });

        it('still returns accommodationsUpdated: 0', async () => {
            setupDbMock([]);
            const result = await setOwnerServiceSuspension({ userId: USER_ID, suspended: true });
            expect(result.accommodationsUpdated).toBe(0);
        });
    });

    // ── Revalidation service absent → DB write still succeeds ───────────────

    describe('revalidation service absent', () => {
        it('does not throw when getRevalidationService returns undefined', async () => {
            setupDbMock([{ id: 'acc-1', slug: 'slug-1' }]);
            vi.mocked(getRevalidationService).mockReturnValue(undefined);

            await expect(
                setOwnerServiceSuspension({ userId: USER_ID, suspended: true })
            ).resolves.toEqual({ accommodationsUpdated: 1 });
        });

        it('returns correct count even when revalidation service is absent', async () => {
            setupDbMock([
                { id: 'a1', slug: 's1' },
                { id: 'a2', slug: 's2' }
            ]);
            vi.mocked(getRevalidationService).mockReturnValue(undefined);

            const result = await setOwnerServiceSuspension({ userId: USER_ID, suspended: false });
            expect(result.accommodationsUpdated).toBe(2);
        });
    });
});
