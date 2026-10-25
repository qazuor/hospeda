// TEST:1731:1 — a rejected checkout charge closes an already-cancelled pending signup.
import {
    coverageLosses,
    emailOutbox,
    eq,
    payments,
    providerLinks,
    subscriptions,
    users
} from '@repo/db';
import { FakePaymentProvider } from '@repo/payments/fake';
import { afterAll, describe, expect, it, vi } from 'vitest';
import type { BillingFact } from '../../../src/services/billing/facts/billing-fact-sink';
import { recordChargeFact } from '../../../src/services/billing/payment/record-charge-fact.service';
import { providerLinkCancellationSeen } from '../../../src/services/billing/subscription/provider-link-cancellation-seen';
import { startSubscription } from '../../../src/services/billing/subscription/start-subscription.service';
import { closeServiceTestPool, getServiceTestDb, getServiceTestPool } from './helpers';
import { noTouristVip } from './support/tourist-vip';

afterAll(closeServiceTestPool);
const now = new Date('2026-10-01T03:00:00.000Z');
const clock = { now: () => new Date(now) };

async function setup({
    cancel = true,
    authorize = false
}: {
    readonly cancel?: boolean;
    readonly authorize?: boolean;
} = {}) {
    const [user] = await getServiceTestDb()
        .insert(users)
        .values({
            email: `hos1731-${crypto.randomUUID()}@example.test`,
            displayName: 'HOS-1731',
            emailVerified: true,
            lifecycleState: 'ACTIVE'
        })
        .returning();
    if (!user) throw new Error('Missing user');
    const planId = (
        await getServiceTestPool().query<{ id: string }>(
            'INSERT INTO plan (vertical, slug, name) VALUES ($1, $2, $3) RETURNING id',
            ['accommodation', `hos1731-${crypto.randomUUID()}`, 'Plan']
        )
    ).rows[0]?.id;
    if (!planId) throw new Error('Missing plan');
    const versionId = (
        await getServiceTestPool().query<{ id: string }>(
            "INSERT INTO plan_version (plan_id, vertical, rank, sellable, current, trial_days, allows_pause, inherits_tourist_vip) VALUES ($1, 'accommodation', $2, true, true, 0, false, false) RETURNING id",
            [planId, Math.floor(Math.random() * 1_000_000_000)]
        )
    ).rows[0]?.id;
    if (!versionId) throw new Error('Missing version');
    const optionId = (
        await getServiceTestPool().query<{ id: string }>(
            "INSERT INTO billing_option (plan_version_id, cycle, amount, currency) VALUES ($1, 'monthly', 250000, 'ARS') RETURNING id",
            [versionId]
        )
    ).rows[0]?.id;
    if (!optionId) throw new Error('Missing option');
    const fake = new FakePaymentProvider({ clock, idNamespace: crypto.randomUUID() });
    const beforeCancelNotice = { beforeCancel: vi.fn(async () => 'SENT' as const) };
    const started = await startSubscription(
        {
            userId: user.id,
            billingOptionId: optionId,
            returnUrl: 'https://example.test'
        },
        {
            provider: fake,
            clock,
            beforeCancelNotice,
            touristVipInheritance: noTouristVip,
            planPolicy: async () => ({
                graceDays: 10,
                allowsPause: false,
                current: true,
                sellable: true
            })
        }
    );
    const charge = await fake.declineCharge({
        authorizationId: started.authorizationId,
        declineReason: 'cc_rejected_insufficient_amount'
    });
    if (authorize) await fake.approve({ authorizationId: started.authorizationId });
    if (cancel) await fake.cancel({ authorizationId: started.authorizationId });
    return {
        fake,
        started,
        chargeId: charge.chargeId,
        userId: user.id,
        optionId,
        beforeCancelNotice
    };
}

async function ownOutbox(subscriptionId: string) {
    const rows = await getServiceTestDb().select().from(emailOutbox);
    return rows.filter(
        (row) =>
            row.template === 'billing.signup-declined' &&
            (row.payload as { subscriptionId?: string }).subscriptionId === subscriptionId
    );
}

describe('HOS-1731 pending first charge rejection', () => {
    it('TEST:1731:1 closes the cancelled pending attempt via the recorded payment notice', async () => {
        const own = await setup();
        const result = await recordChargeFact(
            { chargeId: own.chargeId },
            {
                provider: own.fake,
                clock,
                beforeCancelNotice: own.beforeCancelNotice,
                cancellationSeen: providerLinkCancellationSeen
            }
        );
        expect(result).toMatchObject({
            outcome: 'DECLINED',
            decline: { outcome: 'DECLINED', cancelCall: 'NOT_NEEDED' }
        });
        // TEST:1731:5 (D3): P8 replaces this pending-payment expectation (AC:1734:1).
        if (result.outcome !== 'DECLINED') throw new Error('Expected a declined charge result');
        const [payment] = await getServiceTestDb()
            .select({ status: payments.status })
            .from(payments)
            .where(eq(payments.id, result.paymentId));
        // AC:1734:1 — P8 fails a rejected signup charge without a retry window.
        expect(payment?.status).toBe('FAILED');
        const [row] = await getServiceTestDb()
            .select()
            .from(subscriptions)
            .where(eq(subscriptions.id, own.started.subscriptionId));
        expect(row?.status).toBe('CHARGE_DECLINED');
        const [link] = await getServiceTestDb()
            .select()
            .from(providerLinks)
            .where(eq(providerLinks.subscriptionId, own.started.subscriptionId));
        expect(link?.cancelledSeenAt).toEqual(now);
        const mails = await ownOutbox(own.started.subscriptionId);
        expect(mails).toHaveLength(1);
        expect(mails[0]?.payload).toMatchObject({
            declineReason: 'cc_rejected_insufficient_amount'
        });
    });

    it.each([
        ['pending', false] as const,
        ['authorized', true] as const
    ])('TEST:1731:2 leaves a %s authorization untouched', async (_label, authorize) => {
        const own = await setup({ cancel: false, authorize });
        const facts: BillingFact[] = [];
        const cancel = vi.spyOn(own.fake, 'cancel');
        const result = await recordChargeFact(
            { chargeId: own.chargeId },
            {
                provider: own.fake,
                clock,
                beforeCancelNotice: own.beforeCancelNotice,
                cancellationSeen: providerLinkCancellationSeen,
                billingFacts: { emit: (fact) => facts.push(fact) }
            }
        );
        expect(result).toMatchObject({
            outcome: 'DECLINED',
            decline: {
                outcome: 'NOT_APPLICABLE',
                reason: 'AUTHORIZATION_NOT_CANCELLED'
            }
        });
        expect(cancel).not.toHaveBeenCalled();
        const [row] = await getServiceTestDb()
            .select()
            .from(subscriptions)
            .where(eq(subscriptions.id, own.started.subscriptionId));
        expect(row?.status).toBe('PENDING_AUTHORIZATION');
        expect(await ownOutbox(own.started.subscriptionId)).toHaveLength(0);
        const [payment] = await getServiceTestDb()
            .select()
            .from(payments)
            .where(eq(payments.providerFactId, own.chargeId));
        expect(facts.filter((fact) => fact.subscriptionId === own.started.subscriptionId)).toEqual([
            {
                kind: 'CHARGE_REJECTED',
                userId: own.userId,
                vertical: 'accommodation',
                subscriptionId: own.started.subscriptionId,
                subscriptionClass: 'PRINCIPAL',
                actorKind: 'SYSTEM',
                occurredAt: payment!.factAt,
                paymentId: payment!.id,
                amountMinor: payment!.amount,
                currency: payment!.currency,
                isFirstCharge: true,
                nextState: 'UNCHANGED',
                hasRetryWindow: false
            }
        ]);
    });

    it('TEST:1731:3 deduplicates redelivery after the row is closed', async () => {
        const own = await setup();
        const ports = {
            provider: own.fake,
            clock,
            beforeCancelNotice: own.beforeCancelNotice,
            cancellationSeen: providerLinkCancellationSeen
        };
        const first = await recordChargeFact({ chargeId: own.chargeId }, ports);
        const second = await recordChargeFact({ chargeId: own.chargeId }, ports);
        expect(first.outcome).toBe('DECLINED');
        expect(second.outcome).toBe('GRACE');
        expect(await ownOutbox(own.started.subscriptionId)).toHaveLength(1);
    });

    it('TEST:1731:4 closes pending without coverage loss or a removal notice', async () => {
        const own = await setup();
        const emitCoverageChanged = vi.fn(async () => undefined);
        const result = await recordChargeFact(
            { chargeId: own.chargeId },
            {
                provider: own.fake,
                clock,
                beforeCancelNotice: own.beforeCancelNotice,
                cancellationSeen: providerLinkCancellationSeen,
                coverageNotices: { emitCoverageChanged }
            }
        );
        expect(result.outcome).toBe('DECLINED');
        expect(emitCoverageChanged).not.toHaveBeenCalled();
        const losses = await getServiceTestDb()
            .select()
            .from(coverageLosses)
            .where(eq(coverageLosses.userId, own.userId));
        expect(losses).toHaveLength(0);
    });

    it('TEST:1731:6 retry creates a new live authorization after closing the old row', async () => {
        const own = await setup();
        await recordChargeFact(
            { chargeId: own.chargeId },
            {
                provider: own.fake,
                clock,
                beforeCancelNotice: own.beforeCancelNotice,
                cancellationSeen: providerLinkCancellationSeen
            }
        );
        const optionId = own.optionId;
        const retry = await startSubscription(
            { userId: own.userId, billingOptionId: optionId, returnUrl: 'https://example.test' },
            {
                provider: own.fake,
                clock,
                beforeCancelNotice: own.beforeCancelNotice,
                touristVipInheritance: noTouristVip,
                planPolicy: async () => ({
                    graceDays: 10,
                    allowsPause: false,
                    current: true,
                    sellable: true
                })
            }
        );
        expect(retry.authorizationId).not.toBe(own.started.authorizationId);
        expect(retry.checkoutUrl).not.toBe(own.started.checkoutUrl);
        const rows = await getServiceTestDb()
            .select()
            .from(subscriptions)
            .where(eq(subscriptions.userId, own.userId));
        expect(rows.filter((row) => row.status === 'PENDING_AUTHORIZATION')).toHaveLength(1);
        expect(rows.find((row) => row.id === own.started.subscriptionId)?.status).toBe(
            'CHARGE_DECLINED'
        );
    });
});
