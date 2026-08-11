/**
 * @file cache/purge-on-deploy.ts
 * @description One edge-cache purge per deploy, scoped to this deployment (HOS-427).
 *
 * Public HTML ships with `s-maxage=300, stale-while-revalidate=600`, so without
 * this the edge keeps serving the PREVIOUS build for up to ~15 minutes after
 * every release. The static pages (`nosotros`, the legals, `beneficios`, …)
 * change only on deploy, so that window is their entire staleness budget.
 *
 * WHY THE CONTAINER PURGES ITSELF, rather than the deploy tooling doing it.
 * The trigger has to be "a new build is running", not "somebody ran a command":
 * `hops redeploy` is fire-and-forget and, more decisively, production deploys
 * are triggered by a button in the Coolify dashboard. A purge wired into the
 * CLI would simply never run for the deploys that matter. Doing it here also
 * keeps the mechanism in the repo instead of in dashboard configuration, and
 * the Cloudflare credentials already live in this app and nowhere else.
 *
 * WHY THERE IS A SETTLE DELAY, and why removing it silently breaks everything.
 * Coolify performs a ROLLING update: it starts the new container, then removes
 * the old one — and with no healthcheck gating that gap, both are briefly alive
 * and the proxy can route to either. A purge fired the instant this process
 * serves its first request can therefore be followed by a request served by the
 * OLD container, which re-populates the edge with the previous build's HTML.
 * No second purge is coming. Every log line and every unit test would still say
 * success. So the purge waits {@link DEPLOY_PURGE_SETTLE_MS} first — long past
 * the observed overlap, still a small fraction of the 300 s `s-maxage`.
 *
 * WHAT THE DELAY DOES NOT GUARANTEE. The clock starts when this process serves
 * its FIRST REQUEST, so the real latency is (time until something reaches the
 * origin) + the settle delay, and the first term has no upper bound. On a fully
 * cached site with no traffic, a deploy at 03:00 may not purge until the first
 * revalidation wakes the origin. That is never worse than the status quo — the
 * stale window is bounded by the TTL either way — but it is weaker than "purges
 * 45 s after every deploy", and it gets weaker as TTLs rise, which is exactly
 * what HOS-426 intends to do next. The fix is not in this file: enabling
 * Coolify's healthcheck (already configured, just disabled) makes the container
 * receive a probe immediately and turns the first term into a constant.
 *
 * WHY IT NEVER THROWS AND NEVER EXITS. A failed purge degrades to exactly the
 * behaviour we have today (stale for up to ~15 min). Crashing the server over
 * it would trade that for a real outage, and would loop against the container
 * healthcheck. It retries, then alerts loudly, then keeps serving.
 */

import * as Sentry from '@sentry/astro';
import { getCacheTagEnvironment } from './cache-tag-environment.js';
import {
    type CloudflareCredentials,
    purgeCloudflare,
    readCloudflareCredentials
} from './cloudflare-purge.js';
import { buildCatchAllTag } from './response-cache.js';

/**
 * How long to wait, after this process serves its first request, before purging.
 *
 * Sized against the Coolify rolling-update overlap described in the file header:
 * comfortably longer than the observed "new container started → old containers
 * removed" gap, and still small next to the 300 s `s-maxage` it exists to cut
 * short. Lowering this to zero is the one change that makes this module appear
 * to work while doing nothing.
 */
export const DEPLOY_PURGE_SETTLE_MS = 45_000;

/** How many times to try the purge before giving up and alerting. */
export const DEPLOY_PURGE_MAX_ATTEMPTS = 3;

/**
 * Base spacing between retries.
 *
 * Cloudflare's Free plan allows 5 tag-purges per minute, which is why
 * `RevalidationService` paces its own purges at one per 12 s. This module spends
 * from the SAME budget, so a retry that fires immediately would just collect the
 * same 403 that caused it.
 */
export const DEPLOY_PURGE_RETRY_BASE_MS = 12_000;

/** Decision taken before any waiting happens. */
type DeployPurgePlan =
    | { readonly kind: 'skip'; readonly reason: string }
    | {
          readonly kind: 'run';
          readonly tag: string;
          readonly credentials: CloudflareCredentials;
      };

/**
 * Whether this process has already taken its one shot.
 *
 * Set synchronously by {@link schedulePurgeOnDeploy} before it awaits anything,
 * which is what makes concurrent first requests collapse to a single purge
 * rather than one per request.
 */
let started = false;

/**
 * Sleep, without holding the process open.
 *
 * @param params.ms - Milliseconds to wait.
 * @returns A promise resolving after the delay.
 */
function delay({ ms }: { readonly ms: number }): Promise<void> {
    return new Promise((resolve) => {
        const timer = setTimeout(resolve, ms);
        // A pending purge must never be the reason a process stays alive.
        (timer as { unref?: () => void }).unref?.();
    });
}

/**
 * Decide whether this deployment should purge, and what tag it would purge.
 *
 * Every `skip` is a normal, expected state — local development, CI, or an
 * environment with no Cloudflare in front of it — so none of them is an error.
 *
 * @returns The plan.
 */
export function planDeployPurge(): DeployPurgePlan {
    const environment = getCacheTagEnvironment();
    if (environment === null) {
        return {
            kind: 'skip',
            reason: 'the cache-tag namespace could not be resolved, so there is no correct tag to purge (cache tagging is disabled too)'
        };
    }

    // `dev` and `test` have no shared cache in front of them. Purging would be a
    // pointless call to a live third-party API from a laptop and from CI.
    if (environment !== 'prod' && environment !== 'preview') {
        return {
            kind: 'skip',
            reason: `environment is "${environment}", which has no edge cache in front of it`
        };
    }

    const credentials = readCloudflareCredentials();
    if (credentials === null) {
        return {
            kind: 'skip',
            reason: 'CLOUDFLARE_ZONE_ID and/or CLOUDFLARE_API_TOKEN are not configured'
        };
    }

    const tag = buildCatchAllTag({ environment });
    if (tag === null) {
        return { kind: 'skip', reason: 'the catch-all cache tag could not be built' };
    }

    return { kind: 'run', tag, credentials };
}

/**
 * Emit the give-up alert. Mirrors `lib/internal-bypass-report.ts`.
 *
 * Plain `console.error` rather than `webLogger`, which no-ops in production
 * unless `PUBLIC_ENABLE_LOGGING` is set — this alert must never be silenced.
 *
 * @param params.tag - The tag that failed to purge.
 * @param params.detail - Why the last attempt failed.
 */
function alertPurgeFailed({
    tag,
    detail
}: {
    readonly tag: string;
    readonly detail: string;
}): void {
    try {
        console.error(
            `[web] deploy cache purge FAILED for "${tag}" after ${DEPLOY_PURGE_MAX_ATTEMPTS} attempts — ` +
                `the edge may serve the previous build for up to its TTL. Last failure: ${detail}`
        );
        Sentry.captureMessage(`[HOS-427] deploy cache purge failed for ${tag}: ${detail}`, {
            level: 'error',
            tags: { module: 'web', subsystem: 'deploy-cache-purge' }
        });
    } catch (error) {
        // The alert path itself must never break the request that triggered it.
        console.error('[web] deploy cache purge alert emission threw unexpectedly:', error);
    }
}

/**
 * Describe an outcome for the log, without leaking the token.
 *
 * @param params.outcome - What the attempt returned, or the error it threw.
 * @returns A short human-readable reason.
 */
function describeFailure({ outcome }: { readonly outcome: unknown }): string {
    if (outcome instanceof Error) return `network error: ${outcome.message}`;
    if (typeof outcome === 'object' && outcome !== null && 'kind' in outcome) {
        const failure = outcome as { kind: string; status?: number; detail?: unknown };
        return `${failure.kind} (status ${failure.status}): ${JSON.stringify(failure.detail)}`;
    }
    return String(outcome);
}

/**
 * Wait out the container overlap, then purge, retrying a bounded number of times.
 *
 * @param params.plan - The already-validated plan.
 * @returns A promise that resolves once the purge has succeeded or been alerted.
 */
async function settleThenPurge({
    plan
}: {
    readonly plan: Extract<DeployPurgePlan, { kind: 'run' }>;
}): Promise<void> {
    await delay({ ms: DEPLOY_PURGE_SETTLE_MS });

    let lastFailure = '<never attempted>';

    for (let attempt = 1; attempt <= DEPLOY_PURGE_MAX_ATTEMPTS; attempt += 1) {
        try {
            const outcome = await purgeCloudflare({
                zoneId: plan.credentials.zoneId,
                apiToken: plan.credentials.apiToken,
                // ONE tag, ONE request. Never the whole-zone instruction: staging
                // and production share a Cloudflare zone.
                instruction: { kind: 'tags', tags: [plan.tag] }
            });

            if (outcome.ok) {
                console.info(
                    `[web] deploy cache purge OK — purged "${plan.tag}" on attempt ${attempt}`
                );
                return;
            }

            lastFailure = describeFailure({ outcome });
        } catch (error) {
            lastFailure = describeFailure({ outcome: error });
        }

        if (attempt < DEPLOY_PURGE_MAX_ATTEMPTS) {
            await delay({ ms: DEPLOY_PURGE_RETRY_BASE_MS * attempt });
        }
    }

    alertPurgeFailed({ tag: plan.tag, detail: lastFailure });
}

/**
 * Take this process's one shot at purging the edge cache for its deployment.
 *
 * Safe and cheap to call on every request: after the first call it does nothing.
 * The caller must NOT await it — the triggering response is served normally
 * while the purge settles and runs in the background.
 *
 * NEVER THROWS, BY CONSTRUCTION RATHER THAN BY LUCK. The whole synchronous path
 * is wrapped, so the caller's `void schedulePurgeOnDeploy()` cannot turn a cache
 * concern into a failed request. That wrapper is not currently reachable — every
 * callee happens to be total today — but the latch is set before the plan is
 * computed (it has to be, or concurrent first requests would not collapse), so
 * a future throw in {@link planDeployPurge} would otherwise cost BOTH a 500 on
 * that request AND a permanently burned latch: that container would never purge
 * again, and nothing would retry.
 *
 * @returns A promise that settles when the purge finishes, or `null` when this
 *   call was a no-op (already fired, or this deployment does not purge). Tests
 *   await the promise; the middleware ignores it.
 */
export function schedulePurgeOnDeploy(): Promise<void> | null {
    if (started) return null;
    // Set BEFORE anything async: concurrent first requests must collapse to one
    // purge, not one each.
    started = true;

    let plan: DeployPurgePlan;
    try {
        plan = planDeployPurge();
    } catch (error) {
        console.error('[web] deploy cache purge planning threw unexpectedly:', error);
        return null;
    }

    if (plan.kind === 'skip') {
        // Deliberately visible: a deployment that is NOT purging should say so
        // once, or a missing credential looks identical to a working purge.
        console.info(`[web] deploy cache purge skipped — ${plan.reason}`);
        return null;
    }

    return settleThenPurge({ plan });
}

/**
 * Reset the once-per-process latch.
 *
 * @internal Tests only, which need more than one deployment per process.
 */
export function _resetPurgeOnDeploy(): void {
    started = false;
}
