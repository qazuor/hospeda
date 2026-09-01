/**
 * @file pricing-card-view.ts
 * @description Turns the plan payloads into everything the pricing grid renders:
 * one view model per card, plus the single figure the billing-interval toggle
 * advertises.
 *
 * ## Why this is not in the component's frontmatter
 *
 * It used to be, and that is a trap worth documenting rather than rediscovering.
 * `astro check` type-checks `.astro` files by converting them to TSX, and past a
 * certain amount of inference inside one frontmatter it silently gives up on the
 * component's own props: `Astro.props` resolves to `Record<string, any>`, every
 * destructured prop becomes `any`, and the errors it does report are a handful
 * of "Parameter implicitly has an 'any' type" on map callbacks — pointing
 * everywhere except at the cause. It is not a threshold anyone can see: adding
 * five `const` label lookups and a few fields to the object each card returns
 * was enough to cross it, while the same code in a `.ts` module is fine.
 *
 * Bisected on 2026-08-31 against `PricingCardsGrid.astro`. Keeping the build
 * here has two payoffs: the frontmatter stays small enough that props inference
 * holds, and the logic becomes unit-testable (an `.astro` file cannot be
 * rendered under Vitest, so anything left inline can only ever be asserted by
 * reading its source text).
 *
 * It does NOT bring the component under the repo's 500-line ceiling — that file
 * is ~1000 lines and is now almost entirely scoped CSS, which cannot move out
 * of it (Astro scopes styles to the component that declares the markup). That
 * overrun predates this change and is still open.
 *
 * **Do not move this back into the frontmatter.**
 */

import {
    computeAnnualSavingPercent,
    resolveBestAnnualSavingPercent
} from '@/components/billing/annual-saving';
import type { PlanDelta } from '@/components/billing/plan-card-delta';
import { computePlanDelta, computePlanDeltas } from '@/components/billing/plan-card-delta';
import type {
    PricingCardItem,
    PricingCardLimitItem
} from '@/components/billing/pricing-card-items';
import { buildPricingCardItems } from '@/components/billing/pricing-card-items';
import type { PricingAudience } from '@/lib/billing-i18n';
import {
    formatLimitValue,
    getDisplayFeatures,
    getLimitHelp,
    getLimitName,
    getPlanDescription,
    getPlanName,
    getPlanRecommendedFor
} from '@/lib/billing-i18n';
import type { TranslationFn } from '@/lib/i18n';

/**
 * Minimal plan shape the grid needs. Decoupled from `PlanDefinition` so it works
 * with the runtime endpoint response (`PublicPlanData` from
 * `@/lib/billing/fetch-plans`).
 *
 * `limits` is REQUIRED (HOS-943). It used to be excluded with the note that the
 * grid "does not render limits — only entitlements", and that omission is
 * exactly what the cumulative delta could not survive: several tiers in this
 * catalogue differ ONLY in their numeric caps, so a card built from entitlements
 * alone renders "everything in Basic, plus:" followed by nothing. The shape is
 * `Record<key, value>` — QZPay's storage format, which is what the public
 * endpoint returns — not `LimitDefinition[]`.
 */
export interface PricingPlan {
    readonly slug: string;
    readonly name: string;
    readonly description: string;
    readonly monthlyPriceArs: number;
    readonly annualPriceArs: number | null;
    readonly hasTrial: boolean;
    readonly trialDays: number;
    readonly sortOrder: number;
    readonly isActive: boolean;
    /** Entitlement keys (string values matching EntitlementKey). */
    readonly entitlements: readonly string[];
    /** Numeric caps as a key -> value map; `-1` is the unlimited sentinel. */
    readonly limits: Readonly<Record<string, number>>;
}

/** Everything ONE card renders, already localized and formatted. */
export interface PricingCardView {
    readonly plan: PricingPlan;
    /**
     * The raw computed annual saving, kept so the toggle badge can take the best
     * of them without re-deriving the rule.
     */
    readonly savingPercent: number | null;
    readonly name: string;
    readonly description: string;
    readonly recommendedFor: string;
    readonly monthlyFormatted: string;
    readonly hasAnnualPrice: boolean;
    readonly annualFormatted: string;
    /** The "ahorrá N%" line, shown only once annual is selected. Empty when none. */
    readonly savingLabel: string;
    /** The "pagando por año ahorrás N%" hint, shown while MONTHLY is selected. */
    readonly annualHintLabel: string;
    /** Id of this card's hidden selection radio. */
    readonly selectId: string;
    /** Accessible name of that radio. */
    readonly selectAriaLabel: string;
    /** The summary the card shows up front. */
    readonly visibleItems: readonly PricingCardItem[];
    /** The remainder, behind the "ver todo" disclosure. Empty means no disclosure. */
    readonly hiddenItems: readonly PricingCardItem[];
    /** "Ver todo lo que incluye (N más)". */
    readonly seeAllLabel: string;
    /** "Todo lo del plan X, más:" or the neutral "Este plan incluye:". */
    readonly deltaHeading: string;
}

/** The whole grid: its cards plus the figure the toggle advertises. */
export interface PricingCardsView {
    readonly cards: readonly PricingCardView[];
    /**
     * The best annual discount among the rendered tiers, or `null` when not one
     * of them has a valid annual price — in which case the toggle shows no badge
     * rather than an invented number.
     */
    readonly maxAnnualSavingPercent: number | null;
}

/** Inputs the build needs; all of them already resolved by the page. */
export interface BuildPricingCardViewsInput {
    /**
     * Tiers to render, ALREADY ordered by `sortOrder` — which is what
     * `filterPlansByCategory` returns. The order is load-bearing, not cosmetic:
     * each card is diffed against the one before it.
     */
    readonly plans: ReadonlyArray<PricingPlan>;
    /** Audience of the page — owner cards collapse some entitlements into groups. */
    readonly audience: PricingAudience;
    /** BCP-47 locale for `Intl` number formatting. */
    readonly intlLocale: string;
    readonly t: TranslationFn;
}

/**
 * Format ARS cents as a locale-aware currency string.
 *
 * @param input - Wrapper object.
 * @param input.cents - Amount in ARS cents.
 * @param input.intlLocale - BCP-47 locale.
 * @returns The formatted amount, falling back to a plain `$` string when the
 *   runtime rejects the locale.
 */
function formatPriceArs(input: { readonly cents: number; readonly intlLocale: string }): string {
    const { cents, intlLocale } = input;
    const pesos = cents / 100;
    try {
        return new Intl.NumberFormat(intlLocale, {
            style: 'currency',
            currency: 'ARS',
            maximumFractionDigits: 0,
            minimumFractionDigits: 0
        }).format(pesos);
    } catch {
        return `$${pesos.toLocaleString('es-AR')}`;
    }
}

/**
 * Build the view model for every card in a pricing grid.
 *
 * Nothing here is curated per plan: the bullets come from `computePlanDeltas`
 * (which diffs consecutive tiers), the summary/disclosure split comes from
 * `buildPricingCardItems`, and the annual discount comes from
 * `computeAnnualSavingPercent`. A plan re-priced or re-scoped in admin changes
 * what these cards say with no edit here and none in the locale files.
 *
 * @param input - See {@link BuildPricingCardViewsInput}.
 * @returns One view per plan, positionally aligned with `input.plans`, plus the
 *   best annual saving among them.
 *
 * @example
 * ```ts
 * const { cards, maxAnnualSavingPercent } = buildPricingCardViews({
 *   plans, audience: 'owner', intlLocale: 'es-AR', t
 * });
 * ```
 */
export function buildPricingCardViews(input: BuildPricingCardViewsInput): PricingCardsView {
    const { plans, audience, intlLocale, t } = input;

    const includesEverythingTemplate = t(
        'pricing.includesEverything',
        'Todo lo del plan {plan}, más:'
    );
    const includesAllLabel = t('pricing.includesAll', 'Este plan incluye:');
    const limitLineTemplate = t('pricing.limitLine', '{label}: {value}');
    const annualSavingTemplate = t('pricing.toggle.annualSaving', 'Ahorrá {percent}%');
    const annualHintTemplate = t('pricing.annualHint', 'Pagando por año ahorrás {percent}%');
    const seeAllTemplate = t('pricing.seeAll', 'Ver todo lo que incluye ({count} más)');
    const selectAriaTemplate = t('pricing.select.aria', 'Seleccionar el plan {plan}');
    const freeLabel = t('pricing.free', 'Gratis');

    const deltas = computePlanDeltas({ plans });

    const cards: PricingCardView[] = [];
    for (let index = 0; index < plans.length; index += 1) {
        const plan = plans[index] as PricingPlan;
        const rawDelta = deltas[index] as PlanDelta;
        const previousPlan = index > 0 ? plans[index - 1] : undefined;

        /**
         * A non-first tier that adds NOTHING on top of the one below it is a
         * catalogue misconfiguration, and "everything in Basic, plus:" over an
         * empty list is the worst possible way to surface it. Fall back to the
         * full offer — literally the first-tier delta, recomputed with no
         * predecessor — so the card keeps selling the plan while the config is
         * wrong.
         */
        const showsDelta = !rawDelta.isFirstTier && !rawDelta.isEmpty && previousPlan !== undefined;
        const delta = showsDelta ? rawDelta : computePlanDelta({ plan });

        const features = getDisplayFeatures({ keys: delta.addedEntitlements, audience, t });
        const limitLines: PricingCardLimitItem[] = delta.limitChanges.map((change) => ({
            kind: 'limit',
            id: change.key,
            text: limitLineTemplate
                .replace('{label}', getLimitName({ key: change.key, t }))
                .replace(
                    '{value}',
                    formatLimitValue({
                        value: change.value,
                        isUnlimited: change.isUnlimited,
                        intlLocale,
                        t
                    })
                ),
            help: getLimitHelp({ key: change.key, t })
        }));

        const items = buildPricingCardItems({
            features: features.map((feature) => ({
                kind: 'feature',
                id: feature.id,
                label: feature.label
            })),
            limits: limitLines
        });

        const hasAnnualPrice = plan.annualPriceArs !== null && plan.annualPriceArs > 0;
        const savingPercent = computeAnnualSavingPercent({ plan });

        cards.push({
            plan,
            savingPercent,
            name: getPlanName({ plan, t }),
            description: getPlanDescription({ plan, t }),
            recommendedFor: getPlanRecommendedFor({ plan, audience, t }),
            monthlyFormatted:
                plan.monthlyPriceArs === 0
                    ? freeLabel
                    : formatPriceArs({ cents: plan.monthlyPriceArs, intlLocale }),
            hasAnnualPrice,
            annualFormatted: hasAnnualPrice
                ? formatPriceArs({ cents: plan.annualPriceArs as number, intlLocale })
                : '',
            savingLabel:
                savingPercent === null
                    ? ''
                    : annualSavingTemplate.replace('{percent}', String(savingPercent)),
            /**
             * The same computed percentage, phrased for the MONTHLY state: the
             * reader has to know an annual discount exists before choosing
             * annual, which `savingLabel` cannot tell them (it only appears once
             * they already switched). A tier with no annual price gets an empty
             * string and renders nothing — never an invented discount.
             */
            annualHintLabel:
                savingPercent === null
                    ? ''
                    : annualHintTemplate.replace('{percent}', String(savingPercent)),
            selectId: `pricing-select-${audience}-${plan.slug}`,
            selectAriaLabel: selectAriaTemplate.replace('{plan}', getPlanName({ plan, t })),
            visibleItems: items.visible,
            hiddenItems: items.hidden,
            seeAllLabel: seeAllTemplate.replace('{count}', String(items.hidden.length)),
            // Only a real previous plan can produce this header; when there is
            // none the card falls back to the neutral "this plan includes:" line
            // (AC-17) — "Todo lo del plan undefined, más:" is unrepresentable.
            deltaHeading: showsDelta
                ? includesEverythingTemplate.replace(
                      '{plan}',
                      getPlanName({ plan: previousPlan as PricingPlan, t })
                  )
                : includesAllLabel
        });
    }

    return {
        cards,
        // Taken from the percentages the cards already computed, so "which tiers
        // count" is decided once, by `computeAnnualSavingPercent`, and never
        // restated here.
        maxAnnualSavingPercent: resolveBestAnnualSavingPercent({
            percents: cards.map((card) => card.savingPercent)
        })
    };
}
