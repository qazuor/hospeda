import type { DrizzleClient } from '@repo/db';
import type { Actor } from '@repo/service-core';
import type { SQL, Table } from 'drizzle-orm';

/**
 * Discriminates which data track a versioned seed data-migration belongs to.
 *
 * - `'required'` — canonical system/catalog data. Runs against every
 *   environment, including production, subject to the destructive-migration
 *   prod gate (see {@link SeedMigrationMeta.destructive}).
 * - `'example'` — realistic development/demo data. Runs against
 *   dev/staging environments only. Included in the versioned carril per the
 *   HOS-25 OQ-1 resolution (2026-07-07): `example` fixtures are static JSON,
 *   and threading a stable UUIDv5 id through them (tracked separately as
 *   T-014/T-015/T-016) is enough to make them a valid delta target, the same
 *   as `required`.
 *
 * @see .specs/HOS-25-versioned-seed-data-migrations/spec.md — sections 3.4 and 8 (OQ-1)
 */
export type SeedMigrationGroup = 'required' | 'example';

/**
 * Static metadata every data-migration module must export as `meta`,
 * declared `as const` so the discovery/runner layer (T-008, T-009) can read
 * a migration's identity and routing without importing (and therefore
 * executing side effects from) its `up()` function.
 *
 * @example
 * ```ts
 * // packages/seed/src/data-migrations/0003-remove-legacy-feature.ts
 * export const meta = {
 *   name: '0003-remove-legacy-feature',
 *   group: 'required',
 * } as const satisfies SeedMigrationMeta;
 * ```
 *
 * @see .specs/HOS-25-versioned-seed-data-migrations/spec.md §6.2
 */
export interface SeedMigrationMeta {
    /**
     * The migration's stable identity and ledger primary key: the numbered
     * filename without extension (e.g. `'0003-remove-legacy-feature'`).
     * Must match the actual file name — the discovery step (T-008) is
     * expected to enforce this at scan time.
     */
    readonly name: string;

    /** Which data track this migration targets. See {@link SeedMigrationGroup}. */
    readonly group: SeedMigrationGroup;

    /**
     * Marks the migration as destructive (deletes, or otherwise irreversibly
     * mutates, existing rows). When `true`, the runner's production gate
     * (T-011, `evaluateProdDataMigrationGate`) requires an explicit opt-in
     * (`HOSPEDA_ALLOW_DESTRUCTIVE_MIGRATION` env var / `--allow-destructive`
     * flag) before the migration is allowed to run in production. Omit or
     * set to `false` for purely additive/idempotent-upsert migrations.
     *
     * @default false
     */
    readonly destructive?: boolean;
}

/**
 * Mapped-type utility: narrows an exports-namespace type `T` down to only the
 * keys whose name ends with the literal `Suffix`.
 *
 * Used below to derive {@link SeedMigrationModels} and
 * {@link SeedMigrationServices} directly from the REAL `@repo/db` /
 * `@repo/service-core` barrel export types, instead of hand-enumerating
 * every model/service class. As of T-005, `@repo/db` exports 90+ model
 * classes and `@repo/service-core` exports 80+ service classes — a
 * hand-maintained list would be pure duplication, and silently drift stale
 * every time either package adds, removes, or renames one. This filter
 * needs zero maintenance: it re-derives itself from the barrel every build.
 *
 * `K extends string` narrows `keyof T` (which TypeScript widens to
 * `string | number | symbol`) before the template-literal suffix check,
 * since module namespace keys are always string literals in practice but
 * `keyof T` does not statically guarantee that.
 */
type PickByNameSuffix<T, Suffix extends string> = Pick<
    T,
    {
        [K in keyof T]: K extends string ? (K extends `${string}${Suffix}` ? K : never) : never;
    }[keyof T]
>;

/**
 * Entity model bindings injected into every migration's context under
 * `ctx.models` — every `@repo/db` runtime export whose name ends in `Model`
 * (e.g. `UserModel`, `AccommodationModel`, `AmenityModel`), keyed exactly as
 * `@repo/db` exports it. Derived automatically via {@link PickByNameSuffix}
 * from the real barrel's export type, so newly added models appear here
 * with zero changes to this file.
 *
 * A migration constructs one directly: `new ctx.models.UserModel()`. Models
 * are zero-arg constructible and DB-handle-agnostic; individual methods take
 * an optional trailing `tx` parameter (see `BaseModelImpl.getClient`) that
 * defaults to `getDb()` when omitted. Pass `ctx.db` explicitly to keep a
 * write inside the migration's transaction — see the context factory
 * (T-005, `context.ts`).
 *
 * Known accepted imprecision: the suffix filter is a naming convention, not
 * a `class`-vs-other-value type check (a strict check would require an
 * `any`-based mixin-style conditional type this codebase's no-`any` rule
 * forbids). Every current `@repo/db` runtime export ending in `Model` is a
 * genuine model class (verified at T-005 authoring time); a future export
 * merely NAMED `*Model` without being one would also surface here.
 */
export interface SeedMigrationModels extends PickByNameSuffix<typeof import('@repo/db'), 'Model'> {}

/**
 * Service-layer bindings injected into every migration's context under
 * `ctx.services`, for migrations that need permission-aware writes (going
 * through `@repo/service-core` services, with their validation/hook
 * pipeline and audit trail) rather than direct model access. Every
 * `@repo/service-core` runtime export whose name ends in `Service` (e.g.
 * `AmenityService`, `AccommodationService`), derived the same way as
 * {@link SeedMigrationModels}.
 *
 * A migration constructs one directly: `new ctx.services.AmenityService({
 * logger })` — services default-instantiate their own model(s) internally
 * (see e.g. `AmenityService`'s constructor), so no model wiring is required.
 * Permission-checked methods (`create`, `update`, ...) take the acting
 * `Actor` as their first argument: `service.create(ctx.actor, data)`. See
 * {@link SeedMigrationCtx.actor} and the context factory (T-005) for how
 * `actor` is bootstrapped.
 *
 * Known accepted imprecision: same naming-suffix caveat as
 * {@link SeedMigrationModels} — a handful of unrelated runtime exports that
 * merely happen to end in `Service` (e.g. `getTranslationService`, a plain
 * function) also surface here. Harmless (they are real, correctly-typed
 * exports), just not literally service classes.
 */
export interface SeedMigrationServices
    extends PickByNameSuffix<typeof import('@repo/service-core'), 'Service'> {}

/**
 * Discriminated union describing the outcome of a single
 * {@link SafeDeleteFn} call.
 *
 * - `{ deleted: true }` — the target row(s) had zero active inbound FK
 *   references and were not operator-edited, so the physical `DELETE` ran.
 * - `{ deleted: false; skipped: true; reason }` — the delete was withheld
 *   (either an active FK reference exists, or the row was operator-edited)
 *   and `reason` carries a human-readable explanation for logs/ledger output.
 *
 * @see .specs/HOS-25-versioned-seed-data-migrations/spec.md §3.3, §6.5 (OQ-2)
 */
export type SafeDeleteResult =
    | { readonly deleted: true }
    | { readonly deleted: false; readonly skipped: true; readonly reason: string };

/**
 * Predicate deciding whether a resolved row was edited by an operator and must
 * therefore be preserved (skipped) rather than hard-deleted (HOS-25 §6.5, OQ-2).
 *
 * The row is passed keyed by its **raw DB column names** (snake_case), as
 * returned by the guard's `SELECT *`, NOT the Drizzle camelCase JS property
 * names — a Model-C-style predicate must read e.g. `row.display_name`.
 *
 * When omitted from a {@link SafeDeleteArgs}, the row is treated as NOT
 * operator-edited (deletion proceeds if FK-clear); each caller supplies a
 * predicate tailored to its table's real provenance signal (e.g. the SPEC-211
 * Model C commercial-field comparison for `billing_plans`) or opts out for
 * tables with no operator-edit surface (amenities, features, tags…).
 */
export type IsOperatorEditedPredicate = (row: Readonly<Record<string, unknown>>) => boolean;

/**
 * Arguments accepted by {@link SafeDeleteFn}.
 *
 * `table` and `where` are typed against the generic Drizzle building blocks
 * (`Table` / `SQL`) rather than a specific schema table, since this contract
 * must not depend on any single entity's shape.
 *
 * `where` must uniquely identify the target: a `where` matching 0 rows is an
 * idempotent no-op success, and a `where` matching 2+ rows throws (the author
 * must narrow it) — see `helpers/safeDelete.ts` (T-007).
 */
export interface SafeDeleteArgs {
    /** The Drizzle table to delete from. */
    readonly table: Table;

    /** The Drizzle SQL where-clause identifying the target row. */
    readonly where: SQL;

    /**
     * Human-readable justification for the deletion, surfaced in the
     * skip-warning log/ledger output when the delete is withheld.
     */
    readonly reason: string;

    /**
     * Optional operator-edit guard. When it returns `true` for the resolved
     * row, the delete is withheld (skipped). Omit to treat the row as not
     * operator-edited. Passing it through `ctx.helpers.safeDelete` lets a
     * migration author use per-table provenance policy without bypassing the
     * shared helper. See {@link IsOperatorEditedPredicate}.
     */
    readonly isOperatorEdited?: IsOperatorEditedPredicate;
}

/**
 * Shared hard-delete-with-guards helper (HOS-25 G-4), injected into every
 * migration's context as `ctx.helpers.safeDelete`. Centralizes the
 * FK-reference check (T-006) and operator-edit detection (T-007) so no
 * individual data-migration hand-rolls deletion safety.
 *
 * A migration author calls this instead of issuing a raw `DELETE`:
 *
 * @example
 * ```ts
 * const result = await ctx.helpers.safeDelete({
 *   table: featuresTable,
 *   where: eq(featuresTable.slug, 'legacy-feature'),
 *   reason: 'Superseded by SPEC-266 amenity/feature catalog rework',
 * });
 * ```
 */
export type SafeDeleteFn = (args: SafeDeleteArgs) => Promise<SafeDeleteResult>;

/**
 * Cross-cutting helpers injected into every migration's context under
 * `ctx.helpers`. Currently only {@link SafeDeleteFn}; expected to grow as
 * more shared migration-authoring utilities are identified.
 */
export interface SeedMigrationHelpers {
    /** FK-guarded, operator-edit-aware hard delete. See {@link SafeDeleteFn}. */
    readonly safeDelete: SafeDeleteFn;
}

/**
 * RO-RO context object passed to every data-migration's `up()` function.
 * Assembled by the context factory (T-005) and passed unchanged by the
 * runner (T-009) for the duration of that migration's transaction.
 *
 * @see .specs/HOS-25-versioned-seed-data-migrations/spec.md §6.2
 */
export interface SeedMigrationCtx {
    /**
     * The active Drizzle database handle. Reuses `@repo/db`'s
     * `DrizzleClient` — the same type `getDb()` / `initializeDb()` return —
     * so migration authors get full query-builder typing without this
     * contract inventing its own DB type. When the runner (T-009) executes
     * a migration inside a per-migration transaction, this is expected to be
     * the transaction-scoped client rather than the top-level connection.
     */
    readonly db: DrizzleClient;

    /**
     * The actor used for permission-checked `@repo/service-core` calls made
     * through {@link SeedMigrationCtx.services} (e.g.
     * `ctx.services.AmenityService.create(ctx.actor, data)`). Populated by
     * the context factory (T-005, `context.ts`): either the caller-injected
     * actor, or — when none is provided — the super-admin actor bootstrapped
     * the same way the main seed process does, via
     * `loadSuperAdminAndGetActor()`.
     */
    readonly actor: Actor;

    /**
     * Entity model bindings available to the migration. See
     * {@link SeedMigrationModels}.
     */
    readonly models: SeedMigrationModels;

    /**
     * Service-layer bindings available to the migration. See
     * {@link SeedMigrationServices}.
     */
    readonly services: SeedMigrationServices;

    /**
     * Shared cross-cutting helpers available to the migration. See
     * {@link SeedMigrationHelpers}.
     */
    readonly helpers: SeedMigrationHelpers;
}

/**
 * Return value of a data-migration's `up()` function. Deliberately small: a
 * migration is not required to report anything, but may optionally surface a
 * human-readable summary and/or per-entity counts for the runner (T-009) to
 * log alongside the ledger entry it records.
 */
export interface SeedMigrationResult {
    /** Optional human-readable one-line summary of what the migration did. */
    readonly summary?: string;

    /**
     * Optional per-entity counters (e.g. `{ inserted: 1, deleted: 0 }`),
     * surfaced in run logs and status reporting (T-012).
     */
    readonly counts?: Readonly<Record<string, number>>;
}

/**
 * The full shape a `NNNN-slug.ts` data-migration module must export: its
 * static {@link SeedMigrationMeta} plus an `up()` function receiving a
 * {@link SeedMigrationCtx} and returning a {@link SeedMigrationResult}.
 *
 * Migration discovery (T-008) loads each file and validates it against this
 * shape before scheduling it to run.
 *
 * @example
 * ```ts
 * export const meta = {
 *   name: '0001-add-wifi-amenity',
 *   group: 'required',
 * } as const satisfies SeedMigrationMeta;
 *
 * export const up: SeedMigrationModule['up'] = async ({ db }) => {
 *   // ... perform the migration using db/models/services/helpers
 *   return { summary: 'Added wifi amenity' };
 * };
 * ```
 */
export interface SeedMigrationModule {
    /** Static identity + routing metadata. See {@link SeedMigrationMeta}. */
    readonly meta: SeedMigrationMeta;

    /**
     * Applies this migration's change against the database. Runs inside a
     * transaction managed by the runner (T-009); throwing rolls back the
     * transaction and aborts the run without recording a ledger entry.
     */
    readonly up: (ctx: SeedMigrationCtx) => Promise<SeedMigrationResult>;
}
