import { eq, payments, users } from '@repo/db';
import { FakePaymentProvider } from '@repo/payments/fake';
import { afterAll, describe, expect, it, vi } from 'vitest';
import { recordChargeFact } from '../../../src/services/billing/payment/record-charge-fact.service';
import { providerLinkCancellationSeen } from '../../../src/services/billing/subscription/provider-link-cancellation-seen';
import { startSubscription } from '../../../src/services/billing/subscription/start-subscription.service';
import { closeServiceTestPool, getServiceTestDb, getServiceTestPool } from './helpers';
import { noTouristVip } from './support/tourist-vip';

afterAll(closeServiceTestPool);
const now = new Date('2026-10-01T03:00:00.000Z');
const clock = { now: () => new Date(now) };

describe('TEST:1734 rejected charge without a retry window', () => {
    it('TEST:1734:1 fails the payment for a cancelled pending signup', async () => {
        const [user] = await getServiceTestDb()
            .insert(users)
            .values({
                email: `hos1734-${crypto.randomUUID()}@example.test`,
                displayName: 'HOS-1734',
                emailVerified: true,
                lifecycleState: 'ACTIVE'
            })
            .returning();
        if (!user) throw new Error('Missing user');
        const planId = (
            await getServiceTestPool().query<{ id: string }>(
                'INSERT INTO plan (vertical, slug, name) VALUES ($1, $2, $3) RETURNING id',
                ['accommodation', `hos1734-${crypto.randomUUID()}`, 'Plan']
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
        await fake.cancel({ authorizationId: started.authorizationId });
        const read = await fake.readCharge({ chargeId: charge.chargeId });
        expect(read.snapshot.expiresAt).toBeNull();
        const result = await recordChargeFact(
            { chargeId: charge.chargeId },
            {
                provider: fake,
                clock,
                beforeCancelNotice,
                cancellationSeen: providerLinkCancellationSeen
            }
        );
        if (result.outcome !== 'DECLINED') throw new Error('Expected decline result');
        const [payment] = await getServiceTestDb()
            .select({ status: payments.status, version: payments.version })
            .from(payments)
            .where(eq(payments.id, result.paymentId));
        expect(payment).toEqual({ status: 'FAILED', version: 2 });
        expect(result).toMatchObject({ terminalRejection: { outcome: 'FAILED' } });
    });
});
