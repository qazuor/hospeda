import {
    billingDeadlineVersions,
    billingOptions,
    eq,
    idempotencyKeys,
    plans,
    planVersions,
    providerLinks,
    subscriptionModel,
    subscriptions,
    users
} from '@repo/db';
import { PaymentProviderError } from '@repo/payments';
import { FakePaymentProvider } from '@repo/payments/fake';
import type { BillingDeadlineValues } from '@repo/schemas';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { createAdjustableClock } from '../../../../test-clock/src/adjustable-clock.js';
import {
    CREATION_RECREATE_AFTER_MS,
    runCreationsSweep
} from '../../../src/services/billing/reconciliation/creations/creations-sweep.service.js';
import { startSubscription } from '../../../src/services/billing/subscription/start-subscription.service';
import { closeServiceTestPool, getServiceTestDb } from './helpers';
import {
    createReconciliationFake,
    trackSeededReconciliationRow,
    withSeededPendingCreations
} from './reconciliation-sweep-fixtures.js';
import { namespaceFake } from './support/payment-provider';
import { noTouristVip } from './support/tourist-vip.ts';

const clock = createAdjustableClock({ start: new Date(Date.now() + 20 * 60_000) });
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
    return { user: user!, version: version!, option: option! };
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

    it('TEST:1732:13 leaves token and unavailable failures unfinished', async () => {
        const choice = await seedChoice();
        const fake = new FakePaymentProvider({ clock, idNamespace: crypto.randomUUID() });
        vi.spyOn(fake, 'authorize').mockRejectedValueOnce(
            new PaymentProviderError({
                code: 'REJECTED',
                capability: 'authorize',
                message: 'Rejected with token'
            })
        );
        const input = {
            userId: choice.user.id,
            billingOptionId: choice.option.id,
            returnUrl: 'https://hospeda.example',
            payerEmail: choice.user.email,
            paymentToken: 'once-only'
        };
        await expect(startSubscription(input, ports(fake))).rejects.toMatchObject({
            code: 'REJECTED'
        });
        let [row] = await getServiceTestDb()
            .select()
            .from(subscriptions)
            .where(eq(subscriptions.userId, choice.user.id));
        let [key] = await getServiceTestDb()
            .select()
            .from(idempotencyKeys)
            .where(eq(idempotencyKeys.subjectId, row!.id));
        expect(key!.completedAt).toBeNull();

        const unavailableChoice = await seedChoice();
        const unavailable = new FakePaymentProvider({ clock, idNamespace: crypto.randomUUID() });
        vi.spyOn(unavailable, 'authorize').mockRejectedValueOnce(
            new PaymentProviderError({
                code: 'UNAVAILABLE',
                capability: 'authorize',
                message: 'Provider unavailable'
            })
        );
        await expect(
            startSubscription(
                {
                    ...input,
                    userId: unavailableChoice.user.id,
                    billingOptionId: unavailableChoice.option.id,
                    paymentToken: undefined
                },
                ports(unavailable)
            )
        ).rejects.toMatchObject({ code: 'UNAVAILABLE' });
        [row] = await getServiceTestDb()
            .select()
            .from(subscriptions)
            .where(eq(subscriptions.userId, unavailableChoice.user.id));
        [key] = await getServiceTestDb()
            .select()
            .from(idempotencyKeys)
            .where(eq(idempotencyKeys.subjectId, row!.id));
        expect(key!.completedAt).toBeNull();
    });

    it('TEST:1732:15 keeps other options and expired rejected commitments occupied', async () => {
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
        const otherOption = (
            await getServiceTestDb()
                .insert(billingOptions)
                .values({
                    planVersionId: choice.version.id,
                    cycle: 'quarterly',
                    amount: 250000,
                    currency: 'ARS'
                })
                .returning()
        )[0]!;
        await expect(
            startSubscription({ ...input, billingOptionId: otherOption.id }, ports(fake))
        ).rejects.toMatchObject({ reason: 'COMMITMENT_TAKEN' });
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
        const originalAuthorize = fake.authorize.bind(fake);
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
        const [rejected] = await getServiceTestDb()
            .select()
            .from(idempotencyKeys)
            .where(eq(idempotencyKeys.subjectId, row.id));
        expect(rejected!.result).toMatchObject({ outcome: 'REJECTED_BY_PROVIDER' });
        expect(
            await subscriptionModel.mintKeyAfterRejectedCreation({
                subscriptionId: row.id,
                rejectedKey: 'stale-key',
                declaredPayerEmail: input.payerEmail,
                createdAt: clock.now()
            })
        ).toBeNull();
        let signalStarted!: () => void;
        let release!: () => void;
        const started = new Promise<void>((resolve) => {
            signalStarted = resolve;
        });
        const gate = new Promise<void>((resolve) => {
            release = resolve;
        });
        vi.spyOn(fake, 'authorize').mockImplementation(async (authorizeInput) => {
            signalStarted();
            await gate;
            return originalAuthorize(authorizeInput);
        });
        const winner = startSubscription(input, ports(fake));
        await started;
        await expect(startSubscription(input, ports(fake))).rejects.toMatchObject({
            reason: 'PREVIOUS_ATTEMPT_IN_PROGRESS'
        });
        release();
        await winner;
        const rows = await getServiceTestDb()
            .select()
            .from(subscriptions)
            .where(eq(subscriptions.userId, choice.user.id));
        expect(rows).toHaveLength(1);
    });

    it('TEST:1732:17 annotates each subsequent provider rejection', async () => {
        const choice = await seedChoice();
        const fake = new FakePaymentProvider({ clock, idNamespace: crypto.randomUUID() });
        vi.spyOn(fake, 'authorize')
            .mockRejectedValueOnce(
                new PaymentProviderError({
                    code: 'REJECTED',
                    capability: 'authorize',
                    message: 'Rejected once'
                })
            )
            .mockRejectedValueOnce(
                new PaymentProviderError({
                    code: 'REJECTED',
                    capability: 'authorize',
                    message: 'Rejected twice'
                })
            );
        const input = {
            userId: choice.user.id,
            billingOptionId: choice.option.id,
            returnUrl: 'https://hospeda.example',
            payerEmail: choice.user.email
        };
        await expect(startSubscription(input, ports(fake))).rejects.toMatchObject({
            code: 'REJECTED'
        });
        await expect(startSubscription(input, ports(fake))).rejects.toMatchObject({
            code: 'REJECTED'
        });
        const row = (
            await getServiceTestDb()
                .select()
                .from(subscriptions)
                .where(eq(subscriptions.userId, choice.user.id))
        )[0]!;
        const keys = await getServiceTestDb()
            .select()
            .from(idempotencyKeys)
            .where(eq(idempotencyKeys.subjectId, row.id));
        expect(keys).toHaveLength(2);
        expect(keys.every((key) => key.result && key.completedAt)).toBe(true);
        const result = await startSubscription(input, ports(fake));
        expect(result.subscriptionId).toBe(row.id);
    });

    it('TEST:1732:18 lets the creation sweep recreate and the next S1 request reuse its link', async () => {
        const choice = await seedChoice();
        const { fake, provider } = createReconciliationFake(clock);
        vi.spyOn(fake, 'authorize').mockRejectedValueOnce(
            new PaymentProviderError({
                code: 'REJECTED',
                capability: 'authorize',
                message: 'Rejected before sweep'
            })
        );
        const input = {
            userId: choice.user.id,
            billingOptionId: choice.option.id,
            returnUrl: 'https://hospeda.example',
            payerEmail: choice.user.email
        };
        await expect(startSubscription(input, { ...ports(fake), provider })).rejects.toMatchObject({
            code: 'REJECTED'
        });
        const row = (
            await getServiceTestDb()
                .select()
                .from(subscriptions)
                .where(eq(subscriptions.userId, choice.user.id))
        )[0]!;
        trackSeededReconciliationRow(row.id);
        clock.advance({ ms: CREATION_RECREATE_AFTER_MS + 1 });
        const summary = await withSeededPendingCreations(() =>
            runCreationsSweep({}, { provider, clock, returnUrl: input.returnUrl })
        );
        expect(summary).toMatchObject({ rowsExamined: 1, recreated: 1 });
        const result = await startSubscription(input, { ...ports(fake), provider });
        expect(result.subscriptionId).toBe(row.id);
        expect(vi.mocked(fake.authorize)).toHaveBeenCalledTimes(2);
    });
});
