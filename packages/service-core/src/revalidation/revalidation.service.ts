/**
 * Revalidation service — schedules and executes Astro ISR cache revalidation.
 *
 * Slightly over the 500-line guideline; split deferred (reviewed SPEC-167 T-023).
 *
 * @module revalidation/revalidation.service
 */

import type { RevalidationConfigRecord } from '@repo/db';
import { RevalidationConfigModel, RevalidationLogModel } from '@repo/db';
import { createLogger } from '@repo/logger';
import type { RevalidatePathResult, RevalidationAdapter } from './adapters/revalidation.adapter.js';
import type { EntityChangeData } from './entity-path-mapper.js';
import { getAffectedPaths } from './entity-path-mapper.js';

/**
 * Resolver that queries the database for entities of a specific type.
 * Used by {@link RevalidationService} to look up published entities
 * when performing type-level or entity-level revalidation.
 *
 * Implementations live in the API layer (not service-core) because
 * they depend on concrete DB models.
 */
export interface EntityResolver {
    /**
     * Returns {@link EntityChangeData} for all published/active entities
     * of the given type. Used by {@link RevalidationService.revalidateByEntityType}
     * to discover individual detail page paths.
     *
     * @param params - Object containing the entity type to resolve
     * @returns Array of entity change data objects, one per published entity
     */
    readonly resolveByType: (params: {
        readonly entityType: EntityChangeData['entityType'];
    }) => Promise<ReadonlyArray<EntityChangeData>>;

    /**
     * Returns {@link EntityChangeData} for a single entity by type and ID.
     * Used by the `/revalidate/entity` endpoint to look up a specific entity
     * before revalidating its paths.
     *
     * @param params - Object containing entity type and entity ID
     * @returns The entity change data, or null if not found
     */
    readonly resolveById: (params: {
        readonly entityType: EntityChangeData['entityType'];
        readonly entityId: string;
    }) => Promise<EntityChangeData | null>;
}

/** Default maximum number of entity types to revalidate per cron run */
const DEFAULT_MAX_CRON_REVALIDATIONS = 500;

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
     * Supported locales for URL path generation.
     * Used by getAffectedPaths to generate locale-prefixed paths.
     */
    readonly locales: ReadonlyArray<string>;
    /**
     * Maximum number of entity types to revalidate per cron job run.
     * Prevents runaway revalidation in large deployments.
     * Defaults to 500.
     */
    readonly maxCronRevalidations?: number;
    /**
     * Number of days to retain revalidation log entries before cleanup.
     * Used by the cron job to delete old log entries.
     * Defaults to 30.
     */
    readonly logRetentionDays?: number;
    /**
     * Optional entity resolver for looking up published entities from the database.
     * When provided, {@link RevalidationService.revalidateByEntityType} queries
     * individual entity detail pages instead of just generic listing paths.
     */
    readonly entityResolver?: EntityResolver;
}

/** Trigger source for revalidation log entries */
export type RevalidationTrigger = 'manual' | 'cron' | 'hook' | 'stale';

/** Internal config cache entry */
interface ConfigCacheEntry {
    readonly record: RevalidationConfigRecord | undefined;
    readonly expiresAt: number;
}

/** Pending entity debounce state: accumulated paths and the timer reference */
interface PendingEntityDebounce {
    readonly paths: Set<string>;
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

/** One entity's worth of paths awaiting the next shared purge. */
interface PendingPurgeGroup {
    readonly entityType: string;
    readonly entityId: string | undefined;
    readonly paths: readonly string[];
    readonly reason?: string;
}

/** How many `revalidation_log` inserts may be in flight at once. */
const LOG_WRITE_CONCURRENCY = 20;

/**
 * Central service for on-demand ISR page revalidation.
 *
 * Responsibilities:
 * - Reads per-entity-type config from `revalidation_config` (with 60 s in-memory cache)
 * - Debounces rapid successive change events for the same entity (keyed by entityType:entityId)
 * - Writes audit entries to `revalidation_log` after every revalidation attempt
 * - Uses the injected adapter for actual HTTP calls (Cloudflare cache purge or no-op)
 *
 * All revalidation triggered by hooks is fire-and-forget -- never blocks CRUD operations.
 */
export class RevalidationService {
    private readonly adapter: RevalidationAdapter;
    private readonly localesConfig: ReadonlyArray<string>;
    private readonly maxCronRevalidationsConfig: number;
    private readonly logRetentionDaysConfig: number;
    private readonly entityResolverInstance: EntityResolver | undefined;
    private readonly pendingTimers = new Map<string, PendingEntityDebounce>();
    /** Groups waiting for the next shared purge (HOS-297). */
    private readonly pendingPurgeGroups: PendingPurgeGroup[] = [];
    /** Armed while a shared purge is pending; `undefined` means none is armed. */
    private purgeFlushTimer: ReturnType<typeof setTimeout> | undefined;
    private readonly configCache = new Map<string, ConfigCacheEntry>();
    private readonly logModel: RevalidationLogModel;
    private readonly configModel: RevalidationConfigModel;
    private readonly logger = createLogger('revalidation-service');

    constructor(config: RevalidationServiceConfig) {
        this.adapter = config.adapter;
        this.localesConfig = config.locales;
        this.maxCronRevalidationsConfig =
            config.maxCronRevalidations ?? DEFAULT_MAX_CRON_REVALIDATIONS;
        this.logRetentionDaysConfig = config.logRetentionDays ?? DEFAULT_LOG_RETENTION_DAYS;
        this.entityResolverInstance = config.entityResolver;
        this.logModel = new RevalidationLogModel();
        this.configModel = new RevalidationConfigModel();
    }

    /**
     * Returns the configured locales for URL path generation.
     * @returns Readonly array of locale codes (e.g. ['es', 'en', 'pt'])
     */
    getLocales(): ReadonlyArray<string> {
        return this.localesConfig;
    }

    /**
     * Returns the maximum number of entity types to revalidate per cron run.
     * @returns The configured max or the default (500)
     */
    getMaxCronRevalidations(): number {
        return this.maxCronRevalidationsConfig;
    }

    /**
     * Returns the number of days to retain revalidation log entries.
     * @returns The configured retention days or the default (30)
     */
    getLogRetentionDays(): number {
        return this.logRetentionDaysConfig;
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
     * Schedule revalidation for pages affected by an entity change event.
     *
     * Before scheduling, reads the entity-type config from the database (with 60 s cache).
     * Returns immediately without doing anything if:
     * - The config record does not exist
     * - `enabled === false`
     * - `autoRevalidateOnChange === false`
     *
     * Uses entity-level debouncing: multiple calls for the same entity (keyed by
     * `entityType:entityId` or just `entityType`) within the debounce window are merged
     * into a single batch revalidation of all accumulated paths.
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
     * Immediately revalidate all paths for a given entity type (no debounce).
     * Used by the scheduled cron job and manual admin triggers.
     *
     * When an {@link EntityResolver} is configured, queries the database for all
     * published entities of the given type and computes paths for each individual
     * entity (detail pages + listing pages). This provides precise revalidation
     * instead of only revalidating generic listing pages.
     *
     * Falls back to generic listing-only path computation when no resolver is available.
     *
     * @param params - Object containing entity type and optional trigger
     * @param params.entityType - The entity type whose pages should all be revalidated
     * @param params.trigger - Trigger source for the log entry (defaults to 'cron')
     * @returns Array of results, one per revalidated path
     */
    async revalidateByEntityType(params: {
        readonly entityType: EntityChangeData['entityType'];
        readonly trigger?: RevalidationTrigger;
    }): Promise<ReadonlyArray<RevalidatePathResult>> {
        const { entityType, trigger = 'cron' } = params;

        const paths = await this.resolvePathsForEntityType({ entityType });
        return this.revalidatePaths({ paths, triggeredBy: 'system', trigger, entityType });
    }

    /**
     * Resolves every page path affected by an entity type, without purging.
     *
     * Split out of {@link revalidateByEntityType} so {@link revalidateEntityTypesBatch}
     * can gather paths across several types and then purge ONCE (HOS-297).
     *
     * Uses the entity resolver for precise per-entity paths when one is configured,
     * capped at `maxCronRevalidations`; falls back to the type's generic listing
     * paths when there is no resolver, when the resolver throws, or when it resolves
     * to nothing.
     *
     * @param params.entityType - Entity type to resolve paths for.
     * @returns Deduplicated paths. Never throws.
     */
    private async resolvePathsForEntityType(params: {
        readonly entityType: EntityChangeData['entityType'];
    }): Promise<string[]> {
        const { entityType } = params;

        if (this.entityResolverInstance) {
            try {
                const entities = await this.entityResolverInstance.resolveByType({ entityType });
                const allPaths = new Set<string>();

                // Limit entities to maxCronRevalidations to prevent runaway revalidation
                const limitedEntities = entities.slice(0, this.maxCronRevalidationsConfig);

                for (const entity of limitedEntities) {
                    const entityPaths = getAffectedPaths(entity, this.localesConfig);
                    for (const p of entityPaths) {
                        allPaths.add(p);
                    }
                }

                if (allPaths.size > 0) {
                    return [...allPaths];
                }
            } catch (error) {
                this.logger.error(
                    `[RevalidationService] EntityResolver failed for type "${entityType}", falling back to generic paths: ${error instanceof Error ? error.message : String(error)}`
                );
            }
        }

        // Fallback: no resolver, resolver failed, or resolver returned nothing.
        return [
            ...new Set(getAffectedPaths({ entityType } as EntityChangeData, this.localesConfig))
        ];
    }

    /**
     * Revalidates SEVERAL entity types in a single cache purge (HOS-297).
     *
     * The adapter's purge invalidates the whole zone in one call, so calling
     * {@link revalidateByEntityType} once per entity type — as the page-revalidation
     * cron used to — fires N identical zone purges per run where one would do.
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
     *   ignored; a type that resolves to no paths is skipped (no purge, no log).
     * @param params.trigger - Trigger source recorded on every log entry (default `'cron'`).
     * @returns Results grouped per entity type, in input order (types that resolved to
     *   no paths are omitted).
     */
    async revalidateEntityTypesBatch(params: {
        readonly entityTypes: ReadonlyArray<EntityChangeData['entityType']>;
        readonly trigger?: RevalidationTrigger;
    }): Promise<
        ReadonlyArray<{ entityType: string; results: ReadonlyArray<RevalidatePathResult> }>
    > {
        const { entityTypes, trigger = 'cron' } = params;

        // Resolve every type's paths BEFORE purging, so the single purge below
        // covers the whole run.
        const perType: Array<{ entityType: string; paths: string[] }> = [];
        const seenTypes = new Set<string>();

        for (const entityType of entityTypes) {
            if (seenTypes.has(entityType)) continue;
            seenTypes.add(entityType);

            const paths = await this.resolvePathsForEntityType({ entityType });
            if (paths.length > 0) {
                perType.push({ entityType, paths });
            }
        }

        if (perType.length === 0) return [];

        return this.purgeGroupsOnce({
            groups: perType.map(({ entityType, paths }) => ({
                entityType,
                entityId: undefined,
                paths
            })),
            trigger,
            triggeredBy: 'system'
        });
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

        this.purgeFlushTimer = setTimeout(() => {
            this.purgeFlushTimer = undefined;
            const groups = this.pendingPurgeGroups.splice(0);
            if (groups.length === 0) return;

            void this.purgeGroupsOnce({ groups, trigger: 'hook' }).catch((error: unknown) => {
                this.logger.error(
                    `[RevalidationService] Unhandled error in coalesced revalidation purge: ${error instanceof Error ? error.message : String(error)}`
                );
            });
        }, PURGE_COALESCE_MS);

        // Never hold the process open for a cache purge.
        this.purgeFlushTimer.unref?.();
    }

    /**
     * Performs ONE adapter purge covering every group, then writes the audit
     * rows each group is entitled to.
     *
     * This is the single choke point for "many things changed, purge once"
     * (HOS-297). Two details are load-bearing:
     *
     *  - Outcomes are matched back to their own path rather than assuming the
     *    whole batch shares one verdict. `RevalidationAdapter.revalidateMany` is
     *    contractually per-path (`Promise.allSettled`, one result per path); only
     *    the Cloudflare zone-purge adapter happens to return a uniform result
     *    today. A path with no matching result is recorded as failed with an
     *    explicit message rather than silently inheriting someone else's verdict.
     *  - Log writes are awaited with bounded concurrency. A run can carry
     *    thousands of paths, and firing every insert unawaited in one tick just
     *    relocates the burst this method exists to remove onto Postgres.
     *
     * @param params.groups - Per-entity/per-type path groups sharing this purge.
     * @param params.trigger - Trigger recorded on every audit row.
     * @param params.triggeredBy - Log attribution (defaults to `'system'`).
     * @returns Per-group results, in input order.
     */
    private async purgeGroupsOnce(params: {
        readonly groups: ReadonlyArray<PendingPurgeGroup>;
        readonly trigger: RevalidationTrigger;
        readonly triggeredBy?: string;
    }): Promise<
        ReadonlyArray<{ entityType: string; results: ReadonlyArray<RevalidatePathResult> }>
    > {
        const { groups, trigger, triggeredBy = 'system' } = params;

        const unionedPaths = [...new Set(groups.flatMap((group) => [...group.paths]))];
        if (unionedPaths.length === 0) return [];

        const purgeResults = await this.adapter.revalidateMany({ paths: unionedPaths });
        const byPath = new Map(purgeResults.map((result) => [result.path, result]));

        const missingResult = (path: string): RevalidatePathResult => ({
            path,
            success: false,
            durationMs: 0,
            error: `${this.adapter.name} returned no result for this path (${purgeResults.length} result(s) for ${unionedPaths.length} path(s))`
        });

        const pendingWrites: Array<() => Promise<void>> = [];
        const grouped = groups.map((group) => {
            const results: RevalidatePathResult[] = [...group.paths].map(
                (path) => byPath.get(path) ?? missingResult(path)
            );

            for (const result of results) {
                pendingWrites.push(() =>
                    this.writeLog({
                        path: result.path,
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
     * Immediately revalidate a specific list of paths (no debounce).
     * Used by the manual revalidation endpoint.
     * Writes one log entry per path after completion.
     *
     * @param params - Object containing paths and optional metadata for logging
     * @param params.paths - Array of URL paths to revalidate
     * @param params.triggeredBy - User ID or 'system' for log attribution
     * @param params.reason - Optional human-readable reason (stored in log metadata)
     * @param params.trigger - Trigger source for the log entry (defaults to 'hook')
     * @param params.entityType - Entity type for log attribution (defaults to 'manual')
     * @param params.entityId - Canonical UUID of the entity that triggered revalidation.
     *   When provided, written to `revalidation_log.entity_id` for precise audit querying.
     *   Undefined results in a NULL `entity_id` (expected for types that don't yet supply it).
     * @returns Array of results, one per revalidated path
     */
    async revalidatePaths(params: {
        readonly paths: ReadonlyArray<string>;
        readonly triggeredBy?: string;
        readonly reason?: string;
        readonly trigger?: RevalidationTrigger;
        readonly entityType?: string;
        readonly entityId?: string;
    }): Promise<ReadonlyArray<RevalidatePathResult>> {
        const {
            paths,
            triggeredBy,
            reason,
            trigger = 'hook',
            entityType = 'manual',
            entityId
        } = params;

        if (paths.length === 0) return [];

        const results = await this.adapter.revalidateMany({ paths });

        // Log results and surface errors
        for (const result of results) {
            if (!result.success) {
                this.logger.error(
                    `[RevalidationService] Failed to revalidate path "${result.path}" via ${this.adapter.name}: ${result.error}`
                );
            }
            // Write audit log entry -- best-effort, never throw
            void this.writeLog({
                path: result.path,
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

            if (!config) return; // No config -- skip revalidation
            if (!config.enabled) return; // Disabled for this entity type
            if (!config.autoRevalidateOnChange) return; // Auto-revalidation turned off

            const effectiveDebounceMs = config.debounceSeconds * 1000;
            const paths = getAffectedPaths(event, this.localesConfig);

            // Two distinct identifiers, deliberately decoupled:
            // - debounceKeyId: per-entity bucket key (slug) so edits to different
            //   entities of the same type don't collapse into one debounce bucket.
            // - entityId: canonical UUID written to revalidation_log.entity_id
            //   (undefined for types whose hook doesn't forward `id` yet).
            const debounceKeyId = this.extractDebounceKeyId(event);
            const entityId = this.extractEntityId(event);

            this.debounceEntity({
                paths,
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
                // Prefer the canonical UUID; falls back to undefined if not supplied.
                // Slug is intentionally NOT used here to avoid mixing identifiers.
                return event.id;
            case 'destination':
            case 'event':
            case 'post':
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
     * Accumulates all paths for the entity and fires a single batch revalidation
     * when the debounce timer expires.
     */
    private debounceEntity(params: {
        readonly paths: readonly string[];
        readonly entityType: string;
        readonly debounceKeyId: string | undefined;
        readonly entityId: string | undefined;
        readonly debounceMs: number;
        readonly reason?: string;
    }): void {
        const { paths, entityType, debounceKeyId, entityId, debounceMs, reason } = params;
        const key = debounceKeyId ? `${entityType}:${debounceKeyId}` : entityType;

        const existing = this.pendingTimers.get(key);
        if (existing === undefined) {
            // Create a new debounce entry. entityId is pinned here; later calls
            // in the same window only set it when still undefined (see above).
            const pathSet = new Set(paths);
            const entry: PendingEntityDebounce = {
                paths: pathSet,
                entityType,
                entityId,
                timer: setTimeout(() => {
                    this.pendingTimers.delete(key);
                    // HOS-297: hand the paths to the shared purge window instead
                    // of firing this bucket's own purge. Every sibling bucket
                    // expires in this same tick, so purging here is exactly the
                    // concurrent burst the edge WAF blocks.
                    this.enqueuePurgeGroup({
                        entityType,
                        entityId: entry.entityId,
                        paths: Array.from(pathSet),
                        ...(reason === undefined ? {} : { reason })
                    });
                }, debounceMs)
            };

            this.pendingTimers.set(key, entry);
        } else {
            // Accumulate new paths into the existing debounce entry
            for (const path of paths) {
                existing.paths.add(path);
            }
            // First-write-wins: keep the UUID from the first call in the window
            // that supplied one, so a later id-less call (e.g. _afterCreate) for
            // the same entity cannot null it out.
            if (existing.entityId === undefined && entityId !== undefined) {
                existing.entityId = entityId;
            }
            clearTimeout(existing.timer);

            // Reset the timer with accumulated paths
            existing.timer = setTimeout(() => {
                this.pendingTimers.delete(key);
                const allPaths = Array.from(existing.paths);
                void this.revalidatePaths({
                    paths: allPaths,
                    reason,
                    trigger: 'hook',
                    entityType,
                    entityId: existing.entityId
                }).catch((error: unknown) => {
                    this.logger.error(
                        `[RevalidationService] Unhandled error in debounced revalidation for key "${key}": ${error instanceof Error ? error.message : String(error)}`
                    );
                });
            }, debounceMs);
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
     * @param params.entityId - Canonical UUID of the entity that triggered revalidation.
     *   Written to `revalidation_log.entity_id`. Pass undefined to leave the column NULL.
     */
    private async writeLog(params: {
        readonly path: string;
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
                path: params.path,
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
                `[RevalidationService] Failed to write revalidation log for path "${params.path}": ${error instanceof Error ? error.message : String(error)}`
            );
        }
    }
}
