/**
 * HOS-777 — `checkEligibility()` must ignore soft-deleted billing rows.
 *
 * `apps/api` globally mocks `@repo/db`, so query-shape assertions are vacuous.
 * This file installs a dedicated in-memory DB mock whose `eq`/`and`/`isNull`
 * predicates really filter rows, following the same pattern as HOS-755.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

type Row = Record<string, unknown>;
type Predicate = (row: Row) => boolean;

const fixtures = vi.hoisted(() => ({
    customers: [] as Row[],
    subscriptions: [] as Row[]
}));

const mocks = vi.hoisted(() => ({
    isOwnerCategorySubscription: vi.fn()
}));

vi.mock('@repo/db', async () => {
    const { createDbMock } = await import('../helpers/mocks/db-mock');
    const base = createDbMock() as Record<string, unknown>;

    const billingCustomers = {
        id: 'id',
        externalId: 'externalId',
        createdAt: 'createdAt',
        deletedAt: 'deletedAt'
    } as const;

    const billingSubscriptions = {
        id: 'id',
        customerId: 'customerId',
        status: 'status',
        planId: 'planId',
        productDomain: 'productDomain',
        trialEnd: 'trialEnd',
        currentPeriodEnd: 'currentPeriodEnd',
        createdAt: 'createdAt',
        deletedAt: 'deletedAt'
    } as const;

    const eq =
        (column: string, value: unknown): Predicate =>
        (row) =>
            row[column] === value;

    const isNull =
        (column: string): Predicate =>
        (row) =>
            row[column] === null || row[column] === undefined;

    const and =
        (...predicates: readonly Predicate[]): Predicate =>
        (row) =>
            predicates.every((predicate) => predicate(row));

    const desc = (column: string) => ({ column, direction: 'desc' as const });

    const compareValues = (left: unknown, right: unknown) => {
        if (left instanceof Date && right instanceof Date) {
            return left.getTime() - right.getTime();
        }
        if (typeof left === 'number' && typeof right === 'number') {
            return left - right;
        }
        return String(left ?? '').localeCompare(String(right ?? ''));
    };

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
            orderBy(...orders: ReadonlyArray<{ column: string; direction: 'desc' }>) {
                rows = [...rows].sort((left, right) => {
                    for (const order of orders) {
                        const comparison = compareValues(left[order.column], right[order.column]);
                        if (comparison !== 0) {
                            return order.direction === 'desc' ? -comparison : comparison;
                        }
                    }
                    return 0;
                });
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
        and,
        billingCustomers,
        billingSubscriptions,
        desc,
        eq,
        getDb: () => ({ select: () => createBuilder() }),
        isNull
    };
});

vi.mock('@repo/service-core', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@repo/service-core')>();
    return {
        ...actual,
        isOwnerCategorySubscription: mocks.isOwnerCategorySubscription
    };
});

import { buildAccommodationPublishDeps } from '../../src/services/accommodation-publish-deps';

const OWNER_ID = 'owner-hos-777';
const LIVE_CUSTOMER_ID = 'cus-live';

const liveCustomer: Row = {
    id: LIVE_CUSTOMER_ID,
    externalId: OWNER_ID,
    createdAt: new Date('2026-08-20T12:00:00.000Z'),
    deletedAt: null
};

const liveOwnerSubscription: Row = {
    id: 'sub-live',
    customerId: LIVE_CUSTOMER_ID,
    status: 'active',
    planId: 'plan-owner-premium',
    productDomain: 'accommodation',
    trialEnd: null,
    currentPeriodEnd: new Date('2030-01-01T00:00:00.000Z'),
    createdAt: new Date('2026-08-21T12:00:00.000Z'),
    deletedAt: null
};

describe('HOS-777 — buildAccommodationPublishDeps.checkEligibility ignores soft-deleted billing rows', () => {
    beforeEach(() => {
        fixtures.customers = [];
        fixtures.subscriptions = [];
        mocks.isOwnerCategorySubscription.mockReset();
        mocks.isOwnerCategorySubscription.mockResolvedValue(true);
    });

    it('returns first_publish when the only active-looking subscription is soft-deleted', async () => {
        fixtures.customers = [liveCustomer];
        fixtures.subscriptions = [
            {
                ...liveOwnerSubscription,
                id: 'sub-soft-deleted',
                deletedAt: new Date('2026-08-22T12:00:00.000Z')
            }
        ];

        const result = await buildAccommodationPublishDeps().checkEligibility(OWNER_ID);

        expect(result).toBe('first_publish');
    });

    it('returns first_publish when a soft-deleted duplicate customer would otherwise win the limit(1)', async () => {
        fixtures.customers = [
            {
                id: 'cus-stale',
                externalId: OWNER_ID,
                createdAt: new Date('2026-08-19T12:00:00.000Z'),
                deletedAt: new Date('2026-08-22T12:00:00.000Z')
            },
            liveCustomer
        ];
        fixtures.subscriptions = [
            {
                ...liveOwnerSubscription,
                id: 'sub-stale',
                customerId: 'cus-stale'
            }
        ];

        const result = await buildAccommodationPublishDeps().checkEligibility(OWNER_ID);

        expect(result).toBe('first_publish');
    });

    it('returns first_publish when the live customer only has soft-deleted subscriptions', async () => {
        fixtures.customers = [liveCustomer];
        fixtures.subscriptions = [
            {
                ...liveOwnerSubscription,
                id: 'sub-deleted-newer',
                createdAt: new Date('2026-08-21T12:00:00.000Z'),
                deletedAt: new Date('2026-08-22T12:00:00.000Z')
            },
            {
                ...liveOwnerSubscription,
                id: 'sub-deleted-older',
                createdAt: new Date('2026-08-18T12:00:00.000Z'),
                deletedAt: new Date('2026-08-19T12:00:00.000Z')
            }
        ];

        const result = await buildAccommodationPublishDeps().checkEligibility(OWNER_ID);

        expect(result).toBe('first_publish');
    });

    it('keeps returning has_active_sub for a live active owner subscription (control)', async () => {
        fixtures.customers = [liveCustomer];
        fixtures.subscriptions = [liveOwnerSubscription];

        const result = await buildAccommodationPublishDeps().checkEligibility(OWNER_ID);

        expect(result).toBe('has_active_sub');
    });

    it('deterministically prefers the newest live customer row when external_id has live duplicates', async () => {
        fixtures.customers = [
            {
                id: 'cus-older-live',
                externalId: OWNER_ID,
                createdAt: new Date('2026-08-18T12:00:00.000Z'),
                deletedAt: null
            },
            liveCustomer
        ];
        fixtures.subscriptions = [liveOwnerSubscription];

        const result = await buildAccommodationPublishDeps().checkEligibility(OWNER_ID);

        expect(result).toBe('has_active_sub');
    });
});
