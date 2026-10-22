/**
 * Healthchecks.io cron pings (HOS-1742).
 *
 * The Sentry Crons quota does not cover every cron monitor the cutover needs,
 * so the owner moved the three cutover jobs to Healthchecks.io's free plan
 * instead of a paid Sentry tier. Sentry pings (`cron-monitor-ping.ts`,
 * `cron-heartbeat.ts`) are untouched; this module is additive.
 *
 * The free plan allows ONE project, shared by staging and prod under the same
 * project ping key. The environment is therefore encoded in the check slug:
 * `<HOSPEDA_HEALTHCHECKS_SLUG_PREFIX>-<job>`. Both env vars are required; when
 * either is missing the helper is a no-op, so staging can never feed the prod
 * checks.
 *
 * Pings are best-effort: they use a short timeout, and every failure (network,
 * timeout, non-2xx) is logged without the ping key or the full URL and then
 * swallowed. A ping never alters the cron outcome.
 *
 * @module utils/healthchecks-ping
 */

import { env } from './env.js';
import { apiLogger } from './logger';

/** Cron jobs that report to Healthchecks.io during the cutover (HOS-1742). */
export const HEALTHCHECKS_MONITORED_JOBS = [
    'billing-reconciliation-sweep',
    'listing-coverage-reconciler',
    'listing-remote-deletion-retry'
] as const;

/** Environment prefix that separates staging and prod checks in one project. */
export type HealthchecksSlugPrefix = 'staging' | 'prod';

/** Lifecycle signal sent to Healthchecks for one cron tick. */
export type HealthchecksSignal = 'start' | 'success' | 'fail';

/** Explicit config override; when absent, the two env vars are read instead. */
export interface HealthchecksConfig {
    readonly pingKey?: string | undefined;
    readonly slugPrefix?: HealthchecksSlugPrefix | undefined;
}

/** Arguments for {@link buildHealthchecksPingUrl}. */
export interface BuildHealthchecksPingUrlArgs {
    readonly pingKey: string;
    readonly slugPrefix: string;
    readonly job: string;
    readonly signal: HealthchecksSignal;
}

/** Arguments for {@link pingHealthchecks}. */
export interface PingHealthchecksArgs {
    readonly job: string;
    readonly signal: HealthchecksSignal;
    readonly config?: HealthchecksConfig;
    readonly fetch?: typeof globalThis.fetch;
    readonly timeoutMs?: number;
}

/** Default ping timeout: short enough to never hold a cron tick hostage. */
const DEFAULT_TIMEOUT_MS = 3000;

/** URL suffix per signal; success is the bare check URL. */
const SIGNAL_SUFFIX: Record<HealthchecksSignal, string> = {
    start: '/start',
    success: '',
    fail: '/fail'
};

/**
 * Builds the Healthchecks ping URL for one signal.
 *
 * `?create=0` keeps a typo'd slug from silently creating a new check: an
 * unknown slug answers 404 and the helper only logs a warning. Both `job` and
 * the slug are not filtered here — the monitored-job allowlist lives in the
 * cron bootstrap.
 *
 * @param args - Ping key, slug prefix, job name, and signal.
 * @returns The absolute Healthchecks ping URL.
 */
export function buildHealthchecksPingUrl(args: BuildHealthchecksPingUrlArgs): string {
    const slug = `${args.slugPrefix}-${args.job}`;
    return `https://hc-ping.com/${encodeURIComponent(args.pingKey)}/${encodeURIComponent(slug)}${SIGNAL_SUFFIX[args.signal]}?create=0`;
}

/**
 * Sends one best-effort ping to Healthchecks.io.
 *
 * Resolves in every path, including a missing config, a rejected fetch, an
 * aborted timeout, and a non-2xx response. Failures are logged with the job,
 * the signal, and the status or error message only — never the ping key or the
 * full URL.
 *
 * @param args - Job, signal, optional config/fetch/timeout overrides.
 */
export async function pingHealthchecks(args: PingHealthchecksArgs): Promise<void> {
    const config: HealthchecksConfig = args.config ?? {
        pingKey: env.HOSPEDA_HEALTHCHECKS_PING_KEY,
        slugPrefix: env.HOSPEDA_HEALTHCHECKS_SLUG_PREFIX
    };

    if (!config.pingKey || !config.slugPrefix) return;

    const fetchFn = args.fetch ?? globalThis.fetch.bind(globalThis);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), args.timeoutMs ?? DEFAULT_TIMEOUT_MS);

    try {
        const response = await fetchFn(
            buildHealthchecksPingUrl({
                pingKey: config.pingKey,
                slugPrefix: config.slugPrefix,
                job: args.job,
                signal: args.signal
            }),
            { method: 'GET', signal: controller.signal }
        );

        if (!response.ok) {
            apiLogger.warn({
                message: 'Healthchecks ping failed',
                job: args.job,
                signal: args.signal,
                status: response.status
            });
        }
    } catch (error) {
        apiLogger.warn({
            message: 'Healthchecks ping failed',
            job: args.job,
            signal: args.signal,
            error: error instanceof Error ? error.message : String(error)
        });
    } finally {
        clearTimeout(timeout);
    }
}
