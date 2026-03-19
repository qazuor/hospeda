import { RevalidationConfigModel, RevalidationLogModel } from '@repo/db';
import type { RevalidationConfigRecord } from '@repo/db';
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

/** Default debounce window in milliseconds (30 seconds) */
const DEFAULT_DEBOUNCE_MS = 30_000;

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
    timer: ReturnType<typeof setTimeout>;
}

/** TTL for the in-memory revalidation config cache (milliseconds) */
const CONFIG_CACHE_TTL_MS = 60_000; // 60 seconds

/**
 * Central service for on-demand ISR page revalidation.
 *
 * Responsibilities:
 * - Reads per-entity-type config from `revalidation_config` (with 60 s in-memory cache)
 * - Debounces rapid successive change events for the same entity (keyed by entityType:entityId)
 * - Writes audit entries to `revalidation_log` after every revalidation attempt
 * - Uses the injected adapter for actual HTTP calls (Vercel or no-op)
 *
 * All revalidation triggered by hooks is fire-and-forget -- never blocks CRUD operations.
 */
export class RevalidationService {
    private readonly adapter: RevalidationAdapter;
    private readonly debounceMs: number;
    private readonly localesConfig: ReadonlyArray<string>;
    private readonly maxCronRevalidationsConfig: number;
    private readonly logRetentionDaysConfig: number;
    private readonly entityResolverInstance: EntityResolver | undefined;
    private readonly pendingTimers = new Map<string, PendingEntityDebounce>();
    private readonly configCache = new Map<string, ConfigCacheEntry>();
    private readonly logModel: RevalidationLogModel;
    private readonly configModel: RevalidationConfigModel;
    private readonly logger = createLogger('revalidation-service');

    constructor(config: RevalidationServiceConfig) {
        this.adapter = config.adapter;
        this.debounceMs = config.debounceMs ?? DEFAULT_DEBOUNCE_MS;
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
                    return this.revalidatePaths({
                        paths: [...allPaths],
                        triggeredBy: 'system',
                        trigger,
                        entityType
                    });
                }
            } catch (error) {
                this.logger.error(
                    `[RevalidationService] EntityResolver failed for type "${entityType}", falling back to generic paths: ${error instanceof Error ? error.message : String(error)}`
                );
            }
        }

        // Fallback: no resolver or resolver failed -- use generic listing paths
        const paths = getAffectedPaths({ entityType } as EntityChangeData, this.localesConfig);
        return this.revalidatePaths({ paths, triggeredBy: 'system', trigger, entityType });
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
     * @returns Array of results, one per revalidated path
     */
    async revalidatePaths(params: {
        readonly paths: ReadonlyArray<string>;
        readonly triggeredBy?: string;
        readonly reason?: string;
        readonly trigger?: RevalidationTrigger;
        readonly entityType?: string;
    }): Promise<ReadonlyArray<RevalidatePathResult>> {
        const { paths, triggeredBy, reason, trigger = 'hook', entityType = 'manual' } = params;

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

            // Derive entity ID from the event when available (slug serves as entity identifier)
            const entityId = this.extractEntityId(event);

            this.debounceEntity({
                paths,
                entityType: event.entityType,
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
     * Uses the slug or relevant identifier field when available.
     * Returns undefined when no specific entity instance is identifiable.
     */
    private extractEntityId(event: EntityChangeData): string | undefined {
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
     * Uses `${entityType}:${entityId}` as key when entityId is available,
     * falling back to just `${entityType}`.
     * Accumulates all paths for the entity and fires a single batch revalidation
     * when the debounce timer expires.
     */
    private debounceEntity(params: {
        readonly paths: readonly string[];
        readonly entityType: string;
        readonly entityId: string | undefined;
        readonly debounceMs: number;
        readonly reason?: string;
    }): void {
        const { paths, entityType, entityId, debounceMs, reason } = params;
        const key = entityId ? `${entityType}:${entityId}` : entityType;

        const existing = this.pendingTimers.get(key);
        if (existing !== undefined) {
            // Accumulate new paths into the existing debounce entry
            for (const path of paths) {
                existing.paths.add(path);
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
                    entityType
                }).catch((error: unknown) => {
                    this.logger.error(
                        `[RevalidationService] Unhandled error in debounced revalidation for key "${key}": ${error instanceof Error ? error.message : String(error)}`
                    );
                });
            }, debounceMs);
        } else {
            // Create a new debounce entry
            const pathSet = new Set(paths);
            const entry: PendingEntityDebounce = {
                paths: pathSet,
                entityType,
                timer: setTimeout(() => {
                    this.pendingTimers.delete(key);
                    const allPaths = Array.from(pathSet);
                    void this.revalidatePaths({
                        paths: allPaths,
                        reason,
                        trigger: 'hook',
                        entityType
                    }).catch((error: unknown) => {
                        this.logger.error(
                            `[RevalidationService] Unhandled error in debounced revalidation for key "${key}": ${error instanceof Error ? error.message : String(error)}`
                        );
                    });
                }, debounceMs)
            };

            this.pendingTimers.set(key, entry);
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
     */
    private async writeLog(params: {
        readonly path: string;
        readonly entityType: string;
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
