/**
 * Unit Tests: featured-by-plan-reconcile cron job (SPEC-292 T-007 / Group D)
 *
 * Tests the drift-detection and correction logic in the reconcile backstop.
 * No real DB or QZPay connection — all I/O is mocked.
 *
 * Coverage (mirrors the job's T-007 assertion contract):
 * 1. Zero-drift: owner has featuredByPlan=true AND billing says featured →
 *    syncFeaturedByPlan NOT called, correctedOwners=0.
 * 2. Drift-clear: owner has featuredByPlan=true BUT billing says NOT featured →
 *    syncFeaturedByPlan called with active:false, correctedOwners=1.
 * 3. Drift-set: owner has featuredByPlan=false BUT billing says featured →
 *    syncFeaturedByPlan called with active:true, correctedOwners=1.
 * 4. Dry-run: drift detected but syncFeaturedByPlan NOT called; correctedOwners=1.
 * 5. No accommodations: ownerIds list empty → no per-owner processing.
 * 6. Billing unavailable (getQZPayBilling returns null): resolves to false →
 *    featuredByPlan=true triggers drift-clear.
 * 7. Multiple owners: only drifted owners are corrected.
 *
 * @module test/cron/featured-by-plan-reconcile
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CronJobContext } from '../../src/cron/types';

// ---------------------------------------------------------------------------
// Hoisted mocks — must be declared before vi.mock() factories reference them
// ---------------------------------------------------------------------------

const {
    mockSyncFeaturedByPlan,
    mockIsAccommodationSubscription,
    mockSelectDistinct,
    mockSelectCurrent
} = vi.hoisted(() => ({
    mockSyncFeaturedByPlan: vi.fn().mockResolvedValue({ updated: 1 }),
    mockIsAccommodationSubscription: vi.fn().mockReturnValue(true),
    mockSelectDistinct: vi.fn(),
    mockSelectCurrent: vi.fn()
}));

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock('@repo/billing', () => ({
    EntitlementKey: { FEATURED_LISTING: 'featured_listing' },
    isEntitlementKey: vi.fn().mockReturnValue(true)
}));

vi.mock('@repo/db', () => ({
    accommodations: {
        ownerId: 'owner_id',
        deletedAt: 'deleted_at',
        featuredByPlan: 'featured_by_plan'
    },
    and: vi.fn((...args: unknown[]) => ({ op: 'and', args })),
    eq: vi.fn((col: unknown, val: unknown) => ({ op: 'eq', col, val })),
    isNull: vi.fn((col: unknown) => ({ op: 'isNull', col })),
    getDb: vi.fn(() => ({
        selectDistinct: mockSelectDistinct,
        select: mockSelectCurrent
    }))
}));

vi.mock('@repo/service-core', () => ({
    syncFeaturedByPlan: mockSyncFeaturedByPlan,
    isAccommodationSubscription: mockIsAccommodationSubscription
}));

vi.mock('../../src/middlewares/billing', () => ({
    getQZPayBilling: vi.fn()
}));

// ---------------------------------------------------------------------------
// Import after mocks
// ---------------------------------------------------------------------------

import { featuredByPlanReconcileJob } from '../../src/cron/jobs/featured-by-plan-reconcile.job';
import { getQZPayBilling } from '../../src/middlewares/billing';

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
 * Build a mock QZPay billing client that resolves the entitlement check.
 *
 * @param hasFeaturedListing - When true, the plan includes FEATURED_LISTING;
 *   when false, the plan does NOT (or no active subscription exists).
 */
function buildMockBilling(hasFeaturedListing: boolean) {
    if (!hasFeaturedListing) {
        // Simulate no active accommodation subscription
        return {
            customers: {
                getByExternalId: vi.fn().mockResolvedValue({ id: 'cust-1' })
            },
            subscriptions: {
                getByCustomerId: vi.fn().mockResolvedValue([])
            },
            plans: {
                get: vi.fn().mockResolvedValue(null)
            }
        };
    }

    return {
        customers: {
            getByExternalId: vi.fn().mockResolvedValue({ id: 'cust-1' })
        },
        subscriptions: {
            getByCustomerId: vi.fn().mockResolvedValue([
                {
                    id: 'sub-1',
                    status: 'active',
                    planId: 'plan-featured',
                    productDomain: 'accommodation'
                }
            ])
        },
        plans: {
            get: vi.fn().mockResolvedValue({
                id: 'plan-featured',
                entitlements: ['featured_listing', 'max_listings_10']
            })
        }
    };
}

/**
 * Set up the db chain mocks.
 *
 * @param ownerIds   - Distinct owner IDs returned by the selectDistinct call.
 * @param currentFeaturedByPlan - featuredByPlan value returned per owner in the
 *   per-owner select call. All owners share the same value in these unit tests.
 */
function setupDbMocks(ownerIds: string[], currentFeaturedByPlan: boolean): void {
    // selectDistinct chain: selectDistinct({...}).from(table).where(cond) → ownerRows
    const distinctChain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue(ownerIds.map((id) => ({ ownerId: id })))
    };
    mockSelectDistinct.mockReturnValue(distinctChain);

    // select chain per owner: select({...}).from(table).where(cond).limit(1) → [{ featuredByPlan }]
    const currentChain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([{ featuredByPlan: currentFeaturedByPlan }])
    };
    mockSelectCurrent.mockReturnValue(currentChain);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('featured-by-plan-reconcile cron job', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Restore the default syncFeaturedByPlan mock after clearAllMocks()
        mockSyncFeaturedByPlan.mockResolvedValue({ updated: 1 });
        // Default: isAccommodationSubscription returns true so billing checks succeed
        mockIsAccommodationSubscription.mockReturnValue(true);
    });

    describe('job metadata', () => {
        it('has correct name and schedule', () => {
            expect(featuredByPlanReconcileJob.name).toBe('featured-by-plan-reconcile');
            expect(featuredByPlanReconcileJob.schedule).toBe('0 */6 * * *');
            expect(featuredByPlanReconcileJob.enabled).toBe(true);
        });
    });

    describe('zero-drift (no correction needed)', () => {
        it('does NOT call syncFeaturedByPlan when DB matches billing', async () => {
            // Arrange — both DB and billing agree: owner is featured
            setupDbMocks(['owner-001'], true);
            vi.mocked(getQZPayBilling).mockReturnValue(buildMockBilling(true) as never);

            // Act
            const result = await featuredByPlanReconcileJob.handler(buildCtx());

            // Assert — no drift, no correction
            expect(result.success).toBe(true);
            expect(mockSyncFeaturedByPlan).not.toHaveBeenCalled();
            expect(result.details).toMatchObject({ correctedOwners: 0 });
        });

        it('does NOT call syncFeaturedByPlan when both DB and billing agree: not featured', async () => {
            // Arrange — DB has featuredByPlan=false, billing says NOT featured
            setupDbMocks(['owner-002'], false);
            vi.mocked(getQZPayBilling).mockReturnValue(buildMockBilling(false) as never);

            // Act
            const result = await featuredByPlanReconcileJob.handler(buildCtx());

            // Assert
            expect(result.success).toBe(true);
            expect(mockSyncFeaturedByPlan).not.toHaveBeenCalled();
            expect(result.details).toMatchObject({ correctedOwners: 0 });
        });
    });

    describe('drift-clear (DB=true but billing=false)', () => {
        it('calls syncFeaturedByPlan with active:false and reports correctedOwners=1', async () => {
            // Arrange — DB says featuredByPlan=true, but billing has no active featured sub
            const ownerId = 'owner-drift-clear';
            setupDbMocks([ownerId], true);
            vi.mocked(getQZPayBilling).mockReturnValue(buildMockBilling(false) as never);

            // Act
            const result = await featuredByPlanReconcileJob.handler(buildCtx());

            // Assert — drift detected, correction applied
            expect(result.success).toBe(true);
            expect(mockSyncFeaturedByPlan).toHaveBeenCalledOnce();
            expect(mockSyncFeaturedByPlan).toHaveBeenCalledWith({
                ownerId,
                active: false
            });
            expect(result.details).toMatchObject({ correctedOwners: 1 });
        });
    });

    describe('drift-set (DB=false but billing=true)', () => {
        it('calls syncFeaturedByPlan with active:true and reports correctedOwners=1', async () => {
            // Arrange — DB says featuredByPlan=false, but billing has active FEATURED_LISTING
            const ownerId = 'owner-drift-set';
            setupDbMocks([ownerId], false);
            vi.mocked(getQZPayBilling).mockReturnValue(buildMockBilling(true) as never);

            // Act
            const result = await featuredByPlanReconcileJob.handler(buildCtx());

            // Assert — drift detected, correction applied
            expect(result.success).toBe(true);
            expect(mockSyncFeaturedByPlan).toHaveBeenCalledOnce();
            expect(mockSyncFeaturedByPlan).toHaveBeenCalledWith({
                ownerId,
                active: true
            });
            expect(result.details).toMatchObject({ correctedOwners: 1 });
        });
    });

    describe('dry-run mode', () => {
        it('counts drift without calling syncFeaturedByPlan', async () => {
            // Arrange — drift exists but dry-run should prevent write
            setupDbMocks(['owner-dry'], false);
            vi.mocked(getQZPayBilling).mockReturnValue(buildMockBilling(true) as never);

            // Act
            const result = await featuredByPlanReconcileJob.handler(buildCtx({ dryRun: true }));

            // Assert — counted but not written
            expect(result.success).toBe(true);
            expect(mockSyncFeaturedByPlan).not.toHaveBeenCalled();
            expect(result.details).toMatchObject({ correctedOwners: 1, dryRun: true });
            expect(result.message).toMatch(/dry run/i);
        });
    });

    describe('no accommodations', () => {
        it('completes successfully with zero owners processed', async () => {
            // Arrange — no non-deleted accommodations in the DB
            setupDbMocks([], false);
            vi.mocked(getQZPayBilling).mockReturnValue(buildMockBilling(true) as never);

            // Act
            const result = await featuredByPlanReconcileJob.handler(buildCtx());

            // Assert
            expect(result.success).toBe(true);
            expect(mockSyncFeaturedByPlan).not.toHaveBeenCalled();
            expect(result.details).toMatchObject({
                totalOwners: 0,
                correctedOwners: 0
            });
        });
    });

    describe('billing unavailable', () => {
        it('treats owner as NOT featured (fails open) when getQZPayBilling returns null', async () => {
            // Arrange — DB has featuredByPlan=true, billing is null (fails open → false)
            setupDbMocks(['owner-nobilling'], true);
            vi.mocked(getQZPayBilling).mockReturnValue(null as never);

            // Act
            const result = await featuredByPlanReconcileJob.handler(buildCtx());

            // Assert — billing=null → shouldBeFeatured=false; DB=true → drift-clear
            expect(result.success).toBe(true);
            expect(mockSyncFeaturedByPlan).toHaveBeenCalledWith({
                ownerId: 'owner-nobilling',
                active: false
            });
            expect(result.details).toMatchObject({ correctedOwners: 1 });
        });

        it('no drift when DB=false and billing unavailable (both resolve to false)', async () => {
            // Arrange — featuredByPlan=false, billing=null → shouldBeFeatured=false → no drift
            setupDbMocks(['owner-nobilling-2'], false);
            vi.mocked(getQZPayBilling).mockReturnValue(null as never);

            // Act
            const result = await featuredByPlanReconcileJob.handler(buildCtx());

            // Assert
            expect(result.success).toBe(true);
            expect(mockSyncFeaturedByPlan).not.toHaveBeenCalled();
            expect(result.details).toMatchObject({ correctedOwners: 0 });
        });
    });

    describe('multiple owners', () => {
        it('corrects only the drifted owner when mixed states exist', async () => {
            // Arrange — two owners:
            // - 'owner-ok': featuredByPlan=true, billing=featured → no drift
            // - 'owner-drift': featuredByPlan=false, billing=featured → drift-set
            // We use separate select mocks for each per-owner call.
            const ownerIds = ['owner-ok', 'owner-drift'];
            const distinctChain = {
                from: vi.fn().mockReturnThis(),
                where: vi.fn().mockResolvedValue(ownerIds.map((id) => ({ ownerId: id })))
            };
            mockSelectDistinct.mockReturnValue(distinctChain);

            // selectCurrent is called once per owner; first call for 'owner-ok' returns
            // featuredByPlan=true, second for 'owner-drift' returns featuredByPlan=false.
            const makeCurrentChain = (featured: boolean) => ({
                from: vi.fn().mockReturnThis(),
                where: vi.fn().mockReturnThis(),
                limit: vi.fn().mockResolvedValue([{ featuredByPlan: featured }])
            });
            mockSelectCurrent
                .mockReturnValueOnce(makeCurrentChain(true)) // owner-ok
                .mockReturnValueOnce(makeCurrentChain(false)); // owner-drift

            vi.mocked(getQZPayBilling).mockReturnValue(buildMockBilling(true) as never);

            // Act
            const result = await featuredByPlanReconcileJob.handler(buildCtx());

            // Assert — only owner-drift was corrected
            expect(result.success).toBe(true);
            expect(mockSyncFeaturedByPlan).toHaveBeenCalledOnce();
            expect(mockSyncFeaturedByPlan).toHaveBeenCalledWith({
                ownerId: 'owner-drift',
                active: true
            });
            expect(result.details).toMatchObject({
                totalOwners: 2,
                correctedOwners: 1
            });
        });
    });
});
