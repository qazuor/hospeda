/**
 * Unit tests for {@link decideCheckoutReuse} — the pure rule set behind the
 * per-entity checkout idempotency.
 *
 * Every refusal reason gets its own case, built from a baseline that WOULD be
 * reused with exactly one field spoiled. That isolation is the point: a suite
 * where each test differs from the happy path in more than one way cannot tell
 * which guard actually fired, and a guard nobody can attribute a failure to is a
 * guard nobody can prove still works.
 *
 * No mocks: the function under test touches no clock it is not handed, no
 * database, and no network.
 *
 * @module test/services/billing/checkout-reuse-decision
 */
import { SubscriptionStatusEnum } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import type {
    CheckoutBridgeSnapshot,
    PendingCheckoutSnapshot
} from '../../../src/services/billing/checkout-reuse-decision';
import { decideCheckoutReuse } from '../../../src/services/billing/checkout-reuse-decision';

const NOW = new Date('2026-08-16T12:00:00.000Z');
const CUSTOMER_ID = 'cust_owner';
const PLAN_ID = '00000000-0000-4000-8000-0000000000aa';
const MP_PLAN_ID = 'mp_plan_test';

const BRIDGE: CheckoutBridgeSnapshot = {
    subscriptionId: 'sub-1',
    status: SubscriptionStatusEnum.PENDING_PROVIDER
};

const PENDING: PendingCheckoutSnapshot = {
    localSubscriptionId: 'sub-1',
    customerId: CUSTOMER_ID,
    planId: PLAN_ID,
    mpPreapprovalPlanId: MP_PLAN_ID,
    nonce: 'nonce-1',
    status: 'pending',
    expiresAt: new Date(NOW.getTime() + 60 * 60 * 1000),
    hasPromoSnapshot: false
};

/** The baseline that reuses, with an optional single-field spoil applied. */
function decide(overrides: {
    bridge?: CheckoutBridgeSnapshot | null;
    pendingCheckout?: PendingCheckoutSnapshot | null;
    customerId?: string;
    planId?: string;
    mpPreapprovalPlanId?: string;
}) {
    return decideCheckoutReuse({
        bridge: overrides.bridge === undefined ? BRIDGE : overrides.bridge,
        pendingCheckout:
            overrides.pendingCheckout === undefined ? PENDING : overrides.pendingCheckout,
        customerId: overrides.customerId ?? CUSTOMER_ID,
        planId: overrides.planId ?? PLAN_ID,
        mpPreapprovalPlanId: overrides.mpPreapprovalPlanId ?? MP_PLAN_ID,
        now: NOW
    });
}

describe('decideCheckoutReuse', () => {
    it('reuses when the checkout is genuinely in flight and unchanged', () => {
        const decision = decide({});

        expect(decision.reuse).toBe(true);
        if (decision.reuse) {
            expect(decision.pendingCheckout.nonce).toBe('nonce-1');
            expect(decision.pendingCheckout.localSubscriptionId).toBe('sub-1');
        }
    });

    it('refuses when the entity has no bridge row (never subscribed)', () => {
        expect(decide({ bridge: null })).toEqual({ reuse: false, reason: 'no-bridge-row' });
    });

    it.each([
        SubscriptionStatusEnum.ACTIVE,
        SubscriptionStatusEnum.TRIALING,
        SubscriptionStatusEnum.PAST_DUE
    ])('refuses when the bridge row is %s — the route 409 owns that window', (status) => {
        // Answering a live subscription with a stale share link would be
        // strictly worse than the 409 the caller is supposed to get.
        expect(decide({ bridge: { ...BRIDGE, status } })).toEqual({
            reuse: false,
            reason: 'bridge-not-pending-provider'
        });
    });

    it('refuses when the correlation row is missing', () => {
        expect(decide({ pendingCheckout: null })).toEqual({
            reuse: false,
            reason: 'no-correlation-row'
        });
    });

    it.each([
        'linked',
        'reconcile_assisted'
    ])('refuses when the correlation row is %s (checkout already finished)', (status) => {
        expect(decide({ pendingCheckout: { ...PENDING, status } })).toEqual({
            reuse: false,
            reason: 'correlation-not-pending'
        });
    });

    it('refuses when the correlation row has expired — an abandoned checkout must not wedge the entity', () => {
        expect(
            decide({
                pendingCheckout: {
                    ...PENDING,
                    expiresAt: new Date(NOW.getTime() - 1)
                }
            })
        ).toEqual({ reuse: false, reason: 'correlation-expired' });
    });

    it('treats expiry as exclusive: expiring exactly now is expired', () => {
        // The boundary is the case a `<` / `<=` slip silently gets wrong.
        expect(decide({ pendingCheckout: { ...PENDING, expiresAt: NOW } })).toEqual({
            reuse: false,
            reason: 'correlation-expired'
        });
        expect(
            decide({ pendingCheckout: { ...PENDING, expiresAt: new Date(NOW.getTime() + 1) } })
                .reuse
        ).toBe(true);
    });

    it('refuses when the billing customer changed (listing changed owner)', () => {
        expect(decide({ customerId: 'cust_new_owner' })).toEqual({
            reuse: false,
            reason: 'customer-changed'
        });
    });

    it('refuses when the commercial plan changed', () => {
        expect(decide({ planId: '00000000-0000-4000-8000-0000000000bb' })).toEqual({
            reuse: false,
            reason: 'plan-changed'
        });
    });

    it('refuses when the resolved MercadoPago plan drifted — the old link charges the old price', () => {
        expect(decide({ mpPreapprovalPlanId: 'mp_plan_v2' })).toEqual({
            reuse: false,
            reason: 'mp-plan-changed'
        });
    });

    it('refuses when the stored row carries a promo snapshot (forward fence)', () => {
        expect(decide({ pendingCheckout: { ...PENDING, hasPromoSnapshot: true } })).toEqual({
            reuse: false,
            reason: 'promo-snapshot-present'
        });
    });

    it('uses the injected clock, not the wall clock', () => {
        const expiresAt = new Date('2026-08-16T13:00:00.000Z');

        expect(
            decideCheckoutReuse({
                bridge: BRIDGE,
                pendingCheckout: { ...PENDING, expiresAt },
                customerId: CUSTOMER_ID,
                planId: PLAN_ID,
                mpPreapprovalPlanId: MP_PLAN_ID,
                now: new Date('2026-08-16T14:00:00.000Z')
            })
        ).toEqual({ reuse: false, reason: 'correlation-expired' });
    });
});
