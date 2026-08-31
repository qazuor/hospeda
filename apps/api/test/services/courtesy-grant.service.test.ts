/**
 * Unit tests for courtesy-grant.service.ts (HOS-180).
 *
 * `@repo/db` is mocked wholesale by this package's `test/setup.ts`, so
 * assertions about what got WRITTEN would be vacuous here. What these tests
 * assert instead is the thing that has real money attached and is checkable
 * from call order alone (spec R-3):
 *
 *   **MercadoPago is called before the local write, and never after a refusal.**
 *
 * Write the row first and a failed pause leaves a subscriber marked `courtesy`
 * — entitlements and all — with a preapproval that keeps charging them every
 * month. That is the failure this ordering exists to make impossible.
 *
 * The date arithmetic and the lead-time rule are covered exhaustively and
 * without mocks in `packages/service-core/test/billing/courtesy-grant.calc.test.ts`.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const pauseMock = vi.fn();
const updateMock = vi.fn();
const insertMock = vi.fn();
const notifyMock = vi.fn();

let subscriptionRow: Record<string, unknown> | undefined;
const callOrder: string[] = [];

vi.mock('../../src/middlewares/entitlement.js', () => ({
    clearEntitlementCache: vi.fn()
}));

vi.mock('../../src/services/courtesy-notifications.service.js', () => ({
    sendCourtesyGrantedNotification: (...args: unknown[]) => {
        callOrder.push('notify');
        return notifyMock(...args);
    }
}));

vi.mock('@repo/db/schemas', () => ({
    billingSubscriptionEvents: { subscriptionId: 'subscription_id' }
}));

vi.mock('@repo/db', async () => {
    const actual = await vi.importActual<Record<string, unknown>>('@repo/db');
    return {
        ...actual,
        billingSubscriptions: { id: 'id' },
        eq: vi.fn(() => 'eq'),
        getDb: () => ({
            select: () => ({
                from: () => ({
                    where: () => ({
                        limit: async () => (subscriptionRow ? [subscriptionRow] : [])
                    })
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

const { grantCourtesyCycles } = await import('../../src/services/courtesy-grant.service.js');

/** A subscription that is eligible for a gift in every respect. */
function eligibleSubscription(overrides: Record<string, unknown> = {}) {
    return {
        id: 'sub-1',
        customerId: 'cus-1',
        status: 'active',
        cancelAtPeriodEnd: false,
        mpSubscriptionId: 'mp-preapproval-1',
        currentPeriodEnd: new Date('2026-11-01T00:00:00.000Z'),
        metadata: { billingInterval: 'monthly' },
        ...overrides
    };
}

function makeBilling() {
    return {
        subscriptions: {
            pause: (...args: unknown[]) => {
                callOrder.push('mp-pause');
                return pauseMock(...args);
            }
        }
    } as never;
}

const NOW = new Date('2026-10-01T00:00:00.000Z');

beforeEach(() => {
    vi.clearAllMocks();
    callOrder.length = 0;
    subscriptionRow = eligibleSubscription();
    pauseMock.mockResolvedValue(undefined);
    notifyMock.mockResolvedValue(undefined);
});

describe('grantCourtesyCycles — ordering (spec R-3)', () => {
    it('calls MercadoPago BEFORE writing anything locally', async () => {
        // Act
        const result = await grantCourtesyCycles({
            billing: makeBilling(),
            subscriptionId: 'sub-1',
            cycles: 1,
            actorId: 'admin-1',
            now: NOW
        });

        // Assert
        expect(result.success).toBe(true);
        expect(callOrder.indexOf('mp-pause')).toBeGreaterThanOrEqual(0);
        expect(callOrder.indexOf('mp-pause')).toBeLessThan(callOrder.indexOf('local-write'));
    });

    it('writes NOTHING when MercadoPago refuses the pause', async () => {
        // Arrange — the provider rejects
        pauseMock.mockRejectedValue(new Error('MP said no'));

        // Act
        const result = await grantCourtesyCycles({
            billing: makeBilling(),
            subscriptionId: 'sub-1',
            cycles: 1,
            actorId: 'admin-1',
            now: NOW
        });

        // Assert — this is the whole point: no local row claims a gift that
        // MercadoPago never granted, so nobody is marked courtesy while still
        // being charged.
        expect(result.success).toBe(false);
        if (result.success) return;
        expect(result.error.code).toBe('PROVIDER_ERROR');
        expect(callOrder).not.toContain('local-write');
        expect(callOrder).not.toContain('audit');
        expect(callOrder).not.toContain('notify');
    });

    it('notifies only after the gift is actually recorded', async () => {
        await grantCourtesyCycles({
            billing: makeBilling(),
            subscriptionId: 'sub-1',
            cycles: 1,
            actorId: 'admin-1',
            now: NOW
        });
        expect(callOrder.indexOf('local-write')).toBeLessThan(callOrder.indexOf('notify'));
    });
});

describe('grantCourtesyCycles — refusals never reach the provider', () => {
    it.each([
        ['a subscription that does not exist', undefined, 'NOT_FOUND'],
        [
            'a subscription that is not active',
            eligibleSubscription({ status: 'past_due' }),
            'NOT_ELIGIBLE'
        ],
        [
            'a subscription already scheduled for cancellation',
            eligibleSubscription({ cancelAtPeriodEnd: true }),
            'NOT_ELIGIBLE'
        ],
        [
            'a subscription with no MercadoPago preapproval',
            eligibleSubscription({ mpSubscriptionId: null }),
            'NOT_ELIGIBLE'
        ],
        [
            'a subscription that already has a gift',
            eligibleSubscription({
                metadata: {
                    billingInterval: 'monthly',
                    courtesyEndsAt: '2027-01-01T00:00:00.000Z'
                }
            }),
            'ALREADY_COURTESY'
        ]
    ])('refuses %s without touching MercadoPago', async (_label, row, expectedCode) => {
        // Arrange
        subscriptionRow = row as Record<string, unknown> | undefined;

        // Act
        const result = await grantCourtesyCycles({
            billing: makeBilling(),
            subscriptionId: 'sub-1',
            cycles: 1,
            actorId: 'admin-1',
            now: NOW
        });

        // Assert — a refused grant must not pause a live preapproval as a side
        // effect of being refused.
        expect(result.success).toBe(false);
        if (result.success) return;
        expect(result.error.code).toBe(expectedCode);
        expect(pauseMock).not.toHaveBeenCalled();
        expect(callOrder).toEqual([]);
    });

    it('refuses a grant made too close to the next charge, without pausing', async () => {
        // Arrange — one day before the charge, inside the three-day margin
        subscriptionRow = eligibleSubscription({
            currentPeriodEnd: new Date(NOW.getTime() + 86_400_000)
        });

        // Act
        const result = await grantCourtesyCycles({
            billing: makeBilling(),
            subscriptionId: 'sub-1',
            cycles: 1,
            actorId: 'admin-1',
            now: NOW
        });

        // Assert
        expect(result.success).toBe(false);
        if (result.success) return;
        expect(result.error.code).toBe('NOT_ENOUGH_LEAD_TIME');
        expect(result.error.message).toContain('day(s)');
        expect(pauseMock).not.toHaveBeenCalled();
    });
});
