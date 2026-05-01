import { setTimeout as sleep } from 'node:timers/promises';
import { execSQL } from './db-helpers.ts';

/**
 * Revalidation spy/assertions for E2E tests (SPEC-092 T-022).
 *
 * E2E tests run Playwright out-of-process against built apps, so we cannot
 * `vi.spyOn` the in-process `RevalidationService`. Instead, every call to
 * `scheduleRevalidation()` writes to `revalidation_log` (audit table from
 * SPEC-034). The helpers here query that table to assert which paths the
 * system tried to revalidate during a test action.
 *
 * The expected adapter for E2E is `NoOpRevalidationAdapter` so that
 * "scheduled but no Vercel HTTP" is the success criterion. The log is
 * written regardless of which adapter is active.
 *
 * @see packages/service-core/src/revalidation/revalidation.service.ts
 * @see packages/db/src/schemas/revalidation/revalidation-log.dbschema.ts
 */

export interface RevalidationLogEntry {
    readonly id: string;
    readonly path: string;
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
    path: string;
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
        `SELECT id, path, entity_type, entity_id, trigger, triggered_by,
                status, duration_ms, error_message, created_at
         FROM revalidation_log
         WHERE ${conditions.join(' AND ')}
         ORDER BY created_at ASC`,
        params
    );
    return rows.map((row) => ({
        id: row.id,
        path: row.path,
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
     * Paths that MUST be revalidated. The assertion passes when every
     * path listed here appears in the log (extras are allowed). When omitted,
     * the assertion only checks that AT LEAST ONE entry exists for the
     * filter.
     */
    readonly paths?: ReadonlyArray<string>;
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
 *     paths: ['/alojamientos/hotel-test/', '/']
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

        if (matchesExpectation(lastEntries, options.paths)) {
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
            `Expected paths: ${
                options.paths ? JSON.stringify(options.paths) : '(any entry, none required)'
            }\n` +
            `Logged entries (${lastEntries.length}): ${JSON.stringify(
                lastEntries.map((entry) => ({ path: entry.path, status: entry.status }))
            )}`
    );
}

function matchesExpectation(
    entries: ReadonlyArray<RevalidationLogEntry>,
    expectedPaths: ReadonlyArray<string> | undefined
): boolean {
    if (entries.length === 0) return false;
    if (expectedPaths === undefined || expectedPaths.length === 0) return true;
    const loggedPaths = new Set(entries.map((entry) => entry.path));
    return expectedPaths.every((path) => loggedPaths.has(path));
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
                    path: entry.path,
                    entityType: entry.entityType,
                    trigger: entry.trigger
                })),
                null,
                2
            )}`
        );
    }
}
