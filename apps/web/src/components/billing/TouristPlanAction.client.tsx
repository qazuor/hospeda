import { useEffect, useState } from 'react';
import { GradientButton } from '@/components/ui/GradientButtonReact';
import type { PublicPlanData } from '@/lib/billing/fetch-plans';
import { resolvePaidBenefit, selectInheritedTouristPlan } from '@/lib/billing/plan-badge';
import { isGrantedPlan, loadPricingSituation } from '@/lib/billing/pricing-situation';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import { buildUrl, buildUrlWithParams } from '@/lib/urls';
import styles from './TouristPlanAction.module.css';

type Plan = Partial<Pick<PublicPlanData, 'id'>> &
    Pick<
        PublicPlanData,
        'name' | 'monthlyPriceArs' | 'planVersionId' | 'sortOrder' | 'billingOptions' | 'isActive'
    > & {
        readonly entitlements?: readonly string[];
    };
type Situation = Awaited<ReturnType<typeof loadPricingSituation>>;

/** Resolve presentation from the authenticated situation, never from an SSR session. */
export function touristPlanState({ result }: { readonly result?: Situation }) {
    if (!result?.ok) return 'public';
    switch (result.data.situation) {
        case 'SUBSCRIBED':
            return result.data.status === 'PENDING_AUTHORIZATION' ? 'public' : 'paid';
        case 'TOURIST_VIP_INHERITED':
        case 'GRANTED':
            return 'paid';
        case 'CHECKOUT':
        case 'NO_PLANS':
            return 'free';
        case 'FIRST_USE':
        case 'TRIAL':
        case 'COVERED':
            return 'public';
    }
}

/** Shared traveler CTA, offer, and current-plan marker for public commercial pages. */
export function TouristPlanAction({
    locale,
    plans,
    href,
    label,
    mode = 'offer',
    planVersionId,
    fullWidth = false
}: {
    readonly locale: SupportedLocale;
    readonly plans: readonly Plan[];
    readonly href?: string;
    readonly label?: string;
    readonly mode?: 'offer' | 'compare' | 'closing' | 'freeCard' | 'column';
    readonly planVersionId?: string;
    readonly fullWidth?: boolean;
}) {
    const { t } = createTranslations(locale);
    const [result, setResult] = useState<Situation>();
    useEffect(() => {
        let active = true;
        void loadPricingSituation({ vertical: 'tourist' }).then((value) => {
            if (active) setResult(value);
        });
        return () => {
            active = false;
        };
    }, []);

    const state = touristPlanState({ result });
    const free = plans.find((plan) => plan.monthlyPriceArs === 0);
    const paid = plans
        .filter((plan) => plan.monthlyPriceArs > 0)
        .sort((a, b) => a.monthlyPriceArs - b.monthlyPriceArs)[0];
    const situation = result?.ok ? result.data : undefined;
    const inheritsVip = situation?.situation === 'TOURIST_VIP_INHERITED';
    // HOS-2665: a plan held through a permanent grant is current, with nothing to manage or renew.
    const granted = situation?.situation === 'GRANTED' ? situation : undefined;
    const current =
        state === 'free'
            ? free
            : granted
              ? plans.find((plan) =>
                    isGrantedPlan({
                        plan: { planId: plan.id, planVersionId: plan.planVersionId },
                        granted
                    })
                )
              : inheritsVip
                ? selectInheritedTouristPlan({
                      sellablePlans: plans.filter((plan) => plan.isActive && plan.billingOptions)
                  })
                : state === 'paid' && situation?.situation === 'SUBSCRIBED'
                  ? plans.find((plan) => plan.planVersionId === situation.planVersionId)
                  : undefined;
    const manage = buildUrlWithParams({
        locale,
        path: 'mi-cuenta/suscripcion',
        params: { domain: 'tourist' }
    });

    if (mode === 'column') {
        return state === 'paid' && planVersionId && current?.planVersionId === planVersionId ? (
            <strong data-current-tourist-plan>{t('pricing.planStatus.current')}</strong>
        ) : null;
    }
    const showOffer = mode === 'offer' || mode === 'compare';
    const price =
        paid &&
        new Intl.NumberFormat(locale, {
            style: 'currency',
            currency: 'ARS',
            maximumFractionDigits: 0
        }).format(paid.monthlyPriceArs / 100);
    const copy =
        showOffer && free && paid && price
            ? t(
                  mode === 'compare' ? 'pricing.planStatus.compare' : 'pricing.planStatus.offer',
                  undefined,
                  { free: free.name, paid: paid.name, price }
              )
            : null;
    const benefitPlan = state === 'paid' ? current : paid;
    const benefitLinks = [
        { key: 'vip_promotions_access', path: 'promociones' },
        { key: 'can_contact_whatsapp_direct', path: 'alojamientos' }
    ].filter(
        ({ key }) =>
            benefitPlan &&
            resolvePaidBenefit({
                floor: free ? { name: free.name, entitlements: free.entitlements ?? [] } : null,
                plans: [{ name: benefitPlan.name, entitlements: benefitPlan.entitlements ?? [] }],
                entitlement: key
            })
    );
    const canManage = state === 'paid' && !inheritsVip && !granted && mode !== 'freeCard';
    // The final CTA's granted version names the plan too: there is no button to show.
    const grantedName = granted && mode !== 'freeCard' ? (current?.name ?? granted.planName) : null;
    const actionHref = canManage ? manage : href;
    const actionLabel = canManage
        ? t('pricing.planStatus.manage')
        : state === 'free' && paid && showOffer
          ? t('pricing.planStatus.upgrade', undefined, { plan: paid.name })
          : label;

    return (
        <div className={mode === 'compare' ? styles.compare : undefined}>
            {current && !inheritsVip && !granted && mode !== 'closing' && (
                <p>
                    <strong>
                        {mode === 'freeCard'
                            ? t('pricing.planStatus.current')
                            : t('pricing.planStatus.named', undefined, { plan: current.name })}
                    </strong>
                </p>
            )}
            {grantedName && (
                <>
                    <p>
                        <strong>
                            {t('pricing.planStatus.named', undefined, { plan: grantedName })}
                        </strong>
                    </p>
                    <p data-tourist-plan-granted>{t('pricing.planStatus.granted')}</p>
                </>
            )}
            {inheritsVip && mode !== 'freeCard' && (
                <p>{t('publish.subscribe.touristVipInherited')}</p>
            )}
            {copy && state !== 'paid' && <p>{copy}</p>}
            {mode === 'compare' && benefitLinks.length > 0 && (
                <ul className={styles.benefits}>
                    {benefitLinks.map(({ key, path }) => (
                        <li key={key}>
                            {state === 'paid' ? (
                                <a href={buildUrl({ locale, path })}>
                                    {t(`billing.entitlement.${key}`)}
                                </a>
                            ) : (
                                t(`billing.entitlement.${key}`)
                            )}
                        </li>
                    ))}
                </ul>
            )}
            {!inheritsVip && !granted && actionHref && actionLabel && (
                <GradientButton
                    href={actionHref}
                    label={actionLabel}
                    variant="accent"
                    flat
                    className={fullWidth ? styles.fullWidth : undefined}
                />
            )}
        </div>
    );
}
