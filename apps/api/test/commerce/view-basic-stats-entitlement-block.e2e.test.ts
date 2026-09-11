/**
 * The gastronomy/experience basic-view-stats entitlement gate — BLOCK side,
 * end to end (HOS-734).
 *
 * ---
 * WHY THIS MOCK, AND WHAT IT PROVES
 *
 * `VIEW_BASIC_STATS` is normally in `ENTITLEMENT_KEYS_BY_COMMERCE_VERTICAL`
 * (the floor every tier gets), so there is no REAL scenario in which a
 * commerce owner is refused it — that is the whole point of HOS-734 putting
 * it in the floor rather than on a single plan row. Proving the refusal path
 * still exists (rather than `requireEntitlement` having been silently dropped
 * from these routes, which would make the companion allow-side test pass for
 * the wrong reason) requires mocking the catalogue down to a set that does
 * NOT include the key — the mirror image of what
 * `brochure-entitlement-allow.e2e.test.ts` does to prove the ALLOW path (it
 * widens the map; this narrows it).
 *
 * ## The witness
 *
 * `expect(res.status).toBe(403)` is not enough on its own — a request that
 * dies anywhere before the gate can also fail to reach the handler. Each case
 * asserts BOTH that the refusal NAMES `view_basic_stats` (pinning the right
 * key to the right route) and that the handler's service method — strictly
 * after the gate — was never called.
 *
 * @module test/commerce/view-basic-stats-entitlement-block.e2e
 */

import { entityViewService } from '@repo/service-core';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('@repo/billing', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@repo/billing')>();
    return {
        ...actual,
        // What a caller's resolved floor looks like WITHOUT view_basic_stats —
        // every other vertical-wide key stays, so this narrows exactly one key.
        ENTITLEMENT_KEYS_BY_COMMERCE_VERTICAL: {
            gastronomy: [
                actual.EntitlementKey.EDIT_GASTRONOMY_INFO,
                actual.EntitlementKey.PUBLISH_GASTRONOMY
            ],
            experience: [
                actual.EntitlementKey.EDIT_EXPERIENCE_INFO,
                actual.EntitlementKey.PUBLISH_EXPERIENCE
            ]
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

const ownerHeaders = {
    ...USER_AGENT,
    'x-mock-actor-id': OWNER_ID,
    'x-mock-actor-role': 'COMMERCE_OWNER',
    'x-mock-actor-permissions': JSON.stringify(['commerce.create', 'commerce.editOwn'])
};

const CASES = [
    {
        label: 'gastronomy view stats',
        path: '/api/v1/protected/gastronomies/mine/views',
        method: 'getStatsForOwnCommerceListings' as const
    },
    {
        label: 'experience view stats',
        path: '/api/v1/protected/experiences/mine/views',
        method: 'getStatsForOwnCommerceListings' as const
    },
    {
        label: 'gastronomy view daily series',
        path: '/api/v1/protected/gastronomies/mine/views/daily-series',
        method: 'getDailySeriesForOwnCommerceListings' as const
    },
    {
        label: 'experience view daily series',
        path: '/api/v1/protected/experiences/mine/views/daily-series',
        method: 'getDailySeriesForOwnCommerceListings' as const
    }
] as const;

describe('commerce basic-stats entitlement gate — block side (HOS-734, mocked floor)', () => {
    let app: AppOpenAPI;

    beforeAll(() => {
        app = initApp();
    });

    afterEach(() => {
        vi.restoreAllMocks();
        _resetCommerceBaseLimitCache();
    });

    for (const testCase of CASES) {
        it(`refuses ${testCase.label} when the vertical's floor does not grant view_basic_stats`, async () => {
            const witness = vi.spyOn(entityViewService, testCase.method);

            const res = await app.request(testCase.path, { headers: ownerHeaders });
            const body = (await res.json()) as { error?: { code?: string; message?: string } };

            expect(res.status).toBe(403);
            expect(body.error?.code).toBe('ENTITLEMENT_REQUIRED');
            expect(body.error?.message).toContain('view_basic_stats');
            expect(witness).not.toHaveBeenCalled();
        });
    }
});
