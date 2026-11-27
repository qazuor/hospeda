import type { AddonOffersResponse } from '@repo/schemas';
import { Alert } from '@/components/account/ui/Alert';
import { Button } from '@/components/account/ui/Button';
import { Field } from '@/components/account/ui/Field';
import { PlanSummary } from '@/components/account/ui/PlanSummary';
import { TextInput } from '@/components/account/ui/TextInput';
import {
    type AddonSubscriptionTarget,
    getAddonName,
    hiddenListingNoticeKind
} from '@/lib/billing/addon-purchase';
import { formatPrice } from '@/lib/format-utils';
import type { createTranslations, SupportedLocale } from '@/lib/i18n';
import { RememberedPayerEmailNote } from '../RememberedPayerEmailNote';
import styles from './AddonPurchase.module.css';
import type { AddonTarget } from './AddonTargetPicker';

type Offer = AddonOffersResponse['items'][number];
type Translate = ReturnType<typeof createTranslations>['t'];

/** The renewal line of an offer: its cycle, its validity in days, or nothing. */
function renewalLine(input: { readonly offer: Offer; readonly t: Translate }): string | undefined {
    const { offer, t } = input;
    if (offer.cycle) return t(`billing.addonPurchase.cycle.${offer.cycle}`);
    if (offer.validityDays)
        return t(
            offer.validityDays === 1
                ? 'billing.addonPurchase.days_one'
                : 'billing.addonPurchase.days_other',
            undefined,
            { count: offer.validityDays }
        );
    return undefined;
}

/**
 * Confirm a selected product and target, including the paid hidden-listing notice. A one-time
 * addon shows that it is charged once, that it is paid on Mercado Pago with a card or account
 * money (cash is excluded, HOS-2179 D-3), and a button that sends the owner there. Price and
 * duration come from the offer, never from code.
 *
 * HOS-2599: the add-on, its destination, price and renewal sit in one kit `PlanSummary` card,
 * the payer email is a kit `Field`, and the notices and the confirm action are kit pieces.
 */
export function AddonPurchaseSummary(input: {
    readonly offer: Offer;
    readonly target: AddonTarget | null;
    /** The subscription a subscription-scoped add-on hangs from, if any. */
    readonly subscriptionTarget?: AddonSubscriptionTarget | null;
    readonly free: boolean;
    readonly payerEmail: string;
    readonly onPayerEmailChange: (value: string) => void;
    /** HOS-2616: the payer email is the remembered one, shown as a note instead of a field. */
    readonly usingRememberedEmail: boolean;
    /** Opens the editable payer email field. */
    readonly onUseAnotherEmail: () => void;
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
    const destination = target?.name ?? input.subscriptionTarget?.planName;
    return (
        <section
            className={styles.section}
            data-testid="addon-purchase-summary"
        >
            <h2>{t('billing.addonPurchase.summary')}</h2>
            <PlanSummary
                name={getAddonName({ offer, t })}
                scope={
                    destination ? (
                        <span data-testid="addon-summary-destination">
                            {t('billing.addonPurchase.summaryDestination', undefined, {
                                name: destination
                            })}
                        </span>
                    ) : undefined
                }
                price={
                    free
                        ? t('billing.addonPurchase.freeUnderGrant')
                        : formatPrice({
                              amount: offer.price / 100,
                              currency: offer.currency,
                              locale: input.locale
                          })
                }
                renewal={renewalLine({ offer, t })}
            />
            {noticeKind && (
                <div
                    data-testid="addon-hidden-listing-notice"
                    data-notice-kind={noticeKind}
                >
                    <Alert
                        tone="warning"
                        locale={input.locale}
                    >
                        {t(
                            noticeKind === 'ONE_TIME'
                                ? 'billing.addonPurchase.hiddenListingOneTime'
                                : 'billing.addonPurchase.hiddenListingRecurring'
                        )}
                    </Alert>
                </div>
            )}
            {!free && offer.chargeKind === 'UNA_VEZ' && (
                <div className={styles.lines}>
                    <p data-testid="addon-one-time-summary">
                        {t('billing.addonPurchase.oneTimeSummary')}
                    </p>
                    <p data-testid="addon-instant-methods">
                        {t('billing.addonPurchase.instantMethodsOnly')}
                    </p>
                </div>
            )}
            {!free && offer.chargeKind === 'PERIODICO' && input.usingRememberedEmail && (
                <RememberedPayerEmailNote
                    locale={input.locale}
                    email={input.payerEmail}
                    onChange={input.onUseAnotherEmail}
                />
            )}
            {!free && offer.chargeKind === 'PERIODICO' && !input.usingRememberedEmail && (
                <Field
                    label={t('billing.addonPurchase.payerEmailLabel')}
                    hint={t('billing.addonPurchase.payerEmailHint')}
                    locale={input.locale}
                    required
                    className={styles.emailField}
                >
                    <TextInput
                        type="email"
                        autoComplete="email"
                        value={input.payerEmail}
                        onChange={(event) => input.onPayerEmailChange(event.currentTarget.value)}
                        required
                    />
                </Field>
            )}
            <Button
                className={styles.confirm}
                data-testid={free ? 'addon-free-choice-confirm' : 'addon-purchase-confirm'}
                disabled={input.busy}
                loading={input.busy}
                onClick={input.onConfirm}
            >
                {t(
                    free
                        ? 'billing.addonPurchase.chooseFree'
                        : offer.chargeKind === 'PERIODICO'
                          ? 'billing.addonPurchase.confirmPurchase'
                          : 'billing.addonPurchase.payWithMercadoPago'
                )}
            </Button>
        </section>
    );
}
