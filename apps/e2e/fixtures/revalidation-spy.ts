import { setTimeout as sleep } from 'node:timers/promises';
import { namespaceCacheTag, resolveCacheTagEnvironment } from '@repo/cache-tags';
import { WHOLE_ZONE_TARGET } from '@repo/service-core';
import { execSQL } from './db-helpers.ts';

/**
 * Revalidation spy/assertions for E2E tests (SPEC-092 T-022).
 *
 * E2E tests run Playwright out-of-process against built apps, so we cannot
 * `vi.spyOn` the in-process `RevalidationService`. Instead, every call to
 * `scheduleRevalidation()` writes to `revalidation_log` (audit table from
 * SPEC-034). The helpers here query that table to assert which targets the
 * system tried to revalidate during a test action.
 *
 * `target` holds a Cloudflare cache tag since HOS-369 W1-1 turned purge from
 * URL paths into cache tags — see the `revalidation_log.target` column doc for
 * the rename rationale. Those tags are NAMESPACED by deployment environment
 * (`dev:accom-hotel-test`), because staging and production share one Cloudflare
 * zone and an unqualified tag would let either evict the other's cache.
 *
 * Specs still express expectations in the BARE vocabulary (`accom-hotel-test`)
 * and this fixture qualifies them, mirroring what the emitter does to the tags
 * it writes. That is deliberate on both counts: specs stay readable and free of
 * a hardcoded environment, and the qualification runs through the SAME
 * `resolveCacheTagEnvironment` the API used when it wrote the row. So if the
 * Playwright runner and the API ever resolve different environments, the
 * assertion fails — which is correct, since that mismatch is exactly the
 * silent-purge bug the namespace exists to prevent.
 *
 * The expected adapter for E2E is `NoOpRevalidationAdapter` so that
 * "scheduled but no Cloudflare HTTP" is the success criterion. The log is
 * written regardless of which adapter is active.
 *
 * @see packages/service-core/src/revalidation/revalidation.service.ts
 * @see packages/db/src/schemas/revalidation/revalidation-log.dbschema.ts
 */

export interface RevalidationLogEntry {
    readonly id: string;
    readonly target: string;
    readonly entityType: string;
    readonly entityId: string | null;
    readonly trigger: 'manual' | 'hook' | 'cron' | 'stale';
    readonly triggeredBy: string | null;
    readonly status: 'success' | 'failed' | 'skipped';
    readonly durationMs: number | null;
    readonly errorMessage: string | null;
    readonly createdAt: Date;
}

interface RevalidationLogRow extends Record<string, unknown> {
    id: string;
    target: string;
    entity_type: string;
    entity_id: string | null;
    trigger: 'manual' | 'hook' | 'cron' | 'stale';
    triggered_by: string | null;
    status: 'success' | 'failed' | 'skipped';
    duration_ms: number | null;
    error_message: string | null;
    created_at: Date;
}

/**
 * Captures a wall-clock checkpoint for use as the `since` cutoff in spy
 * assertions. Call BEFORE the action whose revalidation you want to
 * observe.
 */
export function captureRevalidationCheckpoint(): Date {
    return new Date();
}

/**
 * Returns all revalidation log entries created since `since`, optionally
 * filtered by entityType and entityId.
 */
export async function getRecentRevalidations(filter: {
    readonly since: Date;
    readonly entityType?: string;
    readonly entityId?: string;
}): Promise<RevalidationLogEntry[]> {
    const conditions: string[] = ['created_at >= $1'];
    const params: unknown[] = [filter.since];
    if (filter.entityType !== undefined) {
        params.push(filter.entityType);
        conditions.push(`entity_type = $${params.length}`);
    }
    if (filter.entityId !== undefined) {
        params.push(filter.entityId);
        conditions.push(`entity_id = $${params.length}`);
    }
    const rows = await execSQL<RevalidationLogRow>(
        `SELECT id, target, entity_type, entity_id, trigger, triggered_by,
                status, duration_ms, error_message, created_at
         FROM revalidation_log
         WHERE ${conditions.join(' AND ')}
         ORDER BY created_at ASC`,
        params
    );
    return rows.map((row) => ({
        id: row.id,
        target: row.target,
        entityType: row.entity_type,
        entityId: row.entity_id,
        trigger: row.trigger,
        triggeredBy: row.triggered_by,
        status: row.status,
        durationMs: row.duration_ms,
        errorMessage: row.error_message,
        createdAt: row.created_at
    }));
}

export interface AssertRevalidationOptions {
    /** Checkpoint captured BEFORE the action under test. */
    readonly since: Date;
    /** Filter to a specific entity type (e.g. 'accommodation'). */
    readonly entityType?: string;
    /**
     * Targets that MUST be revalidated, given as BARE vocabulary cache tags
     * (`accom-my-slug`, `list-accom`, `home`) or `*` for a whole-zone purge.
     * The deployment namespace is applied here, not by the caller — see the
     * file docblock. The assertion passes when every target listed appears in
     * the log (extras are allowed). When omitted, the assertion only checks
     * that AT LEAST ONE entry exists for the filter.
     */
    readonly targets?: ReadonlyArray<string>;
    /**
     * Maximum time to wait for the revalidation to be logged. The
     * RevalidationService debounces by default 30s but writes the log
     * synchronously when `scheduleRevalidation` is invoked.
     * Defaults to 5000ms.
     */
    readonly timeoutMs?: number;
    /** Optional entityId filter (e.g. a UUID). */
    readonly entityId?: string;
}

/**
 * Asserts that revalidation was scheduled for the given criteria.
 *
 * Polls `revalidation_log` until the expected entries appear, throwing on
 * timeout. Use `captureRevalidationCheckpoint()` BEFORE the action under
 * test to bound the search window.
 *
 * @example
 * ```ts
 * const since = captureRevalidationCheckpoint();
 * await page.click('[data-testid="save-price"]');
 * await assertRevalidationTriggered({
 *     since,
 *     entityType: 'accommodation',
 *     targets: ['accom-hotel-test', 'home']
 * });
 * ```
 */
export async function assertRevalidationTriggered(
    options: AssertRevalidationOptions
): Promise<void> {
    const timeoutMs = options.timeoutMs ?? 5_000;
    const start = Date.now();
    let lastEntries: RevalidationLogEntry[] = [];

    while (Date.now() - start < timeoutMs) {
        lastEntries = await getRecentRevalidations({
            since: options.since,
            entityType: options.entityType,
            entityId: options.entityId
        });

        if (matchesExpectation(lastEntries, options.targets)) {
            return;
        }

        await sleep(250);
    }

    throw new Error(
        `Revalidation assertion failed after ${timeoutMs}ms.\n` +
            `Filter: ${JSON.stringify({
                since: options.since.toISOString(),
                entityType: options.entityType,
                entityId: options.entityId
            })}\n` +
            `Expected targets: ${
                options.targets
                    ? `${JSON.stringify(toLoggedTargets(options.targets))} (namespaced from ${JSON.stringify(options.targets)})`
                    : '(any entry, none required)'
            }\n` +
            `Logged entries (${lastEntries.length}): ${JSON.stringify(
                lastEntries.map((entry) => ({ target: entry.target, status: entry.status }))
            )}`
    );
}

/**
 * Qualify a spec's bare expected targets the same way the emitter qualified the
 * tags it logged.
 *
 * `WHOLE_ZONE_TARGET` (`*`) passes through untouched: a whole-zone flush is not
 * a cache tag, and `RevalidationService.purgeEverything` writes it to the log
 * without namespacing it for exactly that reason.
 *
 * @param targets - Bare vocabulary tags, or `*`.
 * @returns The targets as they appear in `revalidation_log.target`.
 * @throws {Error} When the environment cannot be resolved, naming the variable
 *   to set — silently comparing bare tags would make every assertion fail with
 *   a misleading "no revalidation happened".
 */
function toLoggedTargets(targets: ReadonlyArray<string>): ReadonlyArray<string> {
    const environment = resolveCacheTagEnvironment({
        deployEnv: process.env.HOSPEDA_DEPLOY_ENV,
        nodeEnv: process.env.NODE_ENV
    });

    return targets.map((target) => {
        if (target === WHOLE_ZONE_TARGET) return target;
        const namespaced = namespaceCacheTag({ environment, tag: target });
        if (namespaced === null) {
            throw new Error(
                `Expected revalidation target "${target}" cannot be namespaced for environment ` +
                    `"${environment}". Pass the BARE vocabulary tag (e.g. "accom-my-slug"), not an ` +
                    'already-qualified one.'
            );
        }
        return namespaced;
    });
}

function matchesExpectation(
    entries: ReadonlyArray<RevalidationLogEntry>,
    expectedTargets: ReadonlyArray<string> | undefined
): boolean {
    if (entries.length === 0) return false;
    if (expectedTargets === undefined || expectedTargets.length === 0) return true;
    const loggedTargets = new Set(entries.map((entry) => entry.target));
    return toLoggedTargets(expectedTargets).every((target) => loggedTargets.has(target));
}

/**
 * Asserts that NO revalidation was scheduled for the given criteria within
 * the timeout window.
 *
 * Useful for negative tests: e.g. updating a draft accommodation should NOT
 * revalidate public pages.
 */
export async function assertNoRevalidationTriggered(options: {
    readonly since: Date;
    readonly entityType?: string;
    readonly entityId?: string;
    /** Time to wait before checking. Defaults to 1500ms (covers debounce-free hook fire). */
    readonly waitMs?: number;
}): Promise<void> {
    await sleep(options.waitMs ?? 1_500);
    const entries = await getRecentRevalidations({
        since: options.since,
        entityType: options.entityType,
        entityId: options.entityId
    });
    if (entries.length > 0) {
        throw new Error(
            `Expected NO revalidation but found ${entries.length} entries:\n${JSON.stringify(
                entries.map((entry) => ({
                    target: entry.target,
                    entityType: entry.entityType,
                    trigger: entry.trigger
                })),
                null,
                2
            )}`
        );
    }
}
