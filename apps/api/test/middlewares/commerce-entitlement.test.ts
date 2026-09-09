/**
 * `commerceVerticalEntitlementMiddleware` — the layer that decides the cap
 * (HOS-688 AC-15, AC-31).
 *
 * The end-to-end proof that this middleware is actually MOUNTED lives in
 * `test/commerce/listing-cap.e2e.test.ts` (AC-30). This file proves the number
 * it publishes is the right one, across the branches a request test cannot
 * reach without a real billing provider: an add-on purchase, a plan whose cap
 * differs from the catalogue default, and a billing outage.
 *
 * ## The invariant every case here re-checks
 *
 * **`userLimits` carries the vertical's key, with a NUMBER, on every path.**
 *
 * That is the whole reason this middleware exists. `getRemainingLimit` returns
 * `-1` — "treat as unlimited" — for an ABSENT key, and several
 * `entitlementMiddleware` branches publish an empty limits Map, which is
 * unlimited for every key at once. So "the key is missing" and "the owner may
 * create infinitely many listings" are the same state, and neither logs
 * anything. Half the assertions below are therefore about the key being
 * present at all, not about its value.
 *
 * @module test/middlewares/commerce-entitlement
 */

import { LimitKey } from '@repo/billing';
import { getDb } from '@repo/db';
import { Hono } from 'hono';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppBindings } from '../../src/types.js';

/**
 * Product domains as actually STORED in `billing_subscriptions`, keyed by
 * subscription id — recovered by `hydrateSubscriptionProductDomains`'s
 * batched SELECT, mocked via `getDb()` below.
 *
 * HOS-934: `getByCustomerId()` (the fake provider above) never populates
 * `productDomain` on the objects it returns — qzpay-core's mapper builds
 * them field-by-field from the fields `QZPaySubscription` declares, and
 * `productDomain` is a qzpay-drizzle column outside that interface. Setting
 * `productDomain` directly on `fakeSubscriptions` (as this file used to do)
 * is exactly the lying-fixture shape that would hide a broken/missing
 * hydration — see `hydrateSubscriptionProductDomains`'s doc in
 * `@repo/service-core`.
 */
let fakeStoredProductDomains: Record<string, string | null> = {};

/** Subscriptions the fake billing provider returns for the customer. */
let fakeSubscriptions: Array<Record<string, unknown>> = [];
/** Plans the fake provider resolves by id. */
let fakePlans: Record<string, { limits: Record<string, number>; entitlements?: string[] }> = {};
/** Customer-level limit overrides — how a purchased add-on raises a cap. */
let fakeCustomerLimits: Array<{ limitKey: string; maxValue: number }> = [];
/** When set, every provider call throws it. */
let providerThrows: Error | null = null;

vi.mock('../../src/middlewares/billing', () => ({
    getQZPayBilling: () => ({
        subscriptions: {
            getByCustomerId: async () => {
                if (providerThrows) throw providerThrows;
                return fakeSubscriptions;
            }
        },
        plans: {
            get: async (id: string) => {
                if (providerThrows) throw providerThrows;
                return fakePlans[id] ?? null;
            }
        },
        limits: {
            getByCustomerId: async () => {
                if (providerThrows) throw providerThrows;
                return fakeCustomerLimits;
            }
        }
    })
}));

/**
 * The catalogue plan each vertical falls back to when the owner has no
 * subscription. Mirrors what `PlanService.getBySlug` returns from the DB.
 *
 * HOS-1276: each base plan now also declares a `TOURIST_VIP_LIMITS`-shaped key
 * (`max_favorites`) alongside its own listing cap, mirroring the REAL shape a
 * commerce plan row has in `plans.config.ts` (`mergeLimits(TOURIST_VIP_LIMITS,
 * [...])`). A fixture that only ever declared the vertical's own key could not
 * catch the bug this issue is about: it would pass with the OLD single-key
 * `userLimits` map just as easily as with the fixed one.
 */
vi.mock('../../src/services/plan.service', () => ({
    PlanService: class {
        async getBySlug(slug: string) {
            const limits: Record<string, Record<string, number>> = {
                'gastronomy-premium': { max_gastronomies: 1, max_favorites: -1 },
                'experience-premium': { max_experiences: 1, max_favorites: -1 }
            };
            const found = limits[slug];
            if (!found) {
                return { success: false as const, error: { code: 'NOT_FOUND', message: slug } };
            }
            return { success: true as const, data: { limits: found } };
        }
    }
}));

const { commerceVerticalEntitlementMiddleware, _resetCommerceBaseLimitCache } = await import(
    '../../src/middlewares/commerce-entitlement.js'
);
const { getRemainingLimit } = await import('../../src/middlewares/entitlement.js');

/**
 * Runs the middleware and reports the limits map it published.
 *
 * @param input.vertical - The vertical to gate.
 * @param input.billingCustomerId - The caller's billing customer, when they have one.
 * @param input.actorId - The requesting actor's id (default `'owner-1'`).
 * @returns The published limits as a plain object.
 */
async function runMiddleware(input: {
    vertical: 'gastronomy' | 'experience';
    billingCustomerId?: string;
    actorId?: string;
}): Promise<Record<string, number>> {
    const app = new Hono<AppBindings>();

    app.use('*', async (c, next) => {
        c.set('actor', { id: input.actorId ?? 'owner-1', roles: [] } as never);
        if (input.billingCustomerId) {
            c.set('billingCustomerId', input.billingCustomerId);
        }
        await next();
    });
    app.use('*', commerceVerticalEntitlementMiddleware(input.vertical));
    app.get('/', (c) => c.json(Object.fromEntries(c.get('userLimits') ?? new Map())));

    const res = await app.request('/');
    return (await res.json()) as Record<string, number>;
}

/**
 * Runs the middleware and reports what `getRemainingLimit` — the SAME
 * function `createAiQuotaMiddleware` and every other quota gate reads —
 * resolves for a given key. This is the "does anyone actually consume the
 * published map" check (HOS-1276 rule 3): asserting the map merely CONTAINS a
 * key is not enough, since a consumer could still read the wrong Context or a
 * stale reference. Reading through the real accessor closes that gap.
 *
 * @param input.vertical - The vertical to gate.
 * @param input.billingCustomerId - The caller's billing customer, when they have one.
 * @param input.limitKey - The `LimitKey` to resolve via `getRemainingLimit`.
 * @returns Whatever `getRemainingLimit` resolves (`-1` for unlimited/absent).
 */
async function runMiddlewareAndReadLimit(input: {
    vertical: 'gastronomy' | 'experience';
    billingCustomerId?: string;
    limitKey: LimitKey;
}): Promise<number> {
    const app = new Hono<AppBindings>();

    app.use('*', async (c, next) => {
        c.set('actor', { id: 'owner-1', roles: [] } as never);
        if (input.billingCustomerId) {
            c.set('billingCustomerId', input.billingCustomerId);
        }
        await next();
    });
    app.use('*', commerceVerticalEntitlementMiddleware(input.vertical));
    app.get('/', (c) => c.json({ value: getRemainingLimit(c, input.limitKey) }));

    const res = await app.request('/');
    const body = (await res.json()) as { value: number };
    return body.value;
}

/**
 * Wires the mocked `getDb()` to answer `hydrateSubscriptionProductDomains`'s
 * batched recovery SELECT with `fakeStoredProductDomains`.
 */
function mockProductDomainRecovery() {
    vi.mocked(getDb).mockReturnValue({
        select: vi.fn().mockReturnValue({
            from: vi.fn().mockReturnValue({
                where: vi.fn().mockResolvedValue(
                    Object.entries(fakeStoredProductDomains).map(([id, productDomain]) => ({
                        id,
                        productDomain
                    }))
                )
            })
        })
    } as never);
}

describe('commerceVerticalEntitlementMiddleware (HOS-688)', () => {
    beforeEach(() => {
        fakeSubscriptions = [];
        fakePlans = {};
        fakeCustomerLimits = [];
        fakeStoredProductDomains = {};
        providerThrows = null;
        _resetCommerceBaseLimitCache();
        mockProductDomainRecovery();
    });

    afterEach(() => {
        _resetCommerceBaseLimitCache();
    });

    it('publishes the catalogue cap for an owner with no subscription (AC-31)', async () => {
        const limits = await runMiddleware({ vertical: 'gastronomy' });

        expect(limits[LimitKey.MAX_GASTRONOMIES]).toBe(1);
    });

    it('never leaves the key absent, which would read as unlimited', async () => {
        const limits = await runMiddleware({ vertical: 'gastronomy' });

        expect(Object.hasOwn(limits, LimitKey.MAX_GASTRONOMIES)).toBe(true);
        expect(limits[LimitKey.MAX_GASTRONOMIES]).not.toBe(-1);
    });

    it("publishes the OTHER vertical's keys never, but every key THIS vertical's subscription plan declares (HOS-1276)", async () => {
        // The two domains are never merged (SPEC-239's isolation, made explicit
        // at the call site) — a gastronomy route publishing `max_experiences`
        // would let one plan's cap answer for the other vertical. That part
        // pre-dates HOS-1276. What HOS-1276 fixes is the OTHER failure mode
        // this test used to hide: `userLimits` collapsing to a Map with a
        // single entry, silently dropping every other key gastronomy's own
        // plan declares (here, the TOURIST_VIP_LIMITS-shaped `max_favorites`
        // and the AI-chat key) — each of which then read as unlimited.
        //
        // Uses an active subscription (not the no-subscription branch) so the
        // plan's full `limits` object — including `max_favorites` — is
        // actually read; see the base-plan-lookup fixture at the top of this
        // file for what the no-subscription branch resolves to instead.
        fakeSubscriptions = [{ id: 's1', status: 'active', planId: 'p-gastro-full' }];
        fakeStoredProductDomains = { s1: 'gastronomy' };
        mockProductDomainRecovery();
        fakePlans = {
            'p-gastro-full': {
                limits: {
                    max_gastronomies: 5,
                    max_ai_chat_gastronomy_per_month: 100,
                    max_favorites: -1
                }
            }
        };

        const limits = await runMiddleware({ vertical: 'gastronomy', billingCustomerId: 'cus-1' });

        // Gastronomy's own declared keys are ALL present.
        expect(Object.hasOwn(limits, LimitKey.MAX_GASTRONOMIES)).toBe(true);
        expect(Object.hasOwn(limits, LimitKey.MAX_AI_CHAT_GASTRONOMY_PER_MONTH)).toBe(true);
        expect(Object.hasOwn(limits, LimitKey.MAX_FAVORITES)).toBe(true);

        // Experience's keys are never present on a gastronomy request.
        expect(Object.hasOwn(limits, LimitKey.MAX_EXPERIENCES)).toBe(false);
        expect(Object.hasOwn(limits, LimitKey.MAX_AI_CHAT_EXPERIENCE_PER_MONTH)).toBe(false);
    });

    it("reads the cap off the owner's own vertical subscription", async () => {
        fakeSubscriptions = [{ id: 's1', status: 'active', planId: 'p-gastro' }];
        fakeStoredProductDomains = { s1: 'gastronomy' };
        mockProductDomainRecovery();
        fakePlans = { 'p-gastro': { limits: { max_gastronomies: 3 } } };

        const limits = await runMiddleware({
            vertical: 'gastronomy',
            billingCustomerId: 'cus-1'
        });

        expect(limits[LimitKey.MAX_GASTRONOMIES]).toBe(3);
    });

    it('ignores an ACCOMMODATION subscription when gating a commerce vertical', async () => {
        // The bug SPEC-239's isolation exists to prevent, in the other
        // direction: an accommodation plan must never supply a commerce cap.
        fakeSubscriptions = [{ id: 's1', status: 'active', planId: 'p-owner' }];
        fakeStoredProductDomains = { s1: 'accommodation' };
        mockProductDomainRecovery();
        fakePlans = { 'p-owner': { limits: { max_accommodations: 10 } } };

        const limits = await runMiddleware({
            vertical: 'gastronomy',
            billingCustomerId: 'cus-1'
        });

        // Falls back to the catalogue cap, NOT to 10 and not to unlimited.
        expect(limits[LimitKey.MAX_GASTRONOMIES]).toBe(1);
    });

    it("raises the cap by the vertical's add-on and leaves the other alone (AC-15)", async () => {
        fakeSubscriptions = [{ id: 's1', status: 'active', planId: 'p-gastro' }];
        fakeStoredProductDomains = { s1: 'gastronomy' };
        mockProductDomainRecovery();
        fakePlans = { 'p-gastro': { limits: { max_gastronomies: 1 } } };
        // What `recalculateAddonLimitsForCustomer` writes after an
        // `extra-gastronomies-1` purchase: plan base + the add-on's increase.
        fakeCustomerLimits = [{ limitKey: 'max_gastronomies', maxValue: 2 }];

        const gastronomy = await runMiddleware({
            vertical: 'gastronomy',
            billingCustomerId: 'cus-1'
        });
        _resetCommerceBaseLimitCache();
        const experience = await runMiddleware({
            vertical: 'experience',
            billingCustomerId: 'cus-1'
        });

        expect(gastronomy[LimitKey.MAX_GASTRONOMIES]).toBe(2);
        // The other vertical is untouched — the second half of AC-15, and the
        // half a single pooled cap could not express.
        expect(experience[LimitKey.MAX_EXPERIENCES]).toBe(1);
    });

    it('HOS-934: an experience subscription never raises the gastronomy cap (hydration must recover the real domain)', async () => {
        // The regression this file used to hide: `fakeSubscriptions` never
        // carries `productDomain` (matching the real SDK shape), so without
        // `hydrateSubscriptionProductDomains` this experience subscription
        // would read as `productDomain: undefined` — which
        // `subscriptionMatchesDomain` fails OPEN to accommodation for, not
        // gastronomy, but a broken hydration that defaulted differently
        // would still leak a stray cap across verticals. Assert the isolation
        // directly: an experience-only owner gets the CATALOGUE gastronomy
        // cap, never the experience plan's number.
        fakeSubscriptions = [{ id: 's1', status: 'active', planId: 'p-experience' }];
        fakeStoredProductDomains = { s1: 'experience' };
        mockProductDomainRecovery();
        fakePlans = { 'p-experience': { limits: { max_experiences: 7 } } };

        const limits = await runMiddleware({
            vertical: 'gastronomy',
            billingCustomerId: 'cus-1'
        });

        expect(limits[LimitKey.MAX_GASTRONOMIES]).toBe(1);
    });

    it('holds the catalogue cap when the billing provider is down', async () => {
        // Fails to the BASE cap, never to an absent key. An outage may cost an
        // owner the extra listing they bought; it must never hand out an
        // uncapped catalogue.
        providerThrows = new Error('billing unavailable');

        const limits = await runMiddleware({
            vertical: 'gastronomy',
            billingCustomerId: 'cus-1'
        });

        expect(limits[LimitKey.MAX_GASTRONOMIES]).toBe(1);
    });

    it('ignores a cancelled subscription and falls back to the catalogue cap', async () => {
        fakeSubscriptions = [{ id: 's1', status: 'cancelled', planId: 'p-gastro' }];
        fakeStoredProductDomains = { s1: 'gastronomy' };
        mockProductDomainRecovery();
        fakePlans = { 'p-gastro': { limits: { max_gastronomies: 9 } } };

        const limits = await runMiddleware({
            vertical: 'gastronomy',
            billingCustomerId: 'cus-1'
        });

        expect(limits[LimitKey.MAX_GASTRONOMIES]).toBe(1);
    });

    // -----------------------------------------------------------------------
    // HOS-1276: the AI-chat quota is CALCULATED and then DISCARDED.
    //
    // `resolveCommerceVerticalGrants` always computed the vertical's AI-chat
    // cap correctly (HOS-400's `aiChatCap` field). The bug was entirely on the
    // publishing side: `commerceVerticalEntitlementMiddleware` replaced
    // `userLimits` with `new Map([[listingCapKey, cap]])` — ONE entry — so
    // `MAX_AI_CHAT_GASTRONOMY_PER_MONTH` / `MAX_AI_CHAT_EXPERIENCE_PER_MONTH`
    // were never in the map ANY quota gate reads. An absent key resolves to
    // `-1` (unlimited) through `getRemainingLimit`, which is what
    // `createAiQuotaMiddleware('chat_gastronomy' | 'chat_experience')` — the
    // enforcement machinery already wired to read exactly this key
    // (`AI_LIMIT_BY_FEATURE` in `middlewares/ai-quota.ts`) — would consult the
    // moment it is mounted on a commerce route. These tests read through the
    // REAL `getRemainingLimit`, not just `Object.hasOwn` on the map, so a
    // regression that re-introduces the single-key Map fails here even if it
    // happens to leave the raw Map object shaped correctly for some other
    // reader.
    // -----------------------------------------------------------------------
    describe('AI-chat quota is published and enforceable (HOS-1276)', () => {
        it('a gastronomy owner on a plan granting a finite chat quota is capped at that number, not unlimited', async () => {
            fakeSubscriptions = [{ id: 's1', status: 'active', planId: 'p-gastro-premium' }];
            fakeStoredProductDomains = { s1: 'gastronomy' };
            mockProductDomainRecovery();
            // Mirrors GASTRONOMY_PREMIUM_PLAN's real shape: grants AI_CHAT with
            // a finite monthly quota, on top of the vertical's own listing cap.
            fakePlans = {
                'p-gastro-premium': {
                    limits: { max_gastronomies: 5, max_ai_chat_gastronomy_per_month: 100 },
                    entitlements: ['ai_chat']
                }
            };

            const resolved = await runMiddlewareAndReadLimit({
                vertical: 'gastronomy',
                billingCustomerId: 'cus-1',
                limitKey: LimitKey.MAX_AI_CHAT_GASTRONOMY_PER_MONTH
            });

            // The case that actually catches the bug: BEFORE the fix this key
            // was absent from `userLimits`, and an absent key resolves to -1
            // through `getRemainingLimit` — a plan that promises 100 chats a
            // month would spend without limit. `Object.hasOwn` alone would not
            // have caught this if some OTHER code path had happened to leave a
            // stale `-1` under the same key; asserting the real number does.
            expect(resolved).toBe(100);
            expect(resolved).not.toBe(-1);
        });

        it('an experience owner on a plan granting a finite chat quota is capped at that number, not unlimited', async () => {
            fakeSubscriptions = [{ id: 's1', status: 'active', planId: 'p-experience-premium' }];
            fakeStoredProductDomains = { s1: 'experience' };
            mockProductDomainRecovery();
            fakePlans = {
                'p-experience-premium': {
                    limits: { max_experiences: 5, max_ai_chat_experience_per_month: 150 },
                    entitlements: ['ai_chat']
                }
            };

            const resolved = await runMiddlewareAndReadLimit({
                vertical: 'experience',
                billingCustomerId: 'cus-1',
                limitKey: LimitKey.MAX_AI_CHAT_EXPERIENCE_PER_MONTH
            });

            expect(resolved).toBe(150);
            expect(resolved).not.toBe(-1);
        });

        it('a gastronomy owner with NO subscription gets the chat quota refused (0), never unlimited', async () => {
            // No active subscription — resolves to `AI_CHAT_CAP_WITHOUT_PLAN`
            // (0), the safe direction. Before the fix this key was simply
            // absent, which `getRemainingLimit` reads as unlimited (-1).
            const resolved = await runMiddlewareAndReadLimit({
                vertical: 'gastronomy',
                limitKey: LimitKey.MAX_AI_CHAT_GASTRONOMY_PER_MONTH
            });

            expect(resolved).toBe(0);
        });

        it("publishes the plan's TOURIST_VIP_LIMITS keys too, not only the AI-chat key (HOS-1276 scope)", async () => {
            // The issue names this explicitly: "también se pierden los
            // TOURIST_VIP_LIMITS que los propios planes de comercio declaran".
            // `max_favorites` here stands in for that whole inherited block —
            // any of its sibling keys would show the identical failure.
            fakeSubscriptions = [{ id: 's1', status: 'active', planId: 'p-gastro-premium' }];
            fakeStoredProductDomains = { s1: 'gastronomy' };
            mockProductDomainRecovery();
            fakePlans = {
                'p-gastro-premium': {
                    limits: {
                        max_gastronomies: 5,
                        max_ai_chat_gastronomy_per_month: 100,
                        max_favorites: -1
                    }
                }
            };

            const limits = await runMiddleware({
                vertical: 'gastronomy',
                billingCustomerId: 'cus-1'
            });

            expect(Object.hasOwn(limits, LimitKey.MAX_FAVORITES)).toBe(true);
            expect(limits[LimitKey.MAX_FAVORITES]).toBe(-1);
        });

        it('a dual host+commerce owner (host-provider@local.test shape): the ACCOMMODATION subscription never supplies or blocks the commerce AI-chat quota', async () => {
            // HOS-1074's guarantee, extended to limits: an owner who is BOTH a
            // host and a gastronomy owner must get exactly the gastronomy
            // vertical's own numbers on a gastronomy request — neither raised
            // nor lowered by whatever their accommodation plan carries. Two
            // subscriptions on the same customer, only one of them matches the
            // gastronomy domain via `subscriptionMatchesDomain` (hydrated
            // above via `fakeStoredProductDomains`).
            fakeSubscriptions = [
                { id: 's-accommodation', status: 'active', planId: 'p-owner-basico' },
                { id: 's-gastro', status: 'active', planId: 'p-gastro-premium' }
            ];
            fakeStoredProductDomains = {
                's-accommodation': 'accommodation',
                's-gastro': 'gastronomy'
            };
            mockProductDomainRecovery();
            fakePlans = {
                'p-owner-basico': {
                    // The accommodation plan grants its OWN (unrelated) AI-chat
                    // key at a different number — must never leak into the
                    // gastronomy-keyed quota.
                    limits: { max_accommodations: 1, max_ai_chat_per_month: 999 }
                },
                'p-gastro-premium': {
                    limits: { max_gastronomies: 5, max_ai_chat_gastronomy_per_month: 100 },
                    entitlements: ['ai_chat']
                }
            };

            const limits = await runMiddleware({
                vertical: 'gastronomy',
                billingCustomerId: 'cus-dual',
                actorId: 'host-provider-1'
            });

            expect(limits[LimitKey.MAX_AI_CHAT_GASTRONOMY_PER_MONTH]).toBe(100);
            // The accommodation-only key never appears on a commerce request.
            expect(Object.hasOwn(limits, LimitKey.MAX_ACCOMMODATIONS)).toBe(false);
            expect(Object.hasOwn(limits, LimitKey.MAX_AI_CHAT_PER_MONTH)).toBe(false);
        });
    });
});
