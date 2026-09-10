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
     * the fallback happening to grant it.
     */
    it('a partner subscription grants no tourist-VIP key', async () => {
        mockBilling.subscriptions.getByCustomerId.mockResolvedValue([
            { id: 'sub-partner', planId: 'plan-partner-gold', status: 'active' }
        ]);
        hydrateAs([{ id: 'sub-partner', productDomain: 'partner' }]);
        // The partner plan row deliberately DOES carry a VIP key: without this
        // the assertion would pass for the unrelated reason that the fixture
        // grants nothing.
        mockBilling.plans.get.mockResolvedValue({
            id: 'plan-partner-gold',
            name: 'partner-gold',
            entitlements: [EntitlementKey.VIP_SUPPORT],
            limits: {}
        });

        const { entitlements } = await loadThroughMiddleware();

        expect(entitlements).not.toContain(EntitlementKey.VIP_SUPPORT);
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
});

describe('HOS-1323 — by REFERENCE, not by copy', () => {
    /**
     * The criterion that decides between two implementations which look
     * equivalent today.
     *
     * A plan is changed in this repo through TWO doors: `plans.config.ts` (the
     * constants every definition spreads) and `PUT /api/v1/admin/billing/
     * plans/{id}`, which writes `entitlements` / `limits` straight onto the
     * `billing_plans` row with no deploy (`routes/billing/admin/plans.ts:243`).
     *
     * An implementation that delivered the commerce plan ROW's own copy of the
     * VIP block would pass every other test in this file and fail this one:
     * the gastronomy row below does NOT carry `AI_SUPPORT`, the tourist-VIP row
     * does, and only a runtime read of the tourist-VIP plan can bridge that.
     */
    it('a key added to the tourist-VIP ROW reaches a gastronomy owner', async () => {
        const vipRow = planRow(TOURIST_VIP_PLAN);
        vi.spyOn(PlanService.prototype, 'getBySlug').mockImplementation(
            async (slug: string) =>
                ({
                    success: slug === TOURIST_VIP_PLAN.slug,
                    data: {
                        ...vipRow,
                        slug: TOURIST_VIP_PLAN.slug,
                        entitlements: [...vipRow.entitlements, EntitlementKey.AI_SUPPORT],
                        limits: vipRow.limits
                    },
                    error: { code: 'NOT_FOUND', message: `Plan not found: ${slug}` }
                }) as never
        );

        // The gastronomy plan row is the catalogue's own — it does NOT grant
        // AI_SUPPORT, so the key can only have come from the tourist-VIP plan.
        expect(GASTRONOMY_BASICO_PLAN.entitlements).not.toContain(EntitlementKey.AI_SUPPORT);

        mockBilling.subscriptions.getByCustomerId.mockResolvedValue([
            { id: 'sub-gastro', planId: 'plan-gastronomy-basico', status: 'active' }
        ]);
        hydrateAs([{ id: 'sub-gastro', productDomain: 'gastronomy' }]);
        mockBilling.plans.get.mockResolvedValue(planRow(GASTRONOMY_BASICO_PLAN));

        const { entitlements } = await loadThroughMiddleware();

        expect(entitlements).toContain(EntitlementKey.AI_SUPPORT);
    });
});

describe('HOS-1323 — the gift is a floor, never a ceiling', () => {
    /**
     * `mergeTouristVipGift` moves a limit only when the gift is MORE generous,
     * with `-1` read as unlimited rather than as "less than 5". Without that
     * reading, a gift of `max_compare_items: 5` would demote a plan that
     * declares the key uncapped, and every layer under `getRemainingLimit`
     * would treat 5 as the real ceiling.
     */
    it('does not demote a plan limit that is more generous than the gift', async () => {
        // Exercised on the DUAL owner, which is the only shape where both
        // sources are live at once: the gastronomy subscription triggers the
        // gift, and the accommodation subscription is the one whose plan row
        // the loader actually reads. A gastronomy-ONLY owner would prove
        // nothing here — the selector never asks for their plan, so there is no
        // plan value for the gift to demote (see the sibling test below).
        const generous = planRow(OWNER_BASICO_PLAN);
        generous.limits.max_compare_items = -1;
        const giftValue = TOURIST_VIP_PLAN.limits.find((l) => l.key === 'max_compare_items')?.value;
        expect(giftValue).toBeGreaterThan(0);

        mockBilling.subscriptions.getByCustomerId.mockResolvedValue([
            { id: 'sub-gastro', planId: 'plan-gastronomy-basico', status: 'active' },
            { id: 'sub-accom', planId: 'plan-owner-basico', status: 'active' }
        ]);
        hydrateAs([
            { id: 'sub-gastro', productDomain: 'gastronomy' },
            { id: 'sub-accom', productDomain: 'accommodation' }
        ]);
        mockBilling.plans.get.mockResolvedValue(generous);

        const { limits } = await loadThroughMiddleware();

        expect(limits.max_compare_items).toBe(-1);
    });

    /**
     * The other direction, and the one that made the fallback branch worth
     * covering separately: an owner with no accommodation/tourist subscription
     * lands on the tourist-FREE defaults, whose favourites cap is a small
     * number. The gift is a VIP tier or it is nothing.
     */
    it('raises the tourist-free fallback cap to the VIP one', async () => {
        mockBilling.subscriptions.getByCustomerId.mockResolvedValue([
            { id: 'sub-gastro', planId: 'plan-gastronomy-basico', status: 'active' }
        ]);
        hydrateAs([{ id: 'sub-gastro', productDomain: 'gastronomy' }]);
        // No plan row for the commerce subscription: the selector never asks
        // for one, so this is the shape of the real fallback branch.
        mockBilling.plans.get.mockResolvedValue(null);

        const freeFavourites = TOURIST_FREE_PLAN.limits.find((l) => l.key === 'max_favorites');
        const vipFavourites = TOURIST_VIP_PLAN.limits.find((l) => l.key === 'max_favorites');
        expect(freeFavourites?.value).not.toBe(vipFavourites?.value);

        const { limits } = await loadThroughMiddleware();

        expect(limits.max_favorites).toBe(vipFavourites?.value);
    });
});

describe('HOS-1323 — the commerce middleware republishes the gift', () => {
    /**
     * `commerceVerticalEntitlementMiddleware` REPLACES `userEntitlements`
     * wholesale (the SPEC-239 isolation), so whatever the global loader
     * published — the gift included — is dropped for the rest of a commerce
     * request. It has to put the gift back, or the invariant would hold on
     * every route except the vertical's own.
     */
    it('a gastronomy route still sees every tourist-VIP key after the replace', async () => {
        vi.spyOn(PlanService.prototype, 'getBySlug').mockImplementation(async (slug: string) => {
            if (slug === TOURIST_VIP_PLAN.slug) {
                return { success: true, data: planRow(TOURIST_VIP_PLAN) } as never;
            }
            return { success: true, data: planRow(GASTRONOMY_BASICO_PLAN) } as never;
        });

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
