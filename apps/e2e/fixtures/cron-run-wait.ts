import { execSQL } from './db-helpers.ts';

/** The execution an admin cron trigger reports, synchronous or awaited. */
export interface AwaitedCronRun {
    readonly success: boolean;
    readonly processed: number;
    readonly errors: number;
    readonly details: Record<string, unknown>;
    readonly jobName: string;
}

interface CronRunRow extends Record<string, unknown> {
    readonly status: string;
    readonly processed: number;
    readonly errors: number;
    readonly details: Record<string, unknown> | null;
}

/**
 * Waits for the `cron_runs` row of a run the admin trigger accepted with 202.
 *
 * HOS-1999: an exclusive job's manual trigger answers 202 once it holds the
 * cron lock and runs in the background, so a test that needs the run's effect
 * reads its recorded outcome here (matched by `details.runId`) instead of the
 * HTTP body.
 *
 * @param args - The accepted run id, its job name, and an optional wait ceiling
 * @returns The recorded outcome, shaped like the synchronous trigger response
 */
export async function waitForAcceptedCronRun(args: {
    readonly runId: string;
    readonly jobName: string;
    readonly timeoutMs?: number;
}): Promise<AwaitedCronRun> {
    const deadline = Date.now() + (args.timeoutMs ?? 60_000);
    while (Date.now() < deadline) {
        const rows = await execSQL<CronRunRow>(
            `SELECT status, processed, errors, details
               FROM cron_runs
              WHERE job_name = $1 AND details->>'runId' = $2
              LIMIT 1`,
            [args.jobName, args.runId]
        );
        const row = rows[0];
        if (row) {
            return {
                success: row.status === 'success' || row.status === 'partial',
                processed: row.processed,
                errors: row.errors,
                details: row.details ?? {},
                jobName: args.jobName
            };
        }
        await new Promise((resolve) => setTimeout(resolve, 200));
    }
    throw new Error(`Cron ${args.jobName} run ${args.runId} was accepted but never recorded`);
}

/**
 * Reads the run id of a 202 trigger body, or `undefined` for a synchronous one.
 *
 * @param body - The parsed trigger response body
 * @returns The accepted run id when the trigger answered asynchronously
 */
export function acceptedRunId(body: unknown): string | undefined {
    const record = body as { readonly data?: Record<string, unknown> } & Record<string, unknown>;
    const data = (record?.data ?? record) as Record<string, unknown> | undefined;
    return data?.accepted === true && typeof data.runId === 'string' ? data.runId : undefined;
}

/**
 * URL of a manual admin cron trigger. The reconciliation sweep resumes today's cycle (and skips
 * a finished one), so an e2e run that sweeps several times in one real day must open a fresh
 * cycle each time (HOS-1999).
 */
export function cronTriggerUrl(args: {
    readonly apiUrl: string;
    readonly jobName: string;
}): string {
    const base = `${args.apiUrl}/api/v1/admin/cron/${args.jobName}`;
    return args.jobName === 'billing-reconciliation-sweep' ? `${base}?newCycle=true` : base;
}
