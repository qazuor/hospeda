/**
 * HOS-1279 — a plan change in one vertical must not rewrite another vertical's
 * add-on cap.
 *
 * ---
 * THE BUG THESE TESTS REPRODUCE
 *
 * `handlePlanChangeAddonRecalculation` loaded EVERY active add-on purchase the
 * customer holds and recomputed each cap as `newPlan.limits[limitKey] ?? 0` plus
 * the add-on's increase. An accommodation plan does not declare
 * `max_gastronomies`, so for a host who also runs a restaurant that `?? 0`
 * resolved the gastronomy base to ZERO and wrote `0 + 1` back: a cap of 6
 * stomped to 1 by a plan change that had nothing to do with gastronomy. Nothing
 * raised — zero is a valid base and `limits.set` is an upsert.
 *
 * It runs in both directions. The commerce plan-change route
 * (`routes/commerce/protected/change-plan.ts`) reaches this same recalculation
 * through `applyTrialingPlanUpgrade`, so a gastronomy tier change stomped the
 * owner's accommodation add-on caps the same way.
 *
 * ---
 * WHY EVERY FIXTURE CARRIES TWO PURCHASES IN DIFFERENT DOMAINS
 *
 * With ONE purchase, "the filter kept the right one" and "the filter did
 * nothing" produce identical output — the suite would pass with the fix
 * reverted. Two purchases in two domains is the minimum shape in which the two
 * outcomes differ, and each test asserts on the FULL set of keys written, never
 * on a single call, so an extra write cannot slip past.
 *
 * @module test/services/addon-plan-change.domain-isolation.test
 */

import type { QZPayBilling } from '@qazuor/qzpay-core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { handlePlanChangeAddonRecalculation } from '../../src/services/addon-plan-change.service';

// ─── Hoisted mocks ────────────────────────────────────────────────────────────

const { mockDbWhere, mockTxLimit, mockTxInsertValues, mockPlanGetById, mockCatalogGetBySlug } =
    vi.hoisted(() => ({
        mockDbWhere: vi.fn().mockResolvedValue([]),
        mockTxLimit: vi.fn().mockResolvedValue([]),
        mockTxInsertValues: vi.fn().mockResolvedValue(undefined),
        mockPlanGetById: vi.fn(),
        mockCatalogGetBySlug: vi.fn()
    }));

// ─── Module mocks ─────────────────────────────────────────────────────────────

vi.mock('../../src/middlewares/entitlement', () => ({ clearEntitlementCache: vi.fn() }));

vi.mock('../../src/utils/logger', () => ({
    apiLogger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }
}));

vi.mock('../../src/utils/env', () => ({ env: { HOSPEDA_ADDON_LIFECYCLE_ENABLED: true } }));

// Downgrade notification is a separate concern (SPEC-043 AC-4.x) with its own
// suite; stubbed so these tests speak only about which caps get written.
vi.mock('../../src/services/addon-downgrade-detection.service', () => ({
    detectAndNotifyDowngrades: vi.fn().mockResolvedValue(undefined)
}));

vi.mock('@sentry/node', () => ({ captureMessage: vi.fn(), captureException: vi.fn() }));

vi.mock('@repo/db/schemas/billing', () => ({
    billingAddonPurchases: {
        id: 'id',
        customerId: 'customerId',
        addonSlug: 'addonSlug',
        status: 'status',
        deletedAt: 'deletedAt'
    }
}));

// `@repo/billing` stays REAL: `productDomainForPlanSlug` and
// `productDomainForLimitKey` are the two lookups under test here, and stubbing
// either would make every assertion below vacuous.

vi.mock('@repo/service-core', async (importOriginal) => {
    const actual = await importOriginal<Record<string, unknown>>();
    return {
        ...actual,
        AddonCatalogService: vi.fn().mockImplementation(function () {
            return { getBySlug: mockCatalogGetBySlug, list: vi.fn() };
        }),
        PlanService: vi.fn().mockImplementation(function () {
            return {
                getById: mockPlanGetById,
                getBySlug: vi.fn().mockResolvedValue({ success: false })
            };
        }),
        withServiceTransaction: vi.fn(
            async (
                cb: (ctx: { tx: unknown; hookState: Record<string, unknown> }) => Promise<unknown>
            ) => {
                const txStub = {
                    execute: vi.fn().mockResolvedValue(undefined),
                    select: vi.fn(() => ({
                        from: vi.fn(() => ({
                            innerJoin: vi.fn(() => ({
                                where: vi.fn(() => ({ limit: mockTxLimit }))
                            })),
                            where: vi.fn(() => {
                                const p = mockDbWhere() as Promise<unknown> & {
                                    limit: typeof mockTxLimit;
                                };
                                p.limit = mockTxLimit;
                                return p;
                            })
                        }))
                    })),
                    insert: vi.fn(() => ({ values: mockTxInsertValues }))
                };
                return cb({ tx: txStub, hookState: {} });
            }
        )
    };
});

// ─── Fixtures ─────────────────────────────────────────────────────────────────

/**
 * Real catalogue values throughout. An invented plan slug resolves to no domain
 * and takes the negotiated-plan fail-open branch, which would silently disable
 * the filter and leave these tests green while proving nothing.
 */
const ACCOMMODATION_PLAN_FROM = 'owner-pro';
const ACCOMMODATION_PLAN_TO = 'owner-basico';
const GASTRONOMY_PLAN_FROM = 'gastronomy-basico';
const GASTRONOMY_PLAN_TO = 'gastronomy-pro';
const EXPERIENCE_PLAN_TO = 'experience-pro';

const ACCOMMODATION_KEY = 'max_accommodations';
const GASTRONOMY_KEY = 'max_gastronomies';
const EXPERIENCE_KEY = 'max_experiences';

/** The dual owner: a host who also runs a restaurant. Seeded as `host-provider@local.test`. */
const accommodationPurchase = {
    id: 'purch_accommodation',
    addonSlug: 'extra-accommodations-5',
    status: 'active',
    deletedAt: null,
    limitAdjustments: [{ limitKey: ACCOMMODATION_KEY, increase: 5 }]
};

const gastronomyPurchase = {
    id: 'purch_gastronomy',
    addonSlug: 'extra-gastronomies-1',
    status: 'active',
    deletedAt: null,
    limitAdjustments: [{ limitKey: GASTRONOMY_KEY, increase: 1 }]
};

const experiencePurchase = {
    id: 'purch_experience',
    addonSlug: 'extra-experiences-1',
    status: 'active',
    deletedAt: null,
    limitAdjustments: [{ limitKey: EXPERIENCE_KEY, increase: 1 }]
};

const ADDON_BY_SLUG: Record<string, { affectsLimitKey: string; limitIncrease: number }> = {
    'extra-accommodations-5': { affectsLimitKey: ACCOMMODATION_KEY, limitIncrease: 5 },
    'extra-gastronomies-1': { affectsLimitKey: GASTRONOMY_KEY, limitIncrease: 1 },
    'extra-experiences-1': { affectsLimitKey: EXPERIENCE_KEY, limitIncrease: 1 }
};

/** Plan limits keyed by slug — deliberately per-vertical, exactly like the catalogue. */
const PLAN_LIMITS_BY_SLUG: Record<string, Record<string, number>> = {
    [ACCOMMODATION_PLAN_FROM]: { [ACCOMMODATION_KEY]: 10 },
    [ACCOMMODATION_PLAN_TO]: { [ACCOMMODATION_KEY]: 3 },
    [GASTRONOMY_PLAN_FROM]: { [GASTRONOMY_KEY]: 1 },
    [GASTRONOMY_PLAN_TO]: { [GASTRONOMY_KEY]: 5 },
    [EXPERIENCE_PLAN_TO]: { [EXPERIENCE_KEY]: 5 }
};

function buildBilling(): QZPayBilling {
    return {
        limits: { set: vi.fn().mockResolvedValue(undefined) }
    } as unknown as QZPayBilling;
}

/** Every `limitKey` handed to `billing.limits.set`, in call order. */
function writtenKeys(billing: QZPayBilling): string[] {
    return (
        billing.limits.set as unknown as { mock: { calls: [{ limitKey: string }][] } }
    ).mock.calls.map(([arg]) => arg.limitKey);
}

/** The `maxValue` written for one key, or `undefined` when it was never written. */
function writtenValue(billing: QZPayBilling, limitKey: string): number | undefined {
    return (
        billing.limits.set as unknown as {
            mock: { calls: [{ limitKey: string; maxValue: number }][] };
        }
    ).mock.calls.find(([arg]) => arg.limitKey === limitKey)?.[0].maxValue;
}

// ─── Dedup bypass ─────────────────────────────────────────────────────────────
// The service keeps a process-local `recentRecalculations` Map with a 5-minute
// window, shared across every test in this file.

let dateNowOffset = 0;

beforeEach(() => {
    vi.clearAllMocks();
    dateNowOffset += 10 * 60 * 1000;
    vi.spyOn(Date, 'now').mockReturnValue(Date.now() + dateNowOffset);

    mockTxLimit.mockReset().mockResolvedValue([]);
    mockTxInsertValues.mockReset().mockResolvedValue(undefined);
    mockDbWhere.mockReset().mockResolvedValue([]);

    mockCatalogGetBySlug.mockImplementation(async (slug: string) => {
        const addon = ADDON_BY_SLUG[slug];
        return addon ? { success: true, data: addon } : { success: false };
    });

    mockPlanGetById.mockImplementation(async (slug: string) => {
        const limits = PLAN_LIMITS_BY_SLUG[slug];
        return limits
            ? { success: true, data: { id: `${slug}-uuid`, slug, name: slug, limits } }
            : { success: false };
    });
});

afterEach(() => {
    vi.restoreAllMocks();
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('handlePlanChangeAddonRecalculation — domain isolation (HOS-1279)', () => {
    it('an ACCOMMODATION plan change leaves the dual owner’s gastronomy cap alone', async () => {
        // THE REGRESSION. Reverting the filter makes this fail on the first
        // assertion: `limits.set` is called twice, and the second call writes
        // `max_gastronomies = 0 + 1 = 1` — stomping a cap the owner pays 5 for.
        mockDbWhere.mockResolvedValue([accommodationPurchase, gastronomyPurchase]);
        const billing = buildBilling();

        const result = await handlePlanChangeAddonRecalculation({
            customerId: 'cus_dual_owner_accommodation_change',
            oldPlanId: ACCOMMODATION_PLAN_FROM,
            newPlanId: ACCOMMODATION_PLAN_TO,
            billing,
            db: {} as never
        });

        expect(writtenKeys(billing)).toEqual([ACCOMMODATION_KEY]);
        expect(writtenValue(billing, GASTRONOMY_KEY)).toBeUndefined();
        // The accommodation cap itself still recalculates normally: base 3 + 5.
        expect(writtenValue(billing, ACCOMMODATION_KEY)).toBe(8);
        // The excluded cap is REPORTED, not silently dropped.
        expect(result.recalculations.find((r) => r.limitKey === GASTRONOMY_KEY)).toMatchObject({
            outcome: 'skipped'
        });
    });

    it('a GASTRONOMY plan change leaves the same owner’s accommodation cap alone', async () => {
        // The mirror image, reached through the commerce change-plan route.
        mockDbWhere.mockResolvedValue([accommodationPurchase, gastronomyPurchase]);
        const billing = buildBilling();

        const result = await handlePlanChangeAddonRecalculation({
            customerId: 'cus_dual_owner_gastronomy_change',
            oldPlanId: GASTRONOMY_PLAN_FROM,
            newPlanId: GASTRONOMY_PLAN_TO,
            billing,
            db: {} as never
        });

        expect(writtenKeys(billing)).toEqual([GASTRONOMY_KEY]);
        expect(writtenValue(billing, ACCOMMODATION_KEY)).toBeUndefined();
        expect(writtenValue(billing, GASTRONOMY_KEY)).toBe(6);
        expect(result.recalculations.find((r) => r.limitKey === ACCOMMODATION_KEY)).toMatchObject({
            outcome: 'skipped'
        });
    });

    it('an EXPERIENCE plan change touches neither of the other two verticals', async () => {
        // The third vertical, and the case that separates "commerce vs
        // accommodation" from "one domain per vertical": a predicate that only
        // told commerce from accommodation would still let this change rewrite
        // `max_gastronomies`.
        mockDbWhere.mockResolvedValue([
            accommodationPurchase,
            gastronomyPurchase,
            experiencePurchase
        ]);
        const billing = buildBilling();

        await handlePlanChangeAddonRecalculation({
            customerId: 'cus_triple_owner_experience_change',
            oldPlanId: EXPERIENCE_PLAN_TO,
            newPlanId: EXPERIENCE_PLAN_TO,
            billing,
            db: {} as never
        });

        expect(writtenKeys(billing)).toEqual([EXPERIENCE_KEY]);
        expect(writtenValue(billing, EXPERIENCE_KEY)).toBe(6);
    });

    it('still recalculates normally for a single-vertical owner — the filter is not a blanket refusal', async () => {
        // Non-vacuity for the three tests above: they would also pass if the
        // filter simply refused everything. This is the control that says the
        // owned path is untouched.
        mockDbWhere.mockResolvedValue([accommodationPurchase]);
        const billing = buildBilling();

        await handlePlanChangeAddonRecalculation({
            customerId: 'cus_host_only',
            oldPlanId: ACCOMMODATION_PLAN_FROM,
            newPlanId: ACCOMMODATION_PLAN_TO,
            billing,
            db: {} as never
        });

        expect(writtenKeys(billing)).toEqual([ACCOMMODATION_KEY]);
        expect(writtenValue(billing, ACCOMMODATION_KEY)).toBe(8);
    });

    it('writes nothing at all when every active add-on belongs to another vertical', async () => {
        // A commerce-only owner is not a host: there is no accommodation
        // subscription to recalculate against, and the correct number of
        // `limits.set` calls is zero rather than one wrong one.
        mockDbWhere.mockResolvedValue([gastronomyPurchase]);
        const billing = buildBilling();

        const result = await handlePlanChangeAddonRecalculation({
            customerId: 'cus_commerce_only_owner',
            oldPlanId: ACCOMMODATION_PLAN_FROM,
            newPlanId: ACCOMMODATION_PLAN_TO,
            billing,
            db: {} as never
        });

        expect(billing.limits.set).not.toHaveBeenCalled();
        expect(result.recalculations).toEqual([
            expect.objectContaining({ limitKey: GASTRONOMY_KEY, outcome: 'skipped' })
        ]);
    });

    it('fails CLOSED on an add-on whose limit key is in no domain, instead of writing it', async () => {
        // A `billing_addons.affects_limit_key` row that matches nothing. The
        // deleted `?? ACCOMMODATION` answered this with a confident
        // 'accommodation' and wrote a cap off a plan that never declared the
        // key; the answer now is a reported refusal.
        const strayPurchase = {
            id: 'purch_stray',
            addonSlug: 'extra-typos-1',
            status: 'active',
            deletedAt: null,
            limitAdjustments: [{ limitKey: 'max_gastronomys', increase: 1 }]
        };
        ADDON_BY_SLUG['extra-typos-1'] = {
            affectsLimitKey: 'max_gastronomys',
            limitIncrease: 1
        };
        mockDbWhere.mockResolvedValue([accommodationPurchase, strayPurchase]);
        const billing = buildBilling();

        const result = await handlePlanChangeAddonRecalculation({
            customerId: 'cus_stray_limit_key',
            oldPlanId: ACCOMMODATION_PLAN_FROM,
            newPlanId: ACCOMMODATION_PLAN_TO,
            billing,
            db: {} as never
        });

        delete ADDON_BY_SLUG['extra-typos-1'];

        expect(writtenKeys(billing)).toEqual([ACCOMMODATION_KEY]);
        expect(result.recalculations.find((r) => r.limitKey === 'max_gastronomys')).toMatchObject({
            outcome: 'failed'
        });
    });

    it('reports one entry per KEY even when several add-ons raise the same foreign cap', async () => {
        // Two purchases, one excluded key. Grouping by key is what every other
        // outcome in `recalculations` does, and a per-purchase entry would make
        // the summary counts disagree with the rest of the list.
        const secondGastronomyPurchase = {
            ...gastronomyPurchase,
            id: 'purch_gastronomy_2'
        };
        mockDbWhere.mockResolvedValue([gastronomyPurchase, secondGastronomyPurchase]);
        const billing = buildBilling();

        const result = await handlePlanChangeAddonRecalculation({
            customerId: 'cus_two_gastronomy_addons',
            oldPlanId: ACCOMMODATION_PLAN_FROM,
            newPlanId: ACCOMMODATION_PLAN_TO,
            billing,
            db: {} as never
        });

        expect(result.recalculations.filter((r) => r.limitKey === GASTRONOMY_KEY)).toHaveLength(1);
    });
});
