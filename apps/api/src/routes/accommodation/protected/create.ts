/**
 * Protected create accommodation endpoint
 * Requires authentication
 */

import {
    type AccommodationCreateHttp,
    AccommodationCreateHttpSchema,
    AccommodationProtectedSchema,
    httpToDomainAccommodationCreate,
    PermissionEnum,
    VerticalEnum
} from '@repo/schemas';
import { AccommodationService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';

import { getActorFromContext } from '../../../utils/actor';
import { stripRichDescriptionFields } from '../../../utils/entitlement-filter';
import { apiLogger } from '../../../utils/logger';
import { createProtectedRoute } from '../../../utils/route-factory';

const accommodationService = new AccommodationService({ logger: apiLogger });

/**
 * POST /api/v1/protected/accommodations
 * Create accommodation - Protected endpoint
 */
export const protectedCreateAccommodationRoute = createProtectedRoute({
    method: 'post',
    path: '/',
    listingAccess: { vertical: VerticalEnum.ACCOMMODATION, operation: 'CREATE' },
    summary: 'Create accommodation',
    description: 'Creates a new accommodation. Requires ACCOMMODATION_CREATE permission.',
    tags: ['Accommodations'],
    requiredPermissions: [PermissionEnum.ACCOMMODATION_CREATE],
    requestBody: AccommodationCreateHttpSchema,
    responseSchema: AccommodationProtectedSchema,
    // CREATE keeps drafts unlimited; PB1 counts published listings at publication (V6.1; V2.md:434-438).
    handler: async (
        ctx: Context,
        _params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => {
        const actor = getActorFromContext(ctx);
        // HOS-1909: the shared create schema accepts `ownerId`, but in the protected
        // tier the owner is ALWAYS the caller. A body-supplied value is discarded
        // (not rejected, so clients that echo their own id keep working) so a signed-in
        // user cannot create a listing owned by someone else. Creating on behalf of
        // another owner is an admin-tier capability (action 15) with its own route.
        const domainInput = httpToDomainAccommodationCreate({
            ...(body as AccommodationCreateHttp),
            ownerId: actor.id
        });
        const result = await accommodationService.create(actor, domainInput);

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        // BETA-199: `AccommodationProtectedSchema` declares the premium
        // rich-description pair so the owner's editor GET can show translation
        // status for it. That GET gates the pair on the owner's plan; EVERY other
        // route on this schema — including this one — drops it unconditionally.
        // This response echoes a mutated entity and has no use for rich text, so
        // an unconditional drop keeps the payload identical to what it was before
        // the pair was declared, with no entitlement lookup and no gate to
        // get wrong. See the schema comment for the full contract.
        return stripRichDescriptionFields(result.data);
    },
    options: {
        // CREATE keeps drafts unlimited; PB1 counts published listings at publication (V6.1; V2.md:434-438).
    }
});
