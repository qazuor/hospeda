import { afterAll, describe, expect, it } from 'vitest';
import { subscriptions } from '../../src/schemas/vertical/subscription.dbschema.ts';
import { closeTestPool, getTestPool, withTestTransaction } from './helpers.ts';

afterAll(closeTestPool);

/** Drizzle wraps PostgreSQL errors; follow cause until the database constraint is found. */
async function rejectedConstraint(work: () => Promise<void>): Promise<string | undefined> {
    try {
        await work();
    } catch (error) {
        let current: unknown = error;
        while (typeof current === 'object' && current !== null) {
            if ('constraint' in current && typeof current.constraint === 'string')
                return current.constraint;
            current = 'cause' in current ? current.cause : undefined;
        }
    }
    throw new Error('Expected a PostgreSQL constraint rejection');
}

// TEST:B7:1 (base: el reloj persistido)
describe('TEST:B7:1 subscription grace clock columns', () => {
    it('has two nullable columns and a LAPIDA starts without either', async () => {
        const columns = await getTestPool().query<{ column_name: string; is_nullable: string }>(
            `SELECT column_name, is_nullable FROM information_schema.columns
             WHERE table_name = 'subscription' AND column_name IN
             ('grace_started_at', 'grace_ends_at') ORDER BY column_name`
        );
        expect(columns.rows).toEqual([
            { column_name: 'grace_ends_at', is_nullable: 'YES' },
            { column_name: 'grace_started_at', is_nullable: 'YES' }
        ]);
        await withTestTransaction(async (tx) => {
            const [row] = await tx
                .insert(subscriptions)
                .values({ status: 'CANCELLED', class: 'LAPIDA' })
                .returning();
            expect(row?.graceStartedAt).toBeNull();
            expect(row?.graceEndsAt).toBeNull();
        });
    });

    it('rejects a partial clock and an end before the start, and accepts equality', async () => {
        const start = new Date('2026-10-11T20:00:00.000Z');
        expect(
            await rejectedConstraint(() =>
                withTestTransaction(async (tx) => {
                    await tx.insert(subscriptions).values({
                        status: 'CANCELLED',
                        class: 'LAPIDA',
                        graceStartedAt: start
                    });
                })
            )
        ).toBe('ck_subscription_grace_clock_pair');
        expect(
            await rejectedConstraint(() =>
                withTestTransaction(async (tx) => {
                    await tx.insert(subscriptions).values({
                        status: 'CANCELLED',
                        class: 'LAPIDA',
                        graceStartedAt: start,
                        graceEndsAt: new Date(start.getTime() - 1)
                    });
                })
            )
        ).toBe('ck_subscription_grace_clock_pair');
        await withTestTransaction(async (tx) => {
            const [row] = await tx
                .insert(subscriptions)
                .values({
                    status: 'CANCELLED',
                    class: 'LAPIDA',
                    graceStartedAt: start,
                    graceEndsAt: start
                })
                .returning();
            expect(row?.graceEndsAt).toEqual(start);
        });
    });
});
