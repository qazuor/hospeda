/**
 * Review and acceptance of response shapes (HOS-1512 D1): the baseline advances ONLY when the
 * owner accepts what a run observed. This module builds what the admin shows (accepted shapes
 * against the latest observation, with the differences) and records the acceptance.
 *
 * @module utils/provider-watch/provider-watch-review
 */
import { providerWatchRunModel } from '@repo/db';
import { diffMeasurementShapes, type WatchAccount } from '@repo/payments';
import type { ProviderWatchShapeReview } from '@repo/schemas';
import { z } from 'zod';

const shapesSchema = z.record(z.string(), z.record(z.string(), z.string()));
const measurementsSchema = z.record(z.string(), z.object({ shapes: shapesSchema }));

/** Differences between the accepted shapes and an observation: the SAME rule the engine alerts with. */
function differencesOf(args: {
    readonly accepted: z.infer<typeof shapesSchema> | null;
    readonly observed: z.infer<typeof shapesSchema>;
}): readonly string[] {
    if (args.accepted === null) return ['no accepted baseline yet'];
    return diffMeasurementShapes({ accepted: args.accepted, observed: args.observed }).flatMap(
        (difference) => difference.formatted
    );
}

/**
 * What the owner reviews for an account: for every measurement of its latest completed run, the
 * accepted shapes, what was observed and the differences.
 *
 * @param args.account - The account this environment watches
 * @returns One review per measurement; empty when the account has no completed run
 */
export async function listShapeReviews(args: {
    readonly account: WatchAccount;
}): Promise<readonly ProviderWatchShapeReview[]> {
    const run = await providerWatchRunModel.findLatestCompleted({ account: args.account });
    if (!run?.finishedAt) return [];
    const measurements = measurementsSchema.safeParse(run.measurements);
    if (!measurements.success) return [];
    const baselines = new Map(
        (await providerWatchRunModel.listBaselines({ account: args.account })).map((row) => [
            row.measurementId,
            row
        ])
    );
    return Object.entries(measurements.data)
        .sort(([left], [right]) => left.localeCompare(right, 'en', { numeric: true }))
        .map(([measurementId, measurement]) => {
            const baseline = baselines.get(measurementId);
            // One unreadable stored baseline must not 500 the whole list: it reads as "none".
            const parsedBaseline = baseline ? shapesSchema.safeParse(baseline.shapes) : null;
            const readable = parsedBaseline?.success === true ? baseline : undefined;
            const accepted = parsedBaseline?.success === true ? parsedBaseline.data : null;
            const differences = differencesOf({ accepted, observed: measurement.shapes });
            return {
                measurementId,
                account: args.account,
                runId: run.id,
                observedAt: run.finishedAt?.toISOString() ?? '',
                observed: measurement.shapes,
                accepted,
                acceptedAt: readable?.acceptedAt.toISOString() ?? null,
                acceptedBy: readable?.acceptedBy ?? null,
                inSync: accepted !== null && differences.length === 0,
                differences: [...differences]
            };
        });
}

/** Why an acceptance was refused. */
export type AcceptShapeRefusal = 'RUN_NOT_FOUND' | 'RUN_NOT_ACCEPTABLE' | 'MEASUREMENT_NOT_IN_RUN';

/**
 * Records that the owner accepted the shapes a run observed for one measurement.
 *
 * Only a COMPLETED run of the environment's own account can be accepted (another account's run
 * answers as if it did not exist), and only a measurement the run actually observed: the owner
 * accepts what he saw, never something typed.
 *
 * @param args.account - The account this environment watches
 * @param args.measurementId - The measurement
 * @param args.runId - The run whose observation is accepted
 * @param args.acceptedBy - The owner's user id
 * @returns The refusal, or the accepted baseline's time
 */
export async function acceptShape(args: {
    readonly account: WatchAccount;
    readonly measurementId: string;
    readonly runId: string;
    readonly acceptedBy: string;
}): Promise<
    | { readonly accepted: true; readonly acceptedAt: Date }
    | { readonly accepted: false; readonly refusal: AcceptShapeRefusal }
> {
    const run = await providerWatchRunModel.findById({ id: args.runId });
    if (!run) return { accepted: false, refusal: 'RUN_NOT_FOUND' };
    // Another account's run is not this environment's to see: 404, like a missing one.
    if (run.account !== args.account) return { accepted: false, refusal: 'RUN_NOT_FOUND' };
    if (run.outcome !== 'completed') return { accepted: false, refusal: 'RUN_NOT_ACCEPTABLE' };
    const measurements = measurementsSchema.safeParse(run.measurements);
    const shapes = measurements.success ? measurements.data[args.measurementId]?.shapes : undefined;
    if (!shapes) return { accepted: false, refusal: 'MEASUREMENT_NOT_IN_RUN' };
    const stored = await providerWatchRunModel.acceptBaseline({
        account: args.account,
        measurementId: args.measurementId,
        shapes,
        sourceRunId: run.id,
        acceptedBy: args.acceptedBy
    });
    return { accepted: true, acceptedAt: stored.acceptedAt };
}
