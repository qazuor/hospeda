import type { PricingSituationVertical } from '@repo/schemas';
import { useEffect, useMemo, useState } from 'react';
import {
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
    useEffect(() => {
        void loadPricingSituation({ vertical }).then(setResult);
    }, [vertical]);
    const view: PlanCardCtaView = result
        ? resolvePlanCardCta({ locale, vertical, plan: { planVersionId, billingOptions }, result })
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
                        className={styles.link}
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
