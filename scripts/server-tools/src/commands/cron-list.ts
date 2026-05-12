/**
 * `hops cron-list` — numbered listing of every node-cron job registered
 * in the running API process.
 *
 * Reads from `GET /api/v1/admin/cron`. The endpoint requires admin auth
 * (Better Auth session cookie); see `lib/api-client.ts` for how that is
 * wired through `HOPS_ADMIN_COOKIE`.
 *
 * The numbered indices in the output are stable for a single SSH
 * session: `cron-trigger 5` re-fetches the list and uses the same
 * sort, so the index always refers to whatever `cron-list` last
 * showed.
 */

import { createHospedaApiClient } from '../lib/api-client.ts';
import { die, log } from '../lib/log.ts';

/** Shape returned by `GET /api/v1/admin/cron` (mirror of the API's Zod schema). */
export interface CronJobInfo {
    readonly name: string;
    readonly description: string;
    readonly schedule: string;
    readonly enabled: boolean;
}

/** Wrapper around the data envelope so callers also see the totals. */
export interface CronJobListResponse {
    readonly jobs: ReadonlyArray<CronJobInfo>;
    readonly totalJobs: number;
    readonly enabledJobs: number;
}

const HELP = `
hops cron-list

List every node-cron job registered in the running API process. Output
is a numbered table sorted alphabetically by job name; the index in the
left column is what \`cron-trigger\` consumes.

Flags:
  --help, -h     Show this help.

Notes:
  - Requires HOPS_ADMIN_COOKIE in scripts/server-tools/.env.local. The
    underlying endpoint (\`/api/v1/admin/cron\`) is gated by Better
    Auth session cookie + the SYSTEM_MAINTENANCE_MODE permission.
  - When the cookie expires the API returns 401 — the error message
    points at where to refresh it.
`.trim();

/**
 * Fetch and sort the registered cron jobs. Exported so `cron-trigger`
 * can reuse the same source without re-implementing the fetch / sort.
 */
export async function fetchCronJobs(): Promise<CronJobListResponse> {
    const client = createHospedaApiClient();
    const data = await client.get<CronJobListResponse>('/api/v1/admin/cron');
    const jobs = [...data.jobs].sort((a, b) => a.name.localeCompare(b.name));
    return {
        jobs,
        totalJobs: data.totalJobs,
        enabledJobs: data.enabledJobs
    };
}

export async function cronList(argv: ReadonlyArray<string>): Promise<void> {
    if (argv.includes('--help') || argv.includes('-h')) {
        process.stdout.write(`${HELP}\n`);
        return;
    }

    const { jobs, totalJobs, enabledJobs } = await fetchCronJobs();

    if (jobs.length === 0) {
        die('No cron jobs registered in the running API process.');
    }

    // Compute column widths so the table renders aligned regardless of
    // job-name / schedule lengths.
    const idxWidth = String(jobs.length).length;
    const nameWidth = jobs.reduce((m, j) => Math.max(m, j.name.length), 4);
    const schedWidth = jobs.reduce((m, j) => Math.max(m, j.schedule.length), 8);

    log.info(`${enabledJobs} enabled / ${totalJobs} total`);

    process.stdout.write(
        `${'#'.padStart(idxWidth)}  ${'name'.padEnd(nameWidth)}  ${'schedule'.padEnd(schedWidth)}  enabled  description\n`
    );
    process.stdout.write(
        `${'-'.repeat(idxWidth)}  ${'-'.repeat(nameWidth)}  ${'-'.repeat(schedWidth)}  -------  -----------\n`
    );

    for (const [i, job] of jobs.entries()) {
        const idx = String(i + 1).padStart(idxWidth);
        const name = job.name.padEnd(nameWidth);
        const sched = job.schedule.padEnd(schedWidth);
        const enabled = job.enabled ? '   yes ' : '   no  ';
        process.stdout.write(`${idx}  ${name}  ${sched}  ${enabled}  ${job.description}\n`);
    }
}
