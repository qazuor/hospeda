/**
 * Unit tests for the HOS-296 multi-role write primitives.
 *
 * Covers the numbered acceptance criteria that live at this layer:
 * - AC-5  — `revokeRole` cannot remove a user's last role.
 * - AC-6  — every grant AND every revoke leaves a `user_role_audit` row with
 *           `action`, `by` and `reason`; revoke-then-re-grant leaves three
 *           rows, in order.
 * - AC-12 — `revokeRole` cannot strand a user with zero roles under two
 *           CONCURRENT calls, not just sequential ones.
 *
 * The `@repo/db` mock is an in-memory store with a real mutex behind
 * `.for('update')`. That is what makes the AC-12 test non-vacuous: the lock is
 * acquired only when the production code actually calls `.for('update')`, and
 * released when its transaction callback settles. Delete the `.for('update')`
 * from `revokeRole` and the AC-12 test fails with the user holding zero roles —
 * which is precisely the bug the criterion exists to prevent.
 */

import { RoleEnum, ServiceErrorCode } from '@repo/schemas';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// In-memory store
// ---------------------------------------------------------------------------

type UserRow = { id: string };
type UserRoleRow = {
    userId: string;
    role: RoleEnum;
    grantedBy: string | null;
    grantReason: string | null;
};
type AuditRow = {
    userId: string;
    role: RoleEnum;
    action: string;
    by: string | null;
    reason: string | null;
};

const store: { users: UserRow[]; userRoles: UserRoleRow[]; audit: AuditRow[] } = {
    users: [],
    userRoles: [],
    audit: []
};

/** Promise-chain mutex standing in for a Postgres row lock. */
const createMutex = () => {
    let tail: Promise<void> = Promise.resolve();
    return {
        acquire: async (): Promise<() => void> => {
            let release!: () => void;
            const next = new Promise<void>((resolve) => {
                release = resolve;
            });
            const previous = tail;
            tail = tail.then(() => next);
            await previous;
            return release;
        }
    };
};

const rowLock = createMutex();

// ---------------------------------------------------------------------------
// Predicate descriptors — `eq` / `and` are replaced so the fake store can
// interpret the WHERE clauses the production code builds.
// ---------------------------------------------------------------------------

type Predicate =
    | { op: 'eq'; column: unknown; value: unknown }
    | { op: 'and'; parts: readonly Predicate[] };

const fakeEq = (column: unknown, value: unknown): Predicate => ({ op: 'eq', column, value });
const fakeAnd = (...parts: readonly Predicate[]): Predicate => ({ op: 'and', parts });

vi.mock('@repo/db', async (importOriginal) => {
    const original = await importOriginal<typeof import('@repo/db')>();
    return {
        ...original,
        eq: fakeEq,
        and: fakeAnd,
        getDb: () => createFakeClient([]),
        withTransaction: async <T>(
            callback: (tx: unknown) => Promise<T>,
            existingTx?: unknown
        ): Promise<T> => {
            if (existingTx) {
                return callback(existingTx);
            }
            const releases: Array<() => void> = [];
            try {
                return await callback(createFakeClient(releases));
            } finally {
                for (const release of releases) {
                    release();
                }
            }
        }
    };
});

// Imported AFTER the mock declaration; `userRole`/`users` come from the real
// module (the factory spreads the original), so column identity works.
const { userRole, userRoleAudit, users } = await import('@repo/db');
const { grantRole, revokeRole, getUserRoles } = await import(
    '../../../src/services/user-role/user-role.service.js'
);

/** Maps a real Drizzle column object to the key used in the fake store rows. */
const columnKey = (column: unknown): string => {
    if (column === userRole.userId) return 'userId';
    if (column === userRole.role) return 'role';
    if (column === users.id) return 'id';
    throw new Error('Unmapped column in fake WHERE clause');
};

const matches = (row: Record<string, unknown>, predicate: Predicate): boolean => {
    if (predicate.op === 'and') {
        return predicate.parts.every((part) => matches(row, part));
    }
    return row[columnKey(predicate.column)] === predicate.value;
};

// ---------------------------------------------------------------------------
// Fake Drizzle client
// ---------------------------------------------------------------------------

type Thenable<T> = PromiseLike<T> & { for: (mode: string) => Promise<T> };

const createWhereResult = <T>(getRows: () => T[], onLock: () => Promise<void>): Thenable<T[]> => ({
    // biome-ignore lint/suspicious/noThenProperty: Drizzle query builders ARE thenables; the double has to be awaitable to stand in for one
    then: (onFulfilled, onRejected) => Promise.resolve(getRows()).then(onFulfilled, onRejected),
    for: async (_mode: string) => {
        await onLock();
        return getRows();
    }
});

/** Set by a test to mutate the store right before a DELETE executes. */
let beforeDelete: (() => void) | null = null;

const createFakeClient = (releases: Array<() => void>): any => ({
    select: (_columns: unknown) => ({
        from: (table: unknown) => ({
            where: (predicate: Predicate) =>
                createWhereResult<Record<string, unknown>>(
                    () => {
                        const rows: Array<Record<string, unknown>> =
                            table === users
                                ? (store.users as unknown as Array<Record<string, unknown>>)
                                : (store.userRoles as unknown as Array<Record<string, unknown>>);
                        return rows.filter((row) => matches(row, predicate));
                    },
                    async () => {
                        releases.push(await rowLock.acquire());
                    }
                )
        })
    }),
    insert: (table: unknown) => ({
        values: (value: Record<string, unknown>) => {
            let applied = false;
            let skipOnConflict = false;

            const apply = (): Array<Record<string, unknown>> => {
                if (applied) return [];
                applied = true;

                if (table === userRoleAudit) {
                    store.audit.push(value as unknown as AuditRow);
                    return [value];
                }

                const row = value as unknown as UserRoleRow;
                const exists = store.userRoles.some(
                    (existing) => existing.userId === row.userId && existing.role === row.role
                );
                if (exists && skipOnConflict) {
                    return [];
                }
                store.userRoles.push(row);
                return [value];
            };

            const chain = {
                onConflictDoNothing: (_target: unknown) => {
                    skipOnConflict = true;
                    return chain;
                },
                returning: (_columns: unknown) => Promise.resolve(apply()),
                // biome-ignore lint/suspicious/noThenProperty: Drizzle insert builders ARE thenables; the double has to be awaitable to stand in for one
                then: (
                    onFulfilled?: (value: unknown) => unknown,
                    onRejected?: (reason: unknown) => unknown
                ) => Promise.resolve(apply()).then(onFulfilled, onRejected)
            };
            return chain;
        }
    }),
    delete: (_table: unknown) => ({
        where: (predicate: Predicate) => {
            let applied = false;
            const run = (): Array<Record<string, unknown>> => {
                if (applied) return [];
                applied = true;

                // Hook for the "row vanished through another path" case: the
                // `FOR UPDATE` lock only serialises callers that go through
                // `revokeRole`, so a manual repair or a cascade can delete the
                // row between the locked read and this statement.
                beforeDelete?.();

                const removed: Array<Record<string, unknown>> = [];
                const kept: UserRoleRow[] = [];
                for (const row of store.userRoles) {
                    if (matches(row as unknown as Record<string, unknown>, predicate)) {
                        removed.push(row as unknown as Record<string, unknown>);
                    } else {
                        kept.push(row);
                    }
                }
                store.userRoles.length = 0;
                store.userRoles.push(...kept);
                return removed;
            };
            return {
                returning: (_columns: unknown) => Promise.resolve(run()),
                // biome-ignore lint/suspicious/noThenProperty: Drizzle delete builders ARE thenables; the double has to be awaitable to stand in for one
                then: (
                    onFulfilled?: (value: unknown) => unknown,
                    onRejected?: (reason: unknown) => unknown
                ) => Promise.resolve(run()).then(onFulfilled, onRejected)
            };
        }
    })
});

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const USER_ID = '11111111-1111-4111-8111-111111111111';
const ADMIN_ID = '22222222-2222-4222-8222-222222222222';
const MISSING_USER_ID = '33333333-3333-4333-8333-333333333333';

const seedUser = (roles: readonly RoleEnum[]): void => {
    store.users.push({ id: USER_ID });
    for (const role of roles) {
        store.userRoles.push({
            userId: USER_ID,
            role,
            grantedBy: null,
            grantReason: 'seed'
        });
    }
};

beforeEach(() => {
    store.users.length = 0;
    store.userRoles.length = 0;
    store.audit.length = 0;
    beforeDelete = null;
});

// ---------------------------------------------------------------------------
// grantRole
// ---------------------------------------------------------------------------

describe('grantRole', () => {
    it('adds a hat without removing the ones already held', async () => {
        // Arrange
        seedUser([RoleEnum.USER, RoleEnum.COMMERCE_OWNER]);

        // Act
        const result = await grantRole({
            userId: USER_ID,
            role: RoleEnum.HOST,
            grantedBy: ADMIN_ID,
            reason: 'accommodation_activated'
        });

        // Assert
        expect(result.error).toBeUndefined();
        expect(result.data?.changed).toBe(true);
        expect(await getUserRoles({ userId: USER_ID })).toEqual(
            expect.arrayContaining([RoleEnum.USER, RoleEnum.COMMERCE_OWNER, RoleEnum.HOST])
        );
    });

    it('is an idempotent no-op when the hat is already held', async () => {
        // Arrange
        seedUser([RoleEnum.USER, RoleEnum.HOST]);

        // Act
        const result = await grantRole({
            userId: USER_ID,
            role: RoleEnum.HOST,
            grantedBy: null,
            reason: 'accommodation_activated'
        });

        // Assert — no duplicate row, and no audit noise for a non-change.
        expect(result.error).toBeUndefined();
        // `changed: false` is the ONLY thing that separates this successful
        // no-op from a successful real grant. Without it a caller that counts
        // or logs grants asserts a state change nothing corroborates.
        expect(result.data?.changed).toBe(false);
        expect(store.userRoles.filter((row) => row.role === RoleEnum.HOST)).toHaveLength(1);
        expect(store.audit).toHaveLength(0);
    });

    it('rejects a malformed input instead of writing a partial row', async () => {
        // Arrange
        seedUser([RoleEnum.USER]);

        // Act
        const result = await grantRole({
            userId: 'not-a-uuid',
            role: RoleEnum.HOST,
            grantedBy: null,
            reason: null
        });

        // Assert
        expect(result.error?.code).toBe(ServiceErrorCode.VALIDATION_ERROR);
        expect(store.userRoles).toHaveLength(1);
    });
});

// ---------------------------------------------------------------------------
// AC-5 — the last role can never be revoked
// ---------------------------------------------------------------------------

describe('revokeRole — AC-5 last-role guard', () => {
    it('refuses to remove the only hat the user wears', async () => {
        // Arrange
        seedUser([RoleEnum.USER]);

        // Act
        const result = await revokeRole({
            userId: USER_ID,
            role: RoleEnum.USER,
            revokedBy: ADMIN_ID,
            reason: 'admin_cleanup'
        });

        // Assert
        expect(result.error?.code).toBe(ServiceErrorCode.VALIDATION_ERROR);
        expect(await getUserRoles({ userId: USER_ID })).toEqual([RoleEnum.USER]);
        expect(store.audit).toHaveLength(0);
    });

    it('refuses the second revoke once the set is down to one hat', async () => {
        // Arrange
        seedUser([RoleEnum.USER, RoleEnum.HOST]);

        // Act
        const first = await revokeRole({
            userId: USER_ID,
            role: RoleEnum.HOST,
            revokedBy: ADMIN_ID,
            reason: 'last_accommodation_archived'
        });
        const second = await revokeRole({
            userId: USER_ID,
            role: RoleEnum.USER,
            revokedBy: ADMIN_ID,
            reason: 'admin_cleanup'
        });

        // Assert
        expect(first.error).toBeUndefined();
        expect(first.data?.changed).toBe(true);
        expect(second.error?.code).toBe(ServiceErrorCode.VALIDATION_ERROR);
        expect(await getUserRoles({ userId: USER_ID })).toEqual([RoleEnum.USER]);
    });

    it('is an idempotent no-op when the hat is not held', async () => {
        // Arrange
        seedUser([RoleEnum.USER, RoleEnum.HOST]);

        // Act
        const result = await revokeRole({
            userId: USER_ID,
            role: RoleEnum.SPONSOR,
            revokedBy: ADMIN_ID,
            reason: 'admin_cleanup'
        });

        // Assert
        expect(result.error).toBeUndefined();
        // The case that made `archive-abandoned-drafts` log a demotion that
        // never happened: a concurrent writer removes HOST between the job's
        // unlocked pre-check and `revokeRole`'s own locked re-read, so the
        // revoke succeeds as a no-op — no error, no delete, no audit row.
        expect(result.data?.changed).toBe(false);
        expect(store.userRoles).toHaveLength(2);
        expect(store.audit).toHaveLength(0);
    });

    it('derives `changed` from the DELETE, not from the pre-delete read', async () => {
        // Arrange — the row disappears through a path that does NOT take this
        // function's `FOR UPDATE` lock (a manual repair like the backfill
        // runbook's Step 4, a cascade, a future admin tool). The locked read
        // still reports the hat as held, so a `changed` inferred from that read
        // would claim a revoke the DELETE never performed.
        seedUser([RoleEnum.USER, RoleEnum.HOST]);
        beforeDelete = () => {
            const index = store.userRoles.findIndex((row) => row.role === RoleEnum.HOST);
            if (index >= 0) store.userRoles.splice(index, 1);
        };

        // Act
        const result = await revokeRole({
            userId: USER_ID,
            role: RoleEnum.HOST,
            revokedBy: ADMIN_ID,
            reason: 'last_accommodation_archived'
        });

        // Assert — `changed` mirrors exactly whether an audit row exists.
        expect(result.error).toBeUndefined();
        expect(result.data?.changed).toBe(false);
        expect(store.audit).toHaveLength(0);
    });

    it('reports NOT_FOUND for an unknown user', async () => {
        // Arrange — no user row seeded.

        // Act
        const result = await revokeRole({
            userId: MISSING_USER_ID,
            role: RoleEnum.HOST,
            revokedBy: ADMIN_ID,
            reason: 'admin_cleanup'
        });

        // Assert
        expect(result.error?.code).toBe(ServiceErrorCode.NOT_FOUND);
    });
});

// ---------------------------------------------------------------------------
// AC-6 — audit trail
// ---------------------------------------------------------------------------

describe('user_role_audit — AC-6', () => {
    it('records action, by and reason on a grant', async () => {
        // Arrange
        seedUser([RoleEnum.USER]);

        // Act
        await grantRole({
            userId: USER_ID,
            role: RoleEnum.HOST,
            grantedBy: ADMIN_ID,
            reason: 'accommodation_activated'
        });

        // Assert
        expect(store.audit).toEqual([
            {
                userId: USER_ID,
                role: RoleEnum.HOST,
                action: 'grant',
                by: ADMIN_ID,
                reason: 'accommodation_activated'
            }
        ]);
    });

    it('records action, by and reason on a revoke', async () => {
        // Arrange
        seedUser([RoleEnum.USER, RoleEnum.HOST]);

        // Act
        await revokeRole({
            userId: USER_ID,
            role: RoleEnum.HOST,
            revokedBy: ADMIN_ID,
            reason: 'last_accommodation_archived'
        });

        // Assert
        expect(store.audit).toEqual([
            {
                userId: USER_ID,
                role: RoleEnum.HOST,
                action: 'revoke',
                by: ADMIN_ID,
                reason: 'last_accommodation_archived'
            }
        ]);
    });

    it('leaves three rows in order for grant → revoke → re-grant', async () => {
        // Arrange
        seedUser([RoleEnum.USER]);

        // Act
        await grantRole({
            userId: USER_ID,
            role: RoleEnum.HOST,
            grantedBy: ADMIN_ID,
            reason: 'accommodation_activated'
        });
        await revokeRole({
            userId: USER_ID,
            role: RoleEnum.HOST,
            revokedBy: ADMIN_ID,
            reason: 'last_accommodation_archived'
        });
        await grantRole({
            userId: USER_ID,
            role: RoleEnum.HOST,
            grantedBy: null,
            reason: 'accommodation_created'
        });

        // Assert
        expect(store.audit.map((row) => row.action)).toEqual(['grant', 'revoke', 'grant']);
        expect(store.audit.map((row) => row.by)).toEqual([ADMIN_ID, ADMIN_ID, null]);
        expect(store.audit.map((row) => row.reason)).toEqual([
            'accommodation_activated',
            'last_accommodation_archived',
            'accommodation_created'
        ]);
    });

    it('writes no audit row when a rejected revoke changes nothing', async () => {
        // Arrange
        seedUser([RoleEnum.HOST]);

        // Act
        await revokeRole({
            userId: USER_ID,
            role: RoleEnum.HOST,
            revokedBy: ADMIN_ID,
            reason: 'admin_cleanup'
        });

        // Assert
        expect(store.audit).toHaveLength(0);
    });
});

// ---------------------------------------------------------------------------
// AC-12 — concurrency
// ---------------------------------------------------------------------------

describe('revokeRole — AC-12 concurrent revokes', () => {
    it('never strands the user with zero roles when two revokes race', async () => {
        // Arrange — {USER, HOST}: each revoke is individually legal against the
        // INITIAL state, so an unlocked check-then-act lets both through.
        seedUser([RoleEnum.USER, RoleEnum.HOST]);

        // Act
        const [revokeHost, revokeUser] = await Promise.all([
            revokeRole({
                userId: USER_ID,
                role: RoleEnum.HOST,
                revokedBy: ADMIN_ID,
                reason: 'last_accommodation_archived'
            }),
            revokeRole({
                userId: USER_ID,
                role: RoleEnum.USER,
                revokedBy: ADMIN_ID,
                reason: 'admin_cleanup'
            })
        ]);

        // Assert — exactly one succeeded; the account keeps a hat.
        const outcomes = [revokeHost, revokeUser];
        const failures = outcomes.filter((outcome) => outcome.error !== undefined);
        expect(failures).toHaveLength(1);
        expect(failures[0]?.error?.code).toBe(ServiceErrorCode.VALIDATION_ERROR);

        const remaining = await getUserRoles({ userId: USER_ID });
        expect(remaining).toHaveLength(1);
        expect(store.audit).toHaveLength(1);
    });

    it('serializes three racing revokes down to two successes on a three-hat user', async () => {
        // Arrange
        seedUser([RoleEnum.USER, RoleEnum.HOST, RoleEnum.COMMERCE_OWNER]);

        // Act
        const outcomes = await Promise.all(
            [RoleEnum.HOST, RoleEnum.COMMERCE_OWNER, RoleEnum.USER].map((role) =>
                revokeRole({
                    userId: USER_ID,
                    role,
                    revokedBy: ADMIN_ID,
                    reason: 'admin_cleanup'
                })
            )
        );

        // Assert
        expect(outcomes.filter((outcome) => outcome.error !== undefined)).toHaveLength(1);
        expect(await getUserRoles({ userId: USER_ID })).toHaveLength(1);
        expect(store.audit).toHaveLength(2);
    });
});
