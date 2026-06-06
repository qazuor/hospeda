/**
 * @file DestinationReviewSidebarCard.client.tsx
 * @description Island on the destination detail page that lets an
 * authenticated visitor submit a review. Auth gating is handled at the page
 * level — this component always shows the "Dejar reseña" CTA.
 *
 * Two render variants:
 * - `card` (default): sidebar card with title + hint + CTA button.
 * - `inline`: just the CTA button, for mounting under the reviews list.
 *
 * Mirrors ReviewSidebarCard.client.tsx (accommodation) with:
 * - 18 destination rating dimensions grouped in 5 collapsible categories
 *   (see DestinationReviewRatingFields).
 * - TITLE_MAX = 50, CONTENT_MAX = 500 (destination schema limits).
 * - Content min = 10 chars (validated client-side).
 * - Success shows pendingNotice (review starts PENDING moderation).
 * - 409 ALREADY_EXISTS → specific "alreadyReviewed" copy.
 */
import { translateApiError } from '@/lib/api-errors';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import { type FormEvent, useCallback, useEffect, useId, useRef, useState } from 'react';
import { DestinationReviewRatingFields } from './DestinationReviewRatingFields';
import styles from './DestinationReviewSidebarCard.module.css';
import {
    INITIAL_RATINGS,
    RATING_KEYS,
    type RatingKey,
    type RatingState
} from './destination-rating';

const TITLE_MAX = 50;
const CONTENT_MAX = 500;
const CONTENT_MIN = 10;

// --- Small SVG helpers to avoid repeating verbose markup -------------------

function CheckIcon() {
    return (
        <svg
            viewBox="0 0 24 24"
            width="28"
            height="28"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            focusable="false"
        >
            <title>Reseña enviada</title>
            <polyline points="20 6 9 17 4 12" />
        </svg>
    );
}

function CloseIcon() {
    return (
        <svg
            viewBox="0 0 24 24"
            width="20"
            height="20"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            focusable="false"
        >
            <title>Cerrar</title>
            <line
                x1="18"
                y1="6"
                x2="6"
                y2="18"
            />
            <line
                x1="6"
                y1="6"
                x2="18"
                y2="18"
            />
        </svg>
    );
}

function ArrowIcon() {
    return (
        <svg
            viewBox="0 0 24 24"
            width="16"
            height="16"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            focusable="false"
        >
            <title>Abrir</title>
            <line
                x1="5"
                y1="12"
                x2="19"
                y2="12"
            />
            <polyline points="12 5 19 12 12 19" />
        </svg>
    );
}

function StarBadgeIcon() {
    return (
        <svg
            viewBox="0 0 24 24"
            width="18"
            height="18"
            fill="currentColor"
            aria-hidden="true"
            focusable="false"
        >
            <title>Estrella</title>
            <path d="M12 2l2.92 5.92 6.53.95-4.72 4.6 1.11 6.5L12 17.6l-5.84 3.07 1.11-6.5-4.72-4.6 6.53-.95L12 2z" />
        </svg>
    );
}

// ---------------------------------------------------------------------------

interface DestinationReviewSidebarCardProps {
    readonly destinationId: string;
    readonly destinationName: string;
    readonly locale: SupportedLocale;
    readonly apiUrl: string;
    /** `card` renders the sidebar card; `inline` renders just the CTA button. */
    readonly variant?: 'card' | 'inline';
}

/**
 * Review submission island for a destination.
 *
 * Always shows the "Dejar reseña" CTA (auth gating happens at page level).
 * The form opens in a native <dialog> for automatic focus-trap and ESC.
 *
 * @param props - Destination context, API base URL, and render variant
 */
export function DestinationReviewSidebarCard({
    destinationId,
    destinationName,
    locale,
    apiUrl,
    variant = 'card'
}: DestinationReviewSidebarCardProps) {
    const { t } = createTranslations(locale);
    const dialogRef = useRef<HTMLDialogElement>(null);
    // Two instances of this island coexist on the page (sidebar card + inline
    // CTA in the reviews section) — scope every DOM id per instance.
    const uid = useId();
    const dialogTitleId = `${uid}-dest-review-dialog-title`;
    const cardTitleId = `${uid}-dest-review-card-title`;

    const [open, setOpen] = useState(false);
    const [ratings, setRatings] = useState<RatingState>(INITIAL_RATINGS);
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    const allRated = RATING_KEYS.every((key) => ratings[key] >= 1);
    const contentTrimmed = content.trim();
    const contentValid = contentTrimmed.length === 0 || contentTrimmed.length >= CONTENT_MIN;

    useEffect(() => {
        const dlg = dialogRef.current;
        if (!dlg) return;
        if (open && !dlg.open) dlg.showModal();
        else if (!open && dlg.open) dlg.close();
    }, [open]);

    const handleOpen = useCallback(() => {
        setSuccess(false);
        setError(null);
        setOpen(true);
    }, []);

    const handleClose = useCallback(() => {
        setOpen(false);
        window.setTimeout(() => {
            setRatings(INITIAL_RATINGS);
            setTitle('');
            setContent('');
            setError(null);
            setSuccess(false);
        }, 200);
    }, []);

    const setDimension = useCallback((key: RatingKey, value: number) => {
        setRatings((prev) => ({ ...prev, [key]: value }));
    }, []);

    const setCategory = useCallback((dims: readonly RatingKey[], value: number) => {
        setRatings((prev) => {
            const next: Record<RatingKey, number> = { ...prev };
            for (const dim of dims) next[dim] = value;
            return next;
        });
    }, []);

    const handleSubmit = useCallback(
        async (event: FormEvent<HTMLFormElement>) => {
            event.preventDefault();
            if (!allRated || submitting || !contentValid) return;
            setSubmitting(true);
            setError(null);
            const base = apiUrl.replace(/\/$/, '');
            try {
                const response = await fetch(
                    `${base}/api/v1/protected/destinations/${destinationId}/reviews`,
                    {
                        method: 'POST',
                        credentials: 'include',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            rating: ratings,
                            ...(title.trim() ? { title: title.trim() } : {}),
                            ...(contentTrimmed ? { content: contentTrimmed } : {})
                        })
                    }
                );
                if (!response.ok) {
                    let apiError: { code?: string; message?: string; reason?: string } | null =
                        null;
                    try {
                        const body = (await response.json()) as {
                            error?: { code?: string; message?: string; reason?: string };
                        };
                        apiError = body?.error ?? null;
                    } catch {
                        /* not JSON */
                    }
                    if (apiError?.code === 'ALREADY_EXISTS') {
                        setError(
                            t(
                                'review.form.destination.alreadyReviewed',
                                'Ya enviaste una reseña para este destino.'
                            )
                        );
                        return;
                    }
                    setError(
                        translateApiError({
                            error: apiError,
                            locale,
                            fallback: t(
                                'review.form.errors.submitFailed',
                                'Error al enviar la reseña. Por favor, intenta de nuevo.'
                            )
                        })
                    );
                    return;
                }
                setSuccess(true);
                window.setTimeout(() => window.location.reload(), 1400);
            } catch {
                setError(
                    t(
                        'apiError.NETWORK_ERROR',
                        'No pudimos conectar con el servidor. Probá de nuevo.'
                    )
                );
            } finally {
                setSubmitting(false);
            }
        },
        [
            allRated,
            apiUrl,
            contentTrimmed,
            contentValid,
            destinationId,
            locale,
            ratings,
            submitting,
            t,
            title
        ]
    );

    const ctaLabel = t('review.destinationSidebar.cta', 'Dejar reseña');

    return (
        <>
            {variant === 'card' ? (
                <aside
                    className={styles.card}
                    aria-labelledby={cardTitleId}
                >
                    <div className={styles.cardHeader}>
                        <span
                            className={styles.cardBadge}
                            aria-hidden="true"
                        >
                            <StarBadgeIcon />
                        </span>
                        <h3
                            id={cardTitleId}
                            className={styles.cardTitle}
                        >
                            {t('review.destinationSidebar.title', 'Tu opinión')}
                        </h3>
                    </div>
                    <p className={styles.cardText}>
                        {t(
                            'review.destinationSidebar.canLeaveReview',
                            'Compartí tu experiencia en este destino para ayudar a otros viajeros.'
                        )}
                    </p>
                    <button
                        type="button"
                        className={styles.cardCta}
                        onClick={handleOpen}
                    >
                        {ctaLabel}
                        <ArrowIcon />
                    </button>
                </aside>
            ) : (
                <button
                    type="button"
                    className={styles.inlineCta}
                    onClick={handleOpen}
                >
                    {ctaLabel}
                    <ArrowIcon />
                </button>
            )}

            <dialog
                ref={dialogRef}
                className={styles.dialog}
                aria-labelledby={dialogTitleId}
                onClose={() => setOpen(false)}
                onClick={(event) => {
                    if (event.target === dialogRef.current) handleClose();
                }}
                onKeyDown={(event) => {
                    if (event.key === 'Escape') handleClose();
                }}
            >
                <div className={styles.dialogInner}>
                    {success ? (
                        <output className={styles.successState}>
                            <span
                                className={styles.successBadge}
                                aria-hidden="true"
                            >
                                <CheckIcon />
                            </span>
                            <span className={styles.successMessage}>
                                {t(
                                    'review.form.destination.pendingNotice',
                                    'Tu reseña está pendiente de aprobación y será visible cuando sea revisada.'
                                )}
                            </span>
                        </output>
                    ) : (
                        <>
                            <header className={styles.dialogHeader}>
                                <div>
                                    <h3
                                        id={dialogTitleId}
                                        className={styles.dialogTitle}
                                    >
                                        {t('review.list.writeReview', 'Escribir reseña')}
                                    </h3>
                                    <p className={styles.dialogSubtitle}>{destinationName}</p>
                                </div>
                                <button
                                    type="button"
                                    className={styles.closeButton}
                                    onClick={handleClose}
                                    aria-label={t('review.dialog.close', 'Cerrar')}
                                >
                                    <CloseIcon />
                                </button>
                            </header>

                            <form
                                className={styles.form}
                                onSubmit={handleSubmit}
                                noValidate
                            >
                                <DestinationReviewRatingFields
                                    ratings={ratings}
                                    submitting={submitting}
                                    idPrefix={uid}
                                    t={t}
                                    onSetDimension={setDimension}
                                    onSetCategory={setCategory}
                                />

                                <label className={styles.field}>
                                    <span className={styles.fieldLabel}>
                                        {t('review.form.titleLabel', 'Título')}
                                        <span className={styles.fieldOptional}>
                                            {t('common.optional', 'Opcional')}
                                        </span>
                                    </span>
                                    <input
                                        type="text"
                                        className={styles.input}
                                        value={title}
                                        maxLength={TITLE_MAX}
                                        onChange={(e) => setTitle(e.target.value)}
                                        placeholder={t(
                                            'review.form.titlePlaceholder',
                                            'Resumen de tu experiencia'
                                        )}
                                        disabled={submitting}
                                    />
                                </label>

                                <label className={styles.field}>
                                    <span className={styles.fieldLabel}>
                                        {t('review.form.contentLabel', 'Comentario')}
                                        <span className={styles.fieldOptional}>
                                            {t('common.optional', 'Opcional')}
                                        </span>
                                    </span>
                                    <textarea
                                        className={styles.textarea}
                                        value={content}
                                        maxLength={CONTENT_MAX}
                                        rows={4}
                                        onChange={(e) => setContent(e.target.value)}
                                        placeholder={t(
                                            'review.form.contentPlaceholder',
                                            'Comparte tu experiencia en detalle...'
                                        )}
                                        disabled={submitting}
                                    />
                                    <span className={styles.charCounter}>
                                        {content.length}/{CONTENT_MAX}
                                    </span>
                                </label>

                                {error && (
                                    <p
                                        className={styles.errorMessage}
                                        role="alert"
                                    >
                                        {error}
                                    </p>
                                )}

                                <div className={styles.actions}>
                                    <button
                                        type="button"
                                        className={styles.secondaryButton}
                                        onClick={handleClose}
                                        disabled={submitting}
                                    >
                                        {t('review.form.cancelButton', 'Cancelar')}
                                    </button>
                                    <button
                                        type="submit"
                                        className={styles.submitButton}
                                        disabled={!allRated || !contentValid || submitting}
                                    >
                                        {submitting && (
                                            <span
                                                className={styles.spinner}
                                                aria-hidden="true"
                                            />
                                        )}
                                        <span>
                                            {submitting
                                                ? t('review.form.submittingButton', 'Enviando...')
                                                : t('review.form.submitButton', 'Enviar reseña')}
                                        </span>
                                    </button>
                                </div>

                                {!allRated && (
                                    <p
                                        className={styles.helpText}
                                        aria-live="polite"
                                    >
                                        {t(
                                            'review.form.errors.ratingRequired',
                                            'Debes seleccionar una calificación'
                                        )}
                                    </p>
                                )}
                                {allRated && !contentValid && (
                                    <p
                                        className={styles.helpText}
                                        aria-live="polite"
                                    >
                                        {t(
                                            'review.form.errors.contentMinLength',
                                            'El comentario debe tener al menos 10 caracteres'
                                        )}
                                    </p>
                                )}
                            </form>
                        </>
                    )}
                </div>
            </dialog>
        </>
    );
}
