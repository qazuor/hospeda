/**
 * @fileoverview
 * Runner for versioned seed data-migrations (HOS-25, T-009).
 *
 * Orchestrates the pieces built by the earlier HOS-25 tasks into a single
 * end-to-end run:
 *
 * 1. {@link resolvePendingMigrations} — discover every `NNNN-slug.ts` module
 *    ({@link discoverMigrationFiles}, T-008), read the ledger
 *    ({@link getAppliedMigrations}, T-004), and diff the two
 *    ({@link computePendingMigrations}, T-008).
 * 2. If nothing is pending, return a no-op result — re-running the migrator
 *    against an already-migrated database is always safe and cheap.
 * 3. Evaluate the production safety gate ({@link evaluateProdDataMigrationGate},
 *    T-011) against the pending batch's metadata, BEFORE running anything.
 *    A refusal aborts the whole run with zero side effects.
 * 4. Resolve the acting {@link Actor} once for the whole run (injected, or
 *    bootstrapped via `loadSuperAdminAndGetActor()`).
 * 5. Run each pending migration, in numeric-prefix order, inside its own
 *    database transaction: build its {@link SeedMigrationCtx}
 *    ({@link buildMigrationContext}, T-005) against the transaction-scoped
 *    client, call `up(ctx)`, then record the ledger row
 *    ({@link recordApplied}, T-004) with the SAME transaction-scoped client —
 *    so the migration's writes and its ledger row commit or roll back
 *    together, atomically.
 * 6. Stop at the first failure (HOS-25 G-5: no partial runs). The failing
 *    migration's transaction rolls back (no ledger row, no partial writes)
 *    and the error propagates to the caller — later pending migrations never
 *    run.
 *
 * {@link resolvePendingMigrations} is deliberately exported and kept free of
 * the production-gate/actor/transaction-execution concerns above it, so a
 * sibling entry point (HOS-25 T-010, `baselineStamp`, which records ledger
 * rows for already-satisfied migrations WITHOUT running `up()`) can reuse the
 * exact same discovery+diff step without duplicating it or refactoring this
 * file.
 *
 * @module data-migrations/runner
 */
import { readFile } from 'node:fs/promises';
import type { DrizzleClient } from '@repo/db';
import { getDb } from '@repo/db';
import type { Actor } from '@repo/service-core';
import { logger as defaultLogger, type SeedLogger } from '../utils/logger.js';
import { loadSuperAdminAndGetActor } from '../utils/superAdminLoader.js';
import { buildMigrationContext } from './context.js';
import {
    computePendingMigrations,
    type DiscoveredMigration,
    discoverMigrationFiles
} from './discover.js';
import { computeChecksum, getAppliedMigrations, recordApplied } from './ledger.js';
import { evaluateProdDataMigrationGate } from './prodGate.js';
import type { SeedMigrationGroup } from './types.js';

/**
 * Input accepted by {@link resolvePendingMigrations}. A narrow subset of
 * {@link RunMigrationsArgs} — only the fields the discovery+diff step
 * actually needs.
 */
export interface ResolvePendingMigrationsArgs {
    /**
     * Active Drizzle client to read the ledger with. Defaults to `getDb()`
     * (the process-wide connection set up via `initializeDb()`/`setDb()`)
     * when omitted — the normal CLI path. Tests inject their own.
     */
    readonly db?: DrizzleClient;

    /**
     * When provided, only migrations in this group are considered pending.
     * Omit to consider every group.
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
 * Result of {@link resolvePendingMigrations}: the resolved database client
 * (so the caller does not have to re-resolve `getDb()` itself) plus the full
 * discovery + ledger-diff outcome.
 */
export interface ResolvePendingMigrationsResult {
    /** The resolved Drizzle client (either the caller's or `getDb()`). */
    readonly db: DrizzleClient;

    /** Every migration module discovered on disk, in numeric-prefix order. */
    readonly discovered: DiscoveredMigration[];

    /** The full set of migration names already recorded in the ledger. */
    readonly applied: ReadonlySet<string>;

    /**
     * The subset of `discovered` not yet applied (and matching `group`, when
     * given), in numeric-prefix order — exactly what a run needs to execute.
     */
    readonly pending: DiscoveredMigration[];
}

/**
 * Resolves the database client, discovers every migration module on disk,
 * reads the ledger, and diffs the two down to the pending batch.
 *
 * Deliberately free of any actual migration EXECUTION (no transactions, no
 * production gate, no actor resolution) — {@link runMigrations} layers those
 * concerns on top of this, and a sibling baseline-stamp entry point (HOS-25
 * T-010) can reuse this exact step to find the same pending batch without
 * ever running `up()` against it.
 *
 * @param args - RO-RO input. See {@link ResolvePendingMigrationsArgs}.
 * @returns See {@link ResolvePendingMigrationsResult}.
 *
 * @example
 * ```ts
 * const { db, pending } = await resolvePendingMigrations({ group: 'required' });
 * console.log(pending.map((m) => m.name));
 * ```
 */
export async function resolvePendingMigrations(
    args: ResolvePendingMigrationsArgs = {}
): Promise<ResolvePendingMigrationsResult> {
    const { group, dir } = args;
    const db = args.db ?? getDb();

    const discovered = await discoverMigrationFiles({ dir });
    const { names: applied } = await getAppliedMigrations({ db });
    const pending = computePendingMigrations({ discovered, applied, group });

    return { db, discovered, applied, pending };
}

/**
 * Input accepted by {@link runMigrations}.
 */
export interface RunMigrationsArgs {
    /**
     * Active Drizzle client. Defaults to `getDb()` when omitted — the normal
     * CLI path (T-017). Tests inject their own client (typically the same
     * one they called `initializeDb()`/`setDb()` with).
     */
    readonly db?: DrizzleClient;

    /**
     * When provided, only migrations in this group are run. Omit to run
     * every pending migration regardless of group (e.g. local dev, which
     * wants both `required` and `example`).
     */
    readonly group?: SeedMigrationGroup;

    /**
     * Explicit opt-in to run destructive migrations in production, wired to
     * the CLI's `--allow-destructive` flag (T-017). Equivalent to setting
     * `HOSPEDA_ALLOW_DESTRUCTIVE_MIGRATION=true` in `env`.
     *
     * @default false
     */
    readonly allowDestructive?: boolean;

    /**
     * Environment snapshot the production safety gate evaluates. Defaults to
     * `process.env`. Tests pass a minimal object (e.g.
     * `{ NODE_ENV: 'production' }`) instead of mutating the real process
     * environment.
     */
    readonly env?: NodeJS.ProcessEnv;

    /**
     * Directory to scan for migration files. Defaults to the real
     * `data-migrations/` directory. Tests pass a fixture directory instead.
     */
    readonly dir?: string;

    /**
     * Pre-resolved actor for permission-checked `ctx.services` calls.
     * Resolved ONCE for the whole run (not per-migration) and injected into
     * every migration's context. Omit to bootstrap the super-admin actor via
     * `loadSuperAdminAndGetActor()` — tests should always inject a stub actor
     * to avoid requiring a live super-admin lookup.
     */
    readonly actor?: Actor;

    /**
     * Logger used for run progress output. Defaults to the seed package's
     * shared `@repo/logger`-backed logger.
     */
    readonly logger?: SeedLogger;
}

/**
 * Summary of a completed (or no-op) {@link runMigrations} call.
 */
export interface RunMigrationsResult {
    /**
     * Names of migrations that were actually applied during THIS invocation,
     * in the order they ran. Empty when nothing was pending.
     */
    readonly applied: readonly string[];

    /**
     * Names of discovered migrations (matching `group`, when given) that
     * were already recorded in the ledger before this run started, and were
     * therefore not re-run. Reported for status/CLI output (e.g. "3 applied,
     * 12 already up to date").
     */
    readonly skipped: readonly string[];

    /**
     * How many migrations were pending (and scheduled to run) at the start
     * of this invocation. Equals `applied.length` on a fully successful run;
     * stays ahead of it if a migration throws partway through, since the run
     * aborts before scheduling the remainder.
     */
    readonly pendingCount: number;
}

/**
 * Runs every pending versioned seed data-migration, in numeric-prefix order,
 * each inside its own transaction.
 *
 * Idempotent: calling this again after a fully successful run finds zero
 * pending migrations and returns immediately with `{ applied: [] }`, doing no
 * database writes at all.
 *
 * Fails closed: if any migration's `up()` throws, that migration's
 * transaction rolls back (its writes AND its ledger row both disappear) and
 * this function re-throws — no later pending migration runs, matching HOS-25
 * G-5 (no partial batches). The production safety gate is evaluated against
 * the ENTIRE pending batch before any migration runs, so a refusal also
 * leaves the database completely untouched.
 *
 * @param args - RO-RO input. See {@link RunMigrationsArgs}.
 * @returns See {@link RunMigrationsResult}.
 *
 * @throws {Error} If the production safety gate refuses the batch (see
 *   {@link evaluateProdDataMigrationGate}).
 * @throws {Error} If any migration's `up()` throws — wraps the original error
 *   with the failing migration's name, preserving it as `cause`.
 *
 * @example
 * ```ts
 * // CLI path (T-017): uses getDb(), process.env, and bootstraps the actor.
 * const result = await runMigrations({ group: 'required' });
 * console.log(`Applied ${result.applied.length} migration(s).`);
 * ```
 */
export async function runMigrations(args: RunMigrationsArgs = {}): Promise<RunMigrationsResult> {
    const {
        group,
        dir,
        actor,
        allowDestructive = false,
        env = process.env,
        logger = defaultLogger
    } = args;

    const { db, discovered, applied, pending } = await resolvePendingMigrations({
        db: args.db,
        group,
        dir
    });

    const skipped = discovered
        .filter(
            (migration) =>
                applied.has(migration.name) &&
                (group === undefined || migration.meta.group === group)
        )
        .map((migration) => migration.name);

    if (pending.length === 0) {
        logger.info(
            `No pending data-migrations${group ? ` in group "${group}"` : ''} — nothing to do (${skipped.length} already applied).`
        );
        return { applied: [], skipped, pendingCount: 0 };
    }

    const gateResult = evaluateProdDataMigrationGate({
        env,
        pendingMeta: pending.map((migration) => migration.meta),
        allowDestructiveFlag: allowDestructive
    });

    if (!gateResult.allowed) {
        const reason =
            gateResult.reason ??
            'Refusing to run pending destructive data-migration(s) in production.';
        logger.error(reason);
        throw new Error(reason);
    }

    const resolvedActor = actor ?? (await loadSuperAdminAndGetActor());

    logger.info(`Running ${pending.length} pending data-migration(s)...`);

    const appliedNames: string[] = [];

    for (const migration of pending) {
        const startedAt = Date.now();
        logger.info(`Applying "${migration.name}" (group: ${migration.meta.group})...`);

        try {
            await db.transaction(async (tx) => {
                const ctx = await buildMigrationContext({ db: tx, actor: resolvedActor });
                const result = await migration.module.up(ctx);
                const contents = await readFile(migration.filePath, 'utf8');

                await recordApplied({
                    db: tx,
                    name: migration.name,
                    group: migration.meta.group,
                    checksum: computeChecksum({ contents }),
                    durationMs: Date.now() - startedAt,
                    result: 'ok'
                });

                if (result.summary) {
                    logger.info(`  -> ${result.summary}`);
                }
            });
        } catch (error) {
            const cause = error instanceof Error ? error : new Error(String(error));
            logger.error(
                `Data-migration "${migration.name}" failed — aborting run. ${cause.message}`
            );
            throw new Error(`Data-migration "${migration.name}" failed: ${cause.message}`, {
                cause
            });
        }

        appliedNames.push(migration.name);
        logger.success({
            msg: `Applied "${migration.name}" in ${Date.now() - startedAt}ms.`
        });
    }

    return { applied: appliedNames, skipped, pendingCount: pending.length };
}
