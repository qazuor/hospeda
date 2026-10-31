/**
 * @file external-reputation-refresh.ts
 * @description Reads the body of `POST .../external-reputation/refresh` to tell a
 * refresh that did work from one that queried nobody (HOS-1944).
 *
 * The endpoint answers 200 with three empty lists when the accommodation has no
 * platform to query. The UI used to read any 200 as "everything refreshed" and
 * showed "Actualizado" for a request that touched no source.
 */

/** The three outcome lists of the refresh response (shape only, as far as this module cares). */
export interface RefreshResultBody {
    /** Platforms resolved synchronously. */
    readonly inlineSucceeded?: readonly unknown[];
    /** Platforms for which an async run was enqueued. */
    readonly enqueuedAsync?: readonly unknown[];
    /** Platforms that failed. */
    readonly inlineFailed?: readonly unknown[];
}

/**
 * True only when the response PROVES nothing was queried: all three lists are
 * present and empty. A missing or malformed body proves nothing, so it is not
 * treated as "nothing to refresh".
 *
 * @param input.result - The `data` member of the refresh response, if any.
 * @returns Whether the refresh touched no platform.
 */
export function hasNothingToRefresh({
    result
}: {
    readonly result: RefreshResultBody | null | undefined;
}): boolean {
    if (!result) return false;
    const { inlineSucceeded, enqueuedAsync, inlineFailed } = result;
    return (
        Array.isArray(inlineSucceeded) &&
        Array.isArray(enqueuedAsync) &&
        Array.isArray(inlineFailed) &&
        inlineSucceeded.length === 0 &&
        enqueuedAsync.length === 0 &&
        inlineFailed.length === 0
    );
}
