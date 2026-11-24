/**
 * @file cache/purge-on-deploy.ts
 * @description Edge-cache purge per deploy (a primary plus a confirmation),
 * scoped to this deployment (HOS-427, HOS-2577).
 *
 * Public HTML is edge-cached per class (`cache-classes.ts`: up to a day for the
 * static pages, an hour for catalog and detail), so without this the edge keeps
 * serving the PREVIOUS build for up to that TTL after every release. The static
 * pages (`nosotros`, the legals, `beneficios`, …) change only on deploy, so this
 * purge is their entire invalidation story.
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
 * the old one, and until then the proxy routes to BOTH. A purge fired while the
 * old container still serves can be followed by a request it answers, which
 * re-populates the edge with the previous build's HTML. Every log line and every
 * unit test would still say success.
 *
 * The real sequence, from a staging deploy log (HOS-2577, 2026-11-23, UTC):
 *
 *   22:29:06 New container started (traffic reaches it at once; first request
 *            ~22:29:15 starts this module's clock)
 *   22:29:06 Waiting for the start period (60 seconds) before starting healthcheck
 *   22:30:00 deploy cache purge OK (first request + 45 s)   <- the old delay
 *   22:30:06 New container is healthy
 *   22:30:07 Waiting 5 seconds for the proxy to send traffic to the new container
 *   22:30:12 Removing old containers
 *   22:30:42 Rolling update completed (old container gone only here: ~30 s drain)
 *
 * Cloudflare re-cached the OLD build's HTML at ~22:30:55, after the purge. The
 * old container dies about start_period + 5 s proxy wait + up to 30 s drain after
 * the new one starts (~95 s on staging, start_period 60; production uses 5 s).
 * So the primary purge waits {@link DEPLOY_PURGE_SETTLE_MS} (120 s), and a
 * confirmation purge at {@link DEPLOY_PURGE_CONFIRM_MS} (300 s) covers Coolify
 * timings changing or someone raising the start period. Both are anchored on
 * the first request. Anchoring on `/api/health/` would add nothing: the probe is
 * itself a request, so it is already the first one that starts the clock.
 *
 * WHAT THE DELAY DOES NOT GUARANTEE. The clock starts when this process serves
 * its FIRST REQUEST. Coolify's healthcheck is enabled on both environments, so
 * that request is the probe and the first term is effectively constant. Were the
 * healthcheck turned off again, the real latency would become (time until
 * something reaches the origin) + the delay, with no upper bound, which matters
 * on a 24 h `s-maxage` (HOS-426).
 *
 * WHY IT NEVER THROWS AND NEVER EXITS. A failed purge degrades to exactly the
 * behaviour of having no purge (stale for up to the class TTL). Crashing the server over
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
 * How long to wait, after this process serves its first request, before the
 * PRIMARY purge.
 *
 * Must outlast the moment Coolify removes the old container, or the old build
 * re-caches its HTML after the purge. On staging that is about 95 s after the
 * new container starts (60 s start period + 5 s proxy wait + up to 30 s drain,
 * see the file header); 120 s leaves margin. Lowering this to the old 45 s is
 * the HOS-2577 regression: the purge ran while the old container still served.
 */
export const DEPLOY_PURGE_SETTLE_MS = 120_000;

/**
 * How long to wait, after the first request, before the CONFIRMATION purge.
 *
 * A safety net for the case the primary one lands too early (Coolify timings
 * change, or the healthcheck start period is raised). Idempotent and cheap: a
 * second tag purge of the same namespace.
 */
export const DEPLOY_PURGE_CONFIRM_MS = 300_000;

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
 * @param params.label - Which purge gave up.
 */
function alertPurgeFailed({
    tag,
    detail,
    label
}: {
    readonly tag: string;
    readonly detail: string;
    readonly label: PurgeLabel;
}): void {
    try {
        console.error(
            `[web] deploy cache purge FAILED (${label}) for "${tag}" after ${DEPLOY_PURGE_MAX_ATTEMPTS} attempts — ` +
                `the edge may serve the previous build for up to its TTL. Last failure: ${detail}`
        );
        Sentry.captureMessage(
            `[HOS-427] deploy cache purge failed (${label}) for ${tag}: ${detail}`,
            {
                level: 'error',
                tags: { module: 'web', subsystem: 'deploy-cache-purge' }
            }
        );
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

/** Which of the two scheduled purges a log line refers to. */
type PurgeLabel = 'primary' | 'confirmation';

/**
 * Wait, then purge, retrying a bounded number of times.
 *
 * @param params.plan - The already-validated plan.
 * @param params.label - Which purge this is, for the logs.
 * @param params.waitMs - Delay before the first attempt.
 * @returns A promise that resolves once the purge has succeeded or been alerted.
 */
async function waitThenPurge({
    plan,
    label,
    waitMs
}: {
    readonly plan: Extract<DeployPurgePlan, { kind: 'run' }>;
    readonly label: PurgeLabel;
    readonly waitMs: number;
}): Promise<void> {
    await delay({ ms: waitMs });

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
                    `[web] deploy cache purge OK (${label}) — purged "${plan.tag}" on attempt ${attempt}`
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

    alertPurgeFailed({ tag: plan.tag, detail: lastFailure, label });
}

/**
 * Run the primary and the confirmation purge, both anchored on now.
 *
 * The two are independent: one failing or alerting never prevents the other.
 *
 * @param params.plan - The already-validated plan.
 * @returns A promise that resolves once both purges succeeded or were alerted.
 */
async function runPurges({
    plan
}: {
    readonly plan: Extract<DeployPurgePlan, { kind: 'run' }>;
}): Promise<void> {
    await Promise.all([
        waitThenPurge({ plan, label: 'primary', waitMs: DEPLOY_PURGE_SETTLE_MS }),
        waitThenPurge({ plan, label: 'confirmation', waitMs: DEPLOY_PURGE_CONFIRM_MS })
    ]);
}

/**
 * Take this process's one shot at purging the edge cache for its deployment.
 *
 * Safe and cheap to call on every request: after the first call it does nothing.
 * The caller must NOT await it — the triggering response is served normally
 * while the purges settle and run in the background.
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
 * @returns A promise that settles when both purges finish, or `null` when this
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

    return runPurges({ plan });
}

/**
 * Reset the once-per-process latch.
 *
 * @internal Tests only, which need more than one deployment per process.
 */
export function _resetPurgeOnDeploy(): void {
    started = false;
}
