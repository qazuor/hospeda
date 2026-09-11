/**
 * @file annual-saving.ts
 * @description How much a tier saves by being paid annually, and how much the
 * best tier in a grid saves (HOS-943 follow-up, owner review of the live pages).
 *
 * Extracted from `PricingCardsGrid.astro`'s frontmatter. Astro components cannot
 * be rendered in Vitest, so anything left inline in a template can only be
 * asserted by reading its source text — which cannot tell a correct percentage
 * from a wrong one. The rule that decides whether a card advertises a discount
 * at all is exactly the kind of thing that must be executed by a test, so it
 * lives here.
 *
 * ## Why the percentage is computed and never written down
 *
 * The saving is `(12 × monthly − annual) / (12 × monthly)`. Both operands come
 * from the plan payload the public endpoint returns, so an operator re-pricing a
 * tier in admin changes the advertised discount with no edit here and no edit in
 * the locale files. A hardcoded "ahorrá 20%" goes stale on the first price edit
 * and nothing would report it.
 *
 * ## When a card advertises NOTHING
 *
 * Three cases return `null`, and the caller renders no saving copy at all
 * rather than inventing one:
 *
 * 1. **No annual price** (`null` or `<= 0`) — the tier is monthly-only.
 * 2. **A free or non-positive monthly price** — the ratio has no denominator,
 *    and "ahorrá 100%" on a free tier is nonsense.
 * 3. **An annual price at or above twelve monthly cycles** — paying yearly costs
 *    the same or more. That is a catalogue misconfiguration, and advertising a
 *    negative saving as a discount is worse than staying silent.
 */

/** Minimal plan shape the saving needs. Satisfied by `PublicPlanData`. */
export interface AnnualSavingPlan {
    /** Monthly price in ARS cents. */
    readonly monthlyPriceArs: number;
    /** Annual price in ARS cents, or `null` for a monthly-only tier. */
    readonly annualPriceArs: number | null;
}

/**
 * Percentage saved by paying one tier annually instead of monthly.
 *
 * @param input - Wrapper object.
 * @param input.plan - The tier to price.
 * @returns The saving rounded to a whole percent, or `null` when the tier has
 *   no annual price, no positive monthly price, or an annual price that is not
 *   actually cheaper than twelve monthly cycles.
 *
 * @example
 * ```ts
 * computeAnnualSavingPercent({ plan: { monthlyPriceArs: 1000, annualPriceArs: 10_000 } });
 * // 17  — 12 000 at monthly vs 10 000 annual
 * computeAnnualSavingPercent({ plan: { monthlyPriceArs: 1000, annualPriceArs: null } });
 * // null — monthly-only tier, the card advertises no discount
 * ```
 */
export function computeAnnualSavingPercent(input: {
    readonly plan: AnnualSavingPlan;
}): number | null {
    const { plan } = input;
    const { monthlyPriceArs, annualPriceArs } = plan;

    if (annualPriceArs === null || annualPriceArs <= 0) return null;
    if (monthlyPriceArs <= 0) return null;

    const yearAtMonthly = monthlyPriceArs * 12;
    if (annualPriceArs >= yearAtMonthly) return null;

    return Math.round(((yearAtMonthly - annualPriceArs) / yearAtMonthly) * 100);
}

/**
 * The best annual saving among the tiers a grid actually renders.
 *
 * Used by the billing-interval toggle, which has to advertise the discount
 * BEFORE the reader has picked a tier — so it can only speak about the
 * catalogue as a whole ("ahorrá hasta N%"), never about one plan.
 *
 * It takes the ALREADY-COMPUTED percentages rather than the plans:
 * `computeAnnualSavingPercent` has run once per card by the time the toggle
 * needs this, so re-deriving from the plans would be a second place where
 * "which tiers count" could drift from the first.
 *
 * @param input - Wrapper object.
 * @param input.percents - One entry per rendered tier, `null` for a tier with
 *   no valid annual discount. Order is irrelevant.
 * @returns The highest saving among them, or `null` when not a single tier has
 *   one (in which case the toggle advertises nothing).
 *
 * @example
 * ```ts
 * resolveBestAnnualSavingPercent({ percents: [8, null, 20] });
 * // 20
 * resolveBestAnnualSavingPercent({ percents: [null, null] });
 * // null — the toggle shows no badge
 * ```
 */
export function resolveBestAnnualSavingPercent(input: {
    readonly percents: readonly (number | null)[];
}): number | null {
    const { percents } = input;

    let best: number | null = null;
    for (const percent of percents) {
        if (percent === null) continue;
        if (best === null || percent > best) best = percent;
    }
    return best;
}
