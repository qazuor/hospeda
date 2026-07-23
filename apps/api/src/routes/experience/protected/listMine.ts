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
import {
    CommerceEntityTypeEnum,
    CommerceOwnerListingListSchema,
    VisibilityEnum
} from '@repo/schemas';
import {
    ExperienceService,
    getCommerceListingSubscriptionStatuses,
    ServiceError
} from '@repo/service-core';
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
    responseSchema: CommerceOwnerListingListSchema,
    handler: async (ctx: Context) => {
        const actor = getActorFromContext(ctx);
        const result = await experienceService.listOwn(actor);

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        const ownListings = result.data?.listings ?? [];

        // HOS-166 W1: batch-resolve each listing's commerce subscription
        // status (dunning/suspended surfacing) — one query for the whole
        // page instead of one per listing.
        const subscriptionStatuses = await getCommerceListingSubscriptionStatuses({
            entityType: CommerceEntityTypeEnum.EXPERIENCE,
            entityIds: ownListings.map((listing) => listing.id)
        });

        const listings = ownListings.map((listing) => ({
            id: listing.id,
            vertical: CommerceEntityTypeEnum.EXPERIENCE,
            name: listing.name,
            slug: listing.slug,
            type: listing.type,
            isPublic: listing.visibility === VisibilityEnum.PUBLIC,
            subscriptionStatus: subscriptionStatuses.get(listing.id) ?? null
        }));

        return { listings };
    }
});
