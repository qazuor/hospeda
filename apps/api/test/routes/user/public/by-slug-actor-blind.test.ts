/**
 * HOS-375 §6.7 / AC-6 — `GET /api/v1/public/users/by-slug/{slug}` must answer
 * identically to everyone.
 *
 * ## Which cache, exactly
 *
 * `/api/v1/public/users` is in **`PRIVATE_CACHE_ENDPOINTS`**, not
 * `PUBLIC_CACHE_ENDPOINTS` (`apps/api/src/middlewares/cache.constants.ts`) — so
 * it never reaches the shared CDN. It IS stored in the API's own in-memory
 * cache, since the route declares `cacheTTL: 300`, under the key
 * `private:${path}${suffix}:${authorization ?? 'anonymous'}`
 * (`generateCacheKey`, `apps/api/src/middlewares/cache.ts`).
 *
 * That key segments on the `Authorization` HEADER — and the web app
 * authenticates with session COOKIES, which the key never reads. In production
 * every logged-in visitor therefore lands in the same `:anonymous` bucket as
 * every logged-out one, so a response that varied with the REQUESTER would still
 * be captured once and replayed to all of them. The social block is the obvious
 * candidate, since it is a preference and preferences invite "did THIS user opt
 * in?" reasoning. The opt-in belongs to the profile OWNER; nothing here may
 * consult who is asking.
 *
 * ## Why `clearCache()` + `X-Cache: MISS`
 *
 * These tests DO send a bearer token, which the test harness's mock auth
 * accepts — and which `generateCacheKey` does read. So without the two
 * precautions below, the anonymous and authenticated requests would land in
 * different buckets while consecutive same-header requests would be served from
 * the first one, and every "identical" assertion could pass by replaying a
 * stored body rather than by the handler producing it twice. Clearing the cache
 * before each test and asserting `X-Cache: MISS` makes each comparison a real
 * pair of handler invocations.
 *
 * `getPublicProfileBySlug` is already proven actor-blind at the service layer
 * (`packages/service-core/test/services/user/getPublicProfileBySlug.test.ts`).
 * What is unproven, and what these tests cover, is the layer above it: the
 * route, its response schema, and the middleware chain that wraps both.
 */

import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { initApp } from '../../../../src/app.js';
import { clearCache } from '../../../../src/middlewares/cache.js';
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

    beforeEach(() => {
        // Every comparison below must be two REAL handler runs, never a replay
        // of a body the previous test left behind. See the file docstring.
        clearCache();
    });

    it('serves each of these requests from the handler, not from the cache', async () => {
        // The guard that makes every "identical" assertion below mean
        // something. If a request were answered from a stored entry, the two
        // sides of a comparison could be the same bytes without the handler
        // having produced them twice.
        const first = await get(app, `${BASE}/${AUTHOR_SLUG_OPTED_IN}`, ANONYMOUS_HEADERS);
        const authenticated = await get(
            app,
            `${BASE}/${AUTHOR_SLUG_OPTED_IN}`,
            AUTHENTICATED_HEADERS
        );

        expect(first.headers.get('x-cache')).toBe('MISS');
        expect(authenticated.headers.get('x-cache')).toBe('MISS');

        // Non-vacuity: the route IS cached, so a repeat of the FIRST request
        // must HIT. Without this, `MISS` above could just mean "caching is off"
        // and the assertions would prove nothing about the mechanism.
        const repeat = await get(app, `${BASE}/${AUTHOR_SLUG_OPTED_IN}`, ANONYMOUS_HEADERS);
        expect(repeat.headers.get('x-cache')).toBe('HIT');
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
        // Both bodies came from the handler, not from a stored entry.
        expect(anonymous.headers.get('x-cache')).toBe('MISS');
        expect(authenticated.headers.get('x-cache')).toBe('MISS');

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

        expect(anonymous.headers.get('x-cache')).toBe('MISS');
        expect(authenticated.headers.get('x-cache')).toBe('MISS');

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
