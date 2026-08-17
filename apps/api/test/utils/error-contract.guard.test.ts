/**
 * Static guard: a route added tomorrow cannot quietly leave the error contract.
 *
 * The contract, in evaluation order:
 *   1. authentication      → 401
 *   2. route permission    → 403
 *   3. input shape         → 400
 *   4. existence/ownership → 404
 *   5. business rules      → 409 / 422 / 403-gate
 * and no step may touch the database with a value an earlier step did not
 * validate.
 *
 * Three findings from the August 2026 smoke were each a single route drifting
 * off that order, and each was invisible to the test suite of its day:
 *   - H-68  ownership ran before shape validation → 500 on 19 routes;
 *   - H-72  ownership answered 403 where its sibling answered 404;
 *   - H-105 a status the formatter did not know became INTERNAL_ERROR.
 *
 * Unit tests pin the behaviour that exists. These assertions pin the SHAPE of
 * what may be written next, which is the half that a new route can violate
 * without breaking anything green.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { MAPPED_HTTP_STATUSES } from '../../src/utils/http-error-codes';
import { collectSourceFiles } from './helpers/collect-source-files';

const SRC = join(__dirname, '../../src');

/**
 * Every `.ts` under `src/`, excluding tests.
 *
 * Read once: an empty list would make every assertion below vacuously true, so
 * the count is asserted first — a guard that scans nothing reports the same
 * "all clear" as a guard that scans everything and finds nothing.
 */
const sourceFiles = collectSourceFiles(SRC);

describe('error contract — static guards', () => {
    it('scans a non-empty set of source files', () => {
        // The instrument check. Without it, a broken glob or a moved directory
        // turns this whole file into a green no-op.
        expect(sourceFiles.length).toBeGreaterThan(200);
    });

    describe('every HTTPException status has a mapped error code', () => {
        /**
         * A status the shared table does not know falls back by CLASS, so a 4xx
         * still reaches the client as a caller error rather than as
         * INTERNAL_ERROR. That fallback is a safety net, not a licence: an
         * unmapped status means nobody decided which code the client should
         * branch on. This guard makes that decision explicit at the moment the
         * status is introduced.
         */
        const mapped = new Set(MAPPED_HTTP_STATUSES);

        it('for every literal `new HTTPException(<status>` in src/', () => {
            const offenders: string[] = [];

            for (const file of sourceFiles) {
                const source = readFileSync(file, 'utf8');
                for (const match of source.matchAll(/new HTTPException\(\s*(\d{3})/g)) {
                    const status = Number(match[1]);
                    if (!mapped.has(status)) {
                        offenders.push(`${file.replace(SRC, 'src')}: ${status}`);
                    }
                }
            }

            expect(offenders).toEqual([]);
        });

        it('for every status enumerated in a `status as A | B | C` assertion', () => {
            // Routes that map a service error to a status assert the union
            // inline. Those statuses never appear as literals, so the previous
            // assertion is blind to them — and 502/504 reach the client ONLY
            // through this shape.
            const offenders: string[] = [];

            for (const file of sourceFiles) {
                const source = readFileSync(file, 'utf8');
                for (const match of source.matchAll(
                    /new HTTPException\(\s*\w+\s+as\s+([\d\s|]+)/g
                )) {
                    const statuses = (match[1] ?? '')
                        .split('|')
                        .map((part) => Number(part.trim()))
                        .filter((n) => Number.isFinite(n) && n > 0);
                    for (const status of statuses) {
                        if (!mapped.has(status)) {
                            offenders.push(`${file.replace(SRC, 'src')}: ${status}`);
                        }
                    }
                }
            }

            expect(offenders).toEqual([]);
        });
    });

    describe('ownership routes validate their id before reaching the database', () => {
        it('every route declaring `ownership:` also declares a matching requestParams schema', () => {
            // `createProtectedRoute` throws at boot when this is violated, which
            // is the real enforcement. This restates it statically so the
            // failure names the offending FILE at test time instead of taking
            // the whole API down at startup.
            const offenders: string[] = [];

            for (const file of sourceFiles) {
                if (!file.includes('/routes/')) {
                    continue;
                }
                const source = readFileSync(file, 'utf8');
                if (!/\n\s*ownership:\s*\{/.test(source)) {
                    continue;
                }

                const paramIdField = /paramIdField:\s*'([^']+)'/.exec(source)?.[1] ?? 'id';
                const declaresParam = new RegExp(
                    `requestParams:\\s*\\{[^}]*\\b${paramIdField}\\b`,
                    's'
                ).test(source);

                if (!declaresParam) {
                    offenders.push(`${file.replace(SRC, 'src')} (paramIdField: ${paramIdField})`);
                }
            }

            expect(offenders).toEqual([]);
        });

        it('the ownership middleware rejects a malformed id before calling the fetcher', () => {
            const source = readFileSync(join(SRC, 'middlewares/ownership.ts'), 'utf8');

            const guardAt = source.indexOf('isWellFormedEntityId(entityId');
            const fetchAt = source.indexOf('await fetcher(actor, entityId)');

            // Anchored on both symbols so that DELETING the guard and MOVING it
            // after the fetch are two distinct failures, and both are caught.
            expect(guardAt).toBeGreaterThan(-1);
            expect(fetchAt).toBeGreaterThan(-1);
            expect(guardAt).toBeLessThan(fetchAt);
        });

        it('the ownership middleware never answers 403', () => {
            // H-72. Ownership has exactly two outcomes for a caller who is not
            // the owner — the row is missing, or it is not theirs — and both
            // must read as 404. A 403 anywhere in this file reopens the leak.
            const source = readFileSync(join(SRC, 'middlewares/ownership.ts'), 'utf8');
            const code = source.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, '');

            expect(code).not.toMatch(/HTTPException\(\s*403/);
        });
    });

    it('the status → code table lives in exactly one module', () => {
        // The two formatters used to hold separate copies "kept in sync by
        // comment", and they drifted (H-105). Any file rebuilding its own
        // status→code lookup is that arrangement coming back.
        const offenders: string[] = [];

        for (const file of sourceFiles) {
            if (file.endsWith('utils/http-error-codes.ts')) {
                continue;
            }
            const source = readFileSync(file, 'utf8');
            // A local map keyed by HTTP statuses pointing at ServiceErrorCodes.
            if (/\b40[0-9]:\s*ServiceErrorCode\./.test(source)) {
                offenders.push(file.replace(SRC, 'src'));
            }
        }

        expect(offenders).toEqual([]);
    });
});
