import {
    billingDeadlineVersions,
    billingOptions,
    createManualPendingAuthorization,
    eq,
    getDb,
    idempotencyKeys,
    manualPaymentModel,
    manualPayments,
    plans,
    planVersions,
    providerLinks,
    subscriptionModel,
    subscriptions,
    users
} from '@repo/db';
import { FakePaymentProvider } from '@repo/payments/fake';
import type { BillingDeadlineValues } from '@repo/schemas';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { expireAuthorizationWindows } from '../../../src/services/billing/subscription/expire-authorization-windows.service';
import { startManualSubscription } from '../../../src/services/billing/subscription/start-manual-subscription.service';
import { startSubscription } from '../../../src/services/billing/subscription/start-subscription.service';
import { closeServiceTestPool, getServiceTestDb } from './helpers';
import { noTouristVip } from './support/tourist-vip';

const openedAt = new Date('2026-10-08T20:00:00.000Z');
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
        .values({ version: 1000, values: deadlines })
        .onConflictDoNothing();
});
afterAll(closeServiceTestPool);

async function seedChoice(vertical: 'partner' | 'accommodation' = 'partner') {
    const db = getServiceTestDb();
    const [user] = await db
        .insert(users)
        .values({
            email: `manual-start-${crypto.randomUUID()}@example.test`,
            displayName: 'Manual signup user',
            emailVerified: true,
            lifecycleState: 'ACTIVE'
        })
        .returning();
    if (!user) throw new Error('User seed failed');
    const [plan] = await db
        .insert(plans)
        .values({
            vertical,
            slug: `manual-start-${crypto.randomUUID()}`,
            name: 'Manual signup plan'
        })
        .returning();
    if (!plan) throw new Error('Plan seed failed');
    const [version] = await db
        .insert(planVersions)
        .values({
            planId: plan.id,
            vertical,
            rank: Math.floor(Math.random() * 100000000) + 1000,
            sellable: true,
            current: true,
            trialDays: 0,
            allowsPause: false
        })
        .returning();
    if (!version) throw new Error('Version seed failed');
    const [option] = await db
        .insert(billingOptions)
        .values({
            planVersionId: version.id,
            cycle: 'monthly',
            amount: 3000000,
            currency: 'ARS'
        })
        .returning();
    if (!option) throw new Error('Option seed failed');
    return { user, version, option };
}

function makePorts() {
    let now = openedAt;
    const clock = { now: () => now };
    const provider = new FakePaymentProvider({ clock, idNamespace: crypto.randomUUID() });
    const authorize = vi.spyOn(provider, 'authorize');
    const readAuthorization = vi.spyOn(provider, 'readAuthorization');
    const cancel = vi.spyOn(provider, 'cancel');
    return {
        ports: {
            provider,
            clock,
            planPolicy: async () => ({
                graceDays: 10,
                allowsPause: false,
                current: true,
                sellable: true
            }),
            beforeCancelNotice: { beforeCancel: async () => 'SENT' as const },
            touristVipInheritance: noTouristVip
        },
        authorize,
        readAuthorization,
        cancel,
        advance: () => {
            now = new Date(openedAt.getTime() + 7 * 24 * 60 * 60 * 1000 + 1);
        }
    };
}

async function ownRows(userId: string) {
    const db = getServiceTestDb();
    const owned = await db.select().from(subscriptions).where(eq(subscriptions.userId, userId));
    const installments = await Promise.all(
        owned.map((row) =>
            db.select().from(manualPayments).where(eq(manualPayments.subscriptionId, row.id))
        )
    );
    return { subscriptions: owned, installments: installments.flat() };
}

describe('manual S1 signup', () => {
    it('TEST:B3:4 opens one manual installment without a provider call or creation key', async () => {
        // Arrange
        const { user, option } = await seedChoice();
        const { ports, authorize, readAuthorization, cancel } = makePorts();

        // Act
        const result = await startManualSubscription(
            { userId: user.id, billingOptionId: option.id },
            ports
        );
        const rows = await ownRows(user.id);
        const keys = await getServiceTestDb()
            .select()
            .from(idempotencyKeys)
            .where(eq(idempotencyKeys.subjectId, result.subscriptionId));
        const links = await getServiceTestDb()
            .select()
            .from(providerLinks)
            .where(eq(providerLinks.subscriptionId, result.subscriptionId));

        // Assert
        expect(rows.subscriptions).toHaveLength(1);
        expect(rows.subscriptions[0]).toMatchObject({
            id: result.subscriptionId,
            paymentMethod: 'MANUAL',
            class: 'PRINCIPAL',
            status: 'PENDING_AUTHORIZATION',
            authorizationWindowDeadlineVersion: 1000,
            nextChargeAt: null,
            firstChargeAt: null
        });
        expect(result.authorizationWindowEndsAt.getTime() - openedAt.getTime()).toBe(
            7 * 24 * 60 * 60 * 1000
        );
        expect(rows.subscriptions[0]?.authorizationWindowEndsAt).toEqual(
            result.authorizationWindowEndsAt
        );
        expect(rows.installments).toHaveLength(1);
        expect(rows.installments[0]).toMatchObject({
            id: result.manualPaymentId,
            status: 'AWAITING',
            periodStart: openedAt,
            registeredBy: null,
            registeredAt: null,
            proofRef: null
        });
        expect(result.periodStart).toEqual(openedAt);
        expect(keys).toHaveLength(0);
        expect(links).toHaveLength(0);
        expect(authorize).toHaveBeenCalledTimes(0);
        expect(readAuthorization).toHaveBeenCalledTimes(0);
        expect(cancel).toHaveBeenCalledTimes(0);
    });

    it('retries the same option by returning the same subscription and installment', async () => {
        const { user, option } = await seedChoice();
        const { ports } = makePorts();
        const input = { userId: user.id, billingOptionId: option.id };
        const first = await startManualSubscription(input, ports);
        const second = await startManualSubscription(input, ports);
        const rows = await ownRows(user.id);
        expect(second).toEqual(first);
        expect(rows.subscriptions).toHaveLength(1);
        expect(rows.installments).toHaveLength(1);
    });

    it('allows one commitment and one installment across five concurrent calls', async () => {
        const { user, option } = await seedChoice();
        const { ports } = makePorts();
        const settled = await Promise.all(
            Array.from({ length: 5 }, () =>
                startManualSubscription(
                    { userId: user.id, billingOptionId: option.id },
                    ports
                ).then(
                    (value) => ({ value }),
                    (error: unknown) => ({ error })
                )
            )
        );
        const rows = await ownRows(user.id);
        expect(rows.subscriptions).toHaveLength(1);
        expect(rows.installments).toHaveLength(1);
        for (const item of settled) {
            if ('value' in item) expect(item.value?.subscriptionId).toBe(rows.subscriptions[0]?.id);
            else expect(item.error).toMatchObject({ reason: 'COMMITMENT_TAKEN' });
        }
    });

    it('rejects a different option while the manual commitment is live', async () => {
        const { user, version, option } = await seedChoice();
        const [other] = await getServiceTestDb()
            .insert(billingOptions)
            .values({
                planVersionId: version.id,
                cycle: 'annual',
                amount: 30000000,
                currency: 'ARS'
            })
            .returning();
        if (!other) throw new Error('Second option seed failed');
        const { ports } = makePorts();
        await startManualSubscription({ userId: user.id, billingOptionId: option.id }, ports);
        const error = await startManualSubscription(
            { userId: user.id, billingOptionId: other.id },
            ports
        ).then(
            () => null,
            (caught: unknown) => caught
        );
        const rows = await ownRows(user.id);
        expect(error).toMatchObject({ code: 'ALREADY_EXISTS', reason: 'COMMITMENT_TAKEN' });
        expect(rows.subscriptions).toHaveLength(1);
        expect(rows.installments).toHaveLength(1);
    });

    it('rejects a non-manual vertical before writing rows', async () => {
        const { user, option } = await seedChoice('accommodation');
        const { ports } = makePorts();
        const error = await startManualSubscription(
            { userId: user.id, billingOptionId: option.id },
            ports
        ).then(
            () => null,
            (caught: unknown) => caught
        );
        const rows = await ownRows(user.id);
        expect(error).toMatchObject({
            code: 'VALIDATION_ERROR',
            reason: 'MANUAL_PAYMENT_NOT_AVAILABLE'
        });
        expect(rows.subscriptions).toHaveLength(0);
        expect(rows.installments).toHaveLength(0);
    });

    it('soporte: S3 abandons the expired manual row and declares its installment unpaid', async () => {
        const { user, option } = await seedChoice();
        const { ports, advance, readAuthorization, cancel } = makePorts();
        const result = await startManualSubscription(
            { userId: user.id, billingOptionId: option.id },
            ports
        );
        advance();
        const original = subscriptionModel.findExpiredAuthorizationWindows.bind(subscriptionModel);
        const selector = vi
            .spyOn(subscriptionModel, 'findExpiredAuthorizationWindows')
            .mockImplementation(async (input) =>
                (await original({ ...input, limit: 10_000 })).filter(
                    (row) => row.subscription.id === result.subscriptionId
                )
            );
        try {
            const summary = await expireAuthorizationWindows(10, ports);
            expect(summary).toMatchObject({ abandoned: 1, failed: 0 });
        } finally {
            selector.mockRestore();
        }
        const rows = await ownRows(user.id);
        expect(rows.subscriptions).toHaveLength(1);
        expect(rows.subscriptions[0]?.status).toBe('ABANDONED');
        expect(rows.installments).toHaveLength(1);
        expect(rows.installments[0]?.status).toBe('DECLARED_UNPAID');
        expect(readAuthorization).toHaveBeenCalledTimes(0);
        expect(cancel).toHaveBeenCalledTimes(0);
    });

    it('card S1 treats an existing manual row as COMMITMENT_TAKEN', async () => {
        const { user, version, option } = await seedChoice('accommodation');
        const { ports } = makePorts();
        await getDb().transaction(async (tx) => {
            const row = await createManualPendingAuthorization({
                userId: user.id,
                vertical: 'accommodation',
                planVersionId: version.id,
                billingOptionId: option.id,
                authorizationWindowDeadlineVersion: 1,
                authorizationWindowEndsAt: new Date(openedAt.getTime() + 7 * 24 * 60 * 60 * 1000),
                tx
            });
            await manualPaymentModel.insertAwaitingInstallment({
                subscriptionId: row.id,
                periodStart: openedAt,
                tx
            });
        });
        const error = await startSubscription(
            {
                userId: user.id,
                billingOptionId: option.id,
                returnUrl: 'https://example.test'
            },
            ports
        ).then(
            () => null,
            (caught: unknown) => caught
        );
        expect(error).toMatchObject({ code: 'ALREADY_EXISTS', reason: 'COMMITMENT_TAKEN' });
    });

    it('rolls back the subscription when opening the installment fails', async () => {
        const { user, option } = await seedChoice();
        const { ports } = makePorts();
        const insert = vi
            .spyOn(manualPaymentModel, 'insertAwaitingInstallment')
            .mockRejectedValueOnce(new Error('boom'));
        try {
            await expect(
                startManualSubscription({ userId: user.id, billingOptionId: option.id }, ports)
            ).rejects.toThrow('boom');
        } finally {
            insert.mockRestore();
        }
        const rows = await ownRows(user.id);
        expect(rows.subscriptions).toHaveLength(0);
        expect(rows.installments).toHaveLength(0);
    });
});
