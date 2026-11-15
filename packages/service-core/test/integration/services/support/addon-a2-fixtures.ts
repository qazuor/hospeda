import { billingOptions, eq, payments, plans, planVersions, subscriptions } from '@repo/db';
import { encodeFakeNotice } from '@repo/payments/fake';
import { processProviderNotice } from '../../../../src/services/billing/notice/process-provider-notice.service';
import { creditPayment } from '../../../../src/services/billing/payment/credit-payment.service';
import { startSubscription } from '../../../../src/services/billing/subscription/start-subscription.service';
import { getServiceTestDb } from '../helpers';
import type { purchaseFixture } from './addon-purchase-fixtures';
import { noTouristVip } from './tourist-vip';

type AwaitedPurchaseFixture = Awaited<ReturnType<typeof purchaseFixture>>;

/** Starts a real principal and credits its first payment before an addon purchase. */
export async function payingPrincipal(f: AwaitedPurchaseFixture): Promise<{
    readonly subscriptionId: string;
    readonly authorizationId: string;
    readonly amount: number;
}> {
    const db = getServiceTestDb();
    // A catalog plan is seeded directly; the subscription and its payment use real services.
    const plan = await db.transaction(async (tx) => {
        const [catalog] = await tx
            .insert(plans)
            .values({
                vertical: 'accommodation',
                slug: `a2-${crypto.randomUUID()}`,
                name: 'A2 plan'
            })
            .returning({ id: plans.id });
        if (!catalog) throw new Error('Plan missing');
        const [version] = await tx
            .insert(planVersions)
            .values({
                planId: catalog.id,
                vertical: 'accommodation',
                rank: Math.floor(Math.random() * 1_000_000_000),
                sellable: true,
                current: true,
                trialDays: 0,
                allowsPause: false
            })
            .returning({ id: planVersions.id });
        if (!version) throw new Error('Plan version missing');
        const [option] = await tx
            .insert(billingOptions)
            .values({
                planVersionId: version.id,
                cycle: 'monthly',
                amount: 250000,
                currency: 'ARS'
            })
            .returning({ id: billingOptions.id });
        if (!option) throw new Error('Plan option missing');
        return { billingOptionId: option.id };
    });
    const [option] = await db
        .select({ amount: billingOptions.amount })
        .from(billingOptions)
        .where(eq(billingOptions.id, plan.billingOptionId));
    if (!option) throw new Error('Plan option missing');
    const started = await startSubscription(
        {
            userId: f.ownerId,
            billingOptionId: plan.billingOptionId,
            payerEmail: 'payer@example.test',
            returnUrl: 'https://example.test/return'
        },
        {
            provider: f.fake,
            clock: f.ports.clock,
            planPolicy: async () => ({
                graceDays: 10,
                allowsPause: false,
                current: true,
                sellable: true
            }),
            touristVipInheritance: noTouristVip,
            beforeCancelNotice: { beforeCancel: async () => 'SENT' }
        }
    );
    await f.fake.approve({ authorizationId: started.authorizationId });
    const notice = encodeFakeNotice({
        notice: {
            resourceKind: 'authorization',
            resourceId: started.authorizationId,
            version: '1'
        },
        format: 'json'
    });
    const result = await processProviderNotice(
        {
            channel: 'WEBHOOKS',
            delivery: { headers: { 'content-type': 'application/json' }, body: notice.body }
        },
        {
            provider: f.fake,
            clock: f.ports.clock,
            beforeCancelNotice: { beforeCancel: async () => 'SENT' }
        }
    );
    if (result.outcome !== 'APPLIED') throw new Error(`Principal S2 returned ${result.outcome}`);
    const [payment] = await db
        .insert(payments)
        .values({
            subscriptionId: started.subscriptionId,
            amount: option.amount,
            currency: 'ARS',
            status: 'PENDING',
            provider: 'MERCADO_PAGO',
            providerFactId: crypto.randomUUID(),
            factAt: f.ports.clock.now()
        })
        .returning({ id: payments.id });
    if (!payment) throw new Error('Principal payment missing');
    await creditPayment(
        { paymentId: payment.id, chargeCreatedAt: f.ports.clock.now() },
        { clock: f.ports.clock }
    );
    const [row] = await db
        .select({ status: subscriptions.status })
        .from(subscriptions)
        .where(eq(subscriptions.id, started.subscriptionId));
    if (row?.status !== 'ACTIVE') throw new Error('Principal did not activate');
    return {
        subscriptionId: started.subscriptionId,
        authorizationId: started.authorizationId,
        amount: option.amount
    };
}
