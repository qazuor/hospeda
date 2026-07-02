/**
 * Unit Tests: featured-by-entitlement-reconcile cron job (SPEC-309 T-014)
 *
 * Tests the drift-detection and correction logic in the reconcile backstop,
 * covering both the owner-wide PLAN pass and the per-accommodation ADDON
 * pass. No real DB connection — all I/O is mocked.
 *
 * Coverage:
 * 1. Zero-drift: DB matches the plan expectation for every row → no sync call.
 * 2. Plan drift-clear: DB=true but plan resolves false → syncFeaturedByEntitlementForOwner(active:false).
 * 3. Plan drift-set: DB=false but plan resolves true → syncFeaturedByEntitlementForOwner(active:true).
 * 4. Dry-run: drift detected but no sync call; corrected counters still increment.
 * 5. No accommodations: ownerIds list empty → no per-owner processing.
 * 6. Addon drift-set: plan=false, an addon-protected accommodation has
 *    featuredByEntitlement=false → syncFeaturedByEntitlementForAccommodation(active:true).
 * 7. Addon-protected row already correct: no sync calls at all.
 * 8. Addon pass skipped entirely when the owner-wide plan already covers everyone.
 * 9. Multiple owners: only the drifted owner is corrected.
 *
 * @module test/cron/featured-by-entitlement-reconcile
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CronJobContext } from '../../src/cron/types';

// ---------------------------------------------------------------------------
// Hoisted mocks — must be declared before vi.mock() factories reference them
// ---------------------------------------------------------------------------

const {
    mockResolveOwnerPlanGrantsFeatured,
    mockGetOwnerAccommodationIdsWithActiveFeaturedAddon,
    mockSyncFeaturedByEntitlementForOwner,
    mockSyncFeaturedByEntitlementForAccommodation,
    mockSelectDistinct,
    mockSelectRows
} = vi.hoisted(() => ({
    mockResolveOwnerPlanGrantsFeatured: vi.fn(),
    mockGetOwnerAccommodationIdsWithActiveFeaturedAddon: vi.fn().mockResolvedValue([]),
    mockSyncFeaturedByEntitlementForOwner: vi.fn().mockResolvedValue({ updated: 1, rows: [] }),
    mockSyncFeaturedByEntitlementForAccommodation: vi
        .fn()
        .mockResolvedValue({ updated: 1, rows: [] }),
    mockSelectDistinct: vi.fn(),
    mockSelectRows: vi.fn()
}));

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock('@repo/db', () => ({
    accommodations: {
        id: 'id',
        ownerId: 'owner_id',
        deletedAt: 'deleted_at',
        featuredByEntitlement: 'featured_by_entitlement'
    },
    and: vi.fn((...args: unknown[]) => ({ op: 'and', args })),
    eq: vi.fn((col: unknown, val: unknown) => ({ op: 'eq', col, val })),
    isNull: vi.fn((col: unknown) => ({ op: 'isNull', col })),
    getDb: vi.fn(() => ({
        selectDistinct: mockSelectDistinct,
        select: mockSelectRows
    }))
}));

vi.mock('@repo/service-core', () => ({
    resolveOwnerPlanGrantsFeatured: mockResolveOwnerPlanGrantsFeatured,
    getOwnerAccommodationIdsWithActiveFeaturedAddon:
        mockGetOwnerAccommodationIdsWithActiveFeaturedAddon,
    syncFeaturedByEntitlementForOwner: mockSyncFeaturedByEntitlementForOwner,
    syncFeaturedByEntitlementForAccommodation: mockSyncFeaturedByEntitlementForAccommodation
}));

// ---------------------------------------------------------------------------
// Import after mocks
// ---------------------------------------------------------------------------

import { featuredByEntitlementReconcileJob } from '../../src/cron/jobs/featured-by-entitlement-reconcile.job';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Minimal CronJobContext for tests. */
function buildCtx(overrides: Partial<CronJobContext> = {}): CronJobContext {
    return {
        logger: {
            info: vi.fn(),
            warn: vi.fn(),
            error: vi.fn(),
            debug: vi.fn()
        } as unknown as CronJobContext['logger'],
        startedAt: new Date('2025-01-01T06:00:00Z'),
        dryRun: false,
        ...overrides
    };
}

/**
 * Set up the db chain mocks.
 *
 * @param ownerIds - Distinct owner IDs returned by the selectDistinct call, in
 *   processing order.
 * @param rowsByOwner - Map of ownerId -> accommodation rows
 *   ({ id, featuredByEntitlement }) returned by the per-owner `select()` call.
 */
function setupDbMocks(
    ownerIds: string[],
    rowsByOwner: Record<string, Array<{ id: string; featuredByEntitlement: boolean }>>
): void {
    const distinctChain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue(ownerIds.map((id) => ({ ownerId: id })))
    };
    mockSelectDistinct.mockReturnValue(distinctChain);

    mockSelectRows.mockReset();
    for (const ownerId of ownerIds) {
        const rows = rowsByOwner[ownerId] ?? [];
        mockSelectRows.mockReturnValueOnce({
            from: vi.fn().mockReturnThis(),
            where: vi.fn().mockResolvedValue(rows)
        });
    }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('featured-by-entitlement-reconcile cron job', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockSyncFeaturedByEntitlementForOwner.mockResolvedValue({ updated: 1, rows: [] });
        mockSyncFeaturedByEntitlementForAccommodation.mockResolvedValue({ updated: 1, rows: [] });
        mockGetOwnerAccommodationIdsWithActiveFeaturedAddon.mockResolvedValue([]);
    });

    describe('job metadata', () => {
        it('has correct name and schedule', () => {
            expect(featuredByEntitlementReconcileJob.name).toBe(
                'featured-by-entitlement-reconcile'
            );
            expect(featuredByEntitlementReconcileJob.schedule).toBe('0 */6 * * *');
            expect(featuredByEntitlementReconcileJob.enabled).toBe(true);
        });
    });

    describe('zero-drift (no correction needed)', () => {
        it('does NOT call any sync when DB matches the plan expectation', async () => {
            setupDbMocks(['owner-001'], {
                'owner-001': [{ id: 'accom-1', featuredByEntitlement: true }]
            });
            mockResolveOwnerPlanGrantsFeatured.mockResolvedValue(true);

            const result = await featuredByEntitlementReconcileJob.handler(buildCtx());

            expect(result.success).toBe(true);
            expect(mockSyncFeaturedByEntitlementForOwner).not.toHaveBeenCalled();
            expect(mockSyncFeaturedByEntitlementForAccommodation).not.toHaveBeenCalled();
            expect(result.details).toMatchObject({
                correctedPlanOwners: 0,
                correctedAddonAccommodations: 0
            });
        });
    });

    describe('plan drift-clear (DB=true but plan=false)', () => {
        it('calls syncFeaturedByEntitlementForOwner with active:false', async () => {
            const ownerId = 'owner-drift-clear';
            setupDbMocks([ownerId], {
                [ownerId]: [{ id: 'accom-1', featuredByEntitlement: true }]
            });
            mockResolveOwnerPlanGrantsFeatured.mockResolvedValue(false);

            const result = await featuredByEntitlementReconcileJob.handler(buildCtx());

            expect(result.success).toBe(true);
            expect(mockSyncFeaturedByEntitlementForOwner).toHaveBeenCalledOnce();
            expect(mockSyncFeaturedByEntitlementForOwner).toHaveBeenCalledWith({
                ownerId,
                active: false
            });
            expect(result.details).toMatchObject({
                correctedPlanOwners: 1,
                correctedAddonAccommodations: 0
            });
        });
    });

    describe('plan drift-set (DB=false but plan=true)', () => {
        it('calls syncFeaturedByEntitlementForOwner with active:true', async () => {
            const ownerId = 'owner-drift-set';
            setupDbMocks([ownerId], {
                [ownerId]: [{ id: 'accom-1', featuredByEntitlement: false }]
            });
            mockResolveOwnerPlanGrantsFeatured.mockResolvedValue(true);

            const result = await featuredByEntitlementReconcileJob.handler(buildCtx());

            expect(result.success).toBe(true);
            expect(mockSyncFeaturedByEntitlementForOwner).toHaveBeenCalledOnce();
            expect(mockSyncFeaturedByEntitlementForOwner).toHaveBeenCalledWith({
                ownerId,
                active: true
            });
            expect(result.details).toMatchObject({ correctedPlanOwners: 1 });
        });
    });

    describe('dry-run mode', () => {
        it('counts drift without calling any sync', async () => {
            const ownerId = 'owner-dry';
            setupDbMocks([ownerId], {
                [ownerId]: [{ id: 'accom-1', featuredByEntitlement: false }]
            });
            mockResolveOwnerPlanGrantsFeatured.mockResolvedValue(true);

            const result = await featuredByEntitlementReconcileJob.handler(
                buildCtx({ dryRun: true })
            );

            expect(result.success).toBe(true);
            expect(mockSyncFeaturedByEntitlementForOwner).not.toHaveBeenCalled();
            expect(mockSyncFeaturedByEntitlementForAccommodation).not.toHaveBeenCalled();
            expect(result.details).toMatchObject({ correctedPlanOwners: 1, dryRun: true });
            expect(result.message).toMatch(/dry run/i);
        });
    });

    describe('no accommodations', () => {
        it('completes successfully with zero owners processed', async () => {
            setupDbMocks([], {});

            const result = await featuredByEntitlementReconcileJob.handler(buildCtx());

            expect(result.success).toBe(true);
            expect(mockSyncFeaturedByEntitlementForOwner).not.toHaveBeenCalled();
            expect(result.details).toMatchObject({
                totalOwners: 0,
                correctedPlanOwners: 0
            });
        });
    });

    describe('addon drift (per-accommodation pass)', () => {
        it('grants featuring on an addon-protected accommodation the checkout hook missed', async () => {
            const ownerId = 'owner-addon-drift';
            setupDbMocks([ownerId], {
                [ownerId]: [{ id: 'accom-addon', featuredByEntitlement: false }]
            });
            mockResolveOwnerPlanGrantsFeatured.mockResolvedValue(false);
            mockGetOwnerAccommodationIdsWithActiveFeaturedAddon.mockResolvedValue(['accom-addon']);

            const result = await featuredByEntitlementReconcileJob.handler(buildCtx());

            expect(result.success).toBe(true);
            // No plan-wide drift: the only row is addon-protected, excluded from
            // the plan-driven comparison.
            expect(mockSyncFeaturedByEntitlementForOwner).not.toHaveBeenCalled();
            expect(mockSyncFeaturedByEntitlementForAccommodation).toHaveBeenCalledWith({
                accommodationId: 'accom-addon',
                active: true,
                ownerId
            });
            expect(result.details).toMatchObject({
                correctedPlanOwners: 0,
                correctedAddonAccommodations: 1
            });
        });

        it('does not touch an addon-protected accommodation that is already correctly featured', async () => {
            const ownerId = 'owner-addon-ok';
            setupDbMocks([ownerId], {
                [ownerId]: [{ id: 'accom-addon', featuredByEntitlement: true }]
            });
            mockResolveOwnerPlanGrantsFeatured.mockResolvedValue(false);
            mockGetOwnerAccommodationIdsWithActiveFeaturedAddon.mockResolvedValue(['accom-addon']);

            const result = await featuredByEntitlementReconcileJob.handler(buildCtx());

            expect(result.success).toBe(true);
            expect(mockSyncFeaturedByEntitlementForOwner).not.toHaveBeenCalled();
            expect(mockSyncFeaturedByEntitlementForAccommodation).not.toHaveBeenCalled();
            expect(result.details).toMatchObject({
                correctedPlanOwners: 0,
                correctedAddonAccommodations: 0
            });
        });

        it('skips the addon pass entirely when the owner-wide plan already grants featuring', async () => {
            const ownerId = 'owner-plan-covers-all';
            setupDbMocks([ownerId], {
                [ownerId]: [{ id: 'accom-addon', featuredByEntitlement: true }]
            });
            mockResolveOwnerPlanGrantsFeatured.mockResolvedValue(true);
            mockGetOwnerAccommodationIdsWithActiveFeaturedAddon.mockResolvedValue(['accom-addon']);

            const result = await featuredByEntitlementReconcileJob.handler(buildCtx());

            expect(result.success).toBe(true);
            expect(mockSyncFeaturedByEntitlementForOwner).not.toHaveBeenCalled();
            expect(mockSyncFeaturedByEntitlementForAccommodation).not.toHaveBeenCalled();
            expect(result.details).toMatchObject({
                correctedPlanOwners: 0,
                correctedAddonAccommodations: 0
            });
        });
    });

    describe('addon-drift via expiry (grant expired, column stale — SPEC-309 T-029)', () => {
        // Not a separate addon-drift code path: once an addon grant expires,
        // `getOwnerAccommodationIdsWithActiveFeaturedAddon` no longer returns the
        // accommodation, so it falls into the PLAN-driven comparison (2c) instead
        // of the addon-driven one (2d) — see the job's own header comment ("This
        // also naturally clears any accommodation whose addon expired without
        // T-016's hook firing"). These tests prove that composition, both
        // directions.
        it('clears a stale featuredByEntitlement=true left behind by a missed expiry hook, when the plan does not independently grant it', async () => {
            const ownerId = 'owner-addon-expired-no-plan';
            setupDbMocks([ownerId], {
                [ownerId]: [{ id: 'accom-expired', featuredByEntitlement: true }]
            });
            mockResolveOwnerPlanGrantsFeatured.mockResolvedValue(false);
            // Grant has expired — no longer in the addon-protected set, so this
            // row is NOT excluded from the plan-driven comparison.
            mockGetOwnerAccommodationIdsWithActiveFeaturedAddon.mockResolvedValue([]);

            const result = await featuredByEntitlementReconcileJob.handler(buildCtx());

            expect(result.success).toBe(true);
            expect(mockSyncFeaturedByEntitlementForOwner).toHaveBeenCalledOnce();
            expect(mockSyncFeaturedByEntitlementForOwner).toHaveBeenCalledWith({
                ownerId,
                active: false
            });
            // The addon-drift pass (2d) is a no-op here: shouldBeFeaturedByPlan is
            // false, so it runs, but the protected set is empty — nothing to grant.
            expect(mockSyncFeaturedByEntitlementForAccommodation).not.toHaveBeenCalled();
            expect(result.details).toMatchObject({
                correctedPlanOwners: 1,
                correctedAddonAccommodations: 0
            });
        });

        it('leaves featuredByEntitlement=true untouched when the owner plan independently grants it (plan-guard composition)', async () => {
            const ownerId = 'owner-addon-expired-plan-covers';
            setupDbMocks([ownerId], {
                [ownerId]: [{ id: 'accom-expired', featuredByEntitlement: true }]
            });
            // The plan grants it too — the value the addon-expiry hook left
            // behind happens to still be correct, so there is no drift at all.
            mockResolveOwnerPlanGrantsFeatured.mockResolvedValue(true);
            mockGetOwnerAccommodationIdsWithActiveFeaturedAddon.mockResolvedValue([]);

            const result = await featuredByEntitlementReconcileJob.handler(buildCtx());

            expect(result.success).toBe(true);
            expect(mockSyncFeaturedByEntitlementForOwner).not.toHaveBeenCalled();
            expect(mockSyncFeaturedByEntitlementForAccommodation).not.toHaveBeenCalled();
            expect(result.details).toMatchObject({
                correctedPlanOwners: 0,
                correctedAddonAccommodations: 0
            });
        });
    });

    describe('multiple owners', () => {
        it('corrects only the drifted owner when mixed states exist', async () => {
            const ownerIds = ['owner-ok', 'owner-drift'];
            setupDbMocks(ownerIds, {
                'owner-ok': [{ id: 'accom-ok', featuredByEntitlement: true }],
                'owner-drift': [{ id: 'accom-drift', featuredByEntitlement: false }]
            });
            mockResolveOwnerPlanGrantsFeatured.mockResolvedValue(true);

            const result = await featuredByEntitlementReconcileJob.handler(buildCtx());

            expect(result.success).toBe(true);
            expect(mockSyncFeaturedByEntitlementForOwner).toHaveBeenCalledOnce();
            expect(mockSyncFeaturedByEntitlementForOwner).toHaveBeenCalledWith({
                ownerId: 'owner-drift',
                active: true
            });
            expect(result.details).toMatchObject({
                totalOwners: 2,
                correctedPlanOwners: 1
            });
        });
    });
});
