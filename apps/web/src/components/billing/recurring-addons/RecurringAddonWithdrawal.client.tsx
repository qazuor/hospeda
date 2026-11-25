import { PackageIcon } from '@repo/icons';
import type { OwnerRecurringAddon } from '@repo/schemas';
import {
    AddonWithdrawalResponseSchema,
    OwnerRecurringAddonsQuerySchema,
    OwnerRecurringAddonsResponseSchema
} from '@repo/schemas';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/account/ui/Button';
import { DataList } from '@/components/account/ui/DataList';
import { EmptyState } from '@/components/account/ui/EmptyState';
import { LinkButton } from '@/components/account/ui/LinkButton';
import { ListRow } from '@/components/account/ui/ListRow';
import { billingAddonApi } from '@/lib/api/endpoints-protected-addons';
import { translateApiError, visibleApiMessage } from '@/lib/api-errors';
import { getAddonName } from '@/lib/billing/addon-purchase';
import { formatPrice } from '@/lib/format-utils';
import { createTranslations, type SupportedLocale } from '@/lib/i18n';
import { buildUrl } from '@/lib/urls';
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
    const confirmButtonRef = useRef<HTMLButtonElement>(null);
    const triggerRef = useRef<HTMLButtonElement>(null);
    const statusRef = useRef<HTMLParagraphElement>(null);
    const focusReturnIdRef = useRef<string | null>(null);
    const restoreTriggerFocusRef = useRef(false);
    const focusWithdrawalStatusRef = useRef(false);

    useLayoutEffect(() => {
        if (confirmId) confirmButtonRef.current?.focus();
        else if (restoreTriggerFocusRef.current) {
            triggerRef.current?.focus();
            restoreTriggerFocusRef.current = false;
        }
    }, [confirmId]);

    useLayoutEffect(() => {
        if (focusWithdrawalStatusRef.current && withdrawn) {
            statusRef.current?.focus();
            focusWithdrawalStatusRef.current = false;
        }
    });

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
                    if (parsed.success)
                        setItems(parsed.data.items.filter((item) => item.status === 'ACTIVE'));
                    else setError(t('billing.addonPurchase.recurringAddons.loadError'));
                } else
                    setError(
                        visibleApiMessage({ error: result.error }) ??
                            t('billing.addonPurchase.recurringAddons.loadError')
                    );
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
                        ? translateApiError({
                              error: result.error,
                              locale,
                              fallback: result.error.message
                          })
                        : t('billing.addonPurchase.recurringAddons.withdrawError')
                );
                return;
            }
            if (!AddonWithdrawalResponseSchema.safeParse(result.data).success) {
                setError(t('billing.addonPurchase.recurringAddons.withdrawError'));
                return;
            }
            focusWithdrawalStatusRef.current = true;
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
                    ref={statusRef}
                    role="status"
                    tabIndex={-1}
                    data-testid="recurring-addon-withdrawn"
                >
                    {t('billing.addonPurchase.recurringAddons.withdrawn')}
                </p>
            )}
            {!loading && !error && items.length === 0 && (
                <EmptyState
                    icon={
                        <PackageIcon
                            size={28}
                            aria-hidden={true}
                        />
                    }
                    title={t('billing.addonPurchase.recurringAddons.empty')}
                    action={
                        <LinkButton href={buildUrl({ locale, path: 'mi-cuenta/suscripcion' })}>
                            {t('billing.addonPurchase.recurringAddons.viewSubscriptions')}
                        </LinkButton>
                    }
                />
            )}
            {items.length > 0 && (
                <DataList label={t('billing.addonPurchase.recurringAddons.title')}>
                    {items.map((item) => (
                        <ListRow
                            key={item.addonInstanceId}
                            rowId={item.addonInstanceId}
                            title={
                                <span data-testid={`recurring-addon-${item.addonInstanceId}`}>
                                    {getAddonName({
                                        offer: {
                                            slug: item.slug,
                                            name: item.name,
                                            description: null
                                        },
                                        t
                                    })}
                                </span>
                            }
                            meta={
                                <span>
                                    {formatPrice({
                                        amount: item.price / 100,
                                        currency: item.currency,
                                        locale
                                    })}{' '}
                                    · {t(`billing.addonPurchase.cycle.${item.cycle}`)}
                                </span>
                            }
                            description={
                                <span>
                                    {item.targetName ??
                                        t('billing.addonPurchase.recurringAddons.noListing')}
                                </span>
                            }
                            actions={[
                                confirmId === item.addonInstanceId ? (
                                    <div
                                        key="confirm"
                                        className={styles.confirm}
                                        data-testid="recurring-addon-withdraw-confirm"
                                    >
                                        <p>
                                            {t('billing.addonPurchase.recurringAddons.confirmText')}
                                        </p>
                                        <Button
                                            variant="secondary"
                                            className={styles.withdrawButton}
                                            ref={confirmButtonRef}
                                            type="button"
                                            disabled={busy}
                                            onClick={() =>
                                                void confirmWithdrawal({
                                                    instanceId: item.addonInstanceId
                                                })
                                            }
                                        >
                                            {t('billing.addonPurchase.recurringAddons.confirm')}
                                        </Button>
                                        <Button
                                            variant="secondary"
                                            type="button"
                                            disabled={busy}
                                            onClick={() => {
                                                restoreTriggerFocusRef.current = true;
                                                setConfirmId(null);
                                            }}
                                        >
                                            {t('billing.addonPurchase.recurringAddons.cancel')}
                                        </Button>
                                    </div>
                                ) : (
                                    <Button
                                        key="withdraw"
                                        variant="secondary"
                                        className={styles.withdrawButton}
                                        ref={
                                            item.addonInstanceId === focusReturnIdRef.current
                                                ? triggerRef
                                                : undefined
                                        }
                                        type="button"
                                        data-testid={`recurring-addon-withdraw-${item.addonInstanceId}`}
                                        onClick={() => {
                                            focusReturnIdRef.current = item.addonInstanceId;
                                            setConfirmId(item.addonInstanceId);
                                        }}
                                    >
                                        {t('billing.addonPurchase.recurringAddons.withdraw')}
                                    </Button>
                                )
                            ]}
                        />
                    ))}
                </DataList>
            )}
        </div>
    );
}
