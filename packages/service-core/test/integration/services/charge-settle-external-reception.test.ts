import {
    coveredPeriods,
    eq,
    inArray,
    payments,
    receipts,
    reconciliationMarkPayments,
    reconciliationMarks,
    subscriptions,
    successionRetainedPayments
} from '@repo/db';
import { FakePaymentProvider } from '@repo/payments/fake';
import { PermissionEnum, RoleEnum } from '@repo/schemas';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { settleExternalCharge } from '../../../src/services/billing/payment/settle-external-charge.service.js';
import { closeServiceTestPool, getServiceTestDb, isServiceTestDbAvailable } from './helpers.js';
import { unusedComplementPolicy } from './support/cancel-active-fixtures.js';
import {
    crossingClock,
    retireCancelCrossingRows,
    seedCrossingActive
} from './support/cancel-crossing-fixtures.js';
import { cleanUpCoverageNoticeRows } from './support/coverage-notice-fixtures.js';
import { graceWithFailedCycle } from './support/grace-fixtures.js';
import { outboxBeforeCancelNotice } from './support/outbox-before-cancel-notice.js';
import {
    predecessorInGrace,
    retireSuccessionCases,
    type SeededSuccession
} from './support/succession-retention-fixtures.js';

afterAll(closeServiceTestPool);

const userIds: string[] = [];
const successionCases: SeededSuccession[] = [];
afterEach(async () => {
    await retireCancelCrossingRows();
    await retireSuccessionCases(successionCases.splice(0));
    if (userIds.length) {
        const ids = userIds.splice(0);
        const ownedSubscriptions = await getServiceTestDb()
            .select({ id: subscriptions.id })
            .from(subscriptions)
            .where(inArray(subscriptions.userId, ids));
        const subscriptionIds = ownedSubscriptions.map(({ id }) => id);
        const ownedPayments = await getServiceTestDb()
            .select({ id: payments.id })
            .from(payments)
            .where(inArray(payments.subscriptionId, subscriptionIds));
        const paymentIds = ownedPayments.map(({ id }) => id);
        if (paymentIds.length)
            await getServiceTestDb()
                .delete(reconciliationMarkPayments)
                .where(inArray(reconciliationMarkPayments.paymentId, paymentIds));
        if (subscriptionIds.length)
            await getServiceTestDb()
                .delete(reconciliationMarks)
                .where(inArray(reconciliationMarks.subscriptionId, subscriptionIds));
        await cleanUpCoverageNoticeRows({ userIds: ids, promoCodeIds: [] });
    }
});

const admin = () => ({
    id: crypto.randomUUID(),
    roles: [RoleEnum.ADMIN],
    permissions: [PermissionEnum.BILLING_SETTLE_EXTERNAL]
});
const actionPorts = (provider: FakePaymentProvider, clock: { now: () => Date }) => ({
    provider,
    clock,
    markPayments: undefined,
    beforeCancelNotice: outboxBeforeCancelNotice(),
    coverageNotices: { emitCoverageChanged: async () => undefined }
});

describe("TEST:B5:6 AC:B5:11 the settled charge runs the row's reception rule", () => {
    it.skipIf(!isServiceTestDbAvailable())(
        '(h) earlier S11 charge extends by max and an older period never shortens service',
        async () => {
            // Arrange
            const { clock, setNow } = crossingClock(new Date('2026-10-01T00:00:00.000Z'));
            const fake = new FakePaymentProvider({
                idNamespace: crypto.randomUUID(),
                clock,
                honestAbout: [{ lie: 'M8', why: 'settlement requires an approved charge' }]
            });
            const seeded = await seedCrossingActive({ fake, payment: 'payment' });
            const chargeTime = new Date('2026-10-13T12:00:00.000Z');
            setNow(chargeTime);
            const charge = await fake.charge({
                authorizationId: seeded.authorizationId,
                amount: { amountMinor: 10000, currency: 'ARS' },
                reference: seeded.subscriptionId
            });
            setNow(new Date('2026-10-14T12:00:00.000Z'));
            await import(
                '../../../src/services/billing/subscription/cancel-active-subscription.service.js'
            ).then(({ cancelActiveSubscription }) =>
                cancelActiveSubscription(
                    {
                        actor: {
                            id: seeded.userId,
                            roles: [],
                            permissions: [PermissionEnum.BILLING_CANCEL_SUBSCRIPTION]
                        },
                        subscriptionId: seeded.subscriptionId
                    },
                    {
                        provider: fake,
                        clock,
                        beforeCancelNotice: outboxBeforeCancelNotice(),
                        complements: unusedComplementPolicy,
                        coverageNotices: { emitCoverageChanged: async () => undefined }
                    }
                )
            );
            const ports = actionPorts(fake, clock);

            // Act
            const result = await settleExternalCharge(
                { actor: admin(), chargeId: charge.chargeId },
                ports
            );

            // Assert
            expect(result.reception).toBe('EXTENDED');
            const [row] = await getServiceTestDb()
                .select()
                .from(subscriptions)
                .where(eq(subscriptions.id, seeded.subscriptionId));
            expect(row?.serviceEndsAt?.getTime()).toBeGreaterThan(
                new Date('2026-11-01T00:00:00.000Z').getTime()
            );
            expect(row?.serviceEndsAt).toEqual(new Date('2026-11-13T12:00:00.000Z'));
            const [payment] = await getServiceTestDb()
                .select()
                .from(payments)
                .where(eq(payments.providerFactId, charge.chargeId));
            expect(payment).toMatchObject({ status: 'SUCCEEDED' });
            expect(
                await getServiceTestDb()
                    .select()
                    .from(receipts)
                    .where(eq(receipts.paymentId, payment!.id))
            ).toHaveLength(1);
            expect(
                await getServiceTestDb()
                    .select()
                    .from(coveredPeriods)
                    .where(eq(coveredPeriods.paymentId, payment!.id))
            ).toHaveLength(1);
        }
    );

    it.skipIf(!isServiceTestDbAvailable())(
        '(h) an S11 service end is not shortened by an earlier covered period',
        async () => {
            // Arrange
            const { clock, setNow } = crossingClock(new Date('2026-09-01T00:00:00.000Z'));
            const fake = new FakePaymentProvider({
                idNamespace: crypto.randomUUID(),
                clock,
                honestAbout: [{ lie: 'M8', why: 'settlement requires an approved charge' }]
            });
            const seeded = await seedCrossingActive({ fake, payment: 'payment' });
            const charge = await fake.charge({
                authorizationId: seeded.authorizationId,
                amount: { amountMinor: 10000, currency: 'ARS' },
                reference: seeded.subscriptionId
            });
            setNow(new Date('2026-10-14T12:00:00.000Z'));
            const { cancelActiveSubscription } = await import(
                '../../../src/services/billing/subscription/cancel-active-subscription.service.js'
            );
            await cancelActiveSubscription(
                {
                    actor: {
                        id: seeded.userId,
                        roles: [],
                        permissions: [PermissionEnum.BILLING_CANCEL_SUBSCRIPTION]
                    },
                    subscriptionId: seeded.subscriptionId
                },
                {
                    provider: fake,
                    clock,
                    beforeCancelNotice: outboxBeforeCancelNotice(),
                    complements: unusedComplementPolicy,
                    coverageNotices: { emitCoverageChanged: async () => undefined }
                }
            );
            const [before] = await getServiceTestDb()
                .select({ serviceEndsAt: subscriptions.serviceEndsAt })
                .from(subscriptions)
                .where(eq(subscriptions.id, seeded.subscriptionId));

            // Act
            const result = await settleExternalCharge(
                { actor: admin(), chargeId: charge.chargeId },
                actionPorts(fake, clock)
            );

            // Assert
            expect(result.reception).toBe('NOT_EXTENDED');
            const [after] = await getServiceTestDb()
                .select({ serviceEndsAt: subscriptions.serviceEndsAt })
                .from(subscriptions)
                .where(eq(subscriptions.id, seeded.subscriptionId));
            expect(after?.serviceEndsAt).toEqual(before?.serviceEndsAt);
        }
    );

    it.skipIf(!isServiceTestDbAvailable())(
        '(i) a live GRACE_PERIOD predecessor retains the credited payment by S19',
        async () => {
            // Arrange
            const seeded = await predecessorInGrace();
            successionCases.push(seeded.seeded);
            userIds.push(seeded.fixture.user.id);
            const charge = await seeded.fixture.provider.charge({
                authorizationId: seeded.fixture.started.authorizationId,
                amount: { amountMinor: 250000, currency: 'ARS' },
                reference: seeded.subscriptionId
            });
            const marksBefore = await getServiceTestDb()
                .select({ id: reconciliationMarks.id })
                .from(reconciliationMarks)
                .where(eq(reconciliationMarks.subscriptionId, seeded.subscriptionId));

            // Act
            const result = await settleExternalCharge(
                { actor: admin(), chargeId: charge.chargeId },
                seeded.chargePorts
            );

            // Assert
            expect(result.reception).toBe('S19_RETAINED');
            const [subscription] = await getServiceTestDb()
                .select({ status: subscriptions.status })
                .from(subscriptions)
                .where(eq(subscriptions.id, seeded.subscriptionId));
            expect(subscription?.status).toBe('GRACE_PERIOD');
            const [payment] = await getServiceTestDb()
                .select()
                .from(payments)
                .where(eq(payments.providerFactId, charge.chargeId));
            expect(payment).toMatchObject({ status: 'SUCCEEDED' });
            expect(payment?.id).toBe(result.paymentId);
            expect(
                await getServiceTestDb()
                    .select()
                    .from(successionRetainedPayments)
                    .where(eq(successionRetainedPayments.paymentId, result.paymentId))
            ).toHaveLength(1);
            const marksAfter = await getServiceTestDb()
                .select({ id: reconciliationMarks.id })
                .from(reconciliationMarks)
                .where(eq(reconciliationMarks.subscriptionId, seeded.subscriptionId));
            expect(marksAfter.map(({ id }) => id)).toEqual(marksBefore.map(({ id }) => id));
        }
    );

    it.skipIf(!isServiceTestDbAvailable())(
        '(j) S7 reactivates a suspended row with all four conditions satisfied',
        async () => {
            // Arrange
            const fixture = await graceWithFailedCycle({ approveOnAttempt: 2 });
            userIds.push(fixture.user.id);
            const [inGrace] = await getServiceTestDb()
                .select({ graceStartedAt: subscriptions.graceStartedAt })
                .from(subscriptions)
                .where(eq(subscriptions.id, fixture.started.subscriptionId));
            if (!inGrace?.graceStartedAt) throw new Error('Grace start missing');
            await getServiceTestDb()
                .update(subscriptions)
                .set({ status: 'SUSPENDED' })
                .where(eq(subscriptions.id, fixture.started.subscriptionId));
            fixture.advanceToAttempt(2);

            // Act
            const result = await settleExternalCharge(
                { actor: admin(), chargeId: fixture.chargeId },
                { ...fixture.ports, beforeCancelNotice: outboxBeforeCancelNotice() }
            );

            // Assert
            expect(result.reception).toBe('S7');
            const [row] = await getServiceTestDb()
                .select({ status: subscriptions.status })
                .from(subscriptions)
                .where(eq(subscriptions.id, fixture.started.subscriptionId));
            expect(row?.status).toBe('ACTIVE');
            const [payment] = await getServiceTestDb()
                .select()
                .from(payments)
                .where(eq(payments.providerFactId, fixture.chargeId));
            expect(payment).toMatchObject({ status: 'SUCCEEDED' });
            expect(payment?.id).toBe(result.paymentId);
            expect(
                await getServiceTestDb()
                    .select()
                    .from(receipts)
                    .where(eq(receipts.paymentId, result.paymentId))
            ).toHaveLength(1);
            expect(
                await getServiceTestDb()
                    .select()
                    .from(coveredPeriods)
                    .where(eq(coveredPeriods.paymentId, result.paymentId))
            ).toHaveLength(1);
        }
    );

    it.skipIf(!isServiceTestDbAvailable())(
        '(j) a suspended row missing its grace anchor reports CONDITION_FAILED',
        async () => {
            // Arrange
            const fixture = await graceWithFailedCycle({ approveOnAttempt: 2 });
            userIds.push(fixture.user.id);
            const [own] = await getServiceTestDb()
                .select({
                    userId: subscriptions.userId,
                    vertical: subscriptions.vertical,
                    planVersionId: subscriptions.planVersionId,
                    billingOptionId: subscriptions.billingOptionId
                })
                .from(subscriptions)
                .where(eq(subscriptions.id, fixture.started.subscriptionId));
            if (!own?.userId) throw new Error('Suspended subscription owner missing');
            const [retired] = await getServiceTestDb()
                .insert(subscriptions)
                .values({
                    userId: own.userId,
                    vertical: own.vertical,
                    planVersionId: own.planVersionId,
                    billingOptionId: own.billingOptionId,
                    paymentMethod: 'CARD',
                    class: 'PRINCIPAL',
                    status: 'CANCELLED'
                })
                .returning({ id: subscriptions.id });
            if (!retired) throw new Error('Retired subscription origin missing');
            await getServiceTestDb().insert(subscriptions).values({
                userId: own.userId,
                vertical: own.vertical,
                planVersionId: own.planVersionId,
                billingOptionId: own.billingOptionId,
                paymentMethod: 'CARD',
                class: 'PRINCIPAL',
                status: 'PENDING_AUTHORIZATION',
                succeedsId: retired.id
            });
            await getServiceTestDb()
                .update(subscriptions)
                .set({ status: 'SUSPENDED' })
                .where(eq(subscriptions.id, fixture.started.subscriptionId));
            fixture.advanceToAttempt(2);

            // Act
            const result = await settleExternalCharge(
                { actor: admin(), chargeId: fixture.chargeId },
                { ...fixture.ports, beforeCancelNotice: outboxBeforeCancelNotice() }
            );

            // Assert
            expect(result.reception).toBe('CONDITION_FAILED');
            const [row] = await getServiceTestDb()
                .select({ status: subscriptions.status })
                .from(subscriptions)
                .where(eq(subscriptions.id, fixture.started.subscriptionId));
            expect(row?.status).toBe('SUSPENDED');
            const [payment] = await getServiceTestDb()
                .select()
                .from(payments)
                .where(eq(payments.providerFactId, fixture.chargeId));
            expect(payment).toMatchObject({ status: 'SUCCEEDED' });
            expect(
                await getServiceTestDb()
                    .select()
                    .from(receipts)
                    .where(eq(receipts.paymentId, result.paymentId))
            ).toHaveLength(1);
            expect(
                await getServiceTestDb()
                    .select()
                    .from(coveredPeriods)
                    .where(eq(coveredPeriods.paymentId, result.paymentId))
            ).toHaveLength(1);
        }
    );
});
