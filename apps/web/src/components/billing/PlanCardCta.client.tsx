import type { PricingSituationVertical } from '@repo/schemas';
import { useEffect, useMemo, useState } from 'react';
import { LinkButton } from '@/components/account/ui/LinkButton';
import { StatusPill } from '@/components/account/ui/StatusPill';
import { billingSubscriptionApi } from '@/lib/api/endpoints-protected';
import { totalCourtesyMonths } from '@/lib/billing/my-subscription-notices';
import {
    findActiveSubscriptionId,
    loadDeclaredPayerEmail,
    parsePayerEmail,
    submitPlanChange
} from '@/lib/billing/plan-change-offer';
import {
    loadBillingUnpublishedListing,
    loadPricingSituation,
    type PlanCardCtaView,
    resolvePlanCardCta
} from '@/lib/billing/pricing-situation';
import { SIGNUP_CYCLE_LABEL_KEY, SIGNUP_VERTICAL_LABEL_KEY } from '@/lib/billing/signup-checkout';
import { createTranslations, type SupportedLocale } from '@/lib/i18n';
import { buildUrlWithParams } from '@/lib/urls';
import styles from './PlanCardCta.module.css';

/** Per-card action derived from the API's shared pricing situation. */
export function PlanCardCta({
    locale,
    vertical,
    planVersionId,
    billingOptions,
    planName,
    inheritedPlanVersionId
}: {
    readonly locale: SupportedLocale;
    readonly vertical: PricingSituationVertical;
    readonly planVersionId: string;
    readonly planName?: string;
    readonly inheritedPlanVersionId?: string;
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
    const [payerEmail, setPayerEmail] = useState('');
    const [payerEmailTouched, setPayerEmailTouched] = useState(false);
    const [payerEmailError, setPayerEmailError] = useState(false);
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
                ['ACTIVE', 'GRACE_PERIOD', 'PAUSED', 'SUSPENDED'].includes(situation.data.status)
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
                                      courtesyMonths: totalCourtesyMonths({
                                          row,
                                          deferredCourtesies: mine.data.deferredCourtesies ?? []
                                      })
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
    /** Prefill the payer email with the one declared on the current subscription (HOS-2218). */
    async function prefillPayerEmail() {
        if (payerEmailTouched || payerEmail) return;
        const subscriptionId = await findActiveSubscriptionId({ vertical });
        if (!subscriptionId) return;
        const declared = await loadDeclaredPayerEmail({ subscriptionId });
        setPayerEmail((current) => current || declared);
    }
    async function confirmPlanChange() {
        if (!selectedOptionId) return;
        const email = parsePayerEmail({ value: payerEmail });
        if (!email) {
            setPayerEmailError(true);
            return;
        }
        setPayerEmailError(false);
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
                payerEmail: email,
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
    const isCurrentTouristPlan =
        vertical === 'tourist' &&
        (view.kind === 'current' ||
            (view.kind === 'vipInherited' && planVersionId === inheritedPlanVersionId));
    return (
        <div
            data-testid="pricing-card-cta"
            data-kind={view.kind}
            data-plan-version-id={planVersionId}
            data-loaded={result !== null}
            data-has-both-cycles={billingOptions.annual !== null}
            className={styles.root}
        >
            {view.kind === 'checkout' &&
                view.links.map(({ cycle, href, resumes }) => (
                    <LinkButton
                        key={cycle}
                        href={href}
                        data-cycle={cycle}
                        variant="accent"
                        fullWidth
                    >
                        {t(
                            resumes
                                ? 'publish.subscribe.continuePayment'
                                : cycle === 'monthly'
                                  ? 'publish.subscribe.checkoutMonthly'
                                  : 'publish.subscribe.checkoutAnnual'
                        )}
                        {vertical === 'tourist' &&
                            result?.ok &&
                            result.data.situation === 'CHECKOUT' &&
                            planName && (
                                <>
                                    {' '}
                                    ·{' '}
                                    {t('pricing.planStatus.upgrade', undefined, { plan: planName })}
                                </>
                            )}
                    </LinkButton>
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
            {(view.kind === 'current' || isCurrentTouristPlan) && (
                <StatusPill
                    tone="success"
                    className={styles.currentPlan}
                >
                    {vertical === 'tourist'
                        ? t('pricing.planStatus.current')
                        : t('publish.subscribe.currentPlan', undefined, { vertical: label })}
                </StatusPill>
            )}
            {isCurrentTouristPlan && (
                <LinkButton
                    href={buildUrlWithParams({
                        locale,
                        path: 'mi-cuenta/suscripcion',
                        params: { domain: 'tourist' }
                    })}
                    variant="accent"
                    fullWidth
                >
                    {t('pricing.planStatus.manage')}
                </LinkButton>
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
                    {t(
                        blockedStatus === 'SUSPENDED'
                            ? 'account.subscription.mine.planChange.reason.successionCoverage'
                            : 'account.subscription.mine.planChange.reason.succession'
                    )}
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
                        data-cycle={id === billingOptions.monthly ? 'monthly' : 'annual'}
                        onClick={() => {
                            setSelectedOptionId(id);
                            void prefillPayerEmail();
                        }}
                    >
                        {view.kind === 'current' ? (
                            t(
                                id === billingOptions.monthly
                                    ? 'publish.subscribe.switchToMonthly'
                                    : 'publish.subscribe.switchToAnnual'
                            )
                        ) : (
                            <>
                                {t('account.subscription.mine.planChange.pricingOpen')} ·{' '}
                                {t(
                                    SIGNUP_CYCLE_LABEL_KEY[
                                        id === billingOptions.monthly ? 'monthly' : 'annual'
                                    ]
                                )}
                            </>
                        )}
                    </button>
                ))}
            {selectedOptionId && !changeMessage && (
                <div data-testid="pricing-plan-change-confirm">
                    <p>{t('account.subscription.mine.planChange.confirmCheckout')}</p>
                    <p>{t('account.subscription.mine.planChange.confirmScheduled')}</p>
                    <label className={styles.field}>
                        <span>{t('account.subscription.mine.planChange.payerEmailLabel')}</span>
                        <input
                            type="email"
                            name="payerEmail"
                            autoComplete="email"
                            required
                            value={payerEmail}
                            aria-invalid={payerEmailError}
                            data-testid="pricing-plan-change-payer-email"
                            onChange={(event) => {
                                setPayerEmailTouched(true);
                                setPayerEmail(event.target.value);
                            }}
                        />
                        <small>{t('account.subscription.mine.planChange.payerEmailHint')}</small>
                    </label>
                    {payerEmailError && (
                        <p
                            role="alert"
                            data-testid="pricing-plan-change-payer-email-error"
                        >
                            {t('account.subscription.mine.planChange.payerEmailInvalid')}
                        </p>
                    )}
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
        </div>
    );
}
