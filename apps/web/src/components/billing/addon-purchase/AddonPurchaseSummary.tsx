import type { AddonOffersResponse } from '@repo/schemas';
import { hiddenListingNoticeKind } from '@/lib/billing/addon-purchase';
import { formatPrice } from '@/lib/format-utils';
import type { createTranslations, SupportedLocale } from '@/lib/i18n';
import styles from './AddonPurchase.module.css';
import type { AddonTarget } from './AddonTargetPicker';

type Offer = AddonOffersResponse['items'][number];
type Translate = ReturnType<typeof createTranslations>['t'];

/** Confirm a selected product and target, including the paid hidden-listing notice. */
export function AddonPurchaseSummary(input: {
    readonly offer: Offer;
    readonly target: AddonTarget | null;
    readonly free: boolean;
    readonly payerEmail: string;
    readonly onPayerEmailChange: (value: string) => void;
    readonly busy: boolean;
    readonly locale: SupportedLocale;
    readonly onConfirm: () => void;
    readonly t: Translate;
}) {
    const { offer, target, free, t } = input;
    const noticeKind = target
        ? hiddenListingNoticeKind({
              scopeType: offer.scopeType,
              publicationStatus: target.publicationStatus,
              chargeKind: offer.chargeKind,
              free
          })
        : null;
    return (
        <section
            className={styles.section}
            data-testid="addon-purchase-summary"
        >
            <h2>{t('billing.addonPurchase.summary')}</h2>
            <strong>{offer.name}</strong>
            <p>
                {free
                    ? t('billing.addonPurchase.freeUnderGrant')
                    : formatPrice({
                          amount: offer.price / 100,
                          currency: offer.currency,
                          locale: input.locale
                      })}
            </p>
            {offer.cycle && <p>{t(`billing.addonPurchase.cycle.${offer.cycle}`)}</p>}
            {offer.validityDays && (
                <p>
                    {t(
                        offer.validityDays === 1
                            ? 'billing.addonPurchase.days_one'
                            : 'billing.addonPurchase.days_other',
                        undefined,
                        { count: offer.validityDays }
                    )}
                </p>
            )}
            {noticeKind && (
                <p
                    className={styles.notice}
                    data-testid="addon-hidden-listing-notice"
                    data-notice-kind={noticeKind}
                >
                    {t('billing.addonPurchase.hiddenListingRecurring')}
                </p>
            )}
            {!free && offer.chargeKind === 'PERIODICO' && (
                <label className={styles.emailField}>
                    <span>{t('billing.addonPurchase.payerEmailLabel')}</span>
                    <input
                        type="email"
                        value={input.payerEmail}
                        onChange={(event) => input.onPayerEmailChange(event.currentTarget.value)}
                        required
                    />
                    <small>{t('billing.addonPurchase.payerEmailHint')}</small>
                </label>
            )}
            {free ? (
                <button
                    type="button"
                    data-testid="addon-free-choice-confirm"
                    disabled={input.busy}
                    onClick={input.onConfirm}
                >
                    {t('billing.addonPurchase.chooseFree')}
                </button>
            ) : offer.chargeKind === 'PERIODICO' ? (
                <button
                    type="button"
                    data-testid="addon-purchase-confirm"
                    disabled={input.busy}
                    onClick={input.onConfirm}
                >
                    {t('billing.addonPurchase.confirmPurchase')}
                </button>
            ) : null}
        </section>
    );
}
