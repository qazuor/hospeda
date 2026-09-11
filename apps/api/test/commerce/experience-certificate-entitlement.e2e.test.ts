/**
 * The experience-certificate gate — BLOCK side, end to end (HOS-1057).
 *
 * ---
 * WHY THE BLOCK SIDE NEEDS NO MOCK AT ALL, AND WHAT THAT PROVES
 *
 * `ISSUE_EXPERIENCE_CERTIFICATE` is not in
 * `ENTITLEMENT_KEYS_BY_COMMERCE_VERTICAL`. That map is the floor
 * `commerceVerticalEntitlementMiddleware` reads from CODE for every tier of a
 * vertical at once, and a `-pro`-and-above capability cannot live there without
 * being handed to `experience-basico` — which is the only sellable experience
 * tier there is, i.e. to every paying experience owner. So the grant comes from
 * the plan ROW, unioned onto the floor when the caller actually holds that plan.
 *
 * The consequence is that the default state of this test — a commerce owner with
 * no subscription — is a REFUSAL, and no mutation is needed to produce it.
 *
 * The companion `experience-certificate-entitlement-allow.e2e.test.ts` asserts
 * the mirror image. Neither half is sufficient alone: this one passes on a route
 * that refuses everybody, and the allow one passes on a route with no gate.
 *
 * ## The witness
 *
 * `expect(res.status).toBe(403)` is not enough on its own — a request that dies
 * anywhere before the gate also fails to reach the handler. So each case asserts
 * BOTH that the refusal NAMES `issue_experience_certificate` (which pins the
 * right key to the right route) and that `ExperienceService.getById` — the
 * handler's first call, strictly after the gate — was never made.
 *
 * The key is read off `error.message` rather than `error.details`: the
 * middleware attaches both, but `details` only survives to the wire when
 * `HOSPEDA_API_DEBUG_ERRORS` is on, and this assertion must not depend on a
 * debug flag.
 *
 * @module test/commerce/experience-certificate-entitlement.e2e
 */

import { ExperienceService } from '@repo/service-core';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { initApp } from '../../src/app.js';
import { _resetCommerceBaseLimitCache } from '../../src/middlewares/commerce-entitlement.js';
import type { AppOpenAPI } from '../../src/types.js';

const USER_AGENT = { 'user-agent': 'vitest' };
const OWNER_ID = '11111111-1111-4111-8111-111111111111';
const LISTING_ID = '22222222-2222-4222-8222-222222222222';
const CERTIFICATE_ID = '33333333-3333-4333-8333-333333333333';

/** A commerce owner on the entry plan: no `-pro` grant anywhere. */
const ownerHeaders = {
    ...USER_AGENT,
    'x-mock-actor-id': OWNER_ID,
    'x-mock-actor-role': 'COMMERCE_OWNER',
    'x-mock-actor-permissions': JSON.stringify(['commerce.create', 'commerce.editOwn'])
};

const BASE = `/api/v1/protected/experiences/${LISTING_ID}/certificates`;

const CASES = [
    { label: 'issue', path: BASE, method: 'POST' as const },
    { label: 'list', path: BASE, method: 'GET' as const },
    { label: 'PDF download', path: `${BASE}/${CERTIFICATE_ID}/pdf`, method: 'GET' as const }
];

describe('experience certificate entitlement gate — block side (HOS-1057)', () => {
    let app: AppOpenAPI;

    beforeAll(() => {
        app = initApp();
    });

    afterEach(() => {
        vi.restoreAllMocks();
        _resetCommerceBaseLimitCache();
    });

    for (const testCase of CASES) {
        it(`refuses ${testCase.label} to an owner whose plan does not grant it`, async () => {
            const witness = vi.spyOn(ExperienceService.prototype, 'getById');

            const res = await app.request(testCase.path, {
                method: testCase.method,
                headers:
                    testCase.method === 'POST'
                        ? { ...ownerHeaders, 'Content-Type': 'application/json' }
                        : ownerHeaders,
                ...(testCase.method === 'POST'
                    ? {
                          body: JSON.stringify({
                              recipientName: 'Ana Pérez',
                              completedAt: '2026-03-14'
                          })
                      }
                    : {})
            });
            const body = (await res.json()) as { error?: { code?: string; message?: string } };

            expect(res.status).toBe(403);
            expect(body.error?.code).toBe('ENTITLEMENT_REQUIRED');
            expect(body.error?.message).toContain('issue_experience_certificate');
            // The load-bearing half: the handler never ran, so the 403 came from
            // the gate rather than from anything downstream of it.
            expect(witness).not.toHaveBeenCalled();
        });
    }
});
