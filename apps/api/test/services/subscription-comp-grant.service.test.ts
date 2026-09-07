/**
 * Unit tests for subscription-comp-grant.service.ts (HOS-1171).
 *
 * `@repo/db` is mocked wholesale by this package's `test/setup.ts`, so
 * assertions about rows that got WRITTEN would be vacuous. What is checkable
 * from call order and arguments alone is the thing with money attached:
 *
 *   **The MercadoPago preapproval is hard-cancelled BEFORE any comp exists, and
 *   a refusal stops the grant entirely.**
 *
 * `hardCancelPreapprovalBestEffort` never throws. Its `failed` outcome is
 * returned, not raised, so a caller that ignores it produces precisely the bug
 * this service exists to prevent: MercadoPago says no, nothing throws, and a
 * customer is declared free while their card keeps being charged. That is the
 * HOS-751 failure mode, which has happened in this repo already.
 *
 * These tests are what make ignoring the outcome fail. Mutating the
 * `outcome.kind === 'failed'` branch away turns the two `PROVIDER_ERROR` cases
 * below red.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const hardCancelMock = vi.fn();
const createCompMock = vi.fn();
const notifyMock = vi.fn();
const reconcileMock = vi.fn();
const updateMock = vi.fn();
const insertMock = vi.fn();

let supersedableRows: Array<Record<string, unknown>> = [];
const callOrder: string[] = [];

vi.mock('../../src/services/billing/preapproval-hard-cancel.js', () => ({
    hardCancelPreapprovalBestEffort: (...args: unknown[]) => {
        callOrder.push('mp-hard-cancel');
        return hardCancelMock(...args);
    }
}));

vi.mock('../../src/services/subscription-comp-create.service.js', () => ({
    createCompSubscription: (...args: unknown[]) => {
        callOrder.push('create-comp');
        return createCompMock(...args);
    }
}));

vi.mock('../../src/services/comp-notifications.service.js', () => ({
    sendCompGrantedNotification: (...args: unknown[]) => {
        callOrder.push('notify');
        return notifyMock(...args);
    }
}));

vi.mock('../../src/services/subscription-linked-entities.service.js', () => ({
    reconcileSubscriptionLinkedEntities: (...args: unknown[]) => {
        callOrder.push('reconcile');
        return reconcileMock(...args);
    }
}));

vi.mock('@repo/db', async () => {
    const actual = await vi.importActual<Record<string, unknown>>('@repo/db');
    return {
        ...actual,
        billingSubscriptions: {
            id: 'id',
            customerId: 'customer_id',
            status: 'status',
            mpSubscriptionId: 'mp_subscription_id'
        },
        billingSubscriptionEvents: { subscriptionId: 'subscription_id' },
        and: vi.fn(() => 'and'),
        eq: vi.fn(() => 'eq'),
        inArray: vi.fn(() => 'inArray'),
        getDb: () => ({
            select: () => ({
                from: () => ({
                    where: async () => supersedableRows
                })
            }),
            update: () => ({
                set: (values: unknown) => ({
                    where: async () => {
                        callOrder.push('local-write');
                        return updateMock(values);
                    }
                })
            }),
            insert: () => ({
                values: async (values: unknown) => {
                    callOrder.push('audit');
                    return insertMock(values);
                }
            })
        })
    };
});

const { grantCompSubscription } = await import(
    '../../src/services/subscription-comp-grant.service.js'
);

const GRANT = {
    customerId: 'cus-1',
    planId: 'plan-1',
    interval: 'monthly' as const,
    livemode: true,
    actorId: 'admin-1'
};

/** A subscription MercadoPago is actively charging. */
function payingSubscription(overrides: Record<string, unknown> = {}) {
    return {
        id: 'sub-1',
        status: 'active',
        mpSubscriptionId: 'mp-preapproval-1',
        ...overrides
    };
}

beforeEach(() => {
    vi.clearAllMocks();
    callOrder.length = 0;
    supersedableRows = [];
    hardCancelMock.mockResolvedValue({ kind: 'cancelled' });
    createCompMock.mockResolvedValue({ localSubscriptionId: 'comp-sub-1' });
    notifyMock.mockResolvedValue(undefined);
    reconcileMock.mockResolvedValue(undefined);
    updateMock.mockResolvedValue(undefined);
    insertMock.mockResolvedValue(undefined);
});

describe('grantCompSubscription — the preapproval is closed before the comp exists', () => {
    it('hard-cancels the live preapproval BEFORE creating the comp subscription', async () => {
        supersedableRows = [payingSubscription()];

        const result = await grantCompSubscription(GRANT);

        expect(result.success).toBe(true);
        expect(hardCancelMock).toHaveBeenCalledWith(
            expect.objectContaining({
                subscriptionId: 'sub-1',
                mpSubscriptionId: 'mp-preapproval-1',
                source: 'admin-comp-grant'
            })
        );
        // Ordering, not merely "both happened": a comp created first would exist
        // for however long the provider call takes, on a live preapproval.
        expect(callOrder.indexOf('mp-hard-cancel')).toBeLessThan(callOrder.indexOf('create-comp'));
    });

    it('nulls mp_subscription_id on the superseded row', async () => {
        supersedableRows = [payingSubscription()];

        await grantCompSubscription(GRANT);

        expect(updateMock).toHaveBeenCalledWith(
            expect.objectContaining({ status: 'cancelled', mpSubscriptionId: null })
        );
    });

    it('REGRESSION: no comp is granted while any preapproval survives', async () => {
        // The invariant in one assertion. Two rows, the second one refused by
        // MercadoPago: if the service ignored the `failed` outcome — which
        // `hardCancelPreapprovalBestEffort` returns rather than throwing — the
        // customer would end up comped with `mp-preapproval-2` still authorized
        // and still charging.
        supersedableRows = [
            payingSubscription({ id: 'sub-1', mpSubscriptionId: 'mp-preapproval-1' }),
            payingSubscription({ id: 'sub-2', mpSubscriptionId: 'mp-preapproval-2' })
        ];
        hardCancelMock
            .mockResolvedValueOnce({ kind: 'cancelled' })
            .mockResolvedValueOnce({ kind: 'failed', error: 'MP 400 preapproval not cancellable' });

        const result = await grantCompSubscription(GRANT);

        expect(result.success).toBe(false);
        expect(result.success === false && result.error.code).toBe('PROVIDER_ERROR');
        // Nothing downstream ran. `create-comp` absent from the call order is the
        // assertion that "no comp subscription points at a live preapproval" is
        // true by construction rather than by luck.
        expect(callOrder).not.toContain('create-comp');
        expect(createCompMock).not.toHaveBeenCalled();
        expect(callOrder).not.toContain('local-write');
        expect(callOrder).not.toContain('notify');
    });

    it('a refusal on the ONLY subscription also aborts, and writes nothing', async () => {
        supersedableRows = [payingSubscription()];
        hardCancelMock.mockResolvedValue({ kind: 'failed', error: 'MP 500' });

        const result = await grantCompSubscription(GRANT);

        expect(result.success).toBe(false);
        expect(result.success === false && result.error.code).toBe('PROVIDER_ERROR');
        expect(createCompMock).not.toHaveBeenCalled();
        expect(updateMock).not.toHaveBeenCalled();
        expect(insertMock).not.toHaveBeenCalled();
    });

    it('proceeds on `skipped`, which is a clean no-op and not a failure', async () => {
        // A row with no preapproval at all — the `no-preapproval` reason. Treating
        // it like `failed` would make a comp ungrantable for the most ordinary
        // customer there is: one who never subscribed.
        supersedableRows = [payingSubscription({ mpSubscriptionId: null })];
        hardCancelMock.mockResolvedValue({ kind: 'skipped', reason: 'no-preapproval' });

        const result = await grantCompSubscription(GRANT);

        expect(result.success).toBe(true);
        expect(createCompMock).toHaveBeenCalledOnce();
    });
});

describe('grantCompSubscription — what the customer is told', () => {
    it('reports hadActiveBilling only when a preapproval was really cancelled', async () => {
        supersedableRows = [payingSubscription()];

        const result = await grantCompSubscription(GRANT);

        expect(result.success === true && result.data.hadActiveBilling).toBe(true);
        expect(notifyMock).toHaveBeenCalledWith({
            subscriptionId: 'comp-sub-1',
            hadActiveBilling: true
        });
    });

    it('reports hadActiveBilling false for a customer who was never subscribed', async () => {
        supersedableRows = [];

        const result = await grantCompSubscription(GRANT);

        expect(result.success === true && result.data.hadActiveBilling).toBe(false);
        expect(notifyMock).toHaveBeenCalledWith({
            subscriptionId: 'comp-sub-1',
            hadActiveBilling: false
        });
    });

    it('a failed email does NOT undo the grant', async () => {
        // The opposite criterion from the hard-cancel above, on purpose: a mail
        // failure must not reverse something MercadoPago and the database have
        // both already accepted.
        supersedableRows = [];
        notifyMock.mockRejectedValue(new Error('brevo down'));

        const result = await grantCompSubscription(GRANT);

        expect(result.success).toBe(true);
        expect(result.success === true && result.data.subscriptionId).toBe('comp-sub-1');
    });
});

describe('grantCompSubscription — plan refusals keep their meaning', () => {
    it('maps a non-accommodation plan to INVALID_PLAN', async () => {
        createCompMock.mockRejectedValue(
            new Error(
                "createCompSubscription: plan 'plan-1' is domain 'gastronomy' — only accommodation plans can be comped"
            )
        );

        const result = await grantCompSubscription(GRANT);

        expect(result.success).toBe(false);
        expect(result.success === false && result.error.code).toBe('INVALID_PLAN');
    });

    it('maps an unknown plan to NOT_FOUND', async () => {
        createCompMock.mockRejectedValue(new Error("Plan 'plan-1' not found"));

        const result = await grantCompSubscription(GRANT);

        expect(result.success).toBe(false);
        expect(result.success === false && result.error.code).toBe('NOT_FOUND');
    });
});
