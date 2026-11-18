/**
 * Umami session recording retention purge (HOS-2347).
 *
 * Umami 3.5 has no retention setting and no age-based delete API, so the api
 * deletes expired rows itself, straight from the Umami Postgres, through a
 * dedicated role that can only `SELECT` and `DELETE` on `session_replay` and
 * `heatmap_event` (`HOSPEDA_UMAMI_DATABASE_URL`). That connection is the ONLY
 * Umami write path the api holds: it never holds a Umami API write key (guard
 * `no-umami-write-credential`).
 *
 * Scope rules, all pinned by tests:
 * - Every statement is scoped to `website_id = HOSPEDA_UMAMI_WEBSITE_ID_WEB`; the
 *   Umami database can hold other websites and they are never touched.
 * - Rows are selected by `created_at < now() - <days> days`.
 * - Deletes run in batches of {@link PURGE_BATCH_SIZE}, looping until a batch
 *   deletes fewer rows than the batch size, so no statement holds a long lock.
 * - Parameterized queries only; table names come from a closed constant list.
 *
 * ## Schema coupling
 *
 * The purge depends on these Umami 3.5 names: tables `session_replay` and
 * `heatmap_event`, columns `website_id` and `created_at`. A Umami upgrade can
 * change them; `test/services/session-recording-purge.test.ts` pins the names.
 * `session_replay_saved` (replays a Umami user chose to keep) is NOT touched.
 *
 * @module services/session-recording-purge
 */

import { ServiceErrorCode, type SessionRecordingRetentionDays } from '@repo/schemas';
import { ServiceError } from '@repo/service-core';
import { Pool } from 'pg';
import { env } from '../utils/env.js';
import { apiLogger } from '../utils/logger.js';

/** Rows deleted per statement. */
export const PURGE_BATCH_SIZE = 5000;

/** Hard ceiling on batches per table, a runaway guard (5000 x 2000 = 10M rows). */
const MAX_BATCHES_PER_TABLE = 2000;

/**
 * The Umami tables the purge deletes from, in order. A closed constant list:
 * names are interpolated into the SQL text, so nothing outside it ever is.
 */
export const PURGE_TABLES = ['session_replay', 'heatmap_event'] as const;

/** Umami column holding the owning website of a row. */
export const WEBSITE_COLUMN = 'website_id';

/** Umami column holding the row creation instant. */
export const CREATED_AT_COLUMN = 'created_at';

/** Outcome of {@link purgeSessionRecordings}. */
export type SessionRecordingPurgeOutcome =
    | {
          /** The purge did not run because it is not configured. */
          readonly status: 'skipped';
          /** Which variable is missing. */
          readonly reason: 'DATABASE_URL_UNSET' | 'WEBSITE_ID_UNSET';
      }
    | {
          /** The purge ran to completion or stopped on the abort signal. */
          readonly status: 'purged';
          /** Rows deleted from `session_replay`. */
          readonly replaysDeleted: number;
          /** Rows deleted from `heatmap_event`. */
          readonly heatmapEventsDeleted: number;
          /** Whether the abort signal or the batch ceiling stopped it before it finished. */
          readonly stoppedEarly: boolean;
      };

/** Input of {@link purgeSessionRecordings}. */
export interface PurgeSessionRecordingsInput {
    /** Connection string of the restricted Umami role; unset or blank skips the purge. */
    readonly connectionString: string | undefined;
    /** Umami website id (UUID) every delete is scoped to; unset or blank skips the purge. */
    readonly websiteId: string | undefined;
    /** Rows older than this many days are deleted. */
    readonly retentionDays: SessionRecordingRetentionDays;
    /** Rows per delete statement. Defaults to {@link PURGE_BATCH_SIZE}. */
    readonly batchSize?: number;
    /** Stops the loop between statements. */
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
 * Deletes the Umami replays and heatmap events older than the retention.
 *
 * Skips (never throws) when the connection string or the website id is unset.
 * A database failure propagates to the caller after the pool is closed.
 *
 * @param input - See {@link PurgeSessionRecordingsInput}.
 * @returns The outcome with the deleted counts, or why it was skipped.
 */
export async function purgeSessionRecordings(
    input: PurgeSessionRecordingsInput
): Promise<SessionRecordingPurgeOutcome> {
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
    let stoppedEarly = false;

    try {
        for (const table of PURGE_TABLES) {
            const sql = buildBatchDeleteSql({ table });
            for (let batch = 0; batch < MAX_BATCHES_PER_TABLE; batch++) {
                if (input.signal?.aborted) {
                    stoppedEarly = true;
                    break;
                }
                const result = await pool.query(sql, [websiteId, input.retentionDays, batchSize]);
                const count = result.rowCount ?? 0;
                deleted[table] += count;
                if (count < batchSize) break;
                if (batch === MAX_BATCHES_PER_TABLE - 1) stoppedEarly = true;
            }
        }
    } finally {
        await pool.end();
    }

    return {
        status: 'purged',
        replaysDeleted: deleted.session_replay,
        heatmapEventsDeleted: deleted.heatmap_event,
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
export function describeSkippedPurge(reason: 'DATABASE_URL_UNSET' | 'WEBSITE_ID_UNSET'): string {
    return reason === 'DATABASE_URL_UNSET'
        ? 'HOSPEDA_UMAMI_DATABASE_URL is not set, so Umami recordings cannot be purged'
        : 'HOSPEDA_UMAMI_WEBSITE_ID_WEB is not set, so Umami recordings cannot be purged';
}

/**
 * Throws the typed 503 the manual purge answers when it is not configured.
 *
 * @param reason - Why the purge was skipped.
 */
export function throwPurgeNotConfigured(reason: 'DATABASE_URL_UNSET' | 'WEBSITE_ID_UNSET'): never {
    throw new ServiceError(
        ServiceErrorCode.SERVICE_UNAVAILABLE,
        describeSkippedPurge(reason),
        { reason },
        'RECORDING_PURGE_NOT_CONFIGURED'
    );
}
