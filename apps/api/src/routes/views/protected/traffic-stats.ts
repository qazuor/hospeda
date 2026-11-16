/**
 * GET /api/v1/protected/views/:entityType/:entityId/traffic-stats
 *
 * Owner-facing traffic stats (referrers, countries, devices and, for
 * accommodations, the contact funnel) for ONE listing, read from Umami
 * through `ListingTrafficStatsService` (HOS-2119, T-048, spec 6.5).
 *
 * **Authorization** mirrors the existing owner-stats routes
 * (`accommodations-me.ts`, `venue/protected/viewStats.ts`,
 * `experience/protected/viewStats.ts`), in the same order:
 *
 * 1. authentication (route factory, 401) and a guest guard via `isGuestActor`;
 * 2. `ACCOMMODATION_VIEW_OWN` for ACCOMMODATION only, as a route middleware that
 *    runs BEFORE input validation (venue and experience have no such permission,
 *    exactly like their sibling routes);
 * 3. `enforceUserGate` with the `view_basic_stats` key for the listing's vertical;
 * 4. ownership: the listing id must be in the caller's own ids
 *    (`findIdsByOwnerId`). A foreign or nonexistent listing answers the SAME 404.
 *
 * Input shape (entity type, uuid, window) is validated by the route factory
 * before the handler runs, so no unvalidated value reaches the database.
 *
 * **Umami failures never surface:** the service answers 200 with
 * `available: false`. The same shape is answered, without any outbound call,
 * when the Umami env vars are not all configured.
 *
 * PARTNER is not served here yet (T-049): it is excluded from the accepted
 * entity types, so it answers 400.
 *
 * @module routes/views/protected/traffic-stats
 * @see HOS-2119 T-048
 */

import { accommodationModel, experienceModel, venueModel } from '@repo/db';
import {
    EntityTypeEnum,
    ListingTrafficStatsEntityTypeSchema,
    ListingTrafficStatsQuerySchema,
    type ListingTrafficStatsResponse,
    ListingTrafficStatsResponseSchema,
    type ListingTrafficStatsWindow,
    PermissionEnum,
    ServiceErrorCode,
    VerticalEnum
} from '@repo/schemas';
import { entityNotFoundError, ListingTrafficStatsService, ServiceError } from '@repo/service-core';
import type { MiddlewareHandler } from 'hono';
import { z } from 'zod';

import { createUmamiStatsClient } from '../../../lib/umami-stats-client';
import { getActorFromContext, isGuestActor } from '../../../utils/actor';
import { env } from '../../../utils/env';
import { enforceUserGate } from '../../../utils/listing-access/user-gate';
import { apiLogger } from '../../../utils/logger';
import { createProtectedRoute } from '../../../utils/route-factory';
import { createApiTrafficStatsCache } from '../../../utils/traffic-stats-cache';

/**
 * Entity types served by this route. PARTNER is added by T-049, which owns its
 * own authorization split (`partner.ownerUserId`, no entitlement gate).
 */
const ServedEntityTypeSchema = ListingTrafficStatsEntityTypeSchema.exclude([
    EntityTypeEnum.PARTNER
]);

/** Entity types served by this route. */
type ServedEntityType = z.infer<typeof ServedEntityTypeSchema>;

/** Per-type authorization facts: vertical of the gate, ownership reader and 404 entity name. */
const LISTING_AUTH: Readonly<
    Record<
        ServedEntityType,
        {
            readonly vertical: VerticalEnum;
            readonly entityName: string;
            readonly findOwnedIds: (ownerId: string) => Promise<string[]>;
        }
    >
> = {
    [EntityTypeEnum.ACCOMMODATION]: {
        vertical: VerticalEnum.ACCOMMODATION,
        entityName: 'accommodation',
        findOwnedIds: (ownerId) => accommodationModel.findIdsByOwnerId(ownerId)
    },
    [EntityTypeEnum.VENUE]: {
        vertical: VerticalEnum.VENUE,
        entityName: 'venue',
        findOwnedIds: (ownerId) => venueModel.findIdsByOwnerId(ownerId)
    },
    [EntityTypeEnum.EXPERIENCE]: {
        vertical: VerticalEnum.EXPERIENCE,
        entityName: 'experience',
        findOwnedIds: (ownerId) => experienceModel.findIdsByOwnerId(ownerId)
    }
};

/** Process-wide service instance: `undefined` = not built yet, `null` = Umami not configured. */
let _service: ListingTrafficStatsService | null | undefined;

/**
 * Returns the process-wide traffic stats service, building it on first use, or
 * `null` when any of `HOSPEDA_UMAMI_URL`, `HOSPEDA_UMAMI_WEBSITE_ID_WEB` or
 * `HOSPEDA_UMAMI_API_KEY` is missing (the route then answers `available: false`
 * without calling Umami).
 *
 * @returns The service, or `null` when Umami reads are not configured.
 */
function getTrafficStatsService(): ListingTrafficStatsService | null {
    if (_service !== undefined) return _service;
    const baseUrl = env.HOSPEDA_UMAMI_URL;
    const websiteId = env.HOSPEDA_UMAMI_WEBSITE_ID_WEB;
    const apiKey = env.HOSPEDA_UMAMI_API_KEY;
    if (!baseUrl || !websiteId || !apiKey) {
        apiLogger.debug('Umami stats: URL, website id or API key not set; stats unavailable');
        _service = null;
        return _service;
    }
    _service = new ListingTrafficStatsService({
        statsClient: createUmamiStatsClient({ baseUrl, websiteId, apiKey }),
        cache: createApiTrafficStatsCache(),
        logger: apiLogger
    });
    return _service;
}

/**
 * Drops the cached service so the next request rebuilds it from the current env.
 * Test-only.
 */
export function _resetTrafficStatsServiceForTests(): void {
    _service = undefined;
}

/**
 * Builds the empty `available: false` response.
 *
 * @param input - The requested window
 * @returns A response that satisfies `ListingTrafficStatsResponseSchema`
 */
function buildUnavailableResponse(input: {
    readonly window: ListingTrafficStatsWindow;
}): ListingTrafficStatsResponse {
    return {
        window: input.window,
        available: false,
        referrers: [],
        countries: [],
        devices: [],
        contactFunnel: null
    };
}

/**
 * Route middleware: ACCOMMODATION requires `ACCOMMODATION_VIEW_OWN`, the same
 * permission its sibling owner-stats routes declare. Venue and experience have
 * no "view own" permission: ownership scoping is their gate.
 *
 * It runs after authentication and BEFORE the route's zod validation, so the
 * permission outcome never depends on the shape of the other inputs (a caller
 * without the permission gets 403 even with a malformed id, never a 400 that
 * would reveal validation behaviour). It reads the RAW `entityType` path param
 * and never touches the other inputs. The message does not name the permission.
 *
 * @param c - Hono context (actor already attached by the auth gate)
 * @param next - Continues the chain
 * @throws {ServiceError} FORBIDDEN when the caller lacks the permission
 */
const requireAccommodationViewOwn: MiddlewareHandler = async (c, next) => {
    if (c.req.param('entityType') === EntityTypeEnum.ACCOMMODATION) {
        const actor = getActorFromContext(c);
        if (!actor.permissions.includes(PermissionEnum.ACCOMMODATION_VIEW_OWN)) {
            throw new ServiceError(
                ServiceErrorCode.FORBIDDEN,
                'Permission denied to view accommodation stats'
            );
        }
    }
    await next();
};

/**
 * GET /{entityType}/{entityId}/traffic-stats?window=7d|30d|90d
 *
 * Authenticated owner endpoint returning Umami-backed traffic stats for one of
 * the caller's own listings. See the module docblock for the check order.
 */
export const listingTrafficStatsRoute = createProtectedRoute({
    method: 'get',
    path: '/{entityType}/{entityId}/traffic-stats',
    summary: 'Get traffic stats for one of my listings',
    description:
        'Returns referrers, countries, devices and (accommodations only) the contact funnel ' +
        'of one listing owned by the authenticated user over a rolling window (7d, 30d or 90d). ' +
        'Requires the view_basic_stats entitlement. A listing that is not the caller’s ' +
        'answers 404. When Umami fails, times out or is not configured the answer is 200 with ' +
        'available=false and empty arrays.',
    tags: ['Views'],
    requestParams: {
        entityType: ServedEntityTypeSchema,
        entityId: z.string().uuid()
    },
    requestQuery: ListingTrafficStatsQuerySchema.shape,
    responseSchema: ListingTrafficStatsResponseSchema,
    handler: async (ctx, params, _body, query) => {
        const actor = getActorFromContext(ctx);
        if (isGuestActor(actor)) {
            throw new ServiceError(ServiceErrorCode.UNAUTHORIZED, 'Authentication required');
        }
        const { entityType, entityId } = params as {
            entityType: ServedEntityType;
            entityId: string;
        };
        const { window } = query as { window: ListingTrafficStatsWindow };
        const auth = LISTING_AUTH[entityType];

        await enforceUserGate({
            userId: actor.id,
            vertical: auth.vertical,
            keys: ['view_basic_stats']
        });

        // Ownership: foreign and nonexistent listings take the same branch, so
        // the 404 is identical (error contract, H-72 / HOS-600).
        const ownedIds = await auth.findOwnedIds(actor.id);
        if (!ownedIds.includes(entityId.toLowerCase())) {
            throw entityNotFoundError({ entityName: auth.entityName });
        }

        const service = getTrafficStatsService();
        if (!service) return buildUnavailableResponse({ window });

        return service.getStats({ entityType, entityId, window });
    },
    options: {
        customRateLimit: { requests: 60, windowMs: 60_000 },
        middlewares: [requireAccommodationViewOwn]
    }
});
