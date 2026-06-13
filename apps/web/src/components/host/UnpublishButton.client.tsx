/**
 * @file UnpublishButton.client.tsx
 * @description React island that renders a "Despublicar" danger button with an
 * inline confirmation step.
 *
 * Flow:
 *  1. Idle  → shows the "Despublicar" button.
 *  2. Click → swaps to inline confirmation: "¿Confirmar? [Sí] [No]".
 *  3. Confirm (Sí) → calls POST /api/v1/protected/accommodations/:id/unpublish,
 *                    disables UI while pending.
 *  4. Success → reloads the page via window.location.reload().
 *  5. Error   → shows inline error message, re-enables the button.
 *  6. No (cancel) → returns to step 1.
 *
 * @example
 * ```astro
 * <UnpublishButton
 *   client:load
 *   accommodationId={property.id}
 *   locale={locale}
 *   label={t('host.properties.card.actions.unpublish', 'Despublicar')}
 *   confirmText={t('host.properties.card.actions.unpublishConfirm', '...')}
 *   confirmYes={t('host.properties.card.actions.confirmYes', 'Sí, despublicar')}
 *   confirmNo={t('host.properties.card.actions.confirmNo', 'Cancelar')}
 * />
 * ```
 */

import { accommodationEditApi } from '@/lib/api/endpoints-protected';
import type { SupportedLocale } from '@/lib/i18n';
import { type JSX, useState } from 'react';
import styles from './UnpublishButton.module.css';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** State machine for the unpublish button. */
type UnpublishState = 'idle' | 'confirming' | 'pending' | 'error';

/**
 * Props for the UnpublishButton component.
 */
export interface UnpublishButtonProps {
    /** The accommodation ID to unpublish. */
    readonly accommodationId: string;
    /** Current locale — not used for logic but accepted for consistency with other islands. */
    readonly locale: SupportedLocale;
    /** Label for the main danger button (already-translated string). */
    readonly label: string;
    /** Confirmation text shown between the yes/no buttons (already-translated). */
    readonly confirmText: string;
    /** Label for the "Yes, unpublish" confirm button (already-translated). */
    readonly confirmYes: string;
    /** Label for the "Cancel" button (already-translated). */
    readonly confirmNo: string;
    /** Error message shown on API failure (already-translated). */
    readonly errorText: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * UnpublishButton — danger action island for transitioning ACTIVE → INACTIVE.
 *
 * Renders inline without an external CSS module to stay self-contained inside
 * the PropertyCard's existing `.prop-card__action` classes.
 *
 * @param props - See `UnpublishButtonProps`.
 */
export function UnpublishButton({
    accommodationId,
    locale: _locale,
    label,
    confirmText,
    confirmYes,
    confirmNo,
    errorText
}: UnpublishButtonProps): JSX.Element {
    const [state, setState] = useState<UnpublishState>('idle');
    const [apiError, setApiError] = useState<string | null>(null);

    /** User clicked the main "Despublicar" button → enter confirmation mode. */
    function handleRequestConfirm(): void {
        setApiError(null);
        setState('confirming');
    }

    /** User clicked "No" / Cancel → return to idle. */
    function handleCancel(): void {
        setState('idle');
        setApiError(null);
    }

    /** User clicked "Sí, despublicar" → call the API. */
    async function handleConfirm(): Promise<void> {
        setState('pending');
        setApiError(null);

        const result = await accommodationEditApi.unpublish({ id: accommodationId });

        if (!result.ok) {
            setApiError(errorText);
            setState('error');
            return;
        }

        // Reload so the card re-renders with the new INACTIVE status.
        window.location.reload();
    }

    // ── Idle ──────────────────────────────────────────────────────────────
    if (state === 'idle' || state === 'error') {
        return (
            <span style={{ display: 'contents' }}>
                <button
                    type="button"
                    className={`${styles.action} ${styles.danger}`}
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
                <span
                    style={{
                        fontSize: '0.8125rem',
                        color: 'var(--core-foreground)',
                        width: '100%'
                    }}
                >
                    {confirmText}
                </span>
                <button
                    type="button"
                    className={`${styles.action} ${styles.danger}`}
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
            className={`${styles.action} ${styles.danger}`}
            disabled
            aria-busy="true"
        >
            {confirmYes}…
        </button>
    );
}
