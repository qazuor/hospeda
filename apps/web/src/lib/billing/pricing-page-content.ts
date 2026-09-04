/**
 * @file billing/pricing-page-content.ts
 * @description Everything the five `/planes/<audiencia>/precios/` pages say
 * that DEPENDS on the audience, resolved in one place (HOS-1032).
 *
 * ## Why a module and not five frontmatters
 *
 * AC-44 asks the five pages to share structure and section order. A shared
 * `.astro` component gives them the same MARKUP; this module is what keeps the
 * same DECISIONS behind it. The rule that a page shows a trial line only when
 * its catalogue carries one, the rule that the billing FAQ's first answer
 * interpolates a number rather than spelling it, and the rule about which CTA a
 * card gets are each written once here instead of five times — which is the
 * difference between five pages that agree today and five pages that stay in
 * agreement.
 *
 * The precedent is exact and recent: `commerce.json` used to spell
 * "30 días de prueba gratis" by hand in twelve strings across two verticals and
 * three locales. It matched the database by coincidence and would have kept
 * promising 30 the day an operator edited the plan — which is HOS-525 verbatim,
 * where marketing promised hosts 30 days and checkout granted 14. HOS-941 R-2
 * exists because of that, and AC-47 is its form here: no page in this family
 * writes a trial length, every one reads it.
 *
 * ## `null` trial days
 *
 * `null` means "say nothing about a trial", and it deliberately covers four
 * situations that must render identically: the catalogue fetch failed, the
 * audience has no active plan, its plans carry no trial, and its plans carry a
 * zero-day trial. Zero is unrepresentable on purpose — "0 días de prueba" is a
 * worse statement than silence, and a number borrowed from another audience is
 * the bug this module removes.
 *
 * SSR-only: it reaches `@repo/billing` transitively through
 * `generic-trial-days.ts`, so nothing a client island imports may import this
 * (see `apps/web/test/static-guards/billing-barrel-client-isolation.test.ts`).
 *
 * @module lib/billing/pricing-page-content
 */

import type { PublicPlanData } from '@/lib/billing/fetch-plans';
import { computeMinimumTrialDays } from '@/lib/billing/generic-trial-days';
import type { PricingAudience } from '@/lib/billing-i18n';
import type { PluralTranslationFn, TranslationFn } from '@/lib/i18n';

/**
 * The `t` / `tPlural` pair a page hands this module.
 *
 * The real `createTranslations` types, not hand-written signatures: `tPlural`'s
 * third parameter is an interpolation `Record`, not a fallback string, and a
 * structural approximation of it would either reject the real function or
 * accept a call this module cannot make.
 */
export interface PricingPageTranslators {
    readonly t: TranslationFn;
    readonly tPlural: PluralTranslationFn;
}

/** One question and its already-resolved answer. */
export interface BillingFaqItem {
    readonly q: string;
    readonly a: string;
}

/**
 * How a given audience's cards are paid for.
 *
 * `'checkout'` starts a MercadoPago subscription from the card itself — the two
 * accommodation audiences, and the only ones whose checkout begins on a pricing
 * page. `'link'` sends the visitor somewhere else to complete it: the listing
 * create flow for the commerce verticals (whose tier picker lives there, not
 * here), and the lead form for aliados, whose partnership is agreed in a
 * conversation rather than bought (HOS-941 D-13).
 */
export type PricingCtaMode = 'checkout' | 'link';

/** The copy and the flags one pricing page renders. */
export interface PricingPageContent {
    /** i18n namespace root for this audience, e.g. `pricing.gastronomy`. */
    readonly copyRoot: string;
    /** Advertisable trial length in days, or `null` to say nothing. */
    readonly trialDays: number | null;
    /** The billing FAQ, questions and answers already resolved. */
    readonly faqs: readonly BillingFaqItem[];
    /** Whether this audience's comparison table exists at all. */
    readonly hasComparison: boolean;
}

/**
 * The i18n root each audience's page copy lives under.
 *
 * `owner` and `tourist` keep the roots their pages have used since SPEC-168 —
 * moving the URL does not move the copy, and re-keying it would have been an
 * unrelated diff across three locale files.
 */
const COPY_ROOT_BY_AUDIENCE: Readonly<Record<PricingAudience, string>> = {
    owner: 'pricing.owner',
    tourist: 'pricing.tourist',
    gastronomy: 'pricing.gastronomy',
    experience: 'pricing.experience',
    partner: 'pricing.partner'
} as const;

/**
 * Which audiences have a curated comparison table.
 *
 * Aliados does not, and that is a fact about the catalogue rather than an
 * omission: every partner tier carries `entitlements: []` and `limits: []`,
 * because what separates silver from gold is the `/partners/<slug>/` page,
 * which the entitlement engine knows nothing about. A table built from those
 * rows would be a wall of "no included" that under-sells both tiers. The cards
 * already list what each level gives, which is the job the table would be
 * doing (HOS-941 D-13). `PlanComparisonTable`'s own prop type refuses
 * `'partner'` for the same reason, so this flag and that type cannot drift into
 * disagreeing.
 */
const AUDIENCES_WITH_COMPARISON: ReadonlySet<PricingAudience> = new Set<PricingAudience>([
    'owner',
    'tourist',
    'gastronomy',
    'experience'
]);

/**
 * The billing-FAQ questions every audience answers the same way.
 *
 * Payment method, cancellation, plan change and invoicing do not vary by
 * audience — they are properties of how Hospeda bills, not of what is being
 * bought — so they are one list rather than five.
 */
const SHARED_BILLING_FAQ_KEYS: readonly (readonly [string, string])[] = [
    ['pricing.billingFaq.cancelQ', 'pricing.billingFaq.cancelA'],
    ['pricing.billingFaq.changeQ', 'pricing.billingFaq.changeA'],
    ['pricing.billingFaq.methodQ', 'pricing.billingFaq.methodA'],
    ['pricing.billingFaq.invoiceQ', 'pricing.billingFaq.invoiceA']
] as const;

/**
 * Build the billing FAQ for one audience.
 *
 * The first item is the one that varies, and it varies in TWO directions at
 * once, which is why it is resolved here rather than left as a key for the
 * template:
 *
 * - Aliados replaces it entirely. Asking "can I try it before paying" of an
 *   audience with no published price answers a question nobody asked; the
 *   honest first question there is why there is no price, and the answer is the
 *   owner's own (HOS-941 D-13).
 * - Everyone else interpolates `trialDays` — or, when it is `null`, states
 *   plainly that these plans have no trial. A missing trial gets its own
 *   sentence rather than the clause being spliced out, because the number sits
 *   mid-sentence and cutting it leaves a fragment.
 *
 * @param params.audience - Which audience's FAQ to build.
 * @param params.trialDays - Its advertisable trial length, or `null`.
 * @param params.translators - The page's `t` / `tPlural`.
 * @returns Question/answer pairs, fully resolved, in render order.
 */
function buildBillingFaq({
    audience,
    trialDays,
    translators
}: {
    readonly audience: PricingAudience;
    readonly trialDays: number | null;
    readonly translators: PricingPageTranslators;
}): readonly BillingFaqItem[] {
    const { t, tPlural } = translators;

    const first: BillingFaqItem =
        audience === 'partner'
            ? {
                  q: t('pricing.billingFaq.partnerPriceQ'),
                  a: t('pricing.billingFaq.partnerPriceA')
              }
            : {
                  q: t('pricing.billingFaq.trialQ'),
                  a:
                      trialDays === null
                          ? t('pricing.billingFaq.trialANone')
                          : tPlural('pricing.billingFaq.trialA', trialDays)
              };

    return [first, ...SHARED_BILLING_FAQ_KEYS.map(([qKey, aKey]) => ({ q: t(qKey), a: t(aKey) }))];
}

/**
 * Resolve everything one `/planes/<audiencia>/precios/` page renders that
 * depends on which audience it serves.
 *
 * Takes the plans the page already fetched rather than fetching them itself:
 * the grid, the comparison table and the trial line are three readings of ONE
 * catalogue snapshot, and a second request would open a window in which they
 * describe different ones.
 *
 * @param params.audience - The page's audience.
 * @param params.plans - That audience's active plans, as returned by
 *   `fetchAudiencePlans`. May be empty — a failed fetch and an audience with no
 *   sellable plan reach this function identically, and must leave it identically.
 * @param params.translators - The page's `t` / `tPlural`.
 * @returns The page's copy root, trial length, billing FAQ and comparison flag.
 */
export function resolvePricingPageContent({
    audience,
    plans,
    translators
}: {
    readonly audience: PricingAudience;
    readonly plans: readonly PublicPlanData[];
    readonly translators: PricingPageTranslators;
}): PricingPageContent {
    const trialDays = computeMinimumTrialDays({ plans });

    return {
        copyRoot: COPY_ROOT_BY_AUDIENCE[audience],
        trialDays,
        faqs: buildBillingFaq({ audience, trialDays, translators }),
        hasComparison: AUDIENCES_WITH_COMPARISON.has(audience) && plans.length > 0
    };
}

/** One pricing page's breadcrumb trail, in both shapes it has to be rendered in. */
export interface PricingBreadcrumbs {
    /**
     * For `<Breadcrumbs>`: `{ label, path? }`, current page last. Home is
     * prepended by the component, so it is not in this list.
     */
    readonly visible: readonly { readonly label: string; readonly path?: string }[];
    /** For `<BreadcrumbJsonLd>`: absolute URLs, home FIRST. */
    readonly jsonLd: readonly { readonly name: string; readonly url: string }[];
}

/**
 * Build a pricing page's breadcrumbs, visible and structured, from ONE trail.
 *
 * The two are derived from the same three labels rather than written out twice,
 * because the guard that made this necessary — `breadcrumbs-coverage.test.ts` —
 * only checks that a page rendering `<Breadcrumbs>` also emits a
 * `BreadcrumbList`. It cannot check that the two describe the same trail, which
 * is the failure that actually misleads a search result: a visible crumb saying
 * one thing while the structured data says another. Deriving both from one
 * input is what makes that unrepresentable.
 *
 * The trail is always three deep — home → the audience's sales page → this
 * page — which is the structure D-7 defines, and it is the same for all five.
 *
 * @param params.homeLabel - Localised label for the site root.
 * @param params.homeUrl - Absolute URL of the locale's home page.
 * @param params.salesLabel - The audience's level-2 page title, as that page
 *   itself renders it — read from the same i18n key, never re-worded here.
 * @param params.salesPath - Locale-agnostic path of that sales page.
 * @param params.salesUrl - Absolute URL of the same page.
 * @param params.pageLabel - This page's own title.
 * @param params.pageUrl - This page's absolute URL.
 * @returns Both renderings of the one trail.
 */
export function buildPricingBreadcrumbs({
    homeLabel,
    homeUrl,
    salesLabel,
    salesPath,
    salesUrl,
    pageLabel,
    pageUrl
}: {
    readonly homeLabel: string;
    readonly homeUrl: string;
    readonly salesLabel: string;
    readonly salesPath: string;
    readonly salesUrl: string;
    readonly pageLabel: string;
    readonly pageUrl: string;
}): PricingBreadcrumbs {
    return {
        visible: [{ label: salesLabel, path: salesPath }, { label: pageLabel }],
        jsonLd: [
            { name: homeLabel, url: homeUrl },
            { name: salesLabel, url: salesUrl },
            { name: pageLabel, url: pageUrl }
        ]
    };
}

/**
 * The `FAQPage` structured data for a billing FAQ.
 *
 * Built from the SAME resolved items the page renders, never from the keys, so
 * the JSON-LD cannot advertise a trial the visible answer omits — the failure
 * mode both commerce landings were built to avoid.
 *
 * @param params.faqs - The already-resolved questions and answers.
 * @returns A `schema.org` `FAQPage` object, ready for `<JsonLd>`.
 */
export function buildBillingFaqJsonLd({
    faqs
}: {
    readonly faqs: readonly BillingFaqItem[];
}): Record<string, unknown> {
    return {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: faqs.map((faq) => ({
            '@type': 'Question',
            name: faq.q,
            acceptedAnswer: { '@type': 'Answer', text: faq.a }
        }))
    };
}
