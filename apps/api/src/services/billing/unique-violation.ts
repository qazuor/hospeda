/**
 * Detection of a PostgreSQL unique-constraint violation (SQLSTATE `23505`)
 * inside an arbitrarily-wrapped error, optionally scoped to one named
 * constraint.
 *
 * ## Why this exists
 *
 * A compare-and-set write racing a sibling attempt for the same row can lose
 * the race at the database level instead of the application level: two
 * concurrent writers both pass their `WHERE` guard, and the partial UNIQUE
 * index (e.g. `billing_subscriptions_mp_id_uniq`) rejects the loser with a
 * `23505`. That is not a bug — it is the index doing its job — and the
 * correct response is to treat it exactly like the ordinary "someone else
 * already finished this write" branch, not to let a raw Postgres error
 * surface as a 500.
 *
 * ## Why the error has to be unwrapped, not read directly
 *
 * Drizzle wraps EVERY query failure in a `DrizzleQueryError` (see
 * `drizzle-orm/pg-core/session.ts`, `queryWithCache`). That wrapper carries
 * `query`, `params`, and `cause` — it has **no `code` of its own** — so a
 * predicate that reads `error.code` on the value a `catch` block actually
 * receives is always `false`, and the race-recovery branch it guards never
 * runs. The real SQLSTATE and the offending constraint name live on the pg
 * driver's own `DatabaseError`, one level down at `error.cause`. This module
 * verified that exact shape against a real PostgreSQL unique-violation in
 * `packages/db/test/integration/tx-propagation.test.ts` (case 8: "UNIQUE
 * constraint violation surfaces as PG error code 23505") before writing the
 * walk below — it is not assumed.
 *
 * A message-text fallback ("duplicate key", "unique constraint") is
 * deliberately NOT used here: it is locale- and driver-version-fragile, and
 * constraint-name scoping (see {@link isUniqueConstraintViolation}) has no
 * text equivalent at all. `code` is a stable, structured field; walking to
 * find it is the only correct approach.
 *
 * ## Existing detectors in this codebase (searched before writing this)
 *
 * Three other places already duck-type a Postgres error code, and none of
 * them is a drop-in fit:
 *
 * - `apps/api/src/services/billing-customer-sync.errors.ts` exports
 *   `isDuplicateKeyError`, which walks the full `cause` chain the same way
 *   this module does (with a message-text fallback this module intentionally
 *   omits) but has no constraint-name scoping and is documented as living
 *   beside the customer-sync service specifically.
 * - `apps/api/src/services/billing/link-preapproval.service.ts` and
 *   `apps/api/src/services/social-credential-vault.service.ts` each declare
 *   a private, single-level `getPgErrorCode` (`error.cause?.code ??
 *   error.code`) — correct for the one-level-of-wrapping case this module
 *   also handles, but neither is exported, and neither supports a deeper
 *   chain or a constraint-name check.
 *
 * None could be reused without editing a file outside this change's scope,
 * so this module stands alone for now. A worthwhile follow-up: retire the
 * two private `getPgErrorCode` copies in favor of this module, and either
 * move constraint-name scoping into `billing-customer-sync.errors.ts` or
 * have that module's `isDuplicateKeyError` delegate to
 * `isUniqueConstraintViolation` here, so the chain-walk exists in one place.
 *
 * @module services/billing/unique-violation
 */

/**
 * How far to follow `cause` links before giving up.
 *
 * Deep enough for the wrapping this codebase actually produces
 * (`DrizzleQueryError` → `pg.DatabaseError` is two frames), shallow enough
 * that a pathological or circular chain cannot turn error handling into a
 * hot loop — the `seen` guard in {@link findUniqueViolationCause} already
 * stops a circular chain outright, this cap is a second, independent bound.
 */
const MAX_CAUSE_DEPTH = 5;

/**
 * The subset of `pg`'s `DatabaseError` shape this module reads. Duck-typed
 * rather than imported from `pg`, so this module has no hard dependency on
 * the driver package.
 */
interface PgDatabaseErrorShape {
    /** PostgreSQL SQLSTATE, e.g. `'23505'` for `unique_violation`. */
    readonly code?: unknown;
    /** The violated constraint's name, present on `unique_violation` errors. */
    readonly constraint?: unknown;
}

/**
 * Walks an error's `cause` chain, outermost first, and returns the first
 * link whose `code` is `'23505'` (`unique_violation`).
 *
 * Guards against a self-referential `cause` chain (via `seen`) independently
 * of the depth cap, and returns `undefined` immediately for any input that
 * is not an `Error` — `null`, `undefined`, a string, or a plain object all
 * take this path with no risk of looping.
 *
 * @param error - The caught value, of unknown shape.
 * @returns The first `cause`-chain link carrying SQLSTATE `23505`, or
 *   `undefined` if none does.
 * @internal
 */
function findUniqueViolationCause(error: unknown): (Error & PgDatabaseErrorShape) | undefined {
    const seen = new Set<unknown>();
    let current: unknown = error;
    let depth = 0;

    while (current instanceof Error && !seen.has(current) && depth < MAX_CAUSE_DEPTH) {
        seen.add(current);
        const candidate = current as Error & PgDatabaseErrorShape & { cause?: unknown };
        if (candidate.code === '23505') {
            return candidate;
        }
        current = candidate.cause;
        depth++;
    }

    return undefined;
}

/** Input for {@link isUniqueConstraintViolation}. */
export interface IsUniqueConstraintViolationInput {
    /** The value caught from a `try`/`catch` block, of unknown shape. */
    readonly error: unknown;
    /**
     * When given, the check only succeeds if the violated constraint's name
     * matches exactly. Omit to match any unique-constraint violation
     * regardless of which constraint fired.
     */
    readonly constraintName?: string;
}

/**
 * Checks whether a caught error is a PostgreSQL unique-constraint violation
 * (SQLSTATE `23505`), looking through any Drizzle/driver wrapping via the
 * `cause` chain, optionally scoped to one named constraint.
 *
 * Use this to turn a lost compare-and-set race into a clean "already done by
 * someone else" outcome instead of an unhandled 500 — see the module JSDoc
 * for the full rationale and the verified wrapped-error shape.
 *
 * @param input - See {@link IsUniqueConstraintViolationInput}.
 * @returns `true` when the error (or one of its causes) is a `23505` whose
 *   `constraint` matches `constraintName` (when given), otherwise `false`.
 *
 * The example below deliberately elides the Drizzle write call itself. The
 * `BILLING_SUBSCRIPTIONS_WRITERS` guard in
 * `test/services/inv1-cache-invalidation.guard.test.ts` discovers writers by
 * scanning source text and cannot tell a real call from one inside a docblock.
 * Spelling the call out here would enrol this module — a pure predicate that
 * writes nothing — into an inventory of writers, and make that inventory mean
 * less.
 *
 * @example
 * ```ts
 * try {
 *   await writeTheMpSubscriptionId(tx); // the compare-and-set write
 * } catch (err) {
 *   if (isUniqueConstraintViolation({ error: err, constraintName: 'billing_subscriptions_mp_id_uniq' })) {
 *     return { outcome: 'already' };
 *   }
 *   throw err;
 * }
 * ```
 */
export function isUniqueConstraintViolation(input: IsUniqueConstraintViolationInput): boolean {
    const { error, constraintName } = input;
    const violation = findUniqueViolationCause(error);

    if (!violation) {
        return false;
    }
    if (constraintName === undefined) {
        return true;
    }
    return violation.constraint === constraintName;
}
