/**
 * @file PriceAlertButton.tsx
 * @description React island for the "Alert me for price drops" toggle on the
 * accommodation detail page (SPEC-286 T-011).
 *
 * Renders one of four states, resolved from SSR-computed props (see
 * `alojamientos/[slug].astro`) so the correct state is visible on first paint
 * with no loading flash:
 *  - **Locked** — the actor lacks the `PRICE_ALERTS` entitlement (free plan).
 *    Renders a link to the plans page instead of a button; no API call.
 *  - **Max reached** — the actor is entitled but is at their plan's
 *    `MAX_ACTIVE_ALERTS` limit and has no alert for THIS accommodation.
 *    Renders a disabled button with a tooltip.
 *  - **Create** — the actor is entitled, under the limit, and has no alert
 *    for this accommodation. `POST /api/v1/protected/price-alerts` on click,
 *    then optimistically flips to the active state using the created
 *    alert's `id` from the response (needed to support cancelling without a
 *    page reload).
 *  - **Active** — the actor already has an alert for this accommodation
 *    (checked FIRST, ahead of the locked/max-reached branches, so a
 *    downgraded actor still sees "Cancelar alerta" for an alert they already
 *    hold rather than a locked/maxed state that would strand them).
 *    `DELETE /api/v1/protected/price-alerts/:alertId` on click, then flips
 *    back to the create state.
 *
 * All mutating calls go to `/api/v1/protected/price-alerts/*` using plain
 * `fetch` with `credentials: 'include'`, mirroring `AlertsList.client.tsx`
 * (T-010) — no `apiClient` wrapper needed for a same-origin protected island.
 *
 * Hydration: caller MUST use `client:idle` (this is a below-the-fold sidebar
 * action, not needed for first interaction).
 */

import { Spinner } from '@/components/shared/feedback/Spinner';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import { webLogger } from '@/lib/logger';
import { buildUrl } from '@/lib/urls';
import { addToast } from '@/store/toast-store';
import { BellIcon, LockIcon } from '@repo/icons';
import { useCallback, useState } from 'react';
import styles from './PriceAlertButton.module.css';

// ─── Types ────────────────────────────────────────────────────────────────────

/** Successful create response envelope (`POST /api/v1/protected/price-alerts`). */
interface CreateSuccessResponse {
    readonly success: true;
    readonly data?: {
        readonly id?: string;
    };
}

/** Error response envelope shared by all protected endpoints. */
interface ErrorResponse {
    readonly success: false;
    readonly error?: {
        readonly code?: string | null;
        readonly message?: string | null;
    };
}

/** Props for the PriceAlertButton island. */
export interface PriceAlertButtonProps {
    /** The accommodation this button subscribes/unsubscribes alerts for. */
    readonly accommodationId: string;
    /**
     * SSR-resolved: whether the actor already has an active alert for this
     * specific accommodation (not just "has some alert somewhere").
     */
    readonly userHasAlert: boolean;
    /**
     * The ID of the existing alert (required to call `DELETE`). `null` when
     * `userHasAlert` is `false`.
     */
    readonly existingAlertId: string | null;
    /** SSR-resolved: whether the actor's plan includes the `PRICE_ALERTS` entitlement. */
    readonly canCreateAlerts: boolean;
    /**
     * SSR-resolved: whether the actor is at their plan's `MAX_ACTIVE_ALERTS`
     * limit. Only relevant when `userHasAlert` is `false` — an actor who
     * already holds an alert for this accommodation can always cancel it.
     */
    readonly maxReached: boolean;
    /** API base URL (PUBLIC_API_URL from env). */
    readonly apiUrl: string;
    /** Active locale for i18n and the upgrade-link URL. */
    readonly locale: SupportedLocale;
}

/** In-flight mutation kind, for spinner + disabled-state wiring. */
type SubmitPhase = 'idle' | 'creating' | 'cancelling';

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * "Alert me for price drops" toggle island.
 *
 * Resolves its initial rendering branch entirely from SSR props (no client
 * fetch on mount, unlike `AlertsList`) — the accommodation detail page has
 * already computed entitlement/limit/existing-alert state server-side.
 */
export function PriceAlertButton({
    accommodationId,
    userHasAlert,
    existingAlertId,
    canCreateAlerts,
    maxReached,
    apiUrl,
    locale
}: PriceAlertButtonProps) {
    const { t } = createTranslations(locale);
    const base = apiUrl.replace(/\/$/, '');

    // ── State ─────────────────────────────────────────────────────────────────
    // Local mirrors of the SSR props so a successful create/cancel can flip
    // the rendered branch without a page reload.
    const [hasAlert, setHasAlert] = useState(userHasAlert);
    const [alertId, setAlertId] = useState<string | null>(existingAlertId);
    const [phase, setPhase] = useState<SubmitPhase>('idle');
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    const isSubmitting = phase !== 'idle';

    const createErrorMsg = t(
        'accommodations.detail.priceAlert.createError',
        'No se pudo crear la alerta'
    );
    const createSuccessMsg = t('accommodations.detail.priceAlert.createSuccess', 'Alerta creada');
    const cancelErrorMsg = t(
        'accommodations.detail.priceAlert.cancelError',
        'No se pudo cancelar la alerta'
    );
    const cancelSuccessMsg = t(
        'accommodations.detail.priceAlert.cancelSuccess',
        'Alerta cancelada'
    );

    // ── Create ────────────────────────────────────────────────────────────────

    const handleCreate = useCallback(async () => {
        setPhase('creating');
        setErrorMessage(null);
        try {
            const res = await fetch(`${base}/api/v1/protected/price-alerts`, {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ accommodationId })
            });

            if (!res.ok) {
                let message = createErrorMsg;
                try {
                    const body = (await res.json()) as ErrorResponse;
                    message = body.error?.message ?? createErrorMsg;
                } catch {
                    // Non-JSON error body — keep the generic message.
                }
                throw new Error(message);
            }

            const body = (await res.json()) as CreateSuccessResponse;
            setHasAlert(true);
            setAlertId(body.data?.id ?? null);
            addToast({ type: 'success', message: createSuccessMsg });
        } catch (err) {
            webLogger.error('[PriceAlertButton] failed to create price alert', err);
            const message = err instanceof Error ? err.message : createErrorMsg;
            setErrorMessage(message);
            addToast({ type: 'error', message });
        } finally {
            setPhase('idle');
        }
    }, [base, accommodationId, createErrorMsg, createSuccessMsg]);

    // ── Cancel ────────────────────────────────────────────────────────────────

    const handleCancel = useCallback(async () => {
        if (!alertId) return;
        setPhase('cancelling');
        setErrorMessage(null);
        try {
            const res = await fetch(`${base}/api/v1/protected/price-alerts/${alertId}`, {
                method: 'DELETE',
                credentials: 'include'
            });

            if (!res.ok) {
                // Only attempt to parse a body on failure — success is 204.
                let message = cancelErrorMsg;
                try {
                    const body = (await res.json()) as ErrorResponse;
                    message = body.error?.message ?? cancelErrorMsg;
                } catch {
                    // Non-JSON error body — keep the generic message.
                }
                throw new Error(message);
            }

            setHasAlert(false);
            setAlertId(null);
            addToast({ type: 'success', message: cancelSuccessMsg });
        } catch (err) {
            webLogger.error('[PriceAlertButton] failed to cancel price alert', err);
            const message = err instanceof Error ? err.message : cancelErrorMsg;
            setErrorMessage(message);
            addToast({ type: 'error', message });
        } finally {
            setPhase('idle');
        }
    }, [base, alertId, cancelErrorMsg, cancelSuccessMsg]);

    // ── Render ────────────────────────────────────────────────────────────────

    const errorNode = errorMessage && (
        <p
            className={styles.priceAlertError}
            role="alert"
        >
            {errorMessage}
        </p>
    );

    // Active alert for THIS accommodation — checked first so a downgraded
    // actor can still cancel an alert they already hold.
    if (hasAlert) {
        return (
            <div className={styles.priceAlertWrapper}>
                <button
                    type="button"
                    className={styles.priceAlertButtonActive}
                    onClick={() => void handleCancel()}
                    disabled={isSubmitting}
                    aria-busy={isSubmitting}
                >
                    {isSubmitting ? (
                        <Spinner
                            size="sm"
                            label={t(
                                'accommodations.detail.priceAlert.cancelling',
                                'Cancelando...'
                            )}
                        />
                    ) : (
                        t('accommodations.detail.priceAlert.cancel', 'Cancelar alerta')
                    )}
                </button>
                {errorNode}
            </div>
        );
    }

    // Free plan — locked state, links to the plans page, no API call.
    if (!canCreateAlerts) {
        const upgradeHref = buildUrl({ locale, path: 'suscriptores/planes' });
        return (
            <div className={styles.priceAlertWrapper}>
                <a
                    href={upgradeHref}
                    className={styles.priceAlertButtonLocked}
                >
                    <LockIcon
                        size="sm"
                        weight="duotone"
                        aria-hidden="true"
                    />
                    {t('accommodations.detail.priceAlert.locked', 'Avisame si baja el precio')}
                </a>
            </div>
        );
    }

    // Entitled but at the plan's MAX_ACTIVE_ALERTS limit.
    if (maxReached) {
        return (
            <div className={styles.priceAlertWrapper}>
                <button
                    type="button"
                    className={styles.priceAlertButtonDisabled}
                    disabled
                    title={t(
                        'accommodations.detail.priceAlert.maxReached',
                        'Límite de alertas alcanzado'
                    )}
                >
                    <BellIcon
                        size="sm"
                        weight="duotone"
                        aria-hidden="true"
                    />
                    {t('accommodations.detail.priceAlert.create', 'Avisame si baja el precio')}
                </button>
            </div>
        );
    }

    // Entitled, under the limit, no existing alert — the primary create action.
    return (
        <div className={styles.priceAlertWrapper}>
            <button
                type="button"
                className={styles.priceAlertButtonCreate}
                onClick={() => void handleCreate()}
                disabled={isSubmitting}
                aria-busy={isSubmitting}
            >
                {isSubmitting ? (
                    <Spinner
                        size="sm"
                        label={t('accommodations.detail.priceAlert.creating', 'Creando...')}
                    />
                ) : (
                    <>
                        <BellIcon
                            size="sm"
                            weight="duotone"
                            aria-hidden="true"
                        />
                        {t('accommodations.detail.priceAlert.create', 'Avisame si baja el precio')}
                    </>
                )}
            </button>
            {errorNode}
        </div>
    );
}
