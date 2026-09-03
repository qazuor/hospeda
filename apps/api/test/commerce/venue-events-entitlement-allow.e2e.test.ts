/**
 * The venue-events gate — ALLOW side (HOS-1042).
 *
 * The mirror image of `venue-events-entitlement.e2e.test.ts`. That one passes on
 * a route that refuses everybody; this one passes on a route with no gate at
 * all. Only the pair says the gate is real AND correctly keyed.
 *
 * The grant is simulated by widening `ENTITLEMENT_KEYS_BY_COMMERCE_VERTICAL`,
 * which is the floor `commerceVerticalEntitlementMiddleware` reads from CODE —
 * the same technique `menu-entitlement-allow.e2e.test.ts` uses, and the only one
 * that does not need a live billing subscription. In production the key arrives
 * by the OTHER path, unioned on from the `gastronomy-pro` plan row; both paths
 * end at the same resolved set, which is what this asserts against.
 *
 * Note the mock grants the agenda key and NOT the carta key. That is deliberate:
 * an owner entitled to one commerce capability and not the other is a real
 * state, and a mock that handed out both would not notice a gate wired to the
 * wrong key.
 *
 * @module test/commerce/venue-events-entitlement-allow.e2e
 */

import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('@repo/billing', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@repo/billing')>();
    return {
        ...actual,
        // What a `gastronomy-pro` subscriber's resolved set looks like from the
        // agenda's point of view: the vertical's uniform pair plus the pro-only
        // events key. Experience is left untouched — an experience IS an event
        // with a date, and the key is gastronomy-only by design.
        ENTITLEMENT_KEYS_BY_COMMERCE_VERTICAL: {
            gastronomy: [
                actual.EntitlementKey.EDIT_GASTRONOMY_INFO,
                actual.EntitlementKey.PUBLISH_GASTRONOMY,
                actual.EntitlementKey.MANAGE_GASTRONOMY_EVENTS
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
const LISTING_ID = '22222222-2222-4222-8222-222222222222';

const EVENTS_PATH = `/api/v1/protected/gastronomies/${LISTING_ID}/events`;

const ownerHeaders = {
    ...USER_AGENT,
    'content-type': 'application/json',
    'x-mock-actor-id': OWNER_ID,
    'x-mock-actor-role': 'COMMERCE_OWNER',
    'x-mock-actor-permissions': JSON.stringify(['commerce.create', 'commerce.editOwn'])
};

describe('gastronomy venue events entitlement gate — allow side (HOS-1042)', () => {
    let app: AppOpenAPI;

    beforeAll(() => {
        app = initApp();
    });

    afterEach(() => {
        vi.restoreAllMocks();
        _resetCommerceBaseLimitCache();
    });

    it('lets an entitled owner reach the PUT /events handler', async () => {
        const res = await app.request(EVENTS_PATH, {
            method: 'PUT',
            headers: ownerHeaders,
            body: JSON.stringify({ events: [] })
        });
        const body = (await res.json().catch(() => ({}))) as {
            error?: { code?: string; message?: string };
        };

        expect(body.error?.code).not.toBe('ENTITLEMENT_REQUIRED');
        expect(res.status).not.toBe(403);

        // The witness, and it has to be this specific. `not.toBe(403)` alone is
        // vacuous — a request that dies before the gate satisfies it too. The
        // message below is produced in exactly ONE place, `requireGastronomy`
        // inside `replaceGastronomyEvents`, which runs strictly after
        // `requireEntitlement` has called `next()`. Seeing it is proof the
        // request reached the handler.
        //
        // (`@repo/db` is mocked whole in this app's setup, so the model's
        // `findById` answers `null` and the service reports NOT_FOUND — which
        // is the deepest an offline route test can reach here.)
        expect(body.error?.message).toContain('Gastronomy listing not found');
    });
});
