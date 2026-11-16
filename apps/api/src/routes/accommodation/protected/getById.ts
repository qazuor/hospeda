/**
 * Protected get own accommodation by ID endpoint
 * Returns a single accommodation only if it is owned by the authenticated user.
 */

import { listingLocationModel } from '@repo/db';
import {
    AccommodationIdSchema,
    AccommodationProtectedSchema,
    PermissionEnum,
    VerticalEnum
} from '@repo/schemas';
import {
    AccommodationService,
    entityNotFoundError,
    getOwnerLocationExceptionView,
    ServiceError
} from '@repo/service-core';
import { readListingAccessFacts, resolveResourceStep } from '@repo/verticals';
import type { Context } from 'hono';

import {
    fetchProtectedAmenities,
    fetchProtectedFeatures
} from '../../../utils/accommodation-catalog-relations';
import { getActorFromContext } from '../../../utils/actor';
import { stripRichDescriptionFields } from '../../../utils/entitlement-filter';
import { getListingAccessPorts } from '../../../utils/listing-access/ports';
import { apiLogger } from '../../../utils/logger';
import { createProtectedRoute } from '../../../utils/route-factory';

const accommodationService = new AccommodationService({ logger: apiLogger });

/**
 * GET /api/v1/protected/accommodations/:id
 * Get own accommodation by ID - Protected endpoint
 *
 * Returns the accommodation only if the resource step admits the owner
 * or the actor holds ACCOMMODATION_VIEW_ALL, the inspection permission.
 * Returns 404 if the record is not found or belongs to a different user.
 *
 * HOS-321: the response is enriched with the `amenities` / `features` junction
 * relations. `AccommodationProtectedSchema` has always declared both, but
 * nothing populated them, so the web host editor built its form baseline with
 * `amenityIds: []` / `featureIds: []`. Beyond rendering saved selections as
 * unchecked, that made saving destructive: the PATCH diff sent whatever the
 * host ticked in that session as the complete target set, and
 * `syncAmenityJunction`'s exact-set contract deleted every other row.
 */
export const protectedGetOwnAccommodationByIdRoute = createProtectedRoute({
    method: 'get',
    path: '/{id}',
    summary: 'Get own accommodation by ID',
    description:
        'Returns a single accommodation owned by the authenticated user. Returns 404 if not found or not owned by the requesting user.',
    tags: ['Accommodations'],
    emailUnverifiedOperation: 'READ_OWN',
    // No permission gate: the handler enforces ownership in the service
    // layer and returns 404 if the row belongs to a different user. The
    // previous `ACCOMMODATION_LISTING_VIEW` requirement was the admin
    // listing permission, not granted to default HOST users — so hosts
    // could not even read their own properties through the web UI.
    requestParams: {
        id: AccommodationIdSchema
    },
    responseSchema: AccommodationProtectedSchema.nullable(),
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);

        const result = await accommodationService.getById(actor, params.id as string);

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        const accommodation = result.data;

        // Ownership check: only return if the actor is the owner.
        // ACCOMMODATION_VIEW_ALL is the inspection bypass (V5 §3.2 rule 1, HOS-1693).
        // ACCOMMODATION_UPDATE_ANY is a write permission and does not read foreign rows.
        // HOS-600: built by the shared helper, never spelled out here. The
        // literal this replaced was `'Accommodation not found'` while the
        // missing-row branch above re-throws the service's
        // `'accommodation not found'` — same 404, same NOT_FOUND code, and the
        // whole difference between "this listing is real and belongs to
        // somebody else" and "no such listing" lived in that capital A.
        const hasViewAll = actor.permissions?.includes(PermissionEnum.ACCOMMODATION_VIEW_ALL);
        if (!hasViewAll) {
            const access = resolveResourceStep({
                actorId: actor.id,
                facts: readListingAccessFacts({ entity: accommodation }),
                operation: 'READ_OWN'
            });
            if (!access.allowed) {
                throw entityNotFoundError({ entityName: AccommodationService.ENTITY_NAME });
            }
        }

        if (!accommodation) {
            return null;
        }

        // HOS-321: load the junction relations the service does not eager-load.
        // Both run only AFTER the ownership check, so a foreign/missing id never
        // triggers them — and together, because this GET blocks the editor
        // page's SSR and the lookup depends on nothing the junction queries
        // produce.
        const [amenitiesData, featuresData] = await Promise.all([
            fetchProtectedAmenities(accommodation.id),
            fetchProtectedFeatures(accommodation.id)
        ]);

        // The editor can read its own listing, but paid rich content follows
        // the listing owner's effective entitlement, including for admin readers.
        let canUseRichDescription = false;
        try {
            const userId = accommodation.ownerId;
            const vertical = VerticalEnum.ACCOMMODATION;
            const effective = await getListingAccessPorts().effectiveSet({ userId, vertical });
            canUseRichDescription =
                (effective.entitlements.get({
                    key: 'can_use_rich_description',
                    userId,
                    vertical
                }) ?? 0) > 0;
        } catch {
            apiLogger.warn(
                { accommodationId: accommodation.id },
                'Rich description entitlement lookup failed'
            );
        }
        const visibleAccommodation = canUseRichDescription
            ? accommodation
            : stripRichDescriptionFields(accommodation);
        return {
            ...visibleAccommodation,
            // `undefined` (not `[]`) when empty, mirroring the admin/public
            // routes: the field is `.optional()` on the response schema.
            amenities: amenitiesData.length > 0 ? amenitiesData : undefined,
            features: featuresData.length > 0 ? featuresData : undefined,
            // HOS-1810: the draft warning. A flag, never an id.
            locationDuplicate: await listingLocationModel.hasOwnDuplicate({
                vertical: VerticalEnum.ACCOMMODATION,
                id: accommodation.id
            }),
            // HOS-2192: the owner's exception request status. No ids of other listings.
            locationException: await getOwnerLocationExceptionView({
                vertical: VerticalEnum.ACCOMMODATION,
                listingId: accommodation.id
            })
        };
    }
});
