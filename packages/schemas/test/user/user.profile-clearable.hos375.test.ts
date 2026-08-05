/**
 * Regression tests for HOS-375 — clearing a `users.profile` field must be
 * expressible, on the way in AND on the way out.
 *
 * `users.profile` is a MERGEABLE JSONB column (`UserModel.mergeableJsonbColumns`),
 * which is what stops the web profile form (`bio`/`website`/`occupation`) and
 * the admin account form (`bio`/`avatar`) from deleting each other's half of the
 * column — and with it the `bio` + `avatar` pair that decides whether an author
 * page is indexed and listed in the sitemap.
 *
 * Merge semantics invert how a field is CLEARED: an omitted key now means
 * "leave it alone", so deleting a value is an explicit `null`. Two schemas must
 * accept that null or the whole fix is inert:
 *
 *  - {@link UserProfileSchema} (WRITE) — a rejection here 400s every "I deleted
 *    my bio" save, leaving the field permanently un-clearable.
 *  - {@link UserProfileReadSchema} (READ) — the stored JSON null is what comes
 *    BACK on every later read, and the access family is applied by
 *    `stripWithSchema`, which FAIL-CLOSES to HTTP 500. A rejection here turns
 *    "this user once cleared their bio" into a permanent 500 on their own
 *    profile GET.
 *
 * The bounds themselves are untouched: widening `string | undefined` to
 * `string | null | undefined` is ADDITIVE (schema-compat policy), and a
 * NON-null value is still validated exactly as before — which the second block
 * pins so this never degrades into "profile accepts anything".
 */
import { describe, expect, it } from 'vitest';
import { UserSelfSchema } from '../../src/entities/user/user.access.schema.js';
import { UserUpdateInputSchema } from '../../src/entities/user/user.crud.schema.js';
import {
    UserProfileReadSchema,
    UserProfileSchema
} from '../../src/entities/user/user.profile.schema.js';

const PROFILE_FIELDS = ['avatar', 'bio', 'website', 'occupation'] as const;

describe('UserProfileSchema (WRITE) — an explicit null clears a field', () => {
    for (const field of PROFILE_FIELDS) {
        it(`accepts \`${field}: null\``, () => {
            const result = UserProfileSchema.safeParse({ [field]: null });
            expect(result.success).toBe(true);
        });
    }

    it('accepts a null on every field at once', () => {
        const result = UserProfileSchema.safeParse({
            avatar: null,
            bio: null,
            website: null,
            occupation: null
        });
        expect(result.success).toBe(true);
    });

    it('survives the whole update-input path the API validates against', () => {
        // `UserUpdateInputSchema` (= the protected/admin PATCH body) embeds this
        // shape. A null rejected here never reaches the model, so the merge
        // column would be un-clearable no matter what the DB layer does.
        const result = UserUpdateInputSchema.safeParse({ profile: { bio: null } });
        expect(result.success).toBe(true);
    });
});

describe('UserProfileSchema (WRITE) — the bounds are NOT relaxed by the null', () => {
    it('still rejects a bio under the 10-char floor', () => {
        // Non-vacuity for the block above: `.nullish()` must widen the field by
        // exactly one value, not turn it into `z.any()`.
        expect(UserProfileSchema.safeParse({ bio: 'corta' }).success).toBe(false);
    });

    it('still rejects a bio over the 300-char ceiling', () => {
        expect(UserProfileSchema.safeParse({ bio: 'x'.repeat(301) }).success).toBe(false);
    });

    it('still rejects a non-URL avatar', () => {
        expect(UserProfileSchema.safeParse({ avatar: 'not-a-url' }).success).toBe(false);
    });

    it('still rejects a non-URL website', () => {
        expect(UserProfileSchema.safeParse({ website: 'not-a-url' }).success).toBe(false);
    });

    it('still rejects a one-character occupation', () => {
        expect(UserProfileSchema.safeParse({ occupation: 'x' }).success).toBe(false);
    });

    it('still rejects a non-string, non-null value', () => {
        expect(UserProfileSchema.safeParse({ bio: 42 }).success).toBe(false);
    });
});

describe('UserProfileReadSchema (READ) — a stored JSON null must not 500 the GET', () => {
    for (const field of PROFILE_FIELDS) {
        it(`accepts a stored \`${field}: null\``, () => {
            const result = UserProfileReadSchema.safeParse({ [field]: null });
            expect(result.success).toBe(true);
        });
    }

    it('accepts a whole cleared profile through the self access overlay', () => {
        // `UserSelfSchema` is what `stripWithSchema` applies to the profile GET
        // the edit form rehydrates from. This is the shape stored right after a
        // user clears every optional field.
        const result = UserSelfSchema.safeParse({
            id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
            slug: 'john-doe',
            profile: { avatar: null, bio: null, website: null, occupation: null }
        });
        expect(result.success).toBe(true);
    });

    // -----------------------------------------------------------------------
    // HOS-375 — a malformed stored `avatar` must not lock the owner out of
    // their own profile.
    //
    // `profile.avatar` is a JSONB path the seed fixtures and data-migration
    // `0037` write DIRECTLY, bypassing Zod, so a non-URL string is a reachable
    // stored state. `UserProfileReadSchema` is reached by
    // `UserProtectedSchema.profile` → `UserSelfSchema`, the response of
    // `GET`/`PATCH /api/v1/protected/users/:id`, and `stripWithSchema`
    // fail-closes to HTTP 500 — so a strict `.url()` here turned one bad stored
    // avatar into "you can no longer edit ANY field on your profile".
    //
    // Dropping `.url()` (rather than `.catch()`) is deliberate: `ZodCatch` has
    // no renderer in `@hono/zod-openapi` and this schema reaches the GLOBAL
    // OpenAPI document, where one unrenderable field 500s `/docs/openapi.json`.
    // -----------------------------------------------------------------------
    it.each([
        ['a bare relative path', 'avatars/john-doe.jpg'],
        ['a protocol-less host', 'example.com/a.jpg'],
        ['free text that is not a URL', 'not-a-url']
    ])('accepts a stored malformed avatar (%s)', (_label, avatar) => {
        const result = UserProfileReadSchema.safeParse({ avatar });
        expect(result.success).toBe(true);
    });

    it('accepts a malformed stored avatar through the self access overlay', () => {
        // The layer that actually 500s. Asserting only on the leaf schema would
        // miss a re-tightening anywhere along `UserSelfSchema` → `profile`.
        const result = UserSelfSchema.safeParse({
            id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
            slug: 'john-doe',
            profile: { avatar: 'avatars/john-doe.jpg', bio: 'Hola', website: null }
        });
        expect(result.success).toBe(true);
    });

    it('keeps the avatar URL bound on the WRITE schema', () => {
        // Non-vacuity + the read⊇write invariant: the leniency is a READ-side
        // overlay only. A user SUBMITTING a bad avatar must still get a 400,
        // otherwise this stops being "tolerate legacy data" and becomes "accept
        // anything forever".
        expect(UserProfileSchema.safeParse({ avatar: 'avatars/john-doe.jpg' }).success).toBe(false);
    });

    it('still rejects a stored avatar of the wrong type', () => {
        // Read ⊇ write widens the accepted FORMAT, not the accepted TYPE.
        expect(UserProfileReadSchema.safeParse({ avatar: 42 }).success).toBe(false);
    });
});
