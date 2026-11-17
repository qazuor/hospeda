/**
 * Which account the watch battery targets and whether a scheduled tick is due (HOS-1512).
 *
 * One job, one weekly tick: the account and the cadence come from the environment. The
 * environment is the one the external watchdog already uses (`HOSPEDA_HEALTHCHECKS_SLUG_PREFIX`):
 * staging watches the sandbox test account every week, production watches production once a
 * month, so the account a run targets and the watchdog check it pings always agree.
 *
 * @module utils/provider-watch/provider-watch-schedule
 */
import type { WatchAccount } from '@repo/payments';

const MARKET_TIME_ZONE = 'America/Argentina/Buenos_Aires';

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
 * Whether a SCHEDULED tick runs the battery. Every account is ticked weekly; production only
 * runs on the first tick of the month, so it runs monthly. A manual run is always due.
 *
 * @param args.account - The account the environment targets
 * @param args.now - The tick's instant
 * @returns Whether the battery runs
 */
export function isScheduledTickDue(args: {
    readonly account: WatchAccount;
    readonly now: Date;
}): boolean {
    if (args.account === 'sandbox') return true;
    const day = Number(
        new Intl.DateTimeFormat('en-CA', {
            timeZone: MARKET_TIME_ZONE,
            day: 'numeric'
        }).format(args.now)
    );
    return day <= 7;
}
