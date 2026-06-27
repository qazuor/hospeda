/**
 * @file SubscriptionDashboard.client.tsx
 * @description React island for the user subscription dashboard at /mi-cuenta/suscripcion/.
 *
 * Displays the current plan, status badge, next billing date, payment method,
 * and plan features. Provides cancel and invoice download actions.
 * SUPER_ADMIN sees an additional admin escalation button.
 */

import { translateApiError } from '@/lib/api-errors';
import { billingApi, userApi } from '@/lib/api/endpoints-protected';
import type { InvoiceItem, SubscriptionData } from '@/lib/api/endpoints-protected';
import type { PublicPlanData } from '@/lib/billing/fetch-plans';
import { getAdminUrl } from '@/lib/env';
import { formatDate } from '@/lib/format-utils';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import { buildUrl } from '@/lib/urls';
import { addToast } from '@/store/toast-store';
import { ArrowRightIcon, CancelIcon, DownloadIcon, PlayIcon, PowerOffIcon } from '@repo/icons';
import { useCallback, useEffect, useState } from 'react';
import { PlanChangeFlow } from './PlanChangeFlow.client';
import styles from './SubscriptionDashboard.module.css';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Roles that may see the admin-panel escalation link.
 *
 * The link points at the admin `/billing/settings` route, which is guarded by
 * `requireBillingAccess` (`BILLING_READ_ALL`). Per SPEC-164 that permission is
 * granted to SUPER_ADMIN only (every other role — including ADMIN,
 * CLIENT_MANAGER, EDITOR, HOST, SPONSOR — is bounced to `/auth/forbidden`), so
 * the link is shown to SUPER_ADMIN exclusively to match who can actually load
 * the route.
 */
const BILLING_ADMIN_ROLES = new Set(['SUPER_ADMIN']);

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
    /**
     * Available billing plans passed from the Astro page (fetched server-side).
     * When provided, enables the "Change plan" flow (T-005/007/008/009).
     * When absent, the legacy plain anchor to the pricing page is shown.
     */
    readonly plans?: readonly PublicPlanData[];
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

/** Possible UI states for the cancel modal flow. */
type CancelModalStep = 'confirm' | 'success' | 'flag_off';

/**
 * Cancel confirmation modal (SPEC-147 / SPEC-203 T-006).
 *
 * Calls the soft-cancel API (`POST /subscriptions/:id/cancel`). On success
 * shows a confirmation with the access-until date. On 404 (feature flag off)
 * degrades gracefully to the email-support path. On other errors shows a
 * retryable error state.
 */
function CancelConfirmModal({
    locale,
    subscriptionId,
    accessUntilFallback,
    onDismiss,
    onCancelled
}: {
    readonly locale: SupportedLocale;
    readonly subscriptionId: string;
    /** currentPeriodEnd from the subscription — used in the success copy if
     *  the API accessUntil is not yet available. */
    readonly accessUntilFallback: string | null;
    readonly onDismiss: () => void;
    /** Called after a successful API cancel so the parent can refresh data. */
    readonly onCancelled: () => void;
}) {
    const { t } = createTranslations(locale);

    const [step, setStep] = useState<CancelModalStep>('confirm');
    const [reason, setReason] = useState('');
    const [isCancelling, setIsCancelling] = useState(false);
    const [cancelError, setCancelError] = useState<string | null>(null);
    const [accessUntil, setAccessUntil] = useState<string | null>(null);

    // Close on backdrop click — only when not mid-flight
    function handleBackdropClick(e: React.MouseEvent<HTMLDivElement>) {
        if (e.target === e.currentTarget && !isCancelling) {
            onDismiss();
        }
    }

    // Close on Escape key — only when not mid-flight
    useEffect(() => {
        function handleKeyDown(e: KeyboardEvent) {
            if (e.key === 'Escape' && !isCancelling) {
                onDismiss();
            }
        }
        document.addEventListener('keydown', handleKeyDown);
        return () => {
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [onDismiss, isCancelling]);

    async function handleConfirm() {
        setIsCancelling(true);
        setCancelError(null);

        try {
            const result = await billingApi.cancelSubscription({
                subscriptionId,
                reason: reason.trim() || undefined
            });

            if (!result.ok) {
                // 404 means the feature flag HOSPEDA_USER_CANCEL_ENABLED is OFF —
                // degrade gracefully to the email-support path.
                if (result.error.status === 404) {
                    setStep('flag_off');
                    return;
                }
                // Other errors (5xx, network) — show a retryable error.
                setCancelError(
                    t(
                        'account.pages.subscription.cancelModal.cancelError',
                        'No se pudo cancelar la suscripción. Intentá de nuevo.'
                    )
                );
                return;
            }

            // Success path — record the access-until date and switch to success step.
            const until = result.data.accessUntil
                ? formatDate({ date: result.data.accessUntil.toString(), locale })
                : accessUntilFallback
                  ? formatDate({ date: accessUntilFallback, locale })
                  : null;
            setAccessUntil(until);
            setStep('success');
            onCancelled();
        } finally {
            setIsCancelling(false);
        }
    }

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

                {/* ── confirm step ── */}
                {step === 'confirm' && (
                    <>
                        <p className={styles.modalBody}>
                            {t(
                                'account.pages.subscription.cancelModal.description',
                                'Al cancelar tu suscripción mantenés el acceso a tu plan hasta el final del período actual. No se realizarán más cobros.'
                            )}
                        </p>

                        <div className={styles.modalField}>
                            <label
                                htmlFor="cancel-reason"
                                className={styles.modalLabel}
                            >
                                {t(
                                    'account.pages.subscription.cancelModal.reasonLabel',
                                    'Motivo de cancelación (opcional)'
                                )}
                            </label>
                            <textarea
                                id="cancel-reason"
                                className={styles.modalTextarea}
                                rows={3}
                                maxLength={500}
                                value={reason}
                                onChange={(e) => setReason(e.target.value)}
                                placeholder={t(
                                    'account.pages.subscription.cancelModal.reasonPlaceholder',
                                    'Contanos por qué cancelás para poder mejorar...'
                                )}
                                disabled={isCancelling}
                            />
                        </div>

                        {cancelError && (
                            <p
                                className={styles.modalError}
                                role="alert"
                                aria-live="polite"
                            >
                                {cancelError}
                            </p>
                        )}

                        <div className={styles.modalActions}>
                            <button
                                type="button"
                                className={styles.btnSecondary}
                                onClick={onDismiss}
                                disabled={isCancelling}
                            >
                                {t('common.cancel', 'Cancelar')}
                            </button>
                            <button
                                type="button"
                                className={styles.btnDanger}
                                onClick={() => void handleConfirm()}
                                disabled={isCancelling}
                                aria-busy={isCancelling}
                            >
                                {isCancelling
                                    ? t('common.loading', 'Cargando...')
                                    : t(
                                          'account.pages.subscription.cancelModal.confirm',
                                          'Sí, cancelar suscripción'
                                      )}
                            </button>
                        </div>
                    </>
                )}

                {/* ── success step ── */}
                {step === 'success' && (
                    <>
                        <p className={styles.modalBody}>
                            {accessUntil
                                ? t(
                                      'account.pages.subscription.cancelModal.successBody',
                                      'Tu suscripción fue cancelada. Seguís teniendo acceso hasta el {date}.'
                                  ).replace('{date}', accessUntil)
                                : t(
                                      'account.pages.subscription.cancelModal.successTitle',
                                      'Suscripción cancelada'
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
                        </div>
                    </>
                )}

                {/* ── flag_off step: feature flag disabled — degrade to email ── */}
                {step === 'flag_off' && (
                    <>
                        <p className={styles.modalBody}>
                            {t(
                                'account.pages.subscription.cancelModal.flagOffFallback',
                                'La cancelación en línea no está disponible en este momento. Por favor, contactá a soporte para cancelar tu suscripción.'
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
                    </>
                )}
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
 * - Admin escalation button for SUPER_ADMIN
 *
 * @param props - {@link SubscriptionDashboardProps}
 */
export function SubscriptionDashboard({ locale, user, plans }: SubscriptionDashboardProps) {
    const { t } = createTranslations(locale);

    // ── State ──────────────────────────────────────────────────────────────

    const [subscription, setSubscription] = useState<SubscriptionData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [fetchError, setFetchError] = useState<string | null>(null);
    const [showCancelModal, setShowCancelModal] = useState(false);
    const [showPauseModal, setShowPauseModal] = useState(false);
    const [showPlanChangeFlow, setShowPlanChangeFlow] = useState(false);
    const [isPausing, setIsPausing] = useState(false);
    const [isDownloading, setIsDownloading] = useState(false);

    const isBillingAdmin = BILLING_ADMIN_ROLES.has(user.role);

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

    /**
     * Silent background refresh — updates subscription data WITHOUT setting
     * `isLoading=true`. Used after a successful cancel so the cancel modal's
     * success step stays mounted (isLoading=true would unmount the whole
     * dashboard and reset the modal's internal step state to 'confirm').
     */
    const refreshSilently = useCallback(async () => {
        try {
            const subResult = await userApi.getSubscription();
            if (subResult.ok) {
                setSubscription(subResult.data.subscription);
            }
            // Silently swallow errors — the visible data stays stale until the
            // user navigates away or retries via the normal fetchData path.
        } catch {
            // Network errors are intentionally swallowed here.
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

                {/* ── Scheduled plan-change banner (T-004) ── */}
                {subscription.scheduledPlanChange && (
                    <div
                        className={styles.scheduledChangeBanner}
                        role="note"
                        aria-label={t(
                            'account.pages.subscription.scheduledChange.title',
                            'Cambio de plan programado'
                        )}
                    >
                        <div>
                            <p className={styles.scheduledChangeBannerTitle}>
                                {t(
                                    'account.pages.subscription.scheduledChange.title',
                                    'Cambio de plan programado'
                                )}
                            </p>
                            <p className={styles.scheduledChangeBannerBody}>
                                {t(
                                    'account.pages.subscription.scheduledChange.body',
                                    'Tu plan cambiará a {plan} el {date}.'
                                )
                                    .replace(
                                        '{plan}',
                                        // Resolve the raw plan ID to a human-readable name.
                                        // Match by id (UUID) first, fall back to slug, then
                                        // use the raw value when the plans list is absent.
                                        (plans ?? []).find(
                                            (p) =>
                                                p.id ===
                                                    subscription.scheduledPlanChange?.newPlanId ||
                                                p.slug ===
                                                    subscription.scheduledPlanChange?.newPlanId
                                        )?.name ?? subscription.scheduledPlanChange.newPlanId
                                    )
                                    .replace(
                                        '{date}',
                                        formatDate({
                                            date: subscription.scheduledPlanChange.effectiveAt,
                                            locale
                                        })
                                    )}
                            </p>
                        </div>
                    </div>
                )}

                {plans && plans.length > 0 ? (
                    <button
                        type="button"
                        className={styles.btnSecondary}
                        onClick={() => {
                            setShowPlanChangeFlow(true);
                        }}
                        aria-label={t(
                            'account.pages.subscription.changePlanAriaLabel',
                            'Cambiar plan de suscripción'
                        )}
                    >
                        <ArrowRightIcon
                            size={16}
                            weight="regular"
                            aria-hidden="true"
                        />
                        {t('account.pages.subscription.changePlanButton', 'Cambiar plan')}
                    </button>
                ) : (
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
                )}
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

                    {/* Admin escalation (SUPER_ADMIN only — see BILLING_ADMIN_ROLES) */}
                    {isBillingAdmin && adminUrl && (
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

            {/* ── Cancel confirmation modal (SPEC-147 / SPEC-203 T-006) ── */}
            {showCancelModal && (
                <CancelConfirmModal
                    locale={locale}
                    subscriptionId={subscription.id}
                    accessUntilFallback={subscription.currentPeriodEnd}
                    onDismiss={() => {
                        setShowCancelModal(false);
                    }}
                    onCancelled={() => {
                        // Use silent refresh (no loading spinner) so the modal's
                        // success step stays mounted and visible to the user.
                        // fetchData() would set isLoading=true which unmounts the
                        // entire dashboard and resets the modal step to 'confirm'.
                        void refreshSilently();
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

            {/* ── Plan-change flow modal (SPEC-203 T-005/T-007/T-008/T-009) ── */}
            {showPlanChangeFlow && plans && plans.length > 0 && subscription && (
                <PlanChangeFlow
                    plans={plans}
                    currentPlanSlug={subscription.planSlug}
                    locale={locale}
                    onChanged={() => {
                        // Silent refresh (no loading spinner) so the flow's result
                        // step stays mounted. fetchData() would set isLoading=true,
                        // unmount the dashboard, and reset PlanChangeFlow's internal
                        // step back to 'picker' — making a just-confirmed change look
                        // like nothing happened. Mirrors the cancel-modal path.
                        void refreshSilently();
                    }}
                    onDismiss={() => {
                        setShowPlanChangeFlow(false);
                    }}
                />
            )}
        </div>
    );
}
