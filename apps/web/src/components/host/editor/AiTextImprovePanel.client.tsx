import { SparkleIcon } from '@repo/icons';
import { useCallback, useEffect, useRef } from 'react';
import { AI_TEXT_IMPROVE_ERROR_CODES, useAiTextImprove } from '@/hooks/useAiTextImprove';
/**
 * @file AiTextImprovePanel.client.tsx
 * @description AI text-improvement panel for the web host editor's
 * `description` and `summary` fields (SPEC-321 T-002).
 *
 * Ports the UX pattern of the admin panel
 * (`apps/admin/src/features/accommodations/components/AiTextImprovePanel.tsx`)
 * to the web app's tech stack (CSS Modules instead of Tailwind/Shadcn,
 * `createTranslations` instead of the admin `useTranslations` hook).
 *
 * Renders a trigger button (always visible) and a conditional panel that
 * displays the streaming suggestion, loading skeleton, done state with
 * Accept/Discard, or error state with Dismiss.
 *
 * ## Accessibility
 *
 * - Panel container: `role="region"` (implicit via `<section aria-label>`).
 * - Loading state: `aria-busy="true"` on the skeleton container.
 * - Streaming state: `aria-live="polite"` on the suggestion text area.
 * - Error state: `role="alert"` on the error message container.
 * - Focus management: when the panel opens (status transitions from idle),
 *   focus moves to the panel region element.
 *
 * ## Safety invariant (mid-stream moderation)
 *
 * When the hook transitions to `error` after streaming tokens, the hook
 * itself discards the accumulated suggestion (sets `suggestion = ''`).
 * This component trusts the hook's state — it never displays partial
 * tokens when `status === 'error'`. See `useAiTextImprove`'s own JSDoc
 * for the full invariant, and the test file's CRITICAL case for the
 * UI-level proof.
 *
 * ## Deviation from the admin reference (deliberate — see SPEC-321 T-002)
 *
 * The admin panel takes a `canUse: boolean` prop and DISABLES the trigger
 * (with an upgrade tooltip) when the plan lacks the entitlement. This web
 * panel does NOT replicate that mechanism: entitlement-based hiding is
 * done one level up, by the caller wrapping the whole panel in
 * `<PlanEntitlementGate entitlementKey="ai_text_improve" fallback={null}>`
 * (wired in T-003/T-004) — the acceptance criteria require the trigger to
 * not render at all for non-entitled users, not merely be disabled.
 * Instead, this component exposes a narrower `triggerDisabled` prop for
 * the one gating concern that DOES belong inside it: disabling the
 * trigger when the field is empty (nothing to improve — mirrors the
 * schema's 1-char minimum on `fieldValue`).
 */
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import styles from './AiTextImprovePanel.module.css';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

/** Props for {@link AiTextImprovePanel}. See SPEC-321 T-002. */
export interface AiTextImprovePanelProps {
    /** Which field the panel is attached to. */
    readonly fieldType: 'description' | 'summary';
    /** Current form value at trigger time (sent to the API). */
    readonly fieldValue: string;
    /** Locale for the AI suggestion. Defaults to 'es'. */
    readonly locale?: SupportedLocale;
    /** Called when the HOST accepts a suggestion. Receives the full text. */
    readonly onAccept: (suggestion: string) => void;
    /**
     * Disables the trigger when there is nothing to improve (e.g. the
     * field is empty). Does NOT gate by plan entitlement — that's the
     * caller's responsibility via `<PlanEntitlementGate>`.
     */
    readonly triggerDisabled?: boolean;
    /** Optional className forwarded to the outermost wrapper. */
    readonly className?: string;
}

// ---------------------------------------------------------------------------
// Error-code → i18n key resolver
// ---------------------------------------------------------------------------

/** i18n namespace key prefix for this component's copy. */
const NAMESPACE = 'host.properties.editor.aiTextImprove';

/**
 * Spanish fallback copy per error code, passed as the `t()` fallback
 * argument so the panel still shows a sensible message even before the
 * `host.properties.editor.aiTextImprove.error.*` keys are present in
 * every locale bundle (mirrors the `field.*` fallback convention used
 * throughout this directory, e.g. `BasicInfoSection.client.tsx`).
 */
const ERROR_FALLBACKS: Readonly<Record<string, string>> = Object.freeze({
    VALIDATION_ERROR: 'Solicitud inválida. Por favor recargá la página e intentá de nuevo.',
    UNAUTHORIZED: 'Necesitás iniciar sesión para usar esta función.',
    ENTITLEMENT_REQUIRED:
        'Tu plan no incluye mejora de texto con IA. Actualizá tu plan para acceder.',
    LIMIT_REACHED:
        'Alcanzaste el límite mensual de mejoras con IA. Actualizá tu plan o esperá el próximo mes.',
    MODERATION_BLOCKED:
        'El contenido no pasa las políticas de uso. Tu texto original no fue modificado.',
    RATE_LIMIT_EXCEEDED: 'Demasiadas solicitudes. Esperá un momento e intentá de nuevo.',
    ENGINE_EXHAUSTED:
        'Los proveedores de IA no están disponibles temporalmente. Intentá más tarde.',
    FEATURE_DISABLED: 'La mejora de texto con IA está deshabilitada temporalmente.',
    CEILING_HIT: 'Se alcanzó el límite de costo de IA. Intentá más tarde.',
    SERVICE_UNAVAILABLE: 'Servicio temporalmente no disponible. Intentá más tarde.',
    INTERNAL_ERROR: 'Ocurrió un error inesperado. Tu texto original no fue modificado.',
    NETWORK_INTERRUPTED: 'Se cortó la conexión. Reintentá.',
    default: 'Error al generar la sugerencia. Tu texto original no fue modificado.'
});

/**
 * Maps a hook error code to the corresponding i18n key under the
 * `host.properties.editor.aiTextImprove.error` namespace. Falls back to
 * the `default` key when the code is not one of the known values
 * (defensive — the hook already normalises to `INTERNAL_ERROR` for
 * unknowns).
 */
const resolveErrorI18nKey = (code: string): string => {
    const known = AI_TEXT_IMPROVE_ERROR_CODES as readonly string[];
    if (known.includes(code)) {
        return `${NAMESPACE}.error.${code}`;
    }
    return `${NAMESPACE}.error.default`;
};

/** Resolves the Spanish fallback string for a given (possibly unknown) error code. */
const resolveErrorFallback = (code: string): string =>
    ERROR_FALLBACKS[code] ?? ERROR_FALLBACKS.default;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * AI text-improvement panel. Renders a trigger button and a conditional
 * suggestion panel with streaming display, accept/discard actions, and
 * error handling. See SPEC-321 T-002 for the full design.
 */
export function AiTextImprovePanel({
    fieldType,
    fieldValue,
    locale = 'es',
    onAccept,
    triggerDisabled = false,
    className
}: AiTextImprovePanelProps) {
    const { t } = createTranslations(locale);
    const { status, suggestion, error, improve, accept, discard } = useAiTextImprove();

    // Ref for focus management: when the panel opens, focus the region.
    const panelRef = useRef<HTMLElement>(null);
    const prevStatusRef = useRef(status);

    // Focus the panel region when it transitions from idle to any active state.
    useEffect(() => {
        if (prevStatusRef.current === 'idle' && status !== 'idle' && panelRef.current) {
            panelRef.current.focus();
        }
        prevStatusRef.current = status;
    }, [status]);

    // -----------------------------------------------------------------
    // Handlers
    // -----------------------------------------------------------------

    const handleTrigger = useCallback(() => {
        if (triggerDisabled || status === 'loading' || status === 'streaming') return;
        improve({ fieldType, fieldValue, locale });
    }, [triggerDisabled, status, improve, fieldType, fieldValue, locale]);

    const handleAccept = useCallback(() => {
        const text = accept();
        if (text) {
            onAccept(text);
        }
    }, [accept, onAccept]);

    const handleDiscard = useCallback(() => {
        discard();
    }, [discard]);

    // -----------------------------------------------------------------
    // Derived state
    // -----------------------------------------------------------------

    const isTriggerDisabled = triggerDisabled || status === 'loading' || status === 'streaming';
    const triggerTooltip = triggerDisabled
        ? t(`${NAMESPACE}.emptyFieldTooltip`, 'Escribí un texto para poder mejorarlo con IA.')
        : t(
              `${NAMESPACE}.triggerTooltip`,
              'Obtener una sugerencia de mejora con inteligencia artificial'
          );
    const showPanel = status !== 'idle';

    // -----------------------------------------------------------------
    // Render
    // -----------------------------------------------------------------

    return (
        <div className={[styles.wrapper, className].filter(Boolean).join(' ')}>
            {/* Trigger button — always visible */}
            <button
                type="button"
                className={styles.trigger}
                disabled={isTriggerDisabled}
                title={triggerTooltip}
                onClick={handleTrigger}
                data-testid="ai-text-improve-trigger"
            >
                <SparkleIcon
                    className={styles.triggerIcon}
                    aria-hidden="true"
                />
                {t(`${NAMESPACE}.trigger`, 'Mejorar con IA')}
            </button>

            {/* Panel — rendered only when status !== 'idle' */}
            {showPanel && (
                <section
                    ref={panelRef}
                    aria-label={t(`${NAMESPACE}.panelLabel`, 'Sugerencia de IA')}
                    tabIndex={-1}
                    className={styles.panel}
                    data-testid="ai-text-improve-panel"
                >
                    {/* Loading state */}
                    {status === 'loading' && (
                        <div
                            aria-busy="true"
                            data-testid="ai-text-improve-loading"
                            className={styles.loading}
                        >
                            <div className={styles.skeletonLine} />
                            <div className={styles.skeletonLine} />
                            <div className={styles.skeletonLine} />
                            <span className={styles.loadingText}>
                                {t(`${NAMESPACE}.loading`, 'Generando sugerencia...')}
                            </span>
                        </div>
                    )}

                    {/* Streaming state */}
                    {status === 'streaming' && (
                        <div
                            aria-live="polite"
                            data-testid="ai-text-improve-streaming"
                            className={styles.streaming}
                        >
                            {suggestion}
                            <span
                                className={styles.streamingCursor}
                                aria-hidden="true"
                            >
                                |
                            </span>
                        </div>
                    )}

                    {/* Done state */}
                    {status === 'done' && (
                        <div data-testid="ai-text-improve-done">
                            <div className={styles.doneText}>{suggestion}</div>
                            <div className={styles.doneActions}>
                                <button
                                    type="button"
                                    className={styles.acceptButton}
                                    onClick={handleAccept}
                                    data-testid="ai-text-improve-accept"
                                >
                                    {t(`${NAMESPACE}.accept`, 'Aceptar')}
                                </button>
                                <button
                                    type="button"
                                    className={styles.discardButton}
                                    onClick={handleDiscard}
                                    data-testid="ai-text-improve-discard"
                                >
                                    {t(`${NAMESPACE}.discard`, 'Descartar')}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Error state */}
                    {status === 'error' && (
                        <div data-testid="ai-text-improve-error">
                            <div
                                role="alert"
                                className={styles.errorMessage}
                                data-testid="ai-text-improve-error-message"
                            >
                                {error
                                    ? t(
                                          resolveErrorI18nKey(error.code),
                                          resolveErrorFallback(error.code)
                                      )
                                    : t(`${NAMESPACE}.error.default`, ERROR_FALLBACKS.default)}
                            </div>
                            <div className={styles.errorActions}>
                                <button
                                    type="button"
                                    className={styles.discardButton}
                                    onClick={handleDiscard}
                                    data-testid="ai-text-improve-dismiss"
                                >
                                    {t(`${NAMESPACE}.dismiss`, 'Cerrar')}
                                </button>
                            </div>
                        </div>
                    )}
                </section>
            )}
        </div>
    );
}
