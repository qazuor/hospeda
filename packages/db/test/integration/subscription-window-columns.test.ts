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
            if ('constraint' in current && typeof current.constraint === 'string') {
                return current.constraint;
            }
            current = 'cause' in current ? current.cause : undefined;
        }
    }
    throw new Error('Expected a PostgreSQL constraint rejection');
}

// TEST:B3:10 (base: versión y vencimiento guardados al abrir la ventana)
describe('subscription authorization window columns', () => {
    it('has two nullable columns after migrations and accepts a LAPIDA without either', async () => {
        const columns = await getTestPool().query<{ column_name: string; is_nullable: string }>(
            `SELECT column_name, is_nullable FROM information_schema.columns
             WHERE table_name = 'subscription' AND column_name IN
             ('authorization_window_deadline_version', 'authorization_window_ends_at')`
        );
        expect(columns.rows).toHaveLength(2);
        expect(columns.rows.map((row) => row.is_nullable)).toEqual(['YES', 'YES']);
        await withTestTransaction(async (tx) => {
            const [row] = await tx
                .insert(subscriptions)
                .values({ status: 'CANCELLED', class: 'LAPIDA' })
                .returning();
            expect(row?.authorizationWindowDeadlineVersion).toBeNull();
            expect(row?.authorizationWindowEndsAt).toBeNull();
        });
    });

    it('rejects a version without an instant and an instant without a version', async () => {
        expect(
            await rejectedConstraint(() =>
                withTestTransaction(async (tx) => {
                    await tx.insert(subscriptions).values({
                        status: 'CANCELLED',
                        class: 'LAPIDA',
                        authorizationWindowDeadlineVersion: 1
                    });
                })
            )
        ).toBe('ck_subscription_authorization_window_pair');
        expect(
            await rejectedConstraint(() =>
                withTestTransaction(async (tx) => {
                    await tx.insert(subscriptions).values({
                        status: 'CANCELLED',
                        class: 'LAPIDA',
                        authorizationWindowEndsAt: new Date('2026-10-11T20:00:00.000Z')
                    });
                })
            )
        ).toBe('ck_subscription_authorization_window_pair');
    });

    it('rejects an unknown deadline version through its FK', async () => {
        expect(
            await rejectedConstraint(() =>
                withTestTransaction(async (tx) => {
                    await tx.insert(subscriptions).values({
                        status: 'CANCELLED',
                        class: 'LAPIDA',
                        authorizationWindowDeadlineVersion: 2147483647,
                        authorizationWindowEndsAt: new Date('2026-10-11T20:00:00.000Z')
                    });
                })
            )
        ).toBe(
            // PostgreSQL truncates identifiers to 63 bytes.
            'subscription_authorization_window_deadline_version_billing_dead'
        );
    });
});
