import { afterAll, describe, expect, it } from 'vitest';
import {
    SUBSCRIPTION_CANCELLATION_REASONS,
    subscriptions
} from '../../src/schemas/vertical/subscription.dbschema.ts';
import { closeTestPool, withTestTransaction } from './helpers.ts';

afterAll(closeTestPool);

async function sqlState(work: () => Promise<void>): Promise<string | undefined> {
    try {
        await work();
    } catch (error) {
        let current: unknown = error;
        while (typeof current === 'object' && current !== null) {
            if ('code' in current && typeof current.code === 'string') return current.code;
            current = 'cause' in current ? current.cause : undefined;
        }
    }
    throw new Error('Expected a PostgreSQL constraint rejection');
}

describe('TEST:1878:23 subscription cancellation reason constraint', () => {
    it('accepts NULL and every closed-list cancellation reason', async () => {
        await withTestTransaction(async (tx) => {
            const [empty] = await tx
                .insert(subscriptions)
                .values({ status: 'CANCELLED', class: 'LAPIDA' })
                .returning();
            expect(empty?.cancellationReason).toBeNull();
            for (const reason of SUBSCRIPTION_CANCELLATION_REASONS) {
                const [row] = await tx
                    .insert(subscriptions)
                    .values({ status: 'CANCELLED', class: 'LAPIDA', cancellationReason: reason })
                    .returning();
                expect(row?.cancellationReason).toBe(reason);
            }
        });
    });

    it('rejects a value outside the closed list with SQLSTATE 23514', async () => {
        expect(
            await sqlState(() =>
                withTestTransaction(async (tx) => {
                    await tx.insert(subscriptions).values({
                        status: 'CANCELLED',
                        class: 'LAPIDA',
                        cancellationReason: 'FREE_TEXT'
                    });
                })
            )
        ).toBe('23514');
    });
});
