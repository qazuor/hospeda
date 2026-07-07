/**
 * @fileoverview
 * Status reporter for versioned seed data-migrations (HOS-25, T-012).
 *
 * Answers "what's applied, what's pending?" for the migration ledger, split
 * (like `discover.ts`, T-008) into a pure diff/join step and a thin I/O
 * wrapper around it:
 *
 * - {@link computeMigrationStatus} — pure: joins a discovered-migrations list
 *   against the ledger's applied rows ({@link getAppliedMigrations}, T-004)
 *   and partitions the result into `applied`/`pending`. No filesystem, no
 *   DB — trivially unit-testable with hand-built fixtures.
 * - {@link getMigrationStatus} — I/O: calls {@link discoverMigrationFiles}
 *   (T-008) + {@link getAppliedMigrations} (T-004), then delegates to
 *   {@link computeMigrationStatus}. This is what the CLI (T-017) is expected
 *   to call for `db:seed:migrate:status`.
 * - {@link formatMigrationStatus} — pure: renders a {@link MigrationStatus}
 *   as a human-readable string for CLI/log output.
 *
 * @see .specs/HOS-25-versioned-seed-data-migrations/spec.md §3.1, §6
 */
import { type DrizzleClient, getDb, type SelectSeedMigration } from '@repo/db';
import type { DiscoveredMigration } from './discover.js';
import { discoverMigrationFiles } from './discover.js';
import { getAppliedMigrations } from './ledger.js';
import type { SeedMigrationGroup } from './types.js';

/**
 * A single applied migration, enriched from its ledger row.
 *
 * Includes ledger rows whose source file no longer exists on disk (an
 * "orphan" — see {@link orphaned}) rather than silently dropping them: a
 * migration that already ran and mutated the database is a historical fact
 * the ledger is the only remaining record of, even after the file that
 * caused it is deleted (or renamed, which the ledger sees as a delete +
 * unrelated new file, since `name` is the file's stem). Hiding it from
 * status output would make the ledger look smaller than the actual set of
 * changes applied to this database.
 */
export interface AppliedMigrationStatusEntry {
    /** The migration's stable identity (ledger primary key / filename stem). */
    readonly name: string;

    /** Which data track this migration belongs to, per its ledger row. */
    readonly group: SeedMigrationGroup;

    /** When the migration was applied (or baseline-stamped). */
    readonly appliedAt: Date;

    /** Short outcome marker recorded at apply time (e.g. `'ok'`, `'baseline-stamp'`). */
    readonly result: string;

    /**
     * `true` when no discovered migration file on disk currently has this
     * name — the ledger row is an orphan (its source file was deleted or
     * renamed after being applied). `false` for the normal case where the
     * file backing this ledger row still exists.
     */
    readonly orphaned: boolean;
}

/** A single migration discovered on disk that has not yet been applied. */
export interface PendingMigrationStatusEntry {
    /** The migration's stable identity (filename stem). */
    readonly name: string;

    /** Which data track this migration belongs to, per its `meta.group`. */
    readonly group: SeedMigrationGroup;
}

/**
 * Full applied/pending partition for the migration ledger, as computed by
 * {@link computeMigrationStatus} or fetched by {@link getMigrationStatus}.
 */
export interface MigrationStatus {
    /**
     * Every ledger row (optionally scoped to `group`), including orphans.
     * Ordered the same way {@link getAppliedMigrations} returns rows — `name`
     * ascending, which matches numeric-prefix order since every migration
     * filename uses a fixed-width 4-digit prefix.
     */
    readonly applied: readonly AppliedMigrationStatusEntry[];

    /**
     * Discovered migrations not yet recorded in the ledger (optionally
     * scoped to `group`), in numeric-prefix ascending order (the order
     * {@link discoverMigrationFiles} guarantees).
     */
    readonly pending: readonly PendingMigrationStatusEntry[];

    /** `applied.length`, surfaced for convenient summary output. */
    readonly appliedCount: number;

    /** `pending.length`, surfaced for convenient summary output. */
    readonly pendingCount: number;
}

/**
 * Narrows a ledger row's raw `group` column (a plain `varchar`, not a typed
 * union at the DB layer) to {@link SeedMigrationGroup}.
 *
 * The ledger only ever receives `group` values written by
 * {@link import('./ledger.js').recordApplied}, which takes a typed
 * `SeedMigrationGroup` — so in normal operation every row's `group` is
 * already one of the two known values. This guard exists purely as a
 * defensive fallback against manually-edited or corrupted rows (never
 * expected in practice): an unrecognized value is normalized to
 * `'required'` rather than thrown, since a status report should degrade
 * gracefully instead of crashing the whole command over one bad row.
 */
function toSeedMigrationGroup(value: string): SeedMigrationGroup {
    return value === 'example' ? 'example' : 'required';
}

/**
 * Pure join+diff between a list of discovered migrations and the ledger's
 * applied rows, optionally scoped to a single group. Never touches the
 * filesystem or a database — safe to unit-test with hand-built
 * {@link DiscoveredMigration} / ledger-row fixtures.
 *
 * @param args - RO-RO input.
 * @param args.discovered - Migrations found on disk, in numeric-prefix
 *   ascending order (the contract {@link discoverMigrationFiles} guarantees).
 * @param args.applied - The ledger read result from
 *   {@link getAppliedMigrations} (T-004, `ledger.ts`): applied names plus
 *   raw rows.
 * @param args.group - When provided, both `applied` and `pending` are
 *   scoped to migrations in this group only.
 * @returns The full applied/pending partition. See {@link MigrationStatus}.
 *
 * @example
 * ```ts
 * const discovered = await discoverMigrationFiles({});
 * const applied = await getAppliedMigrations({ db });
 * const status = computeMigrationStatus({ discovered, applied, group: 'required' });
 * console.log(`${status.appliedCount} applied, ${status.pendingCount} pending`);
 * ```
 */
export function computeMigrationStatus(args: {
    readonly discovered: readonly DiscoveredMigration[];
    readonly applied: {
        readonly names: ReadonlySet<string>;
        readonly rows: readonly SelectSeedMigration[];
    };
    readonly group?: SeedMigrationGroup;
}): MigrationStatus {
    const { discovered, applied, group } = args;

    const discoveredNames = new Set(discovered.map((migration) => migration.name));

    const appliedEntries: AppliedMigrationStatusEntry[] = applied.rows
        .map((row) => ({
            name: row.name,
            group: toSeedMigrationGroup(row.group),
            appliedAt: row.appliedAt,
            result: row.result,
            orphaned: !discoveredNames.has(row.name)
        }))
        .filter((entry) => group === undefined || entry.group === group);

    const pendingEntries: PendingMigrationStatusEntry[] = discovered
        .filter(
            (migration) =>
                !applied.names.has(migration.name) &&
                (group === undefined || migration.meta.group === group)
        )
        .map((migration) => ({ name: migration.name, group: migration.meta.group }));

    return {
        applied: appliedEntries,
        pending: pendingEntries,
        appliedCount: appliedEntries.length,
        pendingCount: pendingEntries.length
    };
}

/**
 * Input accepted by {@link getMigrationStatus}.
 */
export interface GetMigrationStatusArgs {
    /**
     * Active Drizzle client to read the ledger with. Defaults to `getDb()`
     * (the process-wide connection set up via `initializeDb()`/`setDb()`)
     * when omitted — the normal CLI path (T-017). Tests inject their own.
     */
    readonly db?: DrizzleClient;

    /**
     * When provided, both `applied` and `pending` in the result are scoped
     * to this group only. Omit to report on every group.
     */
    readonly group?: SeedMigrationGroup;

    /**
     * Directory to scan for migration files. Defaults to the real
     * `data-migrations/` directory (see {@link discoverMigrationFiles}).
     * Tests pass a fixture directory instead.
     */
    readonly dir?: string;
}

/**
 * I/O wrapper around {@link computeMigrationStatus}: discovers every
 * migration file on disk, reads the ledger, and joins the two.
 *
 * @param args - RO-RO input. See {@link GetMigrationStatusArgs}.
 * @returns The full applied/pending partition. See {@link MigrationStatus}.
 *
 * @example
 * ```ts
 * const status = await getMigrationStatus({ group: 'required' });
 * console.log(formatMigrationStatus(status));
 * ```
 */
export async function getMigrationStatus(
    args: GetMigrationStatusArgs = {}
): Promise<MigrationStatus> {
    const { group, dir } = args;
    const db = args.db ?? getDb();

    const discovered = await discoverMigrationFiles({ dir });
    const applied = await getAppliedMigrations({ db });

    return computeMigrationStatus({ discovered, applied, group });
}

/**
 * Renders a {@link MigrationStatus} as a human-readable summary string for
 * CLI/log output (the CLI, T-017, is expected to `console.log` this
 * directly).
 *
 * Pure formatting only — no I/O, no `console.log` here, so it stays
 * trivially unit-testable and reusable from contexts other than a terminal
 * (e.g. surfaced in a future admin panel view).
 *
 * @param status - The status to render. See {@link MigrationStatus}.
 * @returns A multi-line string: an "Applied" section (name, group,
 *   appliedAt, result, and an `[ORPHAN]` marker for entries with no
 *   matching file on disk), a "Pending" section (name, group), and a
 *   trailing one-line count summary.
 *
 * @example
 * ```ts
 * const status = await getMigrationStatus({});
 * console.log(formatMigrationStatus(status));
 * // Applied (2):
 * //   [required] 0001-add-wifi-amenity — applied 2026-07-01T12:00:00.000Z (ok)
 * //   [required] 0002-legacy-cleanup — applied 2026-07-02T09:30:00.000Z (ok) [ORPHAN: file not found on disk]
 * // Pending (1):
 * //   [example] 0003-seed-more-destinations
 * //
 * // 2 applied, 1 pending
 * ```
 */
export function formatMigrationStatus(status: MigrationStatus): string {
    const lines: string[] = [];

    lines.push(`Applied (${status.appliedCount}):`);
    if (status.applied.length === 0) {
        lines.push('  (none)');
    } else {
        for (const entry of status.applied) {
            const orphanSuffix = entry.orphaned ? ' [ORPHAN: file not found on disk]' : '';
            lines.push(
                `  [${entry.group}] ${entry.name} — applied ${entry.appliedAt.toISOString()} (${entry.result})${orphanSuffix}`
            );
        }
    }

    lines.push('');
    lines.push(`Pending (${status.pendingCount}):`);
    if (status.pending.length === 0) {
        lines.push('  (none)');
    } else {
        for (const entry of status.pending) {
            lines.push(`  [${entry.group}] ${entry.name}`);
        }
    }

    lines.push('');
    lines.push(`${status.appliedCount} applied, ${status.pendingCount} pending`);

    return lines.join('\n');
}
