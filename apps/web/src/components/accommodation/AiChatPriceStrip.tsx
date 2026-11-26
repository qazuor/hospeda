import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import type { ListingContactPrice } from '@/lib/listing-contact/listing-contact-price';
import { getListingContactPrice } from '@/lib/listing-contact/listing-contact-price';
import styles from './AiChatChrome.module.css';

/** Desktop price summary pinned above the scrollable chat, with the existing consult action. */
export function AiChatPriceStrip({
    price,
    locale,
    onConsult
}: {
    readonly price: ListingContactPrice;
    readonly locale: SupportedLocale;
    readonly onConsult?: () => void;
}) {
    const { t } = createTranslations(locale);
    const display = getListingContactPrice({ price, locale });
    return (
        <div className={styles.priceStrip}>
            <span>
                {display && !display.onRequest
                    ? [
                          t('accommodations.detail.listingContact.summary.fromPrice', undefined, {
                              amount: display.amount
                          }),
                          display.unit
                      ]
                          .filter(Boolean)
                          .join(' ')
                    : t('accommodations.detail.listingContact.bar.priceOnRequest')}
            </span>
            {onConsult && (
                <button
                    className={styles.chip}
                    type="button"
                    onClick={onConsult}
                >
                    {t('accommodations.detail.listingContact.bar.inquire')}
                </button>
            )}
        </div>
    );
}
