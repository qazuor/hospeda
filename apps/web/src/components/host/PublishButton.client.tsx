/**
 * @file PublishButton.client.tsx
 * @description React island that renders a "Publicar" primary button with an
 * inline confirmation step explaining that publishing starts the no-card
 * 14-day free trial.
 *
 * Flow:
 *  1. Idle  → shows the "Publicar" button.
 *  2. Click → swaps to inline confirmation with the trial callout copy and
 *             "[Sí, publicar] [Cancelar]".
 *  3. Confirm (Sí) → calls POST /api/v1/protected/accommodations/:id/publish,
 *                    disables UI while pending. Server-side this calls
 *                    `AccommodationService.publish()` directly, which starts
 *                    the no-card trial (`TrialService.startTrial()`) for an
 *                    eligible owner (HOS-110). A dedicated `/publish`
 *                    endpoint is used instead of the generic update PATCH
 *                    because the update schema strips `lifecycleState`,
 *                    which made the naive approach a silent no-op.
 *  4. Success → reloads the page via window.location.reload() so the card
 *               re-renders with the new ACTIVE status.
 *  5. Error   → shows inline error message, re-enables the button. When the
 *               failure is specifically `403 subscription_required` (the
 *               owner already consumed their one-per-life trial and has no
 *               active plan), a dedicated banner is shown instead, linking
 *               to the plans page rather than suggesting a retry.
 *  6. No (cancel) → returns to step 1.
 *
 * Mirrors UnpublishButton.client.tsx / DeleteButton.client.tsx (same
 * inline-confirm UX), but uses a positive (green) accent for the confirm
 * button instead of the danger red, and surfaces the trial-start copy from
 * `CreatePropertyMiniForm.client.tsx`'s trial callout.
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
type PublishState = 'idle' | 'confirming' | 'pending' | 'error' | 'subscriptionRequired';

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
     * Message shown when publish fails because the owner already consumed
     * their one-per-life trial and has no active subscription
     * (`403 subscription_required`, already-translated).
     */
    readonly subscriptionRequiredMessage: string;
    /** Label for the link to the plans page in that same case (already-translated). */
    readonly subscriptionRequiredCta: string;
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
    subscriptionRequiredCta
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
            // W3: the owner already consumed their one-per-life trial and has
            // no active subscription. Route them to the plans page instead of
            // showing a generic "try again" message — retrying is pointless.
            if (result.error.status === 403 && result.error.message === 'subscription_required') {
                setState('subscriptionRequired');
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
    // Publish failed because the owner's one-per-life trial is already
    // consumed and they have no active plan. Show a banner pointing to the
    // plans page instead of a retryable error.
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
