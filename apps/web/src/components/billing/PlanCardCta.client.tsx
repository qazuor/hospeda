import type { PricingSituationVertical } from '@repo/schemas';
import { useEffect, useMemo, useState } from 'react';
import {
    loadBillingUnpublishedListing,
    loadPricingSituation,
    PLAN_CHANGE_UNAVAILABLE_KEY,
    type PlanCardCtaView,
    resolvePlanCardCta
} from '@/lib/billing/pricing-situation';
import { SIGNUP_VERTICAL_LABEL_KEY } from '@/lib/billing/signup-checkout';
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
    const { t } = useMemo(() => createTranslations(locale), [locale]);
    const [ownsBillingUnpublished, setOwnsBillingUnpublished] = useState(false);
    useEffect(() => {
        let active = true;
        void loadPricingSituation({ vertical }).then((situation) => {
            if (!active) return;
            // The primary CTA is never delayed by the extra read (HOS-1977).
            setResult(situation);
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
                <>
                    <span>
                        {t('publish.subscribe.currentPlan', undefined, { vertical: label })}
                    </span>
                    {view.showsPlanChangeNotice && <p>{t(PLAN_CHANGE_UNAVAILABLE_KEY)}</p>}
                </>
            )}
            {view.kind === 'planChangeUnavailable' && <p>{t(PLAN_CHANGE_UNAVAILABLE_KEY)}</p>}
            {view.kind === 'vipInherited' && <p>{t('publish.subscribe.touristVipInherited')}</p>}
        </div>
    );
}
