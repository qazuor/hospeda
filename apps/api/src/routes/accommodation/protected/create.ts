/**
 * Protected create accommodation endpoint
 * Requires authentication
 */

import {
    type AccommodationCreateHttp,
    AccommodationCreateHttpSchema,
    AccommodationProtectedSchema,
    httpToDomainAccommodationCreate,
    PermissionEnum
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
    summary: 'Create accommodation',
    description: 'Creates a new accommodation. Requires ACCOMMODATION_CREATE permission.',
    tags: ['Accommodations'],
    requiredPermissions: [PermissionEnum.ACCOMMODATION_CREATE],
    requestBody: AccommodationCreateHttpSchema,
    responseSchema: AccommodationProtectedSchema,
    // HOS-1352: transitional until V3 (HOS-1357), see PR — removed PUBLISH_ACCOMMODATIONS entitlement gate.
    handler: async (
        ctx: Context,
        _params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => {
        const actor = getActorFromContext(ctx);
        // Convert HTTP input to domain input
        const domainInput = httpToDomainAccommodationCreate(body as AccommodationCreateHttp);
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
        // HOS-1352: transitional until V3 (HOS-1357), see PR — former plan gate removed; route permissions remain.
    }
});
