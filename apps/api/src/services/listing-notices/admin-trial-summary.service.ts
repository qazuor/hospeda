import { getDb, trials } from '@repo/db';
import type { AdminTrialSummaryResponse } from '@repo/schemas';
import { TRIAL_DEADLINES_VERSION } from '@repo/verticals';
import { and, eq } from 'drizzle-orm';
import type { ListingVertical } from '../../../../../packages/db/src/models/listing/listing-publication.model';
import { readTrialCeilingDays } from '../../utils/trial/trial-ceiling';
import { readTrialSummary } from './listing-notices.service';

/** Reads an admin subject's trial summary and the ceiling pinned to its row. */
export async function readAdminTrialSummary(input: {
    readonly userId: string;
    readonly vertical: ListingVertical;
}): Promise<AdminTrialSummaryResponse> {
    const summary = await readTrialSummary(input);
    if (summary.status === 'NONE') return { summary, ceilingDays: null };
    const [row] = await getDb()
        .select({ deadlinesVersion: trials.deadlinesVersion })
        .from(trials)
        .where(and(eq(trials.userId, input.userId), eq(trials.vertical, input.vertical)))
        .limit(1);
    const ceilingDays = await readTrialCeilingDays({
        db: getDb(),
        vertical: input.vertical,
        deadlinesVersion: row?.deadlinesVersion ?? TRIAL_DEADLINES_VERSION
    });
    return { summary, ceilingDays };
}
