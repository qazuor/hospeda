/**
 * @file ReviewForm.client.tsx
 * @description Authenticated review form mounted in the accommodation detail
 * page. The six sub-rating rows + optional title + optional content map 1:1 to
 * the protected accommodation review POST endpoint. On success the page
 * reloads so the new review shows up in the surrounding ReviewPreview / List.
 *
 * The form is gated server-side by the parent page — it is only mounted when
 * the visitor has already contacted the host for this property.
 */

import { translateApiError } from '@/lib/api-errors';
import { cn } from '@/lib/cn';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import { type FormEvent, useCallback, useMemo, useState } from 'react';
import styles from './ReviewForm.module.css';

/** Rating sub-categories the API expects. */
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

interface ReviewFormProps {
    readonly accommodationId: string;
    readonly accommodationName: string;
    readonly locale: SupportedLocale;
    readonly apiUrl: string;
}

const TITLE_MAX = 120;
const CONTENT_MAX = 2000;

/** Trim trailing slash so URL concat never yields `/api/v1//...`. */
function joinApi(apiUrl: string, path: string): string {
    return `${apiUrl.replace(/\/$/, '')}${path}`;
}

/**
 * Form for the authenticated guest to leave a review on the current
 * accommodation. All six sub-ratings must be set (1-5) before submit.
 */
export function ReviewForm({
    accommodationId,
    accommodationName,
    locale,
    apiUrl
}: ReviewFormProps) {
    const { t } = createTranslations(locale);

    const [ratings, setRatings] = useState<RatingState>(INITIAL_RATINGS);
    const [hoverRatings, setHoverRatings] = useState<Partial<Record<RatingKey, number>>>({});
    const [title, setTitle] = useState<string>('');
    const [content, setContent] = useState<string>('');
    const [submitting, setSubmitting] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<boolean>(false);

    const allRated = RATING_KEYS.every((key) => ratings[key] >= 1);
    const ratedCount = RATING_KEYS.filter((key) => ratings[key] >= 1).length;
    const averageRating = useMemo(() => {
        const sum = RATING_KEYS.reduce((acc, key) => acc + ratings[key], 0);
        const count = RATING_KEYS.filter((key) => ratings[key] >= 1).length;
        return count > 0 ? sum / count : 0;
    }, [ratings]);

    const setStar = useCallback((key: RatingKey, value: number) => {
        setRatings((prev) => ({ ...prev, [key]: value }));
    }, []);

    const setHover = useCallback((key: RatingKey, value: number | null) => {
        setHoverRatings((prev) => {
            if (value === null) {
                const { [key]: _removed, ...rest } = prev;
                return rest;
            }
            return { ...prev, [key]: value };
        });
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
                // Give the success message a beat before reloading so the
                // user notices the confirmation, then refresh to surface
                // the new review in the surrounding list.
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

    if (success) {
        return (
            <section
                className={cn(styles.wrapper, styles.successWrapper)}
                aria-labelledby="review-form-success-title"
            >
                <div
                    className={styles.successBadge}
                    aria-hidden="true"
                >
                    <svg
                        viewBox="0 0 24 24"
                        width="32"
                        height="32"
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
                </div>
                <output
                    id="review-form-success-title"
                    className={styles.successMessage}
                >
                    {t('review.form.submitSuccess', '¡Gracias! Tu reseña fue enviada con éxito.')}
                </output>
            </section>
        );
    }

    return (
        <section
            className={styles.wrapper}
            aria-labelledby="review-form-heading"
        >
            <header className={styles.header}>
                <div
                    className={styles.headerBadge}
                    aria-hidden="true"
                >
                    <svg
                        viewBox="0 0 24 24"
                        width="22"
                        height="22"
                        fill="currentColor"
                        aria-hidden="true"
                        focusable="false"
                    >
                        <title>Reseña</title>
                        <path d="M12 2l2.92 5.92 6.53.95-4.72 4.6 1.11 6.5L12 17.6l-5.84 3.07 1.11-6.5-4.72-4.6 6.53-.95L12 2z" />
                    </svg>
                </div>
                <div>
                    <h3
                        id="review-form-heading"
                        className={styles.heading}
                    >
                        {t('review.list.writeReview', 'Escribir reseña')}
                    </h3>
                    <p className={styles.subheading}>
                        {t(
                            'review.form.subheading',
                            'Compartí tu experiencia en {{name}} para ayudar a otros viajeros.',
                            { name: accommodationName }
                        )}
                    </p>
                </div>
            </header>

            <form
                className={styles.form}
                onSubmit={handleSubmit}
                noValidate
            >
                <fieldset
                    className={styles.fieldset}
                    disabled={submitting}
                >
                    <div className={styles.fieldsetHeader}>
                        <legend className={styles.legend}>
                            {t('review.form.ratingLabel', 'Calificación')}
                        </legend>
                        <span className={styles.fieldsetHelp}>
                            {t(
                                'review.form.ratingHelp',
                                'Tocá las estrellas para puntuar cada aspecto'
                            )}
                        </span>
                        {averageRating > 0 && (
                            <span
                                className={styles.averagePill}
                                aria-label={`Promedio actual: ${averageRating.toFixed(1)} de 5`}
                            >
                                <svg
                                    viewBox="0 0 24 24"
                                    width="14"
                                    height="14"
                                    fill="currentColor"
                                    aria-hidden="true"
                                    focusable="false"
                                >
                                    <title>Estrella</title>
                                    <path d="M12 2l2.92 5.92 6.53.95-4.72 4.6 1.11 6.5L12 17.6l-5.84 3.07 1.11-6.5-4.72-4.6 6.53-.95L12 2z" />
                                </svg>
                                <strong>{averageRating.toFixed(1)}</strong>
                                <span className={styles.averagePillCount}>
                                    · {ratedCount}/{RATING_KEYS.length}
                                </span>
                            </span>
                        )}
                    </div>

                    <div className={styles.ratingGrid}>
                        {RATING_KEYS.map((key) => {
                            const value = ratings[key];
                            const hoverValue = hoverRatings[key];
                            const displayValue = hoverValue ?? value;
                            const label = t(
                                `review.form.ratingAspects.${key}`,
                                DEFAULT_RATING_LABELS[key]
                            );
                            return (
                                <div
                                    key={key}
                                    className={cn(
                                        styles.ratingRow,
                                        value > 0 && styles.ratingRowSet
                                    )}
                                >
                                    <span className={styles.ratingLabel}>{label}</span>
                                    <div
                                        className={styles.starGroup}
                                        role="radiogroup"
                                        aria-label={label}
                                        onMouseLeave={() => setHover(key, null)}
                                    >
                                        {[1, 2, 3, 4, 5].map((star) => (
                                            <button
                                                key={star}
                                                type="button"
                                                // biome-ignore lint/a11y/useSemanticElements: button+role=radio is the WAI-ARIA Authoring Practices pattern for star ratings; <input type=radio> can't host the star glyph cleanly.
                                                role="radio"
                                                aria-checked={value === star}
                                                aria-label={`${label}: ${star}`}
                                                className={cn(
                                                    styles.starButton,
                                                    star <= displayValue && styles.starButtonOn,
                                                    hoverValue !== undefined &&
                                                        star <= hoverValue &&
                                                        styles.starButtonHover
                                                )}
                                                onClick={() => setStar(key, star)}
                                                onMouseEnter={() => setHover(key, star)}
                                                onFocus={() => setHover(key, star)}
                                                onBlur={() => setHover(key, null)}
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
                                    <span
                                        className={cn(
                                            styles.ratingHint,
                                            displayValue > 0 && styles.ratingHintSet
                                        )}
                                        aria-hidden="true"
                                    >
                                        {displayValue > 0 ? RATING_DESCRIPTORS[displayValue] : '—'}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                </fieldset>

                <div className={styles.fieldsRow}>
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
                        <span className={styles.charCounter}>
                            {title.length}/{TITLE_MAX}
                        </span>
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
                            rows={5}
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
                </div>

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

                    {!allRated && (
                        <p className={styles.helpText}>
                            <svg
                                viewBox="0 0 24 24"
                                width="14"
                                height="14"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                aria-hidden="true"
                                focusable="false"
                            >
                                <title>Info</title>
                                <circle
                                    cx="12"
                                    cy="12"
                                    r="10"
                                />
                                <line
                                    x1="12"
                                    y1="8"
                                    x2="12"
                                    y2="12"
                                />
                                <line
                                    x1="12"
                                    y1="16"
                                    x2="12.01"
                                    y2="16"
                                />
                            </svg>
                            {t(
                                'review.form.errors.ratingRequired',
                                'Debes seleccionar una calificación'
                            )}
                        </p>
                    )}
                </div>
            </form>
        </section>
    );
}

const DEFAULT_RATING_LABELS: Record<RatingKey, string> = {
    cleanliness: 'Limpieza',
    hospitality: 'Hospitalidad',
    services: 'Servicios',
    accuracy: 'Veracidad',
    communication: 'Comunicación',
    location: 'Ubicación'
};

const RATING_DESCRIPTORS: Record<number, string> = {
    1: 'Mala',
    2: 'Regular',
    3: 'Buena',
    4: 'Muy buena',
    5: 'Excelente'
};
