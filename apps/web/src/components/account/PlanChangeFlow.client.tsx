/**
 * @file PlanChangeFlow.client.tsx
 * @description Multi-step plan-change flow modal (SPEC-203 T-005/T-007/T-008).
 *
 * Step 1 — PlanPicker: host selects an upgrade or downgrade target.
 * Step 2 — DowngradePreviewPanel: only for downgrades with excess.
 *           Calls `billingApi.previewDowngrade` to get the preview.
 * Step 3 — Result: handles the three PlanChangeResponse variants.
 *           - `scheduled` → show "plan changes on <date>" success copy.
 *           - `active` → show "plan changed" success copy.
 *           - `pending_payment` → redirect browser to `checkoutUrl`.
 *
 * Rendered inside a modal overlay by `SubscriptionDashboard` (T-009).
 */

import { Spinner } from '@/components/shared/feedback/Spinner';
import { billingApi } from '@/lib/api/endpoints-protected';
import type { PublicPlanData } from '@/lib/billing/fetch-plans';
import { formatDate } from '@/lib/format-utils';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import type { DowngradePreview, KeepSelections, PlanChangeResponse } from '@repo/schemas';
import { useEffect, useRef, useState } from 'react';
import { DowngradePreviewPanel } from './DowngradePreviewPanel.client';
import styles from './PlanChangeFlow.module.css';
import { PlanPicker } from './PlanPicker.client';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Step discriminator for the flow. */
type FlowStep = 'picker' | 'preview' | 'result';

/** Minimal plan selection from PlanPicker. */
interface PlanSelection {
    readonly planId: string;
    readonly planSlug: string;
    readonly billingInterval: 'monthly' | 'annual';
    readonly direction: 'upgrade' | 'downgrade' | 'current';
}

/** Props for the PlanChangeFlow. */
export interface PlanChangeFlowProps {
    /** Full list of available plans (passed from Astro page). */
    readonly plans: readonly PublicPlanData[];
    /** Slug of the host's current plan. */
    readonly currentPlanSlug: string;
    /** Active locale. */
    readonly locale: SupportedLocale;
    /** Called after a non-redirect successful plan change to refresh dashboard. */
    readonly onChanged: () => void;
    /** Called when the host dismisses the flow. */
    readonly onDismiss: () => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Find a plan by slug in the plans list.
 *
 * @param plans - Available plans
 * @param slug - Target slug
 * @returns The matching plan or undefined
 */
function findPlanBySlug(
    plans: readonly PublicPlanData[],
    slug: string
): PublicPlanData | undefined {
    return plans.find((p) => p.slug === slug);
}

// ---------------------------------------------------------------------------
// Result sub-component
// ---------------------------------------------------------------------------

interface FlowResultProps {
    readonly response: PlanChangeResponse;
    readonly locale: SupportedLocale;
    readonly onDismiss: () => void;
}

/** Renders the final result step for scheduled or active changes. */
function FlowResult({ response, locale, onDismiss }: FlowResultProps) {
    const { t } = createTranslations(locale);

    if (response.status === 'scheduled') {
        const formattedDate = formatDate({ date: response.effectiveAt, locale });
        return (
            <div className={styles.result}>
                <div
                    className={styles.resultIcon}
                    aria-hidden="true"
                >
                    <Spinner size="sm" />
                </div>
                <h2 className={styles.resultTitle}>
                    {t(
                        'account.pages.subscription.planChangeFlow.scheduledTitle',
                        'Cambio programado'
                    )}
                </h2>
                <p className={styles.resultBody}>
                    {t(
                        'account.pages.subscription.planChangeFlow.scheduledBody',
                        'Tu plan cambiará el {date}. Hasta entonces, seguís con tu plan actual.'
                    ).replace('{date}', formattedDate)}
                </p>
                {response.restrictionPreview && (
                    <p className={styles.resultHint}>
                        {t(
                            'account.pages.subscription.planChangeFlow.restrictionHint',
                            'Las restricciones se aplicarán en ese momento. El detalle exacto puede variar según tu uso al momento del cambio.'
                        )}
                    </p>
                )}
                <button
                    type="button"
                    className={styles.btnPrimary}
                    onClick={onDismiss}
                >
                    {t('common.close', 'Cerrar')}
                </button>
            </div>
        );
    }

    if (response.status === 'active') {
        return (
            <div className={styles.result}>
                <div
                    className={styles.resultIcon}
                    aria-hidden="true"
                >
                    ✓
                </div>
                <h2 className={styles.resultTitle}>
                    {t('account.pages.subscription.planChangeFlow.activeTitle', 'Plan actualizado')}
                </h2>
                <p className={styles.resultBody}>
                    {t(
                        'account.pages.subscription.planChangeFlow.activeBody',
                        'Tu plan fue cambiado exitosamente.'
                    )}
                </p>
                <button
                    type="button"
                    className={styles.btnPrimary}
                    onClick={onDismiss}
                >
                    {t('common.close', 'Cerrar')}
                </button>
            </div>
        );
    }

    // pending_payment — should redirect; this branch is just a fallback in case
    // the redirect didn't happen (e.g. popup blocked).
    return (
        <div className={styles.result}>
            <p className={styles.resultBody}>
                {t(
                    'account.pages.subscription.planChangeFlow.redirecting',
                    'Redirigiendo al pago...'
                )}
            </p>
        </div>
    );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

/**
 * PlanChangeFlow — multi-step modal for host plan changes.
 *
 * Manages the full plan-change UX: plan selection → optional downgrade preview
 * → API call → result handling (scheduled / active / pending_payment redirect).
 *
 * @param props - {@link PlanChangeFlowProps}
 */
export function PlanChangeFlow({
    plans,
    currentPlanSlug,
    locale,
    onChanged,
    onDismiss
}: PlanChangeFlowProps) {
    const { t } = createTranslations(locale);

    // ── State ───────────────────────────────────────────────────────────────

    const [step, setStep] = useState<FlowStep>('picker');
    const [selectedPlan, setSelectedPlan] = useState<PlanSelection | null>(null);
    const [downgradePreview, setDowngradePreview] = useState<DowngradePreview | null>(null);
    const [result, setResult] = useState<PlanChangeResponse | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const backdropRef = useRef<HTMLDivElement>(null);

    // ── Escape key handler ──────────────────────────────────────────────────

    useEffect(() => {
        function handleKeyDown(e: KeyboardEvent) {
            if (e.key === 'Escape' && !isLoading) {
                onDismiss();
            }
        }
        document.addEventListener('keydown', handleKeyDown);
        return () => {
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [isLoading, onDismiss]);

    // ── Backdrop click handler ──────────────────────────────────────────────

    function handleBackdropClick(e: React.MouseEvent<HTMLDivElement>) {
        if (e.target === backdropRef.current && !isLoading) {
            onDismiss();
        }
    }

    // ── Step 1 → 2 (or submit) ──────────────────────────────────────────────

    async function handlePlanSelect(selection: PlanSelection) {
        setSelectedPlan(selection);
        setError(null);

        if (selection.direction === 'downgrade') {
            // Fetch preview before showing step 2
            setIsLoading(true);
            try {
                const result = await billingApi.previewDowngrade({
                    targetPlan: selection.planSlug
                });

                if (!result.ok) {
                    setError(
                        t(
                            'account.pages.subscription.planChangeFlow.previewError',
                            'No se pudo obtener la vista previa del cambio. Intentá de nuevo.'
                        )
                    );
                    return;
                }

                if (result.data.hasExcess) {
                    setDowngradePreview(result.data);
                    setStep('preview');
                } else {
                    // No excess — skip preview and go straight to confirm
                    await submitPlanChange({ selection, keepSelections: undefined });
                }
            } finally {
                setIsLoading(false);
            }
        } else {
            // Upgrade or no excess — submit directly
            await submitPlanChange({ selection, keepSelections: undefined });
        }
    }

    // ── Step 2 → submit ─────────────────────────────────────────────────────

    async function handlePreviewConfirm(keepSelections: KeepSelections) {
        if (!selectedPlan) return;
        await submitPlanChange({ selection: selectedPlan, keepSelections });
    }

    // ── API call ─────────────────────────────────────────────────────────────

    async function submitPlanChange({
        selection,
        keepSelections
    }: {
        readonly selection: PlanSelection;
        readonly keepSelections: KeepSelections | undefined;
    }) {
        setIsLoading(true);
        setError(null);

        try {
            const apiResult = await billingApi.changePlan({
                newPlanId: selection.planId,
                billingInterval: selection.billingInterval,
                keepSelections
            });

            if (!apiResult.ok) {
                setError(
                    t(
                        'account.pages.subscription.planChangeFlow.changeError',
                        'No se pudo cambiar el plan. Intentá de nuevo.'
                    )
                );
                return;
            }

            const response = apiResult.data;

            if (response.status === 'pending_payment') {
                // Redirect to checkout — no result step needed
                window.location.href = response.checkoutUrl;
                return;
            }

            // scheduled or active — show result step and refresh dashboard
            setResult(response);
            setStep('result');
            onChanged();
        } finally {
            setIsLoading(false);
        }
    }

    // ── Render ───────────────────────────────────────────────────────────────

    const targetPlan = selectedPlan ? findPlanBySlug(plans, selectedPlan.planSlug) : undefined;

    return (
        // biome-ignore lint/a11y/useKeyWithClickEvents: Escape key handler covers keyboard users
        <div
            ref={backdropRef}
            className={styles.backdrop}
            onClick={handleBackdropClick}
        >
            <dialog
                className={styles.modal}
                open
                aria-modal="true"
                aria-labelledby="plan-change-flow-title"
            >
                {/* ── Loading overlay (covers the whole modal during API calls) ── */}
                {isLoading && (
                    <div
                        className={styles.loadingOverlay}
                        aria-live="polite"
                        aria-label={t('common.loading', 'Cargando...')}
                    >
                        <span
                            className={styles.spinner}
                            aria-hidden="true"
                        />
                    </div>
                )}

                {/* ── Global error ── */}
                {error && (
                    <p
                        className={styles.globalError}
                        role="alert"
                    >
                        {error}
                        <button
                            type="button"
                            className={styles.retryLink}
                            onClick={() => {
                                setError(null);
                                setStep('picker');
                            }}
                        >
                            {t('common.retry', 'Reintentar')}
                        </button>
                    </p>
                )}

                {/* ── Step 1: plan picker ── */}
                {step === 'picker' && !error && (
                    <PlanPicker
                        plans={plans}
                        currentPlanSlug={currentPlanSlug}
                        locale={locale}
                        onSelect={(selection) => void handlePlanSelect(selection)}
                        onDismiss={onDismiss}
                    />
                )}

                {/* ── Step 2: downgrade preview ── */}
                {step === 'preview' && downgradePreview && targetPlan && !error && (
                    <DowngradePreviewPanel
                        preview={downgradePreview}
                        targetPlanName={targetPlan.name}
                        locale={locale}
                        onConfirm={(keepSelections) => void handlePreviewConfirm(keepSelections)}
                        onBack={() => setStep('picker')}
                        isPending={isLoading}
                    />
                )}

                {/* ── Step 3: result ── */}
                {step === 'result' && result && (
                    <FlowResult
                        response={result}
                        locale={locale}
                        onDismiss={onDismiss}
                    />
                )}
            </dialog>
        </div>
    );
}
