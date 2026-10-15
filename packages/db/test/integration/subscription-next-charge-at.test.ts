import { afterAll, describe, expect, it } from 'vitest';
import { eq, subscriptionModel, subscriptions, users } from '../../src/index.ts';
import type { DrizzleClient } from '../../src/types.ts';
import { closeTestPool, testData, withTestTransaction } from './helpers.ts';

afterAll(closeTestPool);

async function createComplemento(tx: DrizzleClient, status = 'ACTIVE') {
    const user = testData.user();
    await tx.insert(users).values(user);
    const [row] = await tx
        .insert(subscriptions)
        .values({
            userId: user.id,
            vertical: 'accommodation',
            paymentMethod: 'CARD',
            status,
            class: 'COMPLEMENTO',
            createdAt: new Date('2026-10-01T00:00:00.000Z'),
            updatedAt: new Date('2026-10-01T00:00:00.000Z')
        })
        .returning();
    if (!row) throw new Error('Subscription fixture insert failed');
    return row;
}

describe('TEST:1685:3 syncNextChargeAt', () => {
    it('writes null and different dates only on ACTIVE rows, and does not rewrite an equal date', async () => {
        await withTestTransaction(async (tx) => {
            const row = await createComplemento(tx);
            const now = new Date('2026-10-11T12:00:00.000Z');
            const first = new Date('2026-10-16T15:00:00.000Z');
            expect(
                await subscriptionModel.syncNextChargeAt({
                    subscriptionId: row.id,
                    nextChargeAt: first,
                    now,
                    tx
                })
            ).toBe(true);
            const [written] = await tx
                .select()
                .from(subscriptions)
                .where(eq(subscriptions.id, row.id));
            expect(written?.nextChargeAt).toEqual(first);
            expect(written?.updatedAt).not.toEqual(row.updatedAt);

            const laterNow = new Date('2026-10-12T12:00:00.000Z');
            expect(
                await subscriptionModel.syncNextChargeAt({
                    subscriptionId: row.id,
                    nextChargeAt: first,
                    now: laterNow,
                    tx
                })
            ).toBe(false);
            const [equal] = await tx
                .select()
                .from(subscriptions)
                .where(eq(subscriptions.id, row.id));
            expect(equal).toEqual(written);

            const changed = new Date('2026-10-20T15:00:00.000Z');
            expect(
                await subscriptionModel.syncNextChargeAt({
                    subscriptionId: row.id,
                    nextChargeAt: changed,
                    now: laterNow,
                    tx
                })
            ).toBe(true);
            const [updated] = await tx
                .select()
                .from(subscriptions)
                .where(eq(subscriptions.id, row.id));
            expect(updated?.nextChargeAt).toEqual(changed);
            expect(updated?.updatedAt).toEqual(written?.updatedAt);
            expect({
                ...updated,
                nextChargeAt: row.nextChargeAt,
                updatedAt: row.updatedAt
            }).toEqual(row);
        });
    });

    it.each([
        'GRACE_PERIOD',
        'SUSPENDED',
        'CANCEL_SCHEDULED',
        'CANCELLED'
    ])('leaves every column unchanged for %s', async (status) => {
        await withTestTransaction(async (tx) => {
            const row = await createComplemento(tx, status);
            const now = new Date('2026-10-11T12:00:00.000Z');
            expect(
                await subscriptionModel.syncNextChargeAt({
                    subscriptionId: row.id,
                    nextChargeAt: new Date('2026-10-16T15:00:00.000Z'),
                    now,
                    tx
                })
            ).toBe(false);
            const [unchanged] = await tx
                .select()
                .from(subscriptions)
                .where(eq(subscriptions.id, row.id));
            expect(unchanged).toEqual(row);
        });
    });

    it('returns false for a missing subscription id', async () => {
        await withTestTransaction(async (tx) => {
            expect(
                await subscriptionModel.syncNextChargeAt({
                    subscriptionId: crypto.randomUUID(),
                    nextChargeAt: new Date('2026-10-16T15:00:00.000Z'),
                    now: new Date('2026-10-11T12:00:00.000Z'),
                    tx
                })
            ).toBe(false);
        });
    });
});
