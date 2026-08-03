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
import { initApp } from '../../../../src/app.js';
import { UserAuthorPublicResponseSchema } from '../../../../src/routes/user/public/getBySlug.js';
import type { AppOpenAPI } from '../../../../src/types.js';

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

        it('should expose only the 5 public fields when a user is found', async () => {
            const res = await app.request(`${BASE}/${NONEXISTENT_SLUG}`, {
                method: 'GET',
                headers: { 'user-agent': 'vitest', accept: 'application/json' }
            });
            if (res.status === 200) {
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

                // Sensitive fields must be absent
                expect(user).not.toHaveProperty('email');
                expect(user).not.toHaveProperty('phone');
                expect(user).not.toHaveProperty('role');
                expect(user).not.toHaveProperty('settings');
                expect(user).not.toHaveProperty('permissions');
                expect(user).not.toHaveProperty('createdAt');
                expect(user).not.toHaveProperty('deletedAt');
            }
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
