import type {
    ListingTrafficBreakdownItem,
    ListingTrafficStatsEntityType,
    ListingTrafficStatsWindow
} from '@repo/schemas';

/**
 * Dimensions served by the Umami `metrics` endpoint (pageviews only, filtered
 * by the `tag=<entityId>` set on the listing detail page).
 */
export type TrafficBreakdownDimension = 'referrer' | 'country' | 'device';

/**
 * Scope of every stats-client query. `entityType` and `entityId` are mandatory
 * on purpose: an Umami query without its entity filter answers the SITE total,
 * so the port cannot be called without them.
 *
 * The window is expressed as instants computed from LOCAL calendar days of
 * `timeZone` (Argentina), never UTC days: it starts at local midnight of the
 * oldest day and ends at the request instant.
 */
export interface TrafficStatsScope {
    /** Listing type the stats belong to. */
    readonly entityType: ListingTrafficStatsEntityType;
    /** Listing id (UUID), lower-cased. Becomes `tag=<id>` or `pf_entity_id=eq.<id>`. */
    readonly entityId: string;
    /** Requested rolling window (`7d`, `30d` or `90d`). */
    readonly window: ListingTrafficStatsWindow;
    /** Window start, epoch ms: UTC instant of local midnight of the oldest day. Inclusive. */
    readonly startAt: number;
    /** Window end, epoch ms: the request instant. */
    readonly endAt: number;
    /** IANA time zone the days were computed in (`MARKET_TIMEZONE`). */
    readonly timeZone: string;
}

/** Input of {@link TrafficStatsClientPort.getBreakdown}. */
export interface GetBreakdownInput extends TrafficStatsScope {
    /** Which dimension to break the pageviews down by. */
    readonly dimension: TrafficBreakdownDimension;
}

/** Window totals of each funnel step. */
export interface FunnelCounts {
    /** Detail-page views. */
    readonly views: number;
    /** Distinct visitors of the window (the same `stats` call that yields `views`). */
    readonly visitors: number;
    /** Contact started events. */
    readonly contactStarted: number;
    /** Contact completed events. */
    readonly contactCompleted: number;
}

/**
 * Read port over Umami for one listing. The Umami adapter (apps/api) implements
 * it; the service only depends on this interface. Implementations reject on
 * any transport error or timeout.
 */
export interface TrafficStatsClientPort {
    /**
     * Top values of one dimension for the listing (any order, any length).
     * The adapter MUST return a non-null, non-empty string `value` and a
     * non-negative integer `count`; the service drops rows that are not.
     */
    getBreakdown(input: GetBreakdownInput): Promise<readonly ListingTrafficBreakdownItem[]>;
    /**
     * Funnel TOTALS for the listing over `[startAt, endAt]`. ACCOMMODATION only.
     * Gap-fill is not needed because the response carries no time series.
     */
    getFunnelCounts(input: TrafficStatsScope): Promise<FunnelCounts>;
    /**
     * Total DISTINCT visitors of the listing over `[startAt, endAt]`, for every
     * listing type. One cheap `stats` call: it MUST NOT query contact events,
     * which are ACCOMMODATION-only. Used to derive direct traffic.
     */
    getVisitorCount(input: TrafficStatsScope): Promise<number>;
    /**
     * DISTINCT visitors of the listing who entered the page from another page of
     * the same site, over `[startAt, endAt]`, for every listing type. Read from the
     * `listing_internal_entry` custom event (0 when no event was recorded). Same
     * unit as `getVisitorCount`, so the service can subtract it from direct traffic.
     */
    getInternalEntryVisitors(input: TrafficStatsScope): Promise<number>;
}

/** Input of {@link TrafficStatsCachePort.set}. */
export interface TrafficStatsCacheSetInput {
    /** Cache key. */
    readonly key: string;
    /** JSON-serializable value. */
    readonly value: unknown;
    /** Time to live in seconds. */
    readonly ttlSeconds: number;
}

/** Cache port (Redis in production). Values are JSON-serializable. */
export interface TrafficStatsCachePort {
    /** Returns the cached value or `null` on a miss. */
    get(key: string): Promise<unknown | null>;
    /** Stores a value with a TTL. */
    set(input: TrafficStatsCacheSetInput): Promise<void>;
}
