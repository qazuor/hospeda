/**
 * HOS-847 — abandoned-pending-subs.job.ts must exclude a recurring add-on's
 * own MercadoPago preapproval row from BOTH the dry-run count query and the
 * real candidate query.
 *
 * Abandoning a stale add-on checkout is legitimate on its own, but sending
 * the customer a "your subscription was cancelled" email (the notification
 * loop later in this job) for an unrelated add-on is not — the reader would
 * read it as their real plan being gone.
 *
 * This file mocks BOTH `drizzle-orm` (the job imports and/eq/inArray/isNull/lt
 * directly from there) and `@repo/db` (getDb/withTransaction/schema markers)
 * with plain object markers, so the WHERE condition handed to the DB is a
 * plain, inspectable object — same technique as
 * `preapproval-less-expiry-addon-domain.test.ts`. `dryRun: true` reaches the
 * count-only branch, so no candidate-processing mocks are needed.
 *
 * @module test/cron/abandoned-pending-subs-addon-domain
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockGetDb, mockSelectWhere, marker } = vi.hoisted(() => ({
    mockGetDb: vi.fn(),
    mockSelectWhere: vi.fn(),
    marker:
        (tag: string) =>
        (...args: unknown[]) => ({ [tag]: args })
}));

vi.mock('drizzle-orm', () => ({
    and: marker('_and'),
    eq: marker('_eq'),
    inArray: marker('_inArray'),
    isNull: marker('_isNull'),
    lt: marker('_lt'),
    ne: marker('_ne'),
    or: marker('_or')
}));

vi.mock('@repo/db', () => ({
    // HOS-847: excludeAddonDomainCondition() (from @repo/service-core,
    // unmocked) imports its drizzle operators from '@repo/db', not
    // 'drizzle-orm' — a SEPARATE path from this job's own direct
    // 'drizzle-orm' import (mocked above). Both need markers.
    and: marker('_and'),
    eq: marker('_eq'),
    inArray: marker('_inArray'),
    isNull: marker('_isNull'),
    ne: marker('_ne'),
    or: marker('_or'),
    getDb: mockGetDb,
    withTransaction: vi.fn(async (cb: (tx: unknown) => Promise<unknown>) => {
        const tx = {
            execute: vi.fn().mockResolvedValue({ rows: [{ acquired: true }] }),
            select: vi.fn().mockReturnValue({
                from: vi.fn().mockReturnValue({ where: mockSelectWhere })
            })
        };
        return cb(tx);
    }),
    billingSubscriptions: {
        id: 'ID',
        status: 'STATUS',
        customerId: 'CUSTOMER_ID',
        planId: 'PLAN_ID',
        mpSubscriptionId: 'MP_SUBSCRIPTION_ID',
        createdAt: 'CREATED_AT',
        deletedAt: 'DELETED_AT',
        productDomain: 'PRODUCT_DOMAIN'
    },
    billingPendingCheckoutModel: {
        findByLocalSubscriptionId: vi.fn(),
        findUnlinkedChargeByLocalSubscriptionId: vi.fn()
    },
    sql: (strings: TemplateStringsArray, ...values: unknown[]) => ({ strings, values })
}));

vi.mock('@repo/billing', async (importOriginal) => {
    const actual = await importOriginal<Record<string, unknown>>();
    return { ...actual, createMercadoPagoAdapter: vi.fn() };
});

vi.mock('@repo/service-core', async (importOriginal) => {
    const actual = await importOriginal<Record<string, unknown>>();
    return { ...actual };
});

vi.mock('@sentry/node', () => ({ captureException: vi.fn() }));

vi.mock('../../src/middlewares/billing.js', () => ({
    getQZPayBilling: vi.fn(() => ({
        customers: { get: vi.fn() },
        plans: { get: vi.fn() },
        subscriptions: { cancel: vi.fn() }
    }))
}));

vi.mock('../../src/services/billing/plan-change-reason.js', () => ({
    planDisplayNameFromPlan: vi.fn(() => 'Plan')
}));

vi.mock('../../src/services/billing/reactivation-supersession-complete.js', () => ({
    CONFIRMED_TERMINAL_STATUSES: ['cancelled', 'abandoned', 'expired']
}));

vi.mock('../../src/services/partner-reconcile.service.js', () => ({
    reconcilePartnerForSubscription: vi.fn().mockResolvedValue(undefined)
}));

vi.mock('../../src/services/subscription-linked-entities.service.js', () => ({
    reconcileSubscriptionLinkedEntities: vi.fn().mockResolvedValue(undefined)
}));

vi.mock('../../src/utils/notification-helper.js', () => ({
    sendNotification: vi.fn().mockResolvedValue(undefined)
}));

vi.mock('../../src/lib/qzpay-logger.js', () => ({
    qzpayLogger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }
}));

import { abandonedPendingSubsJob } from '../../src/cron/jobs/abandoned-pending-subs.job.js';

function buildCronCtx() {
    return {
        logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
        startedAt: new Date('2026-09-04T06:00:00Z'),
        dryRun: true
    } as unknown as Parameters<typeof abandonedPendingSubsJob.handler>[0];
}

describe('abandonedPendingSubsJob — excludes a recurring add-on row (HOS-847)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockSelectWhere.mockResolvedValue([]);
        mockGetDb.mockReturnValue({});
    });

    it('includes OR(productDomain IS NULL, productDomain != addon) in the dry-run WHERE clause', async () => {
        await abandonedPendingSubsJob.handler(buildCronCtx());

        expect(mockSelectWhere).toHaveBeenCalledOnce();
        const condition = mockSelectWhere.mock.calls[0]?.[0] as {
            _and: Array<{ _or?: unknown[] }>;
        };
        const excludeAddon = condition._and.find((c): c is { _or: unknown[] } =>
            Array.isArray(c._or)
        );

        expect(excludeAddon).toBeDefined();
        expect(excludeAddon?._or).toContainEqual({ _ne: ['PRODUCT_DOMAIN', 'addon'] });
        expect(excludeAddon?._or).toContainEqual({ _isNull: ['PRODUCT_DOMAIN'] });
    });

    it('includes the same exclusion in the real (non-dry-run) candidate WHERE clause', async () => {
        const ctx = buildCronCtx();
        (ctx as { dryRun: boolean }).dryRun = false;

        await abandonedPendingSubsJob.handler(ctx);

        expect(mockSelectWhere).toHaveBeenCalledOnce();
        const condition = mockSelectWhere.mock.calls[0]?.[0] as {
            _and: Array<{ _or?: unknown[] }>;
        };
        const excludeAddon = condition._and.find((c): c is { _or: unknown[] } =>
            Array.isArray(c._or)
        );

        expect(excludeAddon).toBeDefined();
        expect(excludeAddon?._or).toContainEqual({ _ne: ['PRODUCT_DOMAIN', 'addon'] });
        expect(excludeAddon?._or).toContainEqual({ _isNull: ['PRODUCT_DOMAIN'] });
    });
});
