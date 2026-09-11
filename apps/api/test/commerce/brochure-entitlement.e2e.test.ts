/**
 * The brochure gate — BLOCK side, end to end (HOS-1058).
 *
 * ---
 * WHY THE BLOCK SIDE NEEDS NO MOCK AT ALL, AND WHAT THAT PROVES
 *
 * `DOWNLOAD_LISTING_PDF` is the first commerce key that is NOT in
 * `ENTITLEMENT_KEYS_BY_COMMERCE_VERTICAL`. That map is the floor
 * `commerceVerticalEntitlementMiddleware` reads from CODE for every tier of a
 * vertical at once, and a premium-only capability cannot live there without
 * being handed to básico as well — so the grant comes from the premium plan
 * ROW, unioned onto the floor when the caller actually holds that plan.
 *
 * The consequence is that the default state of this test — a commerce owner
 * with no subscription — is a REFUSAL, and no mutation is needed to produce it.
 * That is the state of every commerce owner on the entry plan, which is exactly
 * the population that must not get the premium sheet.
 *
 * The companion `brochure-entitlement-allow.e2e.test.ts` asserts the mirror
 * image. Neither half is sufficient alone: this one passes on a route that
 * refuses everybody, and the allow one passes on a route with no gate at all.
 *
 * ## The witness
 *
 * `expect(res.status).toBe(403)` is not enough on its own — a request that dies
 * anywhere before the gate can also fail to reach the handler. So each case
 * asserts BOTH that the refusal NAMES `download_listing_pdf` (which pins the
 * right key to the right route, the one thing a bare "does it 403?" cannot
 * tell you) and that `getById` — the handler's first call, strictly after the
 * gate — was never made.
 *
 * The key is read off `error.message` rather than off `error.details`: the
 * middleware attaches both, but `details` only survives to the wire when
 * `HOSPEDA_API_DEBUG_ERRORS` is on, and this assertion must not depend on a
 * debug flag.
 *
 * @module test/commerce/brochure-entitlement.e2e
 */

import { ExperienceService, GastronomyService } from '@repo/service-core';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { initApp } from '../../src/app.js';
import { _resetCommerceBaseLimitCache } from '../../src/middlewares/commerce-entitlement.js';
import type { AppOpenAPI } from '../../src/types.js';

const USER_AGENT = { 'user-agent': 'vitest' };
const OWNER_ID = '11111111-1111-4111-8111-111111111111';
const LISTING_ID = '22222222-2222-4222-8222-222222222222';

/** A commerce owner on an entry plan: no premium grant anywhere. */
const ownerHeaders = {
    ...USER_AGENT,
    'x-mock-actor-id': OWNER_ID,
    'x-mock-actor-role': 'COMMERCE_OWNER',
    'x-mock-actor-permissions': JSON.stringify(['commerce.create', 'commerce.editOwn'])
};

const CASES = [
    {
        label: 'gastronomy brochure',
        path: `/api/v1/protected/gastronomies/${LISTING_ID}/brochure`,
        service: GastronomyService
    },
    {
        label: 'experience brochure',
        path: `/api/v1/protected/experiences/${LISTING_ID}/brochure`,
        service: ExperienceService
    }
] as const;

describe('commerce brochure entitlement gate — block side (HOS-1058)', () => {
    let app: AppOpenAPI;

    beforeAll(() => {
        app = initApp();
    });

    afterEach(() => {
        vi.restoreAllMocks();
        _resetCommerceBaseLimitCache();
    });

    for (const testCase of CASES) {
        it(`refuses the ${testCase.label} to an owner whose plan does not grant it`, async () => {
            const witness = vi.spyOn(testCase.service.prototype, 'getById');

            const res = await app.request(testCase.path, { headers: ownerHeaders });
            const body = (await res.json()) as {
                error?: { code?: string; message?: string };
            };

            expect(res.status).toBe(403);
            expect(body.error?.code).toBe('ENTITLEMENT_REQUIRED');
            expect(body.error?.message).toContain('download_listing_pdf');
            // The load-bearing half: the handler never ran, so the 403 came
            // from the gate rather than from anything downstream of it.
            expect(witness).not.toHaveBeenCalled();
        });
    }
});
