/**
 * @file computeBestValue.ts
 * @description Pure helper (HOS-85 T-003) that determines which accommodation(s)
 * in a comparison set hold the "best value" for each comparable numeric row of
 * {@link ComparisonMatrix.client}: cheapest price and highest average rating.
 *
 * Structurally typed against a minimal subset of `AccommodationCardData`
 * (see `src/data/types.ts`) so it drops into the matrix without adapters.
 *
 * @module components/shared/compare/computeBestValue
 */

/**
 * Minimal price shape required to compare accommodations by cost.
 *
 * Matches the `amount` field of `CardPrice` (raw value in centavos, integer),
 * so callers can pass a full `CardPrice` object as-is.
 */
export interface BestValuePrice {
    /** Price amount in centavos (integer). Compared numerically as-is. */
    readonly amount: number;
}

/**
 * Minimal accommodation shape required by {@link computeBestValue}.
 *
 * A structural subset of `AccommodationCardData` — any object with at least
 * these fields (e.g. the array produced by `toAccommodationCardProps`) is
 * accepted without adapters.
 */
export interface BestValueItem {
    /** Unique identifier used to report winners. */
    readonly id: string;
    /** Optional price. Absent (or `null`/`undefined`) accommodations are never a price winner. */
    readonly price?: BestValuePrice | null;
    /**
     * Average star rating. `AccommodationCardData.averageRating` defaults to
     * `0` when no rating exists (see `toAccommodationCardProps`), and the
     * matrix itself already treats `averageRating > 0` as "has a rating"
     * (`ComparisonMatrix.client.tsx`). To stay consistent with that display
     * convention, `0`, `null`, `undefined` and non-finite values are all
     * treated as "no rating" and excluded from contention.
     */
    readonly averageRating?: number | null;
}

/**
 * Input for {@link computeBestValue}.
 */
export interface ComputeBestValueInput<TItem extends BestValueItem = BestValueItem> {
    /** The accommodations currently being compared. */
    readonly items: readonly TItem[];
}

/**
 * Result of {@link computeBestValue}.
 *
 * Each array holds the `id`s of every accommodation tied for that metric's
 * best value. Callers typically check membership per row/column, e.g.
 * `result.bestPriceIds.includes(item.id)`; for larger comparison sets prefer
 * building a `Set` once (`new Set(result.bestPriceIds)`) before looping.
 */
export interface ComputeBestValueResult {
    /** `id`s of the accommodation(s) with the cheapest price. Empty if not determinable. */
    readonly bestPriceIds: readonly string[];
    /** `id`s of the accommodation(s) with the highest average rating. Empty if not determinable. */
    readonly bestRatingIds: readonly string[];
}

/**
 * Extracts a finite numeric value for a metric, or `undefined` when the
 * value is missing, `null`, or not a finite number.
 *
 * @param value - Raw candidate value.
 * @returns The finite number, or `undefined` if not usable.
 */
function toFiniteNumber(value: number | null | undefined): number | undefined {
    return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

/**
 * Finds the `id`s of every item tied for the best (min or max) value of a
 * metric, ignoring items whose value is missing/invalid.
 *
 * @param items - Items to scan.
 * @param extract - Reads the comparable numeric value from an item, or
 *   `undefined`/`null` when the metric does not apply to it.
 * @param pickBest - Reduces two finite values to the "better" one (e.g.
 *   `Math.min` for price, `Math.max` for rating).
 * @returns `id`s of every item whose value equals the best value found.
 */
function findBestIds<TItem extends BestValueItem>(
    items: readonly TItem[],
    extract: (item: TItem) => number | null | undefined,
    pickBest: (a: number, b: number) => number
): readonly string[] {
    const candidates: ReadonlyArray<{ readonly id: string; readonly value: number }> = items
        .map((item) => ({ id: item.id, value: toFiniteNumber(extract(item)) }))
        .filter(
            (candidate): candidate is { readonly id: string; readonly value: number } =>
                candidate.value !== undefined
        );

    if (candidates.length === 0) {
        return [];
    }

    // `noUncheckedIndexedAccess` makes `candidates[0]` possibly undefined even
    // right after the length check above, so seed the reduction from the
    // array itself (guaranteed non-empty here) instead of indexing into it.
    const bestValue = candidates
        .map((candidate) => candidate.value)
        .reduce((best, current) => pickBest(best, current));

    return candidates.filter((candidate) => candidate.value === bestValue).map((c) => c.id);
}

/**
 * Computes which accommodation(s) in a comparison set hold the "best value"
 * for price (cheapest) and average rating (highest).
 *
 * Rules:
 * - **Cheapest price wins.** Lower `price.amount` is better.
 * - **Highest average rating wins.** Higher `averageRating` is better; `0`
 *   (the "no rating yet" sentinel used by `toAccommodationCardProps`),
 *   `null`, and `undefined` are treated as "no rating" and excluded.
 * - **Ties** produce multiple winners for that metric (all included).
 * - **Missing values** (no `price`, no rating) never win and never affect
 *   the winning value for other items.
 * - **Fewer than two items** (`0` or `1`) yields empty winners for both
 *   metrics — "best" is meaningless without at least one other item to
 *   compare against.
 *
 * Pure and deterministic: does not mutate `items` and has no side effects.
 *
 * @param input - `{ items }`, the accommodations being compared.
 * @returns `{ bestPriceIds, bestRatingIds }` — see {@link ComputeBestValueResult}.
 *
 * @example
 * ```ts
 * const { bestPriceIds, bestRatingIds } = computeBestValue({
 *   items: [
 *     { id: 'a', price: { amount: 1000 }, averageRating: 4.5 },
 *     { id: 'b', price: { amount: 800 }, averageRating: 4.8 },
 *     { id: 'c', price: { amount: 800 }, averageRating: 3.9 },
 *   ],
 * });
 * // bestPriceIds  -> ['b', 'c'] (tied cheapest)
 * // bestRatingIds -> ['b']      (highest rating)
 * ```
 */
export function computeBestValue<TItem extends BestValueItem = BestValueItem>(
    input: ComputeBestValueInput<TItem>
): ComputeBestValueResult {
    const { items } = input;

    if (items.length < 2) {
        return { bestPriceIds: [], bestRatingIds: [] };
    }

    const bestPriceIds = findBestIds(items, (item) => item.price?.amount, Math.min);
    const bestRatingIds = findBestIds(
        items,
        (item) => (item.averageRating && item.averageRating > 0 ? item.averageRating : undefined),
        Math.max
    );

    return { bestPriceIds, bestRatingIds };
}
