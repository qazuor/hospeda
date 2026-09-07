/**
 * `revokeRecurringAddonForProviderTerminal` — mirroring MercadoPago's own
 * verdict onto a recurring add-on (HOS-847 PR 6, inbound half).
 *
 * ## The bug these tests are shaped around
 *
 * `loadEntitlements` reads QZPay's `billing_customer_entitlements` and
 * `billing_customer_limits`. It never reads `billing_addon_purchases`. So the
 * row update is the half that changes what an admin SEES, and the
 * `revokeBySource` call is the half that changes what the customer GETS. Doing
 * only the visible half leaves a paid feature granted forever and looks correct
 * everywhere. Every test here therefore asserts on both halves and on their
 * order.
 *
 * @module test/services/addon-recurring-revoke
 */

import type { QZPayBilling } from '@qazuor/qzpay-core';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockRevokeAddon, mockClearCache, mockCatalogGetBySlug, mockUpdateSet, mockUpdateWhere } =
    vi.hoisted(() => ({
        mockRevokeAddon: vi.fn(),
        mockClearCache: vi.fn(),
        mockCatalogGetBySlug: vi.fn(),
        mockUpdateSet: vi.fn(),
        mockUpdateWhere: vi.fn()
    }));

vi.mock('../../src/utils/logger', () => ({
    apiLogger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }
}));

vi.mock('../../src/middlewares/entitlement', () => ({
    clearEntitlementCache: mockClearCache
}));

vi.mock('../../src/services/addon-lifecycle.service', () => ({
    revokeAddonForSubscriptionCancellation: mockRevokeAddon
}));

vi.mock('@repo/db/schemas/billing', () => ({
    billingAddonPurchases: {
        id: 'id',
        status: 'status',
        canceledAt: 'canceled_at',
        updatedAt: 'updated_at',
        deletedAt: 'deleted_at'
    }
}));

vi.mock('@repo/db', () => ({
    getDb: vi.fn(() => ({
        update: vi.fn(() => ({
            set: vi.fn((payload: unknown) => {
                mockUpdateSet(payload);
                return {
                    where: vi.fn(async (clause: unknown) => {
                        mockUpdateWhere(clause);
                        return { rowCount: 1 };
                    })
                };
            })
        }))
    }))
}));

vi.mock('@repo/service-core', () => ({
    AddonCatalogService: vi.fn().mockImplementation(function () {
        return { getBySlug: mockCatalogGetBySlug };
    })
}));

import type { RecurringAddonPurchaseRow } from '../../src/services/addon-recurring-period.js';
import {
    isTerminalProviderStatus,
    revokeRecurringAddonForProviderTerminal
} from '../../src/services/addon-recurring-revoke.service.js';

const billing = {} as QZPayBilling;

/**
 * Builds a purchase row in the shape `findRecurringAddonPurchaseByPreapprovalId`
 * returns.
 */
function purchaseRow(status: string): RecurringAddonPurchaseRow {
    return {
        id: 'a1b2c3d4-0000-4000-8000-00000000000a',
        customerId: 'cus_inbound',
        subscriptionId: 'sub_plan_of_the_customer',
        addonSlug: 'extra-accommodations-20',
        status,
        mpSubscriptionId: 'preapproval-inbound',
        billingInterval: 'monthly',
        currentPeriodEnd: new Date('2026-10-01T00:00:00Z'),
        purchasedAt: new Date('2026-09-01T00:00:00Z'),
        metadata: null
    };
}

describe('isTerminalProviderStatus', () => {
    it('treats only canceled and finished as the end of the preapproval', () => {
        expect(isTerminalProviderStatus('canceled')).toBe(true);
        expect(isTerminalProviderStatus('finished')).toBe(true);
    });

    it('does NOT treat paused as terminal — MercadoPago pauses are reversible', () => {
        // A paused preapproval can be resumed by the buyer in one tap. Revoking
        // on it would be harsher than anything the plan-side flow does, and
        // would take a feature away from someone who is still a customer.
        expect(isTerminalProviderStatus('paused')).toBe(false);
    });

    it('does NOT treat a live or not-yet-authorized preapproval as terminal', () => {
        expect(isTerminalProviderStatus('active')).toBe(false);
        expect(isTerminalProviderStatus('pending')).toBe(false);
        expect(isTerminalProviderStatus('past_due')).toBe(false);
    });
});

describe('revokeRecurringAddonForProviderTerminal', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockCatalogGetBySlug.mockResolvedValue({
            success: true,
            data: { slug: 'extra-accommodations-20', affectsLimitKey: 'max_accommodations' }
        });
        mockRevokeAddon.mockResolvedValue({ outcome: 'success' });
    });

    it('revokes the QZPay grants and only then writes the row canceled', async () => {
        const outcome = await revokeRecurringAddonForProviderTerminal({
            billing,
            purchase: purchaseRow('active'),
            providerStatus: 'canceled',
            triggerSource: 'webhook'
        });

        expect(outcome).toEqual({ kind: 'revoked' });
        expect(mockRevokeAddon).toHaveBeenCalledWith(
            expect.objectContaining({
                customerId: 'cus_inbound',
                purchase: expect.objectContaining({ addonSlug: 'extra-accommodations-20' })
            })
        );
        expect(mockUpdateSet).toHaveBeenCalledWith(
            expect.objectContaining({ status: 'canceled', canceledAt: expect.any(Date) })
        );

        const revokeOrder = mockRevokeAddon.mock.invocationCallOrder[0] ?? 0;
        const writeOrder = mockUpdateSet.mock.invocationCallOrder[0] ?? 0;
        expect(revokeOrder).toBeGreaterThan(0);
        expect(writeOrder).toBeGreaterThan(revokeOrder);
    });

    it('clears the entitlement cache so the benefit disappears on the next request', async () => {
        await revokeRecurringAddonForProviderTerminal({
            billing,
            purchase: purchaseRow('active'),
            providerStatus: 'finished',
            triggerSource: 'webhook'
        });

        expect(mockClearCache).toHaveBeenCalledWith('cus_inbound');
    });

    it('does NOT write the row when the QZPay revocation fails', async () => {
        mockRevokeAddon.mockRejectedValue(new Error('qzpay 503'));

        await expect(
            revokeRecurringAddonForProviderTerminal({
                billing,
                purchase: purchaseRow('active'),
                providerStatus: 'canceled',
                triggerSource: 'webhook'
            })
        ).rejects.toThrow('qzpay 503');

        // A row marked canceled over a still-granted entitlement is invisible in
        // every admin view AND still gives the customer the feature. Leaving the
        // row alone keeps the two halves consistent and keeps PR 7's reconciler
        // able to find it.
        expect(mockUpdateSet).not.toHaveBeenCalled();
        expect(mockClearCache).not.toHaveBeenCalled();
    });

    it('is idempotent: a redelivered event over an already-canceled row does nothing', async () => {
        const outcome = await revokeRecurringAddonForProviderTerminal({
            billing,
            purchase: purchaseRow('canceled'),
            providerStatus: 'canceled',
            triggerSource: 'webhook'
        });

        expect(outcome).toEqual({ kind: 'already-terminal', status: 'canceled' });
        expect(mockRevokeAddon).not.toHaveBeenCalled();
        expect(mockUpdateSet).not.toHaveBeenCalled();
    });

    it('also short-circuits on an expired or refunded row', async () => {
        for (const status of ['expired', 'refunded']) {
            vi.clearAllMocks();
            const outcome = await revokeRecurringAddonForProviderTerminal({
                billing,
                purchase: purchaseRow(status),
                providerStatus: 'finished',
                triggerSource: 'cron'
            });

            expect(outcome).toEqual({ kind: 'already-terminal', status });
            expect(mockRevokeAddon).not.toHaveBeenCalled();
        }
    });

    it('revokes a purchase abandoned at `pending`, whose preapproval was then cancelled', async () => {
        // The buyer walked away from MercadoPago's authorization page and later
        // killed the preapproval. Leaving the row `pending` forever would keep
        // the abandoned-checkout sweeps chasing something that can never
        // activate.
        const outcome = await revokeRecurringAddonForProviderTerminal({
            billing,
            purchase: purchaseRow('pending'),
            providerStatus: 'canceled',
            triggerSource: 'webhook'
        });

        expect(outcome).toEqual({ kind: 'revoked' });
        expect(mockUpdateSet).toHaveBeenCalledWith(expect.objectContaining({ status: 'canceled' }));
    });
});
