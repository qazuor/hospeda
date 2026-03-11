import { StarIcon } from '@repo/icons';
import type { JSX } from 'react';
import { useMemo, useState } from 'react';
import { useTranslation } from '../../hooks/useTranslation';
import { reviewsApi } from '../../lib/api/endpoints-protected';
import type { SupportedLocale } from '../../lib/i18n';
import { createTranslations } from '../../lib/i18n';
import { validateField } from '../../lib/validation/validate-field';
import { addToast } from '../../store/toast-store';
import { FormError } from '../ui/FormError';

/**
 * Rating aspect keys matching the AccommodationRatingSchema.
 */
const RATING_ASPECTS = [
    'cleanliness',
    'hospitality',
    'services',
    'accuracy',
    'communication',
    'location'
] as const;

type RatingAspect = (typeof RATING_ASPECTS)[number];

/**
 * Ratings object with one 0-5 score per aspect.
 */
export type AspectRatings = Readonly<Record<RatingAspect, number>>;

/**
 * Form data for review submission.
 */
export interface ReviewFormData {
    readonly ratings: AspectRatings;
    readonly title: string;
    readonly content: string;
}

/**
 * Props for the ReviewForm component.
 */
export interface ReviewFormProps {
    /**
     * Entity ID to review (accommodation UUID).
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
     * Callback fired after the review is successfully submitted.
     */
    readonly onSubmit?: (data: ReviewFormData) => void;

    /**
     * Callback fired when cancel button is clicked.
     */
    readonly onCancel?: () => void;

    /**
     * Additional CSS classes applied to the form element.
     */
    readonly className?: string;
}

/**
 * Per-field validation error messages.
 */
interface ValidationErrors {
    ratings?: string;
    title?: string;
    content?: string;
}

const INITIAL_RATINGS: AspectRatings = {
    cleanliness: 0,
    hospitality: 0,
    services: 0,
    accuracy: 0,
    communication: 0,
    location: 0
};

/**
 * ReviewForm component.
 *
 * Renders a review form with per-aspect star ratings (cleanliness, hospitality,
 * services, accuracy, communication, location), a title field, and a content
 * textarea. Submits to POST /api/v1/protected/accommodations/:id/reviews.
 *
 * @param props - Component props.
 * @returns The rendered review form.
 */
export function ReviewForm({
    entityId,
    entityType,
    locale = 'es',
    onSubmit,
    onCancel,
    className = ''
}: ReviewFormProps): JSX.Element {
    const [ratings, setRatings] = useState<AspectRatings>(INITIAL_RATINGS);
    const [hoveredRatings, setHoveredRatings] = useState<AspectRatings>(INITIAL_RATINGS);
    const [title, setTitle] = useState<string>('');
    const [content, setContent] = useState<string>('');
    const [errors, setErrors] = useState<ValidationErrors>({});
    const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

    const { t } = useTranslation({ locale: locale as SupportedLocale, namespace: 'review' });
    const { t: tUi } = useTranslation({ locale: locale as SupportedLocale, namespace: 'ui' });

    // Base translation function (no namespace) used to resolve generic
    // validationError.field.* keys returned by validateField.
    const { t: tBase } = useMemo(() => createTranslations(locale as SupportedLocale), [locale]);

    /**
     * Translates a `validationError.field.*` key returned by `validateField`
     * into a human-readable string using the standard validation namespace.
     *
     * @param key - i18n key like `validationError.field.required`
     * @returns Translated string or the raw key as fallback
     */
    const resolveValidationKey = (key: string): string =>
        tBase(key.replace('validationError.', 'validation.'));

    /**
     * Validates the form fields and returns any per-field error messages.
     */
    const validateForm = (data: {
        ratings: AspectRatings;
        title: string;
        content: string;
    }): ValidationErrors => {
        const validationErrors: ValidationErrors = {};

        const allRated = RATING_ASPECTS.every((aspect) => data.ratings[aspect] >= 1);
        if (!allRated) {
            validationErrors.ratings = t('form.errors.ratingRequired');
        }

        const titleKey = validateField(data.title, { required: true, minLength: 3 });
        if (titleKey) validationErrors.title = resolveValidationKey(titleKey);

        const contentKey = validateField(data.content, { required: true, minLength: 10 });
        if (contentKey) validationErrors.content = resolveValidationKey(contentKey);

        return validationErrors;
    };

    /**
     * Handles the form submit event: validates, calls API, shows toast.
     */
    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
        e.preventDefault();

        const formData: ReviewFormData = {
            ratings,
            title: title.trim(),
            content: content.trim()
        };

        const validationErrors = validateForm(formData);
        setErrors(validationErrors);

        if (Object.keys(validationErrors).length > 0) {
            return;
        }

        setIsSubmitting(true);

        try {
            const result = await reviewsApi.createAccommodationReview({
                accommodationId: entityId,
                body: {
                    rating: formData.ratings,
                    title: formData.title || undefined,
                    content: formData.content || undefined
                }
            });

            if (!result.ok) {
                const errorMessage =
                    result.error.code === 'ALREADY_EXISTS'
                        ? t('form.errors.alreadyReviewed')
                        : t('form.errors.submitFailed');
                addToast({ type: 'error', message: errorMessage });
                return;
            }

            addToast({ type: 'success', message: t('form.submitSuccess') });
            onSubmit?.(formData);

            // Reset form after successful submission
            setRatings(INITIAL_RATINGS);
            setTitle('');
            setContent('');
            setErrors({});
        } catch (_err) {
            addToast({ type: 'error', message: t('form.errors.submitFailed') });
        } finally {
            setIsSubmitting(false);
        }
    };

    /**
     * Updates the selected star rating for a specific aspect and clears errors.
     */
    const handleStarClick = ({ aspect, value }: { aspect: RatingAspect; value: number }): void => {
        setRatings((prev) => ({ ...prev, [aspect]: value }));
        if (errors.ratings) {
            setErrors((prev) => ({ ...prev, ratings: undefined }));
        }
    };

    /**
     * Updates the title field and clears its error if set.
     */
    const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
        setTitle(e.target.value);
        if (errors.title) {
            setErrors((prev) => ({ ...prev, title: undefined }));
        }
    };

    /**
     * Updates the content field and clears its error if set.
     */
    const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>): void => {
        setContent(e.target.value);
        if (errors.content) {
            setErrors((prev) => ({ ...prev, content: undefined }));
        }
    };

    /**
     * Renders a single interactive star button for a rating aspect.
     */
    const renderStar = ({
        aspect,
        index
    }: { aspect: RatingAspect; index: number }): JSX.Element => {
        const value = index + 1;
        const isFilled = value <= (hoveredRatings[aspect] || ratings[aspect]);

        return (
            <button
                key={`${aspect}-${index}`}
                type="button"
                onClick={() => handleStarClick({ aspect, value })}
                onMouseEnter={() => setHoveredRatings((prev) => ({ ...prev, [aspect]: value }))}
                onMouseLeave={() => setHoveredRatings((prev) => ({ ...prev, [aspect]: 0 }))}
                aria-label={tUi('accessibility.rateStars', undefined, { count: value })}
                className="rounded p-0.5 transition-transform hover:scale-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
                disabled={isSubmitting}
            >
                <StarIcon
                    size={24}
                    weight={isFilled ? 'fill' : 'regular'}
                    className={isFilled ? 'text-accent' : 'text-muted-foreground'}
                    aria-hidden="true"
                />
            </button>
        );
    };

    /**
     * Renders the star rating row for one aspect.
     */
    const renderAspectRating = (aspect: RatingAspect): JSX.Element => {
        return (
            <div
                key={aspect}
                className="flex items-center justify-between gap-4"
            >
                <span className="min-w-[120px] text-foreground text-sm">
                    {t(`form.ratingAspects.${aspect}`)}
                </span>
                <div className="flex gap-0.5">
                    {Array.from({ length: 5 }, (_, i) => renderStar({ aspect, index: i }))}
                </div>
            </div>
        );
    };

    return (
        <form
            onSubmit={handleSubmit}
            className={`space-y-6 ${className}`.trim()}
            data-entity-id={entityId}
            data-entity-type={entityType}
        >
            {/* Rating Aspects */}
            <fieldset
                aria-required="true"
                aria-invalid={!!errors.ratings}
                aria-describedby={errors.ratings ? 'ratings-error' : undefined}
                className="m-0 space-y-2 border-none p-0"
            >
                <legend className="mb-3 block font-medium text-foreground text-sm">
                    {t('form.ratingLabel')}
                </legend>
                {RATING_ASPECTS.map((aspect) => renderAspectRating(aspect))}
            </fieldset>
            <FormError
                fieldName="ratings"
                error={errors.ratings}
            />

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
                    disabled={isSubmitting}
                    className={`w-full rounded-md border bg-card px-4 py-2 text-card-foreground focus:outline-none focus:ring-2 ${
                        errors.title
                            ? 'border-destructive focus:border-destructive focus:ring-destructive'
                            : 'border-border focus:border-transparent focus:ring-primary'
                    }`}
                />
                <FormError
                    fieldName="title"
                    error={errors.title}
                />
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
                    disabled={isSubmitting}
                    className={`resize-vertical w-full rounded-md border bg-card px-4 py-2 text-card-foreground focus:outline-none focus:ring-2 ${
                        errors.content
                            ? 'border-destructive focus:border-destructive focus:ring-destructive'
                            : 'border-border focus:border-transparent focus:ring-primary'
                    }`}
                />
                <FormError
                    fieldName="content"
                    error={errors.content}
                />
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end gap-4">
                {onCancel && (
                    <button
                        type="button"
                        onClick={onCancel}
                        disabled={isSubmitting}
                        className="rounded-md border border-border bg-card px-6 py-2 text-card-foreground transition-colors hover:bg-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
                    >
                        {t('form.cancelButton')}
                    </button>
                )}
                <button
                    type="submit"
                    disabled={isSubmitting}
                    className="rounded-md bg-primary px-6 py-2 text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
                >
                    {isSubmitting ? t('form.submittingButton') : t('form.submitButton')}
                </button>
            </div>
        </form>
    );
}
