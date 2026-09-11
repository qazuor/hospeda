/**
 * @file pricing-card-items.ts
 * @description Splits everything a pricing card has to say into the short list
 * it shows up front and the remainder it hides behind a disclosure.
 *
 * The live owner grid renders 22 rows on its first tier (8 entitlement bullets
 * plus 14 numeric caps, each cap carrying its own explanation line). At that
 * height the price and the CTA — the two things the page exists for — fall
 * below the fold on a laptop. So the card shows a fixed-size summary and puts
 * the rest behind "ver todo lo que incluye". Nothing is dropped: every item is
 * still in the DOM, still readable, still findable with the browser's find, and
 * still reachable with no JavaScript (the disclosure is a native `<details>`).
 *
 * ## What "most weight" means, exactly
 *
 * The summary is the FIRST `visibleCount` items of one canonical order, and
 * that order is derived, never hand-picked per plan:
 *
 * 1. **Numeric caps first**, in the order `LIMIT_DISPLAY_ORDER` already defines
 *    in `plan-card-delta.ts` — a list documented there as "most commercially
 *    meaningful first". It is the ONLY ranking of card content that exists in
 *    the system, so it is the only place "weight" is actually defined. A cap is
 *    also the concrete thing a reader is buying more of: the tiers in this
 *    catalogue frequently differ by nothing else.
 * 2. **Entitlement bullets after them**, in the order the delta produced (which
 *    is catalogue order). Entitlements carry NO ranking anywhere in the
 *    codebase, so they cannot be truncated by weight — only by payload order.
 *    Ranked content therefore goes first, so the visible slots are filled with
 *    the only items whose position means something.
 *
 * Both halves arrive here already ordered by `computePlanDelta`; this module
 * concatenates and cuts, it never re-sorts. That is what keeps the rule
 * reproducible: the same payload always yields the same summary, and changing
 * which lines are promoted means editing `LIMIT_DISPLAY_ORDER` — a documented,
 * catalogue-wide decision — not this file and not a per-plan list.
 *
 * ## Why a fixed count rather than a height
 *
 * Cards must end up the same height in desktop, which the grid solves with
 * shared row tracks (`subgrid`). A count is deterministic and testable; a
 * height is neither, and measuring one requires JavaScript the page does not
 * otherwise need.
 */

/**
 * How many items a card shows before the disclosure.
 *
 * Five is the owner's call ("4-5 líneas"). Kept as a named constant because the
 * number is asserted by tests and read by the grid — it must not be spelled out
 * in two places.
 */
export const PRICING_CARD_VISIBLE_ITEMS = 5;

/** One entitlement bullet, already localized. */
export interface PricingCardFeatureItem {
    readonly kind: 'feature';
    /** Entitlement key or collapsed-group id — unique within a card. */
    readonly id: string;
    /** Localized bullet text. */
    readonly label: string;
}

/** One numeric cap, already localized: the value line plus its explanation. */
export interface PricingCardLimitItem {
    readonly kind: 'limit';
    /** Limit key — unique within a card. */
    readonly id: string;
    /** "Fotos por alojamiento: 30" — built from `pricing.limitLine`. */
    readonly text: string;
    /** What the cap means and what happens at it (HOS-943 AC-13). */
    readonly help: string;
}

/** Anything a card lists under its delta heading. */
export type PricingCardItem = PricingCardFeatureItem | PricingCardLimitItem;

/** A card's list, cut into what it shows and what it hides. */
export interface PricingCardItemSplit {
    /** Every item, in canonical order — `visible` followed by `hidden`. */
    readonly all: readonly PricingCardItem[];
    /** The summary shown up front. */
    readonly visible: readonly PricingCardItem[];
    /** The remainder, rendered inside the `<details>` disclosure. */
    readonly hidden: readonly PricingCardItem[];
}

/**
 * Build a card's item list and split it into the visible summary and the
 * hidden remainder.
 *
 * @param input - Wrapper object.
 * @param input.features - Entitlement bullets from the tier's delta, in delta
 *   order.
 * @param input.limits - Numeric caps from the tier's delta, already ordered by
 *   `LIMIT_DISPLAY_ORDER`.
 * @param input.visibleCount - How many items to show up front. Defaults to
 *   {@link PRICING_CARD_VISIBLE_ITEMS}; a non-positive or non-finite value is
 *   treated as the default so a bad caller cannot produce a card with an empty
 *   summary and everything buried.
 * @returns The full list plus its two halves. `hidden` is empty whenever the
 *   card has `visibleCount` items or fewer — which is what makes the "ver todo"
 *   disclosure disappear instead of rendering "(0 más)".
 *
 * @example
 * ```ts
 * const { visible, hidden } = buildPricingCardItems({
 *   features: [{ kind: 'feature', id: 'a', label: 'Publicar alojamientos' }],
 *   limits: [{ kind: 'limit', id: 'max_photos', text: 'Fotos: 30', help: '…' }],
 * });
 * // visible → the cap first, then the bullet; hidden → [] (only two items)
 * ```
 */
export function buildPricingCardItems(input: {
    readonly features: readonly PricingCardFeatureItem[];
    readonly limits: readonly PricingCardLimitItem[];
    readonly visibleCount?: number;
}): PricingCardItemSplit {
    const { features, limits, visibleCount = PRICING_CARD_VISIBLE_ITEMS } = input;

    const cut =
        Number.isFinite(visibleCount) && visibleCount > 0
            ? Math.floor(visibleCount)
            : PRICING_CARD_VISIBLE_ITEMS;

    // Ranked content first — see the "most weight" note in the file header.
    const all: readonly PricingCardItem[] = [...limits, ...features];

    return {
        all,
        visible: all.slice(0, cut),
        hidden: all.slice(cut)
    };
}
