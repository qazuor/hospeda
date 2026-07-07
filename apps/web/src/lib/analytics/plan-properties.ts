/**
 * @file plan-properties.ts
 * @description Fetches the authenticated user's plan/tier and sets it as PostHog
 * person properties (`plan`, `plan_status`).
 *
 * Deliberately NOT resolved on the `/auth/me` hot path: that endpoint is hit by
 * every visitor (including anonymous ones on SSG pages) and must stay cheap.
 * Plan resolution instead uses the dedicated PROTECTED entitlements endpoint and
 * runs client-side, non-blocking, AFTER identify — so it can never slow the
 * public auth check or block rendering.
 */

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
 * Fetch the authenticated user's plan/tier from the protected entitlements
 * endpoint and set it as PostHog person properties. Best-effort and
 * non-blocking: any failure is swallowed. Users without an active paid
 * subscription report `plan: 'free'` / `plan_status: 'none'`.
 *
 * @param input - The API base URL (from `getApiUrl()`).
 */
export async function syncPlanPersonProperties(input: { apiUrl: string }): Promise<void> {
    if (synced || typeof window === 'undefined') return;
    synced = true;
    try {
        const response = await fetch(`${input.apiUrl}/api/v1/protected/users/me/entitlements`, {
            credentials: 'include'
        });
        if (!response.ok) {
            // 401 (not authenticated) / transient error — allow a later retry.
            synced = false;
            return;
        }
        const json = (await response.json()) as {
            data?: { plan?: { slug: string; status: string } | null };
        };
        const plan = json.data?.plan ?? null;
        setPersonProperties({
            plan: plan?.slug ?? 'free',
            plan_status: plan?.status ?? 'none'
        });
    } catch {
        // Analytics-only: never surface. Allow a later retry.
        synced = false;
    }
}
