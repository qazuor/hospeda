import {
    billingDeadlineVersions,
    billingOptions,
    coveredPeriods,
    emailOutbox,
    eq,
    inArray,
    manualPayments,
    payments,
    plans,
    planVersions,
    providerLinks,
    subscriptions,
    users
} from '@repo/db';
import type { FakePaymentProvider } from '@repo/payments/fake';
import { getServiceTestDb } from '../helpers.js';

const trackedUsers: string[] = [];
const trackedSubscriptions: string[] = [];
const trackedPlans: string[] = [];
const trackedVersions: string[] = [];
const trackedOptions: string[] = [];

const trackedAuthorizations: { fake: FakePaymentProvider; id: string }[] = [];
export const cancelActiveNow = new Date('2026-10-14T12:00:00.000Z');

export async function seedCancelActive(input: {
    fake: FakePaymentProvider;
    cycle?: string;
    payment?: 'payment' | 'manual' | 'none';
    periodStart?: Date;
    status?: string;
    class?: string;
    nextChargeAt?: Date;
    paymentMethod?: 'CARD' | 'MANUAL';
    withLink?: boolean;
    credit?: {
        readonly firstChargeAt: Date;
        readonly windowEndsAt: Date;
        readonly closed?: boolean;
    };
    futureFirstChargeAt?: Date;
    additionalOpenPeriodStart?: Date;
    releasedPeriodStart?: Date;
}) {
    if (input.credit) {
        await getServiceTestDb()
            .insert(billingDeadlineVersions)
            .values({
                version: 1,
                values: {
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
                }
            })
            .onConflictDoNothing();
    }
    const auth = await input.fake.authorize({
        reference: `s11-${crypto.randomUUID()}`,
        amount: { amountMinor: 10000, currency: 'ARS' },
        cadence: { everyMonths: 1 },
        reason: 'S11 integration',
        returnUrl: 'https://example.test/return',
        payerEmail: `s11-${crypto.randomUUID()}@example.test`
    });
    await input.fake.approve({ authorizationId: auth.authorizationId });
    const data = await getServiceTestDb().transaction(async (tx) => {
        const [user] = await tx
            .insert(users)
            .values({
                email: `s11-${crypto.randomUUID()}@example.test`,
                displayName: 'S11 test',
                emailVerified: true,
                lifecycleState: 'ACTIVE'
            })
            .returning({ id: users.id });
        if (!user) throw new Error('S11 user missing');
        const [plan] = await tx
            .insert(plans)
            .values({
                vertical: 'accommodation',
                slug: `s11-${crypto.randomUUID()}`,
                name: 'S11 test'
            })
            .returning({ id: plans.id });
        if (!plan) throw new Error('S11 plan missing');
        const [version] = await tx
            .insert(planVersions)
            .values({
                planId: plan.id,
                vertical: 'accommodation',
                rank: Math.floor(Math.random() * 1e9) + 1,
                sellable: false,
                current: true,
                trialDays: 0,
                allowsPause: false
            })
            .returning({ id: planVersions.id });
        if (!version) throw new Error('S11 version missing');
        const [option] = await tx
            .insert(billingOptions)
            .values({
                planVersionId: version.id,
                cycle: input.cycle ?? 'monthly',
                amount: 10000,
                currency: 'ARS'
            })
            .returning({ id: billingOptions.id });
        if (!option) throw new Error('S11 option missing');
        let predecessorId: string | null = null;
        if (input.credit) {
            const [predecessor] = await tx
                .insert(subscriptions)
                .values({
                    userId: user.id,
                    vertical: 'accommodation',
                    planVersionId: version.id,
                    billingOptionId: option.id,
                    paymentMethod: 'CARD',
                    status: 'CANCELLED',
                    class: 'PRINCIPAL'
                })
                .returning({ id: subscriptions.id });
            predecessorId = predecessor?.id ?? null;
            if (!predecessorId) throw new Error('S11 predecessor missing');
        }
        const [sub] = await tx
            .insert(subscriptions)
            .values({
                userId: user.id,
                vertical: 'accommodation',
                planVersionId: version.id,
                billingOptionId: option.id,
                paymentMethod: input.paymentMethod ?? 'CARD',
                status: input.status ?? 'ACTIVE',
                class: input.class ?? 'PRINCIPAL',
                nextChargeAt: input.nextChargeAt ?? null,
                succeedsId: input.credit?.closed ? null : predecessorId,
                authorizationWindowDeadlineVersion: input.credit ? 1 : null,
                authorizationWindowEndsAt: input.credit?.windowEndsAt ?? null,
                firstChargeAt: input.credit?.firstChargeAt ?? input.futureFirstChargeAt ?? null
            })
            .returning({ id: subscriptions.id });
        if (!sub) throw new Error('S11 subscription missing');
        if (predecessorId && input.credit?.closed)
            await tx
                .update(subscriptions)
                .set({ succeededById: sub.id })
                .where(eq(subscriptions.id, predecessorId));
        if ((input.paymentMethod ?? 'CARD') === 'CARD' && input.withLink !== false)
            await tx.insert(providerLinks).values({
                subscriptionId: sub.id,
                provider: 'MERCADO_PAGO',
                providerId: auth.authorizationId
            });
        let paymentId: string | null = null;
        let manualPaymentId: string | null = null;
        const periodStart = input.periodStart ?? new Date('2026-10-01T00:00:00.000Z');
        if (input.payment === 'payment') {
            const [payment] = await tx
                .insert(payments)
                .values({
                    subscriptionId: sub.id,
                    amount: 10000,
                    currency: 'ARS',
                    status: 'SUCCEEDED',
                    provider: 'MERCADO_PAGO',
                    providerFactId: crypto.randomUUID(),
                    factAt: cancelActiveNow
                })
                .returning({ id: payments.id });
            paymentId = payment?.id ?? null;
        } else if (input.payment === 'manual') {
            const [manual] = await tx
                .insert(manualPayments)
                .values({
                    subscriptionId: sub.id,
                    periodStart,
                    status: 'REGISTERED',
                    registeredBy: user.id,
                    registeredAt: cancelActiveNow
                })
                .returning({ id: manualPayments.id });
            manualPaymentId = manual?.id ?? null;
        }
        if (paymentId || manualPaymentId)
            await tx.insert(coveredPeriods).values({
                subscriptionId: sub.id,
                periodStart,
                paymentId,
                manualPaymentId,
                creditedAt: cancelActiveNow
            });
        for (const extra of [
            input.additionalOpenPeriodStart
                ? { start: input.additionalOpenPeriodStart, released: false }
                : null,
            input.releasedPeriodStart ? { start: input.releasedPeriodStart, released: true } : null
        ]) {
            if (!extra) continue;
            const [extraPayment] = await tx
                .insert(payments)
                .values({
                    subscriptionId: sub.id,
                    amount: 10000,
                    currency: 'ARS',
                    status: 'SUCCEEDED',
                    provider: 'MERCADO_PAGO',
                    providerFactId: crypto.randomUUID(),
                    factAt: cancelActiveNow
                })
                .returning({ id: payments.id });
            if (!extraPayment) throw new Error('S11 extra payment missing');
            await tx.insert(coveredPeriods).values({
                subscriptionId: sub.id,
                periodStart: extra.start,
                paymentId: extraPayment.id,
                manualPaymentId: null,
                creditedAt: cancelActiveNow,
                releasedAt: extra.released ? cancelActiveNow : null
            });
        }
        return {
            userId: user.id,
            subscriptionId: sub.id,
            authorizationId: auth.authorizationId,
            predecessorId,
            planId: plan.id,
            versionId: version.id,
            optionId: option.id
        };
    });
    trackedUsers.push(data.userId);
    trackedSubscriptions.push(data.subscriptionId);
    trackedPlans.push(data.planId);
    trackedVersions.push(data.versionId);
    trackedOptions.push(data.optionId);
    if (data.predecessorId) trackedSubscriptions.push(data.predecessorId);
    trackedAuthorizations.push({ fake: input.fake, id: auth.authorizationId });
    return data;
}

export async function retireCancelActiveRows(): Promise<void> {
    const db = getServiceTestDb();
    for (const authorization of trackedAuthorizations.splice(0))
        await authorization.fake
            .cancel({ authorizationId: authorization.id })
            .catch(() => undefined);
    const ids = trackedSubscriptions.splice(0);
    if (ids.length)
        await db
            .update(subscriptions)
            .set({ status: 'CANCELLED', serviceEndsAt: cancelActiveNow })
            .where(inArray(subscriptions.id, ids));
    if (trackedUsers.length)
        await db
            .delete(emailOutbox)
            .where(inArray(emailOutbox.recipientUserId, trackedUsers.splice(0)));
}
