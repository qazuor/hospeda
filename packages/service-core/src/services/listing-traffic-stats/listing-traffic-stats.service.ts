import {
    EntityTypeEnum,
    LISTING_TRAFFIC_DIRECT_REFERRER,
    LISTING_TRAFFIC_INTERNAL_REFERRER,
    type ListingContactFunnel,
    type ListingTrafficBreakdownItem,
    ListingTrafficBreakdownItemSchema,
    type ListingTrafficStatsEntityType,
    ListingTrafficStatsParamsSchema,
    ListingTrafficStatsQuerySchema,
    type ListingTrafficStatsResponse,
    ListingTrafficStatsResponseSchema,
    type ListingTrafficStatsWindow
} from '@repo/schemas';
import { getLocalDayWindow, MARKET_TIMEZONE } from '@repo/utils';
import type { ServiceLogger } from '../../types/index.js';
import type {
    TrafficBreakdownDimension,
    TrafficStatsCachePort,
    TrafficStatsClientPort,
    TrafficStatsScope
} from './ports.js';

/** Cache TTL for a successful response, in seconds (1 hour). */
export const LISTING_TRAFFIC_STATS_CACHE_TTL_SECONDS = 3600;

/** Maximum referrers returned. */
export const LISTING_TRAFFIC_STATS_TOP_REFERRERS = 5;

/** Default budget for the whole Umami read, in milliseconds. */
export const LISTING_TRAFFIC_STATS_DEFAULT_TIMEOUT_MS = 3000;

/** Budget for a cache read before it is treated as a miss, in milliseconds. */
export const LISTING_TRAFFIC_STATS_CACHE_READ_TIMEOUT_MS = 200;

const WINDOW_DAYS: Readonly<Record<ListingTrafficStatsWindow, number>> = {
    '7d': 7,
    '30d': 30,
    '90d': 90
};

/** Constructor dependencies of {@link ListingTrafficStatsService}. */
export interface ListingTrafficStatsServiceDeps {
    /** Umami read port. */
    readonly statsClient: TrafficStatsClientPort;
    /** Cache port. */
    readonly cache: TrafficStatsCachePort;
    /** Optional logger. */
    readonly logger?: ServiceLogger;
    /** Clock, injectable for tests. Defaults to `() => new Date()`. */
    readonly now?: () => Date;
    /** Budget for the Umami reads. Defaults to 3000 ms. */
    readonly timeoutMs?: number;
    /** Budget for the cache read before it counts as a miss. Defaults to 200 ms. */
    readonly cacheReadTimeoutMs?: number;
}

/** Input of {@link ListingTrafficStatsService.getStats}. */
export interface GetListingTrafficStatsInput {
    /** Listing type. */
    readonly entityType: ListingTrafficStatsEntityType;
    /** Listing id (UUID). */
    readonly entityId: string;
    /** Window; defaults to `30d`. */
    readonly window?: ListingTrafficStatsWindow;
}

/**
 * Builds the cache key `traffic-stats:{entityType}:{entityId}:{window}`.
 *
 * @param input - Entity type, id and window
 * @returns The cache key
 */
export function buildListingTrafficStatsCacheKey(input: {
    readonly entityType: string;
    readonly entityId: string;
    readonly window: string;
}): string {
    return `traffic-stats:${input.entityType}:${input.entityId}:${input.window}`;
}

function withTimeout<T>(input: { promise: Promise<T>; ms: number; label: string }): Promise<T> {
    return new Promise<T>((resolve, reject) => {
        const timer = setTimeout(
            () => reject(new Error(`${input.label} timed out after ${input.ms}ms`)),
            input.ms
        );
        input.promise.then(
            (value) => {
                clearTimeout(timer);
                resolve(value);
            },
            (error: unknown) => {
                clearTimeout(timer);
                reject(error);
            }
        );
    });
}

/**
 * Owner-facing traffic stats for one listing, read from Umami through an
 * injected port and cached through an injected cache port (HOS-2119, spec 6.5).
 *
 * Not a CRUD service and not actor-aware: authorization (ownership, 404 for
 * foreign listings) is the route's job and runs BEFORE this service.
 *
 * Never throws for an Umami or cache failure: Umami failures or timeouts
 * answer `available: false` with empty arrays and are NOT cached.
 *
 * @example
 * ```ts
 * const service = new ListingTrafficStatsService({ statsClient, cache });
 * const stats = await service.getStats({
 *   entityType: 'ACCOMMODATION',
 *   entityId: '...uuid...',
 *   window: '7d'
 * });
 * ```
 */
export class ListingTrafficStatsService {
    static readonly SERVICE_NAME = 'listing-traffic-stats';

    private readonly statsClient: TrafficStatsClientPort;
    private readonly cache: TrafficStatsCachePort;
    private readonly logger?: ServiceLogger;
    private readonly now: () => Date;
    private readonly timeoutMs: number;
    private readonly cacheReadTimeoutMs: number;

    constructor(deps: ListingTrafficStatsServiceDeps) {
        this.statsClient = deps.statsClient;
        this.cache = deps.cache;
        this.logger = deps.logger;
        this.now = deps.now ?? (() => new Date());
        this.timeoutMs = deps.timeoutMs ?? LISTING_TRAFFIC_STATS_DEFAULT_TIMEOUT_MS;
        this.cacheReadTimeoutMs =
            deps.cacheReadTimeoutMs ?? LISTING_TRAFFIC_STATS_CACHE_READ_TIMEOUT_MS;
    }

    /**
     * Returns traffic stats for a listing and window.
     *
     * @param input - Entity type, id and optional window
     * @returns A response that always satisfies `ListingTrafficStatsResponseSchema`
     * @throws {ZodError} If the entity type or id is invalid (caller bug; the
     *   route validates first). An invalid id is rejected so no query can go
     *   out without its entity filter.
     */
    async getStats(input: GetListingTrafficStatsInput): Promise<ListingTrafficStatsResponse> {
        const parsed = ListingTrafficStatsParamsSchema.parse({
            entityType: input.entityType,
            entityId: input.entityId
        });
        const { entityType } = parsed;
        const entityId = parsed.entityId.toLowerCase();
        const { window } = ListingTrafficStatsQuerySchema.parse({ window: input.window });
        const key = buildListingTrafficStatsCacheKey({ entityType, entityId, window });

        const cached = await this.readCache(key);
        if (cached) return cached;

        const now = this.now();
        const { windowStart } = getLocalDayWindow({
            now,
            windowDays: WINDOW_DAYS[window],
            timeZone: MARKET_TIMEZONE
        });
        const scope: TrafficStatsScope = {
            entityType,
            entityId,
            window,
            startAt: windowStart.getTime(),
            endAt: now.getTime(),
            timeZone: MARKET_TIMEZONE
        };

        try {
            const response = ListingTrafficStatsResponseSchema.parse(
                await withTimeout({
                    promise: this.fetchStats({ scope }),
                    ms: this.timeoutMs,
                    label: 'Umami stats read'
                })
            );
            void this.writeCache({ key, value: response });
            return response;
        } catch (error) {
            this.logger?.warn?.(
                { entityType, entityId, window, error: String(error) },
                '[listing-traffic-stats] Umami read failed, answering available:false'
            );
            return {
                window,
                available: false,
                referrers: [],
                countries: [],
                devices: [],
                contactFunnel: null
            };
        }
    }

    private async fetchStats(input: {
        scope: TrafficStatsScope;
    }): Promise<ListingTrafficStatsResponse> {
        const { scope } = input;
        const breakdown = async (dimension: TrafficBreakdownDimension) =>
            this.cleanRows({
                dimension,
                scope,
                rows: await this.statsClient.getBreakdown({ ...scope, dimension })
            });
        // Visitors are needed for EVERY type (direct traffic). ACCOMMODATION gets them
        // together with the funnel (same `stats` call, no extra request); the other
        // types use the cheap visitors-only method so contact events are never queried.
        const statsPromise: Promise<{
            visitors: number;
            contactFunnel: ListingContactFunnel | null;
        }> =
            scope.entityType === EntityTypeEnum.ACCOMMODATION
                ? this.statsClient.getFunnelCounts(scope).then((counts) => ({
                      visitors: counts.visitors,
                      contactFunnel: {
                          views: counts.views,
                          contactStarted: counts.contactStarted,
                          contactCompleted: counts.contactCompleted
                      }
                  }))
                : this.statsClient
                      .getVisitorCount(scope)
                      .then((visitors) => ({ visitors, contactFunnel: null }));

        const [rawReferrers, countries, devices, { visitors, contactFunnel }, internalVisitors] =
            await Promise.all([
                breakdown('referrer'),
                breakdown('country'),
                breakdown('device'),
                statsPromise,
                this.statsClient.getInternalEntryVisitors(scope)
            ]);

        // A forged referrer host `(direct)` or `(internal)` is a valid WHATWG host, so a raw
        // row can carry a reserved sentinel: drop both before summing so none can
        // impersonate or inflate a computed row.
        const referrers = rawReferrers.filter(
            (row) =>
                row.value !== LISTING_TRAFFIC_DIRECT_REFERRER &&
                row.value !== LISTING_TRAFFIC_INTERNAL_REFERRER
        );

        // APPROXIMATION: Umami counts a visitor once per referrer row, so a visitor with
        // several referrers in the window is counted in each and the sum can exceed the
        // total. Same-site navigation is not a referrer row (Umami drops it), so it is read
        // from the `listing_internal_entry` event and reported as its own row.
        // Both computed rows derive from the FULL referrer list (before the top-N cut,
        // otherwise the dropped tail would be miscounted as direct). The reads are not
        // atomic, so the figures can disagree: internal is clamped to the visitors left
        // after the external referrers, direct is whatever remains, and a row is only
        // appended when positive. The computed rows then compete in the top-N.
        const referrerVisitors = referrers.reduce((sum, row) => sum + row.count, 0);
        const remaining = Math.max(0, visitors - referrerVisitors);
        const internal = Math.min(Math.max(0, internalVisitors), remaining);
        const direct = remaining - internal;
        const computed: ListingTrafficBreakdownItem[] = [];
        if (internal > 0) {
            computed.push({ value: LISTING_TRAFFIC_INTERNAL_REFERRER, count: internal });
        }
        if (direct > 0) {
            computed.push({ value: LISTING_TRAFFIC_DIRECT_REFERRER, count: direct });
        }
        const withComputed =
            computed.length > 0
                ? [...referrers, ...computed].sort((a, b) => b.count - a.count)
                : referrers;

        return {
            window: scope.window,
            available: true,
            referrers: withComputed.slice(0, LISTING_TRAFFIC_STATS_TOP_REFERRERS),
            countries,
            devices,
            contactFunnel
        };
    }

    /**
     * Validates breakdown rows one by one, drops the invalid ones (logging once
     * per breakdown) and sorts the survivors by count, descending.
     */
    private cleanRows(input: {
        dimension: TrafficBreakdownDimension;
        scope: TrafficStatsScope;
        rows: readonly unknown[];
    }): ListingTrafficBreakdownItem[] {
        const valid: ListingTrafficBreakdownItem[] = [];
        let dropped = 0;
        for (const row of input.rows) {
            const parsed = ListingTrafficBreakdownItemSchema.safeParse(row);
            if (parsed.success && parsed.data.value.length > 0) valid.push(parsed.data);
            else dropped += 1;
        }
        if (dropped > 0) {
            this.logger?.warn?.(
                {
                    entityType: input.scope.entityType,
                    entityId: input.scope.entityId,
                    dimension: input.dimension,
                    dropped
                },
                '[listing-traffic-stats] dropped invalid breakdown rows'
            );
        }
        return valid.sort((a, b) => b.count - a.count);
    }

    private async readCache(key: string): Promise<ListingTrafficStatsResponse | null> {
        try {
            const raw = await withTimeout({
                promise: this.cache.get(key),
                ms: this.cacheReadTimeoutMs,
                label: 'cache read'
            });
            if (raw === null || raw === undefined) return null;
            const parsed = ListingTrafficStatsResponseSchema.safeParse(raw);
            return parsed.success && parsed.data.available ? parsed.data : null;
        } catch (error) {
            this.logger?.warn?.(
                { key, error: String(error) },
                '[listing-traffic-stats] cache read failed'
            );
            return null;
        }
    }

    private async writeCache(input: { key: string; value: ListingTrafficStatsResponse }) {
        try {
            await this.cache.set({
                key: input.key,
                value: input.value,
                ttlSeconds: LISTING_TRAFFIC_STATS_CACHE_TTL_SECONDS
            });
        } catch (error) {
            this.logger?.warn?.(
                { key: input.key, error: String(error) },
                '[listing-traffic-stats] cache write failed'
            );
        }
    }
}
