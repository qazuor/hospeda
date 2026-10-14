/**
 * Protected "list my experience listings" endpoint (SPEC-249 T-007).
 *
 * Returns the authenticated actor's OWN experience listings as lightweight
 * summaries for the web self-service area (`mi-cuenta/comercio`). Ownership is
 * the gate — `ExperienceService.listOwn` hard-scopes to `ownerId = actor.id`,
 * so a tourist or another owner simply gets an empty list.
 *
 * MUST be registered BEFORE the `/{id}` route so Hono does not treat the literal
 * `mine` path segment as an `:id` param.
 */
import { OwnerListingListSchema, ProductDomainEnum, PublicationStatusEnum } from '@repo/schemas';
import { ExperienceService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createProtectedRoute } from '../../../utils/route-factory';

const experienceService = new ExperienceService({ logger: apiLogger });

/**
 * GET /api/v1/protected/experiences/mine
 * Lists the authenticated owner's own experience listings (summary view).
 */
export const protectedListMyExperienceRoute = createProtectedRoute({
    method: 'get',
    path: '/mine',
    summary: 'List my experience listings (protected)',
    description: "Returns the authenticated owner's own experience listings as summaries",
    tags: ['Experience'],
    responseSchema: OwnerListingListSchema,
    handler: async (ctx: Context) => {
        const actor = getActorFromContext(ctx);
        const result = await experienceService.listOwn(actor);

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        const ownListings = result.data?.listings ?? [];

        const listings = ownListings.map((listing) => ({
            id: listing.id,
            vertical: ProductDomainEnum.EXPERIENCE,
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
