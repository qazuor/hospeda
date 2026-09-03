/**
 * The meeting-point directions gate — ALLOW side (HOS-1049).
 *
 * The mirror image of `experience-directions-entitlement.e2e.test.ts`. That one
 * passes on a route that refuses everybody; this one passes on a route with no
 * gate at all. Only the pair says the gate is real AND correctly keyed.
 *
 * The grant is simulated by widening `ENTITLEMENT_KEYS_BY_COMMERCE_VERTICAL`,
 * which is the floor `commerceVerticalEntitlementMiddleware` reads from CODE —
 * the same technique `menu-entitlement-allow.e2e.test.ts` and
 * `brochure-entitlement-allow.e2e.test.ts` use, and the only one that does not
 * need a live billing subscription. In production the key arrives by the OTHER
 * path, unioned on from the `experience-pro` plan row; both paths end at the
 * same resolved set, which is what this asserts against.
 *
 * @module test/commerce/experience-directions-entitlement-allow.e2e
 */

import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('@repo/billing', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@repo/billing')>();
    return {
        ...actual,
        // What an `experience-pro` subscriber's resolved set looks like: the
        // vertical's uniform trio plus the pro-only directions key. Gastronomy
        // is left untouched — a restaurant has an address and a door, and the
        // key is experience-only by design.
        ENTITLEMENT_KEYS_BY_COMMERCE_VERTICAL: {
            gastronomy: [
                actual.EntitlementKey.EDIT_GASTRONOMY_INFO,
                actual.EntitlementKey.PUBLISH_GASTRONOMY,
                actual.EntitlementKey.VIEW_BASIC_STATS
            ],
            experience: [
                actual.EntitlementKey.EDIT_EXPERIENCE_INFO,
                actual.EntitlementKey.PUBLISH_EXPERIENCE,
                actual.EntitlementKey.VIEW_BASIC_STATS,
                actual.EntitlementKey.MANAGE_EXPERIENCE_DIRECTIONS
            ]
        }
    };
});

const { initApp } = await import('../../src/app.js');
const { _resetCommerceBaseLimitCache } = await import(
    '../../src/middlewares/commerce-entitlement.js'
);
const { ExperienceService } = await import('@repo/service-core');
type AppOpenAPI = import('../../src/types.js').AppOpenAPI;

/** A `Result`-shaped failure, so a stubbed ownership check returns cleanly. */
const NOT_FOUND_RESULT = {
    data: undefined,
    error: { code: 'NOT_FOUND', message: 'listing not found' }
} as never;

const USER_AGENT = { 'user-agent': 'vitest' };
const OWNER_ID = '11111111-1111-4111-8111-111111111111';
const LISTING_ID = '22222222-2222-4222-8222-222222222222';

const PATCH_PATH = `/api/v1/protected/experiences/${LISTING_ID}`;

const ownerHeaders = {
    ...USER_AGENT,
    'content-type': 'application/json',
    'x-mock-actor-id': OWNER_ID,
    'x-mock-actor-role': 'COMMERCE_OWNER',
    'x-mock-actor-permissions': JSON.stringify(['commerce.create', 'commerce.editOwn'])
};

describe('experience directions entitlement gate — allow side (HOS-1049)', () => {
    let app: AppOpenAPI;

    beforeAll(() => {
        app = initApp();
    });

    afterEach(() => {
        vi.restoreAllMocks();
        _resetCommerceBaseLimitCache();
    });

    it('lets an entitled provider set meetingPointDirections through the PATCH handler', async () => {
        const witness = vi
            .spyOn(ExperienceService.prototype, 'updateOwn')
            .mockResolvedValue(NOT_FOUND_RESULT);

        const res = await app.request(PATCH_PATH, {
            method: 'PATCH',
            headers: ownerHeaders,
            body: JSON.stringify({
                meetingPointDirections: [
                    'Estacioná en la bajada municipal, sobre la costanera.',
                    'El colectivo 4 te deja en la rotonda; son 300 m por camino de ripio.'
                ]
            })
        });
        const body = (await res.json().catch(() => ({}))) as { error?: { code?: string } };

        expect(body.error?.code).not.toBe('ENTITLEMENT_REQUIRED');
        // The handler ran, so the field gate let the body through.
        expect(witness).toHaveBeenCalled();
    });

    it('forwards the instructions to the service verbatim', async () => {
        // Reaching the handler is not the same as the value surviving. A gate
        // that stripped the field instead of refusing it would satisfy the case
        // above and silently drop every provider's instructions.
        const directions = ['Bajás en la parada del muelle y caminás 200 m al norte.'];
        const witness = vi
            .spyOn(ExperienceService.prototype, 'updateOwn')
            .mockResolvedValue(NOT_FOUND_RESULT);

        await app.request(PATCH_PATH, {
            method: 'PATCH',
            headers: ownerHeaders,
            body: JSON.stringify({ meetingPointDirections: directions })
        });

        expect(witness).toHaveBeenCalledWith(
            LISTING_ID,
            expect.objectContaining({ meetingPointDirections: directions }),
            expect.anything()
        );
    });
});
