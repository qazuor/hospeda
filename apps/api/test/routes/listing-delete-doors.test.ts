/**
 * TEST:V6:33 (a) — AC:V6:25 (HOS-1477, V6.7): no listing or account delete door
 * outside the design is registered on the live app.
 *
 * Only PB12 (the owner, `POST /api/v1/protected/{plural}/{id}/purge`) and
 * administrative action 23 (`POST /api/v1/admin/{plural}/{id}/purge`) delete a
 * listing. There is no physical delete of listings or accounts and no listing
 * restore. The routes are enumerated from `initApp().routes`, the same source
 * the route manifest is generated from (`test/route-manifest/route-manifest.test.ts`),
 * so a door registered from any folder turns this red.
 */

import { beforeAll, describe, expect, it } from 'vitest';
import { initApp } from '../../src/app';
import { validateApiEnv } from '../../src/utils/env';

type Route = { readonly method: string; readonly path: string };

const LISTING_PLURALS = ['accommodations', 'gastronomies', 'experiences'] as const;
const TIERS = ['admin', 'protected'] as const;

/** A listing path itself, or its `/hard` or `/restore` suffix (no sub-resource). */
const LISTING_DOOR_PATH =
    /^\/api\/v1\/(admin|protected)\/(accommodations|gastronomies|experiences)\/:id(\/hard|\/restore)?$/;

let routes: Route[];

const isRegistered = (method: string, path: string): boolean =>
    routes.some((route) => route.method === method && route.path === path);

beforeAll(() => {
    validateApiEnv();
    const app = initApp();
    routes = app.routes
        .filter((route) => route.method !== 'ALL')
        .map(({ method, path }) => ({ method, path }));
});

describe('TEST:V6:33 AC:V6:25 no listing or account delete door outside the design', () => {
    it('enumerates the live app routes', () => {
        expect(routes.length).toBeGreaterThan(100);
    });

    describe.each(TIERS)('%s tier', (tier) => {
        it.each(LISTING_PLURALS)('%s: no delete, hard delete or restore door', (plural) => {
            const base = `/api/v1/${tier}/${plural}/:id`;

            expect(isRegistered('DELETE', base), `DELETE ${base}`).toBe(false);
            expect(isRegistered('DELETE', `${base}/hard`), `DELETE ${base}/hard`).toBe(false);
            // Exact path only: the photo restore `${base}/media/:mediaId/restore` is not a listing door.
            expect(isRegistered('POST', `${base}/restore`), `POST ${base}/restore`).toBe(false);
        });

        it.each(
            LISTING_PLURALS
        )('%s: the only listing delete door is POST /:id/purge (PB12 or action 23)', (plural) => {
            const purge = `/api/v1/${tier}/${plural}/:id/purge`;

            expect(isRegistered('POST', purge), `POST ${purge}`).toBe(true);
        });
    });

    it('has no account hard delete door', () => {
        expect(isRegistered('DELETE', '/api/v1/admin/users/:id/hard')).toBe(false);
    });

    it('keeps the account soft delete and restore (H2)', () => {
        // .specs/HOS-1352-billing-verticals-redesign/spec-consolidada/02-nucleo.md:1457-1458
        // retires "la restauración de fichas del panel": the restore that goes is the
        // LISTING restore. The account soft delete is replaced by action 24 (HOS-1494).
        expect(isRegistered('POST', '/api/v1/admin/users/:id/restore')).toBe(true);
        expect(isRegistered('DELETE', '/api/v1/admin/users/:id')).toBe(true);
    });

    it('registers no listing DELETE, /:id/hard or /:id/restore door from any folder', () => {
        const offending = routes
            .filter((route) => {
                const match = LISTING_DOOR_PATH.exec(route.path);
                if (!match) return false;
                const suffix = match[3];
                return suffix === undefined ? route.method === 'DELETE' : true;
            })
            .map((route) => `${route.method} ${route.path}`);

        expect(
            offending,
            `listing delete doors outside the design: ${offending.join(', ')}`
        ).toEqual([]);
    });
});
