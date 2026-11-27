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

/**
 * Display form of a public price. `onRequest` marks the «Consultar precio» label,
 * which callers may render lighter than a real amount (HOS-2607, action bar).
 */
export interface ListingContactPriceDisplay {
    readonly amount: string;
    readonly unit?: string;
    readonly onRequest?: true;
}

/**
 * Whether a price alert can be offered for a listing with this public price.
 * A listing shown as «Precio a consultar» (no price, zero, or flagged `onRequest`)
 * has nothing to drop, and the API refuses the subscription, so the control must
 * not be offered to any viewer kind (HOS-2671).
 */
export function canOfferPriceAlert({ price }: { readonly price: ListingContactPrice }): boolean {
    if (!price || price.onRequest) return false;
    return price.amount !== null && Number.isFinite(price.amount) && price.amount > 0;
}

/** Formats the public nightly price using the same currency fallback as the sidebar. */
export function getListingContactPrice({
    price,
    locale
}: {
    readonly price: ListingContactPrice;
    readonly locale: SupportedLocale;
}): ListingContactPriceDisplay | null {
    if (!price) return null;
    const { t } = createTranslations(locale);
    if (price.onRequest || price.amount === null) {
        return {
            amount: t('accommodations.detail.listingContact.bar.priceOnRequest'),
            onRequest: true
        };
    }
    const amount = new Intl.NumberFormat(toRegionalLocaleTag({ locale }), {
        style: 'currency',
        currency: price.currency ?? DEFAULT_ACCOMMODATION_CURRENCY,
        minimumFractionDigits: 0,
        maximumFractionDigits: 2
    }).format(price.amount);
    return { amount, unit: price.unitLabelKey ? t(price.unitLabelKey) : undefined };
}

/** Resolves a detail card title without treating missing, zero or invalid amounts as prices. */
export function getListingPriceCardDisplay({
    price,
    locale,
    rangeLabel,
    hostReply = false,
    byEmail = false
}: {
    readonly price?: ListingContactPrice;
    readonly locale: SupportedLocale;
    readonly rangeLabel?: string | null;
    readonly hostReply?: boolean;
    readonly byEmail?: boolean;
}): { readonly title: string; readonly unit?: string; readonly note?: string } {
    const { t } = createTranslations(locale);
    if (rangeLabel) return { title: rangeLabel };
    if (price?.amount != null && Number.isFinite(price.amount) && price.amount > 0) {
        const display = getListingContactPrice({ price, locale });
        if (display && !display.onRequest) {
            return {
                title: t('accommodations.detail.listingContact.summary.fromPrice', undefined, {
                    amount: display.amount
                }),
                unit: display.unit
            };
        }
    }
    return {
        title: t('accommodations.detail.listingContact.summary.priceOnRequest'),
        note: byEmail
            ? t('accommodations.detail.listingContact.summary.requestByEmail')
            : hostReply
              ? t('accommodations.detail.listingContact.summary.hostReply')
              : undefined
    };
}
