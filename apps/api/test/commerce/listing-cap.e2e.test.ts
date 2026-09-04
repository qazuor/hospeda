/**
 * The commerce listing cap, asserted END-TO-END (HOS-688 AC-30, AC-13, AC-31).
 *
 * ---
 * WHY THIS FILE IS A REQUEST TEST AND NOT A UNIT TEST
 *
 * AC-30 is explicit: *"a real request to the commerce create route, traversing
 * the middleware stack, with the owner's plan loaded. A test that calls
 * `checkLimit` with a hand-built context proves nothing, because every layer
 * beneath it resolves an unknown key to unlimited."*
 *
 * That is not pedantry. Before HOS-688 the create route ran **no** entitlement
 * middleware and **no** limit enforcement whatsoever, so a `checkLimit` test
 * would have passed against a route with no gate on it at all — it would have
 * asserted the helper, never the wiring. Everything below therefore goes
 * through `app.request()`, exactly as a browser would.
 *
 * ## What the fixtures pin down, and what they leave real
 *
 * Only the LISTING COUNT is stubbed (`count()` on each vertical's service),
 * because that is the request-specific input a test has to control. Everything
 * else runs: the route factory, auth, the permission gate,
 * `commerceVerticalEntitlementMiddleware`, `enforceGastronomyLimit`,
 * `checkLimit`, `getRemainingLimit`, and the ServiceError → HTTP mapping.
 *
 * The actor deliberately has **no billing customer and no subscription of any
 * kind**. That is not a shortcut — it IS AC-31: a commerce-only owner who has
 * never bought an accommodation plan, which is the case the accommodation
 * entitlement loader fails open on. The cap still has to hold, and the number
 * it holds at comes from the vertical's own plan.
 *
 * @module test/commerce/listing-cap.e2e
 */

import {
    EXPERIENCE_BASICO_PLAN,
    EXPERIENCE_PREMIUM_PLAN,
    EXPERIENCE_PRO_PLAN,
    GASTRONOMY_BASICO_PLAN,
    GASTRONOMY_PREMIUM_PLAN,
    GASTRONOMY_PRO_PLAN,
    LimitKey,
    type PlanDefinition
} from '@repo/billing';
import { getDb } from '@repo/db';
import { ExperienceService, GastronomyService } from '@repo/service-core';
import type { MiddlewareHandler } from 'hono';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { initApp } from '../../src/app.js';
import { _resetCommerceBaseLimitCache } from '../../src/middlewares/commerce-entitlement.js';
import type { AppOpenAPI } from '../../src/types.js';

/**
 * HOS-975 raised three of the six commerce plans' listing caps above 1
 * (gastronomy-pro=3, gastronomy-premium=5, experience-pro=5,
 * experience-premium=10). Reaching those numbers end-to-end means the owner
 * has to resolve to an ACTIVE subscription on the right plan through
 * `resolveCommerceVerticalGrants` — the base-cap branch every test above this
 * point exercises always answers with the catalogue's ENTRY tier (HOS-688
 * AC-31), never a paid one.
 *
 * `getQZPayBilling` is the one seam that path reaches into the external,
 * MercadoPago-backed provider, and this suite's global `@repo/db` test mock
 * does not stub `createBillingAdapter` — so the REAL `billingMiddleware`
 * always fails its DB-backed bootstrap here and leaves `billingEnabled:
 * false`, which makes `billingCustomerMiddleware` skip the customer lookup
 * before any subscription data is ever reached. The two overrides below
 * exist ONLY to clear that bootstrap hurdle (there is no real MercadoPago or
 * Postgres behind this test run) — everything they gate stays real:
 * `billingCustomerMiddleware`'s customer lookup, the REAL
 * `commerceVerticalEntitlementMiddleware` (subscription hydration, domain
 * matching, and plan-limit resolution inside `resolveCommerceVerticalGrants`),
 * `requireEntitlement`, `enforceGastronomyLimit`/`enforceExperienceLimit`,
 * `checkLimit`, and the ServiceError→HTTP mapping.
 */
let fakeTierCustomerId: string | null = null;
let fakeTierSubscriptions: Array<Record<string, unknown>> = [];
let fakeTierPlans: Record<string, { limits: Record<string, number> }> = {};
let fakeTierProductDomains: Record<string, string | null> = {};

vi.mock('../../src/middlewares/billing.js', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../../src/middlewares/billing.js')>();
    // Defined INLINE rather than referencing an outer `const`: `vi.mock`
    // factories are hoisted above every top-level declaration in this file,
    // so a reference to a module-scope `const` here would hit the temporal
    // dead zone. The `let fakeTier*` reads below are safe because they only
    // happen inside further-nested closures that this factory returns but
    // does not itself CALL — those run later, once a request actually
    // reaches the route, by which point this file's own top-level code has
    // long since finished executing.
    const fakeBillingMiddleware: MiddlewareHandler = async (c, next) => {
        c.set('billingEnabled', true);
        await next();
    };
    return {
        ...actual,
        billingMiddleware: fakeBillingMiddleware,
        getQZPayBilling: () => ({
            customers: {
                getByExternalId: async () =>
                    fakeTierCustomerId ? { id: fakeTierCustomerId } : null
            },
            subscriptions: {
                getByCustomerId: async () => fakeTierSubscriptions
            },
            plans: {
                get: async (id: string) => fakeTierPlans[id] ?? null
            },
            limits: {
                getByCustomerId: async () => []
            }
        })
    };
});

const USER_AGENT = { 'user-agent': 'vitest' };
const OWNER_ID = '11111111-1111-4111-8111-111111111111';

const GASTRONOMY_PATH = '/api/v1/protected/commerce/listings/gastronomy';
const EXPERIENCE_PATH = '/api/v1/protected/commerce/listings/experience';

/** A commerce owner with the create permission and nothing else. */
const ownerHeaders = {
    ...USER_AGENT,
    'content-type': 'application/json',
    'x-mock-actor-id': OWNER_ID,
    'x-mock-actor-role': 'COMMERCE_OWNER',
    'x-mock-actor-permissions': JSON.stringify(['commerce.create'])
};

/** A minimally valid gastronomy create payload. */
const gastronomyBody = JSON.stringify({
    name: 'La Parrilla del Puerto',
    summary: 'A riverside parrilla with fresh grilled fish and steak.',
    description: 'La Parrilla del Puerto has served the waterfront for over a decade.',
    type: 'RESTAURANT'
});

/** A minimally valid experience create payload. */
const experienceBody = JSON.stringify({
    name: 'Kayak tour on the Uruguay river',
    summary: 'A guided two-hour kayak tour along the riverside.',
    description: 'A guided kayak tour departing from the municipal pier every morning.',
    type: 'ADVENTURE',
    isPriceOnRequest: true
});

/**
 * Stubs how many listings the owner already holds in one vertical.
 *
 * @param service - The vertical's service class.
 * @param count - The owner's current listing count.
 */
function stubCount(
    service: typeof GastronomyService | typeof ExperienceService,
    count: number
): void {
    // `as never`: BaseCrudService.count's Result generic is not nameable at the
    // call site, and the shape asserted here is only the two fields it reads.
    const result = { data: { count }, error: undefined } as never;
    vi.spyOn(service.prototype, 'count').mockResolvedValue(result);
}

/**
 * Reads a plan's declared cap for one listing-limit key straight off its
 * REAL `PlanDefinition` (`@repo/billing`'s `plans.config.ts`, unmocked in
 * this suite), rather than a literal duplicated in the test.
 *
 * This is what makes the tests below non-vacuous against a config
 * regression: if HOS-975's `gastronomy-pro` ladder value ever reverts from 3
 * to 1, `GASTRONOMY_PRO_PLAN.limits` changes with it, the cap fed into the
 * fake subscription's plan changes with it, and the "3rd listing is allowed"
 * assertion starts failing — without this indirection the cap would be a
 * number the test invented, proving only that `checkLimit` can compare two
 * numbers.
 *
 * @param plan - The plan definition to read.
 * @param limitKey - Which limit key to read off it.
 * @returns The plan's declared cap for that key.
 * @throws If the plan does not declare the key — a config regression of its
 *   own, and one this helper must not silently paper over with a fallback.
 */
function capFromPlanDefinition(plan: PlanDefinition, limitKey: LimitKey): number {
    const declared = plan.limits.find((entry) => entry.key === limitKey);
    if (!declared) {
        throw new Error(`Plan '${plan.slug}' does not declare a '${limitKey}' limit`);
    }
    return declared.value;
}

/**
 * Wires the fake billing provider (see the `vi.mock('.../middlewares/billing.js')`
 * block above) so the owner resolves to a single ACTIVE subscription on
 * `plan`, at the cap `plan` REALLY declares for `vertical` — the shape
 * `resolveCommerceVerticalGrants` needs to take the SUBSCRIPTION branch
 * (HOS-975's pro/premium caps) instead of the catalogue base-cap fallback
 * every test above this function exercises (HOS-688 AC-31, always the entry
 * tier).
 *
 * @param input.vertical - The commerce vertical under test.
 * @param input.plan - The REAL plan definition (`@repo/billing`) this owner
 *   is subscribed to.
 * @returns The cap this plan declares for `vertical`, so callers can drive
 *   `stubCount`/assertions off the same number instead of a second literal.
 */
function subscribeOwnerToTier(input: {
    vertical: 'gastronomy' | 'experience';
    plan: PlanDefinition;
}): number {
    const limitKey =
        input.vertical === 'gastronomy' ? LimitKey.MAX_GASTRONOMIES : LimitKey.MAX_EXPERIENCES;
    const cap = capFromPlanDefinition(input.plan, limitKey);
    const planId = input.plan.slug;

    fakeTierCustomerId = 'cus-owner-1';
    fakeTierSubscriptions = [{ id: 'sub-1', status: 'active', planId }];
    fakeTierProductDomains = { 'sub-1': input.vertical };
    fakeTierPlans = { [planId]: { limits: { [limitKey]: cap } } };

    // Mirrors `test/middlewares/commerce-entitlement.test.ts`'s
    // `mockProductDomainRecovery`, which answers `hydrateSubscriptionProductDomains`'s
    // batched recovery SELECT. Without this, the default `@repo/db` test mock
    // resolves every unstubbed query to `[]`, every subscription's
    // `productDomain` comes back `undefined`, and `subscriptionMatchesDomain`
    // never matches that to gastronomy/experience — the subscription branch
    // below would never activate and every assertion here would silently fall
    // back to testing the entry-tier cap again.
    vi.mocked(getDb).mockReturnValue({
        select: vi.fn().mockReturnValue({
            from: vi.fn().mockReturnValue({
                where: vi.fn().mockResolvedValue(
                    Object.entries(fakeTierProductDomains).map(([id, productDomain]) => ({
                        id,
                        productDomain
                    }))
                )
            })
        })
    } as never);

    return cap;
}

/**
 * Reads the JSON error body of a response.
 *
 * `details` is typed but NOT relied on: `handleRouteError` — the formatter every
 * `createProtectedRoute` lands in — emits `error.details` only when
 * `HOSPEDA_API_DEBUG_ERRORS` is set, which it is not here and is not in
 * production. The assertions below therefore identify WHICH cap fired through
 * `error.message`, which is emitted unconditionally on a 4xx and is built from
 * `RESOURCE_NAMES[limitKey]` — so it names the vertical. The structured
 * `details` shape (`limitKey`, `maxAllowed`, `upgradeAudience`) is asserted
 * against the middleware directly in
 * `test/middlewares/commerce-entitlement.test.ts`.
 */
async function errorBody(res: Response): Promise<{
    error?: {
        code?: string;
        message?: string;
        details?: {
            limitKey?: string;
            currentCount?: number;
            maxAllowed?: number;
            upgradeAudience?: string;
        };
    };
}> {
    return (await res.json()) as never;
}

describe('commerce listing cap — end to end (HOS-688 AC-30)', () => {
    let app: AppOpenAPI;

    beforeAll(() => {
        app = initApp();
    });

    afterEach(() => {
        vi.restoreAllMocks();
        _resetCommerceBaseLimitCache();
    });

    it('refuses a second gastronomy listing with 403 LIMIT_REACHED', async () => {
        // The owner already holds their one gastronomy listing.
        stubCount(GastronomyService, 1);

        const res = await app.request(GASTRONOMY_PATH, {
            method: 'POST',
            headers: ownerHeaders,
            body: gastronomyBody
        });

        expect(res.status).toBe(403);

        const body = await errorBody(res);
        // Asserting the CODE, not just the status: the permission gate also
        // answers 403, and a status-only assertion would pass with the cap
        // entirely unwired — which is precisely the state this route was in.
        expect(body.error?.code).toBe('LIMIT_REACHED');
        // And the message, because it names the resource via RESOURCE_NAMES,
        // i.e. it identifies WHICH cap fired and at what number.
        expect(body.error?.message).toContain('gastronomías');
        expect(body.error?.message).toContain('1');
    });

    it('allows the FIRST gastronomy listing through the same stack', async () => {
        // Non-vacuity: proves the gate is reading the count rather than
        // refusing every request that reaches it.
        stubCount(GastronomyService, 0);

        const res = await app.request(GASTRONOMY_PATH, {
            method: 'POST',
            headers: ownerHeaders,
            body: gastronomyBody
        });

        expect(res.status).not.toBe(403);
    });

    it('still allows an EXPERIENCE while the gastronomy cap is full (AC-13)', async () => {
        // The whole point of two keys instead of one pooled cap: a full
        // restaurant slot must say nothing about excursions. A shared cap would
        // refuse this request, and the refusal would look perfectly correct.
        stubCount(GastronomyService, 1);
        stubCount(ExperienceService, 0);

        const gastronomy = await app.request(GASTRONOMY_PATH, {
            method: 'POST',
            headers: ownerHeaders,
            body: gastronomyBody
        });
        const experience = await app.request(EXPERIENCE_PATH, {
            method: 'POST',
            headers: ownerHeaders,
            body: experienceBody
        });

        expect(gastronomy.status).toBe(403);
        expect(experience.status).not.toBe(403);
    });

    it('refuses a second experience on its OWN key, not gastronomy (AC-13, mirrored)', async () => {
        stubCount(GastronomyService, 0);
        stubCount(ExperienceService, 1);

        const res = await app.request(EXPERIENCE_PATH, {
            method: 'POST',
            headers: ownerHeaders,
            body: experienceBody
        });

        expect(res.status).toBe(403);
        const body = await errorBody(res);
        expect(body.error?.code).toBe('LIMIT_REACHED');
        // If the experience route were wired to the gastronomy middleware — the
        // copy-paste this pair of near-identical routes invites — the message
        // would name gastronomies and every other assertion here would still
        // pass. This is the one that catches it.
        expect(body.error?.message).toContain('experiencias');
        expect(body.error?.message).not.toContain('gastronomías');
    });

    it('caps an owner with NO accommodation subscription at all (AC-31)', async () => {
        // Every test in this file runs as such an owner — no billing customer,
        // no subscription of any domain. This one says so out loud, because it
        // is the case the accommodation entitlement loader fails OPEN on
        // (`loadEntitlements` filters to product_domain='accommodation', so a
        // commerce route inherits an accommodation limit set that never carries
        // `max_gastronomies`, and an absent key reads as unlimited).
        stubCount(GastronomyService, 1);

        const res = await app.request(GASTRONOMY_PATH, {
            method: 'POST',
            headers: ownerHeaders,
            body: gastronomyBody
        });

        expect(res.status).toBe(403);
        const body = await errorBody(res);
        expect(body.error?.code).toBe('LIMIT_REACHED');
        // The cap this owner is held to comes from the gastronomy plan, not
        // from an accommodation plan they do not have.
        expect(body.error?.message).toContain('gastronomías');
    });

    it('refuses with 503 when the listing count cannot be resolved', async () => {
        // The divergence from `enforceAccommodationLimit`, which calls next() on
        // a count failure. This is the ONLY gate on the create path, so waving
        // the request through would hand out an uncapped listing silently.
        const failingCount = {
            data: undefined,
            error: { code: 'INTERNAL_ERROR', message: 'boom' }
        } as never;
        vi.spyOn(GastronomyService.prototype, 'count').mockResolvedValue(failingCount);

        const res = await app.request(GASTRONOMY_PATH, {
            method: 'POST',
            headers: ownerHeaders,
            body: gastronomyBody
        });

        expect(res.status).toBe(503);
    });

    describe('higher commerce tiers unlock more listings (HOS-975)', () => {
        afterEach(() => {
            // Scoped to this block: every test above assumes NO billing
            // customer at all (AC-31's premise), so a leaked fake subscription
            // here would silently change what those tests are proving.
            fakeTierCustomerId = null;
            fakeTierSubscriptions = [];
            fakeTierPlans = {};
            fakeTierProductDomains = {};
        });

        it('lets a gastronomy-pro owner reach their plan cap, one listing past where the básico cap (1) would already refuse', async () => {
            const cap = subscribeOwnerToTier({ vertical: 'gastronomy', plan: GASTRONOMY_PRO_PLAN });
            // gastronomy-basico caps at 1 (unchanged by HOS-975): a second
            // listing is exactly what the earlier `refuses a second gastronomy
            // listing` test in this file refuses. This owner is on a DIFFERENT
            // plan and must not be.
            expect(cap).toBeGreaterThan(
                capFromPlanDefinition(GASTRONOMY_BASICO_PLAN, LimitKey.MAX_GASTRONOMIES)
            );

            stubCount(GastronomyService, 1); // owner already holds 1 — creating the 2nd
            const second = await app.request(GASTRONOMY_PATH, {
                method: 'POST',
                headers: ownerHeaders,
                body: gastronomyBody
            });

            stubCount(GastronomyService, cap - 1); // owner already holds cap-1 — creating the LAST allowed one
            const last = await app.request(GASTRONOMY_PATH, {
                method: 'POST',
                headers: ownerHeaders,
                body: gastronomyBody
            });

            // Non-vacuity: neither request would pass if the pro plan's cap
            // were not actually the number reaching `userLimits` through the
            // real subscription-resolution branch.
            expect(second.status).not.toBe(403);
            expect(last.status).not.toBe(403);
        });

        it('refuses a gastronomy-pro owner past their plan cap with 403 LIMIT_REACHED naming that cap', async () => {
            const cap = subscribeOwnerToTier({ vertical: 'gastronomy', plan: GASTRONOMY_PRO_PLAN });
            stubCount(GastronomyService, cap);

            const res = await app.request(GASTRONOMY_PATH, {
                method: 'POST',
                headers: ownerHeaders,
                body: gastronomyBody
            });

            expect(res.status).toBe(403);
            const body = await errorBody(res);
            expect(body.error?.code).toBe('LIMIT_REACHED');
            expect(body.error?.message).toContain('gastronomías');
            expect(body.error?.message).toContain(String(cap));
        });

        it('lets a gastronomy-premium owner create a listing past the pro cap, up to their own (higher) cap', async () => {
            const proCap = capFromPlanDefinition(GASTRONOMY_PRO_PLAN, LimitKey.MAX_GASTRONOMIES);
            const cap = subscribeOwnerToTier({
                vertical: 'gastronomy',
                plan: GASTRONOMY_PREMIUM_PLAN
            });
            expect(cap).toBeGreaterThan(proCap);

            stubCount(GastronomyService, proCap); // one PAST what the pro plan allows
            const pastProCap = await app.request(GASTRONOMY_PATH, {
                method: 'POST',
                headers: ownerHeaders,
                body: gastronomyBody
            });

            stubCount(GastronomyService, cap - 1); // owner's own last allowed slot
            const last = await app.request(GASTRONOMY_PATH, {
                method: 'POST',
                headers: ownerHeaders,
                body: gastronomyBody
            });

            expect(pastProCap.status).not.toBe(403);
            expect(last.status).not.toBe(403);
        });

        it('refuses a gastronomy-premium owner past their plan cap with 403 LIMIT_REACHED naming that cap', async () => {
            const cap = subscribeOwnerToTier({
                vertical: 'gastronomy',
                plan: GASTRONOMY_PREMIUM_PLAN
            });
            stubCount(GastronomyService, cap);

            const res = await app.request(GASTRONOMY_PATH, {
                method: 'POST',
                headers: ownerHeaders,
                body: gastronomyBody
            });

            expect(res.status).toBe(403);
            const body = await errorBody(res);
            expect(body.error?.code).toBe('LIMIT_REACHED');
            expect(body.error?.message).toContain('gastronomías');
            expect(body.error?.message).toContain(String(cap));
        });

        it('lets an experience-pro owner reach their plan cap, past where the básico cap (1) would already refuse', async () => {
            const cap = subscribeOwnerToTier({ vertical: 'experience', plan: EXPERIENCE_PRO_PLAN });
            expect(cap).toBeGreaterThan(
                capFromPlanDefinition(EXPERIENCE_BASICO_PLAN, LimitKey.MAX_EXPERIENCES)
            );

            stubCount(ExperienceService, 1); // owner already holds 1 — creating the 2nd
            const second = await app.request(EXPERIENCE_PATH, {
                method: 'POST',
                headers: ownerHeaders,
                body: experienceBody
            });

            stubCount(ExperienceService, cap - 1); // owner's last allowed slot
            const last = await app.request(EXPERIENCE_PATH, {
                method: 'POST',
                headers: ownerHeaders,
                body: experienceBody
            });

            expect(second.status).not.toBe(403);
            expect(last.status).not.toBe(403);
        });

        it('refuses an experience-pro owner past their plan cap with 403 LIMIT_REACHED naming that cap', async () => {
            const cap = subscribeOwnerToTier({ vertical: 'experience', plan: EXPERIENCE_PRO_PLAN });
            stubCount(ExperienceService, cap);

            const res = await app.request(EXPERIENCE_PATH, {
                method: 'POST',
                headers: ownerHeaders,
                body: experienceBody
            });

            expect(res.status).toBe(403);
            const body = await errorBody(res);
            expect(body.error?.code).toBe('LIMIT_REACHED');
            expect(body.error?.message).toContain('experiencias');
            expect(body.error?.message).toContain(String(cap));
        });

        it('lets an experience-premium owner create a listing past the pro cap, up to their own (higher) cap', async () => {
            const proCap = capFromPlanDefinition(EXPERIENCE_PRO_PLAN, LimitKey.MAX_EXPERIENCES);
            const cap = subscribeOwnerToTier({
                vertical: 'experience',
                plan: EXPERIENCE_PREMIUM_PLAN
            });
            expect(cap).toBeGreaterThan(proCap);

            stubCount(ExperienceService, proCap); // one PAST what the pro plan allows
            const pastProCap = await app.request(EXPERIENCE_PATH, {
                method: 'POST',
                headers: ownerHeaders,
                body: experienceBody
            });

            stubCount(ExperienceService, cap - 1); // owner's own last allowed slot
            const last = await app.request(EXPERIENCE_PATH, {
                method: 'POST',
                headers: ownerHeaders,
                body: experienceBody
            });

            expect(pastProCap.status).not.toBe(403);
            expect(last.status).not.toBe(403);
        });

        it('refuses an experience-premium owner past their plan cap with 403 LIMIT_REACHED naming that cap', async () => {
            const cap = subscribeOwnerToTier({
                vertical: 'experience',
                plan: EXPERIENCE_PREMIUM_PLAN
            });
            stubCount(ExperienceService, cap);

            const res = await app.request(EXPERIENCE_PATH, {
                method: 'POST',
                headers: ownerHeaders,
                body: experienceBody
            });

            expect(res.status).toBe(403);
            const body = await errorBody(res);
            expect(body.error?.code).toBe('LIMIT_REACHED');
            expect(body.error?.message).toContain('experiencias');
            expect(body.error?.message).toContain(String(cap));
        });
    });
});
