import { StarIcon } from '@repo/icons';
import type { JSX } from 'react';
import { useState } from 'react';

/**
 * Form data for review submission
 */
export interface ReviewFormData {
    readonly rating: number;
    readonly title: string;
    readonly content: string;
}

/**
 * Props for the ReviewForm component
 */
export interface ReviewFormProps {
    /**
     * Entity ID to review
     */
    readonly entityId: string;

    /**
     * Type of entity being reviewed
     */
    readonly entityType: 'accommodation' | 'destination' | 'event';

    /**
     * Locale for UI text
     * @default 'es'
     */
    readonly locale?: 'es' | 'en';

    /**
     * Callback fired when form is submitted with valid data
     */
    readonly onSubmit?: (data: ReviewFormData) => void;

    /**
     * Callback fired when cancel button is clicked
     */
    readonly onCancel?: () => void;

    /**
     * Additional CSS classes to apply to the component
     */
    readonly className?: string;
}

/**
 * Validation errors for form fields
 */
interface ValidationErrors {
    rating?: string;
    title?: string;
    content?: string;
}

/**
 * Localized text strings
 */
const translations = {
    es: {
        ratingLabel: 'Calificación',
        titleLabel: 'Título',
        titlePlaceholder: 'Resumen de tu experiencia',
        contentLabel: 'Comentario',
        contentPlaceholder: 'Comparte tu experiencia en detalle...',
        submitButton: 'Enviar reseña',
        cancelButton: 'Cancelar',
        errors: {
            ratingRequired: 'Debes seleccionar una calificación',
            titleRequired: 'El título es requerido',
            titleMinLength: 'El título debe tener al menos 3 caracteres',
            contentRequired: 'El comentario es requerido',
            contentMinLength: 'El comentario debe tener al menos 10 caracteres'
        }
    },
    en: {
        ratingLabel: 'Rating',
        titleLabel: 'Title',
        titlePlaceholder: 'Summary of your experience',
        contentLabel: 'Review',
        contentPlaceholder: 'Share your experience in detail...',
        submitButton: 'Submit review',
        cancelButton: 'Cancel',
        errors: {
            ratingRequired: 'You must select a rating',
            titleRequired: 'Title is required',
            titleMinLength: 'Title must be at least 3 characters',
            contentRequired: 'Review is required',
            contentMinLength: 'Review must be at least 10 characters'
        }
    }
};

/**
 * ReviewForm component
 *
 * A form for submitting reviews with star rating, title, and content.
 * Includes client-side validation and localized error messages.
 *
 * @param props - Component props
 * @returns React component
 *
 * @example
 * ```tsx
 * <ReviewForm
 *   entityId="123"
 *   entityType="accommodation"
 *   locale="es"
 *   onSubmit={(data) => console.log('Review submitted:', data)}
 *   onCancel={() => console.log('Cancelled')}
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

    const t = translations[locale];

    /**
     * Validates form data
     * @param data - Form data to validate
     * @returns Validation errors or empty object if valid
     */
    const validateForm = (data: {
        rating: number;
        title: string;
        content: string;
    }): ValidationErrors => {
        const validationErrors: ValidationErrors = {};

        if (data.rating < 1) {
            validationErrors.rating = t.errors.ratingRequired;
        }

        if (!data.title.trim()) {
            validationErrors.title = t.errors.titleRequired;
        } else if (data.title.trim().length < 3) {
            validationErrors.title = t.errors.titleMinLength;
        }

        if (!data.content.trim()) {
            validationErrors.content = t.errors.contentRequired;
        } else if (data.content.trim().length < 10) {
            validationErrors.content = t.errors.contentMinLength;
        }

        return validationErrors;
    };

    /**
     * Handles form submission
     */
    const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();

        const formData = {
            rating,
            title: title.trim(),
            content: content.trim()
        };

        const validationErrors = validateForm(formData);
        setErrors(validationErrors);

        if (Object.keys(validationErrors).length === 0) {
            onSubmit?.(formData);
        }
    };

    /**
     * Handles star click
     */
    const handleStarClick = (value: number) => {
        setRating(value);
        if (errors.rating) {
            setErrors({ ...errors, rating: undefined });
        }
    };

    /**
     * Handles title change
     */
    const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setTitle(e.target.value);
        if (errors.title) {
            setErrors({ ...errors, title: undefined });
        }
    };

    /**
     * Handles content change
     */
    const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setContent(e.target.value);
        if (errors.content) {
            setErrors({ ...errors, content: undefined });
        }
    };

    /**
     * Renders a single star
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
                aria-label={`Rate ${value} star${value > 1 ? 's' : ''}`}
                className="rounded p-1 transition-transform hover:scale-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
            >
                <StarIcon
                    size={32}
                    weight={isFilled ? 'fill' : 'regular'}
                    className={isFilled ? 'text-yellow-400' : 'text-gray-300'}
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
                    className="mb-2 block font-medium text-gray-700 text-sm"
                >
                    {t.ratingLabel}
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
                        className="mt-2 text-red-600 text-sm"
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
                    className="mb-2 block font-medium text-gray-700 text-sm"
                >
                    {t.titleLabel}
                </label>
                <input
                    type="text"
                    id="review-title"
                    value={title}
                    onChange={handleTitleChange}
                    placeholder={t.titlePlaceholder}
                    aria-required="true"
                    aria-invalid={!!errors.title}
                    aria-describedby={errors.title ? 'title-error' : undefined}
                    className="w-full rounded-md border border-gray-300 px-4 py-2 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-primary"
                />
                {errors.title && (
                    <p
                        id="title-error"
                        className="mt-2 text-red-600 text-sm"
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
                    className="mb-2 block font-medium text-gray-700 text-sm"
                >
                    {t.contentLabel}
                </label>
                <textarea
                    id="review-content"
                    value={content}
                    onChange={handleContentChange}
                    placeholder={t.contentPlaceholder}
                    rows={5}
                    aria-required="true"
                    aria-invalid={!!errors.content}
                    aria-describedby={errors.content ? 'content-error' : undefined}
                    className="resize-vertical w-full rounded-md border border-gray-300 px-4 py-2 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-primary"
                />
                {errors.content && (
                    <p
                        id="content-error"
                        className="mt-2 text-red-600 text-sm"
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
                        className="rounded-md border border-gray-300 px-6 py-2 text-gray-700 transition-colors hover:bg-gray-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
                    >
                        {t.cancelButton}
                    </button>
                )}
                <button
                    type="submit"
                    className="rounded-md bg-primary px-6 py-2 text-white transition-colors hover:bg-primary-dark focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2"
                >
                    {t.submitButton}
                </button>
            </div>
        </form>
    );
}
