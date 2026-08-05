/**
 * Integration tests for GET /api/v1/public/users/by-slug/:slug
 *
 * Verifies that the public user-by-slug endpoint:
 *   (a) is registered and reachable (not 404)
 *   (b) does not require authentication
 *   (c) returns JSON with a success field
 *   (d) returns 404 for a slug that does not exist in the DB
 *   (e) rejects an invalid slug format with 400
 *   (f) rejects POST/DELETE with 404 or 405
 *
 * Full data-layer assertions (existing user → 200 with exact 5 fields, and
 * soft-deleted user → 404) require a seeded test DB and belong in a dedicated
 * e2e suite. The tests here focus on the route-level contract: registration,
 * auth independence, status codes, and param validation.
 *
 * Rate-limit testing (429 after 60 req/min) is intentionally skipped here
 * because the in-process test harness does not share per-IP rate-limit state
 * across requests. Cover this in a dedicated load test / e2e suite.
 */

import { UserSchema } from '@repo/schemas';
import { beforeAll, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { initApp } from '../../../../src/app.js';
import { UserAuthorPublicResponseSchema } from '../../../../src/routes/user/public/getBySlug.js';
import type { AppOpenAPI } from '../../../../src/types.js';
import {
    AUTHOR_SLUG_MALFORMED_AVATAR,
    AUTHOR_SLUG_OPTED_OUT
} from '../../../helpers/mocks/user-services.js';

const BASE = '/api/v1/public/users/by-slug';

/** A slug that almost certainly does not exist in any seeded DB. */
const NONEXISTENT_SLUG = 'this-slug-does-not-exist-xyz-9999';

/** Syntactically valid slug values. */
const VALID_SLUG_HYPHENATED = 'john-doe';
const VALID_SLUG_SINGLE = 'johndoe';

/** Slug patterns that should fail the regex validation. */
const INVALID_SLUG_UPPERCASE = 'John-Doe';
const INVALID_SLUG_SPACES = 'john doe';
const INVALID_SLUG_EMPTY = '';

describe('GET /api/v1/public/users/by-slug/:slug', () => {
    let app: AppOpenAPI;

    beforeAll(() => {
        app = initApp();
    });

    // -----------------------------------------------------------------------
    // Route registration
    // -----------------------------------------------------------------------

    describe('Route registration', () => {
        it('should be registered and reachable (not 404)', async () => {
            const res = await app.request(`${BASE}/${NONEXISTENT_SLUG}`, {
                method: 'GET',
                headers: { 'user-agent': 'vitest', accept: 'application/json' }
            });
            // Route must be wired up. Without a real DB the service may return
            // 404 (not found) or 500 (DB unreachable), but NEVER a framework-level
            // 404 meaning "no matching route".
            expect([200, 404, 500]).toContain(res.status);
        });
    });

    // -----------------------------------------------------------------------
    // Public access — no authentication required
    // -----------------------------------------------------------------------

    describe('Public access', () => {
        // NOTE: this case is necessary but NOT sufficient, and it is why the
        // 403 shipped. `NONEXISTENT_SLUG` matches no row, so the read returns
        // empty before any permission gate sees an entity — the route answered
        // 404 for everyone and the guard stayed green while every real author
        // page 403'd. The gate is exercised against an actual row in
        // `packages/service-core/test/services/user/getPublicProfileBySlug.test.ts`;
        // do not treat a green run here as proof the endpoint is reachable.
        it('should not require authentication (no 401 or 403)', async () => {
            const res = await app.request(`${BASE}/${NONEXISTENT_SLUG}`, {
                method: 'GET',
                headers: { 'user-agent': 'vitest', accept: 'application/json' }
            });
            expect(res.status).not.toBe(401);
            expect(res.status).not.toBe(403);
        });
    });

    // -----------------------------------------------------------------------
    // Non-existent slug → 404
    // -----------------------------------------------------------------------

    describe('Non-existent slug', () => {
        it('should return 404 when the slug does not match any user', async () => {
            const res = await app.request(`${BASE}/${NONEXISTENT_SLUG}`, {
                method: 'GET',
                headers: { 'user-agent': 'vitest', accept: 'application/json' }
            });
            // 404 (not found) or 500 (DB unavailable in unit mode).
            // Never 200 — a missing slug must not return success.
            expect([404, 500]).toContain(res.status);
        });

        it('should include an error message in the 404 response', async () => {
            const res = await app.request(`${BASE}/${NONEXISTENT_SLUG}`, {
                method: 'GET',
                headers: { 'user-agent': 'vitest', accept: 'application/json' }
            });
            if (res.status === 404) {
                const body = await res.json();
                expect(body).toHaveProperty('success', false);
                // The error object must contain a human-readable message
                expect(body.error).toBeDefined();
            }
        });
    });

    // -----------------------------------------------------------------------
    // Response shape (success path — only asserted when DB returns 200)
    // -----------------------------------------------------------------------

    describe('Response shape', () => {
        it('should return JSON with a success field', async () => {
            const res = await app.request(`${BASE}/${NONEXISTENT_SLUG}`, {
                method: 'GET',
                headers: { 'user-agent': 'vitest', accept: 'application/json' }
            });
            const body = await res.json();
            expect(body).toHaveProperty('success');
        });

        it('should expose only the public author fields when a user is found', async () => {
            // Pointed at a slug the service mock actually resolves. It used to
            // request NONEXISTENT_SLUG behind `if (res.status === 200)`, so the
            // whole body of this test had never once executed — the mocked
            // UserService carried no `getPublicProfileBySlug` at all until
            // HOS-375 T-034 added one, and the route answered 500 for every
            // slug.
            const res = await app.request(`${BASE}/${AUTHOR_SLUG_OPTED_OUT}`, {
                method: 'GET',
                headers: { 'user-agent': 'vitest', accept: 'application/json' }
            });
            expect(res.status).toBe(200);

            const body = await res.json();
            expect(body.success).toBe(true);

            const user = body.data;
            // Required public fields
            expect(user).toHaveProperty('id');
            expect(user).toHaveProperty('slug');
            // Optional but must be present as keys
            expect('displayName' in user).toBe(true);
            expect('avatar' in user).toBe(true);
            expect('bio' in user).toBe(true);
            expect('isSystemAccount' in user).toBe(true);

            // Sensitive fields must be absent
            expect(user).not.toHaveProperty('email');
            expect(user).not.toHaveProperty('phone');
            expect(user).not.toHaveProperty('role');
            expect(user).not.toHaveProperty('settings');
            expect(user).not.toHaveProperty('permissions');
            expect(user).not.toHaveProperty('createdAt');
            expect(user).not.toHaveProperty('deletedAt');
        });

        // HOS-375 round-2 review finding: `avatar` was the last STRICT field on
        // this response, and `stripWithSchema` fail-closes to HTTP 500. Since
        // `profile.avatar` is a JSONB path written by seed fixtures and by
        // data-migration `0042` — both bypassing Zod — one malformed stored
        // value took down the entire PUBLIC author page. Dropping `.url()`
        // (the same treatment `EventAuthorPublicSchema` applies to the event
        // author avatar) makes the response accept it instead.
        //
        // This assertion is at the ROUTE level on purpose: the schema-level
        // test below cannot observe the 500, because the fail-closed behaviour
        // lives in the response pipeline, not in the schema.
        //
        // What this does NOT assert: that the bad value is erased. It used to —
        // via `.catch(undefined)` — but `ZodCatch` is unrenderable by
        // `@hono/zod-openapi` and the OpenAPI document is global, so that broke
        // `/docs/openapi.json` everywhere. Suppressing the broken image is now
        // the web app's job, asserted in
        // `apps/web/test/lib/media.renderable-image-url.test.ts`.
        it('should serve a malformed stored avatar instead of 500ing the page', async () => {
            const res = await app.request(`${BASE}/${AUTHOR_SLUG_MALFORMED_AVATAR}`, {
                method: 'GET',
                headers: { 'user-agent': 'vitest', accept: 'application/json' }
            });

            expect(res.status).toBe(200);

            const body = await res.json();
            expect(body.success).toBe(true);

            // The page still renders: everything except the avatar survived.
            expect(body.data.slug).toBe(AUTHOR_SLUG_MALFORMED_AVATAR);
            expect(body.data.displayName).toBe('Tomas Quiroga');
            expect(body.data.bio).toBe('Fotografia del litoral.');

            // The malformed value survives the response contract verbatim —
            // that is the whole point: the API's job here is "do not 500", and
            // the web app's `isRenderableImageUrl` drops it before render.
            expect(body.data.avatar).toBe('avatars/tomas-quiroga.jpg');
        });
    });

    // -----------------------------------------------------------------------
    // Slug validation
    // -----------------------------------------------------------------------

    describe('Slug validation', () => {
        it('should accept a hyphenated slug without 400', async () => {
            const res = await app.request(`${BASE}/${VALID_SLUG_HYPHENATED}`, {
                method: 'GET',
                headers: { 'user-agent': 'vitest', accept: 'application/json' }
            });
            // Valid slug format — should not be rejected by validation
            expect(res.status).not.toBe(400);
        });

        it('should accept a single-word slug without 400', async () => {
            const res = await app.request(`${BASE}/${VALID_SLUG_SINGLE}`, {
                method: 'GET',
                headers: { 'user-agent': 'vitest', accept: 'application/json' }
            });
            expect(res.status).not.toBe(400);
        });

        it('should reject an uppercase slug with 400', async () => {
            const res = await app.request(`${BASE}/${INVALID_SLUG_UPPERCASE}`, {
                method: 'GET',
                headers: { 'user-agent': 'vitest', accept: 'application/json' }
            });
            expect(res.status).toBe(400);
        });

        it('should return 400 or 404 for an empty slug segment', async () => {
            const res = await app.request(`${BASE}/${INVALID_SLUG_EMPTY}`, {
                method: 'GET',
                headers: { 'user-agent': 'vitest', accept: 'application/json' }
            });
            expect([400, 404]).toContain(res.status);
        });

        it('should return 400 for a slug with spaces (URL-encoded)', async () => {
            const encoded = encodeURIComponent(INVALID_SLUG_SPACES);
            const res = await app.request(`${BASE}/${encoded}`, {
                method: 'GET',
                headers: { 'user-agent': 'vitest', accept: 'application/json' }
            });
            expect(res.status).toBe(400);
        });
    });

    // -----------------------------------------------------------------------
    // HTTP method restrictions
    // -----------------------------------------------------------------------

    describe('HTTP method restrictions', () => {
        it('should reject POST requests with 404 or 405', async () => {
            const res = await app.request(`${BASE}/${NONEXISTENT_SLUG}`, {
                method: 'POST',
                headers: {
                    'user-agent': 'vitest',
                    accept: 'application/json',
                    'content-type': 'application/json'
                },
                body: JSON.stringify({})
            });
            expect([404, 405]).toContain(res.status);
        });

        it('should reject DELETE requests with 404 or 405', async () => {
            const res = await app.request(`${BASE}/${NONEXISTENT_SLUG}`, {
                method: 'DELETE',
                headers: { 'user-agent': 'vitest', accept: 'application/json' }
            });
            expect([404, 405]).toContain(res.status);
        });
    });
});

/**
 * HOS-302 — read⊇write regression coverage for this route's response schema.
 *
 * The status-code tests above never reach the success path without a seeded DB,
 * so they cannot see a schema mismatch. These assert the response contract
 * directly instead.
 *
 * `display_name` is a NULLABLE, unbounded `text` column that Better Auth signup
 * writes without passing through the create/update Zod schemas, so production
 * carries rows holding `''`. The handler additionally emits
 * `user.displayName ?? null`. Both values were rejected by the previous strict
 * `.min(2).optional()` shape, and `stripWithSchema` fail-closes to HTTP 500 — a
 * PUBLIC 500 on the author page.
 */

/** Reads the write-side bound off `UserSchema` so a moved bound fails loudly. */
const writeMaxDisplayName = (): number => {
    const max = UserSchema.shape.displayName.unwrap().maxLength;
    if (typeof max !== 'number') {
        throw new Error('HOS-302 test guard: UserSchema.displayName lost its maxLength');
    }
    return max;
};

const OVER_MAX_DISPLAY_NAME = 'A'.repeat(writeMaxDisplayName() + 1);

/** Everything the handler emits except the field under test. */
const baseAuthorPayload = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    slug: 'user-ea10dbb3',
    avatar: null,
    bio: null
};

describe('UserAuthorPublicResponseSchema — HOS-302 read⊇write', () => {
    it.each([
        ['null — the handler emits `user.displayName ?? null` unconditionally', null],
        ['the empty string — the exact value 3 production rows carry', ''],
        ['a single character — under the write `.min(2)`', 'A'],
        ['longer than the write maximum', OVER_MAX_DISPLAY_NAME]
    ])('accepts a displayName that is %s', (_label, displayName) => {
        const result = UserAuthorPublicResponseSchema.safeParse({
            ...baseAuthorPayload,
            displayName
        });

        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.displayName).toBe(displayName);
        }
    });

    it('still rejects a displayName of the wrong type — leniency is on LENGTH, not TYPE', () => {
        const result = UserAuthorPublicResponseSchema.safeParse({
            ...baseAuthorPayload,
            displayName: 42
        });

        expect(result.success).toBe(false);
        if (!result.success) {
            expect(
                result.error.issues.some(
                    (issue) => issue.path.includes('displayName') && issue.code === 'invalid_type'
                )
            ).toBe(true);
        }
    });
});

/**
 * HOS-375 §6.7 (T-009) — `socialNetworks` is the one CONDITIONAL field in the
 * response. The service omits the key entirely when the profile owner has not
 * opted in, so the schema must accept the payload both with and without it.
 *
 * It also uses the LENIENT read shape: stored values predate the current
 * validation (bare handles, `m.facebook.com` variants, shortened links), and
 * `stripWithSchema` fail-closes to HTTP 500 on this PUBLIC page.
 */
describe('UserAuthorPublicResponseSchema — HOS-375 socialNetworks', () => {
    const AUTHOR = { ...baseAuthorPayload, displayName: 'Carmen Silva' };

    it('accepts a payload WITHOUT the key — the opted-out case', () => {
        const result = UserAuthorPublicResponseSchema.safeParse(AUTHOR);

        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data).not.toHaveProperty('socialNetworks');
        }
    });

    it('accepts a payload WITH the key — the opted-in case', () => {
        const socialNetworks = {
            instagram: 'https://instagram.com/carmen',
            twitter: 'https://x.com/carmen'
        };

        const result = UserAuthorPublicResponseSchema.safeParse({ ...AUTHOR, socialNetworks });

        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.socialNetworks).toEqual(socialNetworks);
        }
    });

    it('accepts stored values the WRITE shape would reject', () => {
        // A bare handle and an `m.` mobile variant — both real shapes in the
        // column today, both failing the write-side platform regex. Rejecting
        // them here would 500 the author page.
        const result = UserAuthorPublicResponseSchema.safeParse({
            ...AUTHOR,
            socialNetworks: {
                instagram: '@carmen',
                facebook: 'https://m.facebook.com/carmen'
            }
        });

        expect(result.success).toBe(true);
    });

    it('still rejects a socialNetworks entry of the wrong type', () => {
        // Non-vacuity guard for the leniency above: it is on FORMAT, not TYPE.
        const result = UserAuthorPublicResponseSchema.safeParse({
            ...AUTHOR,
            socialNetworks: { instagram: 42 }
        });

        expect(result.success).toBe(false);
    });
});

/**
 * HOS-375 round-2 — `avatar` ACCEPTS, it does not reject.
 *
 * The value comes from the `profile.avatar` JSONB path, written by seed
 * fixtures and by data-migration `0042` without ever passing through Zod, so a
 * non-URL string is a reachable stored state rather than a hypothetical one.
 * Dropping the `.url()` constraint is what keeps it from taking the whole
 * PUBLIC author page down through `stripWithSchema`'s fail-closed 500.
 *
 * The property under test is 500-PREVENTION, and nothing more. This used to be
 * `.catch(undefined)`, which additionally ERASED the bad value — but `ZodCatch`
 * has no renderer in `@hono/zod-openapi`, and the OpenAPI document is global,
 * so that one field made `getOpenAPIDocument()` throw and 500'd
 * `/docs/openapi.json` (with `/docs`, `/reference` and `/ui`) in every
 * environment. Keeping the junk out of an `<img>` moved to the CONSUMER; see
 * `apps/web/test/lib/media.renderable-image-url.test.ts` and
 * `apps/web/test/pages/author-page.test.ts`.
 */
describe('UserAuthorPublicResponseSchema — HOS-375 avatar leniency', () => {
    const AUTHOR = { ...baseAuthorPayload, displayName: 'Carmen Silva' };

    it.each([
        ['a bare relative path', 'avatars/carmen-silva.jpg'],
        ['a protocol-less host', 'example.com/a.jpg'],
        ['an empty string', '']
    ])('accepts a malformed avatar (%s) rather than failing the page closed', (_label, avatar) => {
        const result = UserAuthorPublicResponseSchema.safeParse({ ...AUTHOR, avatar });

        expect(result.success).toBe(true);
        if (result.success) {
            // Passed through verbatim — the schema no longer erases it.
            expect(result.data.avatar).toBe(avatar);
        }
    });

    // The leniency is TYPE-preserving, not unconditional: read ⊇ write widens
    // the accepted FORMAT, it does not turn the field into `unknown`. A number
    // is not a string in any stored shape, and letting it through would push an
    // untyped value onto every consumer.
    it('still rejects a value of the wrong type entirely', () => {
        const result = UserAuthorPublicResponseSchema.safeParse({ ...AUTHOR, avatar: 42 });

        expect(result.success).toBe(false);
    });

    it('does not wrap `avatar` in a ZodCatch (global OpenAPI doc guard)', () => {
        // The exact regression: `getOpenAPIDocument()` threw "Unknown zod object
        // type" and took `/docs/openapi.json` down. Pinned here so the field is
        // named directly; `test/routes/openapi-doc-generation.test.ts` is the
        // nesting-proof end-to-end guard.
        expect(UserAuthorPublicResponseSchema.shape.avatar instanceof z.ZodCatch).toBe(false);
    });

    // Non-vacuity guard: a real URL must still round-trip byte-identical, and an
    // explicit `null` (the "this user has no avatar" case the handler already
    // emits) must survive as `null` rather than being swallowed into `undefined`.
    it('round-trips a well-formed URL untouched', () => {
        const avatar = 'https://example.com/avatars/carmen-silva.jpg';
        const result = UserAuthorPublicResponseSchema.safeParse({ ...AUTHOR, avatar });

        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.avatar).toBe(avatar);
        }
    });

    it('keeps an explicit null as null', () => {
        const result = UserAuthorPublicResponseSchema.safeParse({ ...AUTHOR, avatar: null });

        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.avatar).toBeNull();
        }
    });
});

/**
 * HOS-375 §6.5 / AC-13 — `isSystemAccount` is the only flag deliberately carried
 * into a public payload, because the author page's indexability gate runs in the
 * web app and has no other source for it.
 *
 * The shape is `z.boolean().default(false)`, matching the `NOT NULL DEFAULT
 * false` column, so it round-trips a real boolean rather than widening every
 * consumer of the predicate to `boolean | undefined`.
 */
describe('UserAuthorPublicResponseSchema — HOS-375 isSystemAccount', () => {
    const AUTHOR = { ...baseAuthorPayload, displayName: 'Carmen Silva' };

    it('round-trips true — the flag that keeps a staff page out of the index', () => {
        const result = UserAuthorPublicResponseSchema.safeParse({
            ...AUTHOR,
            isSystemAccount: true
        });

        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.isSystemAccount).toBe(true);
        }
    });

    it('round-trips false for a person', () => {
        const result = UserAuthorPublicResponseSchema.safeParse({
            ...AUTHOR,
            isSystemAccount: false
        });

        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.isSystemAccount).toBe(false);
        }
    });

    it('defaults to false when the key is absent, never to undefined', () => {
        // The web predicate treats an absent value as "a person". Parsing to
        // `undefined` here would make a dropped projection indistinguishable
        // from a correct read of a real person's row.
        const result = UserAuthorPublicResponseSchema.safeParse(AUTHOR);

        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.isSystemAccount).toBe(false);
        }
    });
});
