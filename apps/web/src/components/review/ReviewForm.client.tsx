import { StarIcon } from '@repo/icons';
import type { JSX } from 'react';
import { useState } from 'react';
import { useTranslation } from '../../hooks/useTranslation';
import type { SupportedLocale } from '../../lib/i18n';
import { addToast } from '../../store/toast-store';

/**
 * Form data for review submission.
 */
export interface ReviewFormData {
    readonly rating: number;
    readonly title: string;
    readonly content: string;
}

/**
 * Props for the ReviewForm component.
 */
export interface ReviewFormProps {
    /**
     * Entity ID to review.
     */
    readonly entityId: string;

    /**
     * Type of entity being reviewed.
     */
    readonly entityType: 'accommodation' | 'destination' | 'event';

    /**
     * Locale for UI text translations.
     * @default 'es'
     */
    readonly locale?: string;

    /**
     * Callback fired when form is submitted with valid data.
     * NOTE: Actual API integration is deferred. This callback receives the
     * validated form data for future wiring.
     */
    readonly onSubmit?: (data: ReviewFormData) => void;

    /**
     * Callback fired when cancel button is clicked.
     */
    readonly onCancel?: () => void;

    /**
     * Additional CSS classes applied to the `<form>` element.
     */
    readonly className?: string;
}

/**
 * Per-field validation error messages.
 */
interface ValidationErrors {
    rating?: string;
    title?: string;
    content?: string;
}

/**
 * ReviewForm component.
 *
 * Renders a review form with a clickable 5-star rating input, a title field,
 * and a content textarea. Performs client-side validation (rating required,
 * title min 3 chars, content min 10 chars) before submission.
 *
 * Submit is a placeholder: shows a success toast and logs data to the console.
 * Actual API integration is deferred.
 *
 * Intentionally uses manual validation (no react-hook-form) because the form
 * is simple (3 fields, basic rules) and adding a heavy form library is not
 * justified (YAGNI).
 *
 * @param props - Component props.
 * @returns The rendered review form.
 *
 * @example
 * ```tsx
 * <ReviewForm
 *   entityId="abc-123"
 *   entityType="accommodation"
 *   locale="es"
 *   onSubmit={(data) => console.log('Review:', data)}
 *   onCancel={() => setShowForm(false)}
 * />
 * ```
 */
export function ReviewForm({
    entityId,
    entityType,
    locale = 'es',
    onSubmit,
    onCancel,
    className = ''
}: ReviewFormProps): JSX.Element {
    const [rating, setRating] = useState<number>(0);
    const [hoveredRating, setHoveredRating] = useState<number>(0);
    const [title, setTitle] = useState<string>('');
    const [content, setContent] = useState<string>('');
    const [errors, setErrors] = useState<ValidationErrors>({});

    const { t } = useTranslation({ locale: locale as SupportedLocale, namespace: 'review' });
    const { t: tUi } = useTranslation({ locale: locale as SupportedLocale, namespace: 'ui' });

    /**
     * Validates the form fields and returns any per-field error messages.
     *
     * @param data - Snapshot of form fields to validate.
     * @returns An object with field-level error messages, or `{}` when valid.
     */
    const validateForm = (data: {
        rating: number;
        title: string;
        content: string;
    }): ValidationErrors => {
        const validationErrors: ValidationErrors = {};

        if (data.rating < 1) {
            validationErrors.rating = t('form.errors.ratingRequired');
        }

        if (!data.title.trim()) {
            validationErrors.title = t('form.errors.titleRequired');
        } else if (data.title.trim().length < 3) {
            validationErrors.title = t('form.errors.titleMinLength');
        }

        if (!data.content.trim()) {
            validationErrors.content = t('form.errors.contentRequired');
        } else if (data.content.trim().length < 10) {
            validationErrors.content = t('form.errors.contentMinLength');
        }

        return validationErrors;
    };

    /**
     * Handles the form submit event: validates fields, then fires the
     * placeholder submit (toast + console.log). Actual API wiring is deferred.
     *
     * @param e - The React form submit event.
     */
    const handleSubmit = (e: React.FormEvent<HTMLFormElement>): void => {
        e.preventDefault();

        const formData: ReviewFormData = {
            rating,
            title: title.trim(),
            content: content.trim()
        };

        const validationErrors = validateForm(formData);
        setErrors(validationErrors);

        if (Object.keys(validationErrors).length > 0) {
            return;
        }

        // Placeholder submit: show toast. API integration is deferred.
        // TODO: Replace with actual API call to POST /api/v1/protected/reviews
        addToast({ type: 'success', message: t('form.submitSuccessPlaceholder') });

        onSubmit?.(formData);
    };

    /**
     * Updates the selected star rating and clears the rating error if set.
     *
     * @param value - Star value selected (1-5).
     */
    const handleStarClick = (value: number): void => {
        setRating(value);
        if (errors.rating) {
            setErrors((prev) => ({ ...prev, rating: undefined }));
        }
    };

    /**
     * Updates the title field and clears its error if set.
     *
     * @param e - The React change event from the input element.
     */
    const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
        setTitle(e.target.value);
        if (errors.title) {
            setErrors((prev) => ({ ...prev, title: undefined }));
        }
    };

    /**
     * Updates the content field and clears its error if set.
     *
     * @param e - The React change event from the textarea element.
     */
    const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>): void => {
        setContent(e.target.value);
        if (errors.content) {
            setErrors((prev) => ({ ...prev, content: undefined }));
        }
    };

    /**
     * Renders a single interactive star button.
     *
     * @param index - Zero-based index of the star (0-4).
     * @returns A button element wrapping a StarIcon.
     */
    const renderStar = (index: number): JSX.Element => {
        const value = index + 1;
        const isFilled = value <= (hoveredRating || rating);

        return (
            <button
                key={index}
                type="button"
                onClick={() => handleStarClick(value)}
                onMouseEnter={() => setHoveredRating(value)}
                onMouseLeave={() => setHoveredRating(0)}
                aria-label={tUi('accessibility.rateStars', undefined, { count: value })}
                className="rounded p-1 transition-transform hover:scale-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
            >
                <StarIcon
                    size={32}
                    weight={isFilled ? 'fill' : 'regular'}
                    className={isFilled ? 'text-accent' : 'text-muted-foreground'}
                    aria-hidden="true"
                />
            </button>
        );
    };

    return (
        <form
            onSubmit={handleSubmit}
            className={`space-y-6 ${className}`.trim()}
            data-entity-id={entityId}
            data-entity-type={entityType}
        >
            {/* Rating Field */}
            <div>
                <span
                    id="rating-label"
                    className="mb-2 block font-medium text-foreground text-sm"
                >
                    {t('form.ratingLabel')}
                </span>
                <div
                    role="radiogroup"
                    aria-labelledby="rating-label"
                    aria-required="true"
                    aria-invalid={!!errors.rating}
                    className="flex gap-1"
                >
                    {Array.from({ length: 5 }, (_, i) => renderStar(i))}
                </div>
                {errors.rating && (
                    <p
                        className="mt-2 text-destructive text-sm"
                        role="alert"
                        aria-live="polite"
                    >
                        {errors.rating}
                    </p>
                )}
            </div>

            {/* Title Field */}
            <div>
                <label
                    htmlFor="review-title"
                    className="mb-2 block font-medium text-foreground text-sm"
                >
                    {t('form.titleLabel')}
                </label>
                <input
                    type="text"
                    id="review-title"
                    value={title}
                    onChange={handleTitleChange}
                    placeholder={t('form.titlePlaceholder')}
                    aria-required="true"
                    aria-invalid={!!errors.title}
                    aria-describedby={errors.title ? 'title-error' : undefined}
                    className={`w-full rounded-md border bg-card px-4 py-2 text-card-foreground focus:outline-none focus:ring-2 ${
                        errors.title
                            ? 'border-destructive focus:border-destructive focus:ring-destructive'
                            : 'border-border focus:border-transparent focus:ring-primary'
                    }`}
                />
                {errors.title && (
                    <p
                        id="title-error"
                        className="mt-2 text-destructive text-sm"
                        role="alert"
                        aria-live="polite"
                    >
                        {errors.title}
                    </p>
                )}
            </div>

            {/* Content Field */}
            <div>
                <label
                    htmlFor="review-content"
                    className="mb-2 block font-medium text-foreground text-sm"
                >
                    {t('form.contentLabel')}
                </label>
                <textarea
                    id="review-content"
                    value={content}
                    onChange={handleContentChange}
                    placeholder={t('form.contentPlaceholder')}
                    rows={5}
                    aria-required="true"
                    aria-invalid={!!errors.content}
                    aria-describedby={errors.content ? 'content-error' : undefined}
                    className={`resize-vertical w-full rounded-md border bg-card px-4 py-2 text-card-foreground focus:outline-none focus:ring-2 ${
                        errors.content
                            ? 'border-destructive focus:border-destructive focus:ring-destructive'
                            : 'border-border focus:border-transparent focus:ring-primary'
                    }`}
                />
                {errors.content && (
                    <p
                        id="content-error"
                        className="mt-2 text-destructive text-sm"
                        role="alert"
                        aria-live="polite"
                    >
                        {errors.content}
                    </p>
                )}
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end gap-4">
                {onCancel && (
                    <button
                        type="button"
                        onClick={onCancel}
                        className="rounded-md border border-border bg-card px-6 py-2 text-card-foreground transition-colors hover:bg-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
                    >
                        {t('form.cancelButton')}
                    </button>
                )}
                <button
                    type="submit"
                    className="rounded-md bg-primary px-6 py-2 text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
                >
                    {t('form.submitButton')}
                </button>
            </div>
        </form>
    );
}
