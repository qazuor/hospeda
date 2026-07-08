/**
 * @fileoverview
 * Context factory for versioned seed data migrations (HOS-25, T-005).
 *
 * Builds the {@link SeedMigrationCtx} handed to a single migration's `up()`
 * function, wiring together:
 *
 * - `ctx.db` — the Drizzle client passed in by the caller, unchanged.
 * - `ctx.actor` — an actor with super-admin permissions, so permission-
 *   checked `@repo/service-core` writes made through `ctx.services` succeed.
 * - `ctx.models` / `ctx.services` — the full `@repo/db` model surface and
 *   `@repo/service-core` service surface, passed through as-is (see
 *   {@link SeedMigrationModels} / {@link SeedMigrationServices} in
 *   `./types.ts` for why a full-barrel pass-through was chosen over
 *   hand-enumerating classes).
 * - `ctx.helpers.safeDelete` — the shared FK-guarded hard-delete helper
 *   (T-007), bound as a closure over `ctx.db` so migration authors never
 *   have to thread a DB handle through it themselves.
 *
 * The runner (T-009) is expected to call {@link buildMigrationContext} once
 * per migration, passing the TRANSACTION-SCOPED client for that migration —
 * never a fresh top-level connection obtained via `getDb()` — so every
 * read/write a migration performs, whether directly on `ctx.db` or through
 * `ctx.models`/`ctx.services`/`ctx.helpers`, participates in the same
 * rollback-able transaction. This factory does not call `getDb()` itself for
 * that exact reason: it always uses whatever `db` the caller hands it.
 *
 * @module data-migrations/context
 */
import type { DrizzleClient } from '@repo/db';
import * as dbBarrel from '@repo/db';
import type { Actor } from '@repo/service-core';
import * as serviceCoreBarrel from '@repo/service-core';
import { loadSuperAdminAndGetActor } from '../utils/superAdminLoader.js';
import { safeDelete } from './helpers/safeDelete.js';
import type { SeedMigrationCtx, SeedMigrationModels, SeedMigrationServices } from './types.js';

/**
 * Input accepted by {@link buildMigrationContext}. RO-RO — both fields are
 * meaningful on their own (a caller may want to inject a pre-resolved actor
 * without also having a `db` on hand, or vice versa is meaningless here, but
 * the shape stays consistent with the rest of this module's conventions).
 */
export interface BuildMigrationContextInput {
    /**
     * The active Drizzle client. Passed straight through as `ctx.db` and
     * closed over by `ctx.helpers.safeDelete`. The runner (T-009) MUST pass
     * the transaction-scoped client for the migration currently running —
     * passing a fresh `getDb()` connection here would let the migration's
     * work escape its own rollback boundary.
     */
    readonly db: DrizzleClient;

    /**
     * Actor used for permission-checked service calls (`ctx.actor`). When
     * omitted, this factory bootstraps the super-admin actor the same way
     * the main seed process does (`loadSuperAdminAndGetActor()`), so a
     * migration's `ctx.services.SomeService.create(ctx.actor, data)` calls
     * succeed without every migration author re-deriving an actor
     * themselves.
     *
     * Callers that already resolved an actor once for the whole migration
     * run (see this file's `## Key Learnings` note in the T-005 handoff for
     * T-009) should inject it here to skip the extra DB round-trip per
     * migration. Tests should always inject a stub actor to avoid requiring
     * a live database connection.
     */
    readonly actor?: Actor;
}

/**
 * Builds the {@link SeedMigrationCtx} passed to a single data-migration's
 * `up()` function.
 *
 * @param input - RO-RO input. See {@link BuildMigrationContextInput}.
 * @returns A fully-populated migration context: `db` (passed through),
 *   `actor` (injected or bootstrapped), `models`/`services` (the full
 *   `@repo/db` / `@repo/service-core` barrels), and `helpers.safeDelete`
 *   (bound to `db`).
 *
 * @example
 * ```ts
 * // Inside the runner (T-009), once per migration, within its transaction:
 * await withTransaction(async (tx) => {
 *   const ctx = await buildMigrationContext({ db: tx, actor: runActor });
 *   const result = await migrationModule.up(ctx);
 *   await recordApplied({ db: tx, name: migrationModule.meta.name, ... });
 * });
 * ```
 */
export async function buildMigrationContext(
    input: BuildMigrationContextInput
): Promise<SeedMigrationCtx> {
    const { db, actor } = input;

    const resolvedActor = actor ?? (await loadSuperAdminAndGetActor());

    // Structural pass-through: `dbBarrel`/`serviceCoreBarrel` are namespace
    // objects whose runtime type is a strict SUPERSET of `SeedMigrationModels`
    // / `SeedMigrationServices` (which `Pick` down to only the `*Model` /
    // `*Service`-suffixed keys — see `./types.ts`). Assigning a wider-typed
    // value to a narrower-typed binding is sound TypeScript (excess-property
    // checks only apply to fresh object literals, not existing values), so no
    // cast is needed here.
    const models: SeedMigrationModels = dbBarrel;
    const services: SeedMigrationServices = serviceCoreBarrel;

    return {
        db,
        actor: resolvedActor,
        models,
        services,
        helpers: {
            safeDelete: (args) => safeDelete({ db, ...args })
        }
    };
}
