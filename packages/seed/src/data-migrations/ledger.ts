/**
 * @fileoverview
 * Ledger read/write layer for the versioned seed data-migration runner
 * (HOS-25, T-004).
 *
 * Wraps the `seed_migrations` table (`@repo/db`'s `seedMigrations`,
 * mirroring how Drizzle's own `__drizzle_migrations` tracks structural
 * migrations) with three small, composable primitives:
 *
 * - {@link getAppliedMigrations} — read the full ledger.
 * - {@link recordApplied} — insert one row after a migration runs (or is
 *   baseline-stamped).
 * - {@link computeChecksum} — hash a migration file's contents; the digest is
 *   stored per applied row so a future drift check can detect an applied
 *   migration whose on-disk source changed. The current runner diffs the
 *   pending set by `name` only; the checksum-drift check is not yet wired.
 *
 * Neither read nor write function opens its own transaction: `recordApplied`
 * accepts whatever `DrizzleClient` the caller passes, so the runner (T-009)
 * can call it with a transaction-scoped client and have the insert commit or
 * roll back atomically with the migration's own `up()` side effects.
 *
 * @see .specs/HOS-25-versioned-seed-data-migrations/spec.md §3.1, §6
 */
import { createHash } from 'node:crypto';
import { asc, type DrizzleClient, type SelectSeedMigration, seedMigrations } from '@repo/db';
import type { SeedMigrationGroup } from './types.js';

/**
 * Result of {@link getAppliedMigrations}: the set of applied migration
 * names (for O(1) "is this one pending?" lookups) plus the raw rows (for
 * callers that need checksums, timestamps, or ordering).
 */
export interface AppliedMigrationsResult {
    /** Applied migration names, for fast membership checks. */
    readonly names: ReadonlySet<string>;
    /** Raw ledger rows, ordered by `name` ascending. */
    readonly rows: readonly SelectSeedMigration[];
}

/**
 * Reads every row currently recorded in the `seed_migrations` ledger.
 *
 * Ordered by `name` ascending so callers get a deterministic, human-readable
 * sequence (numbered migration filenames sort correctly as plain strings —
 * e.g. `'0001-...'` before `'0002-...'`).
 *
 * @param args - RO-RO input.
 * @param args.db - Active Drizzle client (a plain connection or a
 *   transaction-scoped client both satisfy `DrizzleClient`).
 * @returns The applied migration names as a `Set`, plus the raw rows.
 *
 * @example
 * ```ts
 * const { names, rows } = await getAppliedMigrations({ db: getDb() });
 * const isPending = !names.has('0003-remove-legacy-feature');
 * ```
 */
export async function getAppliedMigrations(args: {
    readonly db: DrizzleClient;
}): Promise<AppliedMigrationsResult> {
    const { db } = args;

    const rows = await db.select().from(seedMigrations).orderBy(asc(seedMigrations.name));

    return {
        names: new Set(rows.map((row) => row.name)),
        rows
    };
}

/**
 * Inserts a single ledger row recording that a data-migration has been
 * applied (or baseline-stamped).
 *
 * Safe to call inside an existing transaction: this function never opens
 * its own transaction, it only issues one `INSERT` against whatever `db`
 * it is given. The runner (T-009) is expected to call this with the same
 * transaction-scoped client used to run the migration's `up()`, so the
 * ledger row commits or rolls back atomically with the migration's own
 * writes.
 *
 * @param args - RO-RO input.
 * @param args.db - Active Drizzle client (plain connection or transaction).
 * @param args.name - The migration's stable identity (matches
 *   `SeedMigrationMeta.name` / the filename without extension).
 * @param args.group - Which data track the migration belongs to. See
 *   {@link SeedMigrationGroup}.
 * @param args.checksum - SHA-256 hex digest of the migration file's
 *   contents, from {@link computeChecksum}.
 * @param args.durationMs - How long the migration took to run, in
 *   milliseconds. Pass `0` (or any sentinel the caller prefers) for
 *   baseline-stamped rows that were recorded without actually running.
 * @param args.result - Short outcome marker (e.g. `'ok'` or
 *   `'baseline-stamp'`).
 *
 * @example
 * ```ts
 * await db.transaction(async (tx) => {
 *   await migrationModule.up(ctxWith(tx));
 *   await recordApplied({
 *     db: tx,
 *     name: migrationModule.meta.name,
 *     group: migrationModule.meta.group,
 *     checksum: computeChecksum({ contents: fileContents }),
 *     durationMs: Date.now() - startedAt,
 *     result: 'ok',
 *   });
 * });
 * ```
 */
export async function recordApplied(args: {
    readonly db: DrizzleClient;
    readonly name: string;
    readonly group: SeedMigrationGroup;
    readonly checksum: string;
    readonly durationMs: number;
    readonly result: string;
}): Promise<void> {
    const { db, name, group, checksum, durationMs, result } = args;

    await db.insert(seedMigrations).values({
        name,
        group,
        checksum,
        durationMs,
        result
    });
}

/**
 * Computes a deterministic SHA-256 hex digest of a migration file's
 * contents. Stored per applied row so a future drift check can detect an
 * applied migration whose on-disk source later changed; the current runner
 * does not yet compare it (the pending set is diffed by `name` only).
 *
 * @param args - RO-RO input.
 * @param args.contents - The raw file contents to hash (e.g. read via
 *   `node:fs/promises` `readFile(path, 'utf-8')`).
 * @returns The lowercase hex-encoded SHA-256 digest.
 *
 * @example
 * ```ts
 * const checksum = computeChecksum({ contents: await readFile(path, 'utf-8') });
 * ```
 */
export function computeChecksum(args: { readonly contents: string }): string {
    return createHash('sha256').update(args.contents).digest('hex');
}
