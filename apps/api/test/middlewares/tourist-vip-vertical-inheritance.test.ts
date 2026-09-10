/**
 * @file tourist-vip-vertical-inheritance.test.ts
 * @description HOS-1323 — the tourist-VIP gift, exercised through the ENGINE.
 *
 * Owner decision (2026-09-10): accommodation, gastronomy and experience inherit
 * every entitlement and limit of a tourist-VIP without subscribing to one.
 * Partners do not. The inheritance goes **by reference to the tourist-VIP plan**,
 * so a key added to that plan must reach all three verticals with no second edit.
 *
 * ## Why these assertions iterate `TOURIST_VIP_PLAN` instead of listing keys
 *
 * The acceptance criterion is not "gastronomy holds `price_alerts`" — it is
 * "whatever tourist-VIP holds, the three verticals hold". A test spelling out
 * today's fifteen keys would pass forever while the sixteenth silently reached
 * nobody. Iterating the plan is what makes ADDING a key to
 * `TOURIST_VIP_ENTITLEMENTS` (or to the tourist-VIP row) extend this suite by
 * itself.
 *
 * ## Why it drives the middleware and not the config
 *
 * `plans.config.ts` has spread `TOURIST_VIP_ENTITLEMENTS` into all twelve plan
 * definitions since HOS-975, so a config-level assertion passed throughout the
 * entire life of this bug. What was broken was DELIVERY. Every case below goes
 * through `entitlementMiddleware()` (or the commerce middleware) and reads what
 * a route handler would actually see.
 */

import {
    EntitlementKey,
    EXPERIENCE_BASICO_PLAN,
    GASTRONOMY_BASICO_PLAN,
    type LimitKey,
    OWNER_BASICO_PLAN,
    type PlanDefinition,
    TOURIST_FREE_PLAN,
    TOURIST_VIP_PLAN
} from '@repo/billing';
import { getDb } from '@repo/db';
import { PlanService } from '@repo/service-core';
import { Hono } from 'hono';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getQZPayBilling } from '../../src/middlewares/billing';
import {
    _resetCommerceBaseLimitCache,
    commerceVerticalEntitlementMiddleware
} from '../../src/middlewares/commerce-entitlement';
import {
    clearEntitlementCache,
    entitlementMiddleware,
    requireEntitlement
} from '../../src/middlewares/entitlement';
import { createErrorHandler } from '../../src/middlewares/response';
import { clearTouristVipGiftCache } from '../../src/services/billing/tourist-vip-inheritance';
import type { AppBindings } from '../../src/types';

vi.mock('../../src/middlewares/billing', () => ({
    getQZPayBilling: vi.fn()
}));

vi.mock('../../src/utils/logger', () => ({
    apiLogger: {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn()
    }
}));

const CUSTOMER_ID = 'cus-hos-1323';

/** A subscription row as `getByCustomerId` yields it: no `productDomain`. */
type SubFixture = { id: string; planId: string; status: string };

/**
 * The shape the billing SDK is mocked into. `plans.get` is keyed by plan id so
 * a dual-owner case can answer two different plans in one request.
 */
type MockBilling = {
    subscriptions: { getByCustomerId: ReturnType<typeof vi.fn> };
    plans: { get: ReturnType<typeof vi.fn> };
    entitlements: { getByCustomerId: ReturnType<typeof vi.fn> };
    limits: { getByCustomerId: ReturnType<typeof vi.fn> };
};

let mockBilling: MockBilling;

/**
 * Turns a real `PlanDefinition` into the row shape `billing.plans.get` returns.
 *
 * The REAL definition, never a hand-written stub: a stub would have to restate
 * the fifteen keys, which is the copy this whole issue is about. Passing the
 * catalogue's own object is what makes "the plan declares it" true in the test
 * for the same reason it is true in production.
 */
function planRow(plan: PlanDefinition): {
    id: string;
    name: string;
    entitlements: string[];
    limits: Record<string, number>;
} {
    return {
        id: `plan-${plan.slug}`,
        name: plan.slug,
        entitlements: [...plan.entitlements],
        limits: Object.fromEntries(plan.limits.map((l) => [l.key, l.value]))
    };
}

/**
 * Hydration answer for `hydrateSubscriptionProductDomains`, which recovers
 * `productDomain` with one `getDb()` SELECT (HOS-934/HOS-1104).
 *
 * `mockReturnValue`, not `...Once`: the loader hydrates, and
 * `selectAccommodationSubscription` hydrates again (short-circuiting only for
 * rows already carrying a domain — which, on this un-hydrated fixture shape,
 * they do not until the first call resolves).
 */
function hydrateAs(rows: readonly { id: string; productDomain: string }[]): void {
    vi.mocked(getDb).mockReturnValue({
        select: vi.fn().mockReturnValue({
            from: vi.fn().mockReturnValue({
                where: vi.fn().mockResolvedValue([...rows])
            })
        })
    } as never);
}

/** Mounts the global middleware and returns what a route handler would see. */
async function loadThroughMiddleware(): Promise<{
    entitlements: string[];
    limits: Record<string, number>;
}> {
    const app = new Hono<AppBindings>();
    app.use((c, next) => {
        c.set('billingEnabled', true);
        c.set('billingCustomerId', CUSTOMER_ID);
        return next();
    });
    app.use(entitlementMiddleware());
    app.get('/test', (c) =>
        c.json({
            entitlements: Array.from(c.get('userEntitlements')),
            limits: Object.fromEntries(c.get('userLimits'))
        })
    );

    const res = await app.request('/test');
    return (await res.json()) as { entitlements: string[]; limits: Record<string, number> };
}

/** The gift as the catalogue declares it, as plain data for the assertions. */
const VIP_ENTITLEMENTS: readonly EntitlementKey[] = TOURIST_VIP_PLAN.entitlements;
const VIP_LIMITS: readonly (readonly [LimitKey, number])[] = TOURIST_VIP_PLAN.limits.map(
    (l) => [l.key, l.value] as const
);

beforeEach(() => {
    mockBilling = {
        subscriptions: { getByCustomerId: vi.fn() },
        plans: { get: vi.fn() },
        entitlements: { getByCustomerId: vi.fn().mockResolvedValue([]) },
        limits: { getByCustomerId: vi.fn().mockResolvedValue([]) }
    };
    vi.mocked(getQZPayBilling).mockReturnValue(
        mockBilling as unknown as ReturnType<typeof getQZPayBilling>
    );
    clearEntitlementCache(CUSTOMER_ID);
    clearTouristVipGiftCache();
    _resetCommerceBaseLimitCache();
});

afterEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
});

/**
 * The three verticals, each with the REAL plan a subscriber of that vertical
 * holds. Accommodation is in the table on purpose: the owner named all three,
 * and it already worked — proving it still does is what stops a fix for the
 * other two from inverting it.
 */
const VERTICALS: readonly {
    name: string;
    productDomain: string;
    plan: PlanDefinition;
}[] = [
    { name: 'gastronomy', productDomain: 'gastronomy', plan: GASTRONOMY_BASICO_PLAN },
    { name: 'experience', productDomain: 'experience', plan: EXPERIENCE_BASICO_PLAN },
    { name: 'accommodation', productDomain: 'accommodation', plan: OWNER_BASICO_PLAN }
];

describe('HOS-1323 — the three verticals inherit the tourist-VIP grant', () => {
    for (const vertical of VERTICALS) {
        describe(`${vertical.name}`, () => {
            beforeEach(() => {
                const sub: SubFixture = {
                    id: `sub-${vertical.name}`,
                    planId: `plan-${vertical.plan.slug}`,
                    status: 'active'
                };
                mockBilling.subscriptions.getByCustomerId.mockResolvedValue([sub]);
                hydrateAs([{ id: sub.id, productDomain: vertical.productDomain }]);
                mockBilling.plans.get.mockResolvedValue(planRow(vertical.plan));
            });

            it.each(
                VIP_ENTITLEMENTS.map((key) => [key] as const)
            )('delivers the tourist-VIP entitlement %s', async (key) => {
                const { entitlements } = await loadThroughMiddleware();
                expect(entitlements).toContain(key);
            });

            it.each(
                VIP_LIMITS.map(([key, value]) => [key, value] as const)
            )('delivers the tourist-VIP limit %s at least as generously as %d', async (key, giftValue) => {
                const { limits } = await loadThroughMiddleware();
                const resolved = limits[key];

                expect(resolved).toBeDefined();
                if (giftValue === -1) {
                    // -1 is UNLIMITED. A finite number here is a DEMOTION,
                    // not a tighter cap, and every layer under
                    // `getRemainingLimit` would read it as the real ceiling.
                    expect(resolved).toBe(-1);
                } else if (resolved !== -1) {
                    expect(resolved).toBeGreaterThanOrEqual(giftValue);
                }
            });
        });
    }
});

describe('HOS-1323 — the witness case', () => {
    /**
     * The exact 403 the issue reports: a gastronomy owner holds
     * `GASTRONOMY_OWNER` and not `HOST`, so there is no `owner-basico` draft
     * fallback either. Their plan grants `PRICE_ALERTS`
     * (`plans.config.ts:765` spreads it), and
     * `price-alert/protected/create.ts` gates on it behind the GLOBAL
     * middleware — the commerce middleware is not mounted on a consumer route.
     */
    it('a gastronomy-only owner passes a PRICE_ALERTS gate (was 403)', async () => {
        mockBilling.subscriptions.getByCustomerId.mockResolvedValue([
            { id: 'sub-gastro', planId: 'plan-gastronomy-basico', status: 'active' }
        ]);
        hydrateAs([{ id: 'sub-gastro', productDomain: 'gastronomy' }]);
        mockBilling.plans.get.mockResolvedValue(planRow(GASTRONOMY_BASICO_PLAN));

        const app = new Hono<AppBindings>();
        app.onError(createErrorHandler());
        app.use((c, next) => {
            c.set('billingEnabled', true);
            c.set('billingCustomerId', CUSTOMER_ID);
            return next();
        });
        app.use(entitlementMiddleware());
        app.post('/alerts', requireEntitlement(EntitlementKey.PRICE_ALERTS), (c) =>
            c.json({ created: true })
        );

        const res = await app.request('/alerts', { method: 'POST' });

        expect(res.status).toBe(200);
    });
});

describe('HOS-1323 — who does NOT inherit', () => {
    /**
     * The precision the owner added to the decision: "los ALIADOS no lo
     * heredan". A partner pays for brand presence, not for a product listing.
     *
     * `vip_support` is decisive because it is in `TOURIST_VIP_ENTITLEMENTS` and
     * NOT in the tourist-free baseline, so its absence cannot be explained by
     * the fallback happening to grant it. Adding `partner` to the gifted domains
     * turns this case red, which is the mutation it exists to catch.
     *
     * **The plan row below is inert, and the assertion does not rest on it.** An
     * earlier version of this comment claimed the row carries a VIP key "so the
     * assertion cannot pass for the unrelated reason that the fixture grants
     * nothing" — that reasoning is wrong here: a `partner` subscription matches
     * neither branch of `selectAccommodationSubscription`, so `activeSubscription`
     * is `undefined`, the loader takes the no-subscription fallback, and
     * `billing.plans.get` is never called at all. The row is kept only so the
     * fixture reads like a real partner, and the `expect` below records that it
     * is never consulted.
     *
     * That is itself a finding worth leaving here: **a partner's plan
     * entitlements are resolved by no path in this loader.** They eat the
     * tourist-free baseline whatever their plan declares. Pre-existing, not
     * introduced here, and out of scope for HOS-1323 — but it means "partners do
     * not inherit the gift" is true today for a broader reason than the gift.
     */
    it('a partner subscription grants no tourist-VIP key', async () => {
        mockBilling.subscriptions.getByCustomerId.mockResolvedValue([
            { id: 'sub-partner', planId: 'plan-partner-gold', status: 'active' }
        ]);
        hydrateAs([{ id: 'sub-partner', productDomain: 'partner' }]);
        mockBilling.plans.get.mockResolvedValue({
            id: 'plan-partner-gold',
            name: 'partner-gold',
            entitlements: [EntitlementKey.VIP_SUPPORT],
            limits: {}
        });

        const { entitlements } = await loadThroughMiddleware();

        expect(entitlements).not.toContain(EntitlementKey.VIP_SUPPORT);
        // Documents the paragraph above rather than defending the assertion.
        expect(mockBilling.plans.get).not.toHaveBeenCalled();
    });

    /**
     * The other half of the same boundary. A tourist on the FREE tier is
     * precisely the person who must not receive the paid tier for nothing —
     * the gift is for owning a listing, not for holding an account.
     */
    /**
     * The gift is the tourist-VIP block and NOTHING else. A commerce plan's own
     * keys and caps stay where SPEC-239 put them — behind
     * `commerceVerticalEntitlementMiddleware`, on the vertical's own routes.
     *
     * This is the boundary the fix could most plausibly have overrun: reading
     * the commerce subscription's plan row wholesale into the global set would
     * have delivered the fifteen keys too, and passed every other test here.
     */
    it('a gastronomy subscription leaks no commerce key into the global set', async () => {
        mockBilling.subscriptions.getByCustomerId.mockResolvedValue([
            { id: 'sub-gastro', planId: 'plan-gastronomy-basico', status: 'active' }
        ]);
        hydrateAs([{ id: 'sub-gastro', productDomain: 'gastronomy' }]);
        mockBilling.plans.get.mockResolvedValue(planRow(GASTRONOMY_BASICO_PLAN));

        const { entitlements, limits } = await loadThroughMiddleware();

        expect(GASTRONOMY_BASICO_PLAN.entitlements).toContain(EntitlementKey.PUBLISH_GASTRONOMY);
        expect(entitlements).not.toContain(EntitlementKey.PUBLISH_GASTRONOMY);
        expect(entitlements).not.toContain(EntitlementKey.EDIT_GASTRONOMY_INFO);
        expect(limits.max_gastronomies).toBeUndefined();
    });

    it('a tourist-free subscriber gains nothing from the gift', async () => {
        mockBilling.subscriptions.getByCustomerId.mockResolvedValue([
            { id: 'sub-tourist', planId: 'plan-tourist-free', status: 'active' }
        ]);
        hydrateAs([{ id: 'sub-tourist', productDomain: 'tourist' }]);
        mockBilling.plans.get.mockResolvedValue(planRow(TOURIST_FREE_PLAN));

        const { entitlements } = await loadThroughMiddleware();

        expect(entitlements).not.toContain(EntitlementKey.VIP_SUPPORT);
        expect(entitlements).not.toContain(EntitlementKey.EXCLUSIVE_DEALS);
    });
});

describe('HOS-1323 — the dual owner', () => {
    /**
     * A host auto-promoted from tourist holds TWO subscriptions, and the repo
     * seeds `host-provider@local.test` because an account can wear two hats at
     * once. HOS-1233/HOS-1303 fixed the ambiguity by ORDERING the selection —
     * accommodation first — and the gift must not reintroduce it.
     *
     * So this asserts both halves: the ACCOMMODATION plan is still the one
     * resolved (its owner-side key arrives, the gastronomy plan's does not),
     * and the gift arrives regardless.
     */
    it('resolves the accommodation plan and still receives the gift', async () => {
        mockBilling.subscriptions.getByCustomerId.mockResolvedValue([
            // Gastronomy FIRST in row order, which is what used to decide the
            // winner when the match was an unordered OR.
            { id: 'sub-gastro', planId: 'plan-gastronomy-basico', status: 'active' },
            { id: 'sub-accom', planId: 'plan-owner-basico', status: 'active' }
        ]);
        hydrateAs([
            { id: 'sub-gastro', productDomain: 'gastronomy' },
            { id: 'sub-accom', productDomain: 'accommodation' }
        ]);
        mockBilling.plans.get.mockImplementation(async (planId: string) =>
            planId === 'plan-owner-basico'
                ? planRow(OWNER_BASICO_PLAN)
                : planRow(GASTRONOMY_BASICO_PLAN)
        );

        const { entitlements } = await loadThroughMiddleware();

        expect(entitlements).toContain(EntitlementKey.PUBLISH_ACCOMMODATIONS);
        expect(entitlements).not.toContain(EntitlementKey.PUBLISH_GASTRONOMY);
        for (const key of VIP_ENTITLEMENTS) {
            expect(entitlements).toContain(key);
        }
    });

    /**
     * The case that actually EXERCISES the gift on the plan-resolved path, and
     * the reason the test above cannot: `owner-basico`'s row carries the VIP
     * block itself, so its fifteen keys arrive whether or not the gift is
     * merged there — measured, by deleting the merge and watching the case above
     * stay green.
     *
     * A restaurant owner who is also an ordinary tourist is the shape that
     * separates them. `selectAccommodationSubscription` resolves their
     * tourist-FREE plan (accommodation absent, tourist is the ordered fallback),
     * the loader publishes that plan's three keys — and without the gift on this
     * path, the person paying for a gastronomy listing is served the free
     * baseline.
     */
    it('a gastronomy owner who is also a tourist-free subscriber still receives it', async () => {
        mockBilling.subscriptions.getByCustomerId.mockResolvedValue([
            { id: 'sub-gastro', planId: 'plan-gastronomy-basico', status: 'active' },
            { id: 'sub-tourist', planId: 'plan-tourist-free', status: 'active' }
        ]);
        hydrateAs([
            { id: 'sub-gastro', productDomain: 'gastronomy' },
            { id: 'sub-tourist', productDomain: 'tourist' }
        ]);
        mockBilling.plans.get.mockImplementation(async (planId: string) =>
            planId === 'plan-tourist-free'
                ? planRow(TOURIST_FREE_PLAN)
                : planRow(GASTRONOMY_BASICO_PLAN)
        );

        // The resolved plan is the one that does NOT carry the block, so every
        // key below can only have arrived as the gift.
        expect(TOURIST_FREE_PLAN.entitlements).not.toContain(EntitlementKey.VIP_SUPPORT);

        const { entitlements, limits } = await loadThroughMiddleware();

        for (const key of VIP_ENTITLEMENTS) {
            expect(entitlements).toContain(key);
        }
        for (const [key, value] of VIP_LIMITS) {
            expect(limits[key]).toBe(value);
        }
    });
});

/**
 * Stubs `PlanService.getBySlug` so the `tourist-vip` row differs from the code
 * constant, and answers NOT_FOUND for every other slug.
 *
 * The row is built by mutating a copy of the catalogue's own — never typed out —
 * so it stays a real tourist-VIP row with one deliberate difference.
 */
function stubTouristVipRow(patch: {
    entitlements?: string[];
    limits?: Record<string, number>;
}): void {
    const vipRow = planRow(TOURIST_VIP_PLAN);
    vi.spyOn(PlanService.prototype, 'getBySlug').mockImplementation(async (slug: string) => {
        if (slug !== TOURIST_VIP_PLAN.slug) {
            return {
                success: false,
                error: { code: 'NOT_FOUND', message: `Plan not found: ${slug}` }
            } as never;
        }
        return {
            success: true,
            data: {
                ...vipRow,
                slug: TOURIST_VIP_PLAN.slug,
                entitlements: patch.entitlements ?? vipRow.entitlements,
                limits: { ...vipRow.limits, ...(patch.limits ?? {}) }
            }
        } as never;
    });
}

describe('HOS-1323 — by REFERENCE, not by copy', () => {
    /**
     * The criterion that decides between two implementations which look
     * equivalent today, exercised on the half the owner named FIRST — *"si
     * mañana le cambiamos un límite"*.
     *
     * A plan is changed in this repo through TWO doors: `plans.config.ts` (the
     * constants every definition spreads) and `PUT /api/v1/admin/billing/
     * plans/{id}`, which writes `entitlements` / `limits` straight onto the
     * `billing_plans` row with no deploy (`routes/billing/admin/plans.ts:243`).
     * A limit is a `'commercial'` field: the row is authoritative for its VALUE.
     *
     * **This is the case that covers the row-reading LOOP.** Until it existed,
     * every `getBySlug` stub in this file returned limits identical to the
     * constant, so deleting the limits loop from `resolveTouristVipGift` left
     * all 76 cases green — measured. An implementation that returned the
     * constant and never read the row passed everything.
     */
    it('a limit RAISED on the tourist-VIP row reaches a gastronomy owner', async () => {
        const configured = TOURIST_VIP_PLAN.limits.find((l) => l.key === 'max_collections');
        expect(configured?.value).toBeGreaterThan(0);
        const raised = (configured?.value ?? 0) + 900;

        stubTouristVipRow({ limits: { max_collections: raised } });

        // The gastronomy plan row carries the CONSTANT's value, so the raised
        // one can only have come from the tourist-VIP row.
        expect(planRow(GASTRONOMY_BASICO_PLAN).limits.max_collections).toBe(configured?.value);

        mockBilling.subscriptions.getByCustomerId.mockResolvedValue([
            { id: 'sub-gastro', planId: 'plan-gastronomy-basico', status: 'active' }
        ]);
        hydrateAs([{ id: 'sub-gastro', productDomain: 'gastronomy' }]);
        mockBilling.plans.get.mockResolvedValue(planRow(GASTRONOMY_BASICO_PLAN));

        const { limits } = await loadThroughMiddleware();

        expect(limits.max_collections).toBe(raised);
    });

    /**
     * The same read, on the commerce middleware's own path. It resolves the gift
     * independently of the global loader (its wholesale replace drops whatever
     * the loader published), so the row-reading loop has to be covered on both.
     */
    it('a limit RAISED on the tourist-VIP row reaches a gastronomy ROUTE', async () => {
        const configured = TOURIST_VIP_PLAN.limits.find((l) => l.key === 'max_collections');
        const raised = (configured?.value ?? 0) + 900;

        const gastroRow = planRow(GASTRONOMY_BASICO_PLAN);
        const vipRow = planRow(TOURIST_VIP_PLAN);
        vi.spyOn(PlanService.prototype, 'getBySlug').mockImplementation(async (slug: string) => {
            if (slug === TOURIST_VIP_PLAN.slug) {
                return {
                    success: true,
                    data: { ...vipRow, limits: { ...vipRow.limits, max_collections: raised } }
                } as never;
            }
            return { success: true, data: gastroRow } as never;
        });

        mockBilling.subscriptions.getByCustomerId.mockResolvedValue([
            { id: 'sub-gastro', planId: 'plan-gastronomy-basico', status: 'active' }
        ]);
        hydrateAs([{ id: 'sub-gastro', productDomain: 'gastronomy' }]);
        mockBilling.plans.get.mockResolvedValue(gastroRow);

        const app = new Hono<AppBindings>();
        app.use((c, next) => {
            c.set('billingEnabled', true);
            c.set('billingCustomerId', CUSTOMER_ID);
            return next();
        });
        app.use(entitlementMiddleware());
        app.get('/gastro', commerceVerticalEntitlementMiddleware('gastronomy'), (c) =>
            c.json({ limits: Object.fromEntries(c.get('userLimits')) })
        );

        const res = await app.request('/gastro');
        const { limits } = (await res.json()) as { limits: Record<string, number> };

        expect(limits.max_collections).toBe(raised);
    });
});

describe('HOS-1323 — the row supplies VALUES, never new KEYS', () => {
    /**
     * The blast radius this file's change created, and the allowlist that closes
     * it.
     *
     * Before HOS-1323, editing the `tourist-vip` row moved tourist-VIP
     * subscribers and nobody else. After it, that row is read on behalf of every
     * gifted vertical — so an unfiltered gift would let one admin edit, made
     * with no deploy and no review, hand out another vertical's entitlements and
     * caps.
     *
     * `max_gastronomies` is the decisive one and not a hypothetical: the
     * commerce middleware merges the gift BEFORE `resolveCommerceVerticalCap`
     * reads `limits.get('max_gastronomies')`, so an unfiltered `50` on the
     * tourist-vip row would let every `gastronomy-basico` owner — paying for ONE
     * listing — publish fifty. Silently: an oversized cap raises nothing.
     */
    it('refuses a foreign LIMIT on the tourist-VIP row (the vertical cap holds)', async () => {
        const cap = GASTRONOMY_BASICO_PLAN.limits.find((l) => l.key === 'max_gastronomies');
        expect(cap?.value).toBe(1);

        stubTouristVipRow({ limits: { max_gastronomies: 50 } });

        mockBilling.subscriptions.getByCustomerId.mockResolvedValue([
            { id: 'sub-gastro', planId: 'plan-gastronomy-basico', status: 'active' }
        ]);
        hydrateAs([{ id: 'sub-gastro', productDomain: 'gastronomy' }]);
        mockBilling.plans.get.mockResolvedValue(planRow(GASTRONOMY_BASICO_PLAN));

        const app = new Hono<AppBindings>();
        app.use((c, next) => {
            c.set('billingEnabled', true);
            c.set('billingCustomerId', CUSTOMER_ID);
            return next();
        });
        app.use(entitlementMiddleware());
        app.get('/gastro', commerceVerticalEntitlementMiddleware('gastronomy'), (c) =>
            c.json({ limits: Object.fromEntries(c.get('userLimits')) })
        );

        const res = await app.request('/gastro');
        const { limits } = (await res.json()) as { limits: Record<string, number> };

        expect(limits.max_gastronomies).toBe(1);
    });

    /**
     * The entitlement half of the same boundary: an owner-side key on the
     * tourist-VIP row must not reach the GLOBAL set of a gastronomy owner who
     * holds no accommodation subscription at all.
     */
    it('refuses a foreign ENTITLEMENT on the tourist-VIP row', async () => {
        const vipRow = planRow(TOURIST_VIP_PLAN);
        expect(vipRow.entitlements).not.toContain(EntitlementKey.PUBLISH_ACCOMMODATIONS);

        stubTouristVipRow({
            entitlements: [...vipRow.entitlements, EntitlementKey.PUBLISH_ACCOMMODATIONS]
        });

        mockBilling.subscriptions.getByCustomerId.mockResolvedValue([
            { id: 'sub-gastro', planId: 'plan-gastronomy-basico', status: 'active' }
        ]);
        hydrateAs([{ id: 'sub-gastro', productDomain: 'gastronomy' }]);
        mockBilling.plans.get.mockResolvedValue(planRow(GASTRONOMY_BASICO_PLAN));

        const { entitlements } = await loadThroughMiddleware();

        expect(entitlements).not.toContain(EntitlementKey.PUBLISH_ACCOMMODATIONS);
        // The gift itself still arrives — the allowlist refuses the foreign key,
        // it does not refuse the row.
        expect(entitlements).toContain(EntitlementKey.PRICE_ALERTS);
    });
});

describe('HOS-1323 — the gift owns the tourist axis and replaces on it', () => {
    /**
     * The gift's keys and a vertical's own keys are DISJOINT — frozen by
     * `packages/billing/test/tourist-vip-axis-disjointness.test.ts` — so a
     * wholesale replacement on the gift's keys cannot reach a vertical's cap.
     *
     * This is the property that made `Math.max` unnecessary: there is never a
     * second value for the same thing arriving from a different product.
     */
    it('replacing on the tourist axis leaves the vertical cap untouched', async () => {
        const cap = GASTRONOMY_BASICO_PLAN.limits.find((l) => l.key === 'max_gastronomies');
        expect(cap?.value).toBe(1);

        mockBilling.subscriptions.getByCustomerId.mockResolvedValue([
            { id: 'sub-gastro', planId: 'plan-gastronomy-basico', status: 'active' }
        ]);
        hydrateAs([{ id: 'sub-gastro', productDomain: 'gastronomy' }]);
        mockBilling.plans.get.mockResolvedValue(planRow(GASTRONOMY_BASICO_PLAN));

        const app = new Hono<AppBindings>();
        app.use((c, next) => {
            c.set('billingEnabled', true);
            c.set('billingCustomerId', CUSTOMER_ID);
            return next();
        });
        app.use(entitlementMiddleware());
        app.get('/gastro', commerceVerticalEntitlementMiddleware('gastronomy'), (c) =>
            c.json({ limits: Object.fromEntries(c.get('userLimits')) })
        );

        const res = await app.request('/gastro');
        const { limits } = (await res.json()) as { limits: Record<string, number> };

        expect(limits.max_gastronomies).toBe(1);
        // …and the tourist axis arrived alongside it, not instead of it.
        for (const [key, value] of VIP_LIMITS) {
            expect(limits[key]).toBe(value);
        }
    });

    /**
     * **THE ABSURD CASE — the reason `Math.max` had to go.**
     *
     * The one real collision in the catalogue is `tourist-free` vs
     * `tourist-vip`: two tiers of the SAME product, which of course share keys.
     * A commerce-only owner lands on the free tier's defaults, so on those three
     * keys the gift meets a value.
     *
     * `Math.max` picked the larger. That agreed with the tier ordering only
     * because the VIP is more generous in all three today (`-1 > 5`,
     * `200 > 10`, `200 > 10`). Lower a VIP key — for abuse, for cost — and MAX
     * returns the FREE number, leaving a gastronomy owner holding **more than a
     * tourist who pays for VIP**.
     *
     * Replacement gets it right for the reason the tiers exist: the paid tier
     * supersedes the free one on its own axis.
     */
    it('a VIP key lowered BELOW tourist-free still wins — the paid tier supersedes', async () => {
        const free = TOURIST_FREE_PLAN.limits.find((l) => l.key === 'max_favorites');
        const vip = TOURIST_VIP_PLAN.limits.find((l) => l.key === 'max_favorites');
        // The premise of the absurdity: free meters this key, and the shipped
        // VIP is the more generous of the two.
        expect(free?.value).toBe(5);
        expect(vip?.value).toBe(-1);

        // The owner lowers the VIP tier to below the free tier.
        stubTouristVipRow({ limits: { max_favorites: 2 } });

        mockBilling.subscriptions.getByCustomerId.mockResolvedValue([
            { id: 'sub-gastro', planId: 'plan-gastronomy-basico', status: 'active' }
        ]);
        hydrateAs([{ id: 'sub-gastro', productDomain: 'gastronomy' }]);
        mockBilling.plans.get.mockResolvedValue(null);

        const { limits } = await loadThroughMiddleware();

        // `Math.max(5, 2)` would answer 5 — the FREE value — and hand this owner
        // more than a paying tourist-VIP, who holds 2.
        expect(limits.max_favorites).toBe(2);
    });

    /**
     * The same lowering, seen from the commerce middleware, which resolves the
     * gift independently of the global loader.
     */
    it('the same lowered key wins on a gastronomy ROUTE', async () => {
        const gastroRow = planRow(GASTRONOMY_BASICO_PLAN);
        const vipRow = planRow(TOURIST_VIP_PLAN);
        vi.spyOn(PlanService.prototype, 'getBySlug').mockImplementation(async (slug: string) => {
            if (slug === TOURIST_VIP_PLAN.slug) {
                return {
                    success: true,
                    data: { ...vipRow, limits: { ...vipRow.limits, max_favorites: 2 } }
                } as never;
            }
            return { success: true, data: gastroRow } as never;
        });

        mockBilling.subscriptions.getByCustomerId.mockResolvedValue([
            { id: 'sub-gastro', planId: 'plan-gastronomy-basico', status: 'active' }
        ]);
        hydrateAs([{ id: 'sub-gastro', productDomain: 'gastronomy' }]);
        mockBilling.plans.get.mockResolvedValue(gastroRow);

        const app = new Hono<AppBindings>();
        app.use((c, next) => {
            c.set('billingEnabled', true);
            c.set('billingCustomerId', CUSTOMER_ID);
            return next();
        });
        app.use(entitlementMiddleware());
        app.get('/gastro', commerceVerticalEntitlementMiddleware('gastronomy'), (c) =>
            c.json({ limits: Object.fromEntries(c.get('userLimits')) })
        );

        const res = await app.request('/gastro');
        const { limits } = (await res.json()) as { limits: Record<string, number> };

        expect(limits.max_favorites).toBe(2);
    });

    /**
     * The upgrade direction, which is the ordinary one: a commerce-only owner
     * lands on tourist-FREE and must come out holding the VIP tier's numbers on
     * every one of the seven, including the three the free tier meters lower.
     */
    it('a commerce-only owner holds the VIP tier, not the free one', async () => {
        mockBilling.subscriptions.getByCustomerId.mockResolvedValue([
            { id: 'sub-gastro', planId: 'plan-gastronomy-basico', status: 'active' }
        ]);
        hydrateAs([{ id: 'sub-gastro', productDomain: 'gastronomy' }]);
        mockBilling.plans.get.mockResolvedValue(null);

        const { limits } = await loadThroughMiddleware();

        for (const [key, value] of VIP_LIMITS) {
            expect(limits[key]).toBe(value);
        }
        // Decisive on the shared keys: the free tier's numbers are gone.
        for (const freeLimit of TOURIST_FREE_PLAN.limits) {
            const vipValue = TOURIST_VIP_PLAN.limits.find((l) => l.key === freeLimit.key)?.value;
            expect(limits[freeLimit.key]).toBe(vipValue);
            expect(limits[freeLimit.key]).not.toBe(freeLimit.value);
        }
    });
});

/**
 * A gastronomy plan row that predates HOS-975's VIP block — its own vertical
 * pair and its own caps, and none of the fifteen. The shape every already-seeded
 * environment carries until its data-migration lands.
 */
function laggingGastronomyRow(): ReturnType<typeof planRow> {
    const row = planRow(GASTRONOMY_BASICO_PLAN);
    const vipKeys = new Set<string>(VIP_ENTITLEMENTS);
    const vipLimitKeys = new Set<string>(VIP_LIMITS.map(([key]) => key));
    return {
        ...row,
        entitlements: row.entitlements.filter((key) => !vipKeys.has(key)),
        limits: Object.fromEntries(
            Object.entries(row.limits).filter(([key]) => !vipLimitKeys.has(key))
        )
    };
}

describe('HOS-1323 — the commerce middleware republishes the gift', () => {
    /**
     * `commerceVerticalEntitlementMiddleware` REPLACES `userEntitlements`
     * wholesale (the SPEC-239 isolation), so whatever the global loader
     * published — the gift included — is dropped for the rest of a commerce
     * request. It has to put the gift back, or the invariant would hold on
     * every route except the vertical's own.
     *
     * **The plan row here is a LAGGING one, and that is the whole test.** A
     * fixture using the catalogue's own gastronomy row proves nothing: that row
     * carries the fifteen keys itself (`plans.config.ts:765`), and the
     * pre-existing `plan?.entitlements` union a few lines above would admit
     * them with or without the gift — measured, by mutating the gift call away
     * and watching this case stay green.
     *
     * A lagging row is not hypothetical either: `ensureCommercePlan` INSERTs
     * only, so every already-seeded environment carries the older shape until
     * its data-migration runs, and `PUT /admin/billing/plans/{id}` can leave one
     * behind at any time. Only a runtime read of the tourist-VIP plan can serve
     * that owner.
     */
    it('a gastronomy route sees every tourist-VIP key even from a LAGGING plan row', async () => {
        vi.spyOn(PlanService.prototype, 'getBySlug').mockImplementation(async (slug: string) => {
            if (slug === TOURIST_VIP_PLAN.slug) {
                return { success: true, data: planRow(TOURIST_VIP_PLAN) } as never;
            }
            return { success: true, data: laggingGastronomyRow() } as never;
        });

        mockBilling.subscriptions.getByCustomerId.mockResolvedValue([
            { id: 'sub-gastro', planId: 'plan-gastronomy-basico', status: 'active' }
        ]);
        hydrateAs([{ id: 'sub-gastro', productDomain: 'gastronomy' }]);
        mockBilling.plans.get.mockResolvedValue(laggingGastronomyRow());

        const app = new Hono<AppBindings>();
        app.use((c, next) => {
            c.set('billingEnabled', true);
            c.set('billingCustomerId', CUSTOMER_ID);
            return next();
        });
        app.use(entitlementMiddleware());
        app.get('/gastro', commerceVerticalEntitlementMiddleware('gastronomy'), (c) =>
            c.json({ entitlements: Array.from(c.get('userEntitlements')) })
        );

        const res = await app.request('/gastro');
        const { entitlements } = (await res.json()) as { entitlements: string[] };

        // The vertical's own pair survives — this middleware's whole job.
        expect(entitlements).toContain(EntitlementKey.PUBLISH_GASTRONOMY);
        // …and so does the gift.
        for (const key of VIP_ENTITLEMENTS) {
            expect(entitlements).toContain(key);
        }
    });
});

/**
 * The consequences of the gift's design that survive the 2026-09-10 redesign,
 * pinned as DESIGN rather than left as gaps.
 *
 * **Owner model:** a user holds *(the keys of their vertical) ∪ (the keys of
 * tourist)*, where the tourist half is the VIP tier if they have the gift and
 * the free tier if not. The two halves are disjoint, so the gift replaces on its
 * own axis and touches nothing else. The merge semantics themselves are covered
 * above; what is pinned here is what that model IMPLIES, and would otherwise be
 * discovered later and mistaken for a bug.
 *
 * ## Why this block exists at all
 *
 * Until it did, the suite encoded these SILENTLY. The `VERTICALS` table above
 * includes accommodation, but the only by-reference case is gastronomy — because
 * an accommodation one would fail. Nothing said why, so the natural reading six
 * months from now is "somebody forgot accommodation", and the natural next move
 * is to add it. That would change a product decision by way of a test edit.
 *
 * Modelled on `packages/billing/test/liveness-predicate-divergence.test.ts`
 * (HOS-1310), whose whole job is likewise to pin a disagreement as deliberate so
 * that changing it lands as a diff somebody has to justify.
 *
 * ## What is pinned
 *
 * 1. **The accommodation asymmetry.** An admin edit to the `tourist-vip` row
 *    reaches gastronomy and experience and NOT accommodation, because
 *    accommodation resolves the same block from its own plan row (code), never
 *    from the runtime gift. See `RUNTIME_GIFTED_DOMAINS`.
 * 2. **A key REMOVED from the row still reaches the verticals** — the
 *    entitlement union starts from the config floor, so the row can only add.
 *    Including `VIP_SUPPORT`, which `plans.config.ts:604-606` calls out as the
 *    one inherited key that costs real money: switched off on the row, tourists
 *    lose it and the verticals keep it until the next deploy.
 *
 * The third item this block used to carry — "a lowered cap cannot reduce a key
 * the caller declares" — was a consequence of the `Math.max` merge and is now
 * FALSE by design. Its replacement lives above, as the absurd case.
 */
describe('HOS-1323 — consequences pinned as design (owner, 2026-09-10)', () => {
    /** The catalogue's own value, used by the asymmetry pair. */
    const VIP_COLLECTIONS = TOURIST_VIP_PLAN.limits.find((l) => l.key === 'max_collections')?.value;

    it('DESIGN: a row-only raise reaches gastronomy', async () => {
        expect(VIP_COLLECTIONS).toBeGreaterThan(0);
        stubTouristVipRow({ limits: { max_collections: 999 } });

        mockBilling.subscriptions.getByCustomerId.mockResolvedValue([
            { id: 'sub-gastro', planId: 'plan-gastronomy-basico', status: 'active' }
        ]);
        hydrateAs([{ id: 'sub-gastro', productDomain: 'gastronomy' }]);
        mockBilling.plans.get.mockResolvedValue(planRow(GASTRONOMY_BASICO_PLAN));

        const { limits } = await loadThroughMiddleware();

        expect(limits.max_collections).toBe(999);
    });

    /**
     * The other half, and the one easiest to mistake for a bug.
     *
     * An accommodation owner's VIP block comes from THEIR OWN plan row, which
     * `plans.config.ts` builds from the same constants — so the runtime gift is
     * never resolved for them and a row-only edit does not reach them. Turning
     * this green by adding `ACCOMMODATION` to the gifted domains would change a
     * product decision, and this case is what makes that land as a red test
     * rather than as a quiet improvement.
     */
    it('DESIGN: the same row-only raise does NOT reach accommodation', async () => {
        stubTouristVipRow({ limits: { max_collections: 999 } });

        mockBilling.subscriptions.getByCustomerId.mockResolvedValue([
            { id: 'sub-accom', planId: 'plan-owner-basico', status: 'active' }
        ]);
        hydrateAs([{ id: 'sub-accom', productDomain: 'accommodation' }]);
        mockBilling.plans.get.mockResolvedValue(planRow(OWNER_BASICO_PLAN));

        const { limits } = await loadThroughMiddleware();

        // The catalogue's value, not the row's — accommodation reads the block
        // from its own plan, resolved from code.
        expect(limits.max_collections).toBe(VIP_COLLECTIONS);
        expect(limits.max_collections).not.toBe(999);
    });

    /**
     * A tourist key the caller does not declare at all. `tourist-free` meters
     * three of the seven, so the other four arrive where the caller had nothing
     * — and publishing a number there is the point rather than a side effect: an
     * absent limit key resolves to UNLIMITED through every layer under
     * `getRemainingLimit`, so any number is strictly tighter than the absence.
     */
    it('DESIGN: a tourist key the caller never declared is published, not left absent', async () => {
        expect(TOURIST_FREE_PLAN.limits.map((l) => l.key)).not.toContain('max_collections');

        stubTouristVipRow({ limits: { max_collections: 3 } });

        mockBilling.subscriptions.getByCustomerId.mockResolvedValue([
            { id: 'sub-gastro', planId: 'plan-gastronomy-basico', status: 'active' }
        ]);
        hydrateAs([{ id: 'sub-gastro', productDomain: 'gastronomy' }]);
        mockBilling.plans.get.mockResolvedValue(null);

        const { limits } = await loadThroughMiddleware();

        expect(limits.max_collections).toBe(3);
    });

    /**
     * The entitlement half: the union starts from the config floor, so a key
     * switched OFF on the row still reaches the verticals until the next deploy.
     * `VIP_SUPPORT` is the case with a real bill attached
     * (`plans.config.ts:604-606`), which is exactly why it is the fixture.
     */
    it('DESIGN: an entitlement REMOVED from the row still reaches the verticals', async () => {
        const vipRow = planRow(TOURIST_VIP_PLAN);
        expect(vipRow.entitlements).toContain(EntitlementKey.VIP_SUPPORT);

        stubTouristVipRow({
            entitlements: vipRow.entitlements.filter((k) => k !== EntitlementKey.VIP_SUPPORT)
        });

        mockBilling.subscriptions.getByCustomerId.mockResolvedValue([
            { id: 'sub-gastro', planId: 'plan-gastronomy-basico', status: 'active' }
        ]);
        hydrateAs([{ id: 'sub-gastro', productDomain: 'gastronomy' }]);
        mockBilling.plans.get.mockResolvedValue(planRow(GASTRONOMY_BASICO_PLAN));

        const { entitlements } = await loadThroughMiddleware();

        expect(entitlements).toContain(EntitlementKey.VIP_SUPPORT);
    });
});
