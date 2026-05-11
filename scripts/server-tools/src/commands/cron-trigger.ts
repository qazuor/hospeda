/**
 * `hops cron-trigger [N|name] [--dry-run] [--yes]` — manually run a
 * registered cron job.
 *
 * Resolution order for which job to run:
 *   1. If a positional arg is a number → use that index from the
 *      cron-list output (1-based).
 *   2. If a positional arg is a non-empty string → match by job name
 *      (exact, case-sensitive — matches the registry key).
 *   3. Otherwise → open the @clack interactive picker.
 *
 * Hits `POST /api/v1/admin/cron/{jobName}?dryRun=...`. The server
 * enforces the per-job timeoutMs (default 30s), so this command will
 * also block for up to that long.
 */

import { createHospedaApiClient } from '../lib/api-client.ts';
import { die, log } from '../lib/log.ts';
import { confirm, pickOne } from '../lib/prompt.ts';
import { type CronJobInfo, fetchCronJobs } from './cron-list.ts';

/** Shape of the trigger response. */
interface CronTriggerResult {
    readonly success: boolean;
    readonly message: string;
    readonly processed: number;
    readonly errors: number;
    readonly durationMs: number;
    readonly details?: Readonly<Record<string, unknown>>;
    readonly jobName: string;
    readonly dryRun: boolean;
    readonly executedAt: string;
}

const HELP = `
hops cron-trigger [N|name] [--dry-run] [--yes]

Manually trigger a registered cron job. Without an argument, opens the
interactive picker (@clack). With a number, uses that index from the
\`cron-list\` output. With a string, looks up the job by exact name.

Flags:
  --dry-run      Pass dryRun=true to the endpoint. Whether the job
                 actually skips writes depends on the job's own
                 implementation; many ignore the flag entirely.
  --yes          Skip the destructive-action confirmation prompt.
                 Combine with N or a name for non-interactive runs
                 (e.g. from a wrapper script or systemd unit).
  --help, -h     Show this help.

Examples:
  hops cron-trigger                       # interactive picker
  hops cron-trigger 3                     # run the 3rd job from cron-list
  hops cron-trigger trial-expiry          # by exact name
  hops cron-trigger trial-expiry --dry-run --yes

Notes:
  - Disabled jobs cannot be triggered (the API returns 400).
  - The server enforces a per-job timeout (default 30s); this command
    blocks for up to that long.
`.trim();

interface ParsedArgs {
    readonly indexHint: number | null;
    readonly nameHint: string | null;
    readonly dryRun: boolean;
    readonly skipConfirm: boolean;
}

function parseArgs(argv: ReadonlyArray<string>): ParsedArgs {
    const positional = argv.filter((a) => !a.startsWith('--'));
    const first = positional[0];

    let indexHint: number | null = null;
    let nameHint: string | null = null;
    if (first !== undefined) {
        if (/^\d+$/.test(first)) {
            indexHint = Number.parseInt(first, 10);
        } else {
            nameHint = first;
        }
    }

    return {
        indexHint,
        nameHint,
        dryRun: argv.includes('--dry-run'),
        skipConfirm: argv.includes('--yes')
    };
}

function pickFromArgs(jobs: ReadonlyArray<CronJobInfo>, parsed: ParsedArgs): CronJobInfo | null {
    if (parsed.indexHint !== null) {
        const job = jobs[parsed.indexHint - 1];
        if (!job) {
            die(`Index ${parsed.indexHint} is out of range. The list has ${jobs.length} job(s).`);
        }
        return job;
    }
    if (parsed.nameHint !== null) {
        const match = jobs.find((j) => j.name === parsed.nameHint);
        if (!match) {
            die(
                `No job named '${parsed.nameHint}'. Run \`hops cron-list\` to see the available names.`
            );
        }
        return match;
    }
    return null;
}

export async function cronTrigger(argv: ReadonlyArray<string>): Promise<void> {
    if (argv.includes('--help') || argv.includes('-h')) {
        process.stdout.write(`${HELP}\n`);
        return;
    }

    const parsed = parseArgs(argv);
    const { jobs } = await fetchCronJobs();
    if (jobs.length === 0) {
        die('No cron jobs registered in the running API process.');
    }

    const direct = pickFromArgs(jobs, parsed);
    const chosen = direct
        ? direct
        : await pickOne('Pick a cron job to trigger', jobs, (job, i) => ({
              label: `[${i + 1}] ${job.name}`,
              hint: `${job.schedule}${job.enabled ? '' : ' · disabled'} — ${job.description}`
          }));

    if (!chosen.enabled) {
        die(
            `Cannot trigger '${chosen.name}': job is disabled in the registry. Enable it first by editing the job definition in apps/api/src/cron/jobs/.`
        );
    }

    log.info(`Job      : ${chosen.name}`);
    log.info(`Schedule : ${chosen.schedule}`);
    log.info(`Mode     : ${parsed.dryRun ? 'DRY RUN (dryRun=true)' : 'LIVE (dryRun=false)'}`);
    log.info(`Description: ${chosen.description}`);

    if (!parsed.skipConfirm) {
        const ok = await confirm(
            `Trigger '${chosen.name}' on the API now${parsed.dryRun ? ' (dry run)' : ''}?`,
            { defaultValue: parsed.dryRun }
        );
        if (!ok) {
            log.warn('Aborted.');
            return;
        }
    }

    const client = createHospedaApiClient();
    log.info('Sending trigger request...');
    const result = await client.post<CronTriggerResult>(
        `/api/v1/admin/cron/${encodeURIComponent(chosen.name)}`,
        undefined,
        { dryRun: String(parsed.dryRun) }
    );

    const status = result.success ? log.ok.bind(log) : log.warn.bind(log);
    status(
        `${chosen.name} ${result.success ? 'completed' : 'finished with errors'} in ${result.durationMs} ms`
    );
    log.info(`processed: ${result.processed}, errors: ${result.errors}`);
    log.info(`message  : ${result.message}`);
    if (result.details && Object.keys(result.details).length > 0) {
        log.hint(`details  : ${JSON.stringify(result.details)}`);
    }
}
