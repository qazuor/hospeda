import type { Clock } from '@repo/billing-verticals-contract';
import { type DrizzleClient, getDb } from '@repo/db';
import type { Vertical } from '@repo/schemas';
import { type CutoverTrialListing, writeCutoverTrials } from '@repo/service-core';
import {
    buildTrialCampaignOutbox,
    type TrialCampaignOutboxDependencies
} from '../../utils/trial/trial-campaign-outbox.js';

/** Outcome of one step 3 run; see STEP3_EXIT_CODE. */
export type Step3Status = 'dry_run' | 'completed' | 'already_done' | 'nothing_planned';

/** Secret-free projection of one planned trial, for the operator's manual check. */
export interface Step3PlannedRow {
    readonly userId: string;
    readonly vertical: Vertical;
    readonly listingId: string;
    readonly trialPlanId: string;
    readonly floorEntitlementsVersionId: string;
    readonly floorLimitsVersionId: string;
    readonly floorTrialPlanVersionId: string;
    readonly startedAt: string;
    readonly endsAt: string;
    readonly deadlinesVersion: number;
}

/** Sanitized step 3 output and write accounting. */
export interface Step3Result {
    readonly status: Step3Status;
    readonly planned: readonly Step3PlannedRow[];
    readonly written: readonly CutoverTrialListing[];
    readonly skipped: readonly CutoverTrialListing[];
}

/** Exit codes for the step 3 CLI. */
export const STEP3_EXIT_CODE: Readonly<Record<Step3Status, 0 | 1>> = {
    dry_run: 0,
    completed: 0,
    already_done: 0,
    nothing_planned: 1
};

/** Dependencies for one V6 cutover step 3 run. */
export interface RunStep3Input {
    readonly db?: DrizzleClient;
    readonly clock: Clock;
    readonly dryRun: boolean;
    /** Tests only (Coord-680): never passed by the CLI. */
    readonly ownerIds?: readonly string[];
    /** Tests only: overrides for the real campaign adapter. */
    readonly campaignDeps?: Partial<TrialCampaignOutboxDependencies>;
}

/** Runs the V6 step 3 trial write with the transaction-bound campaign adapter. */
export async function runStep3({
    db = getDb(),
    clock,
    dryRun,
    ownerIds,
    campaignDeps
}: RunStep3Input): Promise<Step3Result> {
    const result = await db.transaction(async (tx) =>
        writeCutoverTrials({
            db: tx,
            dryRun,
            ownerIds,
            scheduleExpiryCampaign: buildTrialCampaignOutbox({ tx, clock, deps: campaignDeps })
                .scheduleExpiryCampaign
        })
    );
    const planned: Step3PlannedRow[] = result.planned.map((row) => ({
        userId: row.userId,
        vertical: row.vertical,
        listingId: row.listingId,
        trialPlanId: row.trialPlanId,
        floorEntitlementsVersionId: row.floorEntitlementsVersionId,
        floorLimitsVersionId: row.floorLimitsVersionId,
        floorTrialPlanVersionId: row.floorTrialPlanVersionId,
        startedAt: row.startedAt.toISOString(),
        endsAt: row.endsAt.toISOString(),
        deadlinesVersion: row.deadlinesVersion
    }));
    let status: Step3Status;
    if (planned.length === 0) status = 'nothing_planned';
    else if (dryRun) status = 'dry_run';
    else if (result.written.length === 0) status = 'already_done';
    else status = 'completed';
    return { status, planned, written: result.written, skipped: result.skipped };
}
