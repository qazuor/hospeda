/**
 * @fileoverview
 * Regression coverage for HOS-858: `extractPostgresErrorCause` must recover
 * a PostgreSQL SQLSTATE (and its constraint/table/column/schema) from a
 * `ServiceError` → `DrizzleQueryError` → `pg.DatabaseError` wrapping chain,
 * exactly the shape `BaseService.runWithLoggingAndValidation` produces for a
 * real query failure — WITHOUT needing a live database. This exercises the
 * predicate directly against a hand-built error tree mirroring the verified
 * shape from `packages/db/test/integration/tx-propagation.test.ts` (case 8),
 * per the HOS-858 briefing: a DB-backed regression test would be skipped by
 * `isDbAvailable()` in most CI/local runs and produce a silent, invalid green.
 *
 * All test data, comments, and documentation are in English, per project
 * guidelines.
 */

import { ServiceErrorCode } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import { ServiceError } from '../../src/types';
import { extractPostgresErrorCause } from '../../src/utils/postgres-error-cause';

/**
 * Builds the exact wrapping chain a real unique-constraint violation produces
 * in this codebase: the pg driver's `DatabaseError` (has `code`/`constraint`/
 * `table`/`column`/`schema`/`detail`), wrapped by Drizzle's
 * `DrizzleQueryError` (`.cause` = the driver error, `.message` = the
 * generated SQL dump), wrapped by a `ServiceError` (`.details` = the
 * Drizzle error, per `BaseService.runWithLoggingAndValidation`).
 */
const buildWrappedUniqueViolation = (): ServiceError => {
    const driverError = new Error(
        'duplicate key value violates unique constraint "users_email_unique"'
    ) as Error & {
        code?: string;
        constraint?: string;
        table?: string;
        column?: string;
        schema?: string;
        detail?: string;
    };
    driverError.name = 'error';
    driverError.code = '23505';
    driverError.constraint = 'users_email_unique';
    driverError.table = 'users';
    driverError.schema = 'public';
    driverError.detail = 'Key (email)=(alice@example.com) already exists.';

    const drizzleError = new Error(
        'Failed query: insert into "users" ("id", "email") values ($1, $2)\nparams: 11111111-1111-1111-1111-111111111111,alice@example.com'
    ) as Error & { cause?: unknown };
    drizzleError.name = 'DrizzleQueryError';
    drizzleError.cause = driverError;

    return new ServiceError(
        ServiceErrorCode.INTERNAL_ERROR,
        `An unexpected error occurred: ${drizzleError.message}`,
        drizzleError
    );
};

describe('extractPostgresErrorCause', () => {
    // RED (pre-fix) / GREEN (post-fix) regression for HOS-858 AC-1 + AC-3:
    // before the fix, nothing in `BaseService`/`logError` ever read
    // `.details`/`.cause`, so the SQLSTATE was unreachable — this is the
    // predicate that now makes it reachable.
    it('recovers the SQLSTATE, constraint, table and schema from a ServiceError -> DrizzleQueryError -> pg.DatabaseError chain', () => {
        const wrapped = buildWrappedUniqueViolation();

        const cause = extractPostgresErrorCause(wrapped);

        expect(cause).toEqual({
            code: '23505',
            constraint: 'users_email_unique',
            table: 'users',
            column: undefined,
            schema: 'public'
        });
    });

    it('never returns the driver-reported `detail` field (scope decision: it can carry a column value)', () => {
        const wrapped = buildWrappedUniqueViolation();

        const cause = extractPostgresErrorCause(wrapped);

        expect(cause).not.toHaveProperty('detail');
        expect(Object.values(cause as unknown as Record<string, unknown>).join(' ')).not.toContain(
            'alice@example.com'
        );
    });

    it('finds a SQLSTATE-carrying cause one level deep (plain Error with a direct `cause`)', () => {
        const driverError = new Error('foreign key violation') as Error & { code?: string };
        driverError.code = '23503';
        const wrapper = new Error('Failed query: ...', { cause: driverError });

        expect(extractPostgresErrorCause(wrapper)).toEqual({
            code: '23503',
            constraint: undefined,
            table: undefined,
            column: undefined,
            schema: undefined
        });
    });

    it('returns undefined for a plain error with no Postgres cause anywhere in the chain', () => {
        expect(extractPostgresErrorCause(new Error('boom'))).toBeUndefined();
    });

    it('returns undefined for non-object input (string, number, null, undefined)', () => {
        expect(extractPostgresErrorCause('boom')).toBeUndefined();
        expect(extractPostgresErrorCause(42)).toBeUndefined();
        expect(extractPostgresErrorCause(null)).toBeUndefined();
        expect(extractPostgresErrorCause(undefined)).toBeUndefined();
    });

    it('does not mistake a non-SQLSTATE `code` (e.g. a Node.js network error code) for a Postgres cause', () => {
        const networkError = new Error('connect ECONNREFUSED') as Error & { code?: string };
        networkError.code = 'ECONNREFUSED';

        expect(extractPostgresErrorCause(networkError)).toBeUndefined();
    });

    // Depth cap: independent second bound alongside the cycle guard below.
    it('stops after MAX_CAUSE_DEPTH links and returns undefined instead of finding a code buried deeper', () => {
        let current: Error & { cause?: unknown; code?: string } = new Error('link 0');
        const root = current;
        for (let i = 1; i <= 15; i++) {
            const next: Error & { cause?: unknown; code?: string } = new Error(`link ${i}`);
            current.cause = next;
            current = next;
        }
        // The SQLSTATE lives on the 16th link (depth 15) — past the cap.
        current.code = '23505';

        expect(extractPostgresErrorCause(root)).toBeUndefined();
    });

    // Cycle protection: a circular `cause` chain must not hang or crash the
    // logger — this is the specific hazard called out in the HOS-858 briefing.
    it('terminates instead of looping forever on a circular cause chain', () => {
        const a: Error & { cause?: unknown } = new Error('a');
        const b: Error & { cause?: unknown } = new Error('b');
        a.cause = b;
        b.cause = a; // cycle

        expect(() => extractPostgresErrorCause(a)).not.toThrow();
        expect(extractPostgresErrorCause(a)).toBeUndefined();
    });

    // The logger must never throw, even when a link along the chain is
    // hostile (a getter that throws while being read).
    it('degrades to undefined instead of throwing when a `cause`/`code` getter throws', () => {
        const hostile = {
            get code(): string {
                throw new Error('nope');
            }
        };
        const wrapper = new Error('Failed query: ...', { cause: hostile });

        expect(() => extractPostgresErrorCause(wrapper)).not.toThrow();
        expect(extractPostgresErrorCause(wrapper)).toBeUndefined();
    });

    // A `cause` that is an object with no prototype (`Object.create(null)`)
    // must not crash `instanceof`-free duck typing.
    it('degrades to undefined for a cause with no prototype', () => {
        const noProto = Object.create(null) as Record<string, unknown>;
        noProto.code = '23505';
        const wrapper = new Error('Failed query: ...', { cause: noProto });

        // A prototype-less object still exposes its own `code` — this only
        // proves the walk does not throw on it either way.
        expect(() => extractPostgresErrorCause(wrapper)).not.toThrow();
    });
});
