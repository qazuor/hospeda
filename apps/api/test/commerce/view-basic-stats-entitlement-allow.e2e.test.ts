/**
 * The gastronomy/experience basic-view-stats entitlement gate — ALLOW side,
 * end to end (HOS-734).
 *
 * ---
 * WHY THIS SIDE NEEDS NO MOCK AT ALL
 *
 * `VIEW_BASIC_STATS` IS in `ENTITLEMENT_KEYS_BY_COMMERCE_VERTICAL` — the floor
 * `commerceVerticalEntitlementMiddleware` reads from CODE for every tier of a
 * vertical at once (unlike `DOWNLOAD_LISTING_PDF`, which is premium-only and
 * lives on the plan ROW instead — see `brochure-entitlement.e2e.test.ts`'s
 * header for that contrast). So a commerce owner with no subscription at all
 * still gets the floor, and that is the normal state of most commerce owners.
 * That default-allow is exactly what silently breaks if
 * `commerceVerticalEntitlementMiddleware(vertical)` is ever dropped from one
 * of these four routes or mounted AFTER `requireEntitlement` — in either case
 * the gate reads whatever the GLOBAL `entitlementMiddleware` set (the
 * ACCOMMODATION domain), which never carries a commerce key, and refuses
 * everyone (HOS-1074).
 *
 * The companion `view-basic-stats-entitlement-block.e2e.test.ts` asserts the
 * mirror image (a floor that does NOT grant the key). Neither half is
 * sufficient alone: this one passes on a route with no gate at all, and the
 * block one passes on a route that refuses everybody.
 *
 * ## The witness
 *
 * `expect(res.status).not.toBe(403)` alone is not enough — a request that
 * dies anywhere before the gate also satisfies it. Each case additionally
 * asserts the service method downstream of the gate WAS called.
 *
 * @module test/commerce/view-basic-stats-entitlement-allow.e2e
 */

import { entityViewService } from '@repo/service-core';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { initApp } from '../../src/app.js';
import { _resetCommerceBaseLimitCache } from '../../src/middlewares/commerce-entitlement.js';
import type { AppOpenAPI } from '../../src/types.js';

const USER_AGENT = { 'user-agent': 'vitest' };
const OWNER_ID = '11111111-1111-4111-8111-111111111111';

/** A commerce owner with no subscription — the normal state of most owners. */
const ownerHeaders = {
    ...USER_AGENT,
    'x-mock-actor-id': OWNER_ID,
    'x-mock-actor-role': 'COMMERCE_OWNER',
    'x-mock-actor-permissions': JSON.stringify(['commerce.create', 'commerce.editOwn'])
};

const STATS_CASES = [
    {
        label: 'gastronomy view stats',
        path: '/api/v1/protected/gastronomies/mine/views'
    },
    {
        label: 'experience view stats',
        path: '/api/v1/protected/experiences/mine/views'
    }
] as const;

const DAILY_SERIES_CASES = [
    {
        label: 'gastronomy view daily series',
        path: '/api/v1/protected/gastronomies/mine/views/daily-series'
    },
    {
        label: 'experience view daily series',
        path: '/api/v1/protected/experiences/mine/views/daily-series'
    }
] as const;

describe('commerce basic-stats entitlement gate — allow side (HOS-734)', () => {
    let app: AppOpenAPI;

    beforeAll(() => {
        app = initApp();
    });

    afterEach(() => {
        vi.restoreAllMocks();
        _resetCommerceBaseLimitCache();
    });

    for (const testCase of STATS_CASES) {
        it(`lets an entitled owner with no subscription reach the ${testCase.label} handler`, async () => {
            const witness = vi
                .spyOn(entityViewService, 'getStatsForOwnCommerceListings')
                .mockResolvedValue({ data: [], error: undefined });

            const res = await app.request(testCase.path, { headers: ownerHeaders });
            const body = (await res.json().catch(() => ({}))) as { error?: { code?: string } };

            expect(body.error?.code).not.toBe('ENTITLEMENT_REQUIRED');
            expect(res.status).not.toBe(403);
            expect(witness).toHaveBeenCalledTimes(1);
        });
    }

    for (const testCase of DAILY_SERIES_CASES) {
        it(`lets an entitled owner with no subscription reach the ${testCase.label} handler`, async () => {
            const witness = vi
                .spyOn(entityViewService, 'getDailySeriesForOwnCommerceListings')
                .mockResolvedValue({ data: [], error: undefined });

            const res = await app.request(testCase.path, { headers: ownerHeaders });
            const body = (await res.json().catch(() => ({}))) as { error?: { code?: string } };

            expect(body.error?.code).not.toBe('ENTITLEMENT_REQUIRED');
            expect(res.status).not.toBe(403);
            expect(witness).toHaveBeenCalledTimes(1);
        });
    }
});
