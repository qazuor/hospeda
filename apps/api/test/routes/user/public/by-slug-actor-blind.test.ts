/**
 * HOS-375 §6.7 / AC-6 — `GET /api/v1/public/users/by-slug/{slug}` must answer
 * identically to everyone.
 *
 * The route is declared with `cacheTTL: 300` and lives in
 * `PUBLIC_CACHE_ENDPOINTS`, so one stored body is served to every subsequent
 * visitor. Anything in the response that varied with the REQUESTER would be
 * captured on the first request and replayed to all the others — the social
 * block being the obvious candidate, since it is a preference and preferences
 * invite "did THIS user opt in?" reasoning. The opt-in belongs to the profile
 * OWNER; nothing here may consult who is asking.
 *
 * `getPublicProfileBySlug` is already proven actor-blind at the service layer
 * (`packages/service-core/test/services/user/getPublicProfileBySlug.test.ts`).
 * What is unproven, and what these tests cover, is the layer above it: the
 * route, its response schema, and the middleware chain that wraps both.
 */

import { beforeAll, describe, expect, it } from 'vitest';
import { initApp } from '../../../../src/app.js';
import type { AppOpenAPI } from '../../../../src/types.js';
import {
    AUTHOR_SLUG_OPTED_IN,
    AUTHOR_SLUG_OPTED_OUT
} from '../../../helpers/mocks/user-services.js';

const BASE = '/api/v1/public/users/by-slug';

/** A route that requires a session, used to prove the token below really authenticates. */
const PROTECTED_PROBE = '/api/v1/protected/profile/status';

const ANONYMOUS_HEADERS = {
    'user-agent': 'vitest',
    accept: 'application/json'
} as const;

const AUTHENTICATED_HEADERS = {
    ...ANONYMOUS_HEADERS,
    authorization: 'Bearer test-protected-token'
} as const;

const get = (app: AppOpenAPI, path: string, headers: Record<string, string>) =>
    app.request(path, { method: 'GET', headers });

describe('GET /api/v1/public/users/by-slug/{slug} — actor-blind response (AC-6)', () => {
    let app: AppOpenAPI;

    beforeAll(() => {
        app = initApp();
    });

    it('treats the bearer token as a real session — without this the rest is vacuous', async () => {
        // Control. If the harness ignored the header, every comparison below
        // would be anonymous-vs-anonymous and could not fail. Asserted against
        // a route that DOES gate on the session.
        const anonymous = await get(app, PROTECTED_PROBE, ANONYMOUS_HEADERS);
        const authenticated = await get(app, PROTECTED_PROBE, AUTHENTICATED_HEADERS);

        expect(anonymous.status).toBe(401);
        expect(authenticated.status).not.toBe(401);
    });

    it('serves a real profile at all — the comparisons must not be two 404s', async () => {
        // Second non-vacuity guard. Two identical error bodies would satisfy
        // every equality assertion below while proving nothing.
        const res = await get(app, `${BASE}/${AUTHOR_SLUG_OPTED_OUT}`, ANONYMOUS_HEADERS);
        const body = await res.json();

        expect(res.status).toBe(200);
        expect(body.data.slug).toBe(AUTHOR_SLUG_OPTED_OUT);
    });

    it('returns a byte-identical body to an anonymous and an authenticated caller', async () => {
        const anonymous = await get(app, `${BASE}/${AUTHOR_SLUG_OPTED_OUT}`, ANONYMOUS_HEADERS);
        const authenticated = await get(
            app,
            `${BASE}/${AUTHOR_SLUG_OPTED_OUT}`,
            AUTHENTICATED_HEADERS
        );

        expect(authenticated.status).toBe(anonymous.status);

        const anonymousBody = await anonymous.json();
        const authenticatedBody = await authenticated.json();

        // Serialized, not deep-equal: KEY ORDER is part of what gets cached,
        // and a payload assembled differently per actor would differ here even
        // when the values happen to match.
        expect(JSON.stringify(authenticatedBody.data)).toBe(JSON.stringify(anonymousBody.data));
    });

    it('stays identical with the social opt-in ON — the branch most likely to go wrong', async () => {
        // This is the case the invariant exists for. The opt-in is a
        // preference, and preferences invite a "does the VIEWER get to see
        // this?" branch. Here it is the OWNER's preference and nothing else.
        const anonymous = await get(app, `${BASE}/${AUTHOR_SLUG_OPTED_IN}`, ANONYMOUS_HEADERS);
        const authenticated = await get(
            app,
            `${BASE}/${AUTHOR_SLUG_OPTED_IN}`,
            AUTHENTICATED_HEADERS
        );

        const anonymousBody = await anonymous.json();
        const authenticatedBody = await authenticated.json();

        // Non-vacuity for THIS case specifically: the opted-in fixture must
        // actually carry the block, or "identical" would only mean "absent on
        // both sides".
        expect(anonymousBody.data.socialNetworks).toBeDefined();
        expect(JSON.stringify(authenticatedBody.data)).toBe(JSON.stringify(anonymousBody.data));
    });

    it('publishes the owner opt-out as an absent key to BOTH callers', async () => {
        // The complementary half: an authenticated caller must not be able to
        // see a block the owner opted out of, whoever they are.
        const anonymous = await get(app, `${BASE}/${AUTHOR_SLUG_OPTED_OUT}`, ANONYMOUS_HEADERS);
        const authenticated = await get(
            app,
            `${BASE}/${AUTHOR_SLUG_OPTED_OUT}`,
            AUTHENTICATED_HEADERS
        );

        expect((await anonymous.json()).data).not.toHaveProperty('socialNetworks');
        expect((await authenticated.json()).data).not.toHaveProperty('socialNetworks');
    });

    it('does not vary its caching headers by caller', async () => {
        // A body can be identical while the RESPONSE still fragments or leaks
        // the shared cache: a caller-dependent `Cache-Control` or `Vary` splits
        // it, or worse, marks one visitor's copy public.
        //
        // `Set-Cookie` is deliberately NOT asserted absent here. Every response
        // carries `hospeda_vid` (`middlewares/visitor-id.ts`) for a caller that
        // arrives without one, and that is by design. It does not reach the
        // stored entry either: `visitorIdMiddleware` writes the cookie AFTER
        // its `await next()` — i.e. after `middlewares/cache.ts` has already
        // snapshotted `c.res.headers` — so no visitor's id can be replayed to
        // the next one from cache.
        const anonymous = await get(app, `${BASE}/${AUTHOR_SLUG_OPTED_IN}`, ANONYMOUS_HEADERS);
        const authenticated = await get(
            app,
            `${BASE}/${AUTHOR_SLUG_OPTED_IN}`,
            AUTHENTICATED_HEADERS
        );

        expect(authenticated.headers.get('cache-control')).toBe(
            anonymous.headers.get('cache-control')
        );
        expect(authenticated.headers.get('vary')).toBe(anonymous.headers.get('vary'));
    });
});
