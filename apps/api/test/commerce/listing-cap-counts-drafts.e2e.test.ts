/**
 * The commerce listing cap counts the listings that actually exist (HOS-1247).
 *
 * ---
 * WHY THIS FILE EXISTS NEXT TO `listing-cap.e2e.test.ts`
 *
 * That suite proves the cap GATE is wired: it stubs `count()` and asserts the
 * middleware refuses at the right number. It was green for the whole period in
 * which the cap did not exist in production — because the number it stubs is the
 * number the real system could never produce.
 *
 * Measured on staging (2026-09-08, SHA `4dbfb9ae4`): an account holding one
 * gastronomy listing on `gastronomy-basico` (`max_gastronomies: 1`) created two
 * more through this exact route. Both answered **201**. No `X-Usage-Warning`
 * header, no `commerce listing limit reached` log line — the gate ran and
 * correctly allowed a request whose count was zero.
 *
 * The count was zero because `GastronomyService._executeCount` mirrors the
 * PUBLIC search and forces `visibility: PUBLIC` + `lifecycleState: ACTIVE`,
 * while every owner-created listing starts `PRIVATE`/`DRAFT`
 * (`commerce/protected/create.ts` D-3). So `count(actor, { ownerId })` reported
 * zero for precisely the rows the cap exists to count. Accommodation was never
 * exposed: its `_executeCount` drops `activeOnly` when
 * `params.ownerId === actor.id` (`accommodation.service.ts`).
 *
 * ## The shape of every test below
 *
 * Both counts are stubbed on the same request, to DIFFERENT numbers:
 *
 * - `count()` → what the public count really answers for a draft: **0**;
 * - `countOwn()` → the truth: how many listings the owner holds.
 *
 * A route reading the wrong one therefore cannot pass by coincidence. Reverting
 * `countOwnListings` to `service.count(...)` turns test 1 from 403 into 201,
 * which is the production symptom exactly.
 *
 * Everything else runs for real: the route factory, auth, the billing customer
 * lookup, `commerceVerticalEntitlementMiddleware` (subscription hydration,
 * domain matching, plan-limit resolution), `requireEntitlement`,
 * `enforceGastronomyLimit`/`enforceExperienceLimit`, `checkLimit` and the
 * ServiceError → HTTP mapping.
 *
 * @module test/commerce/listing-cap-counts-drafts.e2e
 */

import { LimitKey } from '@repo/billing';
import { getDb } from '@repo/db';
import { ExperienceService, GastronomyService } from '@repo/service-core';
import type { MiddlewareHandler } from 'hono';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { initApp } from '../../src/app.js';
import { _resetCommerceBaseLimitCache } from '../../src/middlewares/commerce-entitlement.js';
import type { AppOpenAPI } from '../../src/types.js';

/**
 * Fake billing provider — same seam and same reason as `listing-cap.e2e.test.ts`:
 * the suite's global `@repo/db` mock does not stub `createBillingAdapter`, so the
 * real `billingMiddleware` would leave `billingEnabled: false` and no
 * subscription data would ever be reached. Everything these two overrides gate
 * stays real.
 */
let fakeCustomerId: string | null = null;
let fakeSubscriptions: Array<Record<string, unknown>> = [];
let fakePlans: Record<string, { limits: Record<string, number> }> = {};
let fakeProductDomains: Record<string, string | null> = {};

vi.mock('../../src/middlewares/billing.js', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../../src/middlewares/billing.js')>();
    const fakeBillingMiddleware: MiddlewareHandler = async (c, next) => {
        c.set('billingEnabled', true);
        await next();
    };
    return {
        ...actual,
        billingMiddleware: fakeBillingMiddleware,
        getQZPayBilling: () => ({
            customers: {
                getByExternalId: async () => (fakeCustomerId ? { id: fakeCustomerId } : null)
            },
            subscriptions: { getByCustomerId: async () => fakeSubscriptions },
            plans: { get: async (id: string) => fakePlans[id] ?? null },
            limits: { getByCustomerId: async () => [] }
        })
    };
});

const OWNER_ID = '22222222-2222-4222-8222-222222222222';
const GASTRONOMY_PATH = '/api/v1/protected/commerce/listings/gastronomy';
const EXPERIENCE_PATH = '/api/v1/protected/commerce/listings/experience';

const ownerHeaders = {
    'user-agent': 'vitest',
    'content-type': 'application/json',
    'x-mock-actor-id': OWNER_ID,
    'x-mock-actor-role': 'COMMERCE_OWNER',
    'x-mock-actor-permissions': JSON.stringify(['commerce.create'])
};

const gastronomyBody = JSON.stringify({
    name: 'La Parrilla del Puerto',
    summary: 'A riverside parrilla with fresh grilled fish and steak.',
    description: 'La Parrilla del Puerto has served the waterfront for over a decade.',
    type: 'RESTAURANT'
});

const experienceBody = JSON.stringify({
    name: 'Kayak tour on the Uruguay river',
    summary: 'A guided two-hour kayak tour along the riverside.',
    description: 'A guided kayak tour departing from the municipal pier every morning.',
    type: 'ADVENTURE',
    isPriceOnRequest: true
});

/**
 * Stubs BOTH listing counts for one vertical, to different numbers.
 *
 * @param service - The vertical's service class.
 * @param input.owned - What the owner really holds (answered by `countOwn`).
 * @param input.publiclyVisible - What the PUBLIC count answers; `0` for a fresh
 *   DRAFT/PRIVATE listing, which is what production actually returns and what
 *   made the cap invisible.
 */
function stubCounts(
    service: typeof GastronomyService | typeof ExperienceService,
    input: { owned: number; publiclyVisible?: number }
): void {
    const { owned, publiclyVisible = 0 } = input;
    vi.spyOn(service.prototype, 'countOwn').mockResolvedValue({
        data: { count: owned },
        error: undefined
    } as never);
    vi.spyOn(service.prototype, 'count').mockResolvedValue({
        data: { count: publiclyVisible },
        error: undefined
    } as never);
}

/**
 * Wires the owner to one live subscription per entry, so a test can put them on
 * a real vertical plan — or on two subscriptions at once (the dual-role owner).
 *
 * @param subs - One entry per subscription: its domain, plan id and that plan's
 *   declared limits.
 */
function subscribeOwner(
    subs: ReadonlyArray<{
        id: string;
        domain: string;
        planId: string;
        limits: Record<string, number>;
    }>
): void {
    fakeCustomerId = 'cus-owner-1247';
    fakeSubscriptions = subs.map((sub) => ({ id: sub.id, status: 'active', planId: sub.planId }));
    fakeProductDomains = Object.fromEntries(subs.map((sub) => [sub.id, sub.domain]));
    fakePlans = Object.fromEntries(subs.map((sub) => [sub.planId, { limits: sub.limits }]));

    // Answers `hydrateSubscriptionProductDomains`'s batched recovery SELECT.
    // Without it every subscription hydrates to `undefined` and
    // `subscriptionMatchesDomain` fails closed for every non-accommodation
    // domain — the tests would silently fall back to the base-cap branch.
    vi.mocked(getDb).mockReturnValue({
        select: vi.fn().mockReturnValue({
            from: vi.fn().mockReturnValue({
                where: vi.fn().mockResolvedValue(
                    Object.entries(fakeProductDomains).map(([id, productDomain]) => ({
                        id,
                        productDomain
                    }))
                )
            })
        })
    } as never);
}

/**
 * Reads the JSON error body.
 *
 * `details` IS asserted here, unlike in `listing-cap.e2e.test.ts`:
 * `LIMIT_REACHED` is a member of `PUBLIC_DETAILS_ERROR_CODES`
 * (`utils/response-helpers.ts`), so its details are emitted on every response
 * regardless of `HOSPEDA_API_DEBUG_ERRORS`. HOS-1247's acceptance criterion
 * names `details.limitKey` specifically, so it is checked rather than inferred
 * from the Spanish resource name in the message.
 */
async function errorBody(res: Response): Promise<{
    error?: {
        code?: string;
        message?: string;
        details?: { limitKey?: string; currentCount?: number; maxAllowed?: number };
    };
}> {
    return (await res.json()) as never;
}

describe('commerce listing cap — the count includes DRAFT/PRIVATE listings (HOS-1247)', () => {
    let app: AppOpenAPI;

    beforeAll(() => {
        app = initApp();
    });

    afterEach(() => {
        vi.restoreAllMocks();
        _resetCommerceBaseLimitCache();
        fakeCustomerId = null;
        fakeSubscriptions = [];
        fakePlans = {};
        fakeProductDomains = {};
    });

    it('refuses the 2nd gastronomy listing of an owner whose only listing is a DRAFT', async () => {
        // The measured account: one listing on a cap of one, and that listing is
        // invisible to the public count. This request answered 201 twice on
        // staging.
        stubCounts(GastronomyService, { owned: 1, publiclyVisible: 0 });

        const res = await app.request(GASTRONOMY_PATH, {
            method: 'POST',
            headers: ownerHeaders,
            body: gastronomyBody
        });

        expect(res.status).toBe(403);
        const body = await errorBody(res);
        expect(body.error?.code).toBe('LIMIT_REACHED');
        expect(body.error?.details?.limitKey).toBe(LimitKey.MAX_GASTRONOMIES);
        expect(body.error?.details?.currentCount).toBe(1);
        expect(body.error?.details?.maxAllowed).toBe(1);
    });

    it('still allows the FIRST gastronomy listing — the discriminating half of the pair', async () => {
        // Without this, "refuses everything that reaches it" would pass the test
        // above just as well.
        stubCounts(GastronomyService, { owned: 0, publiclyVisible: 0 });

        const res = await app.request(GASTRONOMY_PATH, {
            method: 'POST',
            headers: ownerHeaders,
            body: gastronomyBody
        });

        expect(res.status).not.toBe(403);
    });

    it('refuses the 2nd experience listing of an owner whose only listing is a DRAFT', async () => {
        // The same bug lived in the experience vertical, whose `_executeCount`
        // forces the same two columns. Fixing only gastronomy would have left it
        // uncapped, and every gastronomy assertion here would still be green.
        stubCounts(ExperienceService, { owned: 1, publiclyVisible: 0 });

        const res = await app.request(EXPERIENCE_PATH, {
            method: 'POST',
            headers: ownerHeaders,
            body: experienceBody
        });

        expect(res.status).toBe(403);
        const body = await errorBody(res);
        expect(body.error?.code).toBe('LIMIT_REACHED');
        expect(body.error?.details?.limitKey).toBe(LimitKey.MAX_EXPERIENCES);
    });

    it('allows the FIRST experience listing', async () => {
        stubCounts(ExperienceService, { owned: 0, publiclyVisible: 0 });

        const res = await app.request(EXPERIENCE_PATH, {
            method: 'POST',
            headers: ownerHeaders,
            body: experienceBody
        });

        expect(res.status).not.toBe(403);
    });

    it('refuses at a cap of ZERO even with no listing at all', async () => {
        // `0 < 0` is false, so a plan declaring zero must refuse — the third
        // measurement in HOS-1247, which answered 201. Asserted separately from
        // the at-cap case because it takes a DIFFERENT branch of `checkLimit`
        // (the `maxAllowed === 0` early return, not the `currentCount <
        // maxAllowed` comparison).
        subscribeOwner([
            {
                id: 'sub-gastro-zero',
                domain: 'gastronomy',
                planId: 'gastronomy-zero',
                limits: { [LimitKey.MAX_GASTRONOMIES]: 0 }
            }
        ]);
        stubCounts(GastronomyService, { owned: 0, publiclyVisible: 0 });

        const res = await app.request(GASTRONOMY_PATH, {
            method: 'POST',
            headers: ownerHeaders,
            body: gastronomyBody
        });

        expect(res.status).toBe(403);
        const body = await errorBody(res);
        expect(body.error?.code).toBe('LIMIT_REACHED');
        expect(body.error?.details?.limitKey).toBe(LimitKey.MAX_GASTRONOMIES);
        expect(body.error?.details?.maxAllowed).toBe(0);
    });

    describe('the dual-role owner: an accommodation subscription AND a gastronomy one', () => {
        /**
         * `commerce-gastronomy@local.test`'s shape, which HOS-1247 measured
         * resolving `max_gastronomies: 0` — the number an owner with NO
         * gastronomy plan would get — while its `gastronomy-basico` declared 1.
         *
         * The gastronomy plan here caps at 3 so the two possible wrong answers
         * are both visible: reading the ACCOMMODATION plan yields no
         * `max_gastronomies` key at all (which resolves to the vertical's base
         * cap of 1), and reading nothing at all yields the same 1. Either way
         * the "2 of 3" request below would be refused.
         */
        const DUAL_GASTRONOMY_CAP = 3;

        function subscribeDualOwner(): void {
            subscribeOwner([
                {
                    id: 'sub-accommodation',
                    domain: 'accommodation',
                    planId: 'owner-basico',
                    limits: { [LimitKey.MAX_ACCOMMODATIONS]: 1 }
                },
                {
                    id: 'sub-gastronomy',
                    domain: 'gastronomy',
                    planId: 'gastronomy-pro',
                    limits: { [LimitKey.MAX_GASTRONOMIES]: DUAL_GASTRONOMY_CAP }
                }
            ]);
        }

        it('resolves the GASTRONOMY plan cap, not the accommodation one', async () => {
            subscribeDualOwner();
            stubCounts(GastronomyService, {
                owned: DUAL_GASTRONOMY_CAP - 1,
                publiclyVisible: 0
            });

            const res = await app.request(GASTRONOMY_PATH, {
                method: 'POST',
                headers: ownerHeaders,
                body: gastronomyBody
            });

            expect(res.status).not.toBe(403);
        });

        it('still refuses that owner once their gastronomy cap is full', async () => {
            subscribeDualOwner();
            stubCounts(GastronomyService, { owned: DUAL_GASTRONOMY_CAP, publiclyVisible: 0 });

            const res = await app.request(GASTRONOMY_PATH, {
                method: 'POST',
                headers: ownerHeaders,
                body: gastronomyBody
            });

            expect(res.status).toBe(403);
            const body = await errorBody(res);
            expect(body.error?.code).toBe('LIMIT_REACHED');
            expect(body.error?.details?.limitKey).toBe(LimitKey.MAX_GASTRONOMIES);
            expect(body.error?.details?.maxAllowed).toBe(DUAL_GASTRONOMY_CAP);
        });
    });
});
