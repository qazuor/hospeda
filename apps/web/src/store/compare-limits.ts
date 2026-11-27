/**
 * @file compare-limits.ts
 * @description Constants shared by every comparison surface. Kept apart from
 * `compare-store` so a consumer that only needs a limit does not import the
 * localStorage-backed store.
 */

/** Minimum number of accommodations a comparison needs; fewer shows the empty state. */
export const MIN_TO_COMPARE = 2;
