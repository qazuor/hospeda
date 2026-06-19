/**
 * @file DeleteButton.client.tsx
 * @description React island that renders a "Eliminar" danger button with an
 * inline confirmation step, soft-deleting the host's accommodation.
 *
 * Flow:
 *  1. Idle  → shows the "Eliminar" button.
 *  2. Click → swaps to inline confirmation: "¿Confirmar? [Sí] [No]".
 *  3. Confirm (Sí) → calls DELETE /api/v1/protected/accommodations/:id,
 *                    disables UI while pending.
 *  4. Success → reloads the page; the deleted card drops out of the list
 *               (SPEC-230 filters soft-deleted rows from protected lists).
 *  5. Error   → shows inline error message, re-enables the button.
 *  6. No (cancel) → returns to step 1.
 *
 * Mirrors UnpublishButton.client.tsx (same inline-confirm UX, shared CSS module).
 */

import { accommodationEditApi } from '@/lib/api/endpoints-protected';
import type { SupportedLocale } from '@/lib/i18n';
import { type JSX, useState } from 'react';
import styles from './UnpublishButton.module.css';

/** State machine for the delete button. */
type DeleteState = 'idle' | 'confirming' | 'pending' | 'error';

/**
 * Props for the DeleteButton component.
 */
export interface DeleteButtonProps {
    /** The accommodation ID to soft-delete. */
    readonly accommodationId: string;
    /** Current locale — accepted for consistency with sibling islands. */
    readonly locale: SupportedLocale;
    /** Label for the main danger button (already-translated string). */
    readonly label: string;
    /** Confirmation text shown above the yes/no buttons (already-translated). */
    readonly confirmText: string;
    /** Label for the "Yes, delete" confirm button (already-translated). */
    readonly confirmYes: string;
    /** Label for the "Cancel" button (already-translated). */
    readonly confirmNo: string;
    /** Error message shown on API failure (already-translated). */
    readonly errorText: string;
}

/**
 * DeleteButton — danger action island that soft-deletes an accommodation.
 *
 * Renders inline reusing the PropertyCard's existing action button styles.
 *
 * @param props - See `DeleteButtonProps`.
 */
export function DeleteButton({
    accommodationId,
    locale: _locale,
    label,
    confirmText,
    confirmYes,
    confirmNo,
    errorText
}: DeleteButtonProps): JSX.Element {
    const [state, setState] = useState<DeleteState>('idle');
    const [apiError, setApiError] = useState<string | null>(null);

    /** User clicked the main "Eliminar" button → enter confirmation mode. */
    function handleRequestConfirm(): void {
        setApiError(null);
        setState('confirming');
    }

    /** User clicked "No" / Cancel → return to idle. */
    function handleCancel(): void {
        setState('idle');
        setApiError(null);
    }

    /** User clicked "Sí, eliminar" → call the API. */
    async function handleConfirm(): Promise<void> {
        setState('pending');
        setApiError(null);

        const result = await accommodationEditApi.softDelete({ id: accommodationId });

        if (!result.ok) {
            setApiError(errorText);
            setState('error');
            return;
        }

        // Reload so the list re-renders without the now soft-deleted card.
        window.location.reload();
    }

    // ── Idle / error ──────────────────────────────────────────────────────
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
