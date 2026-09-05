/**
 * @file trial-verdict.ts
 * @description Per-vertical "what would publishing do" verdict for the commerce
 * owner index (`mi-cuenta/comercio`, HOS-1184).
 *
 * Reads `GET /protected/commerce/subscriptions/{vertical}/trial-verdict`, which
 * answers one of three states rather than a boolean. That distinction is the
 * whole reason this module exists instead of one more flag derived from the
 * usage badge.
 *
 * `usage-badge.ts` doubles as the "does the owner already hold a subscription
 * here" signal, and until HOS-1184 that was enough, because publishing was
 * binary: attach to the plan you pay for, or go pay. With commerce's trial
 * restored there is a third outcome — publishing free for N days — and the
 * usage reading cannot see it. A `null` reading there means "no subscription",
 * which now covers both "starts a free trial" and "opens a checkout", and those
 * are opposite things to tell an owner.
 *
 * Kept separate from `usage-badge.ts` rather than folded into it because the
 * two answer different questions of different endpoints: how much of your cap
 * you have used, versus what the next publish costs you.
 */

import type { CommerceTrialVerdictKind } from '@repo/schemas';
import { apiClient } from '../api/client';
import type { CommerceVertical } from './owner-listings';

/** The verdict for one commerce vertical, as the owner index needs it. */
export interface CommerceTrialVerdictReading {
    /** Which of the three states this owner is in for this vertical. */
    readonly verdict: CommerceTrialVerdictKind;
    /** Free days the trial would run — only ever present on `trial_available`. */
    readonly trialDays?: number;
}

/**
 * What the page assumes when the verdict cannot be read.
 *
 * `payment_required` on purpose, and it is the only safe default of the three.
 * It renders "Publicar y pagar", so a failed fetch can only ever UNDERSTATE
 * what the owner gets: if the server then grants a trial anyway, they were
 * promised a charge and given thirty free days. Defaulting to
 * `trial_available` inverts that into promising free and charging, which is
 * precisely the bug HOS-1184 exists to fix, re-created by a network error.
 *
 * It also matches the pre-HOS-1184 degradation exactly: a failed usage reading
 * resolved `null`, which read as "no subscription", which rendered the same
 * CTA.
 */
const FALLBACK_VERDICT: CommerceTrialVerdictReading = { verdict: 'payment_required' };

/**
 * Fetches the publish verdict for ONE commerce vertical.
 *
 * @param params.vertical - Which commerce vertical the owner would publish in.
 * @param params.cookieHeader - Raw `Cookie` header from the SSR request.
 * @returns The verdict, or {@link FALLBACK_VERDICT} when the request failed.
 */
export async function fetchCommerceTrialVerdict({
    vertical,
    cookieHeader
}: {
    readonly vertical: CommerceVertical;
    readonly cookieHeader?: string;
}): Promise<CommerceTrialVerdictReading> {
    const result = await apiClient.getProtected<CommerceTrialVerdictReading>({
        path: `/api/v1/protected/commerce/subscriptions/${vertical}/trial-verdict`,
        cookieHeader
    });

    return result.ok ? result.data : FALLBACK_VERDICT;
}

/**
 * Fetches the verdict for every vertical in `verticals`, in parallel, keyed by
 * vertical. Callers should dedupe `verticals` first — this function does not,
 * mirroring `fetchCommerceUsageByVertical`.
 *
 * @param params.verticals - Verticals the owner holds at least one listing in.
 * @param params.cookieHeader - Raw `Cookie` header from the SSR request.
 * @returns A map from vertical to its verdict.
 */
export async function fetchCommerceTrialVerdictByVertical({
    verticals,
    cookieHeader
}: {
    readonly verticals: readonly CommerceVertical[];
    readonly cookieHeader?: string;
}): Promise<ReadonlyMap<CommerceVertical, CommerceTrialVerdictReading>> {
    const entries = await Promise.all(
        verticals.map(
            async (vertical) =>
                [vertical, await fetchCommerceTrialVerdict({ vertical, cookieHeader })] as const
        )
    );

    return new Map(entries);
}

/**
 * The verdict for one vertical, with the fallback applied for a vertical the
 * map does not carry.
 *
 * Exists so the page template never reaches for `?? { verdict: '...' }` inline:
 * a second literal default is a second place the safe direction can be chosen
 * wrongly.
 *
 * @param map - The map returned by {@link fetchCommerceTrialVerdictByVertical}.
 * @param vertical - The vertical to read.
 * @returns That vertical's verdict, or the fallback.
 */
export function readTrialVerdict(
    map: ReadonlyMap<CommerceVertical, CommerceTrialVerdictReading>,
    vertical: CommerceVertical
): CommerceTrialVerdictReading {
    return map.get(vertical) ?? FALLBACK_VERDICT;
}
