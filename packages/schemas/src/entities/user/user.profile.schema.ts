import { z } from 'zod';

/**
 * User Profile schema definition using Zod for validation.
 * Represents the profile information for a user.
 *
 * This is the WRITE/entity schema: `UserCreateInputSchema`/`UserUpdateInputSchema`
 * derive from `UserSchema` (which embeds this), so these bounds gate what the
 * admin user-edit form and `PUT/PATCH /api/v1/admin|protected/users/:id` persist.
 * They MUST stay strict. The read⊇write relaxation for the profile RESPONSE
 * lives in {@link UserProfileReadSchema} instead, mirroring the accommodation
 * access-schema pattern — so a legacy value never 500s a GET while writes stay
 * validated (HOS-190).
 *
 * Every field is `.nullish()` rather than `.optional()`, and that is
 * load-bearing rather than cosmetic (HOS-375). `users.profile` is declared a
 * MERGEABLE JSONB column on `UserModel`, so a PATCH that omits a key now LEAVES
 * that key's stored value alone — which is exactly what stops the web form
 * (`bio`/`website`/`occupation`) and the admin form (`bio`/`avatar`) from
 * deleting each other's half of the column. The price of that merge is that
 * clearing a field can no longer be expressed by omission: it is an explicit
 * `null`. If these fields rejected `null`, every "I deleted my bio" save would
 * 400 and the field would be permanently un-clearable.
 *
 * Widening `string | undefined` to `string | null | undefined` is ADDITIVE, so
 * it is allowed under the package's compatibility policy
 * (`docs/guides/schema-compat-policy.md`): no payload that validated before
 * stops validating. The bounds themselves are untouched — a non-null `bio` is
 * still 10..300 characters.
 */
export const UserProfileSchema = z.object({
    avatar: z.string().url({ message: 'zodError.user.profile.avatar.url' }).nullish(),
    bio: z
        .string()
        .min(10, { message: 'zodError.user.profile.bio.min' })
        .max(300, { message: 'zodError.user.profile.bio.max' })
        .nullish(),
    website: z.string().url({ message: 'zodError.user.profile.website.url' }).nullish(),
    occupation: z
        .string()
        .min(2, { message: 'zodError.user.profile.occupation.min' })
        .max(100, { message: 'zodError.user.profile.occupation.max' })
        .nullish()
});

/**
 * Type export for User Profile
 */
export type UserProfile = z.infer<typeof UserProfileSchema>;

/**
 * Lenient READ overlay for the user `profile` JSONB column (HOS-190, HOS-302).
 *
 * Drops the `bio`/`occupation` length bounds AND the `avatar` URL format.
 * `users.profile` is an unbounded JSONB column, so a legacy/imported row can
 * legitimately hold a 5-character bio that today's WRITE bounds reject. Every
 * read path that surfaces it — the self/admin access family AND the query
 * family the admin entity-list client re-parses with a fail-closed `safeParse`
 * — must use this shape, or one stored row takes the surface down.
 *
 * Lives next to {@link UserProfileSchema} (the WRITE shape) as the SINGLE
 * definition, mirroring `ContactInfoReadSchema` in `common/contact.schema.ts`.
 * It was module-private inside `user.access.schema.ts` until HOS-302, which is
 * how the query family ended up with a second, stricter idea of "lenient user".
 *
 * The fields are `.nullish()` for a reason the WRITE shape only half explains
 * (HOS-375): once a cleared field is persisted as an explicit `null` inside the
 * merged JSONB, that JSON null is what comes BACK on every subsequent read. The
 * access family is applied by `stripWithSchema`, which FAIL-CLOSES to HTTP 500
 * on a mismatch — so a read shape that still said `string | undefined` would
 * turn "this user once deleted their bio" into a permanent 500 on their own
 * profile GET. Read ⊇ write is not optional here.
 *
 * `avatar` drops `.url()` for the same reason and a concrete one (HOS-375):
 * `profile.avatar` is a JSONB path the seed fixtures and data-migration `0042`
 * write DIRECTLY, bypassing Zod, so nothing guarantees the stored value parses
 * as a URL. This schema is reached by `UserProtectedSchema.profile` →
 * `UserSelfSchema`, the response of `GET`/`PATCH
 * /api/v1/protected/users/:id` — so one malformed stored avatar locked the
 * owner out of editing every OTHER field on their own profile. The format
 * constraint stays on {@link UserProfileSchema} (WRITE), where a rejection is a
 * 400 the caller can fix.
 *
 * DO NOT reach for `.catch(undefined)` to keep both. `ZodCatch` has no renderer
 * in `@hono/zod-openapi` / `@asteasolutions/zod-to-openapi`, and this schema is
 * rendered into the GLOBAL OpenAPI document via the routes that return
 * `UserSelfSchema`: one unrenderable field makes `getOpenAPIDocument()` throw
 * and 500s `/docs/openapi.json` for every environment (guarded by `apps/api`'s
 * `test/routes/openapi-doc-generation.test.ts`).
 *
 * `website` deliberately KEEPS `.url()` here: it is out of scope for HOS-375
 * and has no reported malformed-value incident, so widening it is left as a
 * separate, evidence-backed decision rather than collateral drift.
 */
export const UserProfileReadSchema = z.object({
    avatar: z.string().nullish(),
    bio: z.string().nullish(),
    website: z.string().url({ message: 'zodError.user.profile.website.url' }).nullish(),
    occupation: z.string().nullish()
});

/**
 * Type export for the lenient READ variant of User Profile
 */
export type UserProfileRead = z.infer<typeof UserProfileReadSchema>;
