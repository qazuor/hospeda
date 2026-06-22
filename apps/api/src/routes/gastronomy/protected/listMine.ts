/**
 * Protected "list my gastronomy listings" endpoint (SPEC-249 T-006).
 *
 * Returns the authenticated actor's OWN gastronomy listings as lightweight
 * summaries for the web self-service area (`mi-cuenta/comercio`). Ownership is
 * the gate — `GastronomyService.listOwn` hard-scopes to `ownerId = actor.id`,
 * so a tourist or another owner simply gets an empty list.
 *
 * MUST be registered BEFORE the `/{id}` route so Hono does not treat the literal
 * `mine` path segment as an `:id` param.
 */
import {
    CommerceEntityTypeEnum,
    CommerceOwnerListingListSchema,
    VisibilityEnum
} from '@repo/schemas';
import { GastronomyService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createProtectedRoute } from '../../../utils/route-factory';

const gastronomyService = new GastronomyService({ logger: apiLogger });

/**
 * GET /api/v1/protected/gastronomies/mine
 * Lists the authenticated owner's own gastronomy listings (summary view).
 */
export const protectedListMyGastronomyRoute = createProtectedRoute({
    method: 'get',
    path: '/mine',
    summary: 'List my gastronomy listings (protected)',
    description: "Returns the authenticated owner's own gastronomy listings as summaries",
    tags: ['Gastronomy'],
    responseSchema: CommerceOwnerListingListSchema,
    handler: async (ctx: Context) => {
        const actor = getActorFromContext(ctx);
        const result = await gastronomyService.listOwn(actor);

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        const listings = (result.data?.listings ?? []).map((listing) => ({
            id: listing.id,
            vertical: CommerceEntityTypeEnum.GASTRONOMY,
            name: listing.name,
            slug: listing.slug,
            type: listing.type,
            isPublic: listing.visibility === VisibilityEnum.PUBLIC
        }));

        return { listings };
    }
});
