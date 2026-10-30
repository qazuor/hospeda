import type { DrizzleClient } from '@repo/db';
import { verticalDeadlineVersions, verticals } from '@repo/db';
import type { Vertical } from '@repo/schemas';
import { eq } from 'drizzle-orm';

/** Missing persisted PLAZO:7 configuration must stop trial extension and reads closed. */
export class TrialCeilingConfigurationError extends Error {
    constructor(
        readonly reason: 'VERTICAL_NOT_FOUND' | 'DEADLINE_VERSION_NOT_FOUND' | 'VALUE_MISSING',
        readonly vertical: string,
        readonly deadlinesVersion: number
    ) {
        super(`Trial ceiling PLAZO:7 unavailable: ${reason} (${vertical}, v${deadlinesVersion})`);
        this.name = 'TrialCeilingConfigurationError';
    }
}

/** Reads the positive PLAZO:7 ceiling from one persisted deadline snapshot. */
export async function readTrialCeilingDays(input: {
    readonly db: DrizzleClient;
    readonly vertical: Vertical;
    readonly deadlinesVersion: number;
}): Promise<number> {
    const [verticalRow] = await input.db
        .select({ id: verticals.id })
        .from(verticals)
        .where(eq(verticals.id, input.vertical))
        .limit(1);
    if (!verticalRow)
        throw new TrialCeilingConfigurationError(
            'VERTICAL_NOT_FOUND',
            input.vertical,
            input.deadlinesVersion
        );
    const [deadlineVersion] = await input.db
        .select({ values: verticalDeadlineVersions.values })
        .from(verticalDeadlineVersions)
        .where(eq(verticalDeadlineVersions.version, input.deadlinesVersion))
        .limit(1);
    if (!deadlineVersion)
        throw new TrialCeilingConfigurationError(
            'DEADLINE_VERSION_NOT_FOUND',
            input.vertical,
            input.deadlinesVersion
        );
    const ceilingDays = deadlineVersion.values['7']?.days;
    if (typeof ceilingDays !== 'number' || !Number.isInteger(ceilingDays) || ceilingDays <= 0)
        throw new TrialCeilingConfigurationError(
            'VALUE_MISSING',
            input.vertical,
            input.deadlinesVersion
        );
    return ceilingDays;
}
