/**
 * HOS-2400: the admin list of refunds proposed from a reconciliation mark. It admits `MARK_PROPOSAL`
 * refunds that are REQUESTED, or CONFIRMED with no provider call at all, and shows the mark(s) that
 * hang each one's payment. Runs against the real database, so every assertion looks its own rows
 * up by id: other suites share the database.
 */
import { eq, idempotencyKeys, reconciliationMarks, refundCalls, refunds } from '@repo/db';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import { createPaymentReconciliationMarkPayments } from '../../../src/services/billing/payment/payment-ledger';
import { openReconciliationMark } from '../../../src/services/billing/reconciliation/open-reconciliation-mark.service';
import { listProposedRefunds } from '../../../src/services/billing/refund/list-proposed-refunds.service';
import { closeServiceTestPool, getServiceTestDb, isServiceTestDbAvailable } from './helpers';
import { retirePurchaseFixtures } from './support/addon-purchase-fixtures';
import { heldChargeFor, refundsOf } from './support/held-charge-refund-fixtures';
import { retirePageMarks } from './support/one-time-page-fixtures';
import { creditedPayment, seedAdminActor } from './support/refund-fixtures';

const skip = !isServiceTestDbAvailable();

afterEach(async () => {
    vi.restoreAllMocks();
    await retirePageMarks();
    await retirePurchaseFixtures();
});
afterAll(closeServiceTestPool);

/** One listed refund, paging the whole list; undefined when it is not listed. */
async function listed(refundId: string) {
    for (let page = 1; page < 100; page++) {
        const result = await listProposedRefunds({ page, pageSize: 100 });
        const found = result.items.find((item) => item.refundId === refundId);
        if (found) return found;
        if (page * 100 >= result.total) return undefined;
    }
    return undefined;
}

/** A credited card payment with an open mark hanging it and one refund row of the given shape. */
async function proposalOnMarkedPayment(
    overrides: Partial<typeof refunds.$inferInsert> = {}
): Promise<{ refundId: string; markId: string; paymentId: string; subscriptionId: string }> {
    const credited = await creditedPayment(10000);
    const clock = credited.fixture.clock;
    const opened = await openReconciliationMark(
        {
            subject: {
                kind: 'SUBSCRIPTION',
                subscriptionId: credited.fixture.started.subscriptionId
            },
            reason: 'PAGO_TARDIO_RECHAZADO',
            actor: { type: 'job' },
            correlationId: crypto.randomUUID(),
            detail: [{ field: 'late_payment.failed_condition', new: 2 }],
            payment: { source: 'PAYMENT', id: credited.payment.id }
        },
        { markPayments: createPaymentReconciliationMarkPayments(clock) }
    );
    const [row] = await getServiceTestDb()
        .insert(refunds)
        .values({
            paymentId: credited.payment.id,
            amount: 10000,
            reason: 'MARK_PROPOSAL',
            status: 'REQUESTED',
            ...overrides
        })
        .returning({ id: refunds.id });
    if (!row) throw new Error('refund row missing');
    return {
        refundId: row.id,
        markId: opened.mark.id,
        paymentId: credited.payment.id,
        subscriptionId: credited.fixture.started.subscriptionId
    };
}

describe('HOS-2400 listProposedRefunds', () => {
    it.skipIf(skip)('lists a REQUESTED proposal with the mark that hangs its payment', async () => {
        // Arrange
        const seeded = await proposalOnMarkedPayment();

        // Act
        const item = await listed(seeded.refundId);

        // Assert
        expect(item).toMatchObject({
            refundId: seeded.refundId,
            status: 'REQUESTED',
            amountMinor: 10000,
            currency: 'ARS',
            payment: { source: 'PAYMENT', id: seeded.paymentId },
            providerCallCount: 0,
            closesHeldCharge: false
        });
        expect(item?.marks).toHaveLength(1);
        expect(item?.marks[0]).toMatchObject({
            markId: seeded.markId,
            reason: 'PAGO_TARDIO_RECHAZADO',
            reasonNumber: 7,
            liftedAt: null,
            subject: { kind: 'SUBSCRIPTION', id: seeded.subscriptionId }
        });
    });

    it.skipIf(skip)('lists a CONFIRMED proposal that has no provider call', async () => {
        const seeded = await proposalOnMarkedPayment({ status: 'CONFIRMED' });
        expect((await listed(seeded.refundId))?.status).toBe('CONFIRMED');
    });

    it.skipIf(skip)(
        'leaves out a CONFIRMED proposal that already has a provider call',
        async () => {
            // Arrange
            const seeded = await proposalOnMarkedPayment({ status: 'CONFIRMED' });
            const key = `hos2400-${crypto.randomUUID()}`;
            await getServiceTestDb()
                .insert(idempotencyKeys)
                .values({ key, operation: 'REFUND_CREATE', subjectId: seeded.refundId });
            await getServiceTestDb()
                .insert(refundCalls)
                .values({ refundId: seeded.refundId, idempotencyKey: key, amount: 10000 });

            // Act + Assert
            expect(await listed(seeded.refundId)).toBeUndefined();
        }
    );

    it.skipIf(skip)('leaves out refunds that are closed or are not mark proposals', async () => {
        // Arrange
        const failed = await proposalOnMarkedPayment({ status: 'FAILED' });
        const revocation = await proposalOnMarkedPayment({ reason: 'REVOCATION' });

        // Act + Assert
        expect(await listed(failed.refundId)).toBeUndefined();
        expect(await listed(revocation.refundId)).toBeUndefined();
    });

    it.skipIf(skip)('lists a proposal whose payment no mark hangs with no marks', async () => {
        // Arrange
        const credited = await creditedPayment(5000);
        const [row] = await getServiceTestDb()
            .insert(refunds)
            .values({
                paymentId: credited.payment.id,
                amount: 5000,
                reason: 'MARK_PROPOSAL',
                status: 'REQUESTED'
            })
            .returning({ id: refunds.id });

        // Act
        const item = await listed(row?.id ?? '');

        // Assert
        expect(item).toBeDefined();
        expect(item?.marks).toEqual([]);
    });

    it.skipIf(skip)(
        'flags the proposed refund of a held page charge as not declinable',
        async () => {
            // Arrange
            const { held } = await heldChargeFor('COBRO_DUPLICADO');
            const [proposal] = await refundsOf(held.payment.id);
            if (!proposal) throw new Error('proposal missing');

            // Act
            const item = await listed(proposal.id);

            // Assert
            expect(item?.closesHeldCharge).toBe(true);
            expect(item?.marks.map((mark) => mark.markId)).toContain(held.markId);
        }
    );

    it.skipIf(skip)(
        'does not flag a CONFIRMED proposal of a held charge: with no call it can be declined',
        async () => {
            // Arrange
            const { held } = await heldChargeFor('COBRO_DUPLICADO');
            const [proposal] = await refundsOf(held.payment.id);
            if (!proposal) throw new Error('proposal missing');
            await getServiceTestDb()
                .update(refunds)
                .set({ status: 'CONFIRMED' })
                .where(eq(refunds.id, proposal.id));

            // Act
            const item = await listed(proposal.id);

            // Assert
            expect(item?.status).toBe('CONFIRMED');
            expect(item?.closesHeldCharge).toBe(false);
        }
    );

    it.skipIf(skip)('keeps a lifted mark visible, marked as lifted', async () => {
        // Arrange
        const seeded = await proposalOnMarkedPayment();
        const admin = await seedAdminActor();
        const liftedAt = new Date('2026-11-19T12:00:00.000Z');
        await getServiceTestDb()
            .update(reconciliationMarks)
            .set({ liftedAt, liftedBy: admin.id })
            .where(eq(reconciliationMarks.id, seeded.markId));

        // Act
        const item = await listed(seeded.refundId);

        // Assert
        expect(item?.marks).toHaveLength(1);
        expect(item?.marks[0]).toMatchObject({ markId: seeded.markId, liftedAt });
    });

    it.skipIf(skip)('refuses invalid pagination with a typed error', async () => {
        await expect(listProposedRefunds({ page: 0, pageSize: 50 })).rejects.toMatchObject({
            reason: 'PROPOSED_REFUNDS_INPUT_INVALID'
        });
        await expect(listProposedRefunds({ page: 1, pageSize: 101 })).rejects.toMatchObject({
            reason: 'PROPOSED_REFUNDS_INPUT_INVALID'
        });
    });
});
