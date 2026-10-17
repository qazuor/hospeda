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
import { OwnerListingListSchema, ProductDomainEnum, PublicationStatusEnum } from '@repo/schemas';
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
    emailUnverifiedOperation: 'READ_OWN',
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
            // V6.9b (HOS-1641): both flags read the single publication state.
            // Only a PUBLISHED listing is public and has a public page; every
            // protected route that prints something for a listing answers 404
            // for any other state, so a card must not offer those downloads.
            isPublic: listing.publicationStatus === PublicationStatusEnum.PUBLISHED,
            hasPublicPage: listing.publicationStatus === PublicationStatusEnum.PUBLISHED,
            publicationStatus: listing.publicationStatus
            // subscriptionStatus was removed with the legacy billing system
            // (HOS-1416).
        }));

        return { listings };
    }
});
