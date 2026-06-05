/**
 * Protected create accommodation endpoint
 * Requires authentication
 */
import { EntitlementKey } from '@repo/billing';
import {
    type AccommodationCreateHttp,
    AccommodationCreateHttpSchema,
    AccommodationProtectedSchema,
    PermissionEnum,
    httpToDomainAccommodationCreate
} from '@repo/schemas';
import { AccommodationService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { requireEntitlement } from '../../../middlewares/entitlement';
import { enforceAccommodationLimit } from '../../../middlewares/limit-enforcement';
import { getActorFromContext } from '../../../utils/actor';
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

        return result.data;
    },
    options: {
        // SPEC-145 T-004: entitlement gate BEFORE limit check — host must have the
        // PUBLISH_ACCOMMODATIONS entitlement (granted on all owner/complex plans)
        // before we even consult the accommodation-count limit.
        middlewares: [
            requireEntitlement(EntitlementKey.PUBLISH_ACCOMMODATIONS),
            enforceAccommodationLimit()
        ]
    }
});
