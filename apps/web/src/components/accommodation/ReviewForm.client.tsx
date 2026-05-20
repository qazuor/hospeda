/**
 * @file ReviewForm.client.tsx
 * @description Authenticated review form mounted in the accommodation detail
 * page. The six sub-rating rows + optional title + optional content map 1:1 to
 * the protected accommodation review POST endpoint. On success the page
 * reloads so the new review shows up in the surrounding ReviewPreview / List.
 */

import { translateApiError } from '@/lib/api-errors';
import { cn } from '@/lib/cn';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import { type FormEvent, useCallback, useState } from 'react';
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
    const [title, setTitle] = useState<string>('');
    const [content, setContent] = useState<string>('');
    const [submitting, setSubmitting] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<boolean>(false);

    const allRated = RATING_KEYS.every((key) => ratings[key] >= 1);

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
                // Give the success message a beat before reloading so the
                // user notices the confirmation, then refresh to surface
                // the new review in the surrounding list.
                window.setTimeout(() => window.location.reload(), 1200);
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
                className={styles.wrapper}
                aria-labelledby="review-form-success-title"
            >
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

            <form
                className={styles.form}
                onSubmit={handleSubmit}
                noValidate
            >
                <fieldset
                    className={styles.fieldset}
                    disabled={submitting}
                >
                    <legend className={styles.legend}>
                        {t('review.form.ratingLabel', 'Calificación')}
                    </legend>

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
                                            // biome-ignore lint/a11y/useSemanticElements: button+role=radio is the WAI-ARIA Authoring Practices pattern for star ratings; <input type=radio> can't host the star glyph cleanly.
                                            role="radio"
                                            aria-checked={value === star}
                                            aria-label={`${label}: ${star}`}
                                            className={cn(
                                                styles.starButton,
                                                star <= value && styles.starButtonOn
                                            )}
                                            onClick={() => setStar(key, star)}
                                        >
                                            ★
                                        </button>
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                </fieldset>

                <label className={styles.field}>
                    <span className={styles.fieldLabel}>
                        {t('review.form.titleLabel', 'Título')}
                    </span>
                    <input
                        type="text"
                        className={styles.input}
                        value={title}
                        maxLength={120}
                        onChange={(event) => setTitle(event.target.value)}
                        placeholder={t('review.form.titlePlaceholder', 'Resumen de tu experiencia')}
                        disabled={submitting}
                    />
                </label>

                <label className={styles.field}>
                    <span className={styles.fieldLabel}>
                        {t('review.form.contentLabel', 'Comentario')}
                    </span>
                    <textarea
                        className={styles.textarea}
                        value={content}
                        maxLength={2000}
                        rows={4}
                        onChange={(event) => setContent(event.target.value)}
                        placeholder={t(
                            'review.form.contentPlaceholder',
                            'Comparte tu experiencia en detalle...'
                        )}
                        disabled={submitting}
                    />
                </label>

                {error && (
                    <p
                        className={styles.errorMessage}
                        role="alert"
                    >
                        {error}
                    </p>
                )}

                <button
                    type="submit"
                    className={styles.submitButton}
                    disabled={!allRated || submitting}
                >
                    {submitting
                        ? t('review.form.submittingButton', 'Enviando...')
                        : t('review.form.submitButton', 'Enviar reseña')}
                </button>

                {!allRated && (
                    <p className={styles.helpText}>
                        {t(
                            'review.form.errors.ratingRequired',
                            'Debes seleccionar una calificación'
                        )}
                    </p>
                )}
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
