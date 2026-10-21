import {
    billingDeadlineVersions,
    billingOptions,
    eq,
    idempotencyKeys,
    plans,
    planVersions,
    providerLinks,
    subscriptions,
    users
} from '@repo/db';
import { PaymentProviderError } from '@repo/payments';
import { FakePaymentProvider } from '@repo/payments/fake';
import type { BillingDeadlineValues } from '@repo/schemas';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { createAdjustableClock } from '../../../../test-clock/src/adjustable-clock.js';
import { startSubscription } from '../../../src/services/billing/subscription/start-subscription.service';
import { closeServiceTestPool, getServiceTestDb } from './helpers';
import { namespaceFake } from './support/payment-provider';
import { noTouristVip } from './support/tourist-vip.ts';

const clock = createAdjustableClock({ start: new Date('2026-10-08T20:00:00.000Z') });
const deadlines = {
    '10': { cardHours: 72, manualDays: 7 },
    '11': { noticeDays: 60, contactDays: [30, 7] },
    '12': { noticeDays: 60, contactDays: [30, 7] },
    '13': { daysBefore: [5, 1] },
    '14': { daysBefore: 7 },
    '15': { hoursRemaining: 24 },
    '16': { days: 7 },
    '17': { days: 7 },
    '18': { days: 180 },
    '19': { minutes: 60 }
} satisfies BillingDeadlineValues;

beforeAll(async () => {
    await getServiceTestDb()
        .insert(billingDeadlineVersions)
        .values({ version: 1, values: deadlines })
        .onConflictDoNothing();
});
afterAll(closeServiceTestPool);

async function seedChoice() {
    const db = getServiceTestDb();
    const [user] = await db
        .insert(users)
        .values({
            email: `retry-${crypto.randomUUID()}@example.test`,
            displayName: 'Retry user',
            emailVerified: true,
            lifecycleState: 'ACTIVE'
        })
        .returning();
    const [plan] = await db
        .insert(plans)
        .values({ vertical: 'accommodation', slug: `retry-${crypto.randomUUID()}`, name: 'Basic' })
        .returning();
    const [version] = await db
        .insert(planVersions)
        .values({
            planId: plan!.id,
            vertical: 'accommodation',
            rank: Math.floor(Math.random() * 100000000) + 1000,
            sellable: true,
            current: true,
            trialDays: 0,
            allowsPause: false
        })
        .returning();
    const [option] = await db
        .insert(billingOptions)
        .values({ planVersionId: version!.id, cycle: 'monthly', amount: 100000, currency: 'ARS' })
        .returning();
    return { user: user!, option: option! };
}

function ports(provider: FakePaymentProvider) {
    return {
        provider: namespaceFake(provider),
        clock,
        planPolicy: async () => ({
            graceDays: 10,
            allowsPause: false,
            current: true,
            sellable: true
        }),
        beforeCancelNotice: { beforeCancel: async () => 'SENT' as const },
        touristVipInheritance: noTouristVip
    };
}

async function rejectOnce(fake: FakePaymentProvider) {
    vi.spyOn(fake, 'authorize').mockRejectedValueOnce(
        new PaymentProviderError({
            code: 'REJECTED',
            capability: 'authorize',
            message: 'Rejected by fake provider'
        })
    );
}

describe('subscription start after rejected creation', () => {
    it('TEST:1732:13 records the uncarded creation rejection and leaves it unlinked', async () => {
        const choice = await seedChoice();
        const fake = new FakePaymentProvider({ clock, idNamespace: crypto.randomUUID() });
        await rejectOnce(fake);
        const input = {
            userId: choice.user.id,
            billingOptionId: choice.option.id,
            returnUrl: 'https://hospeda.example',
            payerEmail: choice.user.email
        };
        await expect(startSubscription(input, ports(fake))).rejects.toMatchObject({
            code: 'REJECTED',
            capability: 'authorize'
        });
        const [row] = await getServiceTestDb()
            .select()
            .from(subscriptions)
            .where(eq(subscriptions.userId, choice.user.id));
        const [key] = await getServiceTestDb()
            .select()
            .from(idempotencyKeys)
            .where(eq(idempotencyKeys.subjectId, row!.id));
        expect(key).toMatchObject({
            result: { outcome: 'REJECTED_BY_PROVIDER', code: 'REJECTED' },
            completedAt: clock.now()
        });
        expect(
            await getServiceTestDb()
                .select()
                .from(providerLinks)
                .where(eq(providerLinks.subscriptionId, row!.id))
        ).toHaveLength(0);
    });

    it('TEST:1732:14 retries with a new email on the same row', async () => {
        const choice = await seedChoice();
        const fake = new FakePaymentProvider({ clock, idNamespace: crypto.randomUUID() });
        const authorize = vi.spyOn(fake, 'authorize');
        await rejectOnce(fake);
        const input = {
            userId: choice.user.id,
            billingOptionId: choice.option.id,
            returnUrl: 'https://hospeda.example',
            payerEmail: choice.user.email
        };
        await expect(startSubscription(input, ports(fake))).rejects.toMatchObject({
            code: 'REJECTED'
        });
        const secondEmail = 'second@example.test';
        const result = await startSubscription({ ...input, payerEmail: secondEmail }, ports(fake));
        const rows = await getServiceTestDb()
            .select()
            .from(subscriptions)
            .where(eq(subscriptions.userId, choice.user.id));
        expect(rows).toHaveLength(1);
        expect(result.subscriptionId).toBe(rows[0]!.id);
        expect(rows[0]!.declaredPayerEmail).toBe(secondEmail);
        expect(authorize).toHaveBeenCalledTimes(2);
    });

    it('TEST:1732:15 keeps expired rejected commitments occupied', async () => {
        const choice = await seedChoice();
        const fake = new FakePaymentProvider({ clock, idNamespace: crypto.randomUUID() });
        await rejectOnce(fake);
        const input = {
            userId: choice.user.id,
            billingOptionId: choice.option.id,
            returnUrl: 'https://hospeda.example',
            payerEmail: choice.user.email
        };
        await expect(startSubscription(input, ports(fake))).rejects.toMatchObject({
            code: 'REJECTED'
        });
        const row = (
            await getServiceTestDb()
                .select()
                .from(subscriptions)
                .where(eq(subscriptions.userId, choice.user.id))
        )[0]!;
        await getServiceTestDb()
            .update(subscriptions)
            .set({ authorizationWindowEndsAt: clock.now() })
            .where(eq(subscriptions.id, row.id));
        await expect(startSubscription(input, ports(fake))).rejects.toMatchObject({
            reason: 'COMMITMENT_TAKEN'
        });
    });

    it('TEST:1732:16 lets one concurrent retry mint the next key', async () => {
        const choice = await seedChoice();
        const fake = new FakePaymentProvider({ clock, idNamespace: crypto.randomUUID() });
        await rejectOnce(fake);
        const input = {
            userId: choice.user.id,
            billingOptionId: choice.option.id,
            returnUrl: 'https://hospeda.example',
            payerEmail: choice.user.email
        };
        await expect(startSubscription(input, ports(fake))).rejects.toMatchObject({
            code: 'REJECTED'
        });
        const results = await Promise.allSettled([
            startSubscription(input, ports(fake)),
            startSubscription(input, ports(fake))
        ]);
        expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
        expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
        expect(results.find((result) => result.status === 'rejected')).toMatchObject({
            reason: { reason: 'PREVIOUS_ATTEMPT_IN_PROGRESS' }
        });
        const rows = await getServiceTestDb()
            .select()
            .from(subscriptions)
            .where(eq(subscriptions.userId, choice.user.id));
        expect(rows).toHaveLength(1);
    });
});
