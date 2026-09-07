/**
 * `routeAddonPreapprovalEvent` — the `subscription_preapproval.{created,updated}`
 * half of the HOS-847 PR 5 routing.
 *
 * Its sibling file drives the real authorized-payment handler; this one tests
 * the routing function directly, because its caller
 * (`processSubscriptionUpdated`) is a 1,300-line function whose own suite is
 * about plan subscriptions and would drown the four decisions that matter here:
 * claim or not, activate or not, and which failures may fall through.
 *
 * The `handled` flag is the load-bearing value. `handled: false` is the ONLY
 * value that lets `processSubscriptionUpdated` continue into plan logic, so
 * every case that is NOT "this preapproval belongs to no add-on" must return
 * `true` — including the ones where this module deliberately does nothing.
 *
 * @module test/webhooks/addon-recurring-preapproval-routing
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockFindPurchase, mockActivate, mockRetrieve } = vi.hoisted(() => ({
    mockFindPurchase: vi.fn(),
    mockActivate: vi.fn(),
    mockRetrieve: vi.fn()
}));

vi.mock('../../src/utils/logger', () => ({
    apiLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }
}));

vi.mock('../../src/services/addon-recurring-period', () => ({
    findRecurringAddonPurchaseByPreapprovalId: mockFindPurchase
}));

vi.mock('../../src/services/addon-recurring-activation.service', () => ({
    activateRecurringAddonPurchase: mockActivate
}));

vi.mock('../../src/services/addon-recurring-renewal.service', () => ({
    settleRecurringAddonCharge: vi.fn()
}));

import { routeAddonPreapprovalEvent } from '../../src/routes/webhooks/mercadopago/addon-recurring-handler';

const PREAPPROVAL_ID = 'preapproval-addon-1';

const purchaseRow = {
    id: 'purchase-1',
    customerId: 'cust-1',
    subscriptionId: 'plan-sub-1',
    addonSlug: 'extra-accommodations-5',
    status: 'pending',
    mpSubscriptionId: PREAPPROVAL_ID,
    billingInterval: 'monthly',
    currentPeriodEnd: null,
    metadata: {}
};

const billing = {} as never;
const paymentAdapter = { subscriptions: { retrieve: mockRetrieve } } as never;

const route = () =>
    routeAddonPreapprovalEvent({
        preapprovalId: PREAPPROVAL_ID,
        billing,
        paymentAdapter,
        triggerSource: 'webhook'
    });

beforeEach(() => {
    vi.clearAllMocks();
    mockActivate.mockResolvedValue({ activated: true });
    mockRetrieve.mockResolvedValue({ id: PREAPPROVAL_ID, status: 'active' });
});

describe('routeAddonPreapprovalEvent', () => {
    it('lets a preapproval that belongs to no add-on fall through to the plan handler', async () => {
        // Arrange
        mockFindPurchase.mockResolvedValue(null);

        // Act
        const outcome = await route();

        // Assert: `handled: false` is what keeps every plan subscription in the
        // system working exactly as it did before this PR.
        expect(outcome).toEqual({ handled: false });
        expect(mockRetrieve).not.toHaveBeenCalled();
        expect(mockActivate).not.toHaveBeenCalled();
    });

    it('activates the purchase when MercadoPago reports the preapproval authorized', async () => {
        // Arrange: `active` is what qzpay-mercadopago normalizes MP's
        // `authorized` into before anything here sees it.
        mockFindPurchase.mockResolvedValue(purchaseRow);

        // Act
        const outcome = await route();

        // Assert
        expect(outcome).toEqual({ handled: true, purchaseId: 'purchase-1' });
        expect(mockActivate).toHaveBeenCalledTimes(1);
        expect(mockActivate.mock.calls[0]?.[0]).toMatchObject({
            purchase: purchaseRow,
            triggerSource: 'webhook'
        });
    });

    it.each([
        ['paused'],
        ['canceled'],
        ['finished'],
        ['past_due'],
        ['pending']
    ])('claims the event but grants nothing when the provider reports %s', async (status) => {
        // Arrange
        mockFindPurchase.mockResolvedValue(purchaseRow);
        mockRetrieve.mockResolvedValue({ id: PREAPPROVAL_ID, status });

        // Act
        const outcome = await route();

        // Assert: claimed, so the plan handler can never see it, and NOT
        // acted on, because revoking an add-on belongs to PR 6/7 — a
        // half-done revocation here would mark the purchase dead while the
        // QZPay entitlement it granted stayed alive.
        expect(outcome).toEqual({ handled: true, purchaseId: 'purchase-1' });
        expect(mockActivate).not.toHaveBeenCalled();
    });

    it('still claims the event when MercadoPago cannot be reached', async () => {
        // Arrange
        mockFindPurchase.mockResolvedValue(purchaseRow);
        mockRetrieve.mockRejectedValue(new Error('MercadoPago 503'));

        // Act
        const outcome = await route();

        // Assert: we already know it is an add-on. Falling through to the plan
        // handler because OUR call failed would run a customer's whole
        // subscription lifecycle against one add-on — strictly worse than
        // dropping the event.
        expect(outcome).toEqual({ handled: true, purchaseId: 'purchase-1' });
    });

    it('FAILS CLOSED when the routing lookup itself throws', async () => {
        // Arrange: the database read that decides "add-on or plan?" is down.
        mockFindPurchase.mockRejectedValue(new Error('DB connection refused'));

        // Act & Assert: the error propagates so the caller's dead-letter path
        // retries. Answering `handled: false` here would be a guess, and the
        // guess would be the exact bug this routing exists to prevent.
        await expect(route()).rejects.toThrow('DB connection refused');
    });
});
