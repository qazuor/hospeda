/**
 * Unit tests for applyDowngradeRestrictions (SPEC-167 T-011).
 *
 * RED-FIRST: written before the implementation exists. The file imports from
 * `plan-downgrade-remediation.service` which does not yet exist, so ALL tests
 * fail at import time until T-011 is implemented.
 *
 * Coverage:
 * - Full flow per dimension: accommodations, promotions, photos
 * - Host selections honored (explicit keepIds override default)
 * - Stale/unknown ids dropped from keepSelections, filled from defaults
 * - Over-cap selection truncated to the plan limit (default ordering)
 * - Default fallback when no keepSelections provided
 * - Idempotent re-run: second call with already-restricted state = no-op summary
 * - Under-cap no-op: no primitive calls made when no excess
 * - Tx atomicity: primitive failure rolls back, no partial state visible
 * - Revalidation events fired AFTER tx success (not inside tx)
 * - Revalidation NOT fired when tx fails
 * - Revalidation NOT fired when under cap (no-op)
 * - Summary shape: restricted / keptBySelection / keptByDefault / grandfatherFlags
 * - Missing userId/targetPlanId → throws typed error
 *
 * Testing strategy:
 * - computeDowngradeExcess is mocked via DI (deps object).
 * - Primitives (restrictAccommodations, restrictPromotions,
 *   archiveAccommodationPhotos) are module-mocked.
 * - withTransaction is mocked to a pass-through so tx tests can simulate
 *   failures without a real DB.
 * - scheduleRevalidationBatch is mocked and call timing is asserted.
 *
 * @module test/services/plan-downgrade-remediation.service
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// vi.mock declarations — hoisted, must be at top level
// ---------------------------------------------------------------------------

vi.mock('../../src/utils/logger', () => ({
    apiLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() }
}));

// Mock @repo/db — only withTransaction is needed at this layer
vi.mock('@repo/db', () => ({
    withTransaction: vi.fn(async (cb: (tx: unknown) => Promise<unknown>, existing?: unknown) =>
        cb(existing ?? {})
    )
}));

// Mock the three primitive services
vi.mock('../../src/services/plan-restriction.service', () => ({
    restrictAccommodations: vi.fn(),
    restrictPromotions: vi.fn()
}));

vi.mock('../../src/services/plan-photo-restriction.service', () => ({
    archiveAccommodationPhotos: vi.fn()
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
import {
    type ApplyDowngradeRestrictionsInput,
    type DowngradeRemediationDeps,
    applyDowngradeRestrictions
} from '../../src/services/plan-downgrade-remediation.service';
import { archiveAccommodationPhotos } from '../../src/services/plan-photo-restriction.service';
import {
    restrictAccommodations,
    restrictPromotions
} from '../../src/services/plan-restriction.service';

// ---------------------------------------------------------------------------
// Fixtures and helpers
// ---------------------------------------------------------------------------

const CUSTOMER_ID = 'cust-001';
const USER_ID = 'user-host-001';
const TARGET_PLAN_SLUG = 'owner-basico';

/** Helper to build a minimal DowngradePreview returned by the mocked computeDowngradeExcess. */
function makePreview(
    overrides: {
        accExcess?: number;
        accItems?: Array<{
            id: string;
            name: string;
            updatedAt: string;
            viewCount: number | null;
            keepByDefault: boolean;
        }>;
        promoExcess?: number;
        promoItems?: Array<{
            id: string;
            name: string;
            updatedAt: string;
            viewCount: number | null;
            keepByDefault: boolean;
        }>;
        photoExcess?: Array<{
            accommodationId: string;
            accommodationName: string;
            cap: number;
            totalCount: number;
            excessCount: number;
            hasFeaturedImage: boolean;
            overflowPhotoUrls: string[];
        }>;
        grandfatherFlags?: Array<{
            accommodationId: string;
            accommodationName: string;
            hasRichDescription: boolean;
            hasVideoEmbed: boolean;
        }>;
    } = {}
) {
    const accExcess = overrides.accExcess ?? 0;
    const promoExcess = overrides.promoExcess ?? 0;
    const photoExcess = overrides.photoExcess ?? [];

    return {
        accommodations: {
            cap: 1,
            activeCount: accExcess + 1,
            excessCount: accExcess,
            items: overrides.accItems ?? []
        },
        promotions: {
            cap: 0,
            activeCount: promoExcess,
            excessCount: promoExcess,
            items: overrides.promoItems ?? []
        },
        photos: photoExcess,
        grandfatherFlags: overrides.grandfatherFlags ?? [],
        hasExcess: accExcess > 0 || promoExcess > 0 || photoExcess.length > 0
    };
}

/** Build a minimal mock deps object for the SUT. */
function makeDeps(
    previewOverride?: Awaited<ReturnType<typeof makePreview>>,
    accommodationSlugMap?: Record<string, string>
): DowngradeRemediationDeps {
    return {
        computeExcess: vi.fn().mockResolvedValue(previewOverride ?? makePreview()),
        fetchAccommodationSlugs: vi.fn().mockResolvedValue(accommodationSlugMap ?? {})
    };
}

/** Helper: build a minimal schedule-batch mock that records calls. */
function makeRevalidationService() {
    const svc = {
        scheduleRevalidationBatch: vi.fn()
    };
    return svc as unknown as ReturnType<typeof getRevalidationService> & {
        scheduleRevalidationBatch: ReturnType<typeof vi.fn>;
    };
}

// ---------------------------------------------------------------------------
// Suites
// ---------------------------------------------------------------------------

describe('applyDowngradeRestrictions', () => {
    beforeEach(() => {
        vi.clearAllMocks();

        // Default: primitives succeed and return what was requested
        vi.mocked(restrictAccommodations).mockResolvedValue({ affectedIds: [] });
        vi.mocked(restrictPromotions).mockResolvedValue({ affectedIds: [] });
        vi.mocked(archiveAccommodationPhotos).mockResolvedValue({ movedCount: 0, totalCount: 0 });

        // Default: no revalidation service
        vi.mocked(getRevalidationService).mockReturnValue(undefined);
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    // ── Under-cap: no excess → no-op ────────────────────────────────────────

    describe('under-cap no-op', () => {
        it('returns empty summary when computeExcess reports zero excess', async () => {
            const deps = makeDeps(makePreview());

            const result = await applyDowngradeRestrictions({
                userId: USER_ID,
                customerId: CUSTOMER_ID,
                targetPlanSlug: TARGET_PLAN_SLUG,
                deps
            });

            expect(result.restricted.accommodations).toHaveLength(0);
            expect(result.restricted.promotions).toHaveLength(0);
            expect(result.restricted.photosByAccommodation).toEqual({});
            expect(result.keptBySelection.accommodations).toHaveLength(0);
            expect(result.keptBySelection.promotions).toHaveLength(0);
            expect(result.keptByDefault.accommodations).toHaveLength(0);
            expect(result.keptByDefault.promotions).toHaveLength(0);
        });

        it('does NOT call any primitive when there is no excess', async () => {
            const deps = makeDeps(makePreview());

            await applyDowngradeRestrictions({
                userId: USER_ID,
                customerId: CUSTOMER_ID,
                targetPlanSlug: TARGET_PLAN_SLUG,
                deps
            });

            expect(restrictAccommodations).not.toHaveBeenCalled();
            expect(restrictPromotions).not.toHaveBeenCalled();
            expect(archiveAccommodationPhotos).not.toHaveBeenCalled();
        });

        it('does NOT schedule revalidation when there is no excess', async () => {
            const svc = makeRevalidationService();
            vi.mocked(getRevalidationService).mockReturnValue(svc);

            const deps = makeDeps(makePreview());
            await applyDowngradeRestrictions({
                userId: USER_ID,
                customerId: CUSTOMER_ID,
                targetPlanSlug: TARGET_PLAN_SLUG,
                deps
            });

            expect(svc.scheduleRevalidationBatch).not.toHaveBeenCalled();
        });
    });

    // ── Full accommodation flow ─────────────────────────────────────────────

    describe('accommodation excess', () => {
        it('restricts excess accommodations (beyond keepByDefault=true)', async () => {
            const items = [
                {
                    id: 'acc-1',
                    name: 'A',
                    updatedAt: '2026-05-01T00:00:00.000Z',
                    viewCount: null,
                    keepByDefault: true
                },
                {
                    id: 'acc-2',
                    name: 'B',
                    updatedAt: '2026-04-01T00:00:00.000Z',
                    viewCount: null,
                    keepByDefault: false
                },
                {
                    id: 'acc-3',
                    name: 'C',
                    updatedAt: '2026-03-01T00:00:00.000Z',
                    viewCount: null,
                    keepByDefault: false
                }
            ];

            vi.mocked(restrictAccommodations).mockResolvedValue({
                affectedIds: ['acc-2', 'acc-3']
            });

            const deps = makeDeps(makePreview({ accExcess: 2, accItems: items }), {
                'acc-1': 'slug-a',
                'acc-2': 'slug-b',
                'acc-3': 'slug-c'
            });

            const result = await applyDowngradeRestrictions({
                userId: USER_ID,
                customerId: CUSTOMER_ID,
                targetPlanSlug: TARGET_PLAN_SLUG,
                deps
            });

            expect(restrictAccommodations).toHaveBeenCalledWith(
                expect.objectContaining({ ids: expect.arrayContaining(['acc-2', 'acc-3']) })
            );
            const callArg = vi.mocked(restrictAccommodations).mock.calls[0]![0]!;
            expect(callArg.ids).not.toContain('acc-1');

            expect(result.restricted.accommodations).toEqual(
                expect.arrayContaining(['acc-2', 'acc-3'])
            );
            expect(result.keptByDefault.accommodations).toContain('acc-1');
        });

        it('honors explicit keepSelections.accommodationIds when all ids are valid', async () => {
            const items = [
                {
                    id: 'acc-1',
                    name: 'A',
                    updatedAt: '2026-05-01T00:00:00.000Z',
                    viewCount: null,
                    keepByDefault: true
                },
                {
                    id: 'acc-2',
                    name: 'B',
                    updatedAt: '2026-04-01T00:00:00.000Z',
                    viewCount: null,
                    keepByDefault: false
                }
            ];

            vi.mocked(restrictAccommodations).mockResolvedValue({ affectedIds: ['acc-1'] });

            const deps = makeDeps(makePreview({ accExcess: 1, accItems: items }));

            const result = await applyDowngradeRestrictions({
                userId: USER_ID,
                customerId: CUSTOMER_ID,
                targetPlanSlug: TARGET_PLAN_SLUG,
                keepSelections: { accommodationIds: ['acc-2'] },
                deps
            });

            // acc-2 is the one the host wants to keep — restrict acc-1 instead
            const callArg = vi.mocked(restrictAccommodations).mock.calls[0]![0]!;
            expect(callArg.ids).toContain('acc-1');
            expect(callArg.ids).not.toContain('acc-2');

            expect(result.keptBySelection.accommodations).toContain('acc-2');
        });

        it('drops stale (unknown) ids from keepSelections and falls back to default', async () => {
            const items = [
                {
                    id: 'acc-real',
                    name: 'Real',
                    updatedAt: '2026-05-01T00:00:00.000Z',
                    viewCount: null,
                    keepByDefault: true
                },
                {
                    id: 'acc-old',
                    name: 'Old',
                    updatedAt: '2026-04-01T00:00:00.000Z',
                    viewCount: null,
                    keepByDefault: false
                }
            ];

            vi.mocked(restrictAccommodations).mockResolvedValue({ affectedIds: ['acc-old'] });

            const deps = makeDeps(makePreview({ accExcess: 1, accItems: items }));

            // Host selection includes 'acc-ghost' which is not in items — stale uuid
            const result = await applyDowngradeRestrictions({
                userId: USER_ID,
                customerId: CUSTOMER_ID,
                targetPlanSlug: TARGET_PLAN_SLUG,
                keepSelections: { accommodationIds: ['acc-ghost-999'] },
                deps
            });

            // ghost id is dropped → falls back to keepByDefault → restrict acc-old
            const callArg = vi.mocked(restrictAccommodations).mock.calls[0]![0]!;
            expect(callArg.ids).toContain('acc-old');
            expect(callArg.ids).not.toContain('acc-real');
            expect(result.keptByDefault.accommodations).toContain('acc-real');
        });

        it('truncates over-cap keepSelections to the plan limit using default ordering', async () => {
            // cap = 1, host selects 2 — should keep only acc-2 (first by default sort)
            const items = [
                {
                    id: 'acc-1',
                    name: 'A',
                    updatedAt: '2026-05-01T00:00:00.000Z',
                    viewCount: null,
                    keepByDefault: true
                },
                {
                    id: 'acc-2',
                    name: 'B',
                    updatedAt: '2026-04-01T00:00:00.000Z',
                    viewCount: null,
                    keepByDefault: false
                },
                {
                    id: 'acc-3',
                    name: 'C',
                    updatedAt: '2026-03-01T00:00:00.000Z',
                    viewCount: null,
                    keepByDefault: false
                }
            ];

            vi.mocked(restrictAccommodations).mockResolvedValue({
                affectedIds: ['acc-2', 'acc-3']
            });

            const deps = makeDeps(makePreview({ accExcess: 2, accItems: items }));

            // Host tries to keep both acc-2 and acc-3, but cap is 1
            await applyDowngradeRestrictions({
                userId: USER_ID,
                customerId: CUSTOMER_ID,
                targetPlanSlug: TARGET_PLAN_SLUG,
                keepSelections: { accommodationIds: ['acc-2', 'acc-3'] },
                deps
            });

            // Should only keep 1 (cap). Default sort (keepByDefault order): acc-1 first.
            // After valid intersection [acc-2, acc-3] with cap=1 → keep acc-1 (default position 0)
            // because the excess compute's keepByDefault decides which ones are in the cap band.
            const callArg = vi.mocked(restrictAccommodations).mock.calls[0]![0]!;
            // Exactly cap=1 items are kept, so 2 are restricted
            expect(callArg.ids).toHaveLength(2);
        });
    });

    // ── Full promotion flow ─────────────────────────────────────────────────

    describe('promotion excess', () => {
        it('restricts excess promotions using default order when no keepSelections', async () => {
            const items = [
                {
                    id: 'promo-1',
                    name: 'P1',
                    updatedAt: '2026-05-01T00:00:00.000Z',
                    viewCount: null,
                    keepByDefault: false
                },
                {
                    id: 'promo-2',
                    name: 'P2',
                    updatedAt: '2026-04-01T00:00:00.000Z',
                    viewCount: null,
                    keepByDefault: false
                }
            ];

            vi.mocked(restrictPromotions).mockResolvedValue({
                affectedIds: ['promo-1', 'promo-2']
            });

            const deps = makeDeps(makePreview({ promoExcess: 2, promoItems: items }));

            const result = await applyDowngradeRestrictions({
                userId: USER_ID,
                customerId: CUSTOMER_ID,
                targetPlanSlug: TARGET_PLAN_SLUG,
                deps
            });

            expect(restrictPromotions).toHaveBeenCalledWith(
                expect.objectContaining({ ids: expect.arrayContaining(['promo-1', 'promo-2']) })
            );
            expect(result.restricted.promotions).toEqual(
                expect.arrayContaining(['promo-1', 'promo-2'])
            );
        });

        it('honors explicit keepSelections.promotionIds', async () => {
            const items = [
                {
                    id: 'promo-keep',
                    name: 'PK',
                    updatedAt: '2026-05-01T00:00:00.000Z',
                    viewCount: null,
                    keepByDefault: false
                },
                {
                    id: 'promo-drop',
                    name: 'PD',
                    updatedAt: '2026-04-01T00:00:00.000Z',
                    viewCount: null,
                    keepByDefault: false
                }
            ];

            vi.mocked(restrictPromotions).mockResolvedValue({ affectedIds: ['promo-drop'] });

            // cap=1, activeCount=2, excessCount=1
            const preview = {
                accommodations: { cap: 1, activeCount: 0, excessCount: 0, items: [] },
                promotions: { cap: 1, activeCount: 2, excessCount: 1, items },
                photos: [],
                grandfatherFlags: [],
                hasExcess: true
            };
            const deps2 = makeDeps(preview);

            const result = await applyDowngradeRestrictions({
                userId: USER_ID,
                customerId: CUSTOMER_ID,
                targetPlanSlug: TARGET_PLAN_SLUG,
                keepSelections: { promotionIds: ['promo-keep'] },
                deps: deps2
            });

            const callArg = vi.mocked(restrictPromotions).mock.calls[0]![0]!;
            expect(callArg.ids).toContain('promo-drop');
            expect(callArg.ids).not.toContain('promo-keep');
            expect(result.keptBySelection.promotions).toContain('promo-keep');
        });

        it('drops stale promotion ids and falls back to default', async () => {
            const items = [
                {
                    id: 'promo-real',
                    name: 'PR',
                    updatedAt: '2026-05-01T00:00:00.000Z',
                    viewCount: null,
                    keepByDefault: false
                }
            ];
            const preview = {
                accommodations: { cap: 1, activeCount: 0, excessCount: 0, items: [] },
                promotions: { cap: 0, activeCount: 1, excessCount: 1, items },
                photos: [],
                grandfatherFlags: [],
                hasExcess: true
            };
            vi.mocked(restrictPromotions).mockResolvedValue({ affectedIds: ['promo-real'] });

            const deps = makeDeps(preview);

            await applyDowngradeRestrictions({
                userId: USER_ID,
                customerId: CUSTOMER_ID,
                targetPlanSlug: TARGET_PLAN_SLUG,
                keepSelections: { promotionIds: ['promo-ghost-999'] },
                deps
            });

            const callArg = vi.mocked(restrictPromotions).mock.calls[0]![0]!;
            expect(callArg.ids).toContain('promo-real');
        });
    });

    // ── Full photo flow ─────────────────────────────────────────────────────

    describe('photo excess', () => {
        it('archives photos using overflowPhotoUrls when no photoKeepMap', async () => {
            const photoEntry = {
                accommodationId: 'acc-1',
                accommodationName: 'Acc One',
                cap: 2,
                totalCount: 4,
                excessCount: 2,
                hasFeaturedImage: true,
                overflowPhotoUrls: ['https://cdn.test/img3.jpg', 'https://cdn.test/img4.jpg']
            };

            vi.mocked(archiveAccommodationPhotos).mockResolvedValue({
                movedCount: 2,
                totalCount: 4
            });

            const deps = makeDeps(makePreview({ photoExcess: [photoEntry] }));

            const result = await applyDowngradeRestrictions({
                userId: USER_ID,
                customerId: CUSTOMER_ID,
                targetPlanSlug: TARGET_PLAN_SLUG,
                deps
            });

            expect(archiveAccommodationPhotos).toHaveBeenCalledWith(
                expect.objectContaining({
                    accommodationId: 'acc-1',
                    keepIds: expect.any(Set)
                })
            );
            // keepIds must NOT contain the overflow URLs
            const call = vi.mocked(archiveAccommodationPhotos).mock.calls[0]![0]!;
            expect(call.keepIds.has('https://cdn.test/img3.jpg')).toBe(false);
            expect(call.keepIds.has('https://cdn.test/img4.jpg')).toBe(false);

            expect(result.restricted.photosByAccommodation['acc-1']).toBe(2);
        });

        it('uses photoKeepMap urls when provided and valid', async () => {
            const photoEntry = {
                accommodationId: 'acc-1',
                accommodationName: 'Acc One',
                cap: 2,
                totalCount: 4,
                excessCount: 2,
                hasFeaturedImage: false,
                overflowPhotoUrls: ['https://cdn.test/img3.jpg', 'https://cdn.test/img4.jpg']
            };

            vi.mocked(archiveAccommodationPhotos).mockResolvedValue({
                movedCount: 2,
                totalCount: 4
            });

            const deps = makeDeps(makePreview({ photoExcess: [photoEntry] }));

            await applyDowngradeRestrictions({
                userId: USER_ID,
                customerId: CUSTOMER_ID,
                targetPlanSlug: TARGET_PLAN_SLUG,
                keepSelections: {
                    photoKeepMap: {
                        'acc-1': ['https://cdn.test/img1.jpg', 'https://cdn.test/img2.jpg']
                    }
                },
                deps
            });

            const call = vi.mocked(archiveAccommodationPhotos).mock.calls[0]![0]!;
            expect(call.keepIds.has('https://cdn.test/img1.jpg')).toBe(true);
            expect(call.keepIds.has('https://cdn.test/img2.jpg')).toBe(true);
        });
    });

    // ── Idempotency ─────────────────────────────────────────────────────────

    describe('idempotency', () => {
        it('second run with same state produces empty summary (no excess after first run)', async () => {
            // computeExcess is called fresh every time — after first run the items
            // are planRestricted=true, so computeExcess returns zero excess.
            const deps = makeDeps(makePreview());

            const result = await applyDowngradeRestrictions({
                userId: USER_ID,
                customerId: CUSTOMER_ID,
                targetPlanSlug: TARGET_PLAN_SLUG,
                deps
            });

            expect(result.restricted.accommodations).toHaveLength(0);
            expect(result.restricted.promotions).toHaveLength(0);
            expect(restrictAccommodations).not.toHaveBeenCalled();
            expect(restrictPromotions).not.toHaveBeenCalled();
        });
    });

    // ── Transaction atomicity ────────────────────────────────────────────────

    describe('transaction atomicity', () => {
        it('propagates the tx client to primitives inside the transaction', async () => {
            const fakeTx = { __fakeTx: true };
            // Cast needed: mockImplementationOnce is typed for the real withTransaction signature
            (
                vi.mocked(withTransaction) as unknown as {
                    mockImplementationOnce: (
                        fn: (cb: (tx: unknown) => Promise<unknown>) => Promise<unknown>
                    ) => void;
                }
            ).mockImplementationOnce(async (cb) => cb(fakeTx));

            const items = [
                {
                    id: 'acc-2',
                    name: 'B',
                    updatedAt: '2026-04-01T00:00:00.000Z',
                    viewCount: null,
                    keepByDefault: false
                }
            ];
            vi.mocked(restrictAccommodations).mockResolvedValue({ affectedIds: ['acc-2'] });

            const deps = makeDeps(
                makePreview({
                    accExcess: 1,
                    accItems: [
                        {
                            id: 'acc-1',
                            name: 'A',
                            updatedAt: '2026-05-01T00:00:00.000Z',
                            viewCount: null,
                            keepByDefault: true
                        },
                        ...items
                    ]
                })
            );

            await applyDowngradeRestrictions({
                userId: USER_ID,
                customerId: CUSTOMER_ID,
                targetPlanSlug: TARGET_PLAN_SLUG,
                deps
            });

            // Primitive must receive the tx client
            const callArg = vi.mocked(restrictAccommodations).mock.calls[0]![0]!;
            expect(callArg.db).toBe(fakeTx);
        });

        it('does NOT schedule revalidation when a primitive throws inside the tx', async () => {
            const svc = makeRevalidationService();
            vi.mocked(getRevalidationService).mockReturnValue(svc);

            const items = [
                {
                    id: 'acc-1',
                    name: 'A',
                    updatedAt: '2026-05-01T00:00:00.000Z',
                    viewCount: null,
                    keepByDefault: true
                },
                {
                    id: 'acc-2',
                    name: 'B',
                    updatedAt: '2026-04-01T00:00:00.000Z',
                    viewCount: null,
                    keepByDefault: false
                }
            ];

            // Simulate tx-level failure: withTransaction itself throws (because the
            // inner callback threw, and the real withTransaction rolls back and re-throws)
            vi.mocked(withTransaction).mockRejectedValueOnce(new Error('DB transaction failed'));

            const deps = makeDeps(makePreview({ accExcess: 1, accItems: items }));

            await expect(
                applyDowngradeRestrictions({
                    userId: USER_ID,
                    customerId: CUSTOMER_ID,
                    targetPlanSlug: TARGET_PLAN_SLUG,
                    deps
                })
            ).rejects.toThrow('DB transaction failed');

            expect(svc.scheduleRevalidationBatch).not.toHaveBeenCalled();
        });
    });

    // ── Revalidation ─────────────────────────────────────────────────────────

    describe('revalidation', () => {
        it('schedules revalidation for all restricted accommodations AFTER tx success', async () => {
            const svc = makeRevalidationService();
            vi.mocked(getRevalidationService).mockReturnValue(svc);

            const items = [
                {
                    id: 'acc-1',
                    name: 'A',
                    updatedAt: '2026-05-01T00:00:00.000Z',
                    viewCount: null,
                    keepByDefault: true
                },
                {
                    id: 'acc-2',
                    name: 'B',
                    updatedAt: '2026-04-01T00:00:00.000Z',
                    viewCount: null,
                    keepByDefault: false
                }
            ];
            vi.mocked(restrictAccommodations).mockResolvedValue({ affectedIds: ['acc-2'] });

            const deps = makeDeps(makePreview({ accExcess: 1, accItems: items }), {
                'acc-1': 'slug-a',
                'acc-2': 'slug-b'
            });

            await applyDowngradeRestrictions({
                userId: USER_ID,
                customerId: CUSTOMER_ID,
                targetPlanSlug: TARGET_PLAN_SLUG,
                deps
            });

            expect(svc.scheduleRevalidationBatch).toHaveBeenCalledOnce();
            const { events } = vi.mocked(svc.scheduleRevalidationBatch).mock.calls[0]![0]! as {
                events: Array<{ entityType: string; slug?: string }>;
            };
            expect(events.length).toBeGreaterThan(0);
            // Every event must be entityType='accommodation' and include a slug
            for (const ev of events) {
                expect(ev.entityType).toBe('accommodation');
                expect(typeof ev.slug).toBe('string');
            }
        });

        it('builds events with slugs from fetchAccommodationSlugs', async () => {
            const svc = makeRevalidationService();
            vi.mocked(getRevalidationService).mockReturnValue(svc);

            const items = [
                {
                    id: 'acc-1',
                    name: 'A',
                    updatedAt: '2026-05-01T00:00:00.000Z',
                    viewCount: null,
                    keepByDefault: true
                },
                {
                    id: 'acc-2',
                    name: 'B',
                    updatedAt: '2026-04-01T00:00:00.000Z',
                    viewCount: null,
                    keepByDefault: false
                }
            ];
            vi.mocked(restrictAccommodations).mockResolvedValue({ affectedIds: ['acc-2'] });

            const deps = makeDeps(makePreview({ accExcess: 1, accItems: items }), {
                'acc-2': 'my-special-slug'
            });

            await applyDowngradeRestrictions({
                userId: USER_ID,
                customerId: CUSTOMER_ID,
                targetPlanSlug: TARGET_PLAN_SLUG,
                deps
            });

            const { events } = vi.mocked(svc.scheduleRevalidationBatch).mock.calls[0]![0]! as {
                events: Array<{ entityType: string; slug?: string }>;
            };
            const accEvent = events.find(
                (ev) => ev.entityType === 'accommodation' && ev.slug === 'my-special-slug'
            );
            expect(accEvent).toBeDefined();
        });

        it('skips revalidation when getRevalidationService returns undefined', async () => {
            vi.mocked(getRevalidationService).mockReturnValue(undefined);

            const items = [
                {
                    id: 'acc-1',
                    name: 'A',
                    updatedAt: '2026-05-01T00:00:00.000Z',
                    viewCount: null,
                    keepByDefault: true
                },
                {
                    id: 'acc-2',
                    name: 'B',
                    updatedAt: '2026-04-01T00:00:00.000Z',
                    viewCount: null,
                    keepByDefault: false
                }
            ];
            vi.mocked(restrictAccommodations).mockResolvedValue({ affectedIds: ['acc-2'] });

            const deps = makeDeps(makePreview({ accExcess: 1, accItems: items }));

            // Should not throw even when revalidation service is absent
            await expect(
                applyDowngradeRestrictions({
                    userId: USER_ID,
                    customerId: CUSTOMER_ID,
                    targetPlanSlug: TARGET_PLAN_SLUG,
                    deps
                })
            ).resolves.not.toThrow();
        });
    });

    // ── Summary shape ────────────────────────────────────────────────────────

    describe('summary shape', () => {
        it('returns grandfatherFlags in the summary (informational, no action)', async () => {
            const grandfatherFlags = [
                {
                    accommodationId: 'acc-1',
                    accommodationName: 'Acc',
                    hasRichDescription: true,
                    hasVideoEmbed: false
                }
            ];
            const deps = makeDeps(makePreview({ grandfatherFlags }));

            const result = await applyDowngradeRestrictions({
                userId: USER_ID,
                customerId: CUSTOMER_ID,
                targetPlanSlug: TARGET_PLAN_SLUG,
                deps
            });

            expect(result.grandfatherFlags).toHaveLength(1);
            expect(result.grandfatherFlags[0]!.accommodationId).toBe('acc-1');
        });

        it('returns complete summary with all fields on a multi-dimension excess', async () => {
            const accItems = [
                {
                    id: 'acc-keep',
                    name: 'K',
                    updatedAt: '2026-05-01T00:00:00.000Z',
                    viewCount: null,
                    keepByDefault: true
                },
                {
                    id: 'acc-drop',
                    name: 'D',
                    updatedAt: '2026-04-01T00:00:00.000Z',
                    viewCount: null,
                    keepByDefault: false
                }
            ];
            const promoItems = [
                {
                    id: 'promo-drop',
                    name: 'PD',
                    updatedAt: '2026-04-01T00:00:00.000Z',
                    viewCount: null,
                    keepByDefault: false
                }
            ];
            const photoEntry = {
                accommodationId: 'acc-keep',
                accommodationName: 'K',
                cap: 2,
                totalCount: 3,
                excessCount: 1,
                hasFeaturedImage: false,
                overflowPhotoUrls: ['https://cdn.test/over.jpg']
            };

            vi.mocked(restrictAccommodations).mockResolvedValue({ affectedIds: ['acc-drop'] });
            vi.mocked(restrictPromotions).mockResolvedValue({ affectedIds: ['promo-drop'] });
            vi.mocked(archiveAccommodationPhotos).mockResolvedValue({
                movedCount: 1,
                totalCount: 3
            });

            const preview = {
                accommodations: { cap: 1, activeCount: 2, excessCount: 1, items: accItems },
                promotions: { cap: 0, activeCount: 1, excessCount: 1, items: promoItems },
                photos: [photoEntry],
                grandfatherFlags: [],
                hasExcess: true
            };
            const deps = makeDeps(preview);

            const result = await applyDowngradeRestrictions({
                userId: USER_ID,
                customerId: CUSTOMER_ID,
                targetPlanSlug: TARGET_PLAN_SLUG,
                deps
            });

            expect(result.restricted.accommodations).toContain('acc-drop');
            expect(result.restricted.promotions).toContain('promo-drop');
            expect(result.restricted.photosByAccommodation['acc-keep']).toBe(1);
            expect(result.keptByDefault.accommodations).toContain('acc-keep');
        });
    });

    // ── Input validation ────────────────────────────────────────────────────

    describe('input validation', () => {
        it('throws a typed error when userId is missing', async () => {
            const deps = makeDeps();
            await expect(
                applyDowngradeRestrictions({
                    userId: '',
                    customerId: CUSTOMER_ID,
                    targetPlanSlug: TARGET_PLAN_SLUG,
                    deps
                } as ApplyDowngradeRestrictionsInput)
            ).rejects.toThrow();
        });

        it('throws a typed error when targetPlanSlug is missing', async () => {
            const deps = makeDeps();
            await expect(
                applyDowngradeRestrictions({
                    userId: USER_ID,
                    customerId: CUSTOMER_ID,
                    targetPlanSlug: '',
                    deps
                } as ApplyDowngradeRestrictionsInput)
            ).rejects.toThrow();
        });
    });
});
