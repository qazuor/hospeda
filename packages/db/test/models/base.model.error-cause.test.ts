/**
 * Regression tests for HOS-1174: `BaseModelImpl` must attach the original
 * driver error as the `cause` of every `DbError` it throws from a `catch`
 * block, so the PostgreSQL SQLSTATE survives the model boundary.
 *
 * ## What was broken
 *
 * Drizzle wraps every query failure in a `DrizzleQueryError` whose `message`
 * is `"Failed query: <SQL>\nparams: <...>"` — the pg driver's own message
 * (`duplicate key value violates unique constraint "..."`), its SQLSTATE
 * (`23505`) and the offending `constraint` live one level down, on
 * `error.cause`. `BaseModelImpl` copied only `err.message` into the `DbError`
 * and dropped the error itself, so:
 *
 * - no consumer could tell a unique violation from any other DB failure, and
 * - the text-matching fallback in `apps/api`'s `handleRouteError` could never
 *   fire either, because the constraint text is not in the message it sees.
 *
 * Measured against a real Postgres before the fix: `DbError#message` was
 * `"Failed query: insert into \"tmp_uniq\" ... params: dup"` and
 * `DbError#cause` was `undefined`.
 *
 * ## What is asserted here
 *
 * 1. Behaviour: each `BaseModelImpl` method that catches a driver failure
 *    re-throws a `DbError` whose `cause` IS the caught error, so a `cause`
 *    walk reaches the SQLSTATE.
 * 2. A static guard over `base.model.ts`'s own source, so a future call site
 *    cannot silently go back to dropping the cause — the behavioural tests
 *    above only cover the methods they name, the guard covers all of them.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { sql } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BaseModelImpl } from '../../src/base/base.model';
import * as dbUtils from '../../src/client';
import { DbError } from '../../src/utils/error';

vi.mock('../../src/utils/logger', () => ({
    logQuery: vi.fn(),
    logError: vi.fn(),
    dbLogger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn()
    }
}));

const mockTable = {
    id: { count: () => ({ as: () => 'COUNT_COL' }) },
    name: {},
    deletedAt: {}
};

type DummyType = { id: string; name?: string };

class DummyModel extends BaseModelImpl<DummyType> {
    // @ts-expect-error: mock table for test, not a real Drizzle table
    protected table = mockTable as unknown as Record<string, object>;
    public entityName = 'dummy';

    protected getTableName(): string {
        return 'dummy';
    }
}

/** SQLSTATE for `unique_violation`. */
const PG_UNIQUE_VIOLATION = '23505';

/**
 * Builds the error shape Drizzle actually produces for a unique violation:
 * an outer error whose message is the SQL dump, wrapping the pg driver error
 * that carries the SQLSTATE. Verified against a real Postgres insert.
 */
const buildDrizzleWrappedUniqueViolation = (): Error => {
    const driverError = Object.assign(
        new Error('duplicate key value violates unique constraint "dummy_name_unique"'),
        {
            code: PG_UNIQUE_VIOLATION,
            constraint: 'dummy_name_unique',
            table: 'dummy',
            detail: 'Key (name)=(taken) already exists.'
        }
    );
    return Object.assign(
        new Error(
            'Failed query: insert into "dummy" ("id", "name") values ($1, $2)\nparams: 1,taken'
        ),
        { cause: driverError }
    );
};

/**
 * The `*WithRelations` methods reach the driver through more than one entry
 * point (`db.query.<table>.findFirst/findMany` for the rows, `db.select()` for
 * the companion count), so the stub makes every entry point fail the same way.
 */
const relationsStub = (thrower: () => never): Record<string, unknown> => ({
    query: { dummy: { findFirst: thrower, findMany: thrower } },
    select: thrower,
    execute: thrower
});

/** Walks `cause` looking for a link carrying the given SQLSTATE. */
const findSqlStateInCauseChain = (error: unknown, code: string): boolean => {
    let current: unknown = error;
    for (let depth = 0; depth < 10; depth++) {
        if (current === null || typeof current !== 'object') return false;
        if ((current as { code?: unknown }).code === code) return true;
        current = (current as { cause?: unknown }).cause;
    }
    return false;
};

describe('BaseModelImpl preserves the driver error as DbError#cause (HOS-1174)', () => {
    let model: DummyModel;
    let getDb: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        model = new DummyModel();
        vi.clearAllMocks();
        getDb = vi.spyOn(dbUtils, 'getDb') as ReturnType<typeof vi.fn>;
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    /**
     * Each entry drives ONE `BaseModelImpl` method into its catch block by
     * making the drizzle builder it uses throw, then asserts the cause chain.
     */
    const cases: ReadonlyArray<{
        readonly method: string;
        readonly stub: (thrower: () => never) => Record<string, unknown>;
        readonly run: (m: DummyModel) => Promise<unknown>;
    }> = [
        {
            method: 'create',
            stub: (thrower) => ({ insert: () => ({ values: () => ({ returning: thrower }) }) }),
            run: (m) => m.create({ id: '1', name: 'taken' })
        },
        {
            method: 'update',
            stub: (thrower) => ({
                update: () => ({ set: () => ({ where: () => ({ returning: thrower }) }) })
            }),
            run: (m) => m.update({ id: '1' }, { name: 'taken' })
        },
        {
            method: 'findAll',
            stub: (thrower) => ({ select: () => ({ from: () => ({ where: thrower }) }) }),
            run: (m) => m.findAll({ id: '1' })
        },
        {
            method: 'findById',
            stub: (thrower) => ({ select: () => ({ from: () => ({ where: thrower }) }) }),
            run: (m) => m.findById('1')
        },
        {
            method: 'findByIds',
            stub: (thrower) => ({ select: () => ({ from: () => ({ where: thrower }) }) }),
            run: (m) => m.findByIds(['1'])
        },
        {
            method: 'findOne',
            stub: (thrower) => ({ select: () => ({ from: () => ({ where: thrower }) }) }),
            run: (m) => m.findOne({ id: '1' })
        },
        {
            method: 'count',
            stub: (thrower) => ({ select: () => ({ from: () => ({ where: thrower }) }) }),
            run: (m) => m.count({ id: '1' })
        },
        {
            method: 'raw',
            stub: (thrower) => ({ execute: thrower }),
            run: (m) => m.raw(sql`select 1`)
        },
        {
            method: 'hardDelete',
            stub: (thrower) => ({ delete: () => ({ where: () => ({ returning: thrower }) }) }),
            run: (m) => m.hardDelete({ id: '1' })
        },
        {
            method: 'softDelete',
            stub: (thrower) => ({
                update: () => ({ set: () => ({ where: () => ({ returning: thrower }) }) })
            }),
            run: (m) => m.softDelete({ id: '1' }, null)
        },
        {
            method: 'restore',
            stub: (thrower) => ({
                update: () => ({ set: () => ({ where: () => ({ returning: thrower }) }) })
            }),
            run: (m) => m.restore({ id: '1' })
        },
        {
            method: 'findWithRelations',
            stub: relationsStub,
            run: (m) => m.findWithRelations({ id: '1' }, { other: true })
        },
        {
            method: 'findOneWithRelations',
            stub: relationsStub,
            run: (m) => m.findOneWithRelations({ id: '1' }, { other: true })
        },
        {
            method: 'findAllWithRelations',
            stub: relationsStub,
            run: (m) => m.findAllWithRelations({ id: '1' }, {}, { other: true })
        }
    ];

    for (const { method, stub, run } of cases) {
        it(`${method}() re-throws a DbError whose cause carries the SQLSTATE`, async () => {
            // Arrange
            const driverFailure = buildDrizzleWrappedUniqueViolation();
            getDb.mockReturnValue(
                stub(() => {
                    throw driverFailure;
                })
            );

            // Act
            let caught: unknown;
            try {
                await run(model);
            } catch (error) {
                caught = error;
            }

            // Assert
            expect(caught).toBeInstanceOf(DbError);
            expect((caught as Error).cause).toBe(driverFailure);
            expect(findSqlStateInCauseChain(caught, PG_UNIQUE_VIOLATION)).toBe(true);
        });
    }

    it('wraps a non-Error thrown value and still exposes it through the cause', async () => {
        // Arrange
        getDb.mockReturnValue({
            insert: () => ({
                values: () => ({
                    returning: () => {
                        // Intentionally a non-Error value: a driver can throw one.
                        throw 'boom';
                    }
                })
            })
        });

        // Act
        let caught: unknown;
        try {
            await model.create({ id: '1' });
        } catch (error) {
            caught = error;
        }

        // Assert
        expect(caught).toBeInstanceOf(DbError);
        expect((caught as Error).cause).toBeInstanceOf(Error);
        expect(((caught as Error).cause as Error).message).toBe('boom');
    });
});

/**
 * Static guard over `base.model.ts`'s own source.
 *
 * The behavioural cases above only cover the methods they name; this covers
 * the file, including call sites nobody has written yet. It polices BOTH ways
 * of constructing the error — `new DbError(...)` and the `throwDbError(...)`
 * helper exported from the same module (`src/utils/error.ts`), whose signature
 * also ends in an optional `cause`. Covering only the constructor would leave a
 * ready-made escape hatch: deriving a call site to the helper drops the cause
 * and the guard would stay green.
 *
 * Comments are stripped before parsing, so a `new DbError(a, b, c, d)` inside a
 * JSDoc example cannot fail the guard falsely.
 */
describe('static guard: every catch-site in base.model.ts passes a cause (HOS-1174)', () => {
    /**
     * Pre-flight guards throw a `DbError` describing a CALLER mistake, before
     * any query runs — there is no driver error to attach, so they are the
     * only legitimate 4-argument call sites. Frozen by exact count AND by the
     * text each one carries, so a new causeless catch-site cannot hide here.
     */
    const PRE_FLIGHT_GUARD_MARKERS = [
        'where clause cannot be empty',
        'does not have a deletedAt column'
    ] as const;
    const EXPECTED_PRE_FLIGHT_GUARD_COUNT = 6;

    /** Both ways this module can raise a `DbError`. Neither may drop the cause. */
    const CALL_MARKERS = ['new DbError(', 'throwDbError('] as const;

    /**
     * Blanks out comment bodies while preserving offsets, so the scan sees code
     * only. Without this, an illustrative `new DbError(a, b, c, d)` in a JSDoc
     * block would be counted as a real causeless call site.
     */
    const stripComments = (source: string): string => {
        let out = '';
        let index = 0;
        let state: 'code' | 'line' | 'block' = 'code';
        let quote: string | null = null;
        while (index < source.length) {
            const ch = source[index] as string;
            const next = source[index + 1];
            if (state === 'code') {
                if (quote) {
                    out += ch;
                    if (ch === '\\') {
                        out += next ?? '';
                        index += 2;
                        continue;
                    }
                    if (ch === quote) quote = null;
                    index++;
                    continue;
                }
                if (ch === "'" || ch === '"' || ch === '`') {
                    quote = ch;
                    out += ch;
                    index++;
                    continue;
                }
                if (ch === '/' && next === '/') {
                    state = 'line';
                    out += '  ';
                    index += 2;
                    continue;
                }
                if (ch === '/' && next === '*') {
                    state = 'block';
                    out += '  ';
                    index += 2;
                    continue;
                }
                out += ch;
                index++;
                continue;
            }
            if (state === 'line') {
                if (ch === '\n') {
                    state = 'code';
                    out += '\n';
                    index++;
                    continue;
                }
                out += ' ';
                index++;
                continue;
            }
            if (ch === '*' && next === '/') {
                state = 'code';
                out += '  ';
                index += 2;
                continue;
            }
            out += ch === '\n' ? '\n' : ' ';
            index++;
        }
        return out;
    };

    /** Splits a call's argument list on top-level commas. */
    const splitTopLevelArgs = (source: string, openParenIndex: number): string[] => {
        const args: string[] = [];
        let depth = 0;
        let current = '';
        let quote: string | null = null;
        for (let i = openParenIndex + 1; i < source.length; i++) {
            const ch = source[i] as string;
            const prev = source[i - 1];
            if (quote) {
                current += ch;
                if (ch === quote && prev !== '\\') quote = null;
                continue;
            }
            if (ch === "'" || ch === '"' || ch === '`') {
                quote = ch;
                current += ch;
                continue;
            }
            if (ch === '(' || ch === '[' || ch === '{') depth++;
            if (ch === ')' && depth === 0) {
                args.push(current);
                return args;
            }
            if (ch === ')' || ch === ']' || ch === '}') depth--;
            if (ch === ',' && depth === 0) {
                args.push(current);
                current = '';
                continue;
            }
            current += ch;
        }
        throw new Error('Unbalanced parentheses while parsing a DbError call');
    };

    const parseDbErrorCalls = (): ReadonlyArray<{ argCount: number; args: string[] }> => {
        const source = stripComments(
            readFileSync(join(__dirname, '../../src/base/base.model.ts'), 'utf8')
        );
        const calls: Array<{ argCount: number; args: string[] }> = [];
        for (const marker of CALL_MARKERS) {
            let index = source.indexOf(marker);
            while (index !== -1) {
                const args = splitTopLevelArgs(source, index + marker.length - 1);
                calls.push({ argCount: args.length, args: args.map((a) => a.trim()) });
                index = source.indexOf(marker, index + marker.length);
            }
        }
        return calls;
    };

    it('finds every DbError call site in the file', () => {
        expect(parseDbErrorCalls().length).toBeGreaterThan(10);
    });

    it('only the frozen pre-flight guards omit the cause argument', () => {
        // Arrange
        const calls = parseDbErrorCalls();

        // Act
        const causeless = calls.filter((call) => call.argCount < 5);

        // Assert
        expect(causeless).toHaveLength(EXPECTED_PRE_FLIGHT_GUARD_COUNT);
        for (const call of causeless) {
            const message = call.args[3] ?? '';
            expect(
                PRE_FLIGHT_GUARD_MARKERS.some((marker) => message.includes(marker)),
                `causeless DbError with unexpected message: ${message}`
            ).toBe(true);
        }
    });

    it('every other call site passes the caught error as the 5th argument', () => {
        // Arrange
        const calls = parseDbErrorCalls();

        // Act
        const withCause = calls.filter((call) => call.argCount >= 5);

        // Assert
        expect(withCause.length).toBeGreaterThan(0);
        for (const call of withCause) {
            expect(call.args[4]).toBe('err');
        }
    });

    it('would catch a causeless call routed through the `throwDbError` helper', () => {
        // Arrange — the helper's signature ends in the same optional `cause`,
        // so a partial refactor to it is the cheapest way to drop the cause
        // without touching a `new DbError(` line. This pins that the scan reads
        // both markers rather than only the constructor.
        expect(CALL_MARKERS).toContain('throwDbError(');

        // Act — `throwDbError` is exported from the module the file imports
        // from, so a future call site is reachable without a new import.
        const errorModule = readFileSync(join(__dirname, '../../src/utils/error.ts'), 'utf8');

        // Assert
        expect(errorModule).toContain('export const throwDbError');
    });
});
