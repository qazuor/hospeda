/**
 * @file ReviewSidebarCard.client.tsx
 * @description Sidebar block on the accommodation detail page that lets an
 * authenticated visitor open a modal dialog with the review form. Sits next
 * to PricingSidebar + OwnerCard. Replaces the previous inline form on the
 * main column — the inline form was too tall and dominated the page.
 *
 * Two states:
 * - canLeaveReview = true  → "Dejá tu reseña" card with a CTA that opens
 *                            the dialog.
 * - canLeaveReview = false → Compact note explaining the contact-first
 *                            requirement. No CTA.
 *
 * The dialog uses the native <dialog> element so focus management,
 * Escape-to-close, and overlay backdrop come for free.
 */

import { translateApiError } from '@/lib/api-errors';
import { cn } from '@/lib/cn';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import { type FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import styles from './ReviewSidebarCard.module.css';

const RATING_KEYS = [
    'cleanliness',
    'hospitality',
    'services',
    'accuracy',
    'communication',
    'location'
] as const;

type RatingKey = (typeof RATING_KEYS)[number];
type RatingState = Readonly<Record<RatingKey, number>>;

const INITIAL_RATINGS: RatingState = {
    cleanliness: 0,
    hospitality: 0,
    services: 0,
    accuracy: 0,
    communication: 0,
    location: 0
};

const TITLE_MAX = 120;
const CONTENT_MAX = 2000;

const DEFAULT_RATING_LABELS: Record<RatingKey, string> = {
    cleanliness: 'Limpieza',
    hospitality: 'Hospitalidad',
    services: 'Servicios',
    accuracy: 'Veracidad',
    communication: 'Comunicación',
    location: 'Ubicación'
};

interface ReviewSidebarCardProps {
    readonly accommodationId: string;
    readonly accommodationName: string;
    readonly canLeaveReview: boolean;
    readonly locale: SupportedLocale;
    readonly apiUrl: string;
}

function joinApi(apiUrl: string, path: string): string {
    return `${apiUrl.replace(/\/$/, '')}${path}`;
}

export function ReviewSidebarCard({
    accommodationId,
    accommodationName,
    canLeaveReview,
    locale,
    apiUrl
}: ReviewSidebarCardProps) {
    const { t } = createTranslations(locale);
    const dialogRef = useRef<HTMLDialogElement>(null);

    const [open, setOpen] = useState<boolean>(false);
    const [ratings, setRatings] = useState<RatingState>(INITIAL_RATINGS);
    const [title, setTitle] = useState<string>('');
    const [content, setContent] = useState<string>('');
    const [submitting, setSubmitting] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<boolean>(false);

    const allRated = RATING_KEYS.every((key) => ratings[key] >= 1);

    // Sync the native <dialog> element with React state. Use showModal()
    // (not show()) so focus is trapped and ESC closes the dialog.
    useEffect(() => {
        const dlg = dialogRef.current;
        if (!dlg) return;
        if (open && !dlg.open) {
            dlg.showModal();
        } else if (!open && dlg.open) {
            dlg.close();
        }
    }, [open]);

    const handleOpen = useCallback(() => {
        setSuccess(false);
        setError(null);
        setOpen(true);
    }, []);

    const handleClose = useCallback(() => {
        setOpen(false);
        // Reset state shortly after the dialog has closed so the closing
        // animation doesn't briefly flash the empty form.
        window.setTimeout(() => {
            setRatings(INITIAL_RATINGS);
            setTitle('');
            setContent('');
            setError(null);
            setSuccess(false);
        }, 200);
    }, []);

    const setStar = useCallback((key: RatingKey, value: number) => {
        setRatings((prev) => ({ ...prev, [key]: value }));
    }, []);

    const handleSubmit = useCallback(
        async (event: FormEvent<HTMLFormElement>) => {
            event.preventDefault();
            if (!allRated || submitting) return;
            setSubmitting(true);
            setError(null);

            try {
                const response = await fetch(
                    joinApi(apiUrl, `/api/v1/protected/accommodations/${accommodationId}/reviews`),
                    {
                        method: 'POST',
                        credentials: 'include',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            rating: ratings,
                            title: title.trim() || undefined,
                            content: content.trim() || undefined
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
                        // body wasn't JSON
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
        [accommodationId, allRated, apiUrl, content, locale, ratings, submitting, t, title]
    );

    return (
        <>
            <aside
                className={styles.card}
                aria-labelledby="review-sidebar-card-title"
            >
                <div className={styles.cardHeader}>
                    <span
                        className={styles.cardBadge}
                        aria-hidden="true"
                    >
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
                    </span>
                    <h3
                        id="review-sidebar-card-title"
                        className={styles.cardTitle}
                    >
                        {t('review.sidebar.title', 'Tu opinión')}
                    </h3>
                </div>

                {canLeaveReview ? (
                    <>
                        <p className={styles.cardText}>
                            {t(
                                'review.sidebar.canLeaveReview',
                                'Contaste con el anfitrión. Compartí tu experiencia para ayudar a otros viajeros.'
                            )}
                        </p>
                        <button
                            type="button"
                            className={styles.cardCta}
                            onClick={handleOpen}
                        >
                            {t('review.sidebar.cta', 'Dejar reseña')}
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
                        </button>
                    </>
                ) : (
                    <p className={cn(styles.cardText, styles.cardTextLocked)}>
                        {t(
                            'review.sidebar.locked',
                            'Para dejar reseña, primero escribile al anfitrión desde el botón de contacto.'
                        )}
                    </p>
                )}
            </aside>

            <dialog
                ref={dialogRef}
                className={styles.dialog}
                aria-labelledby="review-dialog-title"
                onClose={() => setOpen(false)}
                onClick={(event) => {
                    // Click on backdrop (outside the dialog content) closes
                    // it. The native <dialog> element already handles ESC
                    // for keyboard users, so no onKey* handler is needed.
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
                            </span>
                            <span className={styles.successMessage}>
                                {t(
                                    'review.form.submitSuccess',
                                    '¡Gracias! Tu reseña fue enviada con éxito.'
                                )}
                            </span>
                        </output>
                    ) : (
                        <>
                            <header className={styles.dialogHeader}>
                                <div>
                                    <h3
                                        id="review-dialog-title"
                                        className={styles.dialogTitle}
                                    >
                                        {t('review.list.writeReview', 'Escribir reseña')}
                                    </h3>
                                    <p className={styles.dialogSubtitle}>{accommodationName}</p>
                                </div>
                                <button
                                    type="button"
                                    className={styles.closeButton}
                                    onClick={handleClose}
                                    aria-label={t('review.dialog.close', 'Cerrar')}
                                >
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
                                </button>
                            </header>

                            <form
                                className={styles.form}
                                onSubmit={handleSubmit}
                                noValidate
                            >
                                <div
                                    className={styles.ratingList}
                                    aria-label={t('review.form.ratingLabel', 'Calificación')}
                                >
                                    {RATING_KEYS.map((key) => {
                                        const value = ratings[key];
                                        const label = t(
                                            `review.form.ratingAspects.${key}`,
                                            DEFAULT_RATING_LABELS[key]
                                        );
                                        return (
                                            <div
                                                key={key}
                                                className={styles.ratingRow}
                                            >
                                                <span className={styles.ratingLabel}>{label}</span>
                                                <div
                                                    className={styles.starGroup}
                                                    role="radiogroup"
                                                    aria-label={label}
                                                >
                                                    {[1, 2, 3, 4, 5].map((star) => (
                                                        <button
                                                            key={star}
                                                            type="button"
                                                            // biome-ignore lint/a11y/useSemanticElements: button+role=radio is the ARIA APG pattern for star ratings; <input type=radio> can't host the star glyph.
                                                            role="radio"
                                                            aria-checked={value === star}
                                                            aria-label={`${label}: ${star}`}
                                                            className={cn(
                                                                styles.starButton,
                                                                star <= value && styles.starButtonOn
                                                            )}
                                                            onClick={() => setStar(key, star)}
                                                            disabled={submitting}
                                                        >
                                                            <svg
                                                                viewBox="0 0 24 24"
                                                                width="100%"
                                                                height="100%"
                                                                fill="currentColor"
                                                                aria-hidden="true"
                                                                focusable="false"
                                                            >
                                                                <title>Estrella</title>
                                                                <path d="M12 2l2.92 5.92 6.53.95-4.72 4.6 1.11 6.5L12 17.6l-5.84 3.07 1.11-6.5-4.72-4.6 6.53-.95L12 2z" />
                                                            </svg>
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>

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
                                        onChange={(event) => setTitle(event.target.value)}
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
                                        onChange={(event) => setContent(event.target.value)}
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
                                        disabled={!allRated || submitting}
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
                            </form>
                        </>
                    )}
                </div>
            </dialog>
        </>
    );
}
