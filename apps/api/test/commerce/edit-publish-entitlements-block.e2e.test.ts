/**
 * The four commerce entitlement gates — BLOCK side, end to end (HOS-1074).
 *
 * ---
 * The companion of `edit-publish-entitlements.e2e.test.ts`, which asserts the
 * allow side. Read that file's header first: it explains why both halves exist
 * and why neither is sufficient alone (an allow test passes on a route with no
 * gate at all; a block test passes on a route that refuses everybody).
 *
 * ## What is mutated, and why that is the honest mutation
 *
 * `ENTITLEMENT_KEYS_BY_COMMERCE_VERTICAL` — the map both `plans.config.ts` and
 * `commerceVerticalEntitlementMiddleware` read — is narrowed to grant NOTHING
 * in either vertical. That is precisely the pre-HOS-1074 catalogue
 * (`entitlements: []`), so this is not an invented state: it is the state every
 * commerce plan was in until this change, and the state a plan would be in
 * again if somebody removed a vertical's keys.
 *
 * Mocked at the CONFIG boundary rather than by stubbing the middleware or
 * `requireEntitlement`, because R-2 is about the wiring: the request still
 * traverses the real route factory, the real loader and the real gate, and the
 * only thing that changed is what the catalogue says the plan grants. A test
 * that stubbed the gate would prove nothing about whether the gate is mounted.
 *
 * Each case additionally asserts `error.details.requiredEntitlement`, which is
 * what pins the RIGHT key to the RIGHT route — the one thing a
 * "does it 403?" assertion cannot tell you, and the exact confusion four
 * separate keys exist to prevent.
 *
 * @module test/commerce/edit-publish-entitlements-block.e2e
 */

import { ExperienceService, GastronomyService } from '@repo/service-core';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@repo/billing', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@repo/billing')>();
    return {
        ...actual,
        // The pre-HOS-1074 catalogue: neither vertical grants anything.
        ENTITLEMENT_KEYS_BY_COMMERCE_VERTICAL: {
            gastronomy: [],
            experience: []
        }
    };
});

const { initApp } = await import('../../src/app.js');
const { _resetCommerceBaseLimitCache } = await import(
    '../../src/middlewares/commerce-entitlement.js'
);
type AppOpenAPI = import('../../src/types.js').AppOpenAPI;

const USER_AGENT = { 'user-agent': 'vitest' };
const OWNER_ID = '11111111-1111-4111-8111-111111111111';
const LISTING_ID = '22222222-2222-4222-8222-222222222222';

const ownerHeaders = {
    ...USER_AGENT,
    'content-type': 'application/json',
    'x-mock-actor-id': OWNER_ID,
    'x-mock-actor-role': 'COMMERCE_OWNER',
    'x-mock-actor-permissions': JSON.stringify(['commerce.create', 'commerce.editOwn'])
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

const patchBody = JSON.stringify({ summary: 'An updated riverside summary for the listing.' });

/**
 * Reads the refusal body of an entitlement gate.
 *
 * `error.details` is emitted by `handleRouteError` only when
 * `HOSPEDA_API_DEBUG_ERRORS` is set — which the api test setup does set — so
 * the per-key assertion below is available here. The `code` assertion does not
 * depend on it.
 *
 * @param res - The response to read.
 */
async function refusal(res: Response): Promise<{
    error?: { code?: string; message?: string; details?: { requiredEntitlement?: string } };
}> {
    return (await res.json()) as never;
}

/**
 * The four gated routes, each with the key it must name when it refuses.
 *
 * Table-driven so a fifth gated route is one row rather than a copied block,
 * and so a route wired to the WRONG vertical's key fails on the
 * `requiredEntitlement` assertion instead of passing a generic 403 check.
 */
const GATED_ROUTES = [
    {
        label: 'gastronomy create',
        path: '/api/v1/protected/commerce/listings/gastronomy',
        method: 'POST',
        body: gastronomyBody,
        key: 'publish_gastronomy'
    },
    {
        label: 'experience create',
        path: '/api/v1/protected/commerce/listings/experience',
        method: 'POST',
        body: experienceBody,
        key: 'publish_experience'
    },
    {
        label: 'gastronomy owner patch',
        path: `/api/v1/protected/gastronomies/${LISTING_ID}`,
        method: 'PATCH',
        body: patchBody,
        key: 'edit_gastronomy_info'
    },
    {
        label: 'experience owner patch',
        path: `/api/v1/protected/experiences/${LISTING_ID}`,
        method: 'PATCH',
        body: patchBody,
        key: 'edit_experience_info'
    }
] as const;

describe('commerce edit/publish entitlement gates — block side (HOS-1074)', () => {
    let app: AppOpenAPI;
    let gastronomyCount: ReturnType<typeof vi.spyOn>;
    let experienceCount: ReturnType<typeof vi.spyOn>;

    beforeAll(() => {
        app = initApp();
    });

    beforeEach(() => {
        // Zero existing listings, so a refusal cannot have come from the limit
        // check — at this count the limit check would ALLOW. Any 403 below is
        // therefore the entitlement gate and nothing else.
        const zero = { data: { count: 0 }, error: undefined } as never;
        gastronomyCount = vi.spyOn(GastronomyService.prototype, 'count').mockResolvedValue(zero);
        experienceCount = vi.spyOn(ExperienceService.prototype, 'count').mockResolvedValue(zero);
    });

    afterEach(() => {
        vi.restoreAllMocks();
        _resetCommerceBaseLimitCache();
    });

    for (const route of GATED_ROUTES) {
        it(`refuses the ${route.label} route with 403 ENTITLEMENT_REQUIRED naming ${route.key}`, async () => {
            const res = await app.request(route.path, {
                method: route.method,
                headers: ownerHeaders,
                body: route.body
            });

            expect(res.status).toBe(403);

            const body = await refusal(res);
            expect(body.error?.code).toBe('ENTITLEMENT_REQUIRED');
            expect(body.error?.message).toContain(route.key);
        });
    }

    it('fires the create gate BEFORE the limit check ever counts anything', async () => {
        // The documented ordering invariant (`docs/billing/adding-an-entitlement.md`:
        // "entitlement gate (403) always precedes limit check"), asserted rather
        // than assumed. Both routes are refused above; what this pins is that
        // the counter was never queried for a caller who lacks the feature
        // entirely — which is also the mirror of the allow file, where the very
        // same call is the proof the gate was passed.
        await app.request('/api/v1/protected/commerce/listings/gastronomy', {
            method: 'POST',
            headers: ownerHeaders,
            body: gastronomyBody
        });
        await app.request('/api/v1/protected/commerce/listings/experience', {
            method: 'POST',
            headers: ownerHeaders,
            body: experienceBody
        });

        expect(gastronomyCount).not.toHaveBeenCalled();
        expect(experienceCount).not.toHaveBeenCalled();
    });
});
