/**
 * The structured-carta gate — ALLOW side (HOS-895).
 *
 * The mirror image of `menu-entitlement.e2e.test.ts`. That one passes on a
 * route that refuses everybody; this one passes on a route with no gate at all.
 * Only the pair says the gate is real AND correctly keyed.
 *
 * The grant is simulated by widening `ENTITLEMENT_KEYS_BY_COMMERCE_VERTICAL`,
 * which is the floor `commerceVerticalEntitlementMiddleware` reads from CODE —
 * the same technique `brochure-entitlement-allow.e2e.test.ts` uses, and the
 * only one that does not need a live billing subscription. In production the
 * key arrives by the OTHER path, unioned on from the `gastronomy-pro` plan row;
 * both paths end at the same resolved set, which is what this asserts against.
 *
 * ## POST / DELETE `menu-file` (HOS-895 PR2)
 *
 * The attachment gate was added AFTER PR1 shipped it ungated. Its allow-side
 * cases need the media provider mocked — `POST` reads it BEFORE the ownership
 * check the other two routes stop at, so without a stub `getMediaProvider()`
 * returns `null` (Cloudinary unconfigured in this test env) and the route
 * answers 503 regardless of whether the gate passed, which would make the 403
 * assertion trivially true for the wrong reason.
 *
 * @module test/commerce/menu-entitlement-allow.e2e
 */

import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

const mockUpload = vi.fn();
const mockDelete = vi.fn();

vi.mock('../../src/services/media', () => ({
    getMediaProvider: () => ({
        upload: mockUpload,
        delete: mockDelete
    })
}));

vi.mock('@repo/billing', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@repo/billing')>();
    return {
        ...actual,
        // What a `gastronomy-pro` subscriber's resolved set looks like: the
        // vertical's uniform pair plus the pro-only carta key. Experience is
        // left untouched — an experience has no menu, and the key is
        // gastronomy-only by design.
        ENTITLEMENT_KEYS_BY_COMMERCE_VERTICAL: {
            gastronomy: [
                actual.EntitlementKey.EDIT_GASTRONOMY_INFO,
                actual.EntitlementKey.PUBLISH_GASTRONOMY,
                actual.EntitlementKey.MANAGE_GASTRONOMY_MENU
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
const { GastronomyService } = await import('@repo/service-core');
type AppOpenAPI = import('../../src/types.js').AppOpenAPI;

/** A `Result`-shaped failure, so a stubbed ownership check returns cleanly. */
const NOT_FOUND_RESULT = {
    data: undefined,
    error: { code: 'NOT_FOUND', message: 'listing not found' }
} as never;

const USER_AGENT = { 'user-agent': 'vitest' };
const OWNER_ID = '11111111-1111-4111-8111-111111111111';
const LISTING_ID = '22222222-2222-4222-8222-222222222222';

const MENU_PATH = `/api/v1/protected/gastronomies/${LISTING_ID}/menu`;

const ownerHeaders = {
    ...USER_AGENT,
    'content-type': 'application/json',
    'x-mock-actor-id': OWNER_ID,
    'x-mock-actor-role': 'COMMERCE_OWNER',
    'x-mock-actor-permissions': JSON.stringify(['commerce.create', 'commerce.editOwn'])
};

describe('gastronomy menu entitlement gate — allow side (HOS-895)', () => {
    let app: AppOpenAPI;

    beforeAll(() => {
        app = initApp();
    });

    afterEach(() => {
        vi.restoreAllMocks();
        _resetCommerceBaseLimitCache();
    });

    it('lets an entitled owner reach the PUT /menu handler', async () => {
        const res = await app.request(MENU_PATH, {
            method: 'PUT',
            headers: ownerHeaders,
            body: JSON.stringify({ sections: [] })
        });
        const body = (await res.json().catch(() => ({}))) as {
            error?: { code?: string; message?: string };
        };

        expect(body.error?.code).not.toBe('ENTITLEMENT_REQUIRED');
        expect(res.status).not.toBe(403);

        // The witness, and it has to be this specific. `not.toBe(403)` alone is
        // vacuous — a request that dies before the gate satisfies it too. The
        // message below is produced in exactly ONE place, `requireGastronomy`
        // inside `replaceGastronomyMenu`, which runs strictly after
        // `requireEntitlement` has called `next()`. Seeing it is proof the
        // request reached the handler.
        //
        // (`@repo/db` is mocked whole in this app's setup, so the model's
        // `findById` answers `null` and the service reports NOT_FOUND — which
        // is the deepest an offline route test can reach here.)
        expect(body.error?.message).toContain('Gastronomy listing not found');
    });

    it('lets an entitled owner reach the POST /menu-file handler', async () => {
        // Witness: the upload route's ownership check, the first call strictly
        // AFTER both the rate limit and the entitlement gate. Mocked to
        // NOT_FOUND so the request stops there with a 404 rather than
        // attempting a real Cloudinary upload — the deepest an offline route
        // test can reach, same technique the PUT case above uses.
        const witness = vi
            .spyOn(GastronomyService.prototype, 'getById')
            .mockResolvedValue(NOT_FOUND_RESULT);

        const res = await app.request(`${MENU_PATH}-file`, {
            method: 'POST',
            headers: { ...ownerHeaders, 'content-type': 'multipart/form-data; boundary=x' },
            body: '--x--'
        });
        const body = (await res.json().catch(() => ({}))) as { error?: { code?: string } };

        expect(body.error?.code).not.toBe('ENTITLEMENT_REQUIRED');
        expect(res.status).not.toBe(403);
        expect(witness).toHaveBeenCalled();
    });

    it('lets an entitled owner reach the DELETE /menu-file handler', async () => {
        const witness = vi
            .spyOn(GastronomyService.prototype, 'getById')
            .mockResolvedValue(NOT_FOUND_RESULT);

        const res = await app.request(`${MENU_PATH}-file`, {
            method: 'DELETE',
            headers: ownerHeaders
        });
        const body = (await res.json().catch(() => ({}))) as { error?: { code?: string } };

        expect(body.error?.code).not.toBe('ENTITLEMENT_REQUIRED');
        expect(res.status).not.toBe(403);
        expect(witness).toHaveBeenCalled();
    });
});
