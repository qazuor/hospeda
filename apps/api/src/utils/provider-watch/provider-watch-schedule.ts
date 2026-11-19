/**
 * Which account the watch battery targets and whether a scheduled tick is due (HOS-1512).
 *
 * One job, one DAILY tick: the account and the cadence come from the environment. The
 * environment is the one the external watchdog already uses (`HOSPEDA_HEALTHCHECKS_SLUG_PREFIX`):
 * staging watches the sandbox test account, production watches production, both every day, so
 * the account a run targets and the watchdog check it pings always agree.
 *
 * @module utils/provider-watch/provider-watch-schedule
 */
import type { WatchAccount } from '@repo/payments';

/**
 * The most a live run may take: the job's timeout. A `running` row older than this is abandoned.
 *
 * Why that is safe with the cron lock: the job is exclusive, so only one run lives at a time, and a
 * live run stops STARTING measurements at {@link PROVIDER_WATCH_RUN_BUDGET_MS}; the longest request
 * it can still be waiting on is capped by the transport's 30 s timeout. Budget plus that request is
 * under this deadline, so a row older than it belongs to a process that died, never to a live run.
 */
export const PROVIDER_WATCH_RUN_DEADLINE_MS = 600_000;

/** When a live run stops starting measurements (90% of the deadline). */
export const PROVIDER_WATCH_RUN_BUDGET_MS = 540_000;

/** The transport's per-request timeout, which bounds the last request of a live run. */
export const PROVIDER_WATCH_REQUEST_TIMEOUT_MS = 30_000;

/** Name of the job, also the slug suffix of its watchdog check. */
export const PROVIDER_WATCH_JOB_NAME = 'provider-watch-battery';

/**
 * Maps the environment to the account the battery targets.
 *
 * @param args.slugPrefix - `HOSPEDA_HEALTHCHECKS_SLUG_PREFIX`
 * @returns The account, or `null` when the environment does not say
 */
export function resolveWatchAccount(args: {
    readonly slugPrefix: 'staging' | 'prod' | undefined;
}): WatchAccount | null {
    if (args.slugPrefix === 'staging') return 'sandbox';
    if (args.slugPrefix === 'prod') return 'production';
    return null;
}

/**
 * Whether a SCHEDULED tick runs the battery. Every daily tick is due, in both accounts (owner
 * decision 2026-11-18: the battery moves no money, so nothing argues for running it less often
 * than the provider can change). Production still needs the current month's authorization,
 * which the job checks separately. Kept as a function, taking the account and the instant, so a
 * future cadence per account changes one place.
 *
 * @param args.account - The account the environment targets
 * @param args.now - The tick's instant
 * @returns Whether the battery runs: always
 */
export function isScheduledTickDue(_args: {
    readonly account: WatchAccount;
    readonly now: Date;
}): boolean {
    return true;
}
