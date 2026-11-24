/**
 * HOS-2400: the admin list of refunds proposed from a reconciliation mark. It admits `MARK_PROPOSAL`
 * refunds that are REQUESTED, or CONFIRMED with no provider call at all, and shows the mark(s) that
 * hang each one's payment. Runs against the real database, so every assertion looks its own rows
 * up by id: other suites share the database (HOS-2407).
 *
 * The rows this file seeds are created in year 2099, one second apart, so they always sort after
 * every other suite's rows (which use real dates): the block is the tail of the list. Reads anchor
 * on that tail and never compare page contents against a whole-list snapshot, because parallel
 * workers may insert `MARK_PROPOSAL` refunds at any moment (not every writer holds the HOS-2406
 * serial lock).
 */
import { eq, idempotencyKeys, reconciliationMarks, refundCalls, refunds } from '@repo/db';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import { createPaymentReconciliationMarkPayments } from '../../../src/services/billing/payment/payment-ledger';
import { openReconciliationMark } from '../../../src/services/billing/reconciliation/open-reconciliation-mark.service';
import {
    listProposedRefunds,
    type ProposedRefund
} from '../../../src/services/billing/refund/list-proposed-refunds.service';
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

/** One second per seeded row inside year 2099: later than every other suite's rows, whatever they
 * do. `Date.UTC` normalizes past 59 seconds into the next minute, so the counter stays monotonic. */
let futureSecond = 0;
function futureCreatedAt(): Date {
    const at = new Date(Date.UTC(2099, 0, 1, 0, 0, futureSecond));
    futureSecond += 1;
    return at;
}

/** One listed refund, read from the tail page that holds this file's rows; undefined when it is
 * not listed. Never walks the whole list: the block this file seeds is at most ~30 rows, always
 * inside the last page of 100. The total read and the last-page read form one epoch: a parallel
 * insert in between shifts the old tail past the computed page, so the epoch is discarded and
 * retried instead of reporting a false absence (HOS-2407). A zero total is already conclusive —
 * this file's own rows would make it positive. */
async function listed(refundId: string) {
    for (let attempt = 0; attempt < 40; attempt++) {
        const head = await listProposedRefunds({ page: 1, pageSize: 100 });
        if (head.total === 0) return undefined;
        const lastPage = Math.ceil(head.total / 100);
        const page =
            lastPage === 1 ? head : await listProposedRefunds({ page: lastPage, pageSize: 100 });
        if (page.total === head.total) {
            return page.items.find((item) => item.refundId === refundId);
        }
        await new Promise((resolve) => setTimeout(resolve, 25));
    }
    throw new Error('the proposed-refund list never stayed still long enough to read its tail');
}

/** Reads the last pages of the list during one read epoch: the row total stays still across every
 * page of the walk, and the first id of the first page keeps holding between attempts (a
 * compensating insert+delete pair leaves the total intact while it moves rows, which the head-id
 * anchor detects, HOS-2407). The rows this file seeds are the tail of the list, so a stable epoch
 * pins every page the block touches. Retries while parallel writers move the tail; failing loudly
 * beats comparing against a stale whole-list snapshot. */
async function readTail(input: {
    readonly pageSize: number;
    readonly windowRows: number;
}): Promise<{
    readonly items: readonly ProposedRefund[];
    readonly total: number;
}> {
    let anchoredHeadId: string | null = null;
    for (let attempt = 0; attempt < 40; attempt++) {
        const head = await listProposedRefunds({ page: 1, pageSize: input.pageSize });
        const headId = head.items[0]?.refundId ?? null;
        if (anchoredHeadId === null || headId === anchoredHeadId) {
            const lastPage = Math.max(1, Math.ceil(head.total / input.pageSize));
            const firstPage = Math.max(
                1,
                lastPage - Math.ceil(input.windowRows / input.pageSize) - 1
            );
            const items: ProposedRefund[] = [];
            let stable = true;
            for (let page = firstPage; page <= lastPage && stable; page++) {
                const result = await listProposedRefunds({ page, pageSize: input.pageSize });
                if (result.total !== head.total) stable = false;
                items.push(...result.items);
            }
            if (stable) return { items, total: head.total };
        }
        anchoredHeadId = headId;
        await new Promise((resolve) => setTimeout(resolve, 25));
    }
    throw new Error('the proposed-refund list never stayed still long enough to read its tail');
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
            createdAt: futureCreatedAt(),
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

/** Persists one provider call of a refund, answered (idempotency result stored) or not. */
async function addCall(input: {
    refundId: string;
    answered: boolean;
    providerRefundId: string | null;
}) {
    const key = `hos2400-${crypto.randomUUID()}`;
    await getServiceTestDb()
        .insert(idempotencyKeys)
        .values({
            key,
            operation: 'REFUND_CREATE',
            subjectId: input.refundId,
            ...(input.answered ? { result: { ok: true }, completedAt: new Date() } : {})
        });
    await getServiceTestDb().insert(refundCalls).values({
        refundId: input.refundId,
        idempotencyKey: key,
        amount: 10000,
        providerRefundId: input.providerRefundId
    });
}

/** Moves a proposal the held-charge fixture created at real time into this file's 2099 block, so
 * the tail-scoped `listed` read can find it like every other row the file owns. */
async function moveProposalIntoFutureBlock(refundId: string): Promise<void> {
    await getServiceTestDb()
        .update(refunds)
        .set({ createdAt: futureCreatedAt() })
        .where(eq(refunds.id, refundId));
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
        'leaves out a CONFIRMED proposal with an unanswered provider call',
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

    it.skipIf(skip)(
        'leaves out a CONFIRMED proposal whose provider call was accepted',
        async () => {
            // Arrange
            const seeded = await proposalOnMarkedPayment({ status: 'CONFIRMED' });
            await addCall({
                refundId: seeded.refundId,
                answered: true,
                providerRefundId: `prov-${crypto.randomUUID()}`
            });

            // Act + Assert
            expect(await listed(seeded.refundId)).toBeUndefined();
        }
    );

    it.skipIf(skip)(
        'lists a CONFIRMED proposal whose provider call was answered without an id',
        async () => {
            // Arrange: a rejection kept confirmed; decline accepts it, so the list must show it.
            const seeded = await proposalOnMarkedPayment({ status: 'CONFIRMED' });
            await addCall({ refundId: seeded.refundId, answered: true, providerRefundId: null });

            // Act
            const item = await listed(seeded.refundId);

            // Assert
            expect(item?.status).toBe('CONFIRMED');
            expect(item?.providerCallCount).toBe(1);
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
                status: 'REQUESTED',
                createdAt: futureCreatedAt()
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
            await moveProposalIntoFutureBlock(proposal.id);

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
            await moveProposalIntoFutureBlock(proposal.id);
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

    it.skipIf(skip)(
        'paginates in the database with live CONFIRMED rows interleaved across pages',
        async () => {
            // Arrange: every row lands one second inside year 2099, so the block this file seeds is
            // the tail of the list. Eligible rows (E) alternate with CONFIRMED ones whose provider
            // call was accepted (L), which must never be listed. Other suites may insert
            // MARK_PROPOSAL rows at any moment, so the test anchors on its own block instead of
            // comparing pages against a whole-list snapshot (HOS-2407).
            const eligible: string[] = [];
            const live: string[] = [];
            for (let index = 0; index < 5; index++) {
                const e = await proposalOnMarkedPayment({
                    status: index % 2 === 0 ? 'REQUESTED' : 'CONFIRMED',
                    createdAt: futureCreatedAt()
                });
                eligible.push(e.refundId);
                if (index < 4) {
                    const l = await proposalOnMarkedPayment({
                        status: 'CONFIRMED',
                        createdAt: futureCreatedAt()
                    });
                    await addCall({
                        refundId: l.refundId,
                        answered: true,
                        providerRefundId: `prov-${crypto.randomUUID()}`
                    });
                    live.push(l.refundId);
                }
            }

            // Act: read the tail of the list in pages of 2 while the total stays still. Five
            // eligible rows cannot fit one page of 2, so the suffix assertion mechanically reads
            // them across at least three page boundaries.
            const tail = await readTail({ pageSize: 2, windowRows: 10 });
            const tailIds = tail.items.map((item) => item.refundId);

            // Assert: owned rows only.
            expect(tail.total).toBeGreaterThanOrEqual(5);
            expect(tailIds.slice(-5)).toEqual(eligible);
            for (const id of live) expect(tailIds).not.toContain(id);
            expect(tailIds[tailIds.length - 1]).toBe(eligible[4]);
        }
    );

    it.skipIf(skip)('refuses invalid pagination with a typed error', async () => {
        await expect(listProposedRefunds({ page: 0, pageSize: 50 })).rejects.toMatchObject({
            reason: 'PROPOSED_REFUNDS_INPUT_INVALID'
        });
        await expect(listProposedRefunds({ page: 1, pageSize: 101 })).rejects.toMatchObject({
            reason: 'PROPOSED_REFUNDS_INPUT_INVALID'
        });
    });
});
