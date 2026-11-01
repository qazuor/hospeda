/**
 * @file experience/price-display.ts
 * @description Decides what an experience's price tag shows (HOS-1943).
 *
 * An experience "a consultar" stores `priceFrom = null` (owner decision,
 * HOS-1943 option a). Older rows may still carry `0` until the backfill reaches
 * them. Both mean "no price": rendering either as an amount would print "$0",
 * a free listing that is not free. This module is the one place that turns the
 * stored pair into a display decision, so `ExperiencePriceTag.astro` (and any
 * future surface) cannot get it wrong on its own.
 *
 * @module lib/experience/price-display
 */

/** What the price tag renders. */
export type ExperiencePriceDisplay =
    | { readonly kind: 'on-request' }
    | { readonly kind: 'amount'; readonly cents: number };

/** Input to {@link resolveExperiencePriceDisplay}. */
export interface ResolveExperiencePriceDisplayInput {
    /** Stored price in centavos; `null` when the experience has no price. */
    readonly priceFrom: number | null | undefined;
    /** The owner's "a consultar" flag. */
    readonly isPriceOnRequest: boolean;
}

/**
 * Resolves the price display for an experience.
 *
 * Shows the "Consultar precio" label when the flag is on, OR when there is no
 * positive price at all (`null`, a missing value, or a legacy `0`). Only a
 * positive amount with the flag off renders as a number.
 *
 * @param input - The stored price and the on-request flag.
 * @returns `{ kind: 'on-request' }` or `{ kind: 'amount', cents }`.
 */
export function resolveExperiencePriceDisplay({
    priceFrom,
    isPriceOnRequest
}: ResolveExperiencePriceDisplayInput): ExperiencePriceDisplay {
    if (isPriceOnRequest || typeof priceFrom !== 'number' || priceFrom <= 0) {
        return { kind: 'on-request' };
    }
    return { kind: 'amount', cents: priceFrom };
}
