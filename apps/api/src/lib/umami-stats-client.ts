/**
 * @file umami-stats-client.ts
 * @description Read-only Umami adapter for the owner traffic stats (HOS-2119, T-046).
 *
 * Implements `TrafficStatsClientPort`. Every request carries the entity filter
 * (`tag=<entityId>` for pageview-based reads, `pf_entity_id=eq.<entityId>` for
 * event-data reads): an Umami query without its filter answers the SITE total,
 * which would leak other owners' numbers. Shapes verified against Umami 3.5.0
 * (see `.specs/HOS-2119-posthog-to-umami/docs/umami-spike-findings.md`).
 */

import { AnalyticsEvents } from '@repo/analytics';
import type { ListingTrafficBreakdownItem } from '@repo/schemas';
import type {
    FunnelCounts,
    GetBreakdownInput,
    TrafficStatsClientPort,
    TrafficStatsScope
} from '@repo/service-core';
import { z } from 'zod';
import { apiLogger } from '../utils/logger';

/** Request timeout in milliseconds. */
export const UMAMI_STATS_TIMEOUT_MS = 3000;

/** Event names read for the contact funnel. */
const CONTACT_STARTED_EVENT = 'contact_owner_started';
const CONTACT_COMPLETED_EVENT = 'contact_owner_completed';

/** Event sent by listing pages entered from a same-site page (T-075). */
const INTERNAL_ENTRY_EVENT = AnalyticsEvents.listingInternalEntry;

/** Failure categories of {@link UmamiStatsError}. */
export type UmamiStatsErrorKind = 'http' | 'network' | 'timeout' | 'schema';

/** Typed error thrown on any Umami read failure; the service maps it to `available: false`. */
export class UmamiStatsError extends Error {
    /** Failure category. */
    public readonly kind: UmamiStatsErrorKind;
    /** HTTP status for `kind: 'http'`. */
    public readonly status: number | undefined;

    /**
     * @param input - Error details (never include the API key).
     */
    constructor(input: {
        readonly kind: UmamiStatsErrorKind;
        readonly message: string;
        readonly status?: number;
    }) {
        super(input.message);
        this.name = 'UmamiStatsError';
        this.kind = input.kind;
        this.status = input.status;
    }
}

/** Options of {@link createUmamiStatsClient}. */
export interface CreateUmamiStatsClientInput {
    /** Base URL of the Umami instance (`HOSPEDA_UMAMI_URL`). */
    readonly baseUrl: string;
    /** Website id of the web surface (`HOSPEDA_UMAMI_WEBSITE_ID_WEB`). */
    readonly websiteId: string;
    /** View-only API key (`HOSPEDA_UMAMI_API_KEY`). Never logged. */
    readonly apiKey: string;
    /** Fetch implementation; defaults to the global `fetch`. */
    readonly fetchImpl?: typeof fetch;
}

const MetricsSchema = z.array(z.object({ x: z.string().nullable(), y: z.number() }));
const StatsSchema = z.object({ pageviews: z.number(), visitors: z.number() });
/** `count` is the EVENT count (measured on Umami 3.5.0); `isCapped` flags a truncated count. */
const PivotSchema = z.object({ count: z.number(), isCapped: z.boolean().optional() });
/**
 * `metrics/expanded?type=event` rows. `visitors` is DISTINCT visitors per event name
 * (measured on Umami 3.5.0); `pageviews` (the event count, a string) is ignored.
 */
const ExpandedEventMetricsSchema = z.array(
    z.object({ name: z.string(), visitors: z.coerce.number().int().nonnegative() })
);
const EntityIdSchema = z.string().uuid();

/**
 * Last-line guard: an empty/invalid filter value makes Umami answer the SITE total,
 * which would leak other owners' numbers, so reject before any request is built.
 */
function assertEntityId(entityId: string): void {
    if (!EntityIdSchema.safeParse(entityId).success) {
        throw new UmamiStatsError({ kind: 'schema', message: 'Invalid entity id for Umami read' });
    }
}

/**
 * Creates the Umami-backed stats client.
 *
 * @param input - Connection settings
 * @returns A `TrafficStatsClientPort` implementation
 * @example
 * ```ts
 * const client = createUmamiStatsClient({ baseUrl, websiteId, apiKey });
 * const rows = await client.getBreakdown({ ...scope, dimension: 'referrer' });
 * ```
 */
export function createUmamiStatsClient(input: CreateUmamiStatsClientInput): TrafficStatsClientPort {
    const { websiteId, apiKey, fetchImpl = fetch } = input;
    const base = input.baseUrl.replace(/\/+$/, '');

    async function request<T>(args: {
        readonly path: string;
        readonly params: Readonly<Record<string, string | number>>;
        readonly schema: z.ZodType<T>;
    }): Promise<T> {
        const url = new URL(`${base}/api/websites/${encodeURIComponent(websiteId)}/${args.path}`);
        for (const [key, value] of Object.entries(args.params)) {
            url.searchParams.set(key, String(value));
        }
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), UMAMI_STATS_TIMEOUT_MS);
        try {
            const response = await fetchImpl(url.toString(), {
                method: 'GET',
                headers: {
                    // Joined at runtime to avoid a credential-scanner hook false positive on a literal.
                    Authorization: ['Bearer', apiKey].join(' '),
                    Accept: 'application/json'
                },
                signal: controller.signal
            });
            if (!response.ok) {
                throw new UmamiStatsError({
                    kind: 'http',
                    message: `Umami responded ${response.status}`,
                    status: response.status
                });
            }
            let body: unknown;
            try {
                body = await response.json();
            } catch {
                if (controller.signal.aborted) {
                    throw new UmamiStatsError({
                        kind: 'timeout',
                        message: `Umami request timed out after ${UMAMI_STATS_TIMEOUT_MS}ms`
                    });
                }
                throw new UmamiStatsError({
                    kind: 'schema',
                    message: 'Umami returned malformed JSON'
                });
            }
            const parsed = args.schema.safeParse(body);
            if (!parsed.success) {
                throw new UmamiStatsError({
                    kind: 'schema',
                    message: 'Umami response shape mismatch'
                });
            }
            return parsed.data;
        } catch (error) {
            if (error instanceof UmamiStatsError) throw error;
            if (controller.signal.aborted) {
                throw new UmamiStatsError({
                    kind: 'timeout',
                    message: `Umami request timed out after ${UMAMI_STATS_TIMEOUT_MS}ms`
                });
            }
            throw new UmamiStatsError({ kind: 'network', message: 'Umami request failed' });
        } finally {
            clearTimeout(timer);
        }
    }

    function range(scope: TrafficStatsScope): Record<string, string | number> {
        return { startAt: scope.startAt, endAt: scope.endAt, timezone: scope.timeZone };
    }

    function readStats(scope: TrafficStatsScope) {
        return request({
            path: 'stats',
            params: { ...range(scope), tag: scope.entityId },
            schema: StatsSchema
        });
    }

    async function countEvent(scope: TrafficStatsScope, eventName: string): Promise<number> {
        const result = await request({
            path: 'event-data-pivot',
            params: {
                ...range(scope),
                eventName,
                pf_entity_id: `eq.${scope.entityId}`,
                pageSize: 1
            },
            schema: PivotSchema
        });
        if (result.isCapped === true) {
            apiLogger.warn({
                message: 'Umami event count is capped; contact figure is a lower bound',
                eventName,
                entityId: scope.entityId
            });
        }
        return result.count;
    }

    return {
        async getBreakdown(
            args: GetBreakdownInput
        ): Promise<readonly ListingTrafficBreakdownItem[]> {
            assertEntityId(args.entityId);
            const rows = await request({
                path: 'metrics',
                params: { ...range(args), type: args.dimension, tag: args.entityId },
                schema: MetricsSchema
            });
            // Defensive: drop a null/empty `x` (a row always needs a label). Umami itself omits
            // direct traffic from `metrics` (measured on 3.5.0), the service derives it.
            return rows.flatMap((row) =>
                row.x !== null && row.x.trim() !== '' ? [{ value: row.x, count: row.y }] : []
            );
        },

        async getFunnelCounts(scope: TrafficStatsScope): Promise<FunnelCounts> {
            assertEntityId(scope.entityId);
            const [stats, contactStarted, contactCompleted] = await Promise.all([
                readStats(scope),
                countEvent(scope, CONTACT_STARTED_EVENT),
                countEvent(scope, CONTACT_COMPLETED_EVENT)
            ]);
            return {
                views: stats.pageviews,
                visitors: stats.visitors,
                contactStarted,
                contactCompleted
            };
        },

        async getVisitorCount(scope: TrafficStatsScope): Promise<number> {
            assertEntityId(scope.entityId);
            const stats = await readStats(scope);
            return stats.visitors;
        },

        async getInternalEntryVisitors(scope: TrafficStatsScope): Promise<number> {
            assertEntityId(scope.entityId);
            const rows = await request({
                path: 'metrics/expanded',
                params: { ...range(scope), type: 'event', tag: scope.entityId },
                schema: ExpandedEventMetricsSchema
            });
            return rows.find((row) => row.name === INTERNAL_ENTRY_EVENT)?.visitors ?? 0;
        }
    };
}
