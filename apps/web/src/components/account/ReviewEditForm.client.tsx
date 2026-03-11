import { CancelIcon, SaveIcon } from '@repo/icons';
/**
 * Inline edit form for a single review card.
 * Rendered inside the review card when editing is active.
 */
import { type ChangeEvent, type FormEvent, useMemo, useState } from 'react';
import { useTranslation } from '../../hooks/useTranslation';
import type { SupportedLocale } from '../../lib/i18n';
import { createTranslations } from '../../lib/i18n';
import { validateField } from '../../lib/validation/validate-field';
import { FormError } from '../ui/FormError';

/** State managed by the inline edit form */
export interface EditFormState {
    readonly rating: number;
    readonly title: string;
    readonly content: string;
}

/** Subset of localized messages required by this form */
export interface ReviewEditFormMessages {
    readonly ratingEditLabel: string;
    readonly titleLabel: string;
    readonly contentLabel: string;
    readonly cancelButton: string;
    readonly saveButton: string;
    readonly saving: string;
}

/** Review data passed into the form for pre-filling */
export interface ReviewEditFormReview {
    readonly id: string;
    readonly rating: number;
    readonly title: string;
    readonly content: string;
}

interface ReviewEditFormProps {
    readonly review: ReviewEditFormReview;
    readonly messages: ReviewEditFormMessages;
    readonly onSave: (id: string, data: EditFormState) => Promise<void>;
    readonly onCancel: () => void;
    readonly isSaving: boolean;
    readonly locale?: SupportedLocale;
}

/** Per-field validation errors */
interface EditFormErrors {
    title?: string;
    content?: string;
}

/**
 * Inline edit form for a review.
 * Renders a star selector, title input, and content textarea.
 * Performs client-side validation via `validateField` before calling onSave.
 *
 * @param review - The review data used to pre-fill the form
 * @param messages - Localized string labels
 * @param onSave - Async callback invoked with the updated data on success
 * @param onCancel - Callback invoked when the user cancels editing
 * @param isSaving - When true, disables controls and shows saving indicator
 * @param locale - Locale for UI translations (defaults to 'es')
 */
export function ReviewEditForm({
    review,
    messages,
    onSave,
    onCancel,
    isSaving,
    locale = 'es'
}: ReviewEditFormProps) {
    const { t: tUi } = useTranslation({ locale, namespace: 'ui' });
    const [form, setForm] = useState<EditFormState>({
        rating: review.rating,
        title: review.title,
        content: review.content
    });
    const [errors, setErrors] = useState<EditFormErrors>({});

    // Base translation function (no namespace) for resolving validateField keys.
    const { t: tBase } = useMemo(() => createTranslations(locale), [locale]);

    /**
     * Translates a `validationError.field.*` key from validateField into a
     * human-readable string via the standard `validation.*` namespace.
     */
    const resolveValidationKey = (key: string): string =>
        tBase(key.replace('validationError.', 'validation.'));

    const handleRatingChange = (value: number) => {
        setForm((prev) => ({ ...prev, rating: value }));
    };

    const handleFieldChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setForm((prev) => ({ ...prev, [name]: value }));
        // Clear error for the changed field
        if (name === 'title' || name === 'content') {
            setErrors((prev) => ({ ...prev, [name]: undefined }));
        }
    };

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();

        const validationErrors: EditFormErrors = {};

        const titleKey = validateField(form.title, { required: true, minLength: 3 });
        if (titleKey) validationErrors.title = resolveValidationKey(titleKey);

        const contentKey = validateField(form.content, { required: true, minLength: 10 });
        if (contentKey) validationErrors.content = resolveValidationKey(contentKey);

        setErrors(validationErrors);

        if (Object.keys(validationErrors).length > 0) {
            return;
        }

        await onSave(review.id, form);
    };

    const titleErrorId = `edit-title-${review.id}-error`;
    const contentErrorId = `edit-content-${review.id}-error`;

    return (
        <form
            onSubmit={handleSubmit}
            className="space-y-3"
        >
            {/* Star rating selector */}
            <div>
                <span className="mb-1 block font-medium text-text text-xs">
                    {messages.ratingEditLabel}
                </span>
                <div
                    className="flex gap-1"
                    role="radiogroup"
                    aria-label={messages.ratingEditLabel}
                >
                    {Array.from({ length: 5 }, (_, i) => {
                        const star = i + 1;
                        return (
                            <button
                                key={`edit-star-${star}`}
                                type="button"
                                // biome-ignore lint/a11y/useSemanticElements: custom star rating widget uses buttons for better UX
                                role="radio"
                                aria-checked={form.rating === star}
                                aria-label={tUi('accessibility.rateStars', undefined, {
                                    count: star
                                })}
                                onClick={() => handleRatingChange(star)}
                                className={`text-xl transition-colors ${
                                    star <= form.rating ? 'text-star' : 'text-star-empty'
                                } rounded hover:text-star focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1`}
                            >
                                &#9733;
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Title field */}
            <div>
                <label
                    htmlFor={`edit-title-${review.id}`}
                    className="mb-1 block font-medium text-text text-xs"
                >
                    {messages.titleLabel}
                </label>
                <input
                    id={`edit-title-${review.id}`}
                    type="text"
                    name="title"
                    value={form.title}
                    onChange={handleFieldChange}
                    aria-required="true"
                    aria-invalid={!!errors.title}
                    aria-describedby={errors.title ? titleErrorId : undefined}
                    maxLength={200}
                    className={`w-full rounded-md border bg-surface px-3 py-1.5 text-sm text-text focus:outline-none focus:ring-2 ${
                        errors.title
                            ? 'border-destructive focus:border-destructive focus:ring-destructive'
                            : 'border-border focus:border-primary focus:ring-primary'
                    }`}
                />
                <FormError
                    fieldName={`edit-title-${review.id}`}
                    error={errors.title}
                />
            </div>

            {/* Content field */}
            <div>
                <label
                    htmlFor={`edit-content-${review.id}`}
                    className="mb-1 block font-medium text-text text-xs"
                >
                    {messages.contentLabel}
                </label>
                <textarea
                    id={`edit-content-${review.id}`}
                    name="content"
                    value={form.content}
                    onChange={handleFieldChange}
                    aria-required="true"
                    aria-invalid={!!errors.content}
                    aria-describedby={errors.content ? contentErrorId : undefined}
                    rows={3}
                    maxLength={2000}
                    className={`w-full resize-none rounded-md border bg-surface px-3 py-1.5 text-sm text-text focus:outline-none focus:ring-2 ${
                        errors.content
                            ? 'border-destructive focus:border-destructive focus:ring-destructive'
                            : 'border-border focus:border-primary focus:ring-primary'
                    }`}
                />
                <FormError
                    fieldName={`edit-content-${review.id}`}
                    error={errors.content}
                />
            </div>

            {/* Form actions */}
            <div className="flex justify-end gap-2">
                <button
                    type="button"
                    onClick={onCancel}
                    disabled={isSaving}
                    className="flex items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-1.5 font-medium text-sm text-text hover:bg-surface-alt focus:outline-none focus:ring-2 focus:ring-border focus:ring-offset-1 disabled:opacity-50"
                >
                    <CancelIcon
                        size="sm"
                        weight="regular"
                        aria-hidden="true"
                    />
                    {messages.cancelButton}
                </button>
                <button
                    type="submit"
                    disabled={isSaving}
                    className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 font-medium text-primary-foreground text-sm hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1 disabled:opacity-50"
                >
                    <SaveIcon
                        size="sm"
                        weight="regular"
                        aria-hidden="true"
                    />
                    {isSaving ? messages.saving : messages.saveButton}
                </button>
            </div>
        </form>
    );
}
