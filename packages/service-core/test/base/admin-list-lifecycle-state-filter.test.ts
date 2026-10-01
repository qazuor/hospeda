/**
 * HOS-1379 — `adminList` must not build a `where` key the table does not have.
 *
 * ---------------------------------------------------------------------------
 * THE FAILURE THESE TESTS REPRODUCE
 * ---------------------------------------------------------------------------
 * `adminList` used to write `where.lifecycleState = status` unconditionally,
 * two lines above a `'deletedAt' in tableRecord` check it did perform. On the
 * 20 service tables that have no `lifecycleState` column that produced two
 * different wrong answers, neither of them honest:
 *
 *   - 11 reachable admin endpoints FAIL OPEN. `buildWhereClause` drops the
 *     unknown key with a `dbLogger.warn` and keeps the `deletedAt` clause, so
 *     `?status=ACTIVE` answers with the WHOLE table, paginated, looking filtered.
 *   - 1 reachable admin endpoint answers 500. `social_settings` has no
 *     `deletedAt` either, so `lifecycleState` is the ONLY key and
 *     `buildWhereClause` throws `DbError: All 1 key(s) in where clause were
 *     unknown columns`.
 *
 * Both branches are exercised below against REAL Drizzle tables and the REAL
 * `buildWhereClause`, because the defect lives in the agreement between the
 * two — a mock of either side would agree with whatever the service produced.
 *
 * ---------------------------------------------------------------------------
 * WHAT THE FIX IS
 * ---------------------------------------------------------------------------
 * `status` is a key `AdminSearchBaseSchema` RESERVES. `adminList` now resolves
 * it to the column that actually exists — `lifecycleState`, else `status` — and
 * answers 400 (`VALIDATION_ERROR`) when the table has neither, instead of
 * handing `buildWhereClause` a key it is going to discard.
 *
 * `status: 'all'` (the schema default, and what every request that does not use
 * the filter carries) still sets nothing at all, so no endpoint that works today
 * changes behaviour.
 */

import type { BaseModel as BaseModelDB } from '@repo/db';
import { buildWhereClause } from '@repo/db';
import { AdminSearchBaseSchema } from '@repo/schemas';
import type { SQL, Table } from 'drizzle-orm';
import { pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createServiceTestInstance } from '../helpers/serviceTestFactory';
import { createBaseModelMock } from '../utils/modelMockFactory';
import { asMock } from '../utils/test-utils';
import { mockAdminActor } from './base/base.service.mockData';
import { type TestEntity, TestService } from './base/base.service.test.setup';

// ---------------------------------------------------------------------------
// Fixtures — real Drizzle tables, shaped like the three real cases
// ---------------------------------------------------------------------------

/** Shaped like `social_hashtags`: soft-deletable, no `lifecycleState`. The fail-open case. */
const tableWithoutLifecycleState = pgTable('hos_1379_no_lifecycle', {
    id: uuid('id').primaryKey(),
    name: text('name').notNull(),
    deletedAt: timestamp('deleted_at'),
    createdAt: timestamp('created_at').notNull()
});

/** Shaped like `social_settings`: no `lifecycleState` AND no `deletedAt`. The 500 case. */
const tableWithoutLifecycleStateOrDeletedAt = pgTable('hos_1379_bare', {
    id: uuid('id').primaryKey(),
    name: text('name').notNull(),
    createdAt: timestamp('created_at').notNull()
});

/** Shaped like `accommodations`: the 27 services that already work. Must not regress. */
const tableWithLifecycleState = pgTable('hos_1379_lifecycle', {
    id: uuid('id').primaryKey(),
    name: text('name').notNull(),
    lifecycleState: text('lifecycle_state').notNull(),
    deletedAt: timestamp('deleted_at'),
    createdAt: timestamp('created_at').notNull()
});

/**
 * Shaped like `host_trade_benefit_usages`: no `lifecycleState`, but a `status`
 * column of its own, and an admin search schema that REDEFINES `status` to that
 * domain state machine. Resolving the reserved key to this column is what lets
 * that endpoint keep working without an opt-out list.
 */
const tableWithStatusColumn = pgTable('hos_1379_status_col', {
    id: uuid('id').primaryKey(),
    name: text('name').notNull(),
    status: text('status').notNull(),
    deletedAt: timestamp('deleted_at'),
    createdAt: timestamp('created_at').notNull()
});

/** A service whose `adminList` is reachable: it has an admin search schema. */
class AdminListableService extends TestService {
    protected override adminSearchSchema = AdminSearchBaseSchema;
}

/**
 * Renders a `where` through the REAL `buildWhereClause` against the REAL table,
 * and reports the columns the resulting SQL actually constrains.
 *
 * This is the whole point of the suite: asserting on the `where` OBJECT alone
 * would only restate what the service just wrote. What matters is which columns
 * survive into SQL, which is a question only `buildWhereClause` can answer.
 */
const constrainedColumns = (where: Record<string, unknown>, table: Table): readonly string[] => {
    const clause = buildWhereClause(where, table) as
        | (SQL & { queryChunks?: unknown[] })
        | undefined;
    if (clause === undefined) return [];
    const names: string[] = [];
    const walk = (node: unknown): void => {
        if (Array.isArray(node)) {
            for (const child of node) walk(child);
            return;
        }
        if (node === null || typeof node !== 'object') return;
        const record = node as Record<string, unknown>;
        if (typeof record.name === 'string' && record.columnType !== undefined) {
            names.push(record.name);
            return;
        }
        if (Array.isArray(record.queryChunks)) walk(record.queryChunks);
    };
    walk(clause.queryChunks ?? []);
    return names;
};

const paginated = { items: [] as TestEntity[], total: 0 };

/** The query an operator sends when they pick a status in the admin list UI. */
const adminQuery = (status: string): Record<string, unknown> => ({
    page: 1,
    pageSize: 20,
    sort: 'createdAt:desc',
    status,
    includeDeleted: false
});

describe('HOS-1379: adminList resolves the reserved `status` filter to a real column', () => {
    let modelMock: BaseModelDB<TestEntity>;

    beforeEach(() => {
        vi.clearAllMocks();
        modelMock = createBaseModelMock<TestEntity>();
        asMock(modelMock.findAll).mockResolvedValue(paginated);
    });

    // -----------------------------------------------------------------------
    // The fail-open branch: 11 reachable endpoints
    // -----------------------------------------------------------------------

    it('the fail-open reproduction: a table with no lifecycleState column constrains ONLY deletedAt', () => {
        // The measurement, isolated from the service: this is what the 11
        // endpoints were doing. `deletedAt` keeps `buildWhereClause` from
        // throwing, so the dropped status filter is invisible to the caller.
        const where = { lifecycleState: 'ACTIVE', deletedAt: null };

        expect(constrainedColumns(where, tableWithoutLifecycleState)).toEqual(['deleted_at']);
        expect(constrainedColumns(where, tableWithLifecycleState)).toEqual([
            'lifecycle_state',
            'deleted_at'
        ]);
    });

    it('answers 400 instead of listing the whole table when the entity has no status column at all', async () => {
        asMock(modelMock.getTable).mockReturnValue(tableWithoutLifecycleState as never);
        const service = createServiceTestInstance(AdminListableService, modelMock);

        const result = await service.adminList(mockAdminActor, adminQuery('ACTIVE'));

        expect(result.error?.code).toBe('VALIDATION_ERROR');
        expect(result.error?.message).toContain('status');
        expect(result.data).toBeUndefined();
        // Nothing was listed: the honest answer replaced the unfiltered page.
        expect(asMock(modelMock.findAll)).not.toHaveBeenCalled();
    });

    // -----------------------------------------------------------------------
    // The 500 branch: social_settings
    // -----------------------------------------------------------------------

    it('the 500 reproduction: with no deletedAt either, buildWhereClause throws on the lone unknown key', () => {
        expect(() =>
            buildWhereClause({ lifecycleState: 'ACTIVE' }, tableWithoutLifecycleStateOrDeletedAt)
        ).toThrow(/All 1 key\(s\) in where clause were unknown columns/);
    });

    it('answers 400 instead of 500 for a social_settings-shaped table', async () => {
        asMock(modelMock.getTable).mockReturnValue(tableWithoutLifecycleStateOrDeletedAt as never);
        // If a where ever reaches the model again, let the REAL helper decide —
        // a mocked findAll that swallows it would turn the 500 into a green test.
        asMock(modelMock.findAll).mockImplementation((where: unknown) => {
            buildWhereClause(
                where as Record<string, unknown>,
                tableWithoutLifecycleStateOrDeletedAt
            );
            return Promise.resolve(paginated);
        });
        const service = createServiceTestInstance(AdminListableService, modelMock);

        const result = await service.adminList(mockAdminActor, adminQuery('ACTIVE'));

        expect(result.error?.code).toBe('VALIDATION_ERROR');
        expect(result.error?.message).not.toContain('unknown columns');
        expect(asMock(modelMock.findAll)).not.toHaveBeenCalled();
    });

    // -----------------------------------------------------------------------
    // The three branches that must NOT change
    // -----------------------------------------------------------------------

    it("status: 'all' still touches nothing, so every endpoint that works today keeps working", async () => {
        asMock(modelMock.getTable).mockReturnValue(tableWithoutLifecycleStateOrDeletedAt as never);
        const service = createServiceTestInstance(AdminListableService, modelMock);

        const result = await service.adminList(mockAdminActor, adminQuery('all'));

        expect(result.error).toBeUndefined();
        const [where] = asMock(modelMock.findAll).mock.calls[0] ?? [];
        expect(where as Record<string, unknown>).not.toHaveProperty('lifecycleState');
        expect(where as Record<string, unknown>).not.toHaveProperty('status');
    });

    it('a table that HAS lifecycleState still filters on it', async () => {
        asMock(modelMock.getTable).mockReturnValue(tableWithLifecycleState as never);
        const service = createServiceTestInstance(AdminListableService, modelMock);

        const result = await service.adminList(mockAdminActor, adminQuery('ARCHIVED'));

        expect(result.error).toBeUndefined();
        const [where] = asMock(modelMock.findAll).mock.calls[0] ?? [];
        expect((where as Record<string, unknown>).lifecycleState).toBe('ARCHIVED');
        expect(
            constrainedColumns(where as Record<string, unknown>, tableWithLifecycleState)
        ).toContain('lifecycle_state');
    });

    it('a table whose own state column is named `status` filters on THAT column', async () => {
        asMock(modelMock.getTable).mockReturnValue(tableWithStatusColumn as never);
        const service = createServiceTestInstance(AdminListableService, modelMock);

        const result = await service.adminList(mockAdminActor, adminQuery('ACTIVE'));

        expect(result.error).toBeUndefined();
        const [where] = asMock(modelMock.findAll).mock.calls[0] ?? [];
        expect((where as Record<string, unknown>).status).toBe('ACTIVE');
        expect((where as Record<string, unknown>).lifecycleState).toBeUndefined();
        expect(constrainedColumns(where as Record<string, unknown>, tableWithStatusColumn)).toEqual(
            ['status', 'deleted_at']
        );
    });
});
