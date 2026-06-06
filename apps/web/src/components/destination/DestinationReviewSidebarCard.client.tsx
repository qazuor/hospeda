/**
 * @file DestinationReviewSidebarCard.client.tsx
 * @description Sidebar card island on the destination detail page that lets an
 * authenticated visitor submit a review. Auth gating is handled at the page
 * level — this card always shows the "Dejar reseña" CTA.
 *
 * Mirrors ReviewSidebarCard.client.tsx (accommodation) with:
 * - 18 destination rating dimensions instead of 6.
 * - TITLE_MAX = 50, CONTENT_MAX = 500 (destination schema limits).
 * - Content min = 10 chars (validated client-side).
 * - Success shows pendingNotice (review starts PENDING moderation).
 * - 409 ALREADY_EXISTS → specific "alreadyReviewed" copy.
 */
import { translateApiError } from '@/lib/api-errors';
import { cn } from '@/lib/cn';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import { type FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import styles from './DestinationReviewSidebarCard.module.css';

const RATING_KEYS = [
    'landscape',
    'attractions',
    'accessibility',
    'safety',
    'cleanliness',
    'hospitality',
    'culturalOffer',
    'gastronomy',
    'affordability',
    'nightlife',
    'infrastructure',
    'environmentalCare',
    'wifiAvailability',
    'shopping',
    'beaches',
    'greenSpaces',
    'localEvents',
    'weatherSatisfaction'
] as const;

type RatingKey = (typeof RATING_KEYS)[number];
type RatingState = Readonly<Record<RatingKey, number>>;

const INITIAL_RATINGS: RatingState = {
    landscape: 0,
    attractions: 0,
    accessibility: 0,
    safety: 0,
    cleanliness: 0,
    hospitality: 0,
    culturalOffer: 0,
    gastronomy: 0,
    affordability: 0,
    nightlife: 0,
    infrastructure: 0,
    environmentalCare: 0,
    wifiAvailability: 0,
    shopping: 0,
    beaches: 0,
    greenSpaces: 0,
    localEvents: 0,
    weatherSatisfaction: 0
};

const TITLE_MAX = 50;
const CONTENT_MAX = 500;
const CONTENT_MIN = 10;

const DEFAULT_LABELS: Record<RatingKey, string> = {
    landscape: 'Paisaje',
    attractions: 'Atracciones',
    accessibility: 'Accesibilidad',
    safety: 'Seguridad',
    cleanliness: 'Limpieza',
    hospitality: 'Hospitalidad',
    culturalOffer: 'Oferta cultural',
    gastronomy: 'Gastronomía',
    affordability: 'Relación precio-calidad',
    nightlife: 'Vida nocturna',
    infrastructure: 'Infraestructura',
    environmentalCare: 'Cuidado del entorno',
    wifiAvailability: 'Conectividad wifi',
    shopping: 'Compras',
    beaches: 'Playas',
    greenSpaces: 'Espacios verdes',
    localEvents: 'Eventos locales',
    weatherSatisfaction: 'Satisfacción climática'
};

// --- Small SVG helpers to avoid repeating verbose markup -------------------

function StarIcon() {
    return (
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
    );
}

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

// ---------------------------------------------------------------------------

interface StarRatingRowProps {
    readonly ratingKey: RatingKey;
    readonly value: number;
    readonly label: string;
    readonly submitting: boolean;
    readonly onSet: (key: RatingKey, star: number) => void;
}

/** Renders one labeled star-rating row (ARIA APG radiogroup/radio pattern). */
function StarRatingRow({ ratingKey, value, label, submitting, onSet }: StarRatingRowProps) {
    return (
        <div className={styles.ratingRow}>
            <span className={styles.ratingLabel}>{label}</span>
            {/* biome-ignore lint/a11y/useSemanticElements: button+role=radio is the ARIA APG pattern for star ratings */}
            <div
                className={styles.starGroup}
                role="radiogroup"
                aria-label={label}
            >
                {[1, 2, 3, 4, 5].map((star) => (
                    <button
                        key={star}
                        type="button"
                        // biome-ignore lint/a11y/useSemanticElements: button+role=radio is the ARIA APG pattern
                        role="radio"
                        aria-checked={value === star}
                        aria-label={`${label}: ${star}`}
                        className={cn(styles.starButton, star <= value && styles.starButtonOn)}
                        onClick={() => onSet(ratingKey, star)}
                        disabled={submitting}
                    >
                        <StarIcon />
                    </button>
                ))}
            </div>
        </div>
    );
}

// ---------------------------------------------------------------------------

interface DestinationReviewSidebarCardProps {
    readonly destinationId: string;
    readonly destinationName: string;
    readonly locale: SupportedLocale;
    readonly apiUrl: string;
}

/**
 * Sidebar card island for submitting a destination review.
 *
 * Always shows the "Dejar reseña" CTA. Auth gating happens at the page level.
 * The form opens in a native <dialog> for automatic focus-trap and ESC.
 *
 * @param props - Destination context and API base URL
 */
export function DestinationReviewSidebarCard({
    destinationId,
    destinationName,
    locale,
    apiUrl
}: DestinationReviewSidebarCardProps) {
    const { t } = createTranslations(locale);
    const dialogRef = useRef<HTMLDialogElement>(null);

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

    const setStar = useCallback((key: RatingKey, value: number) => {
        setRatings((prev) => ({ ...prev, [key]: value }));
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

    return (
        <>
            <aside
                className={styles.card}
                aria-labelledby="dest-review-sidebar-card-title"
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
                        id="dest-review-sidebar-card-title"
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
                    {t('review.destinationSidebar.cta', 'Dejar reseña')}
                    <ArrowIcon />
                </button>
            </aside>

            <dialog
                ref={dialogRef}
                className={styles.dialog}
                aria-labelledby="dest-review-dialog-title"
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
                                        id="dest-review-dialog-title"
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
                                <div
                                    className={styles.ratingList}
                                    aria-label={t('review.form.ratingLabel', 'Calificación')}
                                >
                                    {RATING_KEYS.map((key) => (
                                        <StarRatingRow
                                            key={key}
                                            ratingKey={key}
                                            value={ratings[key]}
                                            label={t(
                                                `destination.rating.dimensions.${key}`,
                                                DEFAULT_LABELS[key]
                                            )}
                                            submitting={submitting}
                                            onSet={setStar}
                                        />
                                    ))}
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
