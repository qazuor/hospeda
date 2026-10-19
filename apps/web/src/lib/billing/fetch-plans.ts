/**
 * @file billing/fetch-plans.ts
 * @description Runtime reader for the current, sellable public plan catalog.
 */

import type { PlanCategory } from '@repo/billing';
import { PublicPlanCatalogResponseSchema, type PublicPlanCatalogVertical } from '@repo/schemas';
import { z } from 'zod';
import { getApiUrl } from '@/lib/env';

/** Pricing card data mapped from the public sellable catalog. */
export interface PublicPlanData {
    readonly id: string;
    readonly planVersionId?: string;
    readonly vertical: PublicPlanCatalogVertical;
    readonly slug: string;
    readonly name: string;
    readonly description: string;
    readonly category: PlanCategory;
    readonly monthlyPriceArs: number;
    readonly annualPriceArs: number | null;
    readonly hasTrial: boolean;
    readonly trialDays: number;
    readonly sortOrder: number;
    readonly isActive: boolean;
    readonly entitlements: readonly string[];
    readonly limits: Readonly<Record<string, number>>;
    readonly billingOptions?: { readonly monthly: string; readonly annual: string | null };
}

export type FetchPlansResult =
    | { readonly ok: true; readonly plans: readonly PublicPlanData[] }
    | { readonly ok: false; readonly error: string };

const CATEGORY_BY_VERTICAL: Record<PublicPlanCatalogVertical, PlanCategory> = {
    accommodation: 'owner',
    tourist: 'tourist',
    gastronomy: 'owner',
    experience: 'owner'
};

/** Named predicate shared by sellable plan cards and the free floor card. */
function hasTrialDays(days: number): boolean {
    return days > 0;
}

/** Map a catalog plan when it has a monthly billing choice. */
function mapSellablePlan(
    plan: {
        planId: string;
        planVersionId: string;
        slug: string;
        name: string;
        description: string | null;
        pricingOrder: number;
        rank: number;
        trialDays: number;
        entitlements: string[];
        limits: Record<string, number>;
        billingOptions: { id: string; cycle: string; amount: number }[];
    },
    vertical: PublicPlanCatalogVertical
): PublicPlanData | null {
    const monthly = plan.billingOptions.find((option) => option.cycle === 'monthly');
    if (!monthly) return null;
    const annual = plan.billingOptions.find((option) => option.cycle === 'annual');
    return {
        id: plan.planId,
        planVersionId: plan.planVersionId,
        vertical,
        slug: plan.slug,
        name: plan.name,
        description: plan.description ?? '',
        category: CATEGORY_BY_VERTICAL[vertical],
        monthlyPriceArs: monthly.amount,
        annualPriceArs: annual?.amount ?? null,
        hasTrial: hasTrialDays(plan.trialDays),
        trialDays: plan.trialDays,
        sortOrder: plan.pricingOrder,
        isActive: true,
        entitlements: plan.entitlements,
        limits: plan.limits,
        billingOptions: { monthly: monthly.id, annual: annual?.id ?? null }
    };
}

export const FREE_TIER_CARD_SLUG: Partial<Record<PublicPlanCatalogVertical, string>> = {
    tourist: 'tourist-free'
};

function mapFloor(
    floor: {
        planId: string;
        slug: string;
        name: string;
        description: string | null;
        pricingOrder: number;
        rank: number;
        trialDays: number;
        entitlements: string[];
        limits: Record<string, number>;
    },
    vertical: PublicPlanCatalogVertical
): PublicPlanData | null {
    const slug = FREE_TIER_CARD_SLUG[vertical];
    if (!slug) return null;
    return {
        id: floor.planId,
        vertical,
        slug,
        name: floor.name,
        description: floor.description ?? '',
        category: CATEGORY_BY_VERTICAL[vertical],
        monthlyPriceArs: 0,
        annualPriceArs: null,
        hasTrial: false,
        trialDays: 0,
        sortOrder: Number.NEGATIVE_INFINITY,
        isActive: true,
        entitlements: floor.entitlements,
        limits: floor.limits
    };
}

/**
 * Read one vertical's current, sellable catalog. Plans without a monthly
 * billing option are omitted because the pricing surface cannot sell them.
 * This reader never throws; transport, envelope, and schema failures degrade
 * to `ok: false`.
 */
export async function fetchPublicPlans({
    vertical
}: {
    readonly vertical: PublicPlanCatalogVertical;
}): Promise<FetchPlansResult> {
    const url = `${getApiUrl()}/api/v1/public/plan-catalog?vertical=${encodeURIComponent(vertical)}`;
    try {
        const response = await fetch(url, { headers: { Accept: 'application/json' } });
        if (!response.ok) {
            return { ok: false, error: `Public plan catalog returned HTTP ${response.status}` };
        }
        const envelope = z
            .object({ success: z.literal(true), data: z.unknown() })
            .safeParse(await response.json());
        if (!envelope.success) {
            return { ok: false, error: 'Unexpected public plan catalog response envelope' };
        }
        const parsed = PublicPlanCatalogResponseSchema.safeParse(envelope.data.data);
        if (!parsed.success || parsed.data.vertical !== vertical) {
            return { ok: false, error: 'Invalid public plan catalog response' };
        }

        const plans = parsed.data.plans
            .slice()
            .sort((left, right) => left.pricingOrder - right.pricingOrder || left.rank - right.rank)
            .map((plan) => mapSellablePlan(plan, vertical))
            .filter((plan): plan is PublicPlanData => plan !== null);
        const floor = parsed.data.floor ? mapFloor(parsed.data.floor, vertical) : null;
        return { ok: true, plans: floor ? [floor, ...plans] : plans };
    } catch (error) {
        return { ok: false, error: error instanceof Error ? error.message : 'Network error' };
    }
}

/** Keep remaining category-based comparison consumers active-only and ordered. */
export function filterPlansByCategory(
    plans: readonly PublicPlanData[],
    category: PlanCategory
): readonly PublicPlanData[] {
    return plans
        .filter((plan) => plan.isActive && plan.category === category)
        .slice()
        .sort((left, right) => left.sortOrder - right.sortOrder);
}
