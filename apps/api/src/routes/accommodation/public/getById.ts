/**
 * Public get accommodation by ID endpoint
 * Returns a single accommodation by its ID.
 *
 * SPEC-187: richDescription is a premium field gated per-owner by the entitlement
 * system. This detail endpoint resolves the owner's entitlements after fetching
 * the accommodation and feeds them into filterAccommodationByEntitlements, which
 * omits richDescription when the owner lacks CAN_USE_RICH_DESCRIPTION. This
 * mirrors the pattern used by the getBySlug route (fail-closed: no ownerId →
 * empty entitlements → field omitted).
 */
import { AccommodationIdSchema, AccommodationPublicSchema } from '@repo/schemas';
import { AccommodationService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { resolveOwnerEntitlementsForOwnerId } from '../../../middlewares/owner-entitlement';
import { getActorFromContext } from '../../../utils/actor';
import { filterAccommodationByEntitlements } from '../../../utils/entitlement-filter';
import { apiLogger } from '../../../utils/logger';
import { createPublicRoute } from '../../../utils/route-factory';

const accommodationService = new AccommodationService({ logger: apiLogger });

/**
 * GET /api/v1/public/accommodations/:id
 * Get accommodation by ID - Public endpoint
 *
 * Applies owner-entitlement gating for richDescription (SPEC-187): resolves the
 * owning host's entitlements and passes them to filterAccommodationByEntitlements,
 * which omits richDescription when the owner lacks the CAN_USE_RICH_DESCRIPTION
 * entitlement. Fail-closed: if ownerId is absent, the empty entitlement set causes
 * the field to be omitted.
 */
export const publicGetAccommodationByIdRoute = createPublicRoute({
    method: 'get',
    path: '/{id}',
    summary: 'Get accommodation by ID',
    description: 'Retrieves an accommodation by its ID',
    tags: ['Accommodations'],
    requestParams: {
        id: AccommodationIdSchema
    },
    responseSchema: AccommodationPublicSchema.nullable(),
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const result = await accommodationService.getById(actor, params.id as string);

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        if (!result.data) {
            return null;
        }

        const accommodation = result.data;

        // SPEC-187 owner-entitlement gate: resolve the owning host's entitlements
        // and pass them to filterAccommodationByEntitlements. When the owner lacks
        // CAN_USE_RICH_DESCRIPTION, richDescription is omitted from the payload.
        // Fail-closed: no ownerId → empty entitlements → field omitted.
        const ownerEntitlements = accommodation.ownerId
            ? await resolveOwnerEntitlementsForOwnerId(accommodation.ownerId)
            : [];
        const filtered = filterAccommodationByEntitlements(ctx, accommodation, ownerEntitlements);

        return filtered;
    },
    options: {
        cacheTTL: 300,
        customRateLimit: { requests: 100, windowMs: 60000 }
    }
});
