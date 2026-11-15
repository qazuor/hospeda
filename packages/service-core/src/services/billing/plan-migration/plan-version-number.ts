import { type DrizzleClient, inArray, planVersions, sql } from '@repo/db';
import { ServiceErrorCode } from '@repo/schemas';
import { z } from 'zod';
import { ServiceError } from '../../../types/index.js';

/**
 * Attach the derived ordinal to one version, refusing to invent a default.
 *
 * @param version - A plan version identity
 * @param versionNumbers - The map returned by {@link readPlanVersionNumbers}
 * @returns The version with its `versionNumber`
 * @throws ServiceError `CONFIGURATION_ERROR` when the ordinal is missing
 */
export function withPlanVersionNumber<T extends { readonly id: string }>(
    version: T,
    versionNumbers: ReadonlyMap<string, number>
): T & { readonly versionNumber: number } {
    const versionNumber = versionNumbers.get(version.id);
    if (versionNumber === undefined)
        throw new ServiceError(
            ServiceErrorCode.CONFIGURATION_ERROR,
            'Plan version number is missing'
        );
    return { ...version, versionNumber };
}

const ReadPlanVersionNumbersInputSchema = z.object({
    planIds: z.array(z.uuid())
});

/**
 * Read the 1-based ordinal of each plan version inside its own plan (HOS-1616
 * O-3, D-4).
 *
 * The ordinal is DERIVED, never stored: `row_number()` partitions by
 * `plan_version.plan_id` and orders by creation (`created_at`, tie-broken by
 * `id`). Versions are immutable and action 18 publishes one at a time, so the
 * creation order is the version order. A version that belongs to a different
 * plan restarts at 1.
 *
 * It runs ONE read query and never writes. An empty `planIds` returns an empty
 * map without touching the database.
 *
 * @param args.db - The Drizzle client to read from
 * @param args.planIds - The plans whose versions are numbered
 * @returns A map keyed by `plan_version.id` with the derived version number
 */
export async function readPlanVersionNumbers(args: {
    readonly db: DrizzleClient;
    readonly planIds: readonly string[];
}): Promise<ReadonlyMap<string, number>> {
    const { planIds } = ReadPlanVersionNumbersInputSchema.parse({ planIds: args.planIds });
    if (planIds.length === 0) return new Map();
    const rows = await args.db
        .select({
            id: planVersions.id,
            versionNumber: sql<number>`(row_number() over (partition by ${planVersions.planId} order by ${planVersions.createdAt}, ${planVersions.id}))::int`
        })
        .from(planVersions)
        .where(inArray(planVersions.planId, planIds));
    return new Map(rows.map((row) => [row.id, row.versionNumber]));
}
