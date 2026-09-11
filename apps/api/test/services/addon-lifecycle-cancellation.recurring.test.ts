/**
 * `handleSubscriptionCancellationAddons` and a recurring add-on's own
 * preapproval (HOS-847 PR 6).
 *
 * This is the path a cancelled PLAN takes — the MercadoPago webhook and the
 * `finalize-cancelled-subs` cron both enter through this one function. Each of
 * the customer's add-ons carries a preapproval of its own that the plan's
 * cancellation does nothing to, so without the close here a customer who
 * cancelled their subscription keeps being charged monthly for add-ons the
 * platform has already marked `canceled`.
 *
 * ## Two behaviours asserted that the existing suite could not see
 *
 * 1. A refused close is routed into the SAME failure machinery as a refused
 *    revocation — row left `active`, retry metadata bumped, function rethrows so
 *    the webhook answers 500 and MercadoPago redelivers.
 * 2. `HOSPEDA_ADDON_LIFECYCLE_ENABLED = false` no longer means "do nothing". It
 *    gates the entitlement half only; the provider close runs regardless,
 *    because a preapproval outlives the flag that created it and an unclosed one
 *    keeps taking money.
 *
 * @module test/services/addon-lifecycle-cancellation.recurring
 */

import type { QZPayBilling } from '@qazuor/qzpay-core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { mockCatalogGetBySlug, mockClose, mockRevoke, envStub } = vi.hoisted(() => ({
    mockCatalogGetBySlug: vi.fn(),
    mockClose: vi.fn(),
    mockRevoke: vi.fn(),
    envStub: { HOSPEDA_ADDON_LIFECYCLE_ENABLED: true }
}));

vi.mock('@repo/service-core', () => ({
    AddonCatalogService: vi.fn().mockImplementation(function () {
        return { getBySlug: mockCatalogGetBySlug, list: vi.fn() };
    }),
    PlanService: vi.fn().mockImplementation(function () {
        return { getById: vi.fn(), getBySlug: vi.fn() };
    }),
    BILLING_EVENT_TYPES: { ADDON_REVOCATION_FAILED: 'ADDON_REVOCATION_FAILED' }
}));

vi.mock('@repo/db', () => ({
    withTransaction: vi.fn(
        async (callback: (tx: unknown) => Promise<unknown>, existingTx?: unknown) =>
            callback(existingTx)
    ),
    billingSubscriptionEvents: {
        subscriptionId: 'subscription_id',
        eventType: 'event_type',
        triggerSource: 'trigger_source',
        metadata: 'metadata'
    }
}));

vi.mock('@repo/db/schemas/billing', () => ({
    billingAddonPurchases: {
        id: 'id',
        customerId: 'customer_id',
        subscriptionId: 'subscription_id',
        addonSlug: 'addon_slug',
        status: 'status',
        mpSubscriptionId: 'mp_subscription_id',
        canceledAt: 'canceled_at',
        deletedAt: 'deleted_at',
        metadata: 'metadata',
        updatedAt: 'updated_at'
    }
}));

vi.mock('../../src/middlewares/entitlement', () => ({ clearEntitlementCache: vi.fn() }));

vi.mock('../../src/utils/logger', () => ({
    apiLogger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }
}));

vi.mock('../../src/utils/env', () => ({ env: envStub }));

vi.mock('../../src/services/addon-lifecycle.service', async (importOriginal) => ({
    ...(await importOriginal<typeof import('../../src/services/addon-lifecycle.service')>()),
    revokeAddonForSubscriptionCancellation: mockRevoke
}));

vi.mock('../../src/services/addon-preapproval-cancel', () => ({
    closeAddonPreapproval: mockClose
}));

vi.mock('@sentry/node', () => ({ captureException: vi.fn() }));

import { handleSubscriptionCancellationAddons } from '../../src/services/addon-lifecycle-cancellation.service.js';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const SUBSCRIPTION_ID = 'sub_plan_hos847';
const CUSTOMER_ID = 'cus_hos847';
const PREAPPROVAL_ID = 'preapproval-of-the-addon';

/** A recurring add-on: it has a preapproval that the plan's cancel does not touch. */
const RECURRING_PURCHASE = {
    id: 'purch_rec_0001-0002-0003-0004-000000000001',
    addonSlug: 'extra-accommodations-20',
    subscriptionId: SUBSCRIPTION_ID,
    customerId: CUSTOMER_ID,
    status: 'active' as const,
    mpSubscriptionId: PREAPPROVAL_ID,
    metadata: {},
    deletedAt: null
};

/**
 * Minimal Drizzle fluent-builder stub. `select().from().where()` resolves the
 * rows; `update().set().where()` records the payload.
 */
function createMockDb(rows: unknown[]) {
    const updateWhere = vi.fn().mockResolvedValue(undefined);
    const updateSet = vi.fn<(payload: Record<string, unknown>) => { where: typeof updateWhere }>(
        () => ({ where: updateWhere })
    );
    const update = vi.fn(() => ({ set: updateSet }));
    const selectWhere = vi.fn().mockResolvedValue(rows);
    const select = vi.fn(() => ({ from: vi.fn(() => ({ where: selectWhere })) }));
    const insertValues = vi.fn().mockResolvedValue(undefined);

    return {
        select,
        update,
        insert: vi.fn(() => ({ values: insertValues })),
        _updateSet: updateSet,
        _insertValues: insertValues
    };
}

/** Every `set(...)` payload that made a purchase terminal. */
function terminalWrites(db: ReturnType<typeof createMockDb>): unknown[] {
    return db._updateSet.mock.calls
        .map(([payload]) => payload as Record<string, unknown> | undefined)
        .filter((payload) => payload?.status === 'canceled');
}

const billing = {} as QZPayBilling;

describe('handleSubscriptionCancellationAddons — the add-on preapproval', () => {
    beforeEach(() => {
        envStub.HOSPEDA_ADDON_LIFECYCLE_ENABLED = true;
        mockCatalogGetBySlug.mockResolvedValue({
            success: false,
            error: { code: 'NOT_FOUND', message: 'addon not found' }
        });
        mockRevoke.mockResolvedValue({
            purchaseId: RECURRING_PURCHASE.id,
            addonSlug: RECURRING_PURCHASE.addonSlug,
            addonType: 'limit' as const,
            outcome: 'success' as const
        });
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    it('does NOT cancel the purchase row when MercadoPago refuses the preapproval cancel', async () => {
        const db = createMockDb([RECURRING_PURCHASE]);
        mockClose.mockResolvedValue({ closed: false, reason: 'MP 502' });

        await expect(
            handleSubscriptionCancellationAddons({
                subscriptionId: SUBSCRIPTION_ID,
                customerId: CUSTOMER_ID,
                billing,
                db: db as never
            })
        ).rejects.toThrow(/could not be revoked/);

        expect(terminalWrites(db)).toEqual([]);
        // The revocation never even runs: there is no point removing the
        // entitlement while the customer is still going to be charged for it.
        expect(mockRevoke).not.toHaveBeenCalled();
    });

    it('CONTROL: the same purchase IS cancelled once MercadoPago accepts', async () => {
        // Pairs with the assertion above — without it, a gutted handler that
        // wrote nothing at all would satisfy the "no terminal write" test.
        const db = createMockDb([RECURRING_PURCHASE]);
        mockClose.mockResolvedValue({ closed: true, kind: 'cancelled' });

        const result = await handleSubscriptionCancellationAddons({
            subscriptionId: SUBSCRIPTION_ID,
            customerId: CUSTOMER_ID,
            billing,
            db: db as never
        });

        expect(result.succeeded).toHaveLength(1);
        expect(terminalWrites(db)).toHaveLength(1);
        expect(mockRevoke).toHaveBeenCalledTimes(1);
    });

    it('records the failure for retry, so the next redelivery tries the close again', async () => {
        const db = createMockDb([RECURRING_PURCHASE]);
        mockClose.mockResolvedValue({ closed: false, reason: 'MP 502' });

        await expect(
            handleSubscriptionCancellationAddons({
                subscriptionId: SUBSCRIPTION_ID,
                customerId: CUSTOMER_ID,
                billing,
                db: db as never
            })
        ).rejects.toThrow();

        expect(db._updateSet).toHaveBeenCalledWith(
            expect.objectContaining({
                metadata: expect.objectContaining({
                    revocationRetryCount: 1,
                    addonCancellationIncomplete: true
                })
            })
        );
    });

    describe('with HOSPEDA_ADDON_LIFECYCLE_ENABLED off', () => {
        beforeEach(() => {
            envStub.HOSPEDA_ADDON_LIFECYCLE_ENABLED = false;
        });

        it('still closes the preapproval — the flag gates entitlements, not money', async () => {
            const db = createMockDb([RECURRING_PURCHASE]);
            mockClose.mockResolvedValue({ closed: true, kind: 'cancelled' });

            const result = await handleSubscriptionCancellationAddons({
                subscriptionId: SUBSCRIPTION_ID,
                customerId: CUSTOMER_ID,
                billing,
                db: db as never
            });

            // The row is handed straight through here (the real SELECT projects
            // only these three columns; the stub returns the whole fixture), so
            // the assertion names the fields that matter rather than the shape.
            expect(mockClose).toHaveBeenCalledWith({
                purchase: expect.objectContaining({
                    id: RECURRING_PURCHASE.id,
                    addonSlug: RECURRING_PURCHASE.addonSlug,
                    mpSubscriptionId: PREAPPROVAL_ID
                }),
                source: 'plan-cancellation',
                billing
            });

            // The entitlement half genuinely stays off: nothing revoked, no row
            // written, and the caller is told nothing was processed.
            expect(result.totalProcessed).toBe(0);
            expect(mockRevoke).not.toHaveBeenCalled();
            expect(terminalWrites(db)).toEqual([]);
        });

        it('throws when a preapproval could not be closed, so MercadoPago redelivers', async () => {
            const db = createMockDb([RECURRING_PURCHASE]);
            mockClose.mockResolvedValue({ closed: false, reason: 'adapter down' });

            await expect(
                handleSubscriptionCancellationAddons({
                    subscriptionId: SUBSCRIPTION_ID,
                    customerId: CUSTOMER_ID,
                    billing,
                    db: db as never
                })
            ).rejects.toThrow(/still open/);
        });
    });
});
