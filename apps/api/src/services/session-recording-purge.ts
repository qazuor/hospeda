/**
 * Umami session recording retention purge (HOS-2347).
 *
 * Umami 3.5 has no retention setting and no age-based delete API, so the api
 * deletes expired rows itself, straight from the Umami Postgres, through a
 * dedicated role that can only `SELECT` and `DELETE` on `session_replay`,
 * `heatmap_event` and `session_replay_saved` (`HOSPEDA_UMAMI_DATABASE_URL`).
 * That connection is the ONLY Umami write path the api holds: it never holds a
 * Umami API write key (guard `no-umami-write-credential`).
 *
 * Rules, all pinned by tests:
 * - Every statement is scoped to `website_id = HOSPEDA_UMAMI_WEBSITE_ID_WEB`; the
 *   Umami database can hold other websites and they are never touched.
 * - Rows are selected by `created_at < now() - <days> days`.
 * - Deletes run in batches of {@link PURGE_BATCH_SIZE}, looping until a batch
 *   deletes fewer rows than the batch size, so no statement holds a long lock.
 * - Parameterized queries only; table names come from a closed constant list.
 * - One purge at a time: a session advisory lock ({@link PURGE_LOCK_KEY}) is
 *   taken on the SAME connection the deletes use, by the cron and the manual
 *   purge alike. A second caller gets `status: 'locked'` and deletes nothing.
 * - Saved replays are NOT exempt (the legal copy promises deletion within the
 *   retention period). `session_replay_saved` is only a pointer table (a name
 *   and a `visit_id`); the content lives in `session_replay` chunks, which are
 *   purged by age like any other. Afterwards the pointers that are older than the
 *   period or that no longer have a chunk are removed, so none dangles.
 *
 * ## Schema coupling
 *
 * The purge depends on these Umami 3.5 names: tables `session_replay`,
 * `heatmap_event` and `session_replay_saved`, columns `website_id`, `created_at`
 * and `visit_id`. A Umami upgrade can change them;
 * `test/services/session-recording-purge.test.ts` pins the names and
 * `test/integration/session-recording-purge.integration.test.ts` runs the real
 * statements against Postgres.
 *
 * @module services/session-recording-purge
 */

import {
    ServiceErrorCode,
    type SessionRecordingRetentionDays,
    SessionRecordingRetentionDaysSchema
} from '@repo/schemas';
import { ServiceError } from '@repo/service-core';
import { Pool } from 'pg';
import { env } from '../utils/env.js';
import { apiLogger } from '../utils/logger.js';

/** Rows deleted per statement. */
export const PURGE_BATCH_SIZE = 5000;

/** Hard ceiling on batches per table, a runaway guard (5000 x 2000 = 10M rows). */
export const MAX_BATCHES_PER_TABLE = 2000;

/** Key of the Postgres session advisory lock that serializes purges (cron and manual). */
export const PURGE_LOCK_KEY = 2347001;

/**
 * The Umami tables the purge deletes from by age, in order. A closed constant
 * list: names are interpolated into the SQL text, so nothing outside it ever is.
 */
export const PURGE_TABLES = ['session_replay', 'heatmap_event'] as const;

/** Umami table of saved-replay pointers (`name` + `visit_id`); cleaned after the chunks. */
export const SAVED_TABLE = 'session_replay_saved';

/** Umami column holding the owning website of a row. */
export const WEBSITE_COLUMN = 'website_id';

/** Umami column holding the row creation instant. */
export const CREATED_AT_COLUMN = 'created_at';

/** Umami column linking a replay chunk to its visit (and a saved pointer to its chunks). */
export const VISIT_COLUMN = 'visit_id';

/** Why a purge did not run. */
export type PurgeSkipReason = 'DATABASE_URL_UNSET' | 'WEBSITE_ID_UNSET';

/** Outcome of {@link purgeSessionRecordings}. */
export type SessionRecordingPurgeOutcome =
    | {
          /** The purge did not run because it is not configured. */
          readonly status: 'skipped';
          /** Which variable is missing. */
          readonly reason: PurgeSkipReason;
      }
    | {
          /** Another purge holds the advisory lock; nothing was deleted. */
          readonly status: 'locked';
      }
    | {
          /** The purge ran to completion or stopped on the abort signal. */
          readonly status: 'purged';
          /** Rows deleted from `session_replay`. */
          readonly replaysDeleted: number;
          /** Rows deleted from `heatmap_event`. */
          readonly heatmapEventsDeleted: number;
          /** Saved-replay pointers deleted from `session_replay_saved`. */
          readonly savedReplaysDeleted: number;
          /** Whether the abort signal or the batch ceiling stopped it before it finished. */
          readonly stoppedEarly: boolean;
      };

/** Input of {@link purgeSessionRecordings}. */
export interface PurgeSessionRecordingsInput {
    /** Connection string of the restricted Umami role; unset or blank skips the purge. */
    readonly connectionString: string | undefined;
    /** Umami website id (UUID) every delete is scoped to; unset or blank skips the purge. */
    readonly websiteId: string | undefined;
    /** Rows older than this many days are deleted. Must be 14, 30 or 60. */
    readonly retentionDays: SessionRecordingRetentionDays;
    /** Rows per delete statement. Defaults to {@link PURGE_BATCH_SIZE}. */
    readonly batchSize?: number;
    /** Stops the loop between statements (the manual purge's time budget, the cron's deadline). */
    readonly signal?: AbortSignal;
}

/**
 * Builds the batched delete for one table. `ctid` addresses the rows picked by
 * the inner select, so the statement needs no primary key name. Placeholders:
 * `$1` website id, `$2` retention days, `$3` batch size.
 */
export function buildBatchDeleteSql(input: { readonly table: (typeof PURGE_TABLES)[number] }) {
    const { table } = input;
    return (
        `DELETE FROM ${table} WHERE ctid IN (` +
        `SELECT ctid FROM ${table} ` +
        `WHERE ${WEBSITE_COLUMN} = $1 ` +
        `AND ${CREATED_AT_COLUMN} < now() - make_interval(days => $2::int) ` +
        'LIMIT $3)'
    );
}

/**
 * Builds the delete of the saved-replay pointers that are older than the period
 * or whose visit has no chunk left. Placeholders: `$1` website id, `$2` days.
 * Only run after the chunks were purged to completion.
 */
export function buildSavedPointerDeleteSql(): string {
    return (
        `DELETE FROM ${SAVED_TABLE} s ` +
        `WHERE s.${WEBSITE_COLUMN} = $1 ` +
        `AND (s.${CREATED_AT_COLUMN} < now() - make_interval(days => $2::int) ` +
        `OR NOT EXISTS (SELECT 1 FROM session_replay r ` +
        `WHERE r.${WEBSITE_COLUMN} = s.${WEBSITE_COLUMN} AND r.${VISIT_COLUMN} = s.${VISIT_COLUMN}))`
    );
}

/**
 * Deletes the Umami replays, heatmap events and saved-replay pointers older
 * than the retention.
 *
 * Throws, before any query, when `retentionDays` is not 14, 30 or 60. Skips
 * (never throws) when the connection string or the website id is unset. Answers
 * `locked` when another purge is running. A database failure propagates to the
 * caller after the lock is released and the pool is closed.
 *
 * @param input - See {@link PurgeSessionRecordingsInput}.
 * @returns The outcome with the deleted counts, or why nothing ran.
 */
export async function purgeSessionRecordings(
    input: PurgeSessionRecordingsInput
): Promise<SessionRecordingPurgeOutcome> {
    // A bad period must never reach SQL: the interval is a delete boundary.
    const days = SessionRecordingRetentionDaysSchema.safeParse(input.retentionDays);
    if (!days.success) {
        throw new Error(
            `Invalid session recording retention: ${String(input.retentionDays)} (allowed: 14, 30, 60)`
        );
    }
    const retentionDays = days.data;
    const connectionString = input.connectionString?.trim();
    const websiteId = input.websiteId?.trim();
    if (!connectionString) return { status: 'skipped', reason: 'DATABASE_URL_UNSET' };
    if (!websiteId) return { status: 'skipped', reason: 'WEBSITE_ID_UNSET' };

    const batchSize = input.batchSize ?? PURGE_BATCH_SIZE;
    // A small dedicated pool: the purge is one sequential loop and must not compete with the api pool.
    const pool = new Pool({
        connectionString,
        max: 1,
        connectionTimeoutMillis: 10_000,
        statement_timeout: 60_000
    });
    // An idle client error must not crash the process.
    pool.on('error', (error) => {
        apiLogger.warn(`Umami retention pool error: ${error.message}`);
    });

    const deleted: Record<(typeof PURGE_TABLES)[number], number> = {
        session_replay: 0,
        heatmap_event: 0
    };
    let savedReplaysDeleted = 0;
    let stoppedEarly = false;
    let locked = false;

    try {
        // The lock, the deletes and the unlock all use THIS client: a session
        // advisory lock belongs to the connection that took it.
        const client = await pool.connect();
        try {
            const lock = await client.query<{ acquired: boolean }>(
                'SELECT pg_try_advisory_lock($1) AS acquired',
                [PURGE_LOCK_KEY]
            );
            if (lock.rows[0]?.acquired !== true) return { status: 'locked' };
            locked = true;

            for (const table of PURGE_TABLES) {
                const sql = buildBatchDeleteSql({ table });
                for (let batch = 0; batch < MAX_BATCHES_PER_TABLE; batch++) {
                    if (input.signal?.aborted) {
                        stoppedEarly = true;
                        break;
                    }
                    const result = await client.query(sql, [websiteId, retentionDays, batchSize]);
                    const count = result.rowCount ?? 0;
                    deleted[table] += count;
                    if (count < batchSize) break;
                    if (batch === MAX_BATCHES_PER_TABLE - 1) stoppedEarly = true;
                }
            }

            // Pointers only once every chunk is gone: removing one while chunks remain would hide them.
            if (!stoppedEarly) {
                const saved = await client.query(buildSavedPointerDeleteSql(), [
                    websiteId,
                    retentionDays
                ]);
                savedReplaysDeleted = saved.rowCount ?? 0;
            }
        } finally {
            try {
                if (locked) await client.query('SELECT pg_advisory_unlock($1)', [PURGE_LOCK_KEY]);
            } finally {
                client.release();
            }
        }
    } finally {
        await pool.end();
    }

    return {
        status: 'purged',
        replaysDeleted: deleted.session_replay,
        heatmapEventsDeleted: deleted.heatmap_event,
        savedReplaysDeleted,
        stoppedEarly
    };
}

/**
 * Runs {@link purgeSessionRecordings} with the connection string and website id
 * of the api environment. The one entry point of the cron and the admin route.
 *
 * @param input - The retention period and an optional abort signal.
 * @returns The outcome of the purge.
 */
export function purgeSessionRecordingsFromEnv(input: {
    readonly retentionDays: SessionRecordingRetentionDays;
    readonly signal?: AbortSignal;
}): Promise<SessionRecordingPurgeOutcome> {
    return purgeSessionRecordings({
        connectionString: env.HOSPEDA_UMAMI_DATABASE_URL,
        websiteId: env.HOSPEDA_UMAMI_WEBSITE_ID_WEB,
        retentionDays: input.retentionDays,
        ...(input.signal ? { signal: input.signal } : {})
    });
}

/**
 * Human text for a skipped purge, shared by the cron log and the 503 body.
 *
 * @param reason - Why the purge was skipped.
 * @returns A message naming the variable to set.
 */
export function describeSkippedPurge(reason: PurgeSkipReason): string {
    return reason === 'DATABASE_URL_UNSET'
        ? 'HOSPEDA_UMAMI_DATABASE_URL is not set, so Umami recordings cannot be purged'
        : 'HOSPEDA_UMAMI_WEBSITE_ID_WEB is not set, so Umami recordings cannot be purged';
}

/**
 * Throws the typed 503 the manual purge answers when it is not configured.
 *
 * @param reason - Why the purge was skipped.
 */
export function throwPurgeNotConfigured(reason: PurgeSkipReason): never {
    throw new ServiceError(
        ServiceErrorCode.SERVICE_UNAVAILABLE,
        describeSkippedPurge(reason),
        { reason },
        'RECORDING_PURGE_NOT_CONFIGURED'
    );
}
