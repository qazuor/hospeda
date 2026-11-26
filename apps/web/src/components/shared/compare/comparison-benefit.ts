import type { PluralTranslationFn, TranslationFn } from '@/lib/i18n';

/** Describe the catalog comparison benefit without guessing a missing capacity. */
export function comparisonBenefit({
    t,
    tPlural,
    planName,
    planCapacity
}: {
    readonly t: TranslationFn;
    readonly tPlural: PluralTranslationFn;
    readonly planName?: string | null;
    readonly planCapacity?: number;
}): string {
    return planName && planCapacity && Number.isSafeInteger(planCapacity) && planCapacity > 0
        ? tPlural('accommodations.comparison.gate.benefit', planCapacity, {
              plan: planName
          })
        : t('accommodations.comparison.gate.upsellMessage');
}
