/**
 * Revalidation service — schedules and executes Cloudflare cache-tag purges.
 *
 * HOS-369 W1-1 turned this service from URL-path purging to cache-tag purging.
 * Every "path" concept below is now a "tag" (what to invalidate) or a "target"
 * (what the adapter/log actually recorded). Three target shapes exist, and the
 * `revalidation_log.target` column is how they are told apart afterwards:
 * `<env>:<tag>` for an ordinary purge and for an environment flush
 * (`prod:all`), `*` for a whole-zone flush, and `?:all` for an environment
 * flush that could not be addressed at all. See `entity-tag-mapper.ts` for the
 * entity→tag mapping this service delegates to.
 *
 * Well over the 500-line guideline — most of it prose, since nearly every
 * decision here has a silent failure mode behind it. The split was reviewed and
 * deferred (SPEC-167 T-023) and is still deferred: the natural seam is
 * scheduling/debounce vs purging, and moving either half while the purge
 * semantics are actively changing would make the diffs unreviewable.
 *
 * @module revalidation/revalidation.service
 */

import type { CacheTagEnvironment } from '@repo/cache-tags';
import { CACHE_TAG_ALL, namespaceCacheTags } from '@repo/cache-tags';
import type { RevalidationConfigRecord } from '@repo/db';
import { RevalidationConfigModel, RevalidationLogModel } from '@repo/db';
import { createLogger } from '@repo/logger';
import type {
    RevalidateTargetResult,
    RevalidationAdapter
} from './adapters/revalidation.adapter.js';
import {
    UNRESOLVED_ENVIRONMENT_TARGET,
    WHOLE_ZONE_TARGET
} from './adapters/revalidation.adapter.js';
import type { EntityChangeData } from './entity-change.types.js';
import { getAffectedCacheTags } from './entity-tag-mapper.js';

/**
 * Resolver that queries the database for entities of a specific type.
 *
 * No longer consulted by {@link RevalidationService.revalidateByEntityType} /
 * `resolveTagsForEntityType` (HOS-369 W1-1) — the collection tag for a type
 * already covers every listing/facet page that could show one of its members,
 * so enumerating every published row to build per-entity tags is both
 * redundant (each entity purges its own tag from its own write hook) and
 * dangerous (Cloudflare's Free-plan tag-purge rate limit is 5 requests/minute;
 * a cron walking hundreds of rows would blow through it in seconds).
 *
 * The type and the `resolveById` half are kept: the `/revalidate/entity` admin
 * route still resolves a single entity by id before computing its tags.
 */
export interface EntityResolver {
    /**
     * Returns {@link EntityChangeData} for a single entity by type and ID.
     * Used by the `/revalidate/entity` endpoint to look up a specific entity
     * before revalidating its tags.
     *
     * @param params - Object containing entity type and entity ID
     * @returns The entity change data, or null if not found
     */
    readonly resolveById: (params: {
        readonly entityType: EntityChangeData['entityType'];
        readonly entityId: string;
    }) => Promise<EntityChangeData | null>;
}

/** Default retention period for revalidation log entries in days */
const DEFAULT_LOG_RETENTION_DAYS = 30;

/** Configuration for RevalidationService */
export interface RevalidationServiceConfig {
    /** Adapter responsible for performing the actual HTTP revalidation calls */
    readonly adapter: RevalidationAdapter;
    /**
     * Debounce window in milliseconds applied to `scheduleRevalidation` calls.
     * Multiple calls for the same entity within this window are merged into one.
     * Defaults to 30000 ms (30 seconds).
     */
    readonly debounceMs?: number;
    /**
     * Number of days to retain revalidation log entries before cleanup.
     * Used by the cron job to delete old log entries.
     * Defaults to 30.
     */
    readonly logRetentionDays?: number;
    /**
     * Optional entity resolver for looking up published entities from the database.
     * Used by the `/revalidate/entity` route (via {@link RevalidationService.getEntityResolver})
     * to resolve a single entity's tags; no longer consulted by the cron
     * backstop (see {@link EntityResolver}).
     */
    readonly entityResolver?: EntityResolver;
    /**
     * Deployment environment every purged tag is namespaced by (HOS-369 W1-2).
     *
     * `staging.hospeda.com.ar` and `hospeda.com.ar` are ONE Cloudflare zone, so
     * an unqualified `list-accom` purge from staging evicts production's cache.
     * The value MUST be derived from `HOSPEDA_DEPLOY_ENV` through
     * `resolveCacheTagEnvironment` — the same function the web app calls — or
     * the purge will address tags nothing ever emitted and report success.
     *
     * `undefined` means the environment could not be resolved at startup. In
     * that state NO tag is purgeable and every purge is a no-op: purging
     * unnamespaced tags would hit nothing, and guessing a namespace could hit
     * the wrong environment. `initializeRevalidationService` pairs this state
     * with a no-op adapter and an error log; it is never a normal condition.
     */
    readonly cacheTagEnvironment?: CacheTagEnvironment;
}

/** Trigger source for revalidation log entries */
export type RevalidationTrigger = 'manual' | 'cron' | 'hook' | 'stale';

/** Internal config cache entry */
interface ConfigCacheEntry {
    readonly record: RevalidationConfigRecord | undefined;
    readonly expiresAt: number;
}

/** Pending entity debounce state: accumulated tags and the timer reference */
interface PendingEntityDebounce {
    readonly tags: Set<string>;
    readonly entityType: string;
    /**
     * Canonical UUID written to `revalidation_log.entity_id` when the bucket
     * fires. Pinned on the first call in the window that supplies one
     * (first-write-wins), so a later id-less call for the same entity cannot
     * null it out. Mutable: only reassigned while still undefined.
     */
    entityId: string | undefined;
    /** Mutable: reassigned on each clearTimeout/setTimeout debounce reset cycle. */
    timer: ReturnType<typeof setTimeout>;
}

/** TTL for the in-memory revalidation config cache (milliseconds) */
const CONFIG_CACHE_TTL_MS = 60_000; // 60 seconds

/**
 * How long a fired debounce bucket waits for its siblings before the shared
 * purge goes out (HOS-297).
 *
 * `scheduleRevalidationBatch` arms one debounce bucket per entity, all in the
 * same tick with the same `debounceSeconds`, so they all expire in the same
 * tick too — and each used to fire its OWN unawaited purge. That is the
 * measured burst the edge WAF answers with 403 (1 POST → 401, 20 concurrent →
 * 403 ×20). Callers that fan out this way include
 * `accommodation.sync-featured-by-entitlement` (every accommodation of an
 * owner), plan upgrade/downgrade remediation and subscription pause.
 *
 * A short window is enough because the siblings are already simultaneous; it
 * exists only to absorb scheduler skew, and it is charged AFTER the debounce
 * has already elapsed, so it does not delay a lone entity meaningfully.
 */
const PURGE_COALESCE_MS = 50;

/**
 * Minimum spacing between two coalesced purge requests, in milliseconds.
 *
 * Cloudflare's tag-purge ceiling on the Free plan is 5 requests per minute
 * (spec §5.11.2), i.e. one per 12 s. The 50 ms window above absorbs scheduler
 * skew between siblings enqueued in the same tick; it does nothing for writes
 * that arrive SECONDS apart, which is the normal case — each entity has its own
 * debounce bucket (`accommodation` is seeded at 5 s), so six hosts saving six
 * listings over fifteen seconds produced six separate purge requests.
 *
 * Under `purge_everything` exceeding the limit was self-correcting: a dropped
 * flush was repaired by the next successful one, because every flush covered
 * everything. With tags it is not — the tags of a rejected request are disjoint
 * from the next request's, so whatever it carried stays cached until its TTL.
 * That is why this exists, and why it DELAYS rather than drops: pending groups
 * keep accumulating in `pendingPurgeGroups` and go out together on the next
 * permitted flush.
 *
 * Cost: under sustained write pressure a purge can wait up to 12 s beyond its
 * debounce. That is strictly better than the alternative, which is a purge that
 * returns 429 and evicts nothing.
 */
const MIN_PURGE_INTERVAL_MS = 12_000;

/** One entity's worth of cache tags awaiting the next shared purge. */
interface PendingPurgeGroup {
    readonly entityType: string;
    readonly entityId: string | undefined;
    readonly tags: readonly string[];
    readonly reason?: string;
}

/** How many `revalidation_log` inserts may be in flight at once. */
const LOG_WRITE_CONCURRENCY = 20;

/**
 * Central service for on-demand Cloudflare cache-tag purging.
 *
 * Responsibilities:
 * - Reads per-entity-type config from `revalidation_config` (with 60 s in-memory cache)
 * - Debounces rapid successive change events for the same entity (keyed by entityType:entityId)
 * - Writes audit entries to `revalidation_log` after every purge attempt
 * - Uses the injected adapter for actual HTTP calls (Cloudflare tag purge or no-op)
 *
 * All revalidation triggered by hooks is fire-and-forget -- never blocks CRUD operations.
 */
export class RevalidationService {
    private readonly adapter: RevalidationAdapter;
    private readonly cacheTagEnvironment: CacheTagEnvironment | undefined;
    private readonly logRetentionDaysConfig: number;
    private readonly entityResolverInstance: EntityResolver | undefined;
    private readonly pendingTimers = new Map<string, PendingEntityDebounce>();
    /** Groups waiting for the next shared purge (HOS-297). */
    private readonly pendingPurgeGroups: PendingPurgeGroup[] = [];
    /** Armed while a shared purge is pending; `undefined` means none is armed. */
    private purgeFlushTimer: ReturnType<typeof setTimeout> | undefined;
    /**
     * Resolves when the purge currently in flight finishes. A flush that lands
     * while one is running chains behind it instead of starting a concurrent
     * purge — the timer handle alone only bounds "one purge per window", not
     * "one purge at a time", and concurrency is the whole thing being fixed.
     */
    private purgeInFlight: Promise<unknown> = Promise.resolve();
    /**
     * When the last coalesced purge started, used to keep requests at least
     * {@link MIN_PURGE_INTERVAL_MS} apart. Zero means "none yet", which makes
     * the first purge of the process fire on the plain coalescing window.
     */
    private lastPurgeStartedAt = 0;
    private readonly configCache = new Map<string, ConfigCacheEntry>();
    private readonly logModel: RevalidationLogModel;
    private readonly configModel: RevalidationConfigModel;
    private readonly logger = createLogger('revalidation-service');

    constructor(config: RevalidationServiceConfig) {
        this.adapter = config.adapter;
        this.cacheTagEnvironment = config.cacheTagEnvironment;
        this.logRetentionDaysConfig = config.logRetentionDays ?? DEFAULT_LOG_RETENTION_DAYS;
        this.entityResolverInstance = config.entityResolver;
        this.logModel = new RevalidationLogModel();
        this.configModel = new RevalidationConfigModel();
    }

    /**
     * Returns the number of days to retain revalidation log entries.
     * @returns The configured retention days or the default (30)
     */
    getLogRetentionDays(): number {
        return this.logRetentionDaysConfig;
    }

    /**
     * Name of the adapter this service is wired to.
     *
     * Exposed for the admin health check, which reports what it can observe
     * WITHOUT spending one of Cloudflare's 5 tag-purge requests per minute
     * (HOS-369 W1-1). A `NoOpRevalidationAdapter` here means invalidation is
     * silently disabled — the missing-secret fallback in `adapter-factory.ts`.
     *
     * @returns The adapter's `name`.
     */
    getAdapterName(): string {
        return this.adapter.name;
    }

    /**
     * Returns the configured entity resolver, if any.
     * Used by route handlers that need to resolve individual entities
     * before triggering revalidation.
     *
     * @returns The entity resolver instance, or undefined if none was configured
     */
    getEntityResolver(): EntityResolver | undefined {
        return this.entityResolverInstance;
    }

    /**
     * Schedule revalidation for cache tags affected by an entity change event.
     *
     * Before scheduling, reads the entity-type config from the database (with 60 s cache).
     * Returns immediately without doing anything if:
     * - The config record does not exist
     * - `enabled === false`
     * - `autoRevalidateOnChange === false`
     *
     * Uses entity-level debouncing: multiple calls for the same entity (keyed by
     * `entityType:entityId` or just `entityType`) within the debounce window are merged
     * into a single batch purge of all accumulated tags.
     * Fire-and-forget -- never throws, never blocks.
     *
     * @param event - Discriminated union describing the changed entity with contextual data
     * @param reason - Optional human-readable reason for logging
     */
    scheduleRevalidation(event: EntityChangeData, reason?: string): void {
        // Resolve config asynchronously and schedule -- fully fire-and-forget
        void this.resolveConfigAndSchedule(event, reason);
    }

    /**
     * Schedule revalidation for a targeted list of entity change events.
     *
     * Routes each event through the same debounce/fire-and-forget path as
     * {@link scheduleRevalidation}. Duplicate events for the same entity key
     * (`entityType:entityId`) are merged by the existing debounce -- no extra
     * deduplication needed here. Empty `events` is a no-op.
     *
     * Callers supply complete {@link EntityChangeData} objects (slug + context).
     * The service does not fetch slugs -- callers supply events.
     *
     * @param params.events - Entity change events to schedule
     * @param params.reason - Optional reason propagated to each log entry
     */
    scheduleRevalidationBatch(params: {
        readonly events: ReadonlyArray<EntityChangeData>;
        readonly reason?: string;
    }): void {
        const { events, reason } = params;
        for (const event of events) {
            this.scheduleRevalidation(event, reason);
        }
    }

    /**
     * Immediately purges every cache tag for a given entity type (no debounce).
     * Used by the scheduled cron job and manual admin triggers.
     *
     * @param params - Object containing entity type and optional trigger
     * @param params.entityType - The entity type whose tags should all be purged
     * @param params.trigger - Trigger source for the log entry (defaults to 'cron')
     * @returns Array of results, one per purged tag
     */
    async revalidateByEntityType(params: {
        readonly entityType: EntityChangeData['entityType'];
        readonly trigger?: RevalidationTrigger;
    }): Promise<ReadonlyArray<RevalidateTargetResult>> {
        const { entityType, trigger = 'cron' } = params;

        const tags = this.resolveTagsForEntityType({ entityType });
        return this.revalidateTags({ tags, triggeredBy: 'system', trigger, entityType });
    }

    /**
     * Resolves every cache tag affected by an entity type, without purging.
     *
     * Split out of {@link revalidateByEntityType} so {@link revalidateEntityTypesBatch}
     * can gather tags across several types and then purge ONCE (HOS-297).
     *
     * Deliberately a PURE call into {@link getAffectedCacheTags} — no
     * {@link EntityResolver}, no DB enumeration, no per-run cap. This is a
     * behaviour change from the path-based cron (which walked every published
     * entity of a type): the collection tag already invalidates every listing
     * surface for that type, so enumerating rows to build per-entity tags on
     * top of it would be redundant AND would risk exceeding Cloudflare's
     * Free-plan tag-purge rate limit (5 requests/minute) on a large table.
     * Per-entity staleness is caught by that entity's own write hook
     * (`scheduleRevalidation`), not by this cron path.
     *
     * @param params.entityType - Entity type to resolve tags for.
     * @returns Deduplicated cache tags for the type. Never throws.
     */
    private resolveTagsForEntityType(params: {
        readonly entityType: EntityChangeData['entityType'];
    }): readonly string[] {
        const { entityType } = params;
        return this.toNamespacedTags(getAffectedCacheTags({ entityType } as EntityChangeData));
    }

    /**
     * Qualify bare vocabulary tags with this deployment's namespace.
     *
     * Applied at every point where tags ENTER the service, not at the point
     * where they leave for the adapter. That choice makes the namespaced form
     * the only one that exists downstream, so `purgeGroupsOnce`'s
     * result-matching, the `revalidation_log.target` rows and the adapter all
     * speak about the same string — the audit trail records what was actually
     * purged rather than what was asked for. `namespaceCacheTag` is idempotent
     * for its own environment, which is what makes it safe for the entry points
     * to overlap (`revalidateByEntityType` → `revalidateTags`).
     *
     * When the environment is unresolved this returns nothing, so no purge is
     * attempted at all. Purging the bare tags instead would evict nothing (the
     * emitter never wrote them) while logging success; purging a guessed
     * namespace could evict the other environment.
     *
     * @param tags - Bare cache tags from the entity mapper or from a caller.
     * @returns Namespaced tags, deduplicated, in input order.
     */
    private toNamespacedTags(tags: ReadonlyArray<string>): readonly string[] {
        if (this.cacheTagEnvironment === undefined) {
            if (tags.length > 0) {
                this.logger.error(
                    '[RevalidationService] Dropping cache-tag purge: the deployment namespace is unresolved (set HOSPEDA_DEPLOY_ENV to prod | preview | dev | test)'
                );
            }
            return [];
        }
        return namespaceCacheTags({ environment: this.cacheTagEnvironment, tags });
    }

    /**
     * Revalidates SEVERAL entity types in a single cache purge (HOS-297).
     *
     * The adapter's purge invalidates every listed tag in as few upstream
     * requests as possible, so calling {@link revalidateByEntityType} once per
     * entity type — as the page-revalidation cron used to — fires N separate
     * purge round-trips per run where one would do.
     *
     * To be precise about what this does and does not fix: those N cron purges were
     * `await`-sequential, so they were waste and rate-budget consumption, NOT the
     * concurrent burst that the edge WAF answers with 403. That burst came from the
     * per-entity debounce buckets (see `enqueuePurgeGroup`), which is fixed
     * separately. Both now funnel through {@link purgeGroupsOnce}.
     *
     * Per-entity-type audit logging is preserved deliberately. `revalidation_log`
     * rows are not just an audit trail: the cron reads the last `cron` entry PER
     * ENTITY TYPE to decide whether that type's interval has elapsed. Collapsing the
     * log along with the purge would make every run believe every interval had
     * elapsed. So the purge is shared and the log rows are still written per type,
     * each carrying the shared outcome.
     *
     * @param params.entityTypes - Entity types to revalidate together. Duplicates are
     *   ignored; a type that resolves to no tags is skipped (no purge, no log).
     * @param params.trigger - Trigger source recorded on every log entry (default `'cron'`).
     * @returns Results grouped per entity type, in input order (types that resolved to
     *   no tags are omitted).
     */
    async revalidateEntityTypesBatch(params: {
        readonly entityTypes: ReadonlyArray<EntityChangeData['entityType']>;
        readonly trigger?: RevalidationTrigger;
    }): Promise<
        ReadonlyArray<{ entityType: string; results: ReadonlyArray<RevalidateTargetResult> }>
    > {
        const { entityTypes, trigger = 'cron' } = params;

        // Resolve every type's tags BEFORE purging, so the single purge below
        // covers the whole run.
        const perType: Array<{ entityType: string; tags: string[] }> = [];
        const zeroTagTypes: string[] = [];
        const seenTypes = new Set<string>();

        for (const entityType of entityTypes) {
            if (seenTypes.has(entityType)) continue;
            seenTypes.add(entityType);

            const tags = this.resolveTagsForEntityType({ entityType });
            if (tags.length > 0) {
                perType.push({ entityType, tags: [...tags] });
            } else {
                // Reported with empty results rather than dropped: a caller that
                // derives counters from this (the cron does) would otherwise see
                // the type vanish from the run's accounting entirely, and a dry
                // run would report a different total than the real one.
                zeroTagTypes.push(entityType);
            }
        }

        const skipped = zeroTagTypes.map((entityType) => ({
            entityType,
            results: [] as ReadonlyArray<RevalidateTargetResult>
        }));

        if (perType.length === 0) return skipped;

        const purged = await this.purgeGroupsOnce({
            groups: perType.map(({ entityType, tags }) => ({
                entityType,
                entityId: undefined,
                tags
            })),
            trigger,
            triggeredBy: 'system'
        });

        return [...purged, ...skipped];
    }

    /**
     * Queues a group for the next shared purge, arming the window if needed.
     *
     * Deliberately arms ONE timer for the whole window rather than one per
     * group: the callers this exists for enqueue N groups in a single tick.
     */
    private enqueuePurgeGroup(group: PendingPurgeGroup): void {
        this.pendingPurgeGroups.push(group);

        if (this.purgeFlushTimer !== undefined) return;

        // Wait out whatever remains of the rate-limit interval since the last
        // flush, but never less than the coalescing window. At low write volume
        // the remainder is already negative and this is the plain 50 ms hop;
        // under pressure the extra wait is what turns a burst that would be
        // rejected into one request that is accepted (see MIN_PURGE_INTERVAL_MS).
        const sinceLastPurge = Date.now() - this.lastPurgeStartedAt;
        const delay = Math.max(PURGE_COALESCE_MS, MIN_PURGE_INTERVAL_MS - sinceLastPurge);

        this.purgeFlushTimer = setTimeout(() => {
            this.purgeFlushTimer = undefined;

            // Chain behind any purge still running, and splice INSIDE the chained
            // callback so groups queued while it was in flight are picked up by
            // this same flush rather than needing another window.
            this.purgeInFlight = this.purgeInFlight
                .then(() => {
                    const groups = this.pendingPurgeGroups.splice(0);
                    if (groups.length === 0) return undefined;
                    this.lastPurgeStartedAt = Date.now();
                    return this.purgeGroupsOnce({ groups, trigger: 'hook' });
                })
                .catch((error: unknown) => {
                    this.logger.error(
                        `[RevalidationService] Unhandled error in coalesced revalidation purge: ${error instanceof Error ? error.message : String(error)}`
                    );
                    return undefined;
                });
        }, delay);

        // NOT unref'd, deliberately. The debounce timer that precedes this one is
        // ref'd, so the process already paid up to `debounceSeconds` of liveness
        // waiting for this exact work; making only the final 50 ms hop droppable
        // would discard it at the finish line. One liveness policy for the whole
        // chain, not two.
    }

    /**
     * Performs ONE adapter purge covering every group, then writes the audit
     * rows each group is entitled to.
     *
     * This is the single choke point for "many things changed, purge once"
     * (HOS-297). Two details are load-bearing:
     *
     *  - Outcomes are matched back to their own tag rather than assuming the
     *    whole batch shares one verdict. `RevalidationAdapter.revalidateMany` is
     *    contractually per-tag (one result per input tag); only a uniform-outcome
     *    adapter happens to return the same result for every tag today. A tag
     *    with no matching result is recorded as failed with an explicit message
     *    rather than silently inheriting someone else's verdict.
     *  - Log writes are awaited with bounded concurrency. A run can carry
     *    thousands of tags, and firing every insert unawaited in one tick just
     *    relocates the burst this method exists to remove onto Postgres.
     *
     * @param params.groups - Per-entity/per-type tag groups sharing this purge.
     * @param params.trigger - Trigger recorded on every audit row.
     * @param params.triggeredBy - Log attribution (defaults to `'system'`).
     * @returns Per-group results, in input order.
     */
    private async purgeGroupsOnce(params: {
        readonly groups: ReadonlyArray<PendingPurgeGroup>;
        readonly trigger: RevalidationTrigger;
        readonly triggeredBy?: string;
    }): Promise<
        ReadonlyArray<{ entityType: string; results: ReadonlyArray<RevalidateTargetResult> }>
    > {
        const { groups, trigger, triggeredBy = 'system' } = params;

        const unionedTags = [...new Set(groups.flatMap((group) => [...group.tags]))];
        if (unionedTags.length === 0) return [];

        const purgeResults = await this.adapter.revalidateMany({ tags: unionedTags });
        const byTarget = new Map(purgeResults.map((result) => [result.target, result]));

        // The adapter contract is one result per tag, in input order. Prefer
        // matching by tag (so a per-tag adapter is reported per tag), but fall
        // back to POSITION when the counts line up and the tag simply did not
        // match — an adapter that normalises tags would otherwise flip a fully
        // successful purge to 100% failed, which is a worse failure than the
        // shared-verdict bug this replaced.
        const canMatchByIndex = purgeResults.length === unionedTags.length;
        if (canMatchByIndex && byTarget.size === 0 && unionedTags.length > 0) {
            this.logger.warn(
                `[RevalidationService] ${this.adapter.name} returned no recognisable tags; falling back to positional matching`
            );
        }

        const resultForTag = (tag: string, index: number): RevalidateTargetResult => {
            const matched = byTarget.get(tag);
            if (matched !== undefined) return { ...matched, target: tag };

            const positional = canMatchByIndex ? purgeResults[index] : undefined;
            if (positional !== undefined) return { ...positional, target: tag };

            return {
                target: tag,
                success: false,
                durationMs: 0,
                error: `${this.adapter.name} returned no result for this tag (${purgeResults.length} result(s) for ${unionedTags.length} tag(s))`
            };
        };

        const unionIndexByTag = new Map(unionedTags.map((tag, index) => [tag, index]));

        const pendingWrites: Array<() => Promise<void>> = [];
        const grouped = groups.map((group) => {
            const results: RevalidateTargetResult[] = [...group.tags].map((tag) =>
                resultForTag(tag, unionIndexByTag.get(tag) ?? -1)
            );

            for (const result of results) {
                pendingWrites.push(() =>
                    this.writeLog({
                        target: result.target,
                        entityType: group.entityType,
                        entityId: group.entityId,
                        trigger,
                        triggeredBy,
                        status: result.success ? 'success' : 'failed',
                        durationMs: result.durationMs,
                        errorMessage: result.error,
                        metadata: group.reason ? { reason: group.reason } : undefined
                    })
                );
            }

            return { entityType: group.entityType, results };
        });

        const failedGroups = grouped.filter(({ results }) =>
            results.some((result) => !result.success)
        );
        if (failedGroups.length > 0) {
            this.logger.error(
                `[RevalidationService] Purge failed via ${this.adapter.name} for ${failedGroups.length}/${grouped.length} group(s): ${failedGroups[0]?.results.find((r) => !r.success)?.error}`
            );
        }

        // Bounded concurrency: `writeLog` already swallows its own errors.
        for (let i = 0; i < pendingWrites.length; i += LOG_WRITE_CONCURRENCY) {
            await Promise.all(
                pendingWrites.slice(i, i + LOG_WRITE_CONCURRENCY).map((write) => write())
            );
        }

        return grouped;
    }

    /**
     * Immediately purges a specific list of cache tags (no debounce).
     * Used by the manual revalidation endpoint.
     * Writes one log entry per tag after completion.
     *
     * @param params - Object containing tags and optional metadata for logging
     * @param params.tags - Cache tags to purge. Bare vocabulary tags are
     *   namespaced by this deployment's environment before they reach the
     *   adapter; tags already carrying THIS namespace pass through unchanged,
     *   and tags carrying another environment's namespace are dropped rather
     *   than rewritten (HOS-369 W1-2).
     * @param params.triggeredBy - User ID or 'system' for log attribution
     * @param params.reason - Optional human-readable reason (stored in log metadata)
     * @param params.trigger - Trigger source for the log entry (defaults to 'hook')
     * @param params.entityType - Entity type for log attribution (defaults to 'manual')
     * @param params.entityId - Canonical UUID of the entity that triggered revalidation.
     *   When provided, written to `revalidation_log.entity_id` for precise audit querying.
     *   Undefined results in a NULL `entity_id` (expected for types that don't yet supply it).
     * @returns Array of results, one per purged tag
     */
    async revalidateTags(params: {
        readonly tags: ReadonlyArray<string>;
        readonly triggeredBy?: string;
        readonly reason?: string;
        readonly trigger?: RevalidationTrigger;
        readonly entityType?: string;
        readonly entityId?: string;
    }): Promise<ReadonlyArray<RevalidateTargetResult>> {
        const {
            tags: rawTags,
            triggeredBy,
            reason,
            trigger = 'hook',
            entityType = 'manual',
            entityId
        } = params;

        const tags = this.toNamespacedTags(rawTags);
        if (tags.length === 0) return [];

        const results = await this.adapter.revalidateMany({ tags });

        // Log results and surface errors
        for (const result of results) {
            if (!result.success) {
                this.logger.error(
                    `[RevalidationService] Failed to revalidate tag "${result.target}" via ${this.adapter.name}: ${result.error}`
                );
            }
            // Write audit log entry -- best-effort, never throw
            void this.writeLog({
                target: result.target,
                entityType,
                entityId,
                trigger,
                triggeredBy,
                status: result.success ? 'success' : 'failed',
                durationMs: result.durationMs,
                errorMessage: result.error,
                metadata: reason ? { reason } : undefined
            });
        }

        return results;
    }

    /**
     * The tag a flush of THIS deployment addresses (`prod:all`, `preview:all`),
     * or {@link UNRESOLVED_ENVIRONMENT_TARGET} when the namespace is unresolved.
     *
     * Exposed so a caller that must report a flush it could not even attempt
     * (the admin route's failure branches) names the same thing the audit row
     * does, instead of falling back to `*` and claiming a zone flush.
     *
     * @returns The environment catch-all tag, or the unresolved sentinel.
     */
    getEnvironmentFlushTarget(): string {
        if (this.cacheTagEnvironment === undefined) return UNRESOLVED_ENVIRONMENT_TARGET;
        return this.toNamespacedTags([CACHE_TAG_ALL])[0] ?? UNRESOLVED_ENVIRONMENT_TARGET;
    }

    /**
     * Flushes everything THIS deployment cached, by purging the environment
     * catch-all tag (`prod:all`) that every cacheable response carries.
     *
     * NOT a zone flush any more. `staging.hospeda.com.ar` and `hospeda.com.ar`
     * are one Cloudflare zone and `purge_everything` has no scoped form, so the
     * old implementation emptied production's cache every time staging deployed
     * (and vice versa). Purging one namespaced tag reaches exactly the same
     * responses within this environment — the emitter puts `<env>:all` on every
     * one of them (`apps/web/src/lib/cache/response-cache.ts`) — and reaches
     * none of the other environment's. {@link purgeWholeZone} is still there for
     * the case that genuinely needs the zone.
     *
     * Writes exactly ONE audit row, targeting the tag it purged, rather than one
     * row per tag: there is only ever one tag.
     *
     * UNRESOLVED ENVIRONMENT: returns a failed result and writes a `skipped`
     * row targeting {@link UNRESOLVED_ENVIRONMENT_TARGET}. It deliberately does
     * NOT fall back to {@link purgeWholeZone}. Escalating a flush that cannot be
     * scoped into one that hits both environments would be strictly worse than
     * the bug this replaced, and it would do it exactly when the operator has
     * the least evidence about which deployment they are talking to.
     *
     * Still a SEPARATE method from {@link revalidateTags}, not a flag on it, so
     * "purge everything" can never be reached by accident from a content write.
     *
     * @param params.reason - Human-readable justification, recorded in the log.
     * @param params.triggeredBy - User id or 'system' for log attribution.
     * @param params.trigger - Trigger source for the log entry (defaults to 'manual').
     * @returns The result, targeting `<env>:all` (or the unresolved sentinel).
     */
    async purgeEverything(
        params: {
            readonly reason?: string;
            readonly triggeredBy?: string;
            readonly trigger?: RevalidationTrigger;
        } = {}
    ): Promise<RevalidateTargetResult> {
        const { reason, triggeredBy, trigger = 'manual' } = params;

        // Read the environment directly rather than through `toNamespacedTags`,
        // whose own error log would otherwise fire alongside the more specific
        // one below and describe the same event twice.
        const tag =
            this.cacheTagEnvironment === undefined
                ? undefined
                : this.toNamespacedTags([CACHE_TAG_ALL])[0];

        if (tag === undefined) {
            const error =
                'Cannot flush this environment: the deployment cache-tag namespace is unresolved (set HOSPEDA_DEPLOY_ENV to prod | preview | dev | test). Refusing to fall back to a whole-zone purge, which would also flush the other environment sharing this Cloudflare zone.';
            this.logger.error(`[RevalidationService] ${error}`);

            void this.writeLog({
                target: UNRESOLVED_ENVIRONMENT_TARGET,
                entityType: 'manual',
                trigger,
                triggeredBy,
                status: 'skipped',
                durationMs: 0,
                errorMessage: error,
                metadata: reason ? { reason } : undefined
            });

            return {
                target: UNRESOLVED_ENVIRONMENT_TARGET,
                success: false,
                durationMs: 0,
                error
            };
        }

        const [purged] = await this.adapter.revalidateMany({ tags: [tag] });
        const result: RevalidateTargetResult =
            purged === undefined
                ? {
                      target: tag,
                      success: false,
                      durationMs: 0,
                      error: `${this.adapter.name} returned no result for the environment catch-all tag`
                  }
                : { ...purged, target: tag };

        if (!result.success) {
            this.logger.error(
                `[RevalidationService] Environment flush failed via ${this.adapter.name} for "${tag}": ${result.error}`
            );
        }

        // Best-effort, never throw -- mirrors the per-tag log write above.
        void this.writeLog({
            target: result.target,
            entityType: 'manual',
            trigger,
            triggeredBy,
            status: result.success ? 'success' : 'failed',
            durationMs: result.durationMs,
            errorMessage: result.error,
            metadata: reason ? { reason } : undefined
        });

        return result;
    }

    /**
     * Flushes the ENTIRE Cloudflare zone — both deployments — via the adapter's
     * own `purgeEverything`.
     *
     * The emergency escape hatch, and nothing routine calls it. It exists for
     * the cases a tag purge genuinely cannot cover: a Cache Rule change that
     * altered the cache key, objects cached before tagging shipped, or a
     * suspected corruption where trusting the tags is the thing in doubt.
     *
     * It is unscoped BY NATURE: Cloudflare offers no per-environment
     * `purge_everything`, so running this from staging also empties production.
     * That is why it is a separate, explicitly named method instead of a flag on
     * {@link purgeEverything} — reading a call site tells you which one it is,
     * and no content write, cron or admin flush can reach it by accident.
     *
     * Writes exactly ONE audit row targeting {@link WHOLE_ZONE_TARGET} (`*`),
     * which is what distinguishes it in the log from an environment flush's
     * `<env>:all` row.
     *
     * @param params.reason - Human-readable justification, recorded in the log.
     * @param params.triggeredBy - User id or 'system' for log attribution.
     * @param params.trigger - Trigger source for the log entry (defaults to 'manual').
     * @returns The adapter's result, targeting `*`.
     */
    async purgeWholeZone(
        params: {
            readonly reason?: string;
            readonly triggeredBy?: string;
            readonly trigger?: RevalidationTrigger;
        } = {}
    ): Promise<RevalidateTargetResult> {
        const { reason, triggeredBy, trigger = 'manual' } = params;

        const result = await this.adapter.purgeEverything({ reason });

        if (!result.success) {
            this.logger.error(
                `[RevalidationService] Whole-zone purge failed via ${this.adapter.name}: ${result.error}`
            );
        }

        // Best-effort, never throw -- mirrors the per-tag log write above.
        void this.writeLog({
            target: WHOLE_ZONE_TARGET,
            entityType: 'manual',
            trigger,
            triggeredBy,
            status: result.success ? 'success' : 'failed',
            durationMs: result.durationMs,
            errorMessage: result.error,
            metadata: reason ? { reason } : undefined
        });

        return result;
    }

    // ---------------------------------------------------------------------------
    // Private helpers
    // ---------------------------------------------------------------------------

    /**
     * Reads config, validates gating rules, and schedules debounced revalidation.
     * All errors are caught -- this is called fire-and-forget from scheduleRevalidation.
     */
    private async resolveConfigAndSchedule(
        event: EntityChangeData,
        reason?: string
    ): Promise<void> {
        try {
            const config = await this.getEntityConfig(event.entityType);

            if (!config) {
                // A MISSING row is not a configuration choice — it is an entity
                // type whose purge chain was wired without the row that turns it
                // on, and until HOS-369 that failed in total silence: no log
                // here, no `revalidation_log` entry (writeLog runs downstream),
                // and a fire-and-forget caller that sees a successful write
                // either way. Four entity types purged nothing for an entire
                // wave because of it. `enabled: false` and
                // `autoRevalidateOnChange: false` below stay quiet by contrast:
                // those rows exist, so somebody chose them.
                this.logger.warn(
                    { entityType: event.entityType },
                    'No revalidation_config row for this entity type — skipping purge. Its cache tags will never be evicted until a row is added (see seed data-migration 0036).'
                );
                return;
            }
            if (!config.enabled) return; // Disabled for this entity type
            if (!config.autoRevalidateOnChange) return; // Auto-revalidation turned off

            const effectiveDebounceMs = config.debounceSeconds * 1000;
            const tags = this.toNamespacedTags(getAffectedCacheTags(event));

            // Two distinct identifiers, deliberately decoupled:
            // - debounceKeyId: per-entity bucket key (slug) so edits to different
            //   entities of the same type don't collapse into one debounce bucket.
            // - entityId: canonical UUID written to revalidation_log.entity_id
            //   (undefined for types whose hook doesn't forward `id` yet).
            const debounceKeyId = this.extractDebounceKeyId(event);
            const entityId = this.extractEntityId(event);

            this.debounceEntity({
                tags,
                entityType: event.entityType,
                debounceKeyId,
                entityId,
                debounceMs: effectiveDebounceMs,
                reason
            });
        } catch (error) {
            this.logger.error(
                `[RevalidationService] Error in resolveConfigAndSchedule for entityType "${event.entityType}": ${error instanceof Error ? error.message : String(error)}`
            );
        }
    }

    /**
     * Extracts a stable entity identifier from the change event.
     *
     * For accommodation events, returns the canonical UUID (`event.id`) when
     * available — this is what gets written to `revalidation_log.entity_id`.
     * Returning undefined (e.g. when a call site doesn't supply `id` yet) is
     * expected and results in a NULL `entity_id` in the log row (no mixing of
     * UUIDs and slugs in the same column).
     *
     * For other entity types (destination, event, post), the hook does not yet
     * forward `id`, so this returns undefined. Follow-up work per SPEC-246
     * will add `id` propagation to those hooks.
     *
     * Returns undefined when no specific entity instance is identifiable.
     */
    private extractEntityId(event: EntityChangeData): string | undefined {
        switch (event.entityType) {
            case 'accommodation':
            case 'destination':
            case 'event':
            case 'post':
                // The canonical UUID when the call site had one; undefined
                // otherwise. The slug is deliberately NOT used as a fallback —
                // mixing UUIDs and slugs in one column makes `entity_id`
                // unqueryable. All four content types carry `id` on
                // EntityChangeData since HOS-369 W1-1.
                return event.id;
            case 'accommodation_review':
            case 'destination_review':
                // These hooks don't yet forward a canonical UUID — addressed as
                // follow-up. Returning undefined keeps entity_id NULL rather than
                // writing a slug into the UUID column.
                return undefined;
            case 'tag':
            case 'amenity':
                return undefined;
        }
    }

    /**
     * Extracts the per-entity debounce bucket key from the change event.
     *
     * Uses the entity slug (or the parent slug for reviews) so that edits to
     * different entities of the same type are debounced independently. This is
     * intentionally separate from {@link extractEntityId} (which yields the
     * canonical UUID for the audit log): the bucket key must stay unique per
     * entity even for types that don't yet forward a UUID, otherwise all
     * entities of a type would collapse into a single shared debounce bucket.
     *
     * Returns undefined when no per-entity identifier is available (e.g. tag,
     * amenity), in which case the bucket falls back to the entity type alone.
     */
    private extractDebounceKeyId(event: EntityChangeData): string | undefined {
        switch (event.entityType) {
            case 'accommodation':
            case 'destination':
            case 'event':
            case 'post':
                return event.slug;
            case 'accommodation_review':
                return event.accommodationSlug;
            case 'destination_review':
                return event.destinationSlug;
            case 'tag':
            case 'amenity':
                return undefined;
        }
    }

    /**
     * Debounces revalidation for an entity.
     * Uses `${entityType}:${debounceKeyId}` as key when a per-entity id (slug) is
     * available, falling back to just `${entityType}`. The bucket key is kept
     * separate from `entityId` (the UUID written to the log) so distinct entities
     * of the same type never share a debounce bucket.
     * Accumulates all tags for the entity and fires a single batch purge
     * when the debounce timer expires.
     */
    private debounceEntity(params: {
        readonly tags: readonly string[];
        readonly entityType: string;
        readonly debounceKeyId: string | undefined;
        readonly entityId: string | undefined;
        readonly debounceMs: number;
        readonly reason?: string;
    }): void {
        const { tags, entityType, debounceKeyId, entityId, debounceMs, reason } = params;
        const key = debounceKeyId ? `${entityType}:${debounceKeyId}` : entityType;

        // HOS-297: ONE fire callback, shared by both arming sites below.
        //
        // These two sites are the reason the first attempt at this fix did not
        // work: only the creation branch was converted, so any entity that got a
        // second change event inside its window had its timer replaced by the
        // old un-coalesced closure and went back to firing its own purge. That is
        // not an edge case — `plan-downgrade-remediation` emits slug-less events
        // that all collapse onto one key, so every event after the first took the
        // reset branch. Keep this as a single function; do not inline it back.
        const fireIntoSharedPurgeWindow = (entry: PendingEntityDebounce): void => {
            this.pendingTimers.delete(key);
            this.enqueuePurgeGroup({
                entityType,
                entityId: entry.entityId,
                tags: Array.from(entry.tags),
                ...(reason === undefined ? {} : { reason })
            });
        };

        const existing = this.pendingTimers.get(key);
        if (existing === undefined) {
            // Create a new debounce entry. entityId is pinned here; later calls
            // in the same window only set it when still undefined (see above).
            const entry: PendingEntityDebounce = {
                tags: new Set(tags),
                entityType,
                entityId,
                timer: setTimeout(() => fireIntoSharedPurgeWindow(entry), debounceMs)
            };

            this.pendingTimers.set(key, entry);
        } else {
            // Accumulate new tags into the existing debounce entry
            for (const tag of tags) {
                existing.tags.add(tag);
            }
            // First-write-wins: keep the UUID from the first call in the window
            // that supplied one, so a later id-less call (e.g. _afterCreate) for
            // the same entity cannot null it out.
            if (existing.entityId === undefined && entityId !== undefined) {
                existing.entityId = entityId;
            }
            clearTimeout(existing.timer);

            // Reset the timer with accumulated tags — through the SAME shared
            // callback as the creation branch above.
            existing.timer = setTimeout(() => fireIntoSharedPurgeWindow(existing), debounceMs);
        }
    }

    /**
     * Returns the revalidation config for the given entity type.
     * Results are cached in memory for {@link CONFIG_CACHE_TTL_MS} to avoid
     * a DB round-trip on every hook invocation.
     *
     * @param entityType - Entity type key to look up
     * @returns Config record, or undefined if not found
     */
    private async getEntityConfig(
        entityType: string
    ): Promise<RevalidationConfigRecord | undefined> {
        const now = Date.now();
        const cached = this.configCache.get(entityType);

        if (cached !== undefined && cached.expiresAt > now) {
            return cached.record;
        }

        const record = await this.configModel.findByEntityType(entityType);
        this.configCache.set(entityType, {
            record,
            expiresAt: now + CONFIG_CACHE_TTL_MS
        });

        return record;
    }

    /**
     * Writes one log entry to `revalidation_log`. Best-effort -- errors are swallowed.
     *
     * @param params.target - The cache tag purged (`prod:accom-x`, `prod:all`),
     *   `*` for a whole-zone flush, or `?:all` for an environment flush that
     *   could not be addressed. Written to `revalidation_log.target`.
     * @param params.entityId - Canonical UUID of the entity that triggered revalidation.
     *   Written to `revalidation_log.entity_id`. Pass undefined to leave the column NULL.
     */
    private async writeLog(params: {
        readonly target: string;
        readonly entityType: string;
        readonly entityId?: string;
        readonly trigger: RevalidationTrigger;
        readonly triggeredBy?: string;
        readonly status: 'success' | 'failed' | 'skipped';
        readonly durationMs: number;
        readonly errorMessage?: string;
        readonly metadata?: Record<string, unknown>;
    }): Promise<void> {
        try {
            await this.logModel.create({
                target: params.target,
                entityType: params.entityType,
                entityId: params.entityId ?? null,
                trigger: params.trigger,
                triggeredBy: params.triggeredBy ?? 'system',
                status: params.status,
                durationMs: params.durationMs,
                errorMessage: params.errorMessage,
                metadata: params.metadata ?? null
            });
        } catch (error) {
            this.logger.error(
                `[RevalidationService] Failed to write revalidation log for target "${params.target}": ${error instanceof Error ? error.message : String(error)}`
            );
        }
    }
}
