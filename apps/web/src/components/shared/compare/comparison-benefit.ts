import type { createT } from '@/lib/i18n';

/** Describe the catalog comparison benefit without guessing a missing capacity. */
export function comparisonBenefit({
    t,
    planName,
    planCapacity
}: {
    readonly t: ReturnType<typeof createT>;
    readonly planName?: string | null;
    readonly planCapacity?: number;
}): string {
    return planName && planCapacity && Number.isSafeInteger(planCapacity) && planCapacity > 0
        ? t('accommodations.comparison.gate.benefit', undefined, {
              count: planCapacity,
              plan: planName
          })
        : t('accommodations.comparison.gate.upsellMessage');
}
