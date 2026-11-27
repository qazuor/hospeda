/**
 * @file PriceAlertButton.tsx
 * @description React island for the "Alert me for price drops" toggle on the
 * accommodation detail page (SPEC-286 T-011).
 *
 * Auth, entitlement, and existing-alert state are resolved CLIENT-SIDE
 * (HOS-369 WB0-7). The page used to mount this island only for a signed-in
 * visitor and compute the four gate booleans during SSR, which baked the
 * visitor into HTML that must be edge-cacheable. Now the page always mounts it
 * and passes the anonymous variant as slot children.
 *
 * Without a session (and until one resolves) it renders `children` — the
 * sign-in CTA, sized to match this button, so the SSR/cached output is the
 * anonymous variant per D-11 and the swap costs no layout shift.
 *
 * With a session it renders one of two states, resolved by
 * `usePriceAlertGateState`. While that lookup is in flight the create button
 * shows disabled rather than guessing a branch:
 *  - **Create** — the actor has no alert for this accommodation.
 *    `POST /api/v1/protected/price-alerts` on click, then optimistically flips
 *    to the active state using the created alert's `id` from the response
 *    (needed to support cancelling without a page reload). Whether the actor's
 *    plan allows it is the API's decision; a refusal surfaces as the error
 *    toast. The old client-side plan gate (locked upsell, max-reached state)
 *    was removed with the old billing client (HOS-1637, AC:B13a:21).
 *  - **Active** — the actor already has an alert for this accommodation.
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

import { BellIcon, LockIcon } from '@repo/icons';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { CompareUpsellPopover } from '@/components/shared/compare/CompareUpsellPopover.client';
import { Spinner } from '@/components/shared/feedback/Spinner';
import { Dialog, DialogBody, DialogHeader } from '@/components/shared/ui/Dialog.client';
import { PlanBadge } from '@/components/shared/ui/PlanBadge';
import { useAccountPermissions } from '@/hooks/use-account-permissions';
import { usePriceAlertGateState } from '@/hooks/use-price-alert-gate-state';
import { translateApiError } from '@/lib/api-errors';
import { formatDate, formatPrice } from '@/lib/format-utils';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import { webLogger } from '@/lib/logger';
import {
    parsePercentInput,
    parseTargetPriceInput,
    percentFromTargetPrice,
    priceFromPercent,
    toCentavos
} from '@/lib/price-alert-threshold';
import { PRICING_PAGE_PATH_BY_AUDIENCE } from '@/lib/pricing-plans';
import { addToast } from '@/store/toast-store';
import styles from './PriceAlertButton.module.css';

// ─── Types ────────────────────────────────────────────────────────────────────

/** Successful create response envelope (`POST /api/v1/protected/price-alerts`). */
interface CreateSuccessResponse {
    readonly success: true;
    readonly data?: {
        readonly id?: string;
        readonly targetPercentDrop?: number | null;
        readonly basePriceSnapshot?: number | null;
        readonly createdAt?: string;
    };
}

/** Error response envelope shared by all protected endpoints. */
interface ErrorResponse {
    readonly success: false;
    readonly error?: {
        readonly code?: string | null;
        readonly message?: string | null;
        readonly reason?: string | null;
        readonly status?: number;
        readonly details?: unknown;
    };
}

/** Props for the PriceAlertButton island. */
export interface PriceAlertButtonProps {
    /** The accommodation this button subscribes/unsubscribes alerts for. */
    readonly accommodationId: string;
    /** API base URL (PUBLIC_API_URL from env). */
    readonly apiUrl: string;
    /** Active locale for i18n and the upgrade-link URL. */
    readonly locale: SupportedLocale;
    /** Public name of the plan that unlocks this feature. */
    readonly planName?: string | null;
    /** Current listing price in decimal currency units (pesos). Enables the price preview and target-price mode. */
    readonly price?: number | null;
    /** ISO currency of {@link PriceAlertButtonProps.price}; defaults to ARS. */
    readonly currency?: string | null;
}

/** In-flight mutation kind, for spinner + disabled-state wiring. */
type SubmitPhase = 'idle' | 'creating' | 'cancelling';

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * "Alert me for price drops" toggle island.
 *
 * Resolves session and existing-alert state on mount (see
 * `usePriceAlertGateState`) because the page it lives on is edge-cached and can
 * carry no visitor state.
 */
export function PriceAlertButton({
    accommodationId,
    apiUrl,
    locale,
    planName = null,
    price = null,
    currency = null
}: PriceAlertButtonProps) {
    const { t } = createTranslations(locale);
    const base = apiUrl.replace(/\/$/, '');

    // Simple mode (no `initialUser`): `user` starts null, so the anonymous
    // branch is what renders on the server and on first paint.
    const { user } = useAccountPermissions();
    const gate = usePriceAlertGateState({ accommodationId, skip: user === null });
    const entitledBadge = <PlanBadge name={planName} />;
    const gateTrigger = useRef<HTMLButtonElement>(null);
    const titleId = useId();
    const [createOpen, setCreateOpen] = useState(false);
    const [mode, setMode] = useState<'percent' | 'price'>('percent');
    const [target, setTarget] = useState('');
    const [targetPriceText, setTargetPriceText] = useState('');
    const currentCentavos = price !== null && price > 0 ? toCentavos({ amount: price }) : null;
    const money = (centavos: number) =>
        formatPrice({
            amount: Math.floor(centavos / 100),
            currency: currency ?? undefined,
            locale
        });

    // The percentage actually sent to the API, plus what the dialog previews.
    let targetPercentDrop: number | null = null;
    let previewPrice: number | null = null;
    let previewEquivalent: number | null = null;
    let inputError: string | null = null;
    if (mode === 'percent') {
        targetPercentDrop = parsePercentInput({ raw: target });
        if (targetPercentDrop !== null && currentCentavos !== null) {
            previewPrice = priceFromPercent({ currentCentavos, percent: targetPercentDrop });
        } else if (target.trim() !== '' && targetPercentDrop === null) {
            inputError = t('accommodations.detail.priceAlert.errorPercent');
        }
    } else if (currentCentavos !== null && targetPriceText.trim() !== '') {
        const targetCentavos = parseTargetPriceInput({ raw: targetPriceText });
        const result =
            targetCentavos === null
                ? ({ ok: false, reason: 'not_positive' } as const)
                : percentFromTargetPrice({ currentCentavos, targetCentavos });
        if (result.ok) {
            targetPercentDrop = result.percent;
            previewEquivalent = result.percent;
            previewPrice = result.thresholdCentavos;
        } else if (result.reason === 'not_positive') {
            inputError = t('accommodations.detail.priceAlert.errorPriceInvalid');
        } else if (result.reason === 'not_below_current') {
            inputError = t('accommodations.detail.priceAlert.errorPriceNotBelow', undefined, {
                price: money(currentCentavos)
            });
        } else {
            inputError = t('accommodations.detail.priceAlert.errorPriceTooClose', undefined, {
                price: money(priceFromPercent({ currentCentavos, percent: 1 }))
            });
        }
    }
    const validTarget = targetPercentDrop !== null;

    // ── State ─────────────────────────────────────────────────────────────────
    // Local mirrors of the resolved gate so a successful create/cancel can flip
    // the rendered branch without a page reload.
    const [hasAlert, setHasAlert] = useState(false);
    const [alertId, setAlertId] = useState<string | null>(null);
    const [threshold, setThreshold] = useState<number | null>(null);
    const [baseSnapshot, setBaseSnapshot] = useState<number | null>(null);
    const [createdAt, setCreatedAt] = useState<Date | string | null>(null);
    const [phase, setPhase] = useState<SubmitPhase>('idle');
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [vipGateOpen, setVipGateOpen] = useState(false);

    // Adopt the resolved lookup once it settles. Deliberately keyed on the
    // settled snapshot only: a mutation that already flipped the local mirror
    // must not be undone by a late-arriving resolution of the pre-mutation
    // state, and `usePriceAlertGateState` never re-runs after it settles.
    useEffect(() => {
        if (gate.isResolving) return;
        setHasAlert(gate.hasAlert);
        setAlertId(gate.alertId);
        setThreshold(gate.targetPercentDrop);
        setBaseSnapshot(gate.basePriceSnapshot);
        setCreatedAt(gate.createdAt);
    }, [
        gate.isResolving,
        gate.hasAlert,
        gate.alertId,
        gate.targetPercentDrop,
        gate.basePriceSnapshot,
        gate.createdAt
    ]);

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
        if (
            !validTarget ||
            !user ||
            gate.readFailed ||
            !gate.canCreateAlerts ||
            gate.maxReached ||
            isSubmitting
        )
            return;
        setPhase('creating');
        setErrorMessage(null);
        try {
            const res = await fetch(`${base}/api/v1/protected/price-alerts`, {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ accommodationId, targetPercentDrop })
            });

            if (!res.ok) {
                let message = createErrorMsg;
                try {
                    const body = (await res.json()) as ErrorResponse;
                    message = translateApiError({
                        error: {
                            code: body.error?.code,
                            reason: body.error?.reason,
                            status: body.error?.status ?? res.status,
                            details: body.error?.details
                        },
                        locale,
                        fallback: createErrorMsg
                    });
                } catch {
                    // Non-JSON error body — keep the generic message.
                }
                throw new Error(message);
            }

            const body = (await res.json()) as CreateSuccessResponse;
            setHasAlert(true);
            setAlertId(body.data?.id ?? null);
            setThreshold(body.data?.targetPercentDrop ?? null);
            setBaseSnapshot(body.data?.basePriceSnapshot ?? null);
            setCreatedAt(body.data?.createdAt ?? null);
            setCreateOpen(false);
            addToast({ type: 'success', message: createSuccessMsg });
        } catch (err) {
            webLogger.error('[PriceAlertButton] failed to create price alert', err);
            const message = err instanceof Error ? err.message : createErrorMsg;
            setErrorMessage(message);
            addToast({ type: 'error', message });
        } finally {
            setPhase('idle');
        }
    }, [
        base,
        accommodationId,
        createErrorMsg,
        createSuccessMsg,
        locale,
        user,
        gate.readFailed,
        gate.canCreateAlerts,
        gate.maxReached,
        isSubmitting,
        targetPercentDrop,
        validTarget
    ]);

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
                    message = translateApiError({
                        error: {
                            code: body.error?.code,
                            reason: body.error?.reason,
                            status: body.error?.status ?? res.status,
                            details: body.error?.details
                        },
                        locale,
                        fallback: cancelErrorMsg
                    });
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
    }, [base, alertId, cancelErrorMsg, cancelSuccessMsg, locale]);

    // ── Render ────────────────────────────────────────────────────────────────

    const errorNode = errorMessage && (
        <p
            className={styles.priceAlertError}
            role="alert"
        >
            {errorMessage}
        </p>
    );

    // Active alert for THIS accommodation.
    if (user && hasAlert) {
        return (
            <div className={styles.priceAlertWrapper}>
                <div className={styles.priceAlertStatus}>
                    <p>
                        {threshold === null
                            ? t('accommodations.detail.priceAlert.defaultThreshold')
                            : baseSnapshot === null
                              ? t('accommodations.detail.priceAlert.activeThreshold', undefined, {
                                    threshold
                                })
                              : t(
                                    'accommodations.detail.priceAlert.activeThresholdPrice',
                                    undefined,
                                    {
                                        percent: threshold,
                                        price: money(
                                            priceFromPercent({
                                                currentCentavos: baseSnapshot,
                                                percent: threshold
                                            })
                                        )
                                    }
                                )}
                    </p>
                    {createdAt && (
                        <p>
                            {t('accommodations.detail.priceAlert.activeDate', undefined, {
                                date: formatDate({
                                    date: createdAt,
                                    locale,
                                    options: { dateStyle: 'medium', timeZone: 'UTC' }
                                })
                            })}
                        </p>
                    )}
                </div>
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
                {entitledBadge}
            </div>
        );
    }

    // Signed in, but the alert lookup has not settled yet. Show the create
    // button disabled rather than guessing: enabling it could fire a duplicate
    // create for an alert the visitor already holds.
    if (user && gate.isResolving) {
        return (
            <div className={styles.priceAlertWrapper}>
                <button
                    type="button"
                    className={styles.priceAlertButtonDisabled}
                    disabled
                    aria-busy="true"
                >
                    <BellIcon
                        size="sm"
                        weight="duotone"
                        aria-hidden="true"
                    />
                    {t('accommodations.detail.priceAlert.create', 'Avisame si baja el precio')}
                    {entitledBadge}
                </button>
            </div>
        );
    }

    if (!user || gate.readFailed || !gate.canCreateAlerts) {
        return (
            <div className={styles.priceAlertWrapper}>
                <button
                    type="button"
                    ref={gateTrigger}
                    className={styles.priceAlertButtonCreate}
                    onClick={() => setVipGateOpen((open) => !open)}
                    aria-haspopup="dialog"
                    aria-expanded={vipGateOpen}
                >
                    <LockIcon
                        size="sm"
                        aria-hidden="true"
                    />
                    {t('accommodations.detail.priceAlert.locked', 'Avisame si baja el precio')}
                    {entitledBadge}
                </button>
                <p className={styles.priceAlertLockedHint}>
                    {t('accommodations.detail.priceAlert.lockedHint', 'Disponible con Turista VIP')}
                </p>
                {vipGateOpen && (
                    <CompareUpsellPopover
                        anchorRef={gateTrigger}
                        onClose={() => setVipGateOpen(false)}
                        dialogLabel={t('accommodations.detail.priceAlert.gateTitle')}
                        message={
                            planName
                                ? t('accommodations.detail.priceAlert.gateBenefit', undefined, {
                                      plan: planName
                                  })
                                : t('common.vipGate.priceAlert')
                        }
                        ctaLabel={t('accommodations.comparison.gate.upsellCta')}
                        ctaHref={`/${locale}/${PRICING_PAGE_PATH_BY_AUDIENCE.tourist}/`}
                        closeLabel={t('common.auth.close')}
                        dismissLabel={t('common.vipGate.notNow')}
                    />
                )}
            </div>
        );
    }

    if (gate.maxReached) {
        return (
            <div className={styles.priceAlertWrapper}>
                <button
                    type="button"
                    className={styles.priceAlertButtonDisabled}
                    disabled
                >
                    {t(
                        'accommodations.detail.priceAlert.maxReached',
                        'Límite de alertas alcanzado'
                    )}
                </button>
                {entitledBadge}
            </div>
        );
    }

    // No existing alert — a secondary action alongside the contact CTA.
    return (
        <div className={styles.priceAlertWrapper}>
            <button
                type="button"
                className={styles.priceAlertButtonCreate}
                onClick={() => {
                    setTarget('');
                    setTargetPriceText('');
                    setMode('percent');
                    setErrorMessage(null);
                    setCreateOpen(true);
                }}
                aria-haspopup="dialog"
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
            <Dialog
                isOpen={createOpen}
                onClose={() => setCreateOpen(false)}
                ariaLabelledBy={titleId}
                size="sm"
            >
                <DialogHeader
                    titleId={titleId}
                    onClose={() => setCreateOpen(false)}
                    closeLabel={t('common.auth.close')}
                >
                    {t('accommodations.detail.priceAlert.confirmCreate')}
                </DialogHeader>
                <DialogBody>
                    <form
                        className={styles.priceAlertWrapper}
                        onSubmit={(event) => {
                            event.preventDefault();
                            void handleCreate();
                        }}
                    >
                        {currentCentavos !== null && (
                            <>
                                <p className={styles.priceAlertCurrent}>
                                    {t('accommodations.detail.priceAlert.currentPrice', undefined, {
                                        price: money(currentCentavos)
                                    })}
                                </p>
                                <fieldset className={styles.priceAlertModes}>
                                    <legend className={styles.priceAlertModesLegend}>
                                        {t('accommodations.detail.priceAlert.modeLabel')}
                                    </legend>
                                    {(['percent', 'price'] as const).map((value) => (
                                        <label
                                            key={value}
                                            className={styles.priceAlertMode}
                                        >
                                            <input
                                                type="radio"
                                                name={`${titleId}-mode`}
                                                value={value}
                                                checked={mode === value}
                                                onChange={() => setMode(value)}
                                            />
                                            {t(
                                                value === 'percent'
                                                    ? 'accommodations.detail.priceAlert.modePercent'
                                                    : 'accommodations.detail.priceAlert.modePrice'
                                            )}
                                        </label>
                                    ))}
                                </fieldset>
                            </>
                        )}
                        {mode === 'percent' || currentCentavos === null ? (
                            <label>
                                {t('accommodations.detail.priceAlert.targetPercent')}{' '}
                                <input
                                    type="number"
                                    min={1}
                                    max={100}
                                    step={1}
                                    required
                                    value={target}
                                    aria-invalid={inputError !== null}
                                    onChange={(event) => setTarget(event.currentTarget.value)}
                                />
                            </label>
                        ) : (
                            <label>
                                {t('accommodations.detail.priceAlert.targetPrice')}{' '}
                                <input
                                    type="text"
                                    inputMode="decimal"
                                    required
                                    value={targetPriceText}
                                    aria-invalid={inputError !== null}
                                    onChange={(event) =>
                                        setTargetPriceText(event.currentTarget.value)
                                    }
                                />
                            </label>
                        )}
                        <div
                            className={styles.priceAlertPreview}
                            aria-live="polite"
                        >
                            {previewEquivalent !== null && (
                                <p>
                                    {t(
                                        'accommodations.detail.priceAlert.previewEquivalent',
                                        undefined,
                                        { percent: previewEquivalent }
                                    )}
                                </p>
                            )}
                            {previewPrice !== null && (
                                <p>
                                    {t('accommodations.detail.priceAlert.previewPrice', undefined, {
                                        price: money(previewPrice)
                                    })}
                                </p>
                            )}
                            {inputError && (
                                <p
                                    className={styles.priceAlertError}
                                    role="alert"
                                >
                                    {inputError}
                                </p>
                            )}
                        </div>
                        <button
                            type="submit"
                            className={styles.priceAlertButtonCreate}
                            disabled={isSubmitting || !validTarget}
                        >
                            {t('accommodations.detail.priceAlert.confirmCreate')}
                        </button>
                        {errorNode}
                    </form>
                </DialogBody>
            </Dialog>
            {entitledBadge}
        </div>
    );
}
