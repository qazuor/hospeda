/**
 * @file usage-badge.ts
 * @description Per-vertical plan/limit usage for the commerce owner index
 * (`mi-cuenta/comercio`, HOS-689 item 1).
 *
 * Commerce billing is per-owner-per-vertical (HOS-688): gastronomy and
 * experience each have their OWN limit key (`LIMIT_KEY_BY_COMMERCE_VERTICAL`)
 * and their OWN subscription domain. Two verticals are therefore two
 * INDEPENDENT usage readings, never a merged total — the same reason §6.8
 * refused a pooled cap. This mirrors `apps/web/src/lib/host/usage-badge.ts`
 * (the accommodation badge), but that module hardcodes ONE limit key
 * (`MAX_ACCOMMODATIONS_LIMIT_KEY`); here the key is resolved PER CALL from
 * the vertical argument instead of being a fixed module constant, so a third
 * vertical (if one is ever added) is a `LIMIT_KEY_BY_COMMERCE_VERTICAL` entry,
 * not a new exported constant.
 *
 * Also doubles as the "does the owner already hold a subscription in this
 * vertical" signal used by the per-listing publish CTA (HOS-689 item 4):
 * `GET /billing/usage/:limitKey` 404s when the caller has no subscription in
 * the requested product domain (see `apps/api/src/routes/billing/usage.ts`),
 * so a resolved (non-null) reading here IS proof of an existing subscription
 * — no separate `GET /users/me/subscription` call is needed for that signal.
 */

import { LIMIT_KEY_BY_COMMERCE_VERTICAL } from '@repo/billing';
import { apiClient } from '../api/client';
import type { CommerceVertical } from './owner-listings';

/** Parsed usage reading for one commerce vertical's listing cap. */
export interface CommerceVerticalUsage {
    /** Listings currently counted against the cap. */
    readonly currentUsage: number;
    /** Maximum listings allowed for this vertical on the owner's plan. */
    readonly maxAllowed: number;
    /** Threshold indicator emitted by the API: `'ok' | 'warning' | 'critical' | 'exceeded'`. */
    readonly threshold: string;
}

/**
 * Fetches the owner's usage against ONE vertical's listing cap.
 *
 * `apiClient.getProtected` already unwraps the `{ success, data }` envelope,
 * so the resolved value is the limit-usage row directly (see
 * `limitUsageSchema` in `apps/api/src/routes/billing/usage.ts`).
 *
 * @param params.vertical - Which commerce vertical to read the cap for.
 * @param params.cookieHeader - Raw `Cookie` header from the SSR request.
 * @returns The usage reading, or `null` when the owner holds no subscription
 *   in this vertical yet (the endpoint 404s) or the request otherwise
 *   failed. `null` is a legitimate "not subscribed yet" signal, not an error
 *   state — a fresh commerce owner has no vertical subscription until their
 *   first listing's checkout completes.
 */
export async function fetchCommerceVerticalUsage({
    vertical,
    cookieHeader
}: {
    readonly vertical: CommerceVertical;
    readonly cookieHeader?: string;
}): Promise<CommerceVerticalUsage | null> {
    const limitKey = LIMIT_KEY_BY_COMMERCE_VERTICAL[vertical];

    const result = await apiClient.getProtected<CommerceVerticalUsage>({
        path: `/api/v1/protected/billing/usage/${limitKey}`,
        params: { productDomain: vertical },
        cookieHeader
    });

    return result.ok ? result.data : null;
}

/**
 * Fetches usage for every vertical in `verticals`, in parallel, keyed by
 * vertical. Callers should dedupe `verticals` first (e.g. via `new Set`) —
 * this function does not, so a duplicate entry would simply fetch twice.
 *
 * @param params.verticals - The verticals to fetch usage for (typically "every
 *   vertical the owner holds at least one listing in" — there is nothing to
 *   report for a vertical with zero listings).
 * @param params.cookieHeader - Raw `Cookie` header from the SSR request.
 * @returns A map from vertical to its usage reading (or `null` when the
 *   owner has no subscription in that vertical yet).
 */
export async function fetchCommerceUsageByVertical({
    verticals,
    cookieHeader
}: {
    readonly verticals: readonly CommerceVertical[];
    readonly cookieHeader?: string;
}): Promise<ReadonlyMap<CommerceVertical, CommerceVerticalUsage | null>> {
    const entries = await Promise.all(
        verticals.map(
            async (vertical) =>
                [vertical, await fetchCommerceVerticalUsage({ vertical, cookieHeader })] as const
        )
    );

    return new Map(entries);
}
