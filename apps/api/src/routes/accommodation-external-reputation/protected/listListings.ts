/**
 * GET /api/v1/protected/accommodations/:id/external-listings
 *
 * Returns `{listings, reputation}` — the non-deleted external listing configs
 * plus the accommodation-level reputation metadata the owner's editor needs
 * (HOS-290; it used to return a bare array).
 *
 * SPEC-237 T-008 — protected owner route.
 * Permission: ACCOMMODATION_UPDATE_OWN (the service pattern enforces ownership;
 * this read-only list applies the same check inline).
 */
import {
    AccommodationExternalListingModel,
    AccommodationExternalReputationModel,
    AccommodationModel
} from '@repo/db';
import {
    AccommodationExternalListingsResponseSchema,
    AccommodationIdSchema,
    PermissionEnum,
    ServiceErrorCode
} from '@repo/schemas';
import { ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { getActorFromContext } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { createProtectedRoute } from '../../../utils/route-factory';

const listingModel = new AccommodationExternalListingModel();
const reputationModel = new AccommodationExternalReputationModel();
const accommodationModel = new AccommodationModel();

/**
 * Upper bound for the reputation rows read below. The table holds one row per
 * (accommodation, platform) and `ExternalPlatformEnum` has four members, so
 * this is far above what can exist — but it is passed explicitly because
 * `BaseModelImpl.findAll` ALWAYS paginates and silently defaults to 20 (HOS-321).
 */
const MAX_PLATFORM_ROWS = 100;

/**
 * GET /api/v1/protected/accommodations/:id/external-listings
 *
 * Lists all non-deleted external listing configurations for the accommodation,
 * together with the accommodation-level reputation metadata (`showExternalReputation`
 * master toggle + most recent aggregate fetch). The actor must own the
 * accommodation or hold ACCOMMODATION_UPDATE_ANY.
 */
export const protectedListExternalListingsRoute = createProtectedRoute({
    method: 'get',
    path: '/{id}/external-listings',
    summary: 'List external listing configs and reputation metadata',
    description:
        'Returns `{listings, reputation}`: all non-deleted external platform listing configs registered for the accommodation, plus the accommodation-level reputation metadata (the `showExternalReputation` master toggle and the most recent aggregate fetch timestamp across platforms). Requires ownership or ACCOMMODATION_UPDATE_ANY.',
    tags: ['Accommodations', 'External Reputation'],
    requestParams: {
        id: AccommodationIdSchema
    },
    responseSchema: AccommodationExternalListingsResponseSchema,
    handler: async (ctx: Context, params: Record<string, unknown>) => {
        const actor = getActorFromContext(ctx);
        const accommodationId = params.id as string;

        const accommodation = await accommodationModel.findById(accommodationId);
        if (!accommodation || accommodation.deletedAt !== null) {
            throw new ServiceError(
                ServiceErrorCode.NOT_FOUND,
                `Accommodation not found: ${accommodationId}`
            );
        }

        const hasAny = (actor.permissions ?? []).includes(PermissionEnum.ACCOMMODATION_UPDATE_ANY);
        const hasOwn = (actor.permissions ?? []).includes(PermissionEnum.ACCOMMODATION_UPDATE_OWN);

        if (!hasAny && !(hasOwn && actor.id === accommodation.ownerId)) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied: ACCOMMODATION_UPDATE_OWN required and actor must own the accommodation'
            );
        }

        const rows = await listingModel.findByAccommodation(accommodationId);

        // The editor needs two accommodation-level values that do not live on a
        // listing row: the master toggle (a column on `accommodations`, already
        // loaded above for the ownership check) and the last successful
        // aggregate fetch. There is no other GET exposing the toggle — only the
        // PATCH that writes it — which is why this endpoint carries both
        // (HOS-290).
        const { items: reputationRows } = await reputationModel.findAll(
            { accommodationId },
            { pageSize: MAX_PLATFORM_ROWS }
        );

        // One row per platform, but the editor shows a single "last updated",
        // so the most recent one wins.
        const aggregateFetchedAt = reputationRows.reduce<Date | null>((latest, row) => {
            const fetchedAt = row.aggregateFetchedAt ? new Date(row.aggregateFetchedAt) : null;
            if (!fetchedAt) return latest;
            return latest === null || fetchedAt > latest ? fetchedAt : latest;
        }, null);

        apiLogger.debug({
            message: 'Listed external listings',
            accommodationId,
            count: rows.length,
            actorId: actor.id
        });

        return {
            listings: rows,
            reputation: {
                showExternalReputation: accommodation.showExternalReputation ?? false,
                aggregateFetchedAt
            }
        };
    }
});
