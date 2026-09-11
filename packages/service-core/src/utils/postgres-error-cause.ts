import { ServiceError } from '../types';

/**
 * Extraction of the real PostgreSQL failure reason from a wrapped query
 * error (HOS-858).
 *
 * ## Why this exists
 *
 * Drizzle wraps every query failure in a `DrizzleQueryError` that carries
 * `query`, `params`, and `cause`, but no `code` of its own — the SQLSTATE and
 * the offending constraint/table/column live one level down, on the pg
 * driver's own `DatabaseError` at `error.cause` (this exact shape is verified
 * against a real Postgres error in
 * `packages/db/test/integration/tx-propagation.test.ts`, case 8, and reused
 * by `apps/api/src/services/billing/unique-violation.ts` for `23505`
 * specifically). `BaseService.runWithLoggingAndValidation` then wraps THAT in
 * a `ServiceError` whose `message` is `"An unexpected error occurred: Failed
 * query: <full SQL> params: <...>"` and whose ORIGINAL caught value is stored
 * on `.details` — not on the standard `.cause` — so a plain `error.cause`
 * walk stops one link short of the driver error. This module follows both
 * links (`ServiceError.details` and `Error.cause`) so `logError` can recover
 * the driver's `code` regardless of which wrapping produced the error.
 *
 * ## Scope decision: `detail` is intentionally never extracted
 *
 * Postgres puts the OFFENDING VALUE in `DatabaseError.detail`, not
 * `.message` (e.g. `Key (email)=(alice@example.com) already exists.`).
 * `code`, `constraint`, `table`, `column` and `schema` are schema metadata —
 * never a column's actual value — but `detail` can carry PII straight out of
 * the row that failed. The shared logger's `redactSensitiveData` only
 * catches known PII PATTERNS (email/phone/credit-card/SSN/IP/JWT/CUIT), so a
 * raw DNI, a name, or an address embedded in `detail` would slip through
 * unredacted. This module does not extract `detail` for that reason; see the
 * HOS-858 implementation report for the full decision record.
 *
 * @module utils/postgres-error-cause
 */

/**
 * How far to follow the `details`/`cause` chain before giving up. Deep
 * enough for the wrapping this codebase actually produces (`ServiceError` →
 * `DrizzleQueryError` → `pg.DatabaseError` is three frames), shallow enough
 * that a pathological chain cannot turn error handling into a hot loop — the
 * `seen` guard below already stops a circular chain outright, this cap is a
 * second, independent bound.
 */
const MAX_CAUSE_DEPTH = 10;

/** Postgres SQLSTATE codes are exactly five alphanumeric characters (e.g. `'23505'`, `'42P01'`, `'08006'`). */
const SQLSTATE_PATTERN = /^[0-9A-Z]{5}$/;

const isSqlStateCode = (value: unknown): value is string =>
    typeof value === 'string' && SQLSTATE_PATTERN.test(value);

const asNonEmptyString = (value: unknown): string | undefined =>
    typeof value === 'string' && value.length > 0 ? value : undefined;

/**
 * Structured PostgreSQL failure info recovered from an error's wrapping
 * chain. Every field besides `code` is schema metadata reported by the pg
 * driver — never a column value.
 */
export interface PostgresErrorCause {
    /** SQLSTATE, e.g. `'23505'` for `unique_violation`. */
    readonly code: string;
    /** Violated constraint's name, when the driver reported one. */
    readonly constraint?: string;
    /** Table the failing statement targeted, when the driver reported one. */
    readonly table?: string;
    /** Column the failing statement targeted, when the driver reported one. */
    readonly column?: string;
    /** Schema the failing statement targeted, when the driver reported one. */
    readonly schema?: string;
}

/**
 * Resolves what to follow next while walking toward the driver error: a
 * `ServiceError`'s original caught value lives on `.details` (see the module
 * JSDoc), everything else follows the standard `Error.cause`.
 */
const nextLink = (current: object): unknown => {
    if (current instanceof ServiceError) {
        return current.details;
    }
    return (current as { cause?: unknown }).cause;
};

/**
 * Walks an error's wrapping chain, outermost first, looking for a link that
 * carries a PostgreSQL SQLSTATE `code`. Never throws: a non-object input, a
 * link that is not an `Error`/plain object, or a hostile getter that throws
 * while reading `code`/`details`/`cause` all fall through to `undefined`
 * instead of raising — the logger this feeds must never be the thing that
 * crashes.
 *
 * Bounded twice, independently: a depth cap ({@link MAX_CAUSE_DEPTH}) and a
 * `seen` set that stops a circular chain outright regardless of depth.
 *
 * @param error - The caught value, of unknown shape.
 * @returns The first structured Postgres cause found, or `undefined` when
 *   none of the wrapping chain carries a SQLSTATE-shaped `code`.
 */
export function extractPostgresErrorCause(error: unknown): PostgresErrorCause | undefined {
    try {
        const seen = new Set<unknown>();
        let current: unknown = error;
        let depth = 0;

        while (
            current !== null &&
            current !== undefined &&
            typeof current === 'object' &&
            !seen.has(current) &&
            depth < MAX_CAUSE_DEPTH
        ) {
            seen.add(current);
            const candidate = current as Record<string, unknown>;

            if (isSqlStateCode(candidate.code)) {
                return {
                    code: candidate.code,
                    constraint: asNonEmptyString(candidate.constraint),
                    table: asNonEmptyString(candidate.table),
                    column: asNonEmptyString(candidate.column),
                    schema: asNonEmptyString(candidate.schema)
                };
            }

            current = nextLink(current);
            depth++;
        }

        return undefined;
    } catch {
        return undefined;
    }
}
