/**
 * @file SubscriptionDashboard.client.tsx
 * @description React island for the user subscription dashboard at /mi-cuenta/suscripcion/.
 *
 * Displays the current plan, status badge, next billing date, payment method,
 * and plan features. Provides cancel and invoice download actions.
 * HOST/ADMIN/SUPERADMIN roles see an additional admin escalation button.
 */

import { translateApiError } from '@/lib/api-errors';
import { billingApi, userApi } from '@/lib/api/endpoints-protected';
import type { InvoiceItem, SubscriptionData } from '@/lib/api/endpoints-protected';
import { getAdminUrl } from '@/lib/env';
import { formatDate } from '@/lib/format-utils';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import { buildUrl } from '@/lib/urls';
import { addToast } from '@/store/toast-store';
import { ArrowRightIcon, CancelIcon, DownloadIcon, PlayIcon, PowerOffIcon } from '@repo/icons';
import { useCallback, useEffect, useState } from 'react';
import styles from './SubscriptionDashboard.module.css';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Roles that can access the admin panel escalation button. */
const ADMIN_ROLES = new Set([
    'HOST',
    'ADMIN',
    'CLIENT_MANAGER',
    'EDITOR',
    'SPONSOR',
    'SUPER_ADMIN'
]);

/** Subscription status label map keys */
type SubscriptionStatus =
    | 'active'
    | 'trial'
    | 'cancelled'
    | 'expired'
    | 'past_due'
    | 'pending'
    | 'paused';

/** User shape passed from the Astro page */
export interface SubscriptionDashboardUser {
    readonly id: string;
    readonly role: string;
}

/** Props for the SubscriptionDashboard island */
export interface SubscriptionDashboardProps {
    /** Active locale for UI strings and date formatting */
    readonly locale: SupportedLocale;
    /** Authenticated user — id is used for subscription fetches, role for escalation */
    readonly user: SubscriptionDashboardUser;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Map a subscription status to its CSS module class.
 *
 * @param status - Raw subscription status string
 * @returns CSS module class key
 */
function getBadgeClass(status: SubscriptionStatus): string {
    switch (status) {
        case 'active':
            return styles.badgeActive ?? '';
        case 'trial':
            return styles.badgeTrial ?? '';
        case 'cancelled':
            return styles.badgeCancelled ?? '';
        case 'expired':
            return styles.badgeExpired ?? '';
        case 'past_due':
            return styles.badgePastDue ?? '';
        case 'pending':
            return styles.badgePending ?? '';
        case 'paused':
            return styles.badgePaused ?? '';
        default:
            return styles.badgePending ?? '';
    }
}

/**
 * Format the payment method display string.
 * If a card brand + last4 is available, shows "Visa •••• 4242".
 * Otherwise falls back to "MercadoPago".
 *
 * @param paymentMethod - Payment method data from subscription
 * @param fallback - Fallback string when no card data is present
 * @returns Human-readable payment method string
 */
function formatPaymentMethod(
    paymentMethod: SubscriptionData['paymentMethod'],
    fallback: string
): string {
    if (!paymentMethod) return fallback;
    const brand = paymentMethod.brand
        ? paymentMethod.brand.charAt(0).toUpperCase() + paymentMethod.brand.slice(1)
        : '';
    return `${brand} •••• ${paymentMethod.last4}`.trim();
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/** Loading skeleton for the subscription dashboard. */
function LoadingState({ locale }: { readonly locale: SupportedLocale }) {
    const { t } = createTranslations(locale);
    return (
        <output
            className={styles.loadingContainer}
            aria-live="polite"
            aria-label={t('account.pages.subscription.loading', 'Cargando suscripción...')}
        >
            <span
                className={styles.spinner}
                aria-hidden="true"
            />
            <p className={styles.loadingText}>
                {t('account.pages.subscription.loading', 'Cargando suscripción...')}
            </p>
        </output>
    );
}

/** Error state for failed subscription fetch. */
function ErrorState({
    locale,
    message,
    onRetry
}: {
    readonly locale: SupportedLocale;
    readonly message: string;
    readonly onRetry: () => void;
}) {
    const { t } = createTranslations(locale);
    return (
        <div
            className={styles.errorContainer}
            role="alert"
        >
            <p className={styles.errorTitle}>
                {t('account.pages.subscription.errorTitle', 'Error al cargar la suscripción')}
            </p>
            <p className={styles.errorBody}>{message}</p>
            <button
                type="button"
                className={styles.btnSecondary}
                onClick={onRetry}
            >
                {t('common.retry', 'Reintentar')}
            </button>
        </div>
    );
}

/** Empty state when the user has no subscription. */
function EmptyState({ locale }: { readonly locale: SupportedLocale }) {
    const { t } = createTranslations(locale);
    const plansHref = buildUrl({ locale, path: 'suscriptores/planes' });

    return (
        <div className={styles.emptyContainer}>
            <p className={styles.emptyTitle}>
                {t('account.pages.subscription.emptyTitle', 'Sin suscripción activa')}
            </p>
            <p className={styles.emptyBody}>
                {t(
                    'account.pages.subscription.emptyBody',
                    'Todavía no tenés un plan activo. Explorá nuestros planes para acceder a beneficios exclusivos.'
                )}
            </p>
            <a
                href={plansHref}
                className={styles.btnPrimary}
            >
                <ArrowRightIcon
                    size={16}
                    weight="regular"
                    aria-hidden="true"
                />
                {t('account.pages.subscription.viewPlans', 'Ver planes')}
            </a>
        </div>
    );
}

/** Support email shown in the cancel-instructions modal. Matches footer.contactEmail. */
const SUPPORT_EMAIL = 'info@hospeda.com';

/**
 * Cancel-instructions modal.
 *
 * User self-cancel via API is not yet implemented (tracked under SPEC-147),
 * so this modal directs the user to email support instead. Once the
 * self-cancel endpoint ships the modal can revert to a confirm-and-call flow.
 */
function CancelConfirmModal({
    locale,
    onDismiss
}: {
    readonly locale: SupportedLocale;
    readonly onDismiss: () => void;
}) {
    const { t } = createTranslations(locale);

    // Close on backdrop click
    function handleBackdropClick(e: React.MouseEvent<HTMLDivElement>) {
        if (e.target === e.currentTarget) {
            onDismiss();
        }
    }

    // Close on Escape key
    useEffect(() => {
        function handleKeyDown(e: KeyboardEvent) {
            if (e.key === 'Escape') {
                onDismiss();
            }
        }
        document.addEventListener('keydown', handleKeyDown);
        return () => {
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [onDismiss]);

    const subject = encodeURIComponent(
        t('account.pages.subscription.cancelModal.emailSubject', 'Cancelación de suscripción')
    );
    const mailtoHref = `mailto:${SUPPORT_EMAIL}?subject=${subject}`;

    return (
        // biome-ignore lint/a11y/useKeyWithClickEvents: backdrop click is supplemental; Escape key handler covers keyboard users
        <div
            className={styles.modalBackdrop}
            onClick={handleBackdropClick}
        >
            <dialog
                className={styles.modal}
                open
                aria-labelledby="cancel-modal-title"
            >
                <h2
                    id="cancel-modal-title"
                    className={styles.modalTitle}
                >
                    {t('account.pages.subscription.cancelModal.title', 'Cancelar suscripción')}
                </h2>
                <p className={styles.modalBody}>
                    {t(
                        'account.pages.subscription.cancelModal.body',
                        `Para cancelar tu suscripción, escribinos a ${SUPPORT_EMAIL} y un agente la procesará a la brevedad. Tu plan seguirá activo hasta el final del período actual.`
                    )}
                </p>
                <div className={styles.modalActions}>
                    <button
                        type="button"
                        className={styles.btnSecondary}
                        onClick={onDismiss}
                    >
                        {t('common.close', 'Cerrar')}
                    </button>
                    <a
                        href={mailtoHref}
                        className={styles.btnDanger}
                    >
                        {t(
                            'account.pages.subscription.cancelModal.contactSupport',
                            'Escribir a soporte'
                        )}
                    </a>
                </div>
            </dialog>
        </div>
    );
}

/**
 * Pause confirmation modal (SPEC-143 #29).
 *
 * A host self-pause is always "full": billing stops AND the owner's
 * accommodations are hidden from the public site + locked from editing until
 * resume. The modal spells that out before calling the self-serve pause.
 */
function PauseConfirmModal({
    locale,
    isPausing,
    onConfirm,
    onDismiss
}: {
    readonly locale: SupportedLocale;
    readonly isPausing: boolean;
    readonly onConfirm: () => void;
    readonly onDismiss: () => void;
}) {
    const { t } = createTranslations(locale);

    function handleBackdropClick(e: React.MouseEvent<HTMLDivElement>) {
        if (e.target === e.currentTarget) {
            onDismiss();
        }
    }

    useEffect(() => {
        function handleKeyDown(e: KeyboardEvent) {
            if (e.key === 'Escape') {
                onDismiss();
            }
        }
        document.addEventListener('keydown', handleKeyDown);
        return () => {
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [onDismiss]);

    return (
        // biome-ignore lint/a11y/useKeyWithClickEvents: backdrop click is supplemental; Escape key handler covers keyboard users
        <div
            className={styles.modalBackdrop}
            onClick={handleBackdropClick}
        >
            <dialog
                className={styles.modal}
                open
                aria-labelledby="pause-modal-title"
            >
                <h2
                    id="pause-modal-title"
                    className={styles.modalTitle}
                >
                    {t('account.pages.subscription.pauseModal.title', 'Pausar suscripción')}
                </h2>
                <p className={styles.modalBody}>
                    {t(
                        'account.pages.subscription.pauseModal.body',
                        'Al pausar, dejás de pagar y tus alojamientos se ocultan del sitio y no podrás editarlos hasta reanudar. Toda tu configuración se conserva y vuelve igual al reanudar.'
                    )}
                </p>
                <div className={styles.modalActions}>
                    <button
                        type="button"
                        className={styles.btnSecondary}
                        onClick={onDismiss}
                        disabled={isPausing}
                    >
                        {t('common.cancel', 'Cancelar')}
                    </button>
                    <button
                        type="button"
                        className={styles.btnDanger}
                        onClick={onConfirm}
                        disabled={isPausing}
                        aria-busy={isPausing}
                    >
                        {isPausing
                            ? t('common.loading', 'Cargando...')
                            : t('account.pages.subscription.pauseModal.confirm', 'Pausar')}
                    </button>
                </div>
            </dialog>
        </div>
    );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

/**
 * SubscriptionDashboard React island.
 *
 * Fetches the user's subscription on mount and renders:
 * - Current plan name + status badge
 * - Next billing date (formatted)
 * - Payment method (card or MercadoPago)
 * - Plan features list
 * - Cancel + invoice download actions
 * - Admin escalation button for HOST/ADMIN/SUPERADMIN roles
 *
 * @param props - {@link SubscriptionDashboardProps}
 */
export function SubscriptionDashboard({ locale, user }: SubscriptionDashboardProps) {
    const { t } = createTranslations(locale);

    // ── State ──────────────────────────────────────────────────────────────

    const [subscription, setSubscription] = useState<SubscriptionData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [fetchError, setFetchError] = useState<string | null>(null);
    const [showCancelModal, setShowCancelModal] = useState(false);
    const [showPauseModal, setShowPauseModal] = useState(false);
    const [isPausing, setIsPausing] = useState(false);
    const [isDownloading, setIsDownloading] = useState(false);

    const isAdminRole = ADMIN_ROLES.has(user.role);

    // ── Fetch ──────────────────────────────────────────────────────────────

    // biome-ignore lint/correctness/useExhaustiveDependencies: stable identity by design — `t` and `userApi` are captured at first mount and never change between renders for a given locale.
    const fetchData = useCallback(async () => {
        setIsLoading(true);
        setFetchError(null);

        try {
            const subResult = await userApi.getSubscription();

            if (!subResult.ok) {
                setFetchError(
                    translateApiError({
                        error: subResult.error,
                        t,
                        fallback: 'No se pudo cargar la información de suscripción.'
                    })
                );
                return;
            }

            setSubscription(subResult.data.subscription);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        void fetchData();
    }, [fetchData]);

    // ── Actions ────────────────────────────────────────────────────────────

    async function handleDownloadInvoice() {
        setIsDownloading(true);
        try {
            const result = await billingApi.listInvoices({ page: 1, pageSize: 1 });

            if (!result.ok) {
                addToast({
                    type: 'error',
                    message: t(
                        'account.pages.subscription.invoiceError',
                        'No se pudo obtener la última factura.'
                    )
                });
                return;
            }

            const invoices = result.data.items as InvoiceItem[];
            const latest = invoices[0];

            if (!latest) {
                addToast({
                    type: 'info',
                    message: t(
                        'account.pages.subscription.noInvoices',
                        'Todavía no tenés facturas disponibles.'
                    )
                });
                return;
            }

            if (latest.pdfUrl) {
                window.open(latest.pdfUrl, '_blank', 'noreferrer');
            } else {
                addToast({
                    type: 'info',
                    message: t(
                        'account.pages.subscription.invoiceNoPdf',
                        'La factura no tiene un PDF disponible todavía.'
                    )
                });
            }
        } finally {
            setIsDownloading(false);
        }
    }

    async function handlePause() {
        setIsPausing(true);
        try {
            const result = await billingApi.pauseSubscription();
            if (!result.ok) {
                addToast({
                    type: 'error',
                    message: t(
                        'account.pages.subscription.pauseError',
                        'No se pudo pausar la suscripción.'
                    )
                });
                return;
            }
            setShowPauseModal(false);
            addToast({
                type: 'success',
                message: t('account.pages.subscription.pauseSuccess', 'Suscripción pausada.')
            });
            await fetchData();
        } finally {
            setIsPausing(false);
        }
    }

    async function handleResume() {
        setIsPausing(true);
        try {
            const result = await billingApi.resumeSubscription();
            if (!result.ok) {
                addToast({
                    type: 'error',
                    message: t(
                        'account.pages.subscription.resumeError',
                        'No se pudo reanudar la suscripción.'
                    )
                });
                return;
            }
            addToast({
                type: 'success',
                message: t('account.pages.subscription.resumeSuccess', 'Suscripción reanudada.')
            });
            await fetchData();
        } finally {
            setIsPausing(false);
        }
    }

    // ── Render guards ──────────────────────────────────────────────────────

    if (isLoading) {
        return <LoadingState locale={locale} />;
    }

    if (fetchError) {
        return (
            <ErrorState
                locale={locale}
                message={fetchError}
                onRetry={fetchData}
            />
        );
    }

    if (!subscription) {
        return <EmptyState locale={locale} />;
    }

    // ── Derived values ─────────────────────────────────────────────────────

    const status = subscription.status as SubscriptionStatus;
    const badgeClass = getBadgeClass(status);

    const statusLabel = t(
        `account.pages.subscription.status.${status}`,
        status.charAt(0).toUpperCase() + status.slice(1).replace('_', ' ')
    );

    const nextBillingDate = subscription.currentPeriodEnd
        ? formatDate({ date: subscription.currentPeriodEnd, locale })
        : t('account.pages.subscription.noBillingDate', 'N/A');

    const paymentMethodLabel = formatPaymentMethod(
        subscription.paymentMethod,
        t('account.pages.subscription.paymentMercadoPago', 'MercadoPago')
    );

    const plansHref = buildUrl({ locale, path: 'suscriptores/planes' });

    let adminUrl = '';
    try {
        adminUrl = `${getAdminUrl()}/billing/settings`;
    } catch {
        // getAdminUrl throws if env is not configured — fail gracefully
        adminUrl = '';
    }

    const canCancel = status === 'active' || status === 'trial';
    const canPause = status === 'active' || status === 'trial';
    const canResume = status === 'paused';

    // ── JSX ────────────────────────────────────────────────────────────────

    return (
        <div className={styles.root}>
            {/* ── Plan card ── */}
            <section
                className={styles.planCard}
                aria-label={t(
                    'account.pages.subscription.planCardLabel',
                    'Detalles del plan actual'
                )}
            >
                <div className={styles.planHeader}>
                    <h3 className={styles.planName}>{subscription.planName}</h3>
                    <span
                        className={`${styles.badge} ${badgeClass}`}
                        aria-label={`${t('account.pages.subscription.statusLabel', 'Estado')}: ${statusLabel}`}
                    >
                        {statusLabel}
                    </span>
                </div>

                <div className={styles.metaGrid}>
                    <div className={styles.metaItem}>
                        <p className={styles.metaLabel}>
                            {t(
                                'account.pages.subscription.nextBillingLabel',
                                'Próxima facturación'
                            )}
                        </p>
                        <p className={styles.metaValue}>{nextBillingDate}</p>
                    </div>

                    <div className={styles.metaItem}>
                        <p className={styles.metaLabel}>
                            {t('account.pages.subscription.paymentMethodLabel', 'Método de pago')}
                        </p>
                        <p className={styles.metaValue}>{paymentMethodLabel}</p>
                    </div>
                </div>

                <a
                    href={plansHref}
                    className={styles.upgradeLink}
                >
                    <ArrowRightIcon
                        size={16}
                        weight="regular"
                        aria-hidden="true"
                    />
                    {t('account.pages.subscription.upgradeLink', 'Ver planes disponibles')}
                </a>
            </section>

            {/* ── Features card — rendered only when plan features are available ── */}
            {/* TODO: fetch plan features from public /api/v1/public/plans and render here */}

            {/* ── Actions card ── */}
            <section
                className={styles.actionsCard}
                aria-label={t('account.pages.subscription.actionsLabel', 'Acciones')}
            >
                <h3 className={styles.actionsTitle}>
                    {t('account.pages.subscription.actionsTitle', 'Gestionar suscripción')}
                </h3>

                <div className={styles.actionsRow}>
                    {/* Download last invoice */}
                    <button
                        type="button"
                        className={styles.btnSecondary}
                        onClick={() => void handleDownloadInvoice()}
                        disabled={isDownloading}
                        aria-busy={isDownloading}
                    >
                        <DownloadIcon
                            size={16}
                            weight="regular"
                            aria-hidden="true"
                        />
                        {isDownloading
                            ? t('common.loading', 'Cargando...')
                            : t(
                                  'account.pages.subscription.downloadInvoice',
                                  'Descargar última factura'
                              )}
                    </button>

                    {/* Pause subscription (active/trial) */}
                    {canPause && (
                        <button
                            type="button"
                            className={styles.btnSecondary}
                            onClick={() => {
                                setShowPauseModal(true);
                            }}
                            aria-label={t(
                                'account.pages.subscription.pauseAriaLabel',
                                'Pausar suscripción'
                            )}
                        >
                            <PowerOffIcon
                                size={16}
                                weight="regular"
                                aria-hidden="true"
                            />
                            {t('account.pages.subscription.pauseButton', 'Pausar suscripción')}
                        </button>
                    )}

                    {/* Resume subscription (paused) */}
                    {canResume && (
                        <button
                            type="button"
                            className={styles.btnPrimary}
                            onClick={() => void handleResume()}
                            disabled={isPausing}
                            aria-busy={isPausing}
                        >
                            <PlayIcon
                                size={16}
                                weight="regular"
                                aria-hidden="true"
                            />
                            {isPausing
                                ? t('common.loading', 'Cargando...')
                                : t(
                                      'account.pages.subscription.resumeButton',
                                      'Reanudar suscripción'
                                  )}
                        </button>
                    )}

                    {/* Cancel subscription (only when cancellable) */}
                    {canCancel && (
                        <button
                            type="button"
                            className={styles.btnDanger}
                            onClick={() => {
                                setShowCancelModal(true);
                            }}
                            aria-label={t(
                                'account.pages.subscription.cancelAriaLabel',
                                'Cancelar suscripción'
                            )}
                        >
                            <CancelIcon
                                size={16}
                                weight="regular"
                                aria-hidden="true"
                            />
                            {t('account.pages.subscription.cancelButton', 'Cancelar suscripción')}
                        </button>
                    )}

                    {/* Admin escalation (HOST and above) */}
                    {isAdminRole && adminUrl && (
                        <a
                            href={adminUrl}
                            className={styles.btnAdmin}
                            target="_blank"
                            rel="noreferrer noopener"
                        >
                            {t(
                                'account.pages.subscription.adminLink',
                                'Más opciones (panel admin)'
                            )}
                        </a>
                    )}
                </div>
            </section>

            {/* ── Cancel instructions modal (self-cancel pending; SPEC-147) ── */}
            {showCancelModal && (
                <CancelConfirmModal
                    locale={locale}
                    onDismiss={() => {
                        setShowCancelModal(false);
                    }}
                />
            )}

            {/* ── Pause confirmation modal (SPEC-143 #29) ── */}
            {showPauseModal && (
                <PauseConfirmModal
                    locale={locale}
                    isPausing={isPausing}
                    onConfirm={() => void handlePause()}
                    onDismiss={() => {
                        if (!isPausing) setShowPauseModal(false);
                    }}
                />
            )}
        </div>
    );
}
