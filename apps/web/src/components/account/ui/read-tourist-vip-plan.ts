/**
 * Client-safe read of the tourist VIP plan for the VIP gate dialog. It reads the
 * public catalog endpoint directly instead of `fetchPublicPlans`, whose module
 * pulls the server env reader (and the billing graph) into the island bundle.
 *
 * @module components/account/ui/read-tourist-vip-plan
 */
import { PublicPlanCatalogResponseSchema } from '@repo/schemas';
import { z } from 'zod';

/** The monthly choice of the tourist VIP plan, as the catalog sells it. */
export interface TouristVipPlan {
    /** Monthly billing option id, the checkout entry point. */
    readonly monthlyOptionId: string;
    /** Monthly amount in centavos of ARS, exactly as the catalog states it. */
    readonly monthlyPriceArs: number;
}

/**
 * Reads the tourist VIP plan with a monthly billing option.
 *
 * @param input - Options object.
 * @param input.apiUrl - API base URL.
 * @returns The plan, or `null` on any failure or when the catalog has none.
 */
export async function readTouristVipPlan(input: {
    readonly apiUrl: string;
}): Promise<TouristVipPlan | null> {
    try {
        const response = await fetch(
            `${input.apiUrl.replace(/\/$/, '')}/api/v1/public/plan-catalog?vertical=tourist`,
            { headers: { Accept: 'application/json' } }
        );
        if (!response.ok) return null;
        const envelope = z
            .object({ success: z.literal(true), data: z.unknown() })
            .safeParse(await response.json());
        if (!envelope.success) return null;
        const parsed = PublicPlanCatalogResponseSchema.safeParse(envelope.data.data);
        if (!parsed.success) return null;
        const plan = parsed.data.plans.find((candidate) => candidate.slug === 'tourist-vip');
        const monthly = plan?.billingOptions.find((option) => option.cycle === 'monthly');
        return monthly ? { monthlyOptionId: monthly.id, monthlyPriceArs: monthly.amount } : null;
    } catch {
        return null;
    }
}
