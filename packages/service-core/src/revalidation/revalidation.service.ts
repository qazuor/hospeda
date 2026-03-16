import { RevalidationConfigModel, RevalidationLogModel } from '@repo/db';
import type { RevalidationConfigRecord } from '@repo/db';
import { createLogger } from '@repo/logger';
import type { RevalidationAdapter } from './adapters/revalidation.adapter.js';
import type { EntityChangeData } from './entity-path-mapper.js';
import { getAffectedPaths } from './entity-path-mapper.js';

/** Configuration for RevalidationService */
export interface RevalidationServiceConfig {
    /** Adapter responsible for performing the actual HTTP revalidation calls */
    readonly adapter: RevalidationAdapter;
    /**
     * Debounce window in milliseconds applied to `scheduleRevalidation` calls.
     * Multiple calls for the same path within this window are merged into one.
     * Defaults to 5000 ms (5 seconds).
     */
    readonly debounceMs?: number;
}

/** Trigger source for revalidation log entries */
export type RevalidationTrigger = 'manual' | 'cron' | 'hook' | 'stale';

/** Internal config cache entry */
interface ConfigCacheEntry {
    readonly record: RevalidationConfigRecord | undefined;
    readonly expiresAt: number;
}

/** TTL for the in-memory revalidation config cache (milliseconds) */
const CONFIG_CACHE_TTL_MS = 60_000; // 60 seconds

/**
 * Central service for on-demand ISR page revalidation.
 *
 * Responsibilities:
 * - Reads per-entity-type config from `revalidation_config` (with 60 s in-memory cache)
 * - Debounces rapid successive change events for the same path
 * - Writes audit entries to `revalidation_log` after every revalidation attempt
 * - Uses the injected adapter for actual HTTP calls (Vercel or no-op)
 *
 * All revalidation triggered by hooks is fire-and-forget — never blocks CRUD operations.
 */
export class RevalidationService {
    private readonly adapter: RevalidationAdapter;
    private readonly debounceMs: number;
    private readonly pendingTimers = new Map<string, ReturnType<typeof setTimeout>>();
    private readonly configCache = new Map<string, ConfigCacheEntry>();
    private readonly logModel: RevalidationLogModel;
    private readonly configModel: RevalidationConfigModel;
    private readonly logger = createLogger('revalidation-service');

    constructor(config: RevalidationServiceConfig) {
        this.adapter = config.adapter;
        this.debounceMs = config.debounceMs ?? 5000;
        this.logModel = new RevalidationLogModel();
        this.configModel = new RevalidationConfigModel();
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
     * Uses debouncing: multiple calls for the same path within `debounceMs` are merged.
     * Fire-and-forget — never throws, never blocks.
     *
     * @param event - Discriminated union describing the changed entity with contextual data
     * @param reason - Optional human-readable reason for logging
     */
    scheduleRevalidation(event: EntityChangeData, reason?: string): void {
        // Resolve config asynchronously and schedule — fully fire-and-forget
        void this.resolveConfigAndSchedule(event, reason);
    }

    /**
     * Immediately revalidate all paths for a given entity type (no debounce).
     * Used by the scheduled cron job.
     *
     * @param entityType - The entity type whose pages should all be revalidated
     */
    async revalidateByEntityType(entityType: EntityChangeData['entityType']): Promise<void> {
        const paths = getAffectedPaths({ entityType } as EntityChangeData);
        await this.revalidatePaths(paths, 'system', undefined, 'cron');
    }

    /**
     * Immediately revalidate a specific list of paths (no debounce).
     * Used by the manual revalidation endpoint.
     * Writes one log entry per path after completion.
     *
     * @param paths - Array of URL paths to revalidate
     * @param triggeredBy - User ID or 'system' for log attribution
     * @param reason - Optional human-readable reason (stored in log metadata)
     * @param trigger - Trigger source for the log entry (defaults to 'hook')
     */
    async revalidatePaths(
        paths: readonly string[],
        triggeredBy?: string,
        reason?: string,
        trigger: RevalidationTrigger = 'hook'
    ): Promise<void> {
        if (paths.length === 0) return;

        const results = await this.adapter.revalidateMany(paths);

        // Log results and surface errors
        for (const result of results) {
            if (!result.success) {
                this.logger.error(
                    `[RevalidationService] Failed to revalidate path "${result.path}" via ${this.adapter.name}: ${result.error}`
                );
            }
            // Write audit log entry — best-effort, never throw
            void this.writeLog({
                path: result.path,
                entityType: 'unknown',
                trigger,
                triggeredBy,
                status: result.success ? 'success' : 'failed',
                durationMs: result.durationMs,
                errorMessage: result.error,
                metadata: reason ? { reason } : undefined
            });
        }
    }

    // ---------------------------------------------------------------------------
    // Private helpers
    // ---------------------------------------------------------------------------

    /**
     * Reads config, validates gating rules, and schedules debounced revalidation.
     * All errors are caught — this is called fire-and-forget from scheduleRevalidation.
     */
    private async resolveConfigAndSchedule(
        event: EntityChangeData,
        reason?: string
    ): Promise<void> {
        try {
            const config = await this.getEntityConfig(event.entityType);

            if (!config) return; // No config — skip revalidation
            if (!config.enabled) return; // Disabled for this entity type
            if (!config.autoRevalidateOnChange) return; // Auto-revalidation turned off

            const effectiveDebounceMs = config.debounceSeconds * 1000;
            const paths = getAffectedPaths(event);

            for (const path of paths) {
                this.debouncePath(path, effectiveDebounceMs, reason);
            }
        } catch (error) {
            this.logger.error(
                `[RevalidationService] Error in resolveConfigAndSchedule for entityType "${event.entityType}": ${error instanceof Error ? error.message : String(error)}`
            );
        }
    }

    /**
     * Debounces a single path revalidation.
     * Clears any existing timer for the path and starts a new one.
     */
    private debouncePath(path: string, debounceMs: number, reason?: string): void {
        const existing = this.pendingTimers.get(path);
        if (existing !== undefined) {
            clearTimeout(existing);
        }

        const timer = setTimeout(() => {
            this.pendingTimers.delete(path);
            void this.adapter
                .revalidate(path)
                .then((result) => {
                    if (!result.success) {
                        this.logger.error(
                            `[RevalidationService] Debounced revalidation failed for path "${path}": ${result.error}`
                        );
                    }
                    void this.writeLog({
                        path,
                        entityType: 'unknown',
                        trigger: 'hook',
                        status: result.success ? 'success' : 'failed',
                        durationMs: result.durationMs,
                        errorMessage: result.error,
                        metadata: reason ? { reason } : undefined
                    });
                })
                .catch((error: unknown) => {
                    this.logger.error(
                        `[RevalidationService] Unhandled error revalidating path "${path}": ${error instanceof Error ? error.message : String(error)}`
                    );
                });
        }, debounceMs);

        this.pendingTimers.set(path, timer);
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
     * Writes one log entry to `revalidation_log`. Best-effort — errors are swallowed.
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
