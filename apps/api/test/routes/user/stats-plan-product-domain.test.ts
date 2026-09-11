/**
 * HOS-1066 — the "mi suscripción" widget on `/mi-cuenta/` must not surface a
 * subscription from an arbitrary product domain when the account holds more
 * than one.
 *
 * Before this fix, `resolveUserPlanSummary` picked the single most-recently
 * created entitlement-granting subscription regardless of vertical
 * (`orderBy(desc(createdAt)).limit(1)`), while `GET /users/me/subscription`
 * (the "Ver mi suscripción" link on the same card) filters by
 * `subscriptionMatchesDomain`. A host who ALSO holds a gastronomy/experience/
 * partner subscription could therefore see one vertical's plan on the card
 * while the link took them to a different vertical's subscription page.
 *
 * The global `apps/api` setup replaces `@repo/db` with a stub whose `eq`/`and`/
 * `isNull` are inert, so asserting on the query object there proves nothing.
 * This file installs its OWN `@repo/db` mock (mirroring
 * `stats-plan-soft-delete.test.ts`) whose operators are real predicates and
 * whose `select()` genuinely filters/orders an in-memory dataset — including
 * a real `productDomain` column, unlike the HOS-755 file's fixtures.
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
        productDomain: 'productDomain',
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
     * Minimal Drizzle-shaped builder: `.from().where().orderBy().limit()`,
     * AND directly awaitable after `.orderBy()` (real Drizzle query builders
     * are thenable) since `resolveUserPlanSummary` no longer calls `.limit()`
     * on the subscriptions query — it needs every domain's subscription, not
     * just the newest one overall.
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
            },
            // biome-ignore lint/suspicious/noThenProperty: intentional thenable — mirrors Drizzle's own awaitable query builder so the production code under test can `await` this mock without a trailing `.limit()`.
            then(onFulfilled: (rows: Row[]) => unknown, onRejected?: (reason: unknown) => unknown) {
                return Promise.resolve(rows).then(onFulfilled, onRejected);
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

const USER_ID = 'user-hos-1066';
const CUSTOMER_ID = 'cus-hos-1066';

/** A live billing customer for {@link USER_ID}. */
const liveCustomer: Row = {
    id: CUSTOMER_ID,
    externalId: USER_ID,
    deletedAt: null
};

describe('HOS-1066 — resolveUserPlanSummary groups active subscriptions by product domain', () => {
    beforeEach(() => {
        fixtures.customers = [];
        fixtures.subscriptions = [];
    });

    it('reports a single plan when only one domain (accommodation, legacy null productDomain) is active (control)', async () => {
        fixtures.customers = [liveCustomer];
        fixtures.subscriptions = [
            {
                id: 'sub-accommodation',
                customerId: CUSTOMER_ID,
                status: 'active',
                planId: 'plan-owner-premium',
                productDomain: null,
                createdAt: '2026-08-01T00:00:00.000Z',
                deletedAt: null
            }
        ];

        const result = await resolveUserPlanSummary({ userId: USER_ID });

        expect(result).toEqual({
            plan: { name: 'plan-owner-premium', status: 'active' },
            activeSubscriptionsCount: 1
        });
    });

    it('distinguishes two active subscriptions in different domains instead of surfacing only the newest one', async () => {
        fixtures.customers = [liveCustomer];
        fixtures.subscriptions = [
            {
                // Older, accommodation.
                id: 'sub-accommodation',
                customerId: CUSTOMER_ID,
                status: 'active',
                planId: 'plan-owner-premium',
                productDomain: null,
                createdAt: '2026-07-01T00:00:00.000Z',
                deletedAt: null
            },
            {
                // Newer, gastronomy. Pre-fix `orderBy(desc(createdAt)).limit(1)`
                // would have picked THIS one and reported it as "the" plan,
                // hiding the accommodation subscription entirely.
                id: 'sub-gastronomy',
                customerId: CUSTOMER_ID,
                status: 'active',
                planId: 'plan-gastronomy-premium',
                productDomain: 'gastronomy',
                createdAt: '2026-08-01T00:00:00.000Z',
                deletedAt: null
            }
        ];

        const result = await resolveUserPlanSummary({ userId: USER_ID });

        // The response must distinguish "two active verticals" from "one
        // plan" — it must NOT silently report the gastronomy plan (or any
        // single plan) as if it were the account's only subscription.
        expect(result.activeSubscriptionsCount).toBe(2);
        expect(result.plan).toBeNull();
    });

    it('counts three domains independently (accommodation + gastronomy + experience)', async () => {
        fixtures.customers = [liveCustomer];
        fixtures.subscriptions = [
            {
                id: 'sub-accommodation',
                customerId: CUSTOMER_ID,
                status: 'trialing',
                planId: 'plan-owner-basico',
                productDomain: 'accommodation',
                createdAt: '2026-06-01T00:00:00.000Z',
                deletedAt: null
            },
            {
                id: 'sub-gastronomy',
                customerId: CUSTOMER_ID,
                status: 'active',
                planId: 'plan-gastronomy-premium',
                productDomain: 'gastronomy',
                createdAt: '2026-07-01T00:00:00.000Z',
                deletedAt: null
            },
            {
                id: 'sub-experience',
                customerId: CUSTOMER_ID,
                status: 'comp',
                planId: 'plan-experience-basico',
                productDomain: 'experience',
                createdAt: '2026-08-01T00:00:00.000Z',
                deletedAt: null
            }
        ];

        const result = await resolveUserPlanSummary({ userId: USER_ID });

        expect(result).toEqual({ plan: null, activeSubscriptionsCount: 3 });
    });

    it('ignores a dark legacy-`commerce`-domain subscription so a single accommodation subscription still resolves to one plan', async () => {
        fixtures.customers = [liveCustomer];
        fixtures.subscriptions = [
            {
                id: 'sub-accommodation',
                customerId: CUSTOMER_ID,
                status: 'active',
                planId: 'plan-owner-premium',
                productDomain: 'accommodation',
                createdAt: '2026-08-01T00:00:00.000Z',
                deletedAt: null
            },
            {
                // Retired vocabulary value (HOS-695): matches neither
                // 'gastronomy' nor 'experience' — must not be counted.
                id: 'sub-commerce-legacy',
                customerId: CUSTOMER_ID,
                status: 'active',
                planId: 'plan-commerce-legacy',
                productDomain: 'commerce',
                createdAt: '2026-08-02T00:00:00.000Z',
                deletedAt: null
            }
        ];

        const result = await resolveUserPlanSummary({ userId: USER_ID });

        expect(result).toEqual({
            plan: { name: 'plan-owner-premium', status: 'active' },
            activeSubscriptionsCount: 1
        });
    });

    it('reports no plan and a zero count when the customer has no live subscription', async () => {
        fixtures.customers = [liveCustomer];
        fixtures.subscriptions = [];

        const result = await resolveUserPlanSummary({ userId: USER_ID });

        expect(result).toEqual({ plan: null, activeSubscriptionsCount: 0 });
    });
});

describe('HOS-847 — a recurring add-on subscription must not count as a second vertical', () => {
    beforeEach(() => {
        fixtures.customers = [];
        fixtures.subscriptions = [];
    });

    it('still reports the single accommodation plan when the customer also holds an active add-on subscription', async () => {
        fixtures.customers = [liveCustomer];
        fixtures.subscriptions = [
            {
                id: 'sub-accommodation',
                customerId: CUSTOMER_ID,
                status: 'active',
                planId: 'plan-owner-premium',
                productDomain: 'accommodation',
                createdAt: '2026-08-01T00:00:00.000Z',
                deletedAt: null
            },
            {
                // A recurring add-on's OWN MercadoPago preapproval row
                // (HOS-847) — never the customer's real plan. Before the
                // fix, ALL_PRODUCT_DOMAINS = Object.values(ProductDomainEnum)
                // absorbed 'addon' as a 5th bucket, so this pushed
                // activeSubscriptionsCount from 1 to 2 and the widget lost
                // the accommodation plan name entirely.
                id: 'sub-addon',
                customerId: CUSTOMER_ID,
                status: 'active',
                planId: 'plan-addon-extra-photos',
                productDomain: 'addon',
                createdAt: '2026-08-02T00:00:00.000Z',
                deletedAt: null
            }
        ];

        const result = await resolveUserPlanSummary({ userId: USER_ID });

        expect(result).toEqual({
            plan: { name: 'plan-owner-premium', status: 'active' },
            activeSubscriptionsCount: 1
        });
    });

    it('still reports the summary case (no single plan) for two real verticals, unaffected by the add-on fix', async () => {
        fixtures.customers = [liveCustomer];
        fixtures.subscriptions = [
            {
                id: 'sub-accommodation',
                customerId: CUSTOMER_ID,
                status: 'active',
                planId: 'plan-owner-premium',
                productDomain: 'accommodation',
                createdAt: '2026-08-01T00:00:00.000Z',
                deletedAt: null
            },
            {
                id: 'sub-gastronomy',
                customerId: CUSTOMER_ID,
                status: 'active',
                planId: 'plan-gastronomy-premium',
                productDomain: 'gastronomy',
                createdAt: '2026-08-02T00:00:00.000Z',
                deletedAt: null
            }
        ];

        const result = await resolveUserPlanSummary({ userId: USER_ID });

        expect(result.activeSubscriptionsCount).toBe(2);
        expect(result.plan).toBeNull();
    });
});
