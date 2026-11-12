import {
    and,
    billingOptions,
    buildEmailDedupKey,
    buildEventOccurrence,
    emailOutbox,
    eq,
    getDb,
    inArray,
    manualPayments,
    plans,
    planVersions,
    sql,
    subscriptions,
    users
} from '@repo/db';
import { registerHook, unregisterHook } from '@repo/logger';
import { FakePaymentProvider } from '@repo/payments/fake';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { enqueueManualInstallmentOpenedNotice } from '../../../src/services/billing/subscription/manual-installment-opened-notice';
import { openDueManualInstallments } from '../../../src/services/billing/subscription/open-manual-installment.service';
import { startManualSubscription } from '../../../src/services/billing/subscription/start-manual-subscription.service';
import { closeServiceTestPool, getServiceTestDb } from './helpers';
import { noTouristVip } from './support/tourist-vip';

const baseTime = new Date('2026-10-08T20:00:00.000Z');
const ownerIds: string[] = [];
const versionIds: string[] = [];

async function seed(vertical: 'partner' | 'accommodation' = 'partner') {
    const db = getServiceTestDb();
    const [owner] = await db
        .insert(users)
        .values({
            email: `opened-${crypto.randomUUID()}@example.test`,
            displayName: 'Installment owner',
            emailVerified: true,
            lifecycleState: 'ACTIVE'
        })
        .returning();
    if (!owner) throw new Error('Owner seed failed');
    ownerIds.push(owner.id);
    const [plan] = await db
        .insert(plans)
        .values({
            vertical,
            slug: `opened-${crypto.randomUUID()}`,
            name: 'Opened plan'
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
    versionIds.push(version.id);
    const [option] = await db
        .insert(billingOptions)
        .values({
            planVersionId: version.id,
            cycle: 'monthly',
            amount: 3_000_000,
            currency: 'ARS'
        })
        .returning();
    if (!option) throw new Error('Option seed failed');
    return { owner, plan, version, option };
}

function startPorts() {
    const clock = { now: () => baseTime };
    return {
        clock,
        provider: new FakePaymentProvider({ clock, idNamespace: crypto.randomUUID() }),
        planPolicy: async () => ({
            graceDays: 9,
            allowsPause: false,
            current: true,
            sellable: true
        }),
        beforeCancelNotice: { beforeCancel: async () => 'SENT' as const },
        touristVipInheritance: noTouristVip
    };
}

async function ownerMail(userId: string) {
    return getServiceTestDb()
        .select()
        .from(emailOutbox)
        .where(
            and(
                eq(emailOutbox.recipientUserId, userId),
                eq(emailOutbox.template, 'billing.manual-installment-opened')
            )
        );
}

afterEach(async () => {
    if (ownerIds.length === 0) return;
    const db = getServiceTestDb();
    const owned = await db
        .select({ id: subscriptions.id })
        .from(subscriptions)
        .where(inArray(subscriptions.userId, ownerIds));
    const subscriptionIds = owned.map((row) => row.id);
    await db.delete(emailOutbox).where(inArray(emailOutbox.recipientUserId, ownerIds));
    if (subscriptionIds.length > 0) {
        await db
            .delete(manualPayments)
            .where(inArray(manualPayments.subscriptionId, subscriptionIds));
        await db.delete(subscriptions).where(inArray(subscriptions.id, subscriptionIds));
    }
    if (versionIds.length > 0) {
        await db.delete(billingOptions).where(inArray(billingOptions.planVersionId, versionIds));
        versionIds.splice(0);
    }
    await db.delete(users).where(inArray(users.id, ownerIds.splice(0)));
});

afterAll(closeServiceTestPool);

describe('HOS-2130 manual installment opened integration', () => {
    it('enqueues one owner mail with plan, amount and due date when manual S1 opens the first installment', async () => {
        // Arrange
        const { owner, plan, option } = await seed();
        // Act
        const result = await startManualSubscription(
            { userId: owner.id, billingOptionId: option.id },
            startPorts()
        );
        const rows = await ownerMail(owner.id);
        // Assert
        expect(rows).toHaveLength(1);
        expect(rows[0]?.recipientEmail).toBe(owner.email);
        expect(rows[0]?.payload).toEqual({
            manualPaymentId: result.manualPaymentId,
            subscriptionId: result.subscriptionId,
            locale: 'es',
            planSlug: plan.slug,
            planName: plan.name,
            amountMinor: 3_000_000,
            currency: 'ARS',
            dueAt: result.authorizationWindowEndsAt.toISOString(),
            firstInstallment: true
        });
        expect(rows[0]?.dedupKey).toBe(
            buildEmailDedupKey({
                recipient: owner.id,
                template: 'billing.manual-installment-opened',
                occurrence: buildEventOccurrence({ eventId: result.manualPaymentId })
            })
        );
    });

    it("leaves no owner mail when the caller's transaction rolls back", async () => {
        // Arrange
        const { owner, option } = await seed();
        // Act
        await expect(
            getDb().transaction(async (tx) => {
                await startManualSubscription(
                    { userId: owner.id, billingOptionId: option.id, tx },
                    startPorts()
                );
                throw new Error('rollback');
            })
        ).rejects.toThrow('rollback');
        // Assert
        expect(await ownerMail(owner.id)).toEqual([]);
        expect(
            await getServiceTestDb()
                .select()
                .from(subscriptions)
                .where(eq(subscriptions.userId, owner.id))
        ).toEqual([]);
    });

    it('keeps one owner mail across a retry and five concurrent starts', async () => {
        // Arrange
        const fixtures = await Promise.all(Array.from({ length: 5 }, () => seed()));
        // Act
        await Promise.all(
            fixtures.map(({ owner, option }) =>
                startManualSubscription(
                    { userId: owner.id, billingOptionId: option.id },
                    startPorts()
                )
            )
        );
        await Promise.all(
            fixtures.map(({ owner, option }) =>
                startManualSubscription(
                    { userId: owner.id, billingOptionId: option.id },
                    startPorts()
                )
            )
        );
        // Assert
        for (const { owner } of fixtures) {
            const mails = await ownerMail(owner.id);
            expect(mails).toHaveLength(1);
            expect(mails[0]?.payload).toMatchObject({ amountMinor: 3_000_000, currency: 'ARS' });
        }
    });

    it('mails the owner once when the clock opens a renewal in grace', async () => {
        // Arrange
        const { owner, version, option, plan } = await seed();
        const [subscription] = await getServiceTestDb()
            .insert(subscriptions)
            .values({
                userId: owner.id,
                vertical: 'partner',
                class: 'PRINCIPAL',
                status: 'ACTIVE',
                paymentMethod: 'MANUAL',
                planVersionId: version.id,
                billingOptionId: option.id,
                nextChargeAt: baseTime
            })
            .returning();
        if (!subscription) throw new Error('Subscription seed failed');
        await getServiceTestDb()
            .insert(manualPayments)
            .values({
                subscriptionId: subscription.id,
                periodStart: new Date(baseTime.getTime() - 30 * 86_400_000),
                status: 'REGISTERED',
                registeredBy: owner.id,
                registeredAt: baseTime
            });
        const ports = { ...startPorts(), clock: { now: () => baseTime } };
        // Act
        await openDueManualInstallments({ pageSize: 1000 }, ports);
        await openDueManualInstallments({ pageSize: 1000 }, ports);
        const rows = await ownerMail(owner.id);
        const opened = await getServiceTestDb()
            .select()
            .from(manualPayments)
            .where(
                and(
                    eq(manualPayments.subscriptionId, subscription.id),
                    eq(manualPayments.periodStart, baseTime)
                )
            );
        // Assert
        expect(rows).toHaveLength(1);
        expect(opened).toHaveLength(1);
        expect(rows[0]?.payload).toEqual({
            manualPaymentId: opened[0]?.id,
            subscriptionId: subscription.id,
            locale: 'es',
            planSlug: plan.slug,
            planName: plan.name,
            amountMinor: 3_000_000,
            currency: 'ARS',
            dueAt: new Date(baseTime.getTime() + 9 * 86_400_000).toISOString(),
            firstInstallment: false
        });
    });

    it('does not mail the owner when the renewal opens without grace', async () => {
        // Arrange
        const { owner, version, option } = await seed();
        await getServiceTestDb().insert(subscriptions).values({
            userId: owner.id,
            vertical: 'partner',
            class: 'PRINCIPAL',
            status: 'ACTIVE',
            paymentMethod: 'MANUAL',
            planVersionId: version.id,
            billingOptionId: option.id,
            nextChargeAt: baseTime
        });
        // Act
        await openDueManualInstallments(
            { pageSize: 1000 },
            {
                ...startPorts(),
                clock: { now: () => baseTime }
            }
        );
        // Assert
        expect(await ownerMail(owner.id)).toEqual([]);
    });

    it('writes the account locale into the payload', async () => {
        // Arrange
        const { owner, option } = await seed();
        await getServiceTestDb()
            .update(users)
            .set({ settings: sql`jsonb_set(settings, '{languageWeb}', '\"en\"')` })
            .where(eq(users.id, owner.id));
        // Act
        const result = await startManualSubscription(
            { userId: owner.id, billingOptionId: option.id },
            startPorts()
        );
        const rows = await ownerMail(owner.id);
        // Assert
        expect(rows[0]?.payload.locale).toBe('en');
        expect(rows[0]?.payload.manualPaymentId).toBe(result.manualPaymentId);
    });

    it('enqueues the same installment only once', async () => {
        // Arrange
        const { owner, option } = await seed();
        const started = await startManualSubscription(
            { userId: owner.id, billingOptionId: option.id },
            startPorts()
        );
        const [subscription] = await getServiceTestDb()
            .select()
            .from(subscriptions)
            .where(eq(subscriptions.id, started.subscriptionId));
        if (!subscription) throw new Error('Subscription read failed');
        await getServiceTestDb()
            .delete(emailOutbox)
            .where(
                and(
                    eq(emailOutbox.recipientUserId, owner.id),
                    eq(emailOutbox.template, 'billing.manual-installment-opened')
                )
            );
        // Act
        const results = await getDb().transaction(async (tx) => {
            const first = await enqueueManualInstallmentOpenedNotice({
                tx,
                subscription,
                manualPaymentId: started.manualPaymentId,
                periodStart: started.periodStart,
                dueAt: started.authorizationWindowEndsAt,
                firstInstallment: true
            });
            const second = await enqueueManualInstallmentOpenedNotice({
                tx,
                subscription,
                manualPaymentId: started.manualPaymentId,
                periodStart: started.periodStart,
                dueAt: started.authorizationWindowEndsAt,
                firstInstallment: true
            });
            return [first, second];
        });
        // Assert
        expect(results).toEqual([{ enqueued: true }, { enqueued: false }]);
        expect(await ownerMail(owner.id)).toHaveLength(1);
    });

    it('keeps the installment open and mails a null amount when calculation fails', async () => {
        const { owner, plan, version, option } = await seed();
        const [subscription] = await getServiceTestDb()
            .insert(subscriptions)
            .values({
                userId: owner.id,
                vertical: 'partner',
                class: 'PRINCIPAL',
                status: 'ACTIVE',
                paymentMethod: 'MANUAL',
                planVersionId: version.id,
                billingOptionId: option.id,
                nextChargeAt: baseTime
            })
            .returning();
        if (!subscription) throw new Error('Subscription seed failed');
        const calculationError = new Error('expected amount failed');
        const logEntries: Array<{
            level: string;
            category?: string;
            message: string;
            data?: unknown;
        }> = [];
        const hookName = 'manual-installment-opened-test';
        registerHook(hookName, (entry) => {
            logEntries.push(entry);
        });

        try {
            const [manualPayment] = await getDb().transaction(async (tx) => {
                const [payment] = await tx
                    .insert(manualPayments)
                    .values({
                        subscriptionId: subscription.id,
                        periodStart: baseTime,
                        status: 'AWAITING'
                    })
                    .returning();
                if (!payment) throw new Error('Manual installment seed failed');
                await enqueueManualInstallmentOpenedNotice(
                    {
                        tx,
                        subscription,
                        manualPaymentId: payment.id,
                        periodStart: baseTime,
                        dueAt: new Date(baseTime.getTime() + 9 * 86_400_000),
                        firstInstallment: false
                    },
                    {
                        expectedAmounts: {
                            expectedAmount: async () => {
                                throw calculationError;
                            }
                        }
                    }
                );
                return [payment];
            });

            expect(manualPayment).toBeDefined();
            expect(await ownerMail(owner.id)).toMatchObject([
                {
                    payload: {
                        manualPaymentId: manualPayment?.id,
                        planSlug: plan.slug,
                        amountMinor: null
                    }
                }
            ]);
            expect(logEntries).toContainEqual(
                expect.objectContaining({
                    level: 'ERROR',
                    category: 'manual-installment-opened-notice',
                    message: 'Could not calculate installment amount',
                    data: expect.objectContaining({
                        error: expect.objectContaining({ message: calculationError.message }),
                        subscriptionId: subscription.id
                    })
                })
            );
        } finally {
            unregisterHook(hookName);
        }
    });

    it('does not mail the owner of a manual renewal outside partner', async () => {
        // Arrange
        const { owner, version, option } = await seed('accommodation');
        const [subscription] = await getServiceTestDb()
            .insert(subscriptions)
            .values({
                userId: owner.id,
                vertical: 'accommodation',
                class: 'PRINCIPAL',
                status: 'ACTIVE',
                paymentMethod: 'MANUAL',
                planVersionId: version.id,
                billingOptionId: option.id,
                nextChargeAt: baseTime
            })
            .returning();
        if (!subscription) throw new Error('Subscription seed failed');
        await getServiceTestDb()
            .insert(manualPayments)
            .values({
                subscriptionId: subscription.id,
                periodStart: new Date(baseTime.getTime() - 30 * 86_400_000),
                status: 'REGISTERED',
                registeredBy: owner.id,
                registeredAt: baseTime
            });
        // Act
        await openDueManualInstallments(
            { pageSize: 1000 },
            { ...startPorts(), clock: { now: () => baseTime } }
        );
        // Assert
        expect(await ownerMail(owner.id)).toEqual([]);
    });
});
