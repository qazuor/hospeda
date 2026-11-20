import type { AddonOffersResponse } from '@repo/schemas';
import { getAddonName, hiddenListingNoticeKind } from '@/lib/billing/addon-purchase';
import { formatPrice } from '@/lib/format-utils';
import type { createTranslations, SupportedLocale } from '@/lib/i18n';
import styles from './AddonPurchase.module.css';
import type { AddonTarget } from './AddonTargetPicker';

type Offer = AddonOffersResponse['items'][number];
type Translate = ReturnType<typeof createTranslations>['t'];

/**
 * Confirm a selected product and target, including the paid hidden-listing notice. A one-time
 * addon shows that it is charged once, that it is paid on Mercado Pago with a card or account
 * money (cash is excluded, HOS-2179 D-3), and a button that sends the owner there. Price and
 * duration come from the offer, never from code.
 */
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
            <strong>{getAddonName({ offer, t })}</strong>
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
                    {t(
                        noticeKind === 'ONE_TIME'
                            ? 'billing.addonPurchase.hiddenListingOneTime'
                            : 'billing.addonPurchase.hiddenListingRecurring'
                    )}
                </p>
            )}
            {!free && offer.chargeKind === 'UNA_VEZ' && (
                <>
                    <p data-testid="addon-one-time-summary">
                        {t('billing.addonPurchase.oneTimeSummary')}
                    </p>
                    <p data-testid="addon-instant-methods">
                        {t('billing.addonPurchase.instantMethodsOnly')}
                    </p>
                </>
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
                    className={styles.confirm}
                    data-testid="addon-free-choice-confirm"
                    disabled={input.busy}
                    onClick={input.onConfirm}
                >
                    {t('billing.addonPurchase.chooseFree')}
                </button>
            ) : offer.chargeKind === 'PERIODICO' ? (
                <button
                    type="button"
                    className={styles.confirm}
                    data-testid="addon-purchase-confirm"
                    disabled={input.busy}
                    onClick={input.onConfirm}
                >
                    {t('billing.addonPurchase.confirmPurchase')}
                </button>
            ) : (
                <button
                    type="button"
                    className={styles.confirm}
                    data-testid="addon-purchase-confirm"
                    disabled={input.busy}
                    onClick={input.onConfirm}
                >
                    {t('billing.addonPurchase.payWithMercadoPago')}
                </button>
            )}
        </section>
    );
}
