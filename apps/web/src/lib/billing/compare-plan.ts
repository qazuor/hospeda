import { fetchPublicPlans } from './fetch-plans';
import { resolvePlanBadge, touristBadgeCatalog } from './plan-badge';

/** Read public comparison advertising metadata, omitting an unknown or invalid limit. */
export async function readComparePlan(): Promise<{
    readonly planName: string | null;
    readonly planCapacity?: number;
}> {
    const result = await fetchPublicPlans({ vertical: 'tourist' });
    const entitlement = 'can_compare_accommodations';
    const planName = resolvePlanBadge({ result, entitlement });
    const capacity = planName
        ? touristBadgeCatalog({ result }).plans.find(
              (plan) => plan.name === planName && plan.entitlements.includes(entitlement)
          )?.limits.max_compare_items
        : undefined;
    return {
        planName,
        planCapacity:
            capacity !== undefined && Number.isSafeInteger(capacity) && capacity > 0
                ? capacity
                : undefined
    };
}
