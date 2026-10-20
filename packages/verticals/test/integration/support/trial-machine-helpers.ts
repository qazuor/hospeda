import { randomBytes } from 'node:crypto';
import type { DrizzleClient } from '@repo/db';
import { trials } from '@repo/db';
import type { Vertical } from '@repo/schemas';
import { seedUser, sellableCurrentIds, trialPlanOf } from './trial-start-helpers';

export async function seedActiveTrial(args: {
    readonly db: DrizzleClient;
    readonly vertical: Vertical;
    readonly startedAt: Date;
    readonly endsAt: Date;
}): Promise<{ userId: string; trialId: string }> {
    const user = await seedUser(args.db);
    const plan = await trialPlanOf(args.db, args.vertical);
    const sellable = await sellableCurrentIds(args.db, args.vertical);
    const lowest = sellable[0];
    const highest = sellable[sellable.length - 1];
    if (!lowest || !highest) throw new Error('No sellable current versions');
    const [trial] = await args.db
        .insert(trials)
        .values({
            userId: user.id,
            vertical: args.vertical,
            status: 'TRIAL_ACTIVE',
            trialPlanId: plan.planId,
            floorTrialPlanVersionId: plan.versionId,
            floorEntitlementsVersionId: highest,
            floorLimitsVersionId: lowest,
            startedAt: args.startedAt,
            endsAt: args.endsAt,
            deadlinesVersion: 1,
            emailPseudonym: randomBytes(32).toString('hex')
        })
        .returning({ id: trials.id });
    if (!trial) throw new Error('Trial insert failed');
    return { userId: user.id, trialId: trial.id };
}
