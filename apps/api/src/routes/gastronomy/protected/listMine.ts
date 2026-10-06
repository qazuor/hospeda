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
    LifecycleStatusEnum,
    OwnerListingListSchema,
    ProductDomainEnum,
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
    responseSchema: OwnerListingListSchema,
    handler: async (ctx: Context) => {
        const actor = getActorFromContext(ctx);
        const result = await gastronomyService.listOwn(actor);

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        const ownListings = result.data?.listings ?? [];

        const listings = ownListings.map((listing) => ({
            id: listing.id,
            vertical: ProductDomainEnum.GASTRONOMY,
            name: listing.name,
            slug: listing.slug,
            type: listing.type,
            isPublic: listing.visibility === VisibilityEnum.PUBLIC,
            // HOS-982 PR 2. BOTH clauses, and a second field rather than a
            // widening of `isPublic` above — see the schema for why. A row
            // that is PUBLIC but not ACTIVE has no public page, and every
            // protected route that prints something for a listing answers
            // 404 for it; a card that asked only `isPublic` would offer
            // downloads that cannot work and render a code that cannot scan.
            hasPublicPage:
                listing.lifecycleState === LifecycleStatusEnum.ACTIVE &&
                listing.visibility === VisibilityEnum.PUBLIC
            // subscriptionStatus was removed with the legacy billing system
            // (HOS-1416).
        }));

        return { listings };
    }
});
