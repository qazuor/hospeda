import { z } from '@hono/zod-openapi';
/**
 * Public user by slug endpoint
 * Returns minimal public profile fields for an author page
 */
import { ServiceErrorCode, UserSchema } from '@repo/schemas';
import { ServiceError, UserService } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../utils/actor.js';
import { apiLogger } from '../../../utils/logger.js';
import { createPublicRoute } from '../../../utils/route-factory.js';

const userService = new UserService({ logger: apiLogger });

/**
 * Public author profile response schema — only exposes safe public fields.
 * Deliberately excludes email, phone, role, settings, and any audit fields.
 */
const UserAuthorPublicResponseSchema = z.object({
    id: UserSchema.shape.id,
    displayName: UserSchema.shape.displayName,
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

        const result = await userService.getBySlug(actor, slug);

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        if (!result.data) {
            throw new ServiceError(
                ServiceErrorCode.NOT_FOUND,
                `User with slug "${slug}" not found`
            );
        }

        const user = result.data;

        return {
            id: user.id,
            displayName: user.displayName ?? null,
            slug: user.slug,
            avatar: user.profile?.avatar ?? null,
            bio: user.profile?.bio ?? null
        };
    },
    options: {
        cacheTTL: 300,
        customRateLimit: { requests: 60, windowMs: 60000 }
    }
});
