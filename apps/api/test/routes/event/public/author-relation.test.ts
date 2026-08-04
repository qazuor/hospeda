/**
 * HOS-375 §6.9 (G-7) — the public event DETAIL response must carry its author.
 *
 * The event detail page needs a byline linking to `/autores/<slug>/`, and the
 * payload had no author at all to build one from. `EventService` was already
 * eager-loading the relation; `EventPublicSchema` simply did not declare it, and
 * `stripWithSchema` drops every key the response schema does not name. So the
 * whole `users` row was being fetched on every event read and then thrown away.
 *
 * These tests sit at the ROUTE layer because that is where the discarding
 * happened — the schema unit tests cannot see it. The shared `EventService` mock
 * returns the raw `users` row verbatim (see `RAW_AUTHOR_ROW`), so the projection
 * asserted below is genuinely performed here and not pre-baked by the mock.
 *
 * @see packages/schemas/src/entities/event/event.access.schema.ts
 * @see apps/api/src/routes/event/public/getBySlug.ts
 */

import { beforeAll, describe, expect, it } from 'vitest';
import { initApp } from '../../../../src/app.js';
import type { AppOpenAPI } from '../../../../src/types.js';
import { RAW_AUTHOR_ROW } from '../../../helpers/mocks/event-services.js';

const BASE = '/api/v1/public/events';

const request = (app: AppOpenAPI, path: string) =>
    app.request(path, {
        method: 'GET',
        headers: { 'user-agent': 'vitest', accept: 'application/json' }
    });

describe('GET /api/v1/public/events/slug/{slug} — author relation', () => {
    let app: AppOpenAPI;

    beforeAll(() => {
        app = initApp();
    });

    it('carries the author on the detail payload', async () => {
        const res = await request(app, `${BASE}/slug/event-with-author`);
        const body = await res.json();

        expect(res.status).toBe(200);
        expect(body.data.author).toBeDefined();
    });

    it('exposes the slug the byline links to', async () => {
        // Without this field there is no author page to point at, which is the
        // entire reason the relation was added.
        const res = await request(app, `${BASE}/slug/event-with-author`);
        const body = await res.json();

        expect(body.data.author.slug).toBe(RAW_AUTHOR_ROW.slug);
        expect(body.data.author.displayName).toBe(RAW_AUTHOR_ROW.displayName);
    });

    it('projects the raw users row down to the public tier', async () => {
        // The mock hands the route every column the DB row has. Anything
        // private that survives to the wire is a leak on a shared-cached,
        // anonymous endpoint.
        const res = await request(app, `${BASE}/slug/event-with-author`);
        const body = await res.json();

        // Guard against passing vacuously: an absent author has no private
        // column to leak, and would satisfy every assertion below.
        expect(body.data.author).toBeDefined();

        for (const privateColumn of [
            'email',
            'password',
            'phone',
            'settings',
            'contactInfo',
            'deletedAt'
        ]) {
            expect(body.data.author).not.toHaveProperty(privateColumn);
        }
    });

    it('stays actor-blind — an anonymous request gets the same author', async () => {
        // The route is in PUBLIC_CACHE_ENDPOINTS: one cached body is served to
        // everyone, so the author must never vary with the requester.
        const res = await request(app, `${BASE}/slug/event-with-author`);

        expect(res.status).not.toBe(401);
        expect(res.status).not.toBe(403);

        const body = await res.json();
        expect(body.data.author.id).toBe(RAW_AUTHOR_ROW.id);
    });
});
