/**
 * Protected create accommodation DRAFT endpoint.
 *
 * Receives the minimum payload needed to spin up a placeholder accommodation
 * (name, summary, type, destinationId, optional description) and persists it
 * with `lifecycleState: DRAFT` and the authenticated user as owner.
 *
 * Used by the public web "publicar" entry point. After the POST succeeds the
 * web app redirects the host to the admin panel edit page so they can fill
 * in the rest of the listing (location, price, photos, amenities, etc.).
 */
import { EntitlementKey } from '@repo/billing';
import {
    type AccommodationCreateDraftHttp,
    AccommodationCreateDraftHttpSchema,
    AccommodationProtectedSchema,
    PermissionEnum,
    httpToDomainAccommodationCreateDraft
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
 * POST /api/v1/protected/accommodations/draft
 * Create accommodation in DRAFT state with the minimum required fields.
 */
export const protectedCreateAccommodationDraftRoute = createProtectedRoute({
    method: 'post',
    path: '/draft',
    summary: 'Create accommodation draft',
    description:
        'Creates a new accommodation with lifecycleState=DRAFT and the minimum required fields. Requires ACCOMMODATION_CREATE permission.',
    tags: ['Accommodations'],
    requiredPermissions: [PermissionEnum.ACCOMMODATION_CREATE],
    requestBody: AccommodationCreateDraftHttpSchema,
    responseSchema: AccommodationProtectedSchema,
    handler: async (
        ctx: Context,
        _params: Record<string, unknown>,
        body: Record<string, unknown>
    ) => {
        const actor = getActorFromContext(ctx);
        const domainInput = httpToDomainAccommodationCreateDraft(
            body as AccommodationCreateDraftHttp,
            actor.id
        );
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
