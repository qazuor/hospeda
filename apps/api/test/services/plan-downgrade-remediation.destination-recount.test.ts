/**
 * Regression tests for the destination recount bug (SPEC-167 bugfix).
 *
 * BUG: `triggerDestinationRecounts` called `accommodationModel.findAll` with
 * `{ id: { in: ids } }`. `buildWhereClause` throws `DbError` on plain-object
 * values — the recount silently never ran in production (caught by the outer
 * try/catch). The unit tests for the main service mocked `@repo/db` entirely,
 * masking the broken query shape.
 *
 * FIX: Replaced `accommodationModel.findAll` with a direct Drizzle
 * `select().from().where(inArray(...))` — the same pattern used throughout
 * the upgrade-restoration deps and the plan-restriction service.
 *
 * REGRESSION STRATEGY:
 * The function `triggerDestinationRecounts` is private and invoked via
 * `applyDowngradeRestrictions` after its transaction commits. We drive the
 * full service and assert that `DestinationService.updateAccommodationsCount`
 * is called with the correct `destinationId` resolved from the query results.
 *
 * This test file uses a different `@repo/db` mock from the main unit test file:
 * it exposes a `getDb()` stub returning a chainable query builder, so the
 * inArray SELECT path is exercised rather than bypassed.
 *
 * @module test/services/plan-downgrade-remediation.destination-recount
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// vi.mock declarations — hoisted, must be at top level
// ---------------------------------------------------------------------------

vi.mock('../../src/utils/logger', () => ({
    apiLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() }
}));

// The recount helper imports from @repo/db dynamically. We expose a real-looking
// getDb() that returns a chainable query builder stub. The builder's .where()
// resolves to the rows array we control in each test.
const dbQueryStub = vi.hoisted(() => {
    // Mutable rows returned by the stub (set per-test)
    const rows: Array<{ id: string; destinationId: string }> = [];
    const whereStub = vi.fn().mockImplementation(() => Promise.resolve(rows));
    const fromStub = vi.fn().mockReturnValue({ where: whereStub });
    const selectStub = vi.fn().mockReturnValue({ from: fromStub });
    const getDbStub = vi.fn().mockReturnValue({ select: selectStub });
    return { rows, getDbStub, selectStub, fromStub, whereStub };
});

vi.mock('@repo/db', () => ({
    withTransaction: vi.fn(async (cb: (tx: unknown) => Promise<unknown>, existing?: unknown) =>
        cb(existing ?? {})
    ),
    // getDb is used by triggerDestinationRecounts — expose it
    getDb: dbQueryStub.getDbStub,
    // accommodations table reference (used in the select call)
    accommodations: {
        id: 'accommodations.id',
        destinationId: 'accommodations.destinationId'
    } as unknown as Record<string, unknown>
}));

// drizzle-orm's inArray is used directly in the fixed triggerDestinationRecounts.
vi.mock('drizzle-orm', () => ({
    inArray: vi.fn((col: unknown, ids: unknown[]) => ({ __inArray: { col, ids } }))
}));

// Mock the three primitive services (same pattern as main test file).
vi.mock('../../src/services/plan-restriction.service', () => ({
    restrictAccommodations: vi.fn(),
    restrictPromotions: vi.fn()
}));

vi.mock('../../src/services/plan-photo-restriction.service', () => ({
    archiveAccommodationPhotos: vi.fn()
}));

// Mock @repo/service-core — expose BOTH getRevalidationService AND DestinationService.
const updateAccommodationsCountMock = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));

vi.mock('@repo/service-core', () => ({
    getRevalidationService: vi.fn().mockReturnValue(undefined),
    DestinationService: vi.fn().mockImplementation(() => ({
        updateAccommodationsCount: updateAccommodationsCountMock
    }))
}));

// ---------------------------------------------------------------------------
// Import SUT after mocks
// ---------------------------------------------------------------------------

import { withTransaction } from '@repo/db';
import type { DowngradeRemediationDeps } from '../../src/services/plan-downgrade-remediation.service';
import { applyDowngradeRestrictions } from '../../src/services/plan-downgrade-remediation.service';
import { restrictAccommodations } from '../../src/services/plan-restriction.service';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const CUSTOMER_ID = 'cust-recount-001';
const USER_ID = 'user-recount-001';
const TARGET_PLAN_SLUG = 'owner-basico';

/**
 * Build minimal deps with one excess accommodation that will be restricted.
 * fetchAccommodationSlugs is a no-op here — we only care about the recount path.
 */
function makeOneDepsWithAccExcess(accId: string): DowngradeRemediationDeps {
    return {
        computeExcess: vi.fn().mockResolvedValue({
            accommodations: {
                cap: 1,
                activeCount: 2,
                excessCount: 1,
                items: [
                    {
                        id: 'acc-keep',
                        name: 'Keep',
                        updatedAt: '2026-05-01T00:00:00.000Z',
                        viewCount: null,
                        keepByDefault: true
                    },
                    {
                        id: accId,
                        name: 'Restrict',
                        updatedAt: '2026-04-01T00:00:00.000Z',
                        viewCount: null,
                        keepByDefault: false
                    }
                ]
            },
            promotions: { cap: 1, activeCount: 0, excessCount: 0, items: [] },
            photos: [],
            grandfatherFlags: [],
            hasExcess: true
        }),
        fetchAccommodationSlugs: vi.fn().mockResolvedValue({})
    };
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('triggerDestinationRecounts — regression (SPEC-167 bugfix)', () => {
    beforeEach(() => {
        vi.clearAllMocks();

        // Re-apply withTransaction pass-through after clearAllMocks.
        vi.mocked(withTransaction).mockImplementation(
            (
                cb: Parameters<typeof withTransaction>[0],
                existing?: Parameters<typeof withTransaction>[1]
            ) => (cb as (tx: unknown) => Promise<unknown>)(existing ?? {})
        );

        // Default: restrictAccommodations succeeds
        vi.mocked(restrictAccommodations).mockResolvedValue({ affectedIds: [] });

        // Reset the query stub rows
        dbQueryStub.rows.length = 0;
        dbQueryStub.whereStub.mockImplementation(() => Promise.resolve(dbQueryStub.rows));
        updateAccommodationsCountMock.mockReset();
        updateAccommodationsCountMock.mockResolvedValue(undefined);
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    it('calls updateAccommodationsCount with the destinationId resolved from the inArray query', async () => {
        // Arrange — the restricted accommodation has destinationId = 'dest-99'
        const RESTRICTED_ACC_ID = 'acc-to-restrict';
        const DESTINATION_ID = 'dest-99';

        // Seed the query stub: when getDb().select().from().where() is called,
        // return one row linking the accommodation to the destination.
        dbQueryStub.rows.push({ id: RESTRICTED_ACC_ID, destinationId: DESTINATION_ID });
        dbQueryStub.whereStub.mockResolvedValue(dbQueryStub.rows);

        vi.mocked(restrictAccommodations).mockResolvedValue({
            affectedIds: [RESTRICTED_ACC_ID]
        });

        const deps = makeOneDepsWithAccExcess(RESTRICTED_ACC_ID);

        // Act
        await applyDowngradeRestrictions({
            userId: USER_ID,
            customerId: CUSTOMER_ID,
            targetPlanSlug: TARGET_PLAN_SLUG,
            deps
        });

        // Assert — updateAccommodationsCount must have been called with the destination
        // resolved from the inArray query, NOT from accommodationModel.findAll which throws.
        expect(
            updateAccommodationsCountMock,
            'updateAccommodationsCount must be called after restriction'
        ).toHaveBeenCalledWith(DESTINATION_ID);
        expect(updateAccommodationsCountMock).toHaveBeenCalledTimes(1);
    });

    it('calls updateAccommodationsCount for each distinct destinationId across multiple restricted accommodations', async () => {
        // Arrange — two restricted accommodations in different destinations
        const ACC_A = 'acc-a';
        const ACC_B = 'acc-b';
        const DEST_A = 'dest-a';
        const DEST_B = 'dest-b';

        dbQueryStub.rows.push(
            { id: ACC_A, destinationId: DEST_A },
            { id: ACC_B, destinationId: DEST_B }
        );
        dbQueryStub.whereStub.mockResolvedValue(dbQueryStub.rows);

        // Both accommodations are in excess
        const deps: DowngradeRemediationDeps = {
            computeExcess: vi.fn().mockResolvedValue({
                accommodations: {
                    cap: 0,
                    activeCount: 2,
                    excessCount: 2,
                    items: [
                        {
                            id: ACC_A,
                            name: 'A',
                            updatedAt: '2026-05-01T00:00:00.000Z',
                            viewCount: null,
                            keepByDefault: false
                        },
                        {
                            id: ACC_B,
                            name: 'B',
                            updatedAt: '2026-04-01T00:00:00.000Z',
                            viewCount: null,
                            keepByDefault: false
                        }
                    ]
                },
                promotions: { cap: 1, activeCount: 0, excessCount: 0, items: [] },
                photos: [],
                grandfatherFlags: [],
                hasExcess: true
            }),
            fetchAccommodationSlugs: vi.fn().mockResolvedValue({})
        };

        vi.mocked(restrictAccommodations).mockResolvedValue({ affectedIds: [ACC_A, ACC_B] });

        // Act
        await applyDowngradeRestrictions({
            userId: USER_ID,
            customerId: CUSTOMER_ID,
            targetPlanSlug: TARGET_PLAN_SLUG,
            deps
        });

        // Assert — one call per distinct destinationId
        expect(updateAccommodationsCountMock).toHaveBeenCalledTimes(2);
        expect(updateAccommodationsCountMock).toHaveBeenCalledWith(DEST_A);
        expect(updateAccommodationsCountMock).toHaveBeenCalledWith(DEST_B);
    });

    it('deduplicates destinationIds when multiple restricted accommodations share the same destination', async () => {
        const ACC_A = 'acc-same-dest-a';
        const ACC_B = 'acc-same-dest-b';
        const SHARED_DEST = 'dest-shared';

        dbQueryStub.rows.push(
            { id: ACC_A, destinationId: SHARED_DEST },
            { id: ACC_B, destinationId: SHARED_DEST }
        );
        dbQueryStub.whereStub.mockResolvedValue(dbQueryStub.rows);

        const deps: DowngradeRemediationDeps = {
            computeExcess: vi.fn().mockResolvedValue({
                accommodations: {
                    cap: 0,
                    activeCount: 2,
                    excessCount: 2,
                    items: [
                        {
                            id: ACC_A,
                            name: 'A',
                            updatedAt: '2026-05-01T00:00:00.000Z',
                            viewCount: null,
                            keepByDefault: false
                        },
                        {
                            id: ACC_B,
                            name: 'B',
                            updatedAt: '2026-04-01T00:00:00.000Z',
                            viewCount: null,
                            keepByDefault: false
                        }
                    ]
                },
                promotions: { cap: 1, activeCount: 0, excessCount: 0, items: [] },
                photos: [],
                grandfatherFlags: [],
                hasExcess: true
            }),
            fetchAccommodationSlugs: vi.fn().mockResolvedValue({})
        };

        vi.mocked(restrictAccommodations).mockResolvedValue({ affectedIds: [ACC_A, ACC_B] });

        await applyDowngradeRestrictions({
            userId: USER_ID,
            customerId: CUSTOMER_ID,
            targetPlanSlug: TARGET_PLAN_SLUG,
            deps
        });

        // Both accommodations map to the same destination — only ONE recount call.
        expect(updateAccommodationsCountMock).toHaveBeenCalledTimes(1);
        expect(updateAccommodationsCountMock).toHaveBeenCalledWith(SHARED_DEST);
    });

    it('does NOT call updateAccommodationsCount when no accommodations are restricted', async () => {
        const deps: DowngradeRemediationDeps = {
            computeExcess: vi.fn().mockResolvedValue({
                accommodations: { cap: 3, activeCount: 1, excessCount: 0, items: [] },
                promotions: { cap: 1, activeCount: 0, excessCount: 0, items: [] },
                photos: [],
                grandfatherFlags: [],
                hasExcess: false
            }),
            fetchAccommodationSlugs: vi.fn().mockResolvedValue({})
        };

        await applyDowngradeRestrictions({
            userId: USER_ID,
            customerId: CUSTOMER_ID,
            targetPlanSlug: TARGET_PLAN_SLUG,
            deps
        });

        expect(updateAccommodationsCountMock).not.toHaveBeenCalled();
    });

    it('soft-fails (warn, no throw) when the inArray query rejects', async () => {
        const RESTRICTED_ACC_ID = 'acc-recount-fail';

        // Simulate a DB error in the inArray query
        dbQueryStub.whereStub.mockRejectedValue(new Error('simulated DB error in recount'));

        vi.mocked(restrictAccommodations).mockResolvedValue({
            affectedIds: [RESTRICTED_ACC_ID]
        });

        const deps = makeOneDepsWithAccExcess(RESTRICTED_ACC_ID);

        // The main function must still resolve (recount is non-blocking)
        const result = await applyDowngradeRestrictions({
            userId: USER_ID,
            customerId: CUSTOMER_ID,
            targetPlanSlug: TARGET_PLAN_SLUG,
            deps
        });

        // Service still returns a summary — the recount failure is swallowed.
        expect(result.restricted.accommodations).toContain(RESTRICTED_ACC_ID);
        expect(updateAccommodationsCountMock).not.toHaveBeenCalled();
    });
});
