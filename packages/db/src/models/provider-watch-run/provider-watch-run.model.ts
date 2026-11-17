import { and, desc, eq } from 'drizzle-orm';
import { getDb } from '../../client.ts';
import {
    type InsertProviderWatchRun,
    type ProviderWatchAccount,
    providerWatchRuns,
    type SelectProviderWatchRun
} from '../../schemas/vertical/provider-watch-run.dbschema.ts';
import type { DrizzleClient } from '../../types.ts';

/** Persistence of the provider watch battery's runs (HOS-1512). */
export class ProviderWatchRunModel {
    /**
     * Writes one run.
     *
     * @param input.run - The run as it ended
     * @param input.tx - Optional transaction, so the run and its alert mail commit together
     * @returns The stored row
     */
    async insert(input: {
        readonly run: InsertProviderWatchRun;
        readonly tx?: DrizzleClient;
    }): Promise<SelectProviderWatchRun> {
        const [row] = await (input.tx ?? getDb())
            .insert(providerWatchRuns)
            .values(input.run)
            .returning();
        if (!row) throw new Error('provider_watch_run insert returned no row');
        return row;
    }

    /**
     * The latest run of an account that completed: its shapes are the baseline the next run
     * compares to. A failed, aborted or refused run never becomes the baseline.
     *
     * @param input.account - The account the run targeted
     * @param input.tx - Optional transaction
     * @returns The row, or `null` when the account has no completed run yet
     */
    async findLatestCompleted(input: {
        readonly account: ProviderWatchAccount;
        readonly tx?: DrizzleClient;
    }): Promise<SelectProviderWatchRun | null> {
        const [row] = await (input.tx ?? getDb())
            .select()
            .from(providerWatchRuns)
            .where(
                and(
                    eq(providerWatchRuns.account, input.account),
                    eq(providerWatchRuns.outcome, 'completed')
                )
            )
            .orderBy(desc(providerWatchRuns.finishedAt))
            .limit(1);
        return row ?? null;
    }
}

/** Shared instance. */
export const providerWatchRunModel = new ProviderWatchRunModel();
