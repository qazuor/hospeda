import { afterAll, describe, expect, it } from 'vitest';
import { readAnchoredBillingOption } from '../../../src/services/billing/read-anchored-billing-option.ts';
import { closeServiceTestPool, getServiceTestDb, getServiceTestPool } from './helpers.ts';

afterAll(closeServiceTestPool);

describe('TEST:B2:4 — database reader honors the subscription version anchor', () => {
    it('reads the old option when a different version of the same plan is current', async () => {
        const pool = getServiceTestPool();
        getServiceTestDb(); // Wire the real databaseBillingOptionReader to this temporary DB.
        const slug = `anchor-${crypto.randomUUID()}`;
        const plan = await pool.query<{ id: string }>(
            'INSERT INTO plan (vertical, slug, name) VALUES ($1, $2, $3) RETURNING id',
            ['accommodation', slug, 'Anchored price test']
        );
        const planId = plan.rows[0]!.id;

        const insertVersion = async (current: boolean) => {
            const result = await pool.query<{ id: string }>(
                `INSERT INTO plan_version
                        (plan_id, vertical, rank, sellable, current, trial_days, allows_pause)
                        VALUES ($1, 'accommodation', 1, true, $2, 0, false) RETURNING id`,
                [planId, current]
            );
            return result.rows[0]!.id;
        };
        const oldVersionId = await insertVersion(false);
        const currentVersionId = await insertVersion(true);
        const insertOption = async (planVersionId: string, amount: number) => {
            const result = await pool.query<{ id: string }>(
                `INSERT INTO billing_option (plan_version_id, cycle, amount, currency)
                        VALUES ($1, 'monthly', $2, 'ARS') RETURNING id`,
                [planVersionId, amount]
            );
            return result.rows[0]!.id;
        };
        const oldOptionId = await insertOption(oldVersionId, 3000);
        const currentOptionId = await insertOption(currentVersionId, 4500);

        const anchored = await readAnchoredBillingOption({
            subscription: { planVersionId: oldVersionId, billingOptionId: oldOptionId }
        });
        const current = await readAnchoredBillingOption({
            subscription: { planVersionId: currentVersionId, billingOptionId: currentOptionId }
        });
        const mismatched = await readAnchoredBillingOption({
            subscription: { planVersionId: currentVersionId, billingOptionId: oldOptionId }
        });

        expect(anchored).toMatchObject({ planVersionId: oldVersionId, amount: 3000 });
        expect(current).toMatchObject({ planVersionId: currentVersionId, amount: 4500 });
        expect(mismatched).toBeNull();
    });
});
