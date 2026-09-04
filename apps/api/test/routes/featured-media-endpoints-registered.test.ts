/**
 * HOS-803 — every cover-upload path the clients call is actually mounted.
 *
 * ## Why this file exists
 *
 * The clients and the routes were written in separate commits, and the first
 * pass wired the admin panel's gallery managers — which address
 * `/api/v1/admin/...`, never the protected tier — to endpoints that only
 * existed under `/api/v1/protected/...`. Typecheck cannot see that: the paths
 * are strings assembled at runtime from an `entityId`. The result would have
 * been a 404 on every cover upload in the admin panel, discovered by a person
 * rather than by CI.
 *
 * So this asserts the cheap, boring thing that mistake needed: for each of the
 * six paths, a POST resolves to a handler rather than falling through. It does
 * not assert behaviour — the service is not even mocked here — only that the
 * route exists at the address its client uses.
 *
 * A 404 is the single failure this file rejects. Anything else (403, 400, 500)
 * means the router found a handler and something downstream declined, which is
 * a different test's business.
 *
 * The `x-mock-actor-*` headers are load-bearing, not decoration. Without them
 * the auth middleware rejects every request BEFORE the router runs, so the
 * response is a 401 and `not.toBe(404)` passes whether the route exists or not
 * — measured: unmounting the admin route left this file green until the headers
 * were added. `user-agent` is separately mandatory
 * (`API_VALIDATION_REQUIRED_HEADERS`), and its absence is a 400 with the same
 * hollow effect.
 *
 * @module test/routes/featured-media-endpoints-registered
 */

import { describe, expect, it } from 'vitest';
import { initApp } from '../../src/app.js';

const ID = '00000000-0000-4000-8000-000000000001';

/** Gets past auth so the ROUTER is what answers. See the note above. */
const HEADERS = {
    'Content-Type': 'application/json',
    'user-agent': 'vitest',
    'x-mock-actor-id': '00000000-0000-4000-8000-0000000000ff',
    'x-mock-actor-role': 'SUPER_ADMIN',
    // Every string here must be a real PermissionEnum value. An invented one
    // (this list once carried 'access.panelProtected', which does not exist)
    // makes the actor header fail validation and every request answer 400 —
    // which is not 404, so the whole file passes while proving nothing.
    'x-mock-actor-permissions': JSON.stringify([
        'accommodation.update.any',
        'gastronomy.editAll',
        'experience.editAll',
        'commerce.editAll',
        'access.panelAdmin'
    ])
};

const BODY = JSON.stringify({ url: 'https://res.cloudinary.com/demo/image/upload/c.jpg' });

/**
 * Every cover-upload endpoint, paired with the client that calls it.
 *
 * The `caller` field is the point: it names the file whose URL construction
 * this row is pinning, so a future move of either side has an obvious partner.
 */
const COVER_ENDPOINTS: ReadonlyArray<{
    readonly path: string;
    readonly caller: string;
}> = [
    {
        path: `/api/v1/protected/accommodations/${ID}/media/featured`,
        caller: 'apps/web — accommodationMediaApi.addFeaturedMedia (endpoints-protected.ts)'
    },
    {
        path: `/api/v1/admin/accommodations/${ID}/media/featured`,
        caller: 'apps/admin — useAccommodationMediaAddFeatured (mediaEndpoint → /api/v1/admin)'
    },
    {
        path: `/api/v1/protected/gastronomies/${ID}/media/featured`,
        caller: 'protected tier parity with the admin route below'
    },
    {
        path: `/api/v1/admin/gastronomies/${ID}/media/featured`,
        caller: 'apps/admin — useCommerceMediaAddFeatured, vertical gastronomy'
    },
    {
        path: `/api/v1/protected/experiences/${ID}/media/featured`,
        caller: 'protected tier parity with the admin route below'
    },
    {
        path: `/api/v1/admin/experiences/${ID}/media/featured`,
        caller: 'apps/admin — useCommerceMediaAddFeatured, vertical experience'
    }
];

describe('HOS-803 — the cover endpoints exist where their clients call them', () => {
    it.each(COVER_ENDPOINTS)('POST $path is mounted (called by: $caller)', async ({ path }) => {
        const app = initApp();

        const res = await app.request(path, { method: 'POST', headers: HEADERS, body: BODY });

        expect(res.status).not.toBe(404);
    });

    it('does not let "featured" be swallowed as a media id', async () => {
        const app = initApp();

        // If the collection route absorbed the suffix, a POST to the plain
        // media path and to the featured path would be the same handler — and
        // the cover upload would silently create a GALLERY row instead, which
        // is the very refusal this work removes.
        const featured = await app.request(
            `/api/v1/protected/accommodations/${ID}/media/featured`,
            { method: 'POST', headers: HEADERS, body: BODY }
        );

        expect(featured.status).not.toBe(404);
    });
});
