/**
 * Pricing plan utilities for the pricing pages.
 * Provides API data mapping helpers and delegates to fallback data when needed.
 */
import { plansApi } from './api/endpoints-protected';
import type { SupportedLocale } from './i18n';
import {
    OWNER_CTA_LABELS,
    OWNER_CTA_SUFFIX,
    OWNER_FALLBACK_PLANS,
    TOURIST_CTA_LABELS,
    TOURIST_FALLBACK_PLANS
} from './pricing-fallbacks';

// Re-export fallback plans for consumers that need direct access
export { TOURIST_FALLBACK_PLANS, OWNER_FALLBACK_PLANS };

/** Shape used by PricingCard component */
export interface PricingPlan {
    readonly name: string;
    readonly price: number;
    readonly currency: string;
    readonly period: string;
    readonly features: readonly string[];
    readonly cta: { readonly label: string; readonly href: string };
    readonly highlighted?: boolean;
}

/** Locale-specific display config for currency and period labels */
const LOCALE_CONFIG: Record<
    SupportedLocale,
    { readonly currency: string; readonly period: string }
> = {
    es: { currency: 'ARS', period: '/mes' },
    en: { currency: 'USD', period: '/month' },
    pt: { currency: 'ARS', period: '/mês' }
};

// --- Shared Mapping Helper ---

/** Parameters for mapping an API plan record to a PricingPlan */
interface MapPlanParams {
    readonly plan: Record<string, unknown>;
    readonly locale: SupportedLocale;
    readonly index: number;
    readonly total: number;
    readonly fallback: PricingPlan[];
    readonly ctaLabels: Record<string, string>;
    readonly buildCtaHref: (slug: string, locale: SupportedLocale) => string;
}

/**
 * Maps a raw API plan record to a PricingPlan for card rendering.
 * Uses ARS price for es/pt locales and USD reference for en.
 * Falls back to hardcoded features when the API plan name matches a fallback entry.
 */
function mapApiPlanToCard({
    plan,
    locale,
    index,
    total,
    fallback,
    ctaLabels,
    buildCtaHref
}: MapPlanParams): PricingPlan {
    const slug = typeof plan.slug === 'string' ? plan.slug : '';
    const name = typeof plan.name === 'string' ? plan.name : '';
    const monthlyPriceArs = typeof plan.monthlyPriceArs === 'number' ? plan.monthlyPriceArs : 0;
    const monthlyPriceUsdRef =
        typeof plan.monthlyPriceUsdRef === 'number' ? plan.monthlyPriceUsdRef : 0;
    const description = typeof plan.description === 'string' ? plan.description : '';
    const { currency, period } = LOCALE_CONFIG[locale];

    // ARS prices are stored in cents; divide by 100 for display
    const price = locale === 'en' ? monthlyPriceUsdRef : Math.round(monthlyPriceArs / 100);

    // Prefer hardcoded localized features when name matches; else use API description
    const matched = fallback.find((fp) => fp.name.toLowerCase() === name.toLowerCase());
    const features = matched ? matched.features : [description];

    const ctaLabel = ctaLabels[slug] ?? name;
    const ctaHref = buildCtaHref(slug, locale);

    // Highlight the middle plan (index 1 of 3)
    const highlighted = total > 1 && index === Math.floor(total / 2);

    return {
        name,
        price,
        currency,
        period,
        features: features as string[],
        cta: { label: ctaLabel, href: ctaHref },
        highlighted
    };
}

// --- Fetch Helpers ---

/**
 * Extracts a flat item array from the API response.
 * Handles both direct array responses and paginated `{ items }` shapes.
 */
function extractItems(rawData: unknown): unknown[] {
    if (Array.isArray(rawData)) return rawData;
    const asRecord = rawData as Record<string, unknown>;
    if (Array.isArray(asRecord?.items)) return asRecord.items as unknown[];
    return [];
}

/**
 * Filters and narrows raw API items to typed plan records with the given category.
 */
function filterByCategory(items: unknown[], category: string): Record<string, unknown>[] {
    return items.filter(
        (item): item is Record<string, unknown> =>
            typeof item === 'object' &&
            item !== null &&
            (item as Record<string, unknown>).category === category
    );
}

/**
 * Sorts plan records by their `sortOrder` field ascending.
 */
function sortByOrder(plans: Record<string, unknown>[]): Record<string, unknown>[] {
    return [...plans].sort((a, b) => {
        const aOrder = typeof a.sortOrder === 'number' ? a.sortOrder : 0;
        const bOrder = typeof b.sortOrder === 'number' ? b.sortOrder : 0;
        return aOrder - bOrder;
    });
}

// --- Public API ---

/**
 * Fetches tourist plans from the billing API and maps them to PricingPlan records.
 * Returns locale-specific hardcoded fallback data on any failure.
 *
 * @param locale - The active locale for pricing display
 * @returns Sorted tourist PricingPlan array ready for rendering
 */
export async function fetchTouristPlans(locale: SupportedLocale): Promise<PricingPlan[]> {
    try {
        const result = await plansApi.list();
        if (!result.ok) return TOURIST_FALLBACK_PLANS[locale];

        const plans = filterByCategory(extractItems(result.data), 'tourist');
        if (plans.length === 0) return TOURIST_FALLBACK_PLANS[locale];

        const sorted = sortByOrder(plans);
        return sorted.map((plan, idx) =>
            mapApiPlanToCard({
                plan,
                locale,
                index: idx,
                total: sorted.length,
                fallback: TOURIST_FALLBACK_PLANS[locale],
                ctaLabels: TOURIST_CTA_LABELS[locale],
                buildCtaHref: (slug, loc) =>
                    slug === 'tourist-free'
                        ? `/${loc}/registro/`
                        : `/${loc}/registro/?plan=${slug.replace('tourist-', '')}`
            })
        );
    } catch {
        return TOURIST_FALLBACK_PLANS[locale];
    }
}

/**
 * Fetches owner plans from the billing API and maps them to PricingPlan records.
 * Returns locale-specific hardcoded fallback data on any failure.
 *
 * @param locale - The active locale for pricing display
 * @returns Sorted owner PricingPlan array ready for rendering
 */
export async function fetchOwnerPlans(locale: SupportedLocale): Promise<PricingPlan[]> {
    try {
        const result = await plansApi.list();
        if (!result.ok) return OWNER_FALLBACK_PLANS[locale];

        const plans = filterByCategory(extractItems(result.data), 'owner');
        if (plans.length === 0) return OWNER_FALLBACK_PLANS[locale];

        const sorted = sortByOrder(plans);
        return sorted.map((plan, idx) =>
            mapApiPlanToCard({
                plan,
                locale,
                index: idx,
                total: sorted.length,
                fallback: OWNER_FALLBACK_PLANS[locale],
                ctaLabels: OWNER_CTA_LABELS[locale],
                buildCtaHref: (slug, loc) => {
                    const suffix = OWNER_CTA_SUFFIX[slug] ?? slug.replace('owner-', '');
                    return `/${loc}/registro/propietario/?plan=${suffix}`;
                }
            })
        );
    } catch {
        return OWNER_FALLBACK_PLANS[locale];
    }
}
