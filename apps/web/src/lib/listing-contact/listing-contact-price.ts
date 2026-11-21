import { z } from 'zod';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations, toRegionalLocaleTag } from '@/lib/i18n';

/** Public price in major units, or null for a listing without a price section. */
export const listingContactPriceSchema = z
    .object({
        amount: z.number().nonnegative().nullable(),
        currency: z
            .string()
            .regex(/^[A-Z]{3}$/i)
            .nullable(),
        unitLabelKey: z.string().min(1).nullable(),
        onRequest: z.boolean()
    })
    .readonly()
    .nullable();

/** Public price shared by the bar, panel, and mobile summary. */
export type ListingContactPrice = z.infer<typeof listingContactPriceSchema>;

/** Display fallback for accommodation prices whose currency is missing. */
export const DEFAULT_ACCOMMODATION_CURRENCY = 'ARS';

/** Formats the public nightly price using the same currency fallback as the sidebar. */
export function getListingContactPrice({
    price,
    locale
}: {
    readonly price: ListingContactPrice;
    readonly locale: SupportedLocale;
}): { readonly amount: string; readonly unit?: string } | null {
    if (!price) return null;
    const { t } = createTranslations(locale);
    if (price.onRequest || price.amount === null) {
        return { amount: t('accommodations.detail.listingContact.bar.priceOnRequest') };
    }
    const amount = new Intl.NumberFormat(toRegionalLocaleTag({ locale }), {
        style: 'currency',
        currency: price.currency ?? DEFAULT_ACCOMMODATION_CURRENCY,
        minimumFractionDigits: 0,
        maximumFractionDigits: 2
    }).format(price.amount);
    return { amount, unit: price.unitLabelKey ? t(price.unitLabelKey) : undefined };
}
