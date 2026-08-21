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

import { ExperienceService, GastronomyService } from '@repo/service-core';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { initApp } from '../../src/app.js';
import { _resetCommerceBaseLimitCache } from '../../src/middlewares/commerce-entitlement.js';
import type { AppOpenAPI } from '../../src/types.js';

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
});
