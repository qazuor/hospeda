/**
 * HOS-2560: the admin list of refunds stuck on a live provider call. It admits CONFIRMED refunds
 * with a call the provider accepted or left with no stored answer, and suggests «Retry with MP» or
 * the remainder settlement. Runs against the real database, so every assertion looks its own rows
 * up by id: other suites share the database.
 */
import { idempotencyKeys, refundCalls, refunds } from '@repo/db';
import { afterAll, describe, expect, it } from 'vitest';
import { listStuckRefunds } from '../../../src/services/billing/refund/list-stuck-refunds.service';
import { closeServiceTestPool, getServiceTestDb, isServiceTestDbAvailable } from './helpers';
import { creditedPayment } from './support/refund-fixtures';

const skip = !isServiceTestDbAvailable();
const NOW = new Date();
const hoursAgo = (hours: number) => new Date(NOW.getTime() - hours * 60 * 60 * 1000);

afterAll(closeServiceTestPool);

/** One listed refund, paging the whole list; undefined when it is not listed. */
async function listed(refundId: string) {
    for (let page = 1; page < 100; page++) {
        const result = await listStuckRefunds({ page, pageSize: 100, now: NOW });
        const found = result.items.find((item) => item.refundId === refundId);
        if (found) return found;
        if (page * 100 >= result.total) return undefined;
    }
    return undefined;
}

/** A credited card payment with one refund row of the given shape. */
async function refundOnPayment(
    overrides: Partial<typeof refunds.$inferInsert> = {}
): Promise<{ refundId: string; paymentId: string }> {
    const credited = await creditedPayment(10000);
    const [row] = await getServiceTestDb()
        .insert(refunds)
        .values({
            paymentId: credited.payment.id,
            amount: 10000,
            reason: 'REVOCATION',
            status: 'CONFIRMED',
            ...overrides
        })
        .returning({ id: refunds.id });
    if (!row) throw new Error('refund row missing');
    return { refundId: row.id, paymentId: credited.payment.id };
}

/** Persists one provider call of a refund: unanswered (no stored result), accepted or answered without id. */
async function addCall(input: {
    refundId: string;
    createdAt: Date;
    answered?: boolean;
    providerRefundId?: string | null;
    amount?: number;
}) {
    const key = `hos2560-${crypto.randomUUID()}`;
    await getServiceTestDb()
        .insert(idempotencyKeys)
        .values({
            key,
            operation: 'REFUND_CREATE',
            subjectId: input.refundId,
            ...(input.answered ? { result: { ok: true }, completedAt: input.createdAt } : {})
        });
    await getServiceTestDb()
        .insert(refundCalls)
        .values({
            refundId: input.refundId,
            idempotencyKey: key,
            amount: input.amount ?? 10000,
            providerRefundId: input.providerRefundId ?? null,
            createdAt: input.createdAt
        });
}

describe('HOS-2560 listStuckRefunds', () => {
    it.skipIf(skip)('suggests the retry for a call left unanswered an hour ago', async () => {
        // Arrange
        const seeded = await refundOnPayment();
        await addCall({ refundId: seeded.refundId, createdAt: hoursAgo(1) });

        // Act
        const item = await listed(seeded.refundId);

        // Assert
        expect(item).toMatchObject({
            refundId: seeded.refundId,
            amountMinor: 10000,
            currency: 'ARS',
            payment: { source: 'PAYMENT', id: seeded.paymentId },
            providerCallCount: 1,
            unansweredCallCount: 1,
            oldestUnansweredAt: hoursAgo(1),
            acceptedAmountMinor: 0,
            suggestedAction: 'RETRY'
        });
    });

    it.skipIf(skip)(
        'suggests the remainder settlement for a call unanswered for 30 hours',
        async () => {
            // Arrange
            const seeded = await refundOnPayment();
            await addCall({ refundId: seeded.refundId, createdAt: hoursAgo(30) });

            // Act
            const item = await listed(seeded.refundId);

            // Assert
            expect(item?.suggestedAction).toBe('SETTLE_REMAINDER');
            expect(item?.oldestUnansweredAt).toEqual(hoursAgo(30));
        }
    );

    it.skipIf(skip)(
        'suggests the remainder settlement for a partial acceptance with nothing unanswered',
        async () => {
            // Arrange
            const seeded = await refundOnPayment();
            await addCall({
                refundId: seeded.refundId,
                createdAt: hoursAgo(2),
                answered: true,
                providerRefundId: `prov-${crypto.randomUUID()}`,
                amount: 4000
            });

            // Act
            const item = await listed(seeded.refundId);

            // Assert
            expect(item).toMatchObject({
                unansweredCallCount: 0,
                oldestUnansweredAt: null,
                acceptedAmountMinor: 4000,
                suggestedAction: 'SETTLE_REMAINDER'
            });
        }
    );

    it.skipIf(skip)(
        'suggests the retry for a fully accepted refund the provider has not credited yet',
        async () => {
            const seeded = await refundOnPayment();
            await addCall({
                refundId: seeded.refundId,
                createdAt: hoursAgo(2),
                answered: true,
                providerRefundId: `prov-${crypto.randomUUID()}`
            });
            expect((await listed(seeded.refundId))?.suggestedAction).toBe('RETRY');
        }
    );

    it.skipIf(skip)(
        'leaves out refunds that are not CONFIRMED, even with a live call',
        async () => {
            // Arrange
            const ids: string[] = [];
            for (const status of ['REQUESTED', 'EXECUTED', 'FAILED'] as const) {
                const seeded = await refundOnPayment({
                    status,
                    ...(status === 'EXECUTED' ? { executedVia: 'PROVIDER' } : {})
                });
                await addCall({ refundId: seeded.refundId, createdAt: hoursAgo(1) });
                ids.push(seeded.refundId);
            }

            // Act + Assert
            for (const id of ids) expect(await listed(id)).toBeUndefined();
        }
    );

    it.skipIf(skip)(
        'leaves out a CONFIRMED refund with no live call: none at all, or answered without an id',
        async () => {
            // Arrange
            const bare = await refundOnPayment();
            const rejected = await refundOnPayment();
            await addCall({
                refundId: rejected.refundId,
                createdAt: hoursAgo(1),
                answered: true,
                providerRefundId: null
            });

            // Act + Assert
            expect(await listed(bare.refundId)).toBeUndefined();
            expect(await listed(rejected.refundId)).toBeUndefined();
        }
    );

    it.skipIf(skip)('paginates in the database, oldest first', async () => {
        // Arrange: createdAt far ahead puts these rows last; non-stuck rows interleave.
        const stuck: string[] = [];
        for (let index = 0; index < 5; index++) {
            const at = (offset: number) => new Date(Date.UTC(2099, 0, 1, 0, 0, index * 2 + offset));
            const s = await refundOnPayment({ createdAt: at(0) });
            await addCall({ refundId: s.refundId, createdAt: hoursAgo(1) });
            stuck.push(s.refundId);
            await refundOnPayment({ createdAt: at(1) });
        }

        // Act: the whole list in pages of 100 as ground truth, then every page of 2.
        // The shared DB may hold foreign rows (other files), so nothing below
        // assumes where this test's rows sit in the global order.
        const wholeIds: string[] = [];
        let total = 0;
        for (let page = 1; page === 1 || wholeIds.length < total; page++) {
            const result = await listStuckRefunds({ page, pageSize: 100, now: NOW });
            total = result.total;
            wholeIds.push(...result.items.map((item) => item.refundId));
            if (result.items.length === 0) break;
        }
        const lastPage = Math.ceil(total / 2);
        const paged: string[] = [];
        const totalsByPage: number[] = [];
        for (let page = 1; page <= lastPage; page++) {
            const result = await listStuckRefunds({ page, pageSize: 2, now: NOW });
            totalsByPage.push(result.total);
            paged.push(...result.items.map((item) => item.refundId));
        }

        // Assert: pagination is consistent with the whole list (no gaps, no duplicates).
        expect(wholeIds).toHaveLength(total);
        expect(new Set(wholeIds).size).toBe(total);
        expect(totalsByPage.every((value) => value === total)).toBe(true);
        expect(paged).toEqual(wholeIds);
        // Assert: this test's own rows all appear, oldest first, whatever interleaves.
        expect(wholeIds.filter((id) => stuck.includes(id))).toEqual(stuck);
    });

    it.skipIf(skip)('refuses invalid pagination with a typed error', async () => {
        await expect(listStuckRefunds({ page: 0, pageSize: 50, now: NOW })).rejects.toMatchObject({
            reason: 'STUCK_REFUNDS_INPUT_INVALID'
        });
        await expect(listStuckRefunds({ page: 1, pageSize: 101, now: NOW })).rejects.toMatchObject({
            reason: 'STUCK_REFUNDS_INPUT_INVALID'
        });
    });
});
