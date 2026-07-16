/**
 * @file PublishButton.client.tsx
 * @description React island that renders a "Publicar" primary button with an
 * inline confirmation step.
 *
 * Flow:
 *  1. Idle  → shows the "Publicar" button.
 *  2. Click → swaps to inline confirmation with "[Sí, publicar] [Cancelar]".
 *  3. Confirm (Sí) → calls POST /api/v1/protected/accommodations/:id/publish,
 *                    disables UI while pending. A dedicated `/publish`
 *                    endpoint is used instead of the generic update PATCH
 *                    because the update schema strips `lifecycleState`,
 *                    which made the naive approach a silent no-op.
 *  4. Success → reloads the page via window.location.reload() so the card
 *               re-renders with the new ACTIVE status.
 *  5. Error   → shows inline error message, re-enables the button. Two
 *               failures get a dedicated banner instead, because retrying
 *               them changes nothing: `403 subscription_required` (no active
 *               plan — links to the plans page) and `400 VALIDATION_ERROR`
 *               (the HOS-152 capacity-completeness guard, when
 *               `capacity`/`minNights`/`bedrooms`/`bathrooms` are missing —
 *               links to the editor).
 *  6. No (cancel) → returns to step 1.
 *
 * ## Publishing does NOT start a trial (HOS-171)
 *
 * It used to: publishing granted a no-card trial via `TrialService.startTrial()`,
 * and the confirmation step existed to announce it ("14 días gratis al publicar.
 * Sin tarjeta, sin compromiso"). Card-first moved the trial onto the MercadoPago
 * preapproval the CHECKOUT creates, so publishing now requires an active
 * subscription and rejects without one. The confirm copy no longer promises
 * anything about billing, and `subscriptionRequired` went from an edge case (only
 * an owner who had burnt their one trial) to the normal first-publish outcome for
 * any owner without a plan — so its copy must not claim they already used a trial.
 *
 * Mirrors UnpublishButton.client.tsx / DeleteButton.client.tsx (same
 * inline-confirm UX), but uses a positive (green) accent for the confirm
 * button instead of the danger red.
 *
 * @example
 * ```astro
 * <PublishButton
 *   client:load
 *   accommodationId={property.id}
 *   locale={locale}
 *   label={t('host.properties.card.actions.publish', 'Publicar')}
 *   confirmTitle={t('host.properties.card.actions.publishConfirmTitle', '...')}
 *   confirmNote={t('host.properties.card.actions.publishConfirmNote', '...')}
 *   confirmYes={t('host.properties.card.actions.publishYes', 'Sí, publicar')}
 *   confirmNo={t('host.properties.card.actions.confirmNo', 'Cancelar')}
 *   errorText={t('host.properties.card.publishError', '...')}
 *   subscriptionRequiredMessage={t('host.properties.card.publishSubscriptionRequiredMessage', '...')}
 *   subscriptionRequiredCta={t('host.properties.card.publishSubscriptionRequiredCta', 'Ver planes')}
 *   incompleteCapacityMessage={t('host.properties.card.publishIncompleteCapacityMessage', '...')}
 *   incompleteCapacityCta={t('host.properties.card.publishIncompleteCapacityCta', 'Completar en el editor')}
 * />
 * ```
 */

import { type JSX, useState } from 'react';
import { accommodationEditApi } from '@/lib/api/endpoints-protected';
import type { SupportedLocale } from '@/lib/i18n';
import { buildUrl } from '@/lib/urls';
import styles from './PublishButton.module.css';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** State machine for the publish button. */
type PublishState =
    | 'idle'
    | 'confirming'
    | 'pending'
    | 'error'
    | 'subscriptionRequired'
    | 'incompleteCapacity';

/**
 * Props for the PublishButton component.
 */
export interface PublishButtonProps {
    /** The accommodation ID to publish (DRAFT → ACTIVE). */
    readonly accommodationId: string;
    /** Current locale, used to build the plans-page link on `subscription_required`. */
    readonly locale: SupportedLocale;
    /** Label for the main primary button (already-translated string). */
    readonly label: string;
    /** Bold headline shown in the confirmation step (already-translated). */
    readonly confirmTitle: string;
    /** Trial-explainer note shown under the headline (already-translated). */
    readonly confirmNote: string;
    /** Label for the "Yes, publish" confirm button (already-translated). */
    readonly confirmYes: string;
    /** Label for the "Cancel" button (already-translated). */
    readonly confirmNo: string;
    /** Error message shown on generic API failure (already-translated). */
    readonly errorText: string;
    /**
     * Message shown when publish fails because the owner has no active
     * subscription (`403 subscription_required`, already-translated). Since
     * HOS-171 this is the normal outcome of a first publish, not an edge case.
     */
    readonly subscriptionRequiredMessage: string;
    /** Label for the link to the plans page in that same case (already-translated). */
    readonly subscriptionRequiredCta: string;
    /**
     * Message shown when publish fails because the accommodation's capacity
     * details are incomplete (`400` from the capacity-completeness guard —
     * HOS-152 — missing `capacity`/`minNights`/`bedrooms`/`bathrooms`,
     * already-translated).
     */
    readonly incompleteCapacityMessage: string;
    /** Label for the link to the editor in that same case (already-translated). */
    readonly incompleteCapacityCta: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * PublishButton — guided publish action island for transitioning DRAFT → ACTIVE.
 *
 * Renders inline without an external CSS module leaking into PropertyCard's
 * scoped styles (this React island carries no `data-astro-*` hash), so its
 * own module mirrors the sibling `.prop-card__action` look.
 *
 * @param props - See `PublishButtonProps`.
 */
export function PublishButton({
    accommodationId,
    locale,
    label,
    confirmTitle,
    confirmNote,
    confirmYes,
    confirmNo,
    errorText,
    subscriptionRequiredMessage,
    subscriptionRequiredCta,
    incompleteCapacityMessage,
    incompleteCapacityCta
}: PublishButtonProps): JSX.Element {
    const [state, setState] = useState<PublishState>('idle');
    const [apiError, setApiError] = useState<string | null>(null);

    /** User clicked the main "Publicar" button → enter confirmation mode. */
    function handleRequestConfirm(): void {
        setApiError(null);
        setState('confirming');
    }

    /** User clicked "No" / Cancel → return to idle. */
    function handleCancel(): void {
        setState('idle');
        setApiError(null);
    }

    /** User clicked "Sí, publicar" → call the API. */
    async function handleConfirm(): Promise<void> {
        setState('pending');
        setApiError(null);

        const result = await accommodationEditApi.publish({ id: accommodationId });

        if (!result.ok) {
            // The owner has no active subscription. Route them to the plans page
            // instead of a generic "try again" — retrying is pointless. Since
            // HOS-171 (publishing requires a card) this is the ordinary path for
            // a first publish, not just for someone who burnt their trial.
            if (result.error.status === 403 && result.error.message === 'subscription_required') {
                setState('subscriptionRequired');
                return;
            }
            // HOS-152: the capacity-completeness guard rejects publish with a
            // 400 `VALIDATION_ERROR` (`AccommodationService.publish()` throws
            // `ServiceError(VALIDATION_ERROR, ...)`) when extraInfo is missing
            // capacity/minNights/bedrooms/bathrooms. Matching on the error
            // code (not bare status) keeps this from mislabeling some future,
            // different 400 on `/publish` as "incomplete capacity" — retrying
            // without fixing the accommodation's data would fail identically,
            // so route the host to the editor instead of a generic "try again".
            if (result.error.status === 400 && result.error.code === 'VALIDATION_ERROR') {
                setState('incompleteCapacity');
                return;
            }
            setApiError(errorText);
            setState('error');
            return;
        }

        // Reload so the card re-renders with the new ACTIVE status.
        window.location.reload();
    }

    // ── Idle ──────────────────────────────────────────────────────────────
    if (state === 'idle' || state === 'error') {
        return (
            <span style={{ display: 'contents' }}>
                <button
                    type="button"
                    className={`${styles.action} ${styles.primary}`}
                    onClick={handleRequestConfirm}
                >
                    {label}
                </button>
                {state === 'error' && apiError && (
                    <span
                        role="alert"
                        style={{
                            fontSize: '0.75rem',
                            color: 'var(--destructive)',
                            width: '100%',
                            marginTop: '2px'
                        }}
                    >
                        {apiError}
                    </span>
                )}
            </span>
        );
    }

    // ── Subscription required ────────────────────────────────────────────
    // Publish failed because the owner has no active plan. Show a banner
    // pointing to the plans page instead of a retryable error.
    if (state === 'subscriptionRequired') {
        const plansUrl = buildUrl({ locale, path: 'suscriptores/planes' });
        return (
            <span
                role="alert"
                style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '6px',
                    alignItems: 'center',
                    width: '100%'
                }}
            >
                <span
                    style={{
                        fontSize: '0.8125rem',
                        color: 'var(--core-foreground)',
                        width: '100%'
                    }}
                >
                    {subscriptionRequiredMessage}
                </span>
                <a
                    href={plansUrl}
                    className={`${styles.action} ${styles.primary}`}
                >
                    {subscriptionRequiredCta}
                </a>
            </span>
        );
    }

    // ── Incomplete capacity (HOS-152) ────────────────────────────────────
    // Publish failed because extraInfo is missing capacity/minNights/
    // bedrooms/bathrooms. Show a banner pointing to the editor instead of a
    // retryable error — the same shape doomed to fail again unmodified.
    if (state === 'incompleteCapacity') {
        const editUrl = buildUrl({
            locale,
            path: `mi-cuenta/propiedades/${accommodationId}/editar`
        });
        return (
            <span
                role="alert"
                style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '6px',
                    alignItems: 'center',
                    width: '100%'
                }}
            >
                <span
                    style={{
                        fontSize: '0.8125rem',
                        color: 'var(--core-foreground)',
                        width: '100%'
                    }}
                >
                    {incompleteCapacityMessage}
                </span>
                <a
                    href={editUrl}
                    className={`${styles.action} ${styles.primary}`}
                >
                    {incompleteCapacityCta}
                </a>
            </span>
        );
    }

    // ── Confirming ───────────────────────────────────────────────────────
    if (state === 'confirming') {
        return (
            <span
                style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '6px',
                    alignItems: 'center',
                    width: '100%'
                }}
            >
                <p className={styles.calloutTitle}>{confirmTitle}</p>
                <p className={styles.calloutNote}>{confirmNote}</p>
                <button
                    type="button"
                    className={`${styles.action} ${styles.primary}`}
                    onClick={handleConfirm}
                >
                    {confirmYes}
                </button>
                <button
                    type="button"
                    className={`${styles.action} ${styles.secondary}`}
                    onClick={handleCancel}
                >
                    {confirmNo}
                </button>
            </span>
        );
    }

    // ── Pending ───────────────────────────────────────────────────────────
    return (
        <button
            type="button"
            className={`${styles.action} ${styles.primary}`}
            disabled
            aria-busy="true"
        >
            {confirmYes}…
        </button>
    );
}
