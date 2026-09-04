/**
 * Public accommodation list endpoint
 * Returns paginated list of public accommodations with filtering, search, and sorting.
 *
 * Supported filters (all wired through to the model via service.search()):
 * - type: accommodation type (direct column match)
 * - isFeatured: featured flag (direct column match)
 * - destinationId: filter by destination (direct column match)
 * - q: full-text search on name and description
 * - minPrice, maxPrice: price range (JSONB field)
 * - minGuests, maxGuests: guest capacity range (JSONB extraInfo.capacity)
 * - minBedrooms, maxBedrooms: bedroom count range (JSONB extraInfo.bedrooms)
 * - minBathrooms, maxBathrooms: bathroom count range (JSONB extraInfo.bathrooms)
 * - minRating: minimum average rating
 * - amenities: array of amenity UUIDs (EXISTS subquery filter)
 * - features: array of feature UUIDs (EXISTS subquery filter)
 *
 * Sorting:
 * - `sortBy`/`sortOrder`: legacy single-column sort. Whitelisted via `sanitizeSortBy`.
 * - `sorts`: multi-column compound sort, `?sorts=field:order,field:order` (max 5).
 *           Whitelisted via `sanitizeSorts`. Takes precedence over `sortBy`.
 * - `featuredFirst`: FORCED to `true` server-side. Featured accommodations are
 *           ALWAYS returned before non-featured within any sort. The client
 *           cannot opt out — any `?featuredFirst=false` is ignored.
 * - Stable `id DESC` tiebreaker is appended by the model to guarantee
 *           deterministic pagination across pages when leading sort keys tie.
 */
import { EntitlementKey } from '@repo/billing';
import {
    AccommodationPublicSchema,
    type AccommodationSearchHttp,
    AccommodationSearchHttpSchema,
    httpToDomainAccommodationSearch,
    type SortField
} from '@repo/schemas';
import { AccommodationService, SearchHistoryService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { hasEntitlement } from '../../../middlewares/entitlement';
import { resolveOwnerEntitlementsForOwnerIds } from '../../../middlewares/owner-entitlement';
import type { AppBindings } from '../../../types';
import { resolvePublicIsFeatured } from '../../../utils/accommodation-featured';
import { createGuestActor, getActorFromContext, isGuestActor } from '../../../utils/actor';
import type { AccommodationData } from '../../../utils/entitlement-filter';
import {
    filterAccommodationListByOwnerEntitlements,
    stripRichDescriptionFields
} from '../../../utils/entitlement-filter';
import { apiLogger } from '../../../utils/logger';
import { extractPaginationParams, getPaginationResponse } from '../../../utils/pagination';
import { createPublicListRoute } from '../../../utils/route-factory';
import { resolveQuickAmenityFlags } from './quick-amenity-resolver';

const accommodationService = new AccommodationService({ logger: apiLogger });
const searchHistoryService = new SearchHistoryService({ logger: apiLogger });

/**
 * Allowed sort fields for public accommodation list.
 *
 * `mostSaved` and `price` are synthetic fields handled by the model:
 * - `mostSaved` runs a correlated subquery against `user_bookmarks` and
 *   depends on `idx_user_bookmarks_entity_active` (SPEC-098 T-008 / T-052,
 *   migration `0019_user_bookmarks_entity_active_index.sql`).
 * - `price` extracts the base nightly price from the JSONB `price` column
 *   via `(price->>'price')::numeric` with NULLS LAST so unpriced rows do
 *   not dominate the first page of an ascending sort.
 *
 * Other entries map directly to columns on the `accommodations` table.
 */
const ALLOWED_SORT_FIELDS = new Set([
    'name',
    'createdAt',
    'averageRating',
    'reviewsCount',
    'isFeatured',
    'mostSaved',
    'price',
    // Synthetic sort field — orders by haversine distance from the
    // (latitude, longitude) center. Silently dropped by the model layer when
    // no center is supplied, so it stays inert until the user activates the
    // geo-radius filter.
    'distance'
]);

/**
 * Validates the sortBy field against the allowed public sort columns.
 * Returns undefined if the field is not in the allow-list to prevent
 * sorting on internal or sensitive columns.
 *
 * Guards the legacy single-sort fallback path. Coexists with `sanitizeSorts`;
 * both share `ALLOWED_SORT_FIELDS` as the single source of truth.
 */
function sanitizeSortBy(sortBy: string | undefined): string | undefined {
    if (sortBy && ALLOWED_SORT_FIELDS.has(sortBy)) {
        return sortBy;
    }
    return undefined;
}

/**
 * Filters the multi-column `sorts[]` array against the public allow-list.
 * Any entry whose `field` is not whitelisted is silently dropped. If the
 * resulting array is empty, returns `undefined` so the model falls back to
 * `sortBy`/`sortOrder` (and then to the stable `id DESC` tiebreaker).
 */
export function sanitizeSorts(sorts: SortField[] | undefined): SortField[] | undefined {
    if (!sorts) return undefined;
    const filtered = sorts.filter((s) => ALLOWED_SORT_FIELDS.has(s.field));
    return filtered.length > 0 ? filtered : undefined;
}

/**
 * GET /api/v1/public/accommodations
 * List accommodations - Public endpoint
 *
 * All filter params from AccommodationSearchHttpSchema are converted to the
 * domain search input via httpToDomainAccommodationSearch and forwarded to
 * accommodationService.search(), which delegates to model.search() with
 * full support for price ranges, capacity ranges, rating, and amenity filters.
 */
export const publicListAccommodationsRoute = createPublicListRoute({
    method: 'get',
    path: '/',
    summary: 'List accommodations',
    description: 'Returns a paginated list of public accommodations',
    tags: ['Accommodations'],
    requestQuery: AccommodationSearchHttpSchema.shape,
    responseSchema: AccommodationPublicSchema,
    handler: async (ctx, _params, _body, query) => {
        const actor = getActorFromContext(ctx);
        const { page, pageSize } = extractPaginationParams(query || {});

        // Convert all HTTP query params to domain search input.
        // This maps: type, isFeatured, destinationId, q, minPrice, maxPrice,
        // minGuests, maxGuests, minBedrooms, maxBedrooms, minBathrooms,
        // maxBathrooms, minRating, maxRating, amenities, sortBy, sortOrder,
        // currency, latitude, longitude, radius, checkIn, checkOut, isAvailable.
        const httpQuery = (query ?? {}) as AccommodationSearchHttp;
        const domainParams = httpToDomainAccommodationSearch(httpQuery);

        // Resolve the public boolean shortcut flags (`hasWifi`, `hasPool`,
        // `hasParking`, `allowsPets`) to `anyAmenityGroups`. Slug→ID lookup is
        // cached for the lifetime of the API process. Each flag becomes one
        // inner array (OR within), and the model AND-joins the groups so
        // multiple toggles narrow the result set as expected.
        const quickAmenityGroups = await resolveQuickAmenityFlags({
            hasWifi: httpQuery.hasWifi,
            hasPool: httpQuery.hasPool,
            hasParking: httpQuery.hasParking,
            allowsPets: httpQuery.allowsPets
        });

        // Enforce the public allow-list for sort fields to prevent sorting
        // on internal or sensitive columns.
        const safeSortBy = sanitizeSortBy(domainParams.sortBy);

        // HOS-353: resolve visibility against a GUEST actor, never the caller.
        //
        // `_executeSearch` derives `excludeRestricted` / `excludeOwnerSuspended` /
        // `excludePlanRestricted` / `activeOnly` from the actor, so a VIP or a
        // holder of ACCOMMODATION_VIEW_ALL gets RESTRICTED, DRAFT, owner-suspended
        // and plan-restricted rows. This route is the first entry of
        // PUBLIC_CACHE_ENDPOINTS and its cache key carries no actor, so that widened
        // response is then replayed to every anonymous visitor for the TTL. The
        // service behavior is correct and stays as it is — it is load-bearing for
        // the protected and admin tiers; what must not vary is what a SHARED-cached
        // handler asks for. Same shape as `getByDestination` and
        // `getTopRatedByDestination`, which already resolve against a guest actor.
        //
        // The real `actor` is still used below for the search-history side effect:
        // that is a per-caller WRITE, not part of the cached payload.
        const result = await accommodationService.search(createGuestActor(), {
            ...domainParams,
            ...(quickAmenityGroups.length > 0 ? { anyAmenityGroups: quickAmenityGroups } : {}),
            page,
            pageSize,
            sortBy: safeSortBy,
            sortOrder: safeSortBy ? (domainParams.sortOrder ?? 'asc') : undefined,
            sorts: sanitizeSorts(domainParams.sorts),
            // Forced server-side: featured accommodations always appear first on
            // the public listing, regardless of what the client requested in the
            // `?featuredFirst=...` query parameter.
            featuredFirst: true
        });

        if (result.error) {
            throw new ServiceError(result.error.code, result.error.message);
        }

        // SPEC-289 write-hook: fire-and-forget search history recording.
        // Gate conditions (all must be true to record):
        //   1. Actor is authenticated (not a GUEST)
        //   2. Actor has CAN_VIEW_SEARCH_HISTORY entitlement (Plus / VIP plans)
        //   3. User has not opted out (checked inside service.record())
        // Never blocks or fails the search response — errors are caught and logged.
        if (
            !isGuestActor(actor) &&
            hasEntitlement(ctx as Context<AppBindings>, EntitlementKey.CAN_VIEW_SEARCH_HISTORY)
        ) {
            void searchHistoryService
                .record(actor, {
                    queryText: httpQuery.q ?? null,
                    filters: {
                        destinationId: httpQuery.destinationId,
                        minPrice: httpQuery.minPrice,
                        maxPrice: httpQuery.maxPrice,
                        currency: httpQuery.currency,
                        minGuests: httpQuery.minGuests,
                        maxGuests: httpQuery.maxGuests,
                        minBedrooms: httpQuery.minBedrooms,
                        maxBedrooms: httpQuery.maxBedrooms,
                        minBathrooms: httpQuery.minBathrooms,
                        maxBathrooms: httpQuery.maxBathrooms,
                        minRating: httpQuery.minRating,
                        maxRating: httpQuery.maxRating,
                        isFeatured: httpQuery.isFeatured,
                        isAvailable: httpQuery.isAvailable,
                        hasPool: httpQuery.hasPool,
                        hasWifi: httpQuery.hasWifi,
                        allowsPets: httpQuery.allowsPets,
                        hasParking: httpQuery.hasParking,
                        type: httpQuery.type,
                        types: httpQuery.types,
                        amenities: httpQuery.amenities,
                        features: httpQuery.features,
                        checkIn: httpQuery.checkIn ? new Date(httpQuery.checkIn) : undefined,
                        checkOut: httpQuery.checkOut ? new Date(httpQuery.checkOut) : undefined
                    },
                    resultCount: result.data?.total ?? null
                })
                .catch((err) => {
                    apiLogger.warn(
                        'SPEC-289 write-hook: search history record failed (fire-and-forget)',
                        err instanceof Error ? err.message : String(err)
                    );
                });
        }

        // SPEC-187 / SPEC-212 data-level omission: richDescription and its i18n
        // sibling are PREMIUM fields gated per-owner by the entitlement system.
        // This card-listing endpoint never renders them, so BOTH are stripped
        // before reaching the response payload — fail-closed and independent of
        // any schema change.
        const rawItems = result.data?.items || [];

        // Deduplicate ownerIds for this page — shared by the AI_CHAT badge (F1)
        // and the isVerified badge gate (SPEC-291 Phase 3b). Computing once avoids
        // a second pass over the items array.
        const uniqueOwnerIds = [
            ...new Set(
                rawItems
                    .map((item) => (item as { ownerId?: string }).ownerId)
                    .filter((id): id is string => typeof id === 'string' && id.length > 0)
            )
        ];

        // F1 + SPEC-291 Phase 3b: ONE owner-entitlement resolution serves both
        // the "Chat IA" badge and the `isVerified` badge gate.
        //
        // HOS-1084 collapsed what used to be two independent resolutions of the
        // same fact. AI_CHAT was resolved per owner through a route-local
        // 5-minute `Map` (`ownerAiChatCache`) while the verified gate went
        // through the batch resolver's own 5-minute `Map` — two per-process
        // caches, two expiries, over one owner-level entitlement set. Both are
        // gone: the batch resolver now reads the shared, webhook-fresh
        // `entity_subscriptions` cache, so a page costs one batched cache read
        // plus one plan lookup per DISTINCT plan, and the badge stops depending
        // on which API instance answered.
        //
        // Fail-closed is preserved end to end: a resolution failure yields an
        // empty entitlement array for that owner, which shows no badge.
        const ownerEntitlementsMap = await resolveOwnerEntitlementsForOwnerIds(uniqueOwnerIds);

        const rawMappedItems = rawItems.map((item) => {
            const ownerId = (item as { ownerId?: string }).ownerId;
            const ownerEntitlements = ownerId ? ownerEntitlementsMap.get(ownerId) : undefined;
            return {
                ...stripRichDescriptionFields(item),
                // HOS-929: public read treats holding either the admin-curated
                // `isFeatured` flag OR the billing-derived `featuredByEntitlement`
                // flag as featured. `featuredByEntitlement` itself is stripped by
                // `AccommodationPublicSchema` (never in its pick).
                isFeatured: resolvePublicIsFeatured(
                    item as { isFeatured: boolean; featuredByEntitlement?: boolean }
                ),
                hasAiChat: ownerEntitlements?.includes(EntitlementKey.AI_CHAT) ?? false
            };
        });

        // SPEC-291 Phase 3b: gate isVerified by owner billing entitlement.
        // Pure synchronous pass over the already-mapped items — no extra DB calls.
        const items = filterAccommodationListByOwnerEntitlements(
            rawMappedItems as AccommodationData[],
            ownerEntitlementsMap
        );

        return {
            items,
            pagination: getPaginationResponse(result.data?.total || 0, { page, pageSize })
        };
    },
    options: {
        cacheTTL: 300, // Cache for 5 minutes
        customRateLimit: { requests: 200, windowMs: 60000 }
    }
});
