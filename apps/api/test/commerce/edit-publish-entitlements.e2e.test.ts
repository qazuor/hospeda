/**
 * The four commerce entitlement gates, asserted END-TO-END (HOS-1074).
 *
 * ---
 * WHY THIS FILE IS A REQUEST TEST AND NOT A UNIT TEST
 *
 * HOS-973 R-2 is explicit, and it is the acceptance criterion of HOS-1074: the
 * limit/entitlement engine resolves an unknown key permissively across five
 * layers and raises nothing, so *"the four keys are asserted end to end against
 * the real route — never with `checkLimit` and a hand-built context, which is
 * always green"*.
 *
 * That is not pedantry here either. Before HOS-1074 the two commerce patch
 * routes ran NO entitlement middleware at all and the create route ran only the
 * limit half — so a helper-level test would have passed just as happily against
 * routes with no gate on them. Everything below goes through `app.request()`.
 *
 * ## The two sides, and why they live in two files
 *
 * This file is the ALLOW side: a commerce owner reaches all four routes without
 * meeting `ENTITLEMENT_REQUIRED`. It fails if
 * `commerceVerticalEntitlementMiddleware` is dropped from a route or mounted
 * AFTER its gate — in either case the gate reads the ACCOMMODATION set, which
 * never carries a commerce key, and refuses everyone.
 *
 * The BLOCK side is `edit-publish-entitlements-block.e2e.test.ts`, which
 * narrows the vertical's granted keys to nothing and asserts all four routes
 * answer 403. It fails if a `requireEntitlement(...)` is dropped. `vi.mock` is
 * file-scoped and hoisted, which is why the two cannot share a file.
 *
 * Neither half is sufficient alone: the allow test passes on a route with no
 * gate whatsoever, and the block test passes on a route that refuses everybody.
 *
 * ## What is stubbed, and what is left real
 *
 * Only the LISTING COUNT (so the create route's limit check, which runs AFTER
 * the gate, does not decide the outcome) and the service `updateOwn` calls the
 * patch handlers make. Everything else runs: the route factory, auth, the
 * global `entitlementMiddleware`, `commerceVerticalEntitlementMiddleware`,
 * `requireEntitlement`, and the ServiceError → HTTP mapping.
 *
 * The actor deliberately has **no billing customer and no subscription of any
 * kind** — the normal state of a commerce owner mid-funnel, who creates a
 * PRIVATE/DRAFT listing and fills it in BEFORE paying. That case is the whole
 * reason the entitlement floor is read from config rather than from the
 * subscription: gating it on a live subscription would mean nobody could ever
 * reach the checkout.
 *
 * @module test/commerce/edit-publish-entitlements.e2e
 */

import { ExperienceService, GastronomyService } from '@repo/service-core';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { initApp } from '../../src/app.js';
import { _resetCommerceBaseLimitCache } from '../../src/middlewares/commerce-entitlement.js';
import type { AppOpenAPI } from '../../src/types.js';

const USER_AGENT = { 'user-agent': 'vitest' };
const OWNER_ID = '11111111-1111-4111-8111-111111111111';
const LISTING_ID = '22222222-2222-4222-8222-222222222222';

const GASTRONOMY_CREATE_PATH = '/api/v1/protected/commerce/listings/gastronomy';
const EXPERIENCE_CREATE_PATH = '/api/v1/protected/commerce/listings/experience';
const GASTRONOMY_PATCH_PATH = `/api/v1/protected/gastronomies/${LISTING_ID}`;
const EXPERIENCE_PATCH_PATH = `/api/v1/protected/experiences/${LISTING_ID}`;

/** A commerce owner with the create permission and nothing else. */
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

/** A minimal, schema-valid owner PATCH payload. */
const patchBody = JSON.stringify({ summary: 'An updated riverside summary for the listing.' });

/**
 * Asserts a request got PAST the entitlement gate.
 *
 * The `not.toBe(403)` half alone is vacuous, and this file has the receipts:
 * an invalid mock-permission string answered 400 on all four routes and every
 * negative assertion here was green against requests that never reached a gate
 * at all. A 500 from anything downstream satisfies it just as happily.
 *
 * So the load-bearing assertion is the SPY, and each case picks a spy on the
 * first observable thing that runs strictly AFTER its route's gate:
 *
 * - the create routes → `count()`, called by `enforceGastronomyLimit()` /
 *   `enforceExperienceLimit()`, which are mounted after the gate. (Not
 *   `createForOwner`: the handler re-parses the payload through the FULL admin
 *   create schema before calling it, so a minimal body dies there — past the
 *   gate, but short of the service.)
 * - the patch routes → `updateOwn()`, the handler's only service call.
 *
 * `requireEntitlement` throws before `next()`, so any of these having been
 * called is proof by construction that the gate let the request through. The
 * companion block file asserts the mirror image: with the vertical granting
 * nothing, `count()` is never called at all.
 *
 * @param input.res - The response to inspect.
 * @param input.pastGateSpy - Spy on a call that can only happen after the gate.
 */
async function expectGateWasPassed(input: {
    res: Response;
    pastGateSpy: { mock: { calls: readonly unknown[] } };
}): Promise<void> {
    const body = (await input.res.json().catch(() => ({}))) as { error?: { code?: string } };
    expect(body.error?.code).not.toBe('ENTITLEMENT_REQUIRED');
    expect(input.res.status).not.toBe(403);
    expect(input.pastGateSpy.mock.calls.length).toBeGreaterThan(0);
}

/** A `Result`-shaped failure, so a stubbed service call returns cleanly. */
const NOT_FOUND_RESULT = {
    data: undefined,
    error: { code: 'NOT_FOUND', message: 'listing not found' }
} as never;

describe('commerce edit/publish entitlement gates — allow side (HOS-1074)', () => {
    let app: AppOpenAPI;

    beforeAll(() => {
        app = initApp();
    });

    afterEach(() => {
        vi.restoreAllMocks();
        _resetCommerceBaseLimitCache();
    });

    /**
     * Stubs a vertical's listing count at zero and returns the spy.
     *
     * Zero on purpose: the limit check runs after the gate, so a full cap would
     * let a `LIMIT_REACHED` 403 stand in for the gate's own refusal and make
     * the negative assertions meaningless.
     *
     * @param service - The vertical's service class.
     * @returns The `count` spy, which is the post-gate witness.
     */
    function stubCountAtZero(service: typeof GastronomyService | typeof ExperienceService) {
        const zero = { data: { count: 0 }, error: undefined } as never;
        return vi.spyOn(service.prototype, 'count').mockResolvedValue(zero);
    }

    it('lets a commerce owner with no subscription past the gastronomy create gate', async () => {
        const spy = stubCountAtZero(GastronomyService);

        const res = await app.request(GASTRONOMY_CREATE_PATH, {
            method: 'POST',
            headers: ownerHeaders,
            body: gastronomyBody
        });

        await expectGateWasPassed({ res, pastGateSpy: spy });
    });

    it('lets a commerce owner with no subscription past the experience create gate', async () => {
        const spy = stubCountAtZero(ExperienceService);

        const res = await app.request(EXPERIENCE_CREATE_PATH, {
            method: 'POST',
            headers: ownerHeaders,
            body: experienceBody
        });

        await expectGateWasPassed({ res, pastGateSpy: spy });
    });

    it('lets a commerce owner reach the gastronomy owner PATCH handler', async () => {
        const spy = vi
            .spyOn(GastronomyService.prototype, 'updateOwn')
            .mockResolvedValue(NOT_FOUND_RESULT);

        const res = await app.request(GASTRONOMY_PATCH_PATH, {
            method: 'PATCH',
            headers: ownerHeaders,
            body: patchBody
        });

        await expectGateWasPassed({ res, pastGateSpy: spy });
    });

    it('lets a commerce owner reach the experience owner PATCH handler', async () => {
        const spy = vi
            .spyOn(ExperienceService.prototype, 'updateOwn')
            .mockResolvedValue(NOT_FOUND_RESULT);

        const res = await app.request(EXPERIENCE_PATCH_PATH, {
            method: 'PATCH',
            headers: ownerHeaders,
            body: patchBody
        });

        await expectGateWasPassed({ res, pastGateSpy: spy });
    });
});
