/**
 * Lazily reads the VIP plan name from the public tourist catalog for the upsell
 * dialog (HOS-2589 §7.6). Runs only when `enabled` (a locked card exists), so a
 * VIP reader or a page without locked cards never pays for the read.
 *
 * It reads the catalog endpoint directly instead of `fetchPublicPlans`, whose
 * module pulls the server env reader into the island bundle.
 *
 * @module components/promotions/use-promotion-policy
 */
import { EntitlementKeyEnum, PublicPlanCatalogResponseSchema } from '@repo/schemas';
import { useEffect, useState } from 'react';
import { z } from 'zod';

/**
 * Reads the first tourist plan that grants `vip_promotions_access`.
 *
 * @param input - API base URL.
 * @returns The plan name, or `null` on any failure.
 */
export async function readVipPlanName(input: { readonly apiUrl: string }): Promise<string | null> {
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
        const plan = parsed.data.plans.find((candidate) =>
            candidate.entitlements.includes(EntitlementKeyEnum.VIP_PROMOTIONS_ACCESS)
        );
        return plan?.name ?? null;
    } catch {
        return null;
    }
}

/**
 * @param input - API base URL and whether to read.
 * @returns `{ vipPlanName }`, `null` until read or when unreadable.
 */
export function useVipPlanName(input: { readonly apiUrl: string; readonly enabled: boolean }): {
    readonly vipPlanName: string | null;
} {
    const [vipPlanName, setVipPlanName] = useState<string | null>(null);
    const { apiUrl, enabled } = input;
    useEffect(() => {
        if (!enabled) return;
        let cancelled = false;
        const read = async (): Promise<void> => {
            const name = await readVipPlanName({ apiUrl });
            if (!cancelled) setVipPlanName(name);
        };
        void read();
        return () => {
            cancelled = true;
        };
    }, [apiUrl, enabled]);
    return { vipPlanName };
}
