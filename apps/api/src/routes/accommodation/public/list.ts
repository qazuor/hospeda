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
    type SortField,
    httpToDomainAccommodationSearch
} from '@repo/schemas';
import { AccommodationService, SearchHistoryService, ServiceError } from '@repo/service-core';
import type { Context } from 'hono';
import { hasEntitlement } from '../../../middlewares/entitlement';
import { resolveOwnerEntitlementsForOwnerId } from '../../../middlewares/owner-entitlement';
import type { AppBindings } from '../../../types';
import { getActorFromContext, isGuestActor } from '../../../utils/actor';
import { apiLogger } from '../../../utils/logger';
import { extractPaginationParams, getPaginationResponse } from '../../../utils/pagination';
import { createPublicListRoute } from '../../../utils/route-factory';
import { resolveQuickAmenityFlags } from './quick-amenity-resolver';

/**
 * Strips richDescription from an accommodation object before it reaches the
 * public list response payload.
 *
 * richDescription is a PREMIUM field gated per-owner by the entitlement system.
 * The public list endpoint is a card listing that never renders rich text, so
 * the field must be absent from the payload regardless of the owner's plan.
 * This omission is applied at the DATA level so it is fail-closed and
 * independent of any Zod schema change. (SPEC-187 data-exposure fix.)
 *
 * @param item - Raw accommodation object from the service layer.
 * @returns The accommodation object with richDescription removed.
 */
function stripRichDescription<T extends { richDescription?: unknown }>(
    item: T
): Omit<T, 'richDescription'> {
    const { richDescription: _dropped, ...rest } = item;
    return rest;
}

const accommodationService = new AccommodationService({ logger: apiLogger });
const searchHistoryService = new SearchHistoryService({ logger: apiLogger });

/**
 * Read-through cache for the owner-level AI_CHAT availability used by the
 * listing-card "Chat IA" badge (F1).
 *
 * `resolveOwnerEntitlementsForOwnerId` deliberately has NO cache of its own — it
 * resolves a fresh set on every call (one owner-role DB query plus billing
 * subscription/plan lookups). Without this cache every cold listing render would
 * re-resolve every distinct owner on the page. A small per-owner cache with the
 * same 5-minute TTL used elsewhere for owner billing data keeps the public
 * listing cheap; a 5-minute-stale badge is purely cosmetic (the real chat gate
 * is enforced server-side at message time, not from this value). Kept LOCAL to
 * this route on purpose: it must not alter the freshness of the metered chat
 * route's entitlement gate, which shares the same resolver.
 */
interface OwnerAiChatCacheEntry {
    readonly value: boolean;
    readonly timestamp: number;
}
const OWNER_AI_CHAT_TTL_MS = 5 * 60 * 1000;
const OWNER_AI_CHAT_CACHE_MAX = 1000;
const ownerAiChatCache = new Map<string, OwnerAiChatCacheEntry>();

/**
 * Resolve whether an owner's plan grants AI_CHAT, with a 5-minute read-through
 * cache. Fail-closed: resolution errors return `false` and are NOT cached (so a
 * transient billing outage doesn't pin a wrong value for 5 minutes).
 */
async function resolveOwnerHasAiChat(ownerId: string): Promise<boolean> {
    const cached = ownerAiChatCache.get(ownerId);
    if (cached && Date.now() - cached.timestamp < OWNER_AI_CHAT_TTL_MS) {
        return cached.value;
    }
    try {
        const ownerEntitlements = await resolveOwnerEntitlementsForOwnerId(ownerId);
        const value = ownerEntitlements.includes(EntitlementKey.AI_CHAT);
        // FIFO eviction once at capacity, mirroring the owner-limits cache.
        if (ownerAiChatCache.size >= OWNER_AI_CHAT_CACHE_MAX) {
            const oldest = ownerAiChatCache.keys().next().value;
            if (oldest !== undefined) {
                ownerAiChatCache.delete(oldest);
            }
        }
        ownerAiChatCache.set(ownerId, { value, timestamp: Date.now() });
        return value;
    } catch (err) {
        apiLogger.warn(
            'F1: owner AI_CHAT entitlement resolution failed (badge omitted)',
            err instanceof Error ? err.message : String(err)
        );
        return false;
    }
}

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

        const result = await accommodationService.search(actor, {
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

        // SPEC-187 data-level omission: richDescription is a PREMIUM field gated
        // per-owner by the entitlement system. This card-listing endpoint never
        // renders it, so the field is stripped here before reaching the response
        // payload — fail-closed and independent of any schema change.
        const rawItems = result.data?.items || [];

        // F1: surface whether each accommodation's owner has the AI_CHAT
        // entitlement, so the listing card can show a "Chat IA" badge. This is
        // the same owner-level entitlement the chat route gates on — there is no
        // per-accommodation flag. OwnerIds are deduped per page and resolved
        // through `resolveOwnerHasAiChat`, a 5-minute read-through cache, so a
        // page costs at most one billing lookup per distinct, cache-cold owner.
        // Fail-closed: any resolution error => no badge for that owner.
        const uniqueOwnerIds = [
            ...new Set(
                rawItems
                    .map((item) => (item as { ownerId?: string }).ownerId)
                    .filter((id): id is string => typeof id === 'string' && id.length > 0)
            )
        ];
        const aiChatByOwner = new Map<string, boolean>();
        await Promise.all(
            uniqueOwnerIds.map(async (ownerId) => {
                aiChatByOwner.set(ownerId, await resolveOwnerHasAiChat(ownerId));
            })
        );

        const items = rawItems.map((item) => {
            const ownerId = (item as { ownerId?: string }).ownerId;
            return {
                ...stripRichDescription(item),
                hasAiChat: ownerId ? (aiChatByOwner.get(ownerId) ?? false) : false
            };
        });

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
