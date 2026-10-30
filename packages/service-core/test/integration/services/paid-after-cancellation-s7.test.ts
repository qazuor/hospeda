import {
    and,
    emailOutbox,
    eq,
    isNull,
    payments,
    reconciliationMarks,
    subscriptions
} from '@repo/db';
import type { FakePaymentProvider } from '@repo/payments/fake';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { creditPayment } from '../../../src/services/billing/payment/credit-payment.service.js';
import { recordChargeFact } from '../../../src/services/billing/payment/record-charge-fact.service.js';
import { closeServiceTestPool, getServiceTestDb, isServiceTestDbAvailable } from './helpers.js';
import {
    complementNow,
    retireComplementRows,
    seedCommittedComplement
} from './support/complement-fixtures.js';
import { graceWithFailedCycle } from './support/grace-fixtures.js';

const fixtures: { subscriptionId: string; userId: string }[] = [];

afterEach(async () => {
    await retireComplementRows();
    const db = getServiceTestDb();
    for (const fixture of fixtures.splice(0)) {
        await db
            .update(reconciliationMarks)
            .set({ liftedAt: complementNow, liftedBy: fixture.userId })
            .where(
                and(
                    eq(reconciliationMarks.subscriptionId, fixture.subscriptionId),
                    isNull(reconciliationMarks.liftedAt)
                )
            );
        await db
            .update(subscriptions)
            .set({ status: 'CANCELLED', graceStartedAt: null, graceEndsAt: null })
            .where(eq(subscriptions.id, fixture.subscriptionId));
        await db.delete(emailOutbox).where(eq(emailOutbox.recipientUserId, fixture.userId));
    }
});
afterAll(closeServiceTestPool);

describe.skipIf(!isServiceTestDbAvailable())('TEST:1623:2 AC:B13a:17 S7 notice', () => {
    it.each([
        { recurringAddonsCut: true, complementStatus: 'ACTIVE' },
        { recurringAddonsCut: false, complementStatus: 'CANCELLED' }
    ])('a — enqueues once for CANCEL_SCHEDULED with recurringAddonsCut=$recurringAddonsCut', async ({
        recurringAddonsCut,
        complementStatus
    }) => {
        const fixture = await graceWithFailedCycle({ approveOnAttempt: 3 });
        fixtures.push({ subscriptionId: fixture.started.subscriptionId, userId: fixture.user.id });
        await getServiceTestDb()
            .update(subscriptions)
            .set({ status: 'SUSPENDED' })
            .where(eq(subscriptions.id, fixture.started.subscriptionId));
        const seeded = await seedCommittedComplement({
            fake: fixture.provider as unknown as FakePaymentProvider,
            principalStatus: 'SUSPENDED',
            principal: { userId: fixture.user.id, principalId: fixture.started.subscriptionId },
            scopeType: 'VERTICAL_SUBSCRIPTION',
            complementStatus
        });
        await (fixture.provider as unknown as FakePaymentProvider).cancel({
            authorizationId: fixture.started.authorizationId
        });
        fixture.advanceToAttempt(3);
        const result = await recordChargeFact(
            { chargeId: fixture.chargeId },
            { ...fixture.ports, complements: seeded.policy }
        );
        expect(result).toMatchObject({
            outcome: 'CREDITED',
            reactivation: { outcome: 'REACTIVATED', destination: 'CANCEL_SCHEDULED' }
        });
        const [main] = await getServiceTestDb()
            .select()
            .from(subscriptions)
            .where(eq(subscriptions.id, fixture.started.subscriptionId));
        const notices = await getServiceTestDb()
            .select()
            .from(emailOutbox)
            .where(
                and(
                    eq(emailOutbox.recipientUserId, fixture.user.id),
                    eq(emailOutbox.template, 'billing.paid-after-cancellation')
                )
            );
        expect(notices).toHaveLength(1);
        expect(notices[0]?.payload).toEqual({
            subscriptionId: fixture.started.subscriptionId,
            vertical: 'accommodation',
            serviceEndsAt: main?.serviceEndsAt?.toISOString(),
            recurringAddonsCut
        });
    });

    it('b — an ACTIVE destination leaves the full outbox template list unchanged', async () => {
        const fixture = await graceWithFailedCycle({ approveOnAttempt: 2 });
        fixtures.push({ subscriptionId: fixture.started.subscriptionId, userId: fixture.user.id });
        await getServiceTestDb()
            .update(subscriptions)
            .set({ status: 'SUSPENDED' })
            .where(eq(subscriptions.id, fixture.started.subscriptionId));
        const templates = async () =>
            (
                await getServiceTestDb()
                    .select({ template: emailOutbox.template })
                    .from(emailOutbox)
                    .where(eq(emailOutbox.recipientUserId, fixture.user.id))
            )
                .map(({ template }) => template)
                .sort();
        const before = await templates();
        fixture.advanceToAttempt(2);
        const approved = await fixture.provider.readCharge({ chargeId: fixture.chargeId });
        const [payment] = await getServiceTestDb()
            .select({ id: payments.id })
            .from(payments)
            .where(eq(payments.providerFactId, fixture.chargeId));
        if (!payment) throw new Error('Pending payment fact is missing');
        await creditPayment(
            { paymentId: payment.id, chargeCreatedAt: new Date(approved.snapshot.createdAt) },
            fixture.ports
        );
        const outboxAfterCredit = await templates();
        const result = await recordChargeFact({ chargeId: fixture.chargeId }, fixture.ports);
        expect(result).toMatchObject({
            outcome: 'CREDITED',
            reactivation: { outcome: 'REACTIVATED', destination: 'ACTIVE' }
        });
        expect(outboxAfterCredit).toEqual([...before, 'billing.payment-credited'].sort());
        expect(await templates()).toEqual(outboxAfterCredit);
    });
});
