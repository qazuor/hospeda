/**
 * @file plan-comparison-table.helpers.ts
 * @description Pure helpers for `PlanComparisonTable.astro`: group selection,
 * column filtering and price formatting. They live outside the component so
 * the `.astro` file stays within the project's file-size budget (CLAUDE.md)
 * without changing what the table renders.
 */

import {
    EXPERIENCE_GROUPS,
    OWNER_GROUPS,
    TOURIST_GROUPS,
    VENUE_GROUPS
} from '@/components/billing/plan-comparison-rows';
import type { PublicPlanData } from '@/lib/billing/fetch-plans';
import { filterPlansByCategory } from '@/lib/billing/fetch-plans';
import type { PricingAudience } from '@/lib/billing-i18n';

/** Audiences this table renders; `'partner'` is deliberately excluded (HOS-1032). */
export type ComparisonAudience = Exclude<PricingAudience, 'partner'>;

const GROUPS_BY_AUDIENCE = {
    owner: OWNER_GROUPS,
    tourist: TOURIST_GROUPS,
    venue: VENUE_GROUPS,
    experience: EXPERIENCE_GROUPS
} as const;

/**
 * Returns the curated row groups for the given audience.
 * @param audience - Which comparison's groups to render.
 * @returns The shared row-model groups, never a local copy.
 */
export function getComparisonGroups(audience: ComparisonAudience) {
    return GROUPS_BY_AUDIENCE[audience];
}

/**
 * Filters the plans that become table columns.
 *
 * Accommodation audiences go through the shared `filterPlansByCategory`, which
 * filters on `category`. Every gastronomy/experience plan carries
 * `category: 'owner'` to satisfy `PlanCategory`, and its real discriminator
 * (`product_domain`) is applied server-side by `?domain=`, so those audiences
 * keep the same active-only, `sortOrder`-sorted guarantee directly instead of
 * matching nothing (HOS-1032).
 * @param input - Plans from the API and the audience being rendered.
 * @returns Active plans sorted by `sortOrder`.
 */
export function getActivePlans(input: {
    readonly plans: readonly PublicPlanData[];
    readonly audience: ComparisonAudience;
}): readonly PublicPlanData[] {
    const { plans, audience } = input;
    if (audience === 'owner' || audience === 'tourist') {
        return filterPlansByCategory(plans, audience);
    }

    return plans
        .filter((plan) => plan.isActive)
        .slice()
        .sort((left, right) => left.sortOrder - right.sortOrder);
}

/**
 * Formats a monthly price expressed in ARS cents for a column header.
 * @param input - Amount in cents, BCP-47 locale, and the translated free label.
 * @returns The localized currency string, or the free label for zero.
 */
export function formatPriceArs(input: {
    readonly cents: number;
    readonly intlLocale: string;
    readonly freeLabel: string;
}): string {
    const { cents, intlLocale, freeLabel } = input;
    if (cents === 0) return freeLabel;

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
