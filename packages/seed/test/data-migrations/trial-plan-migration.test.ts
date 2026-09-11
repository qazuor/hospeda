/**
 * HOS-1012 T-034 — the shared body of the three trial-plan data-migrations.
 *
 * The behaviour worth pinning is the one HOS-433 taught: a migration that
 * silently writes nothing is still recorded `ok` in the ledger and never
 * retried. So "the plan I was meant to insert is not declared" must ABORT,
 * not return a summary saying zero rows moved.
 */
import { ALL_TRIAL_PLANS } from '@repo/billing';
import { ProductDomainEnum } from '@repo/schemas';
import { describe, expect, it, vi } from 'vitest';
import { runTrialPlanMigration } from '../../src/data-migrations/helpers/trialPlanMigration.js';
import type { SeedMigrationCtx } from '../../src/data-migrations/types.js';

const ctx = { db: {} } as unknown as SeedMigrationCtx;

describe('runTrialPlanMigration', () => {
    it('writes the entry whose product domain it was asked for', async () => {
        const write = vi.fn().mockResolvedValue('created');

        const result = await runTrialPlanMigration({
            ctx,
            productDomain: ProductDomainEnum.GASTRONOMY,
            migrationName: '0074-test',
            entries: ALL_TRIAL_PLANS,
            write
        });

        expect(write).toHaveBeenCalledTimes(1);
        // The entry — not merely "an" entry: a migration that picked the
        // accommodation plan for a gastronomy run would produce a row
        // `createTrialSubscription` then rejects on every gastronomy publish.
        expect(write.mock.calls[0]?.[0].entry.plan.slug).toBe('gastronomy-trial');
        expect(result.counts).toEqual({ plansCreated: 1, plansRestamped: 0 });
        expect(result.summary).toContain('gastronomy-trial');
    });

    it('counts a re-stamp separately from a creation', async () => {
        const write = vi.fn().mockResolvedValue('restamped');
        const result = await runTrialPlanMigration({
            ctx,
            productDomain: ProductDomainEnum.ACCOMMODATION,
            migrationName: '0073-test',
            entries: ALL_TRIAL_PLANS,
            write
        });
        expect(result.counts).toEqual({ plansCreated: 0, plansRestamped: 1 });
    });

    it('reports zero of both when the row was already correct', async () => {
        const write = vi.fn().mockResolvedValue('skipped');
        const result = await runTrialPlanMigration({
            ctx,
            productDomain: ProductDomainEnum.EXPERIENCE,
            migrationName: '0075-test',
            entries: ALL_TRIAL_PLANS,
            write
        });
        expect(result.counts).toEqual({ plansCreated: 0, plansRestamped: 0 });
        expect(result.summary).toContain('skipped');
    });

    it('THROWS rather than recording an empty run when the vertical declares no trial plan', async () => {
        const write = vi.fn();

        await expect(
            runTrialPlanMigration({
                ctx,
                productDomain: ProductDomainEnum.PARTNER,
                migrationName: '0073-hos-1012-owner-trial-plan',
                entries: ALL_TRIAL_PLANS,
                write
            })
        ).rejects.toThrow(/no trial plan is declared for product domain 'partner'/);

        // And nothing was written on the way to that failure.
        expect(write).not.toHaveBeenCalled();
    });
});
