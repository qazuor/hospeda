/**
 * HOS-847 — preapproval-less-expiry.job.ts must exclude a recurring add-on's
 * own MercadoPago preapproval row from the candidate sweep.
 *
 * `mp_subscription_id IS NULL` briefly describes an add-on row too, between
 * its checkout creating the local purchase and the webhook that links the
 * preapproval (PR 5 of the HOS-847 chain). Without the domain exclusion this
 * job would expire that row mid-activation.
 *
 * This file uses fully-mocked drizzle operators (plain object markers, not
 * the real `drizzle-orm` builders) so the WHERE condition handed to the DB is
 * a plain, inspectable object — the same technique used in
 * `subscription-poll.job.test.ts`'s HOS-847 test. The candidate SELECT
 * resolves an empty array, so the job short-circuits before any downstream
 * reap logic (audit event, transaction, etc.) needs mocking — this file only
 * proves the WHERE clause itself excludes add-on rows.
 *
 * @module test/cron/preapproval-less-expiry-addon-domain
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockGetDb, mockSelectWhere } = vi.hoisted(() => ({
    mockGetDb: vi.fn(),
    mockSelectWhere: vi.fn()
}));

vi.mock('@repo/db', () => ({
    getDb: mockGetDb,
    billingSubscriptionEvents: { id: 'ID' },
    billingSubscriptions: {
        id: 'ID',
        customerId: 'CUSTOMER_ID',
        status: 'STATUS',
        mpSubscriptionId: 'MP_SUBSCRIPTION_ID',
        currentPeriodEnd: 'CURRENT_PERIOD_END',
        cancelAtPeriodEnd: 'CANCEL_AT_PERIOD_END',
        deletedAt: 'DELETED_AT',
        productDomain: 'PRODUCT_DOMAIN'
    },
    and: (...args: unknown[]) => ({ _and: args }),
    eq: (a: unknown, b: unknown) => ({ _eq: [a, b] }),
    inArray: (a: unknown, values: unknown[]) => ({ _inArray: [a, values] }),
    isNull: (a: unknown) => ({ _isNull: a }),
    ne: (a: unknown, b: unknown) => ({ _ne: [a, b] }),
    or: (...args: unknown[]) => ({ _or: args })
}));

vi.mock('drizzle-orm', async (importOriginal) => {
    const actual = await importOriginal<typeof import('drizzle-orm')>();
    return { ...actual, lt: (a: unknown, b: unknown) => ({ _lt: [a, b] }) };
});

vi.mock('../../src/middlewares/entitlement.js', () => ({
    clearEntitlementCache: vi.fn()
}));

vi.mock('../../src/services/subscription-linked-entities.service.js', () => ({
    reconcileSubscriptionLinkedEntities: vi.fn().mockResolvedValue(undefined)
}));

vi.mock('../../src/utils/logger.js', () => ({
    apiLogger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }
}));

import { preapprovalLessExpiryJob } from '../../src/cron/jobs/preapproval-less-expiry.job.js';

function buildCronCtx() {
    return {
        logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
        startedAt: new Date('2026-09-04T06:00:00Z'),
        dryRun: true
    } as unknown as Parameters<typeof preapprovalLessExpiryJob.handler>[0];
}

describe('preapprovalLessExpiryJob — excludes a recurring add-on row (HOS-847)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockSelectWhere.mockReturnValue({ limit: vi.fn().mockResolvedValue([]) });
        mockGetDb.mockReturnValue({
            select: vi.fn().mockReturnValue({
                from: vi.fn().mockReturnValue({ where: mockSelectWhere })
            })
        });
    });

    it('includes OR(productDomain IS NULL, productDomain != addon) in the candidate WHERE clause', async () => {
        await preapprovalLessExpiryJob.handler(buildCronCtx());

        expect(mockSelectWhere).toHaveBeenCalledOnce();
        const condition = mockSelectWhere.mock.calls[0]?.[0] as {
            _and: Array<{ _or?: unknown[] }>;
        };
        const excludeAddon = condition._and.find((c): c is { _or: unknown[] } =>
            Array.isArray(c._or)
        );

        expect(excludeAddon).toBeDefined();
        expect(excludeAddon?._or).toContainEqual({ _ne: ['PRODUCT_DOMAIN', 'addon'] });
        expect(excludeAddon?._or).toContainEqual({ _isNull: 'PRODUCT_DOMAIN' });
    });
});
