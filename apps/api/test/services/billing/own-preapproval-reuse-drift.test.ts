/**
 * HOS-1221: the own-preapproval reuse check (§6.6-B) must fail CLOSED on the
 * priced-variant key.
 *
 * `decideOwnPreapprovalReuse` decides whether an in-flight `pending_provider`
 * row may be handed back on a double-click instead of opening a second
 * MercadoPago preapproval. One of its conditions is that the MercadoPago
 * `preapproval_plan` the row was born against still matches the one the current
 * attempt resolved — `resolveOrProvisionMpPlan` re-provisions on price or
 * discount drift, so a changed id means the in-flight link is priced at an
 * amount we no longer sell at.
 *
 * That key used to be written from `providerPriceId` — the field qzpay forwards
 * to MercadoPago. HOS-1221 split the two (the forwarded field is what made
 * MercadoPago answer "card_token_id is required"), and this suite pins the
 * consequence for the reuse check: a comparison written as a bare `!==` matches
 * when BOTH sides are absent, which would hand back a stale checkout the moment
 * either side stopped being produced. An absent key must be a refusal.
 *
 * Exercised through the exported commerce/partner resolvers rather than the
 * private decision function, so the assertion is about behaviour a caller can
 * observe.
 *
 * @module test/services/billing/own-preapproval-reuse-drift
 */

import { SubscriptionStatusEnum } from '@repo/schemas';
import { describe, expect, it, vi } from 'vitest';
import { resolveReusableCommerceOwnPreapprovalCheckout } from '../../../src/services/billing/checkout-idempotency';

vi.mock('../../../src/utils/logger', () => ({
    apiLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }
}));

const CUSTOMER_ID = 'cust_owner';
const PLAN_ID = '00000000-0000-4000-8000-0000000000aa';
const SUB_ID = '11111111-1111-4111-8111-111111111111';
const ENTITY_ID = '22222222-2222-4222-8222-222222222222';
const CHECKOUT_URL = 'https://mp.test/subscriptions/checkout?preapproval_id=own-1';

/**
 * Drizzle stub answering `.select().from().where().limit()` with a queue of
 * result sets, in call order: first the bridge row, then the
 * `billing_subscriptions` row it points at.
 */
function createDbStub(resultSets: readonly unknown[][]) {
    const queue = [...resultSets];
    const chain = () => {
        const result = queue.shift() ?? [];
        const limit = vi.fn().mockResolvedValue(result);
        const where = vi.fn().mockReturnValue({ limit });
        const from = vi.fn().mockReturnValue({ where });
        return { from };
    };
    return { select: vi.fn().mockImplementation(chain) };
}

/** A row that is reusable in every respect EXCEPT what each test varies. */
function makeSubscriptionRow(metadata: Record<string, unknown>) {
    return {
        id: SUB_ID,
        customerId: CUSTOMER_ID,
        planId: PLAN_ID,
        status: SubscriptionStatusEnum.PENDING_PROVIDER,
        mpSubscriptionId: 'mp_preapproval_abc',
        metadata,
        createdAt: new Date()
    };
}

const BRIDGE_ROW = [{ subscriptionId: SUB_ID, status: SubscriptionStatusEnum.PENDING_PROVIDER }];

describe('own-preapproval reuse — the plan-id drift guard fails closed (HOS-1221)', () => {
    it('reuses the in-flight checkout when the recorded plan id MATCHES', async () => {
        const db = createDbStub([
            BRIDGE_ROW,
            [
                makeSubscriptionRow({
                    checkoutUrl: CHECKOUT_URL,
                    mpPreapprovalPlanId: 'mp_plan_v1'
                })
            ]
        ]);

        const reusable = await resolveReusableCommerceOwnPreapprovalCheckout({
            entityType: 'gastronomy',
            entityId: ENTITY_ID,
            customerId: CUSTOMER_ID,
            planId: PLAN_ID,
            mpPreapprovalPlanId: 'mp_plan_v1',
            // biome-ignore lint/suspicious/noExplicitAny: drizzle client stub
            db: db as any
        });

        // Positive control: without this the refusals below would prove nothing,
        // since a resolver that always answered `null` would satisfy them all.
        expect(reusable).toEqual({
            checkoutUrl: CHECKOUT_URL,
            localSubscriptionId: SUB_ID,
            expiresAt: expect.any(String)
        });
    });

    it('refuses when the recorded plan id DRIFTED from the one just resolved', async () => {
        const db = createDbStub([
            BRIDGE_ROW,
            [
                makeSubscriptionRow({
                    checkoutUrl: CHECKOUT_URL,
                    mpPreapprovalPlanId: 'mp_plan_v1'
                })
            ]
        ]);

        const reusable = await resolveReusableCommerceOwnPreapprovalCheckout({
            entityType: 'gastronomy',
            entityId: ENTITY_ID,
            customerId: CUSTOMER_ID,
            planId: PLAN_ID,
            mpPreapprovalPlanId: 'mp_plan_v2',
            // biome-ignore lint/suspicious/noExplicitAny: drizzle client stub
            db: db as any
        });

        expect(reusable).toBeNull();
    });

    it('refuses when the ROW carries no recorded plan id at all', async () => {
        const db = createDbStub([BRIDGE_ROW, [makeSubscriptionRow({ checkoutUrl: CHECKOUT_URL })]]);

        const reusable = await resolveReusableCommerceOwnPreapprovalCheckout({
            entityType: 'gastronomy',
            entityId: ENTITY_ID,
            customerId: CUSTOMER_ID,
            planId: PLAN_ID,
            mpPreapprovalPlanId: 'mp_plan_v1',
            // biome-ignore lint/suspicious/noExplicitAny: drizzle client stub
            db: db as any
        });

        expect(reusable).toBeNull();
    });

    /**
     * The fail-OPEN this guard exists for. A bare `stored !== context` is TRUE
     * for two different strings and FALSE for two absent values, so the day both
     * sides stop being produced the drift condition silently stops refusing
     * anything and every stale in-flight checkout becomes reusable.
     */
    it('refuses when NEITHER side has a plan id — undefined must not match undefined', async () => {
        const db = createDbStub([BRIDGE_ROW, [makeSubscriptionRow({ checkoutUrl: CHECKOUT_URL })]]);

        const reusable = await resolveReusableCommerceOwnPreapprovalCheckout({
            entityType: 'experience',
            entityId: ENTITY_ID,
            customerId: CUSTOMER_ID,
            planId: PLAN_ID,
            // biome-ignore lint/suspicious/noExplicitAny: the type says string; the point is what happens if it ever is not
            mpPreapprovalPlanId: undefined as any,
            // biome-ignore lint/suspicious/noExplicitAny: drizzle client stub
            db: db as any
        });

        expect(reusable).toBeNull();
    });
});
