/**
 * @file DeleteButton.client.tsx
 * @description React island that renders a "Eliminar" danger button with an
 * inline confirmation step, deleting one of the caller's own listings through
 * PB12 (the listing moves to `PURGED`).
 *
 * Flow:
 *  1. Idle  → shows the "Eliminar" button.
 *  2. Click → swaps to inline confirmation: "¿Confirmar? [Sí] [No]".
 *  3. Confirm (Sí) → runs PB12 (`POST /protected/{plural}/{id}/purge`),
 *                    disabling the UI while pending.
 *  4. Success → reloads the page so the list reflects the listing, now
 *               `PURGED`: its content is erased and it never comes back.
 *  5. Error   → shows inline error message, re-enables the button.
 *  6. No (cancel) → returns to step 1.
 *
 * HOS-1156 T-015 widened this from accommodations to all three publish
 * verticals; HOS-1477 made the button the delete of the design (PB12, AC:V6:25).
 * The button does not know which endpoint answers — `publishApi.purge` owns
 * that — so this island stayed a state machine and a bit of markup, which is
 * all it ever was.
 *
 * Mirrors UnpublishButton.client.tsx (same inline-confirm UX, shared CSS module).
 */

import type { ListingLostAddon } from '@repo/schemas';
import { MARKET_TIMEZONE } from '@repo/utils';
import { type JSX, useEffect, useMemo, useRef, useState } from 'react';
import { type PublishVerticalSlug, publishApi } from '@/lib/api/endpoints-protected';
import { formatDate, formatPrice } from '@/lib/format-utils';
import { createTranslations, type SupportedLocale } from '@/lib/i18n';
import styles from './UnpublishButton.module.css';

/** State machine for the delete button. */
type DeleteState = 'idle' | 'confirming' | 'pending' | 'error';
type PurgePreviewState =
    | { readonly status: 'idle' | 'loading' | 'error' }
    | { readonly status: 'ready'; readonly lostAddons: readonly ListingLostAddon[] };

const CYCLE_KEY = {
    monthly: 'listing.owner.purgeAddons.cycle.monthly',
    quarterly: 'listing.owner.purgeAddons.cycle.quarterly',
    semiannual: 'listing.owner.purgeAddons.cycle.semiannual',
    annual: 'listing.owner.purgeAddons.cycle.annual'
} as const;

/**
 * Props for the DeleteButton component.
 */
export interface DeleteButtonProps {
    /** The listing ID to soft-delete. */
    readonly listingId: string;
    /**
     * Which vertical the listing belongs to (HOS-1156 T-015). Decides which
     * endpoint answers. Defaults to `'accommodation'`, so every caller that
     * predates the gastronomy and experience verticals keeps its exact previous behaviour.
     */
    readonly vertical?: PublishVerticalSlug;
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
 * DeleteButton — danger action island that deletes one listing through PB12
 * (the listing moves to `PURGED`).
 *
 * Renders inline using the shared AccountButton compact variants (BETA-143e)
 * composed by `./UnpublishButton.module.css`, matching PropertyCard's other
 * per-row action links.
 *
 * @param props - See `DeleteButtonProps`.
 */
export function DeleteButton({
    listingId,
    vertical = 'accommodation',
    locale,
    label,
    confirmText,
    confirmYes,
    confirmNo,
    errorText
}: DeleteButtonProps): JSX.Element {
    const [state, setState] = useState<DeleteState>('idle');
    const [apiError, setApiError] = useState<string | null>(null);
    const [previewAttempt, setPreviewAttempt] = useState(0);
    const [preview, setPreview] = useState<PurgePreviewState>({ status: 'idle' });
    const { t } = useMemo(() => createTranslations(locale), [locale]);
    const activePreviewAttempt = useRef(0);

    useEffect(() => {
        if (state !== 'confirming') {
            setPreview({ status: 'idle' });
            return;
        }

        let cancelled = false;
        const requestAttempt = previewAttempt;
        activePreviewAttempt.current = requestAttempt;
        setPreview({ status: 'loading' });
        void publishApi.purgePreview({ vertical, id: listingId }).then(
            (result) => {
                if (cancelled || activePreviewAttempt.current !== requestAttempt) return;
                setPreview(
                    result.ok
                        ? { status: 'ready', lostAddons: result.data.lostAddons }
                        : { status: 'error' }
                );
            },
            () => {
                if (!cancelled && activePreviewAttempt.current === requestAttempt)
                    setPreview({ status: 'error' });
            }
        );

        return () => {
            cancelled = true;
        };
    }, [state, listingId, vertical, previewAttempt]);

    /** User clicked the main "Eliminar" button → enter confirmation mode. */
    function handleRequestConfirm(): void {
        setApiError(null);
        setPreview({ status: 'loading' });
        setState('confirming');
    }

    /** User clicked "No" / Cancel → return to idle. */
    function handleCancel(): void {
        setState('idle');
        setApiError(null);
    }

    /** User clicked "Sí, eliminar" → call the API. */
    async function handleConfirm(): Promise<void> {
        if (preview.status !== 'ready') return;
        setState('pending');
        setApiError(null);

        const result = await publishApi.purge({ vertical, id: listingId });

        if (!result.ok) {
            setApiError(errorText);
            setState('error');
            return;
        }

        // Reload so the list re-renders with the listing now PURGED by PB12.
        window.location.reload();
    }

    function handleRetryPreview(): void {
        setPreview({ status: 'loading' });
        setPreviewAttempt((attempt) => attempt + 1);
    }

    function cycleLabel(cycle: NonNullable<ListingLostAddon['cycle']>): string {
        return t(CYCLE_KEY[cycle]);
    }

    function formatLostAddon(addon: ListingLostAddon): string {
        const price = formatPrice({
            amount: addon.price / 100,
            currency: addon.currency,
            locale,
            showDecimals: true
        });
        let duration = '';
        switch (addon.chargeKind) {
            case 'PERIODICO':
                if (addon.cycle) duration = cycleLabel(addon.cycle);
                break;
            case 'UNA_VEZ':
                if (addon.endsAt) {
                    duration = t('listing.owner.purgeAddons.until', undefined, {
                        date: formatDate({
                            date: addon.endsAt,
                            locale,
                            options: { timeZone: MARKET_TIMEZONE }
                        })
                    });
                }
                break;
        }
        const pending =
            addon.status === 'PENDING_AUTHORIZATION'
                ? ` ${t('listing.owner.purgeAddons.pending')}`
                : '';
        return [addon.name, price, duration, pending].filter(Boolean).join(' · ');
    }

    // ── Idle / error ──────────────────────────────────────────────────────
    if (state === 'idle' || state === 'error') {
        return (
            <span style={{ display: 'contents' }}>
                <button
                    type="button"
                    className={styles.danger}
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
                {preview.status === 'loading' && (
                    <span
                        aria-live="polite"
                        aria-busy="true"
                    >
                        {confirmYes}…
                    </span>
                )}
                {preview.status === 'error' && (
                    <span
                        role="alert"
                        style={{ width: '100%' }}
                    >
                        <span>{t('listing.owner.purgeAddons.loadError')}</span>{' '}
                        <button
                            type="button"
                            className={styles.secondary}
                            onClick={handleRetryPreview}
                        >
                            {t('listing.owner.purgeAddons.retry')}
                        </button>
                    </span>
                )}
                {preview.status === 'ready' && (
                    <>
                        {preview.lostAddons.length > 0 && (
                            <strong style={{ width: '100%' }}>
                                {t('listing.owner.purgeAddons.title')}
                            </strong>
                        )}
                        <ul
                            data-testid="purge-lost-addons"
                            data-count={preview.lostAddons.length}
                            style={{ width: '100%', margin: 0, paddingInlineStart: '1.25rem' }}
                        >
                            {preview.lostAddons.map((addon) => (
                                <li
                                    data-testid="purge-lost-addon"
                                    key={addon.addonInstanceId}
                                >
                                    {formatLostAddon(addon)}
                                </li>
                            ))}
                        </ul>
                        {preview.lostAddons.length > 0 && (
                            <p style={{ width: '100%', margin: 0 }}>
                                {t('listing.owner.purgeAddons.clockRuns')}
                            </p>
                        )}
                    </>
                )}
                <button
                    type="button"
                    className={styles.danger}
                    disabled={preview.status !== 'ready'}
                    aria-busy={preview.status === 'loading'}
                    onClick={handleConfirm}
                >
                    {confirmYes}
                </button>
                <button
                    type="button"
                    className={styles.secondary}
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
            className={styles.danger}
            disabled
            aria-busy="true"
        >
            {confirmYes}…
        </button>
    );
}
