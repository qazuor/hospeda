/**
 * @fileoverview
 * Baseline-stamp mode for the versioned seed data-migration runner
 * (HOS-25, T-010).
 *
 * On a FRESH database — right after the baseline seed (`--reset --required
 * --example`) has built everything from scratch — every data-migration
 * discovered on disk is already satisfied by construction: the baseline seed
 * produces the current, post-migration shape of the data directly, so there
 * is nothing left for any individual migration's `up()` to apply. Running
 * them for real would be redundant at best (idempotent migrations are
 * harmless no-ops) and actively wrong at worst (a migration that assumes
 * pre-migration state, e.g. renaming a slug that the fresh baseline never
 * created under its old name, could fail or corrupt the fresh data).
 *
 * {@link baselineStamp} mirrors how a fresh `drizzle-kit migrate` run against
 * a schema created via `db push`/init SQL leaves `__drizzle_migrations`
 * fully caught up without re-executing any individual structural migration:
 * it records a ledger row for every currently-pending data-migration WITHOUT
 * ever calling its `up()`.
 *
 * **The one exception** (HOS-375 G-10) is a migration declaring
 * `meta.contentOnly: true`: its rows have no fixture baseline, so the "already
 * satisfied by construction" premise above does not hold for it — a fresh
 * baseline seed produces nothing of what it inserts. Stamping it would record
 * it applied while its content never existed, and the ledger would then stop
 * it from ever running. Those migrations are therefore left PENDING here and
 * reported back as {@link BaselineStampResult.deferred}, for the caller to run
 * for real (see `handleDataMigrate` in `../cli.ts`, which does exactly that).
 *
 * Deliberately kept in its own file rather than folded into `runner.ts` — see
 * that file's module doc for why {@link resolvePendingMigrations} was
 * factored out specifically to make this possible without touching the
 * runner (HOS-25 T-009 vs T-010, parallel tasks).
 *
 * @see .specs/HOS-25-versioned-seed-data-migrations/spec.md §3.1, §6
 * @module data-migrations/baselineStamp
 */
import { readFile } from 'node:fs/promises';
import type { DrizzleClient } from '@repo/db';
import { computeChecksum, recordApplied } from './ledger.js';
import { resolvePendingMigrations } from './runner.js';
import type { SeedMigrationGroup } from './types.js';

/**
 * Input accepted by {@link baselineStamp}.
 */
export interface BaselineStampArgs {
    /**
     * Active Drizzle client. Defaults to `getDb()` (via
     * {@link resolvePendingMigrations}) when omitted — the normal CLI path
     * (T-019's `db:fresh` wiring). Tests inject their own client.
     */
    readonly db?: DrizzleClient;

    /**
     * When provided, only migrations in this group are stamped. Omit to
     * stamp every group — the expected default after a full
     * `--reset --required --example` baseline seed.
     */
    readonly group?: SeedMigrationGroup;

    /**
     * Directory to scan for migration files. Defaults to the real
     * `data-migrations/` directory. Tests pass a fixture directory instead.
     */
    readonly dir?: string;
}

/**
 * Result of {@link baselineStamp}.
 */
export interface BaselineStampResult {
    /**
     * Names of migrations that were newly stamped as applied during THIS
     * invocation, in numeric-prefix order. Empty when nothing was pending
     * (e.g. calling this a second time — already-stamped migrations are
     * naturally excluded since they no longer appear as pending).
     */
    readonly stamped: readonly string[];

    /**
     * Names of pending migrations deliberately NOT stamped because they
     * declare `meta.contentOnly: true`, in numeric-prefix order. They are
     * still pending after this call, by design — the caller is expected to
     * run them for real (`runMigrations`) so their content actually exists.
     *
     * Empty when no pending migration is content-only, which is the common
     * case.
     *
     * @see .specs/HOS-375-author-page-unification/spec.md §6.11 (G-10)
     */
    readonly deferred: readonly string[];
}

/**
 * Records every currently-pending data-migration as applied, WITHOUT running
 * its `up()` function — for use immediately after a fresh baseline seed has
 * already produced the equivalent end state directly.
 *
 * Migrations declaring `meta.contentOnly: true` are the documented exception:
 * they are skipped (left pending) and returned under
 * {@link BaselineStampResult.deferred} instead of being stamped, because no
 * fixture reproduces their content. See this module's file-level doc.
 *
 * Idempotent: migrations stamped by a previous call are already in the
 * ledger, so {@link resolvePendingMigrations} excludes them from `pending` on
 * a second call, and this function does nothing for them (no duplicate rows,
 * no error). Content-only migrations stay in `deferred` on every call until
 * something actually runs them.
 *
 * Reuses {@link resolvePendingMigrations} (T-009) for discovery + ledger-diff
 * so this never duplicates (or drifts from) the runner's own notion of
 * "pending". Never imports or invokes any migration module's `up()` — only
 * its already-loaded `meta` (via the `module` field's `meta`, identical to
 * the top-level `meta`) and its on-disk file contents (for the checksum) are
 * read.
 *
 * @param args - RO-RO input. See {@link BaselineStampArgs}.
 * @returns See {@link BaselineStampResult}.
 *
 * @example
 * ```ts
 * // After `pnpm db:fresh`'s baseline seed step (T-019 wiring):
 * const { stamped } = await baselineStamp({});
 * console.log(`Baseline-stamped ${stamped.length} data-migration(s).`);
 * ```
 */
export async function baselineStamp(args: BaselineStampArgs = {}): Promise<BaselineStampResult> {
    const { group, dir } = args;

    const { db, pending } = await resolvePendingMigrations({ db: args.db, group, dir });

    const stamped: string[] = [];
    const deferred: string[] = [];

    for (const migration of pending) {
        if (migration.meta.contentOnly === true) {
            deferred.push(migration.name);
            continue;
        }

        const contents = await readFile(migration.filePath, 'utf8');

        await recordApplied({
            db,
            name: migration.name,
            group: migration.meta.group,
            checksum: computeChecksum({ contents }),
            durationMs: 0,
            result: 'baseline-stamp'
        });

        stamped.push(migration.name);
    }

    return { stamped, deferred };
}
