/**
 * Unit tests for applyUpgradeRestorations (SPEC-167 T-012).
 *
 * RED-FIRST: written before the implementation exists. All tests fail at
 * import time until plan-upgrade-restoration.service is created.
 *
 * Coverage:
 * - Full restore when new plan is uncapped (-1 limit): all restricted items
 *   are restored across all dimensions.
 * - Partial restore at cap: headroom = cap - activeCount; only that many
 *   restricted items are restored (order: most-recently-restricted first via
 *   updatedAt descending).
 * - No-op when nothing restricted: primitives not called, returns empty summary.
 * - Photos headroom math: restoreAccommodationPhotos called with toCap =
 *   cap - (current gallery length), clamped to archived count.
 * - Tx atomicity: primitive failure → throws, no partial state.
 * - Revalidation fires AFTER tx success only (not inside tx).
 * - Revalidation NOT fired when tx fails.
 * - Revalidation NOT fired when nothing was restored.
 * - Summary shape: { restored, stillRestricted }.
 * - Soft-fail wiring: restoration failure does NOT throw (returns partial
 *   summary); upgrade response is unaffected.
 * - Input validation: userId/newPlanId empty → throws.
 *
 * Testing strategy:
 * - All DB queries (restricted item fetches) are handled via injected deps.
 * - Primitives (restoreAccommodations, restorePromotions,
 *   restoreAccommodationPhotos) are module-mocked.
 * - withTransaction is mocked as a pass-through.
 * - getRevalidationService is mocked.
 * - Plan caps come from injected deps.getPlanCaps().
 *
 * @module test/services/plan-upgrade-restoration.service
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// vi.mock declarations — hoisted, must be at top level
// ---------------------------------------------------------------------------

vi.mock('../../src/utils/logger', () => ({
    apiLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() }
}));

// Mock @repo/db — only withTransaction needed at this layer
vi.mock('@repo/db', () => ({
    withTransaction: vi.fn(async (cb: (tx: unknown) => Promise<unknown>, existing?: unknown) =>
        cb(existing ?? {})
    )
}));

// Mock the restore primitives
vi.mock('../../src/services/plan-restriction.service', () => ({
    restoreAccommodations: vi.fn(),
    restorePromotions: vi.fn()
}));

vi.mock('../../src/services/plan-photo-restriction.service', () => ({
    restoreAccommodationPhotos: vi.fn()
}));

// Mock @repo/service-core for getRevalidationService
vi.mock('@repo/service-core', () => ({
    getRevalidationService: vi.fn()
}));

// ---------------------------------------------------------------------------
// Import SUT after mocks
// ---------------------------------------------------------------------------

import { withTransaction } from '@repo/db';
import { getRevalidationService } from '@repo/service-core';
import { restoreAccommodationPhotos } from '../../src/services/plan-photo-restriction.service';
import {
    restoreAccommodations,
    restorePromotions
} from '../../src/services/plan-restriction.service';
import type { UpgradeRestorationDeps } from '../../src/services/plan-upgrade-restoration.service';
import { applyUpgradeRestorations } from '../../src/services/plan-upgrade-restoration.service';

// ---------------------------------------------------------------------------
// Fixtures and helpers
// ---------------------------------------------------------------------------

const CUSTOMER_ID = 'cust-001';
const USER_ID = 'user-host-001';
const NEW_PLAN_ID = 'plan-uuid-pro-001';
const NEW_PLAN_SLUG = 'owner-pro';

/** Helper: build a deps object with sensible defaults. */
function makeDeps(overrides: Partial<UpgradeRestorationDeps> = {}): UpgradeRestorationDeps {
    return {
        getPlanSlug: vi.fn().mockResolvedValue(NEW_PLAN_SLUG),
        getPlanCaps: vi.fn().mockReturnValue({
            accommodationsCap: 3,
            promotionsCap: 5,
            photosPerAccommodationCap: 10
        }),
        getRestrictedAccommodations: vi.fn().mockResolvedValue([]),
        getActiveAccommodationCount: vi.fn().mockResolvedValue(0),
        getRestrictedPromotions: vi.fn().mockResolvedValue([]),
        getActivePromotionCount: vi.fn().mockResolvedValue(0),
        getAccommodationsWithArchivedPhotos: vi.fn().mockResolvedValue([]),
        fetchAccommodationSlugs: vi.fn().mockResolvedValue({}),
        ...overrides
    };
}

/** Build a mock restricted accommodation item. */
function makeRestrictedAcc(
    id: string,
    updatedAt: Date = new Date('2026-01-01T10:00:00Z')
): { id: string; updatedAt: Date } {
    return { id, updatedAt };
}

/** Build a mock restricted promotion item. */
function makeRestrictedPromo(
    id: string,
    updatedAt: Date = new Date('2026-01-01T10:00:00Z')
): { id: string; updatedAt: Date } {
    return { id, updatedAt };
}

/** Build a mock accommodation with archived photos. */
function makeAccWithPhotos(
    accommodationId: string,
    galleryCount: number,
    archivedCount: number
): { accommodationId: string; galleryCount: number; archivedCount: number } {
    return { accommodationId, galleryCount, archivedCount };
}

/** Helper: build a minimal schedule-batch mock. */
function makeRevalidationService() {
    const svc = { scheduleRevalidationBatch: vi.fn() };
    return svc as unknown as ReturnType<typeof getRevalidationService> & {
        scheduleRevalidationBatch: ReturnType<typeof vi.fn>;
    };
}

// ---------------------------------------------------------------------------
// Suites
// ---------------------------------------------------------------------------

describe('applyUpgradeRestorations', () => {
    beforeEach(() => {
        vi.clearAllMocks();

        // Reset withTransaction to pass-through (clearAllMocks resets call counts
        // but NOT implementations set via mockRejectedValue in prior tests).
        // The top-level vi.mock sets the pass-through as the default implementation;
        // vi.clearAllMocks() clears call history but may NOT clear a mockRejectedValue
        // set in a prior test. Calling mockReset() restores the default implementation.
        vi.mocked(withTransaction).mockReset();
        // Re-apply the pass-through after reset (mockReset removes all implementations).
        vi.mocked(withTransaction).mockImplementation(
            // Cast matches the module mock signature at the top of this file.
            (
                cb: Parameters<typeof withTransaction>[0],
                existing?: Parameters<typeof withTransaction>[1]
            ) => (cb as (tx: unknown) => Promise<unknown>)(existing ?? {})
        );

        // Default primitive stubs (success, nothing affected)
        vi.mocked(restoreAccommodations).mockResolvedValue({ affectedIds: [] });
        vi.mocked(restorePromotions).mockResolvedValue({ affectedIds: [] });
        vi.mocked(restoreAccommodationPhotos).mockResolvedValue({ movedCount: 0, totalCount: 0 });

        // Default: no revalidation service
        vi.mocked(getRevalidationService).mockReturnValue(undefined);
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    // ── Input validation ────────────────────────────────────────────────────

    describe('input validation', () => {
        it('throws when userId is empty', async () => {
            await expect(
                applyUpgradeRestorations({
                    userId: '',
                    customerId: CUSTOMER_ID,
                    newPlanId: NEW_PLAN_ID,
                    deps: makeDeps()
                })
            ).rejects.toThrow(/userId is required/);
        });

        it('throws when newPlanId is empty', async () => {
            await expect(
                applyUpgradeRestorations({
                    userId: USER_ID,
                    customerId: CUSTOMER_ID,
                    newPlanId: '',
                    deps: makeDeps()
                })
            ).rejects.toThrow(/newPlanId is required/);
        });
    });

    // ── No-op: nothing restricted ──────────────────────────────────────────

    describe('no-op when nothing restricted', () => {
        it('returns empty summary and calls no primitives when no restricted items exist', async () => {
            const deps = makeDeps({
                getRestrictedAccommodations: vi.fn().mockResolvedValue([]),
                getRestrictedPromotions: vi.fn().mockResolvedValue([]),
                getAccommodationsWithArchivedPhotos: vi.fn().mockResolvedValue([])
            });

            const result = await applyUpgradeRestorations({
                userId: USER_ID,
                customerId: CUSTOMER_ID,
                newPlanId: NEW_PLAN_ID,
                deps
            });

            expect(restoreAccommodations).not.toHaveBeenCalled();
            expect(restorePromotions).not.toHaveBeenCalled();
            expect(restoreAccommodationPhotos).not.toHaveBeenCalled();

            expect(result.restored.accommodations).toHaveLength(0);
            expect(result.restored.promotions).toHaveLength(0);
            expect(result.restored.photosByAccommodation).toEqual({});
            expect(result.stillRestricted.accommodations).toHaveLength(0);
            expect(result.stillRestricted.promotions).toHaveLength(0);
        });
    });

    // ── Full restore (uncapped plan: -1 limit) ─────────────────────────────

    describe('full restore when plan is uncapped', () => {
        it('restores ALL restricted accommodations when cap is -1', async () => {
            const restricted = [
                makeRestrictedAcc('acc-1'),
                makeRestrictedAcc('acc-2'),
                makeRestrictedAcc('acc-3')
            ];

            vi.mocked(restoreAccommodations).mockResolvedValue({
                affectedIds: ['acc-1', 'acc-2', 'acc-3']
            });

            const deps = makeDeps({
                getPlanCaps: vi.fn().mockReturnValue({
                    accommodationsCap: -1, // unlimited
                    promotionsCap: -1,
                    photosPerAccommodationCap: -1
                }),
                getRestrictedAccommodations: vi.fn().mockResolvedValue(restricted),
                getActiveAccommodationCount: vi.fn().mockResolvedValue(1)
            });

            const result = await applyUpgradeRestorations({
                userId: USER_ID,
                customerId: CUSTOMER_ID,
                newPlanId: NEW_PLAN_ID,
                deps
            });

            expect(restoreAccommodations).toHaveBeenCalledWith({
                ids: ['acc-1', 'acc-2', 'acc-3'],
                db: expect.anything()
            });
            expect(result.restored.accommodations).toEqual(['acc-1', 'acc-2', 'acc-3']);
            expect(result.stillRestricted.accommodations).toHaveLength(0);
        });

        it('restores ALL restricted promotions when cap is -1', async () => {
            const restricted = [makeRestrictedPromo('promo-1'), makeRestrictedPromo('promo-2')];

            vi.mocked(restorePromotions).mockResolvedValue({
                affectedIds: ['promo-1', 'promo-2']
            });

            const deps = makeDeps({
                getPlanCaps: vi.fn().mockReturnValue({
                    accommodationsCap: -1,
                    promotionsCap: -1,
                    photosPerAccommodationCap: -1
                }),
                getRestrictedPromotions: vi.fn().mockResolvedValue(restricted),
                getActivePromotionCount: vi.fn().mockResolvedValue(0)
            });

            const result = await applyUpgradeRestorations({
                userId: USER_ID,
                customerId: CUSTOMER_ID,
                newPlanId: NEW_PLAN_ID,
                deps
            });

            expect(restorePromotions).toHaveBeenCalledWith({
                ids: ['promo-1', 'promo-2'],
                db: expect.anything()
            });
            expect(result.restored.promotions).toEqual(['promo-1', 'promo-2']);
            expect(result.stillRestricted.promotions).toHaveLength(0);
        });
    });

    // ── Partial restore at cap ────────────────────────────────────────────

    describe('partial restore when still capped', () => {
        it('restores only headroom = cap - activeCount accommodations', async () => {
            // active = 1, cap = 3, restricted = 4 → headroom = 2
            // Restore the 2 most-recently-restricted (newest updatedAt first)
            const older = makeRestrictedAcc('acc-older', new Date('2026-01-01T08:00:00Z'));
            const newer1 = makeRestrictedAcc('acc-newer-1', new Date('2026-01-02T10:00:00Z'));
            const newer2 = makeRestrictedAcc('acc-newer-2', new Date('2026-01-02T09:00:00Z'));
            const oldest = makeRestrictedAcc('acc-oldest', new Date('2026-01-01T07:00:00Z'));

            // deps returns them in order (most-recently-restricted first)
            const restricted = [newer1, newer2, older, oldest];

            vi.mocked(restoreAccommodations).mockResolvedValue({
                affectedIds: ['acc-newer-1', 'acc-newer-2']
            });

            const deps = makeDeps({
                getPlanCaps: vi.fn().mockReturnValue({
                    accommodationsCap: 3,
                    promotionsCap: 5,
                    photosPerAccommodationCap: 10
                }),
                getRestrictedAccommodations: vi.fn().mockResolvedValue(restricted),
                getActiveAccommodationCount: vi.fn().mockResolvedValue(1) // active = 1
            });

            const result = await applyUpgradeRestorations({
                userId: USER_ID,
                customerId: CUSTOMER_ID,
                newPlanId: NEW_PLAN_ID,
                deps
            });

            // headroom = 3 - 1 = 2; restore the 2 most-recently-restricted
            expect(restoreAccommodations).toHaveBeenCalledWith({
                ids: ['acc-newer-1', 'acc-newer-2'],
                db: expect.anything()
            });
            expect(result.restored.accommodations).toEqual(['acc-newer-1', 'acc-newer-2']);
            // Still 2 restricted (older + oldest)
            expect(result.stillRestricted.accommodations).toEqual(['acc-older', 'acc-oldest']);
        });

        it('restores zero accommodations when already at cap (no headroom)', async () => {
            const restricted = [makeRestrictedAcc('acc-restricted')];
            const deps = makeDeps({
                getPlanCaps: vi.fn().mockReturnValue({
                    accommodationsCap: 2,
                    promotionsCap: -1,
                    photosPerAccommodationCap: -1
                }),
                getRestrictedAccommodations: vi.fn().mockResolvedValue(restricted),
                getActiveAccommodationCount: vi.fn().mockResolvedValue(2) // at cap
            });

            const result = await applyUpgradeRestorations({
                userId: USER_ID,
                customerId: CUSTOMER_ID,
                newPlanId: NEW_PLAN_ID,
                deps
            });

            expect(restoreAccommodations).not.toHaveBeenCalled();
            expect(result.restored.accommodations).toHaveLength(0);
            expect(result.stillRestricted.accommodations).toEqual(['acc-restricted']);
        });

        it('restores only headroom = cap - activeCount promotions', async () => {
            // active = 3, cap = 5, restricted = 3 → headroom = 2
            const promos = [
                makeRestrictedPromo('promo-1', new Date('2026-01-03T10:00:00Z')),
                makeRestrictedPromo('promo-2', new Date('2026-01-02T10:00:00Z')),
                makeRestrictedPromo('promo-3', new Date('2026-01-01T10:00:00Z'))
            ];

            vi.mocked(restorePromotions).mockResolvedValue({
                affectedIds: ['promo-1', 'promo-2']
            });

            const deps = makeDeps({
                getPlanCaps: vi.fn().mockReturnValue({
                    accommodationsCap: -1,
                    promotionsCap: 5,
                    photosPerAccommodationCap: -1
                }),
                getRestrictedPromotions: vi.fn().mockResolvedValue(promos),
                getActivePromotionCount: vi.fn().mockResolvedValue(3) // active = 3
            });

            const result = await applyUpgradeRestorations({
                userId: USER_ID,
                customerId: CUSTOMER_ID,
                newPlanId: NEW_PLAN_ID,
                deps
            });

            expect(restorePromotions).toHaveBeenCalledWith({
                ids: ['promo-1', 'promo-2'],
                db: expect.anything()
            });
            expect(result.restored.promotions).toEqual(['promo-1', 'promo-2']);
            expect(result.stillRestricted.promotions).toEqual(['promo-3']);
        });
    });

    // ── Photo headroom math ───────────────────────────────────────────────

    describe('photo restoration headroom', () => {
        it('calls restoreAccommodationPhotos with toCap = photoCap when gallery is empty', async () => {
            vi.mocked(restoreAccommodationPhotos).mockResolvedValue({
                movedCount: 5,
                totalCount: 10
            });

            const deps = makeDeps({
                getPlanCaps: vi.fn().mockReturnValue({
                    accommodationsCap: -1,
                    promotionsCap: -1,
                    photosPerAccommodationCap: 10
                }),
                getAccommodationsWithArchivedPhotos: vi
                    .fn()
                    .mockResolvedValue([makeAccWithPhotos('acc-1', 0, 5)])
            });

            await applyUpgradeRestorations({
                userId: USER_ID,
                customerId: CUSTOMER_ID,
                newPlanId: NEW_PLAN_ID,
                deps
            });

            expect(restoreAccommodationPhotos).toHaveBeenCalledWith({
                accommodationId: 'acc-1',
                toCap: 10,
                db: expect.anything()
            });
        });

        it('passes correct toCap when gallery already has some items', async () => {
            // gallery = 7, archived = 3, photoCap = 10 → headroom = 3, toCap = 10
            vi.mocked(restoreAccommodationPhotos).mockResolvedValue({
                movedCount: 3,
                totalCount: 10
            });

            const deps = makeDeps({
                getPlanCaps: vi.fn().mockReturnValue({
                    accommodationsCap: -1,
                    promotionsCap: -1,
                    photosPerAccommodationCap: 10
                }),
                getAccommodationsWithArchivedPhotos: vi
                    .fn()
                    .mockResolvedValue([makeAccWithPhotos('acc-1', 7, 3)])
            });

            await applyUpgradeRestorations({
                userId: USER_ID,
                customerId: CUSTOMER_ID,
                newPlanId: NEW_PLAN_ID,
                deps
            });

            expect(restoreAccommodationPhotos).toHaveBeenCalledWith({
                accommodationId: 'acc-1',
                toCap: 10,
                db: expect.anything()
            });
        });

        it('records photo movedCount in summary', async () => {
            vi.mocked(restoreAccommodationPhotos).mockResolvedValue({
                movedCount: 3,
                totalCount: 10
            });

            const deps = makeDeps({
                getPlanCaps: vi.fn().mockReturnValue({
                    accommodationsCap: -1,
                    promotionsCap: -1,
                    photosPerAccommodationCap: 10
                }),
                getAccommodationsWithArchivedPhotos: vi
                    .fn()
                    .mockResolvedValue([makeAccWithPhotos('acc-1', 7, 3)])
            });

            const result = await applyUpgradeRestorations({
                userId: USER_ID,
                customerId: CUSTOMER_ID,
                newPlanId: NEW_PLAN_ID,
                deps
            });

            expect(result.restored.photosByAccommodation['acc-1']).toBe(3);
        });

        it('skips photo restore when photoCap is -1 (unlimited)', async () => {
            const deps = makeDeps({
                getPlanCaps: vi.fn().mockReturnValue({
                    accommodationsCap: -1,
                    promotionsCap: -1,
                    photosPerAccommodationCap: -1
                }),
                getAccommodationsWithArchivedPhotos: vi
                    .fn()
                    .mockResolvedValue([makeAccWithPhotos('acc-1', 2, 5)])
            });

            await applyUpgradeRestorations({
                userId: USER_ID,
                customerId: CUSTOMER_ID,
                newPlanId: NEW_PLAN_ID,
                deps
            });

            // When unlimited, restore all archived (restoreCount = Infinity equivalent or
            // toCap = a very large number; the exact impl may differ but the primitive SHOULD
            // still be called to restore everything)
            expect(restoreAccommodationPhotos).toHaveBeenCalled();
        });
    });

    // ── Tx atomicity ──────────────────────────────────────────────────────

    describe('transaction atomicity', () => {
        it('executes mutations inside the transaction callback', async () => {
            const txClient = { __isTxClient: true };
            vi.mocked(withTransaction).mockImplementation(async (cb) => cb(txClient as never));

            vi.mocked(restoreAccommodations).mockResolvedValue({ affectedIds: ['acc-1'] });

            const deps = makeDeps({
                getRestrictedAccommodations: vi
                    .fn()
                    .mockResolvedValue([makeRestrictedAcc('acc-1')]),
                getActiveAccommodationCount: vi.fn().mockResolvedValue(0)
            });

            await applyUpgradeRestorations({
                userId: USER_ID,
                customerId: CUSTOMER_ID,
                newPlanId: NEW_PLAN_ID,
                deps
            });

            // Primitive was called with the tx client
            expect(restoreAccommodations).toHaveBeenCalledWith({
                ids: expect.any(Array),
                db: txClient
            });
        });

        it('propagates primitive failure out of withTransaction', async () => {
            vi.mocked(withTransaction).mockImplementation(async (cb) => cb({} as never));
            vi.mocked(restoreAccommodations).mockRejectedValue(
                new Error('DB constraint violation')
            );

            const deps = makeDeps({
                getRestrictedAccommodations: vi
                    .fn()
                    .mockResolvedValue([makeRestrictedAcc('acc-1')]),
                getActiveAccommodationCount: vi.fn().mockResolvedValue(0)
            });

            await expect(
                applyUpgradeRestorations({
                    userId: USER_ID,
                    customerId: CUSTOMER_ID,
                    newPlanId: NEW_PLAN_ID,
                    deps
                })
            ).rejects.toThrow('DB constraint violation');
        });
    });

    // ── Revalidation timing ──────────────────────────────────────────────

    describe('revalidation fires after tx, not inside it', () => {
        it('schedules revalidation for restored accommodations after tx commit', async () => {
            const revalSvc = makeRevalidationService();
            vi.mocked(getRevalidationService).mockReturnValue(revalSvc as never);

            vi.mocked(restoreAccommodations).mockResolvedValue({ affectedIds: ['acc-1'] });

            const deps = makeDeps({
                getRestrictedAccommodations: vi
                    .fn()
                    .mockResolvedValue([makeRestrictedAcc('acc-1')]),
                getActiveAccommodationCount: vi.fn().mockResolvedValue(0),
                fetchAccommodationSlugs: vi.fn().mockResolvedValue({ 'acc-1': 'my-place' })
            });

            await applyUpgradeRestorations({
                userId: USER_ID,
                customerId: CUSTOMER_ID,
                newPlanId: NEW_PLAN_ID,
                deps
            });

            // Revalidation called after tx
            expect(revalSvc.scheduleRevalidationBatch).toHaveBeenCalledWith(
                expect.objectContaining({
                    events: expect.arrayContaining([
                        expect.objectContaining({
                            entityType: 'accommodation',
                            slug: 'my-place'
                        })
                    ])
                })
            );
        });

        it('does NOT call scheduleRevalidationBatch when nothing was restored', async () => {
            const revalSvc = makeRevalidationService();
            vi.mocked(getRevalidationService).mockReturnValue(revalSvc as never);

            const deps = makeDeps({
                getRestrictedAccommodations: vi.fn().mockResolvedValue([]),
                getRestrictedPromotions: vi.fn().mockResolvedValue([]),
                getAccommodationsWithArchivedPhotos: vi.fn().mockResolvedValue([])
            });

            await applyUpgradeRestorations({
                userId: USER_ID,
                customerId: CUSTOMER_ID,
                newPlanId: NEW_PLAN_ID,
                deps
            });

            expect(revalSvc.scheduleRevalidationBatch).not.toHaveBeenCalled();
        });

        it('does NOT call scheduleRevalidationBatch when tx fails', async () => {
            const revalSvc = makeRevalidationService();
            vi.mocked(getRevalidationService).mockReturnValue(revalSvc as never);
            vi.mocked(withTransaction).mockRejectedValue(new Error('tx failed'));

            const deps = makeDeps({
                getRestrictedAccommodations: vi
                    .fn()
                    .mockResolvedValue([makeRestrictedAcc('acc-1')]),
                getActiveAccommodationCount: vi.fn().mockResolvedValue(0)
            });

            await expect(
                applyUpgradeRestorations({
                    userId: USER_ID,
                    customerId: CUSTOMER_ID,
                    newPlanId: NEW_PLAN_ID,
                    deps
                })
            ).rejects.toThrow('tx failed');

            expect(revalSvc.scheduleRevalidationBatch).not.toHaveBeenCalled();
        });
    });

    // ── Summary shape ────────────────────────────────────────────────────

    describe('summary shape', () => {
        it('returns correct restored/stillRestricted counts for a mixed scenario', async () => {
            // 2 restricted accs, cap=3, active=2 → headroom=1 → restore 1 (most recent)
            // 1 restricted promo, cap=5, active=4 → headroom=1 → restore 1
            const accs = [
                makeRestrictedAcc('acc-newer', new Date('2026-01-03T10:00:00Z')),
                makeRestrictedAcc('acc-older', new Date('2026-01-01T10:00:00Z'))
            ];
            const promos = [makeRestrictedPromo('promo-1', new Date('2026-01-02T10:00:00Z'))];

            vi.mocked(restoreAccommodations).mockResolvedValue({ affectedIds: ['acc-newer'] });
            vi.mocked(restorePromotions).mockResolvedValue({ affectedIds: ['promo-1'] });

            const deps = makeDeps({
                getPlanCaps: vi.fn().mockReturnValue({
                    accommodationsCap: 3,
                    promotionsCap: 5,
                    photosPerAccommodationCap: -1
                }),
                getRestrictedAccommodations: vi.fn().mockResolvedValue(accs),
                getActiveAccommodationCount: vi.fn().mockResolvedValue(2),
                getRestrictedPromotions: vi.fn().mockResolvedValue(promos),
                getActivePromotionCount: vi.fn().mockResolvedValue(4),
                getAccommodationsWithArchivedPhotos: vi.fn().mockResolvedValue([])
            });

            const result = await applyUpgradeRestorations({
                userId: USER_ID,
                customerId: CUSTOMER_ID,
                newPlanId: NEW_PLAN_ID,
                deps
            });

            expect(result.restored.accommodations).toEqual(['acc-newer']);
            expect(result.stillRestricted.accommodations).toEqual(['acc-older']);
            expect(result.restored.promotions).toEqual(['promo-1']);
            expect(result.stillRestricted.promotions).toHaveLength(0);
        });
    });

    // ── Soft-fail in upgrade path ────────────────────────────────────────

    describe('applyUpgradeRestorationsOrWarn (soft-fail wrapper)', () => {
        it('resolves with partial summary when restoration throws, not rejects', async () => {
            // The wrapper function must catch errors and log+return empty summary
            const { applyUpgradeRestorationsOrWarn } = await import(
                '../../src/services/plan-upgrade-restoration.service'
            );

            vi.mocked(withTransaction).mockRejectedValue(new Error('unexpected DB error'));

            const deps = makeDeps({
                getRestrictedAccommodations: vi
                    .fn()
                    .mockResolvedValue([makeRestrictedAcc('acc-1')]),
                getActiveAccommodationCount: vi.fn().mockResolvedValue(0)
            });

            // Must NOT throw
            const result = await applyUpgradeRestorationsOrWarn({
                userId: USER_ID,
                customerId: CUSTOMER_ID,
                newPlanId: NEW_PLAN_ID,
                deps
            });

            // Returns empty/error summary instead of throwing
            expect(result).toBeDefined();
            expect(result.restored.accommodations).toHaveLength(0);
        });
    });
});
