/**
 * Public user by slug endpoint
 * Returns minimal public profile fields for an author page
 */
import {
    ServiceErrorCode,
    SocialNetworkReadSchema,
    UserNameReadFields,
    UserSchema
} from '@repo/schemas';
import { ServiceError, UserService } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../utils/actor.js';
import { apiLogger } from '../../../utils/logger.js';
import { createPublicRoute } from '../../../utils/route-factory.js';
import { z } from '../../../utils/zod';

const userService = new UserService({ logger: apiLogger });

/**
 * Public author profile response schema — only exposes safe public fields.
 * Deliberately excludes email, phone, role, settings, and any audit fields.
 *
 * `socialNetworks` is the one conditional field (HOS-375 §6.7): the service
 * projects it ONLY when the profile OWNER set
 * `settings.publicProfileShowSocialNetworks`, and omits the key entirely
 * otherwise. `settings` itself stays excluded — only that one boolean's effect
 * is observable. The decision depends on the owner and never on the requesting
 * actor, so this response stays actor-blind.
 *
 * Note what that protects, precisely: `/api/v1/public/users` is in
 * `PRIVATE_CACHE_ENDPOINTS`, NOT `PUBLIC_CACHE_ENDPOINTS`, so it never reaches
 * the shared CDN. It IS stored in the API's in-memory cache (`cacheTTL: 300`
 * below) under `private:${path}${suffix}:${authorization ?? 'anonymous'}`, and
 * the web app authenticates with session COOKIES rather than an `Authorization`
 * header — so every logged-in visitor shares the `:anonymous` bucket with every
 * logged-out one. An actor-dependent field here would still be captured once
 * and replayed to everybody.
 *
 * It uses the LENIENT {@link SocialNetworkReadSchema}, not the write-side shape,
 * for the same reason `displayName` does: stored values predate the current
 * validation (bare handles, `m.facebook.com` variants, shortened links), and
 * `stripWithSchema` FAIL-CLOSES to HTTP 500 — on a PUBLIC author page.
 *
 * `displayName` is the other lenient field, and deliberately so (HOS-302).
 * `id` and `slug` keep their strict {@link UserSchema} shapes because the
 * database genuinely guarantees them: `id` is a UUID primary key and `slug` is a
 * NOT NULL column the route already matched a non-empty value against.
 * `display_name` guarantees nothing — it is a NULLABLE, unbounded `text` column
 * that Better Auth signup writes directly, bypassing the create/update Zod
 * schemas, which is how production ended up with rows holding `''`. The strict
 * shape is `.min(2).optional()`, so it rejects BOTH the persisted empty string
 * and the `null` this handler emits, and `stripWithSchema` FAIL-CLOSES to HTTP
 * 500 — on a PUBLIC author page. {@link UserNameReadFields} is the single source
 * of truth for that read-side leniency (type-only, bounds stay on the write
 * path), so it is imported rather than re-inlined here.
 *
 * `avatar` is the third lenient field, and for the same fail-closed reason.
 * `profile.avatar` is a JSONB path, not a validated column: the seed fixtures
 * and data-migration `0043` both write it directly, bypassing Zod entirely, so
 * nothing guarantees the stored value is a parseable URL. Leaving it strict
 * meant ONE malformed stored value 500'd the whole author page. The ABSENCE of
 * `.url()` is the load-bearing part — the same treatment
 * {@link EventAuthorPublicSchema} applies to the event author's avatar
 * (`packages/schemas/src/entities/event/event.access.schema.ts`) and the same
 * read⊇write split `ContactInfoReadSchema.website` uses: the format constraint
 * belongs to the WRITE path ({@link UserProfileSchema}), where a rejection is a
 * 400 the caller can fix, not to a response that fail-closes on data already in
 * the database.
 *
 * DO NOT "restore" strictness with `.catch(undefined)`. `ZodCatch` has no
 * renderer in `@hono/zod-openapi` / `@asteasolutions/zod-to-openapi`, and this
 * schema is registered on a route, so it is rendered into the GLOBAL OpenAPI
 * document: one unrenderable field makes `getOpenAPIDocument()` throw, which
 * 500s `/docs/openapi.json` and breaks `/docs`, `/reference` and `/ui` in every
 * environment. That is not a hypothesis — it is the regression
 * `test/routes/openapi-doc-generation.test.ts` caught on this very field.
 *
 * Consequence, by design: a malformed value now reaches the client as-is
 * instead of being erased here. Not rendering a broken `<img>` is the
 * CONSUMER's job — `apps/web`'s `isRenderableImageUrl` (`src/lib/media.ts`) is
 * where that decision lives, and the author page applies it before both the
 * `<img>` and the indexability gate.
 *
 * `isSystemAccount` is the one flag deliberately carried into a public payload
 * (HOS-375 §6.5 condition 1 / AC-13). The author page's indexability gate runs
 * in the web app and this is its only source: a system account must render
 * `noindex` even when it has published items, a bio and an avatar, and the same
 * predicate decides sitemap inclusion. It reveals nothing the sitemap does not
 * already reveal by omission, and it is a plain column read, so the response
 * stays actor-blind. It reuses the strict {@link UserSchema} shape because the
 * column is `NOT NULL DEFAULT false` and therefore always a real boolean.
 *
 * Exported so the response contract can be asserted directly in tests without
 * standing up a seeded database.
 */
export const UserAuthorPublicResponseSchema = z.object({
    id: UserSchema.shape.id,
    displayName: UserNameReadFields.displayName,
    slug: UserSchema.shape.slug,
    avatar: z.string().optional().nullable(),
    bio: z.string().optional().nullable(),
    socialNetworks: SocialNetworkReadSchema.optional(),
    isSystemAccount: UserSchema.shape.isSystemAccount
});

/**
 * GET /api/v1/public/users/by-slug/:slug
 * Retrieve minimal public profile for a user by URL slug.
 * Used by the author page (/{lang}/autores/{slug}/).
 *
 * Rate limited to 60 req/min per IP.
 * Returns 404 when the user does not exist or is soft-deleted.
 */
export const publicGetUserBySlugRoute = createPublicRoute({
    method: 'get',
    path: '/by-slug/{slug}',
    summary: 'Get user public profile by slug',
    description:
        'Retrieves a minimal public profile for a user by their URL slug. ' +
        'Returns id, displayName, slug, avatar, bio and isSystemAccount, plus ' +
        'socialNetworks when the profile owner opted in to showing them. ' +
        'Responds with 404 when the user does not exist or has been deleted.',
    tags: ['Users'],
    requestParams: {
        slug: z
            .string()
            .min(1)
            .max(100)
            .regex(/^[a-z0-9]+(?:[_-][a-z0-9]+)*$/, {
                message: 'slug must be lowercase alphanumeric with hyphens or underscores'
            })
            .openapi({ description: 'User URL slug' })
    },
    responseSchema: UserAuthorPublicResponseSchema.nullable(),
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const slug = params.slug as string;

        // `getPublicProfileBySlug`, NOT `getBySlug`: the latter runs the
        // self-or-USER_READ_ALL gate on the full user row, so every anonymous
        // visitor used to get a 403 here — which the web app renders as a 404,
        // making the author page unreachable from a post byline. See the method
        // docstring for why the gate is bypassed with a narrow projection
        // instead of being loosened.
        const result = await userService.getPublicProfileBySlug(actor, { slug });

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        if (!result.data) {
            throw new ServiceError(
                ServiceErrorCode.NOT_FOUND,
                `User with slug "${slug}" not found`
            );
        }

        return result.data;
    },
    options: {
        cacheTTL: 300,
        customRateLimit: { requests: 60, windowMs: 60000 }
    }
});
