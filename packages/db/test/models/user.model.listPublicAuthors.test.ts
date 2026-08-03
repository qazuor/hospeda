/**
 * @file user.model.listPublicAuthors.test.ts
 * @description Unit tests for `UserModel.listPublicAuthors` (HOS-375 T-011,
 * T-031).
 *
 * The query is mocked, so these tests do not prove the SQL predicate selects the
 * right rows — only a real database can do that. What they DO pin is the wiring
 * that has no other guard: that the page query and the count query are filtered
 * by the very same condition object (a `total` built from a different WHERE is
 * how pagination silently starts lying), that pagination arithmetic is right,
 * and that the ordering carries its tiebreak.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as dbUtils from '../../src/client';
import { UserModel } from '../../src/models/user/user.model';

vi.mock('../../src/utils/logger', () => ({
    logQuery: vi.fn(),
    logError: vi.fn()
}));

/** Everything the two mocked query chains recorded during one call. */
interface RecordedCalls {
    readonly pageWhere: unknown[];
    readonly countWhere: unknown[];
    readonly orderBy: unknown[][];
    readonly limit: unknown[];
    readonly offset: unknown[];
    readonly selectProjections: unknown[];
}

/**
 * Builds a db double whose first `select()` serves the page query and whose
 * second serves the count query, recording what each was given.
 */
function createDbDouble(rows: Array<{ slug: string; updatedAt: Date }>, total: number) {
    const recorded: {
        pageWhere: unknown[];
        countWhere: unknown[];
        orderBy: unknown[][];
        limit: unknown[];
        offset: unknown[];
        selectProjections: unknown[];
    } = {
        pageWhere: [],
        countWhere: [],
        orderBy: [],
        limit: [],
        offset: [],
        selectProjections: []
    };

    let selectCall = 0;

    const db = {
        select: vi.fn((projection?: unknown) => {
            selectCall += 1;
            recorded.selectProjections.push(projection);
            const isPageQuery = selectCall === 1;

            return {
                from: vi.fn().mockReturnValue({
                    where: vi.fn((clause: unknown) => {
                        if (isPageQuery) {
                            recorded.pageWhere.push(clause);
                            return {
                                orderBy: vi.fn((...args: unknown[]) => {
                                    recorded.orderBy.push(args);
                                    return {
                                        limit: vi.fn((value: unknown) => {
                                            recorded.limit.push(value);
                                            return {
                                                offset: vi.fn((value2: unknown) => {
                                                    recorded.offset.push(value2);
                                                    return Promise.resolve(rows);
                                                })
                                            };
                                        })
                                    };
                                })
                            };
                        }
                        recorded.countWhere.push(clause);
                        return Promise.resolve([{ count: total }]);
                    })
                })
            };
        })
    };

    return { db, recorded: recorded as RecordedCalls };
}

describe('UserModel.listPublicAuthors', () => {
    let model: UserModel;
    let getDb: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        model = new UserModel();
        vi.clearAllMocks();
        getDb = vi.spyOn(dbUtils, 'getDb') as ReturnType<typeof vi.fn>;
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('returns the projected rows and the total', async () => {
        // Arrange
        const updatedAt = new Date('2026-08-01T10:00:00.000Z');
        const { db } = createDbDouble([{ slug: 'equipo-hospeda', updatedAt }], 7);
        getDb.mockReturnValue(db);

        // Act
        const result = await model.listPublicAuthors({ page: 1, pageSize: 10 });

        // Assert
        expect(result.items).toEqual([{ slug: 'equipo-hospeda', updatedAt }]);
        expect(result.total).toBe(7);
    });

    it('filters the page query and the count query with the SAME condition', async () => {
        // Arrange — the one bug a mocked test can actually catch here: two
        // separately built WHERE clauses make `total` count a different set than
        // the rows it paginates.
        const { db, recorded } = createDbDouble([], 0);
        getDb.mockReturnValue(db);

        // Act
        await model.listPublicAuthors({ page: 1, pageSize: 10 });

        // Assert — identity, not deep equality: two structurally identical
        // clauses built at different call sites would pass a deep compare and
        // still drift the next time one of them is edited.
        expect(recorded.pageWhere).toHaveLength(1);
        expect(recorded.countWhere).toHaveLength(1);
        expect(recorded.countWhere[0]).toBe(recorded.pageWhere[0]);
    });

    it('orders by updated_at with a slug tiebreak, so pages cannot overlap', async () => {
        // Arrange — `updated_at` is not unique. Without the second key a row can
        // appear on two pages of a crawl, or on none.
        const { db, recorded } = createDbDouble([], 0);
        getDb.mockReturnValue(db);

        // Act
        await model.listPublicAuthors({ page: 1, pageSize: 10 });

        // Assert
        expect(recorded.orderBy[0]).toHaveLength(2);
    });

    it('translates page and pageSize into limit and offset', async () => {
        // Arrange
        const { db, recorded } = createDbDouble([], 0);
        getDb.mockReturnValue(db);

        // Act
        await model.listPublicAuthors({ page: 3, pageSize: 20 });

        // Assert — page 3 starts after two full pages.
        expect(recorded.limit[0]).toBe(20);
        expect(recorded.offset[0]).toBe(40);
    });

    it('asks for page 1 with no offset', async () => {
        // Arrange — off-by-one guard for the arithmetic above.
        const { db, recorded } = createDbDouble([], 0);
        getDb.mockReturnValue(db);

        // Act
        await model.listPublicAuthors({ page: 1, pageSize: 20 });

        // Assert
        expect(recorded.offset[0]).toBe(0);
    });

    it('selects only slug and updatedAt, never a whole user row', async () => {
        // Arrange — this is a PUBLIC, unauthenticated surface. Widening the
        // projection is how it would become a user-enumeration endpoint.
        const { db, recorded } = createDbDouble([], 0);
        getDb.mockReturnValue(db);

        // Act
        await model.listPublicAuthors({ page: 1, pageSize: 10 });

        // Assert
        expect(Object.keys(recorded.selectProjections[0] as object).sort()).toEqual([
            'slug',
            'updatedAt'
        ]);
    });

    it('reports zero rows as an empty page rather than throwing', async () => {
        // Arrange — a brand-new environment has no qualifying author at all.
        const { db } = createDbDouble([], 0);
        getDb.mockReturnValue(db);

        // Act
        const result = await model.listPublicAuthors({ page: 1, pageSize: 10 });

        // Assert
        expect(result).toEqual({ items: [], total: 0 });
    });
});

describe('listPublicAuthors — role-coupling static guard (HOS-375 T-031)', () => {
    /**
     * Eligibility must key off the STORED `users.is_system_account` column,
     * never off a live role lookup — the role is mutable and the flag is not
     * (see the model's own docstring and `packages/db/CLAUDE.md`
     * "`users.is_system_account` — service accounts"). Promoting a real
     * editor to ADMIN, or demoting a system account to EDITOR, must never
     * change whether it appears in this list.
     *
     * The integration suite (`list-public-authors.integration.test.ts`)
     * proves the two concrete cases against a real database. This guard
     * proves the STRUCTURAL invariant that makes a THIRD case impossible: the
     * method body cannot even reach for role data, because it never mentions
     * it. A unit test that merely re-asserts one more role/permission
     * combination would still leave the door open for a different one; this
     * closes the whole class.
     */
    it('does not reference role data anywhere in its implementation', () => {
        // Arrange — read the real source, not a copy, so the guard tracks the
        // method as it evolves and cannot go stale.
        const source = readFileSync(
            resolve(__dirname, '../../src/models/user/user.model.ts'),
            'utf8'
        );
        const methodStart = source.indexOf('async listPublicAuthors(');
        expect(methodStart).toBeGreaterThan(-1);

        // `listPublicAuthors` is the LAST method declared in `UserModel`, so
        // its body runs up to the class-closing brace at the start of a
        // line. Slicing from `methodStart` (not from the class start)
        // deliberately EXCLUDES the JSDoc above it, which legitimately
        // discusses roles to explain why the code below must not.
        const classEnd = source.indexOf('\n}\n', methodStart);
        expect(classEnd).toBeGreaterThan(methodStart);
        const methodSource = source.slice(methodStart, classEnd);

        // Act / Assert — none of these identifiers may appear in the
        // executable body. `userRole` is the actual Drizzle table import a
        // regression would join against; the enum members cover a filter
        // written as a raw SQL string instead.
        for (const forbidden of ['RoleEnum', 'userRole', 'ADMIN', 'SUPER_ADMIN', 'EDITOR']) {
            expect(methodSource).not.toContain(forbidden);
        }
    });
});
