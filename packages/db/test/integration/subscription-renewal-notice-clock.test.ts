import type { BillingDeadlineValues } from '@repo/schemas';
import { afterAll, describe, expect, it } from 'vitest';
import { billingDeadlineVersions, subscriptions } from '../../src/schemas/index.ts';
import { closeTestPool, getTestPool, withTestTransaction } from './helpers.ts';

afterAll(closeTestPool);

const versionOne: BillingDeadlineValues = {
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
};

/** Follows wrapped PostgreSQL failures to their constraint or SQLSTATE. */
async function rejectedDatabaseError(
    work: () => Promise<void>,
    field: 'constraint' | 'code'
): Promise<string> {
    try {
        await work();
    } catch (error) {
        let current: unknown = error;
        while (typeof current === 'object' && current !== null) {
            if (field in current && typeof current[field] === 'string') return current[field];
            current = 'cause' in current ? current.cause : undefined;
        }
    }
    throw new Error('Expected a PostgreSQL constraint rejection');
}

// TEST:B13a:13 base — the per-cycle PLAZO:13 clock is persisted on subscription.
describe('HOS-1622 TEST:B13a:13 AC:B13a:13 the renewal notice clock columns (base)', () => {
    it('has two nullable columns and a LAPIDA starts without either', async () => {
        const columns = await getTestPool().query<{ column_name: string; is_nullable: string }>(
            `SELECT column_name, is_nullable FROM information_schema.columns
             WHERE table_name = 'subscription' AND column_name IN
             ('renewal_notice_deadline_version', 'renewal_notice_charge_at') ORDER BY column_name`
        );
        expect(columns.rows).toEqual([
            { column_name: 'renewal_notice_charge_at', is_nullable: 'YES' },
            { column_name: 'renewal_notice_deadline_version', is_nullable: 'YES' }
        ]);
        await withTestTransaction(async (tx) => {
            const [row] = await tx
                .insert(subscriptions)
                .values({ status: 'CANCELLED', class: 'LAPIDA' })
                .returning();
            expect(row?.renewalNoticeDeadlineVersion).toBeNull();
            expect(row?.renewalNoticeChargeAt).toBeNull();
        });
    });

    it('rejects a partial pair, accepts version 1, and rejects a missing version FK', async () => {
        const chargeAt = new Date('2001-06-10T12:00:00.000Z');
        expect(
            await rejectedDatabaseError(
                () =>
                    withTestTransaction(async (tx) => {
                        await tx
                            .insert(billingDeadlineVersions)
                            .values({ version: 1, values: versionOne })
                            .onConflictDoNothing();
                        await tx.insert(subscriptions).values({
                            status: 'CANCELLED',
                            class: 'LAPIDA',
                            renewalNoticeDeadlineVersion: 1
                        });
                    }),
                'constraint'
            )
        ).toBe('ck_subscription_renewal_notice_pair');
        await withTestTransaction(async (tx) => {
            await tx
                .insert(billingDeadlineVersions)
                .values({ version: 1, values: versionOne })
                .onConflictDoNothing();
            const [row] = await tx
                .insert(subscriptions)
                .values({
                    status: 'CANCELLED',
                    class: 'LAPIDA',
                    renewalNoticeDeadlineVersion: 1,
                    renewalNoticeChargeAt: chargeAt
                })
                .returning();
            expect(row?.renewalNoticeDeadlineVersion).toBe(1);
            expect(row?.renewalNoticeChargeAt).toEqual(chargeAt);
        });
        expect(
            await rejectedDatabaseError(
                () =>
                    withTestTransaction(async (tx) => {
                        await tx
                            .insert(billingDeadlineVersions)
                            .values({ version: 1, values: versionOne })
                            .onConflictDoNothing();
                        await tx.insert(subscriptions).values({
                            status: 'CANCELLED',
                            class: 'LAPIDA',
                            renewalNoticeDeadlineVersion: 2147483000,
                            renewalNoticeChargeAt: chargeAt
                        });
                    }),
                'code'
            )
        ).toBe('23503');
    });
});
