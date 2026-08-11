/**
 * Public authors list endpoint
 * Returns a paginated list of authors with a public, indexable author page
 */
import { ServiceError, UserService } from '@repo/service-core';
import { z } from 'zod';
import { getActorFromContext } from '../../../utils/actor.js';
import { apiLogger } from '../../../utils/logger.js';
import { extractPaginationParams, getPaginationResponse } from '../../../utils/pagination.js';
import { createPublicListRoute } from '../../../utils/route-factory.js';

const userService = new UserService({ logger: apiLogger });

/**
 * One entry of the public authors list — everything a sitemap URL needs.
 *
 * Mirrors {@link PublicAuthorListItem} in `@repo/service-core`
 * (`packages/service-core/src/services/user/user.types.ts`). `updatedAt`
 * becomes the entry's `<lastmod>`: the author page renders the profile plus
 * two content lists, so a profile edit really is a change to that URL.
 *
 * Exported so the response contract can be asserted directly in tests
 * without standing up a seeded database.
 */
export const PublicAuthorListItemSchema = z.object({
    slug: z.string(),
    updatedAt: z.date()
});

/**
 * GET /api/v1/public/authors
 *
 * Lists the authors that have a public, indexable author page
 * (`/autores/<slug>/`). The only consumer is the dynamic sitemap
 * (HOS-375 §6.6); the row predicate lives in `UserModel.listPublicAuthors`.
 *
 * Deliberately mounted OUTSIDE `/api/v1/public/users` (a `PRIVATE_CACHE_ENDPOINTS`
 * prefix): the payload is actor-blind — it never depends on the requesting
 * actor — so it is safe to cache at the shared edge, and mounting it under
 * `/users` would classify it as browser-private and lose that caching
 * (`apps/api/src/middlewares/cache.constants.ts`).
 *
 * No authentication required. Runs no permission check — see
 * `UserService.listPublicAuthors` for why that is safe.
 */
export const publicListAuthorsRoute = createPublicListRoute({
    method: 'get',
    path: '/',
    summary: 'List public authors',
    description:
        'Returns a paginated list of authors with a public, indexable author page ' +
        '(HOS-375 §6.6). Each item is a slug + updatedAt pair only. Feeds the ' +
        'dynamic sitemap; not a general user directory.',
    tags: ['Authors'],
    responseSchema: PublicAuthorListItemSchema,
    handler: async (ctx, _params, _body, query) => {
        const actor = getActorFromContext(ctx);
        const { page, pageSize } = extractPaginationParams(query || {});

        const result = await userService.listPublicAuthors(actor, { page, pageSize });

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        return {
            items: result.data?.items ?? [],
            pagination: result.data?.pagination ?? getPaginationResponse(0, { page, pageSize })
        };
    },
    options: {
        cacheTTL: 300,
        customRateLimit: { requests: 200, windowMs: 60000 }
    }
});
