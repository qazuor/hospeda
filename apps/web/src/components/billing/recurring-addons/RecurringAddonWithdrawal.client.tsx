import type { OwnerRecurringAddon } from '@repo/schemas';
import {
    AddonWithdrawalResponseSchema,
    OwnerRecurringAddonsQuerySchema,
    OwnerRecurringAddonsResponseSchema
} from '@repo/schemas';
import { useEffect, useMemo, useState } from 'react';
import { billingAddonApi } from '@/lib/api/endpoints-protected-addons';
import { formatPrice } from '@/lib/format-utils';
import { createTranslations, type SupportedLocale } from '@/lib/i18n';
import styles from './RecurringAddonWithdrawal.module.css';

/** Owner controls for live recurring addons. All personal data loads in this island. */
export function RecurringAddonWithdrawal({
    locale,
    listingId
}: {
    readonly locale: SupportedLocale;
    readonly listingId: string | null;
}) {
    const { t } = useMemo(() => createTranslations(locale), [locale]);
    const [items, setItems] = useState<readonly OwnerRecurringAddon[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [confirmId, setConfirmId] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const [withdrawn, setWithdrawn] = useState(false);

    useEffect(() => {
        let active = true;
        const query = OwnerRecurringAddonsQuerySchema.safeParse(listingId ? { listingId } : {});
        if (!query.success) {
            setError(t('billing.addonPurchase.recurringAddons.invalidListing'));
            setLoading(false);
            return () => {
                active = false;
            };
        }
        void billingAddonApi
            .listRecurringAddons(query.data)
            .then((result) => {
                if (!active) return;
                if (result.ok) {
                    const parsed = OwnerRecurringAddonsResponseSchema.safeParse(result.data);
                    if (parsed.success) setItems(parsed.data.items);
                    else setError(t('billing.addonPurchase.recurringAddons.loadError'));
                } else setError(result.error.message);
                setLoading(false);
            })
            .catch(() => {
                if (active) {
                    setError(t('billing.addonPurchase.recurringAddons.loadError'));
                    setLoading(false);
                }
            });
        return () => {
            active = false;
        };
    }, [listingId, t]);

    async function confirmWithdrawal({
        instanceId
    }: {
        readonly instanceId: string;
    }): Promise<void> {
        setBusy(true);
        setError(null);
        try {
            const result = await billingAddonApi.withdrawAddon({ instanceId });
            if (!result.ok) {
                setError(
                    result.error.status === 404 || result.error.status === 409
                        ? result.error.message
                        : t('billing.addonPurchase.recurringAddons.withdrawError')
                );
                return;
            }
            if (!AddonWithdrawalResponseSchema.safeParse(result.data).success) {
                setError(t('billing.addonPurchase.recurringAddons.withdrawError'));
                return;
            }
            setItems((current) => current.filter((item) => item.addonInstanceId !== instanceId));
            setConfirmId(null);
            setWithdrawn(true);
        } catch {
            setError(t('billing.addonPurchase.recurringAddons.withdrawError'));
        } finally {
            setBusy(false);
        }
    }

    return (
        <div className={styles.root}>
            {loading && <p role="status">{t('billing.addonPurchase.recurringAddons.loading')}</p>}
            {error && <p role="alert">{error}</p>}
            {withdrawn && (
                <p
                    role="status"
                    data-testid="recurring-addon-withdrawn"
                >
                    {t('billing.addonPurchase.recurringAddons.withdrawn')}
                </p>
            )}
            {!loading && !error && items.length === 0 && (
                <p>{t('billing.addonPurchase.recurringAddons.empty')}</p>
            )}
            {items.map((item) => (
                <div
                    className={styles.row}
                    data-testid={`recurring-addon-${item.addonInstanceId}`}
                    key={item.addonInstanceId}
                >
                    <strong>{item.name}</strong>
                    <span>
                        {formatPrice({ amount: item.price / 100, currency: item.currency, locale })}{' '}
                        · {t(`billing.addonPurchase.cycle.${item.cycle}`)}
                    </span>
                    <span>
                        {item.targetName ?? t('billing.addonPurchase.recurringAddons.noListing')}
                    </span>
                    {confirmId === item.addonInstanceId ? (
                        <div
                            className={styles.confirm}
                            data-testid="recurring-addon-withdraw-confirm"
                        >
                            <p>{t('billing.addonPurchase.recurringAddons.confirmText')}</p>
                            <button
                                type="button"
                                disabled={busy}
                                onClick={() =>
                                    void confirmWithdrawal({ instanceId: item.addonInstanceId })
                                }
                            >
                                {t('billing.addonPurchase.recurringAddons.confirm')}
                            </button>
                            <button
                                type="button"
                                disabled={busy}
                                onClick={() => setConfirmId(null)}
                            >
                                {t('billing.addonPurchase.recurringAddons.cancel')}
                            </button>
                        </div>
                    ) : (
                        <button
                            type="button"
                            data-testid={`recurring-addon-withdraw-${item.addonInstanceId}`}
                            onClick={() => setConfirmId(item.addonInstanceId)}
                        >
                            {t('billing.addonPurchase.recurringAddons.withdraw')}
                        </button>
                    )}
                </div>
            ))}
        </div>
    );
}
