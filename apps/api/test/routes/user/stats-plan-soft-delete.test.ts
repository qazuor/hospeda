/**
 * HOS-755 — the "mi plan" widget on `/mi-cuenta/` must not report a
 * soft-deleted subscription.
 *
 * The global `apps/api` setup replaces `@repo/db` with a stub whose `eq`/`and`/
 * `isNull` are inert, so asserting on the query object there proves nothing
 * (`toHaveBeenCalledWith(table)` collapses to `toHaveBeenCalledWith(undefined)`).
 * This file therefore installs its OWN `@repo/db` mock whose operators are real
 * predicates and whose `select()` genuinely filters an in-memory dataset. A
 * missing `deleted_at IS NULL` really does let the soft-deleted row through,
 * so the assertions below fail against the pre-fix code rather than passing
 * vacuously.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

/** Row shape used by the in-memory tables. */
type Row = Record<string, unknown>;

/** A compiled WHERE predicate over a single row. */
type Predicate = (row: Row) => boolean;

const fixtures = vi.hoisted(() => ({
    customers: [] as Row[],
    subscriptions: [] as Row[]
}));

vi.mock('@repo/db', async () => {
    // Start from the shared stub so every OTHER `@repo/db` export the import
    // graph needs still resolves; only the handful this test drives is replaced.
    const { createDbMock } = await import('../../helpers/mocks/db-mock');
    const base = createDbMock() as Record<string, unknown>;

    /** Column markers double as the row key they filter on. */
    const billingCustomers = {
        id: 'id',
        externalId: 'externalId',
        deletedAt: 'deletedAt'
    } as const;

    const billingSubscriptions = {
        id: 'id',
        customerId: 'customerId',
        status: 'status',
        planId: 'planId',
        createdAt: 'createdAt',
        deletedAt: 'deletedAt'
    } as const;

    const eq =
        (column: string, value: unknown): Predicate =>
        (row) =>
            row[column] === value;

    const inArray =
        (column: string, values: readonly unknown[]): Predicate =>
        (row) =>
            values.includes(row[column]);

    const isNull =
        (column: string): Predicate =>
        (row) =>
            row[column] === null || row[column] === undefined;

    const and =
        (...predicates: readonly Predicate[]): Predicate =>
        (row) =>
            predicates.every((predicate) => predicate(row));

    const desc = (column: string) => ({ column, direction: 'desc' as const });

    /**
     * Minimal Drizzle-shaped builder: `.from().where().orderBy().limit()`.
     * `limit()` resolves to the filtered rows, so `await ... .limit(1)` works.
     */
    const createBuilder = () => {
        let rows: Row[] = [];

        const builder = {
            from(table: unknown) {
                rows =
                    table === billingCustomers
                        ? [...fixtures.customers]
                        : [...fixtures.subscriptions];
                return builder;
            },
            where(predicate: Predicate) {
                rows = rows.filter(predicate);
                return builder;
            },
            orderBy(order: { column: string; direction: 'desc' }) {
                rows = [...rows].sort((left, right) =>
                    String(right[order.column]).localeCompare(String(left[order.column]))
                );
                return builder;
            },
            limit(count: number) {
                return Promise.resolve(rows.slice(0, count));
            }
        };

        return builder;
    };

    return {
        ...base,
        billingCustomers,
        billingSubscriptions,
        and,
        eq,
        inArray,
        isNull,
        desc,
        getDb: () => ({ select: () => createBuilder() })
    };
});

vi.mock('../../../src/services/plan.service.js', () => ({
    /** Always NOT_FOUND so the resolved name deterministically falls back to `planId`. */
    PlanService: class {
        async getById() {
            return { success: false, error: { code: 'NOT_FOUND', message: 'not found' } };
        }
        async getBySlug() {
            return { success: false, error: { code: 'NOT_FOUND', message: 'not found' } };
        }
    }
}));

const { resolveUserPlanSummary } = await import('../../../src/routes/user/protected/stats.js');

const USER_ID = 'user-hos-755';
const CUSTOMER_ID = 'cus-hos-755';

/** A live billing customer for {@link USER_ID}. */
const liveCustomer: Row = {
    id: CUSTOMER_ID,
    externalId: USER_ID,
    deletedAt: null
};

describe('HOS-755 — resolveUserPlanSummary excludes soft-deleted billing rows', () => {
    beforeEach(() => {
        fixtures.customers = [];
        fixtures.subscriptions = [];
    });

    it('returns the plan for a live entitlement-granting subscription (control)', async () => {
        fixtures.customers = [liveCustomer];
        fixtures.subscriptions = [
            {
                id: 'sub-live',
                customerId: CUSTOMER_ID,
                status: 'active',
                planId: 'plan-owner-premium',
                createdAt: '2026-08-01T00:00:00.000Z',
                deletedAt: null
            }
        ];

        const result = await resolveUserPlanSummary({ userId: USER_ID });

        expect(result).toEqual({ plan: { name: 'plan-owner-premium', status: 'active' } });
    });

    it('returns no plan when the only subscription is soft-deleted', async () => {
        fixtures.customers = [liveCustomer];
        fixtures.subscriptions = [
            {
                id: 'sub-soft-deleted',
                customerId: CUSTOMER_ID,
                // A soft-deleted row keeps its status forever — the status
                // filter alone never excludes it.
                status: 'active',
                planId: 'plan-owner-premium',
                createdAt: '2026-08-01T00:00:00.000Z',
                deletedAt: '2026-08-16T12:00:00.000Z'
            }
        ];

        const result = await resolveUserPlanSummary({ userId: USER_ID });

        expect(result).toEqual({ plan: null });
    });

    it('returns no plan when a comped subscription is soft-deleted', async () => {
        fixtures.customers = [liveCustomer];
        fixtures.subscriptions = [
            {
                id: 'sub-comp-deleted',
                customerId: CUSTOMER_ID,
                status: 'comp',
                planId: 'plan-owner-premium',
                createdAt: '2026-08-01T00:00:00.000Z',
                deletedAt: '2026-08-16T12:00:00.000Z'
            }
        ];

        const result = await resolveUserPlanSummary({ userId: USER_ID });

        expect(result).toEqual({ plan: null });
    });

    it('picks the live subscription over a newer soft-deleted one', async () => {
        fixtures.customers = [liveCustomer];
        fixtures.subscriptions = [
            {
                id: 'sub-live-older',
                customerId: CUSTOMER_ID,
                status: 'active',
                planId: 'plan-owner-basico',
                createdAt: '2026-07-01T00:00:00.000Z',
                deletedAt: null
            },
            {
                id: 'sub-deleted-newer',
                customerId: CUSTOMER_ID,
                status: 'active',
                planId: 'plan-owner-premium',
                createdAt: '2026-08-01T00:00:00.000Z',
                deletedAt: '2026-08-16T12:00:00.000Z'
            }
        ];

        const result = await resolveUserPlanSummary({ userId: USER_ID });

        expect(result).toEqual({ plan: { name: 'plan-owner-basico', status: 'active' } });
    });

    it('returns no plan when the billing customer itself is soft-deleted', async () => {
        fixtures.customers = [
            { id: CUSTOMER_ID, externalId: USER_ID, deletedAt: '2026-08-16T12:00:00.000Z' }
        ];
        fixtures.subscriptions = [
            {
                id: 'sub-orphaned',
                customerId: CUSTOMER_ID,
                status: 'active',
                planId: 'plan-owner-premium',
                createdAt: '2026-08-01T00:00:00.000Z',
                deletedAt: null
            }
        ];

        const result = await resolveUserPlanSummary({ userId: USER_ID });

        expect(result).toEqual({ plan: null });
    });

    it('prefers the live customer row over a soft-deleted duplicate (external_id is not UNIQUE)', async () => {
        fixtures.customers = [
            { id: 'cus-stale', externalId: USER_ID, deletedAt: '2026-08-16T12:00:00.000Z' },
            liveCustomer
        ];
        fixtures.subscriptions = [
            {
                id: 'sub-stale',
                customerId: 'cus-stale',
                status: 'active',
                planId: 'plan-owner-premium',
                createdAt: '2026-08-01T00:00:00.000Z',
                deletedAt: null
            },
            {
                id: 'sub-live',
                customerId: CUSTOMER_ID,
                status: 'active',
                planId: 'plan-owner-basico',
                createdAt: '2026-07-01T00:00:00.000Z',
                deletedAt: null
            }
        ];

        const result = await resolveUserPlanSummary({ userId: USER_ID });

        expect(result).toEqual({ plan: { name: 'plan-owner-basico', status: 'active' } });
    });
});
