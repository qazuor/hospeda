/**
 * @file plan-properties.ts
 * @description Fetches the authenticated user's plan/tier and sets it as PostHog
 * person properties (`plan`, `plan_status`).
 *
 * Deliberately NOT resolved on the `/auth/me` hot path: that endpoint is hit by
 * every visitor (including anonymous ones on SSG pages) and must stay cheap.
 * Plan resolution instead reads through the shared `@/lib/entitlements-cache`
 * module (the same 60 s cache `useMyEntitlements` uses), runs client-side,
 * non-blocking, AFTER identify — so it can never slow the public auth check or
 * block rendering, and never fires a SECOND network call for data the hook may
 * already be fetching on the same page load.
 */

import { getEntitlementsCached } from '@/lib/entitlements-cache';
import { setPersonProperties } from './posthog-client';

/**
 * Guard so the plan is fetched at most once per page load. UserMenu remounts on
 * every soft navigation (Astro View Transitions), so without this the endpoint
 * would be hit on every navigation. Reset to `false` on transient failure so a
 * later mount can retry; stays `true` after a successful sync.
 */
let synced = false;

/** Test-only hook to reset the module-level guard between cases. */
export function __resetPlanPropertiesSyncedForTests(): void {
    synced = false;
}

/**
 * Fetch the authenticated user's plan/tier from the shared entitlements
 * cache and set it as PostHog person properties. Best-effort and
 * non-blocking: any failure is swallowed. Users without an active paid
 * subscription report `plan: 'free'` / `plan_status: 'none'`.
 *
 * @param _input - Unused. Kept for call-site backward compatibility; the API
 *   base URL is now resolved internally by `@/lib/entitlements-cache`.
 */
export async function syncPlanPersonProperties(_input: { apiUrl: string }): Promise<void> {
    if (synced || typeof window === 'undefined') return;
    synced = true;
    try {
        const { plan } = await getEntitlementsCached();
        setPersonProperties({
            plan: plan?.slug ?? 'free',
            plan_status: plan?.status ?? 'none'
        });
    } catch {
        // 401 (not authenticated) / network / transient error — swallow and
        // allow a later retry.
        synced = false;
    }
}
