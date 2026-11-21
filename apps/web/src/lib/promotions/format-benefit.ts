import { formatPrice } from '@/lib/format-utils';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';

/** Format a promotion benefit without inventing a numeric value for free text. */
export function formatPromotionBenefit({
    discountType,
    discountValue,
    locale,
    specialOfferText,
    style = 'benefit'
}: {
    readonly discountType: string;
    readonly discountValue: number | null;
    readonly locale: SupportedLocale;
    readonly specialOfferText?: string | null;
    readonly style?: 'summary' | 'benefit';
}): string {
    if (discountType === 'special_offer') return specialOfferText ?? '';
    const { t } = createTranslations(locale);
    if (discountType === 'free_night')
        return t('host.promotions.discountTypes.free_night', 'Free night');
    if (discountValue === null) return '';
    if (discountType === 'percentage') {
        const value = `${discountValue}%`;
        return style === 'summary'
            ? value
            : `${value} ${t('accommodations.detail.promotions.discountOff', 'off')}`;
    }
    if (discountType === 'fixed') {
        const value = formatPrice({ amount: discountValue, locale });
        return style === 'summary'
            ? value
            : `${value} ${t('accommodations.detail.promotions.discountOff', 'off')}`;
    }
    return '';
}
