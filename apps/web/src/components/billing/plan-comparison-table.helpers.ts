/**
 * @file plan-comparison-table.helpers.ts
 * @description Pure helpers for `PlanComparisonTable.astro`: group selection,
 * column filtering and price formatting. They live outside the component so
 * the `.astro` file stays within the project's file-size budget (CLAUDE.md)
 * without changing what the table renders.
 */

import {
    EXPERIENCE_GROUPS,
    type GroupConfig,
    OWNER_GROUPS,
    type PlanCellSource,
    type RowConfig,
    TOURIST_GROUPS,
    VENUE_GROUPS
} from '@/components/billing/plan-comparison-rows';
import { resolveGroupCell } from '@/components/billing/plan-comparison-source';
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
 * Drops the rows flagged `hideUntilGranted` while no rendered plan column
 * grants them (HOS-2258). A row with the flag and at least one granting column
 * is kept, so the row appears by itself once a plan gets the entitlement.
 * Visibility is decided against the same plan the cells resolve against, so a
 * group that reads an inheriting plan's cells off the Tourist VIP plan
 * (HOS-2398) also decides "granted" off that plan.
 * @param input - The group's rows, the plan columns actually rendered, and
 *   optionally the group and the sellable Tourist VIP plan.
 * @returns The rows to render, in their original order.
 */
export function getVisibleRows(input: {
    readonly rows: readonly RowConfig[];
    readonly plans: readonly PlanCellSource[];
    readonly group?: Pick<GroupConfig, 'resolvesAgainstTouristVip'> | undefined;
    readonly touristVipPlan?: PlanCellSource | null | undefined;
}): readonly RowConfig[] {
    const { rows, plans, group = {}, touristVipPlan = null } = input;
    return rows.filter(
        (row) =>
            !row.hideUntilGranted ||
            plans.some(
                (plan) => resolveGroupCell({ group, cell: row.cell, plan, touristVipPlan }) !== 'no'
            )
    );
}

/**
 * Filters the plans that become table columns.
 *
 * Accommodation audiences go through the shared `filterPlansByCategory`, which
 * filters on `category`. Every venue/experience plan carries
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

/** Resolve annual display from the catalog, retaining monthly billing when no annual price exists. */
export function getComparisonAnnualPrice({
    plan
}: {
    readonly plan: Pick<PublicPlanData, 'monthlyPriceArs' | 'annualPriceArs'>;
}): { readonly cents: number; readonly period: 'month' | 'year' } {
    return plan.annualPriceArs !== null && plan.annualPriceArs > 0
        ? { cents: plan.annualPriceArs, period: 'year' }
        : { cents: plan.monthlyPriceArs, period: 'month' };
}

/**
 * HOS-2599: how many plan columns fit a 390px phone next to the sticky label column without
 * scrolling sideways. 366px of content (390 - 2 * 12px gutter) minus the 150px label leaves
 * 216px, two 108px plan columns. Up to this count the table drops its 600px floor and the
 * «swipe to see every plan» hint, so the tourist table (Gratis + VIP) never hides VIP.
 */
export const MOBILE_FIT_PLAN_COLUMNS = 2;

/**
 * Whether the comparison needs to scroll sideways on a phone.
 * @param input - The number of plan columns.
 * @returns `true` when the columns cannot fit a phone and the table scrolls.
 */
export function comparisonScrollsOnMobile(input: { readonly planCount: number }): boolean {
    return input.planCount > MOBILE_FIT_PLAN_COLUMNS;
}
