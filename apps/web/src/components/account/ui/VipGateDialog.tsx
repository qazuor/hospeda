/** Reusable VIP upsell. Import dynamically so catalog and modal code load on demand. */
import { useEffect, useId, useState } from 'react';
import { fetchPublicPlans, type PublicPlanData } from '@/lib/billing/fetch-plans';
import { buildSignupCheckoutHref } from '@/lib/billing/signup-checkout';
import { formatPrice } from '@/lib/format-utils';
import { createTranslations, type SupportedLocale } from '@/lib/i18n';
import { Button } from './Button';
import { Dialog } from './Dialog';
import { LinkButton } from './LinkButton';
import styles from './VipGateDialog.module.css';

export interface VipGateDialogProps {
    readonly open: boolean;
    readonly onClose: () => void;
    readonly locale: SupportedLocale;
    readonly apiUrl: string;
    readonly title: string;
    readonly body: string;
    readonly featureCopy: string;
    readonly benefits?: readonly string[];
}

/** Reads only the public catalog; never stores a feature intent across checkout. */
export function VipGateDialog({
    open,
    onClose,
    locale,
    apiUrl,
    title,
    body,
    featureCopy,
    benefits = []
}: VipGateDialogProps) {
    const { t } = createTranslations(locale);
    const descriptionId = useId();
    const [plan, setPlan] = useState<PublicPlanData | null>(null);
    const [loading, setLoading] = useState(true);
    const [attempt, setAttempt] = useState(0);

    // biome-ignore lint/correctness/useExhaustiveDependencies: The retry counter deliberately restarts a failed catalog read.
    useEffect(() => {
        if (!open) return;
        let cancelled = false;
        setLoading(true);
        setPlan(null);
        void fetchPublicPlans({ vertical: 'tourist', apiUrl }).then((result) => {
            if (cancelled) return;
            setPlan(
                result.ok
                    ? (result.plans.find(
                          (candidate) =>
                              candidate.isActive &&
                              candidate.slug === 'tourist-vip' &&
                              candidate.billingOptions?.monthly
                      ) ?? null)
                    : null
            );
            setLoading(false);
        });
        return () => {
            cancelled = true;
        };
    }, [open, apiUrl, attempt]);

    return (
        <Dialog
            open={open}
            onOpenChange={(next) => {
                if (!next) onClose();
            }}
            title={title}
            locale={locale}
            size="sm"
            describedBy={descriptionId}
            claimHistoryEntry={false}
            footer={
                <>
                    <Button
                        variant="secondary"
                        onClick={onClose}
                    >
                        {t('common.vipGate.notNow')}
                    </Button>
                    {plan?.billingOptions?.monthly ? (
                        <LinkButton
                            variant="accent"
                            href={buildSignupCheckoutHref({
                                locale,
                                billingOptionId: plan.billingOptions.monthly
                            })}
                        >
                            {t('common.vipGate.upgrade')}
                        </LinkButton>
                    ) : (
                        <Button
                            variant="accent"
                            disabled
                        >
                            {t('common.vipGate.upgrade')}
                        </Button>
                    )}
                </>
            }
        >
            <div className={styles.content}>
                <p id={descriptionId}>{body}</p>
                <p>{featureCopy}</p>
                {benefits.length > 0 && (
                    <ul>
                        {benefits.map((benefit) => (
                            <li key={benefit}>{benefit}</li>
                        ))}
                    </ul>
                )}
                <div
                    role="status"
                    aria-live="polite"
                >
                    {loading ? (
                        t('common.vipGate.loading')
                    ) : plan ? (
                        <p className={styles.price}>
                            {t('common.vipGate.monthlyPrice', undefined, {
                                price: formatPrice({
                                    amount: plan.monthlyPriceArs / 100,
                                    locale,
                                    showDecimals: plan.monthlyPriceArs % 100 !== 0
                                })
                            })}
                        </p>
                    ) : (
                        <>
                            <p>{t('common.vipGate.unavailable')}</p>
                            <Button
                                variant="quiet"
                                onClick={() => setAttempt((value) => value + 1)}
                            >
                                {t('common.vipGate.retry')}
                            </Button>
                        </>
                    )}
                </div>
            </div>
        </Dialog>
    );
}
