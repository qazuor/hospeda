import type { PricingSituationVertical } from '@repo/schemas';
import { useEffect, useMemo, useState } from 'react';
import { billingSubscriptionApi } from '@/lib/api/endpoints-protected';
import { findActiveSubscriptionId, submitPlanChange } from '@/lib/billing/plan-change-offer';
import {
    loadBillingUnpublishedListing,
    loadPricingSituation,
    type PlanCardCtaView,
    resolvePlanCardCta
} from '@/lib/billing/pricing-situation';
import { SIGNUP_CYCLE_LABEL_KEY, SIGNUP_VERTICAL_LABEL_KEY } from '@/lib/billing/signup-checkout';
import { createTranslations, type SupportedLocale } from '@/lib/i18n';
import styles from './PlanCardCta.module.css';

/** Per-card action derived from the API's shared pricing situation. */
export function PlanCardCta({
    locale,
    vertical,
    planVersionId,
    billingOptions
}: {
    readonly locale: SupportedLocale;
    readonly vertical: PricingSituationVertical;
    readonly planVersionId: string;
    readonly billingOptions: { readonly monthly: string; readonly annual: string | null };
}) {
    const [result, setResult] = useState<Awaited<ReturnType<typeof loadPricingSituation>> | null>(
        null
    );
    const { t, tPlural } = useMemo(() => createTranslations(locale), [locale]);
    const [ownsBillingUnpublished, setOwnsBillingUnpublished] = useState(false);
    const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
    const [changeMessage, setChangeMessage] = useState<string | null>(null);
    const [changePending, setChangePending] = useState(false);
    const [ownerNotice, setOwnerNotice] = useState<{
        readonly promo: boolean;
        readonly checkoutOpen: boolean;
        readonly paymentMethod: 'CARD' | 'MANUAL';
        readonly courtesyMonths: number;
    } | null>(null);
    useEffect(() => {
        let active = true;
        void loadPricingSituation({ vertical }).then((situation) => {
            if (!active) return;
            // The primary CTA is never delayed by the extra read (HOS-1977).
            setResult(situation);
            if (
                situation.ok &&
                situation.data.situation === 'SUBSCRIBED' &&
                ['ACTIVE', 'GRACE_PERIOD', 'PAUSED'].includes(situation.data.status)
            ) {
                void billingSubscriptionApi
                    .listMine({})
                    .then((mine) => {
                        if (!active || !mine.ok) return;
                        const row = mine.data.subscriptions.find(
                            (item) => item.vertical === vertical
                        );
                        setOwnerNotice(
                            row
                                ? {
                                      promo: row.promo != null,
                                      checkoutOpen: row.succession?.checkoutOpen === true,
                                      paymentMethod: row.paymentMethod,
                                      courtesyMonths:
                                          mine.data.deferredCourtesies
                                              ?.filter((courtesy) => courtesy.vertical === vertical)
                                              .reduce(
                                                  (total, courtesy) =>
                                                      total + courtesy.balanceMonths,
                                                  0
                                              ) ?? 0
                                  }
                                : null
                        );
                    })
                    .catch(() => setOwnerNotice(null));
            }
            // Only worth reading for an unspent trial.
            if (situation.ok && situation.data.situation === 'FIRST_USE') {
                void loadBillingUnpublishedListing({ vertical }).then((owns) => {
                    if (active) setOwnsBillingUnpublished(owns);
                });
            }
        });
        return () => {
            active = false;
        };
    }, [vertical]);
    const view: PlanCardCtaView = result
        ? resolvePlanCardCta({
              locale,
              vertical,
              plan: { planVersionId, billingOptions },
              result,
              ownsBillingUnpublishedListing: ownsBillingUnpublished
          })
        : { kind: 'none' };
    const label = t(SIGNUP_VERTICAL_LABEL_KEY[vertical]);
    async function confirmPlanChange() {
        if (!selectedOptionId) return;
        setChangePending(true);
        try {
            const subscriptionId = await findActiveSubscriptionId({ vertical });
            if (!subscriptionId) {
                setChangeMessage(t('account.subscription.mine.planChange.error'));
                return;
            }
            const outcome = await submitPlanChange({
                subscriptionId,
                billingOptionId: selectedOptionId,
                locale
            });
            if (outcome.kind === 'redirect') {
                window.location.assign(outcome.checkoutUrl);
                return;
            }
            setChangeMessage(outcome.message);
        } catch {
            setChangeMessage(t('account.subscription.mine.planChange.error'));
        } finally {
            setChangePending(false);
        }
    }
    const changeOptionIds =
        view.kind === 'planChange'
            ? view.optionIds
            : view.kind === 'current'
              ? view.changeOptions
              : [];
    const blockedStatus =
        result?.ok && result.data.situation === 'SUBSCRIBED' ? result.data.status : null;
    return (
        <div
            data-testid="pricing-card-cta"
            data-kind={view.kind}
            data-plan-version-id={planVersionId}
            data-loaded={result !== null}
            className={styles.root}
        >
            {view.kind === 'checkout' &&
                view.links.map(({ cycle, href, resumes }) => (
                    <a
                        key={cycle}
                        href={href}
                        className={cycle === 'monthly' ? styles.primary : styles.secondary}
                    >
                        {t(
                            resumes
                                ? 'publish.subscribe.continuePayment'
                                : cycle === 'monthly'
                                  ? 'publish.subscribe.checkoutMonthly'
                                  : 'publish.subscribe.checkoutAnnual'
                        )}
                    </a>
                ))}
            {view.kind === 'republish' && (
                <>
                    <p>{t('publish.subscribe.republishFromPropertiesHint')}</p>
                    <a
                        href={view.href}
                        className={styles.primary}
                    >
                        {t('publish.subscribe.republishFromProperties')}
                    </a>
                </>
            )}
            {view.kind === 'current' && (
                <span>{t('publish.subscribe.currentPlan', undefined, { vertical: label })}</span>
            )}
            {blockedStatus === 'PAUSED' && (
                <p data-testid="pricing-plan-change-paused">
                    {t('account.subscription.mine.planChange.reason.paused')}
                </p>
            )}
            {blockedStatus === 'GRACE_PERIOD' && ownerNotice?.paymentMethod && (
                <p data-testid="pricing-plan-change-grace">
                    {t(`account.subscription.mine.graceChangePlan.${ownerNotice.paymentMethod}`)}
                </p>
            )}
            {ownerNotice?.checkoutOpen && (
                <p data-testid="pricing-plan-change-checkout">
                    {t('account.subscription.mine.planChange.reason.succession')}
                </p>
            )}
            {ownerNotice &&
                !ownerNotice.checkoutOpen &&
                changeOptionIds.map((id) => (
                    <button
                        key={id}
                        type="button"
                        className={styles.secondary}
                        data-billing-option-id={id}
                        onClick={() => setSelectedOptionId(id)}
                    >
                        {t('account.subscription.mine.planChange.pricingOpen')} ·{' '}
                        {t(
                            SIGNUP_CYCLE_LABEL_KEY[
                                id === billingOptions.monthly ? 'monthly' : 'annual'
                            ]
                        )}
                    </button>
                ))}
            {selectedOptionId && !changeMessage && (
                <div data-testid="pricing-plan-change-confirm">
                    <p>{t('account.subscription.mine.planChange.confirmCheckout')}</p>
                    <p>{t('account.subscription.mine.planChange.confirmScheduled')}</p>
                    {ownerNotice?.promo && (
                        <p data-testid="pricing-plan-change-promo-warning">
                            {t('account.subscription.mine.planChange.promoLost')}
                        </p>
                    )}
                    {selectedOptionId !== billingOptions.monthly &&
                        ownerNotice &&
                        ownerNotice.courtesyMonths > 0 && (
                            <p data-testid="pricing-plan-change-courtesy-warning">
                                {tPlural(
                                    'account.subscription.mine.planChange.courtesyLost',
                                    ownerNotice.courtesyMonths,
                                    { count: ownerNotice.courtesyMonths }
                                )}
                            </p>
                        )}
                    <button
                        type="button"
                        className={styles.primary}
                        disabled={changePending}
                        onClick={() => void confirmPlanChange()}
                    >
                        {t('account.subscription.mine.planChange.confirm')}
                    </button>
                </div>
            )}
            {changeMessage && <p role="status">{changeMessage}</p>}
            {view.kind === 'vipInherited' && <p>{t('publish.subscribe.touristVipInherited')}</p>}
        </div>
    );
}
