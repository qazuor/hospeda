import { z } from '@hono/zod-openapi';
/**
 * Public user by slug endpoint
 * Returns minimal public profile fields for an author page
 */
import { ServiceErrorCode, UserNameReadFields, UserSchema } from '@repo/schemas';
import { ServiceError, UserService } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../utils/actor.js';
import { apiLogger } from '../../../utils/logger.js';
import { createPublicRoute } from '../../../utils/route-factory.js';

const userService = new UserService({ logger: apiLogger });

/**
 * Public author profile response schema — only exposes safe public fields.
 * Deliberately excludes email, phone, role, settings, and any audit fields.
 *
 * `displayName` is the ONLY lenient field here, and deliberately so (HOS-302).
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
 * Exported so the response contract can be asserted directly in tests without
 * standing up a seeded database.
 */
export const UserAuthorPublicResponseSchema = z.object({
    id: UserSchema.shape.id,
    displayName: UserNameReadFields.displayName,
    slug: UserSchema.shape.slug,
    avatar: z.string().url().optional().nullable(),
    bio: z.string().optional().nullable()
});

/**
 * GET /api/v1/public/users/by-slug/:slug
 * Retrieve minimal public profile for a user by URL slug.
 * Used by the author page (/publicaciones/autor/{slug}/).
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
        'Returns id, displayName, slug, avatar, and bio. ' +
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
