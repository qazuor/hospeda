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

/**
 * How long a run may take (the job's timeout). A run still `running` this long after it started is
 * abandoned: its process died or was killed without closing it.
 */
export const PROVIDER_WATCH_RUN_DEADLINE_MS = 600_000;

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

/** Parts of an instant on the market clock. */
function marketParts(args: { readonly at: Date }): {
    readonly day: number;
    readonly weekday: string;
} {
    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: MARKET_TIME_ZONE,
        day: 'numeric',
        weekday: 'short'
    }).formatToParts(args.at);
    return {
        day: Number(parts.find((part) => part.type === 'day')?.value),
        weekday: parts.find((part) => part.type === 'weekday')?.value ?? ''
    };
}

/**
 * Whether a SCHEDULED tick runs the battery. The job ticks DAILY and the environment picks its
 * day: the sandbox account runs every Monday (weekly), production runs on the 1st of every
 * month (monthly). A fixed day, not "the first Monday", keeps the gap between two production
 * runs under the watchdog's one month plus one day. A manual run is always due.
 *
 * @param args.account - The account the environment targets
 * @param args.now - The tick's instant
 * @returns Whether the battery runs
 */
export function isScheduledTickDue(args: {
    readonly account: WatchAccount;
    readonly now: Date;
}): boolean {
    const { day, weekday } = marketParts({ at: args.now });
    return args.account === 'sandbox' ? weekday === 'Mon' : day === 1;
}
