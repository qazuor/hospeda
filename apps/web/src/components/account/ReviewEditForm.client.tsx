import { CancelIcon, SaveIcon } from '@repo/icons';
/**
 * Inline edit form for a single review card.
 * Rendered inside the review card when editing is active.
 */
import { type ChangeEvent, type FormEvent, useState } from 'react';
import { useTranslation } from '../../hooks/useTranslation';
import type { SupportedLocale } from '../../lib/i18n';

/** State managed by the inline edit form */
export interface EditFormState {
    rating: number;
    title: string;
    content: string;
}

/** Subset of localized messages required by this form */
export interface ReviewEditFormMessages {
    ratingEditLabel: string;
    titleLabel: string;
    contentLabel: string;
    cancelButton: string;
    saveButton: string;
    saving: string;
}

/** Review data passed into the form for pre-filling */
export interface ReviewEditFormReview {
    id: string;
    rating: number;
    title: string;
    content: string;
}

interface ReviewEditFormProps {
    review: ReviewEditFormReview;
    messages: ReviewEditFormMessages;
    onSave: (id: string, data: EditFormState) => Promise<void>;
    onCancel: () => void;
    isSaving: boolean;
    locale?: SupportedLocale;
}

/**
 * Inline edit form for a review.
 * Renders a star selector, title input, and content textarea.
 * Calls onSave with the updated data on submit.
 *
 * @param review - The review data used to pre-fill the form
 * @param messages - Localized string labels
 * @param onSave - Async callback invoked with the updated data
 * @param onCancel - Callback invoked when the user cancels editing
 * @param isSaving - When true, disables controls and shows saving indicator
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

    const handleRatingChange = (value: number) => {
        setForm((prev) => ({ ...prev, rating: value }));
    };

    const handleFieldChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setForm((prev) => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        await onSave(review.id, form);
    };

    return (
        <form
            onSubmit={handleSubmit}
            className="space-y-3"
        >
            {/* Star rating selector */}
            <div>
                <span className="mb-1 block font-medium text-gray-700 text-xs">
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
                                    star <= form.rating ? 'text-yellow-500' : 'text-gray-300'
                                } rounded hover:text-yellow-400 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1`}
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
                    className="mb-1 block font-medium text-gray-700 text-xs"
                >
                    {messages.titleLabel}
                </label>
                <input
                    id={`edit-title-${review.id}`}
                    type="text"
                    name="title"
                    value={form.title}
                    onChange={handleFieldChange}
                    required
                    maxLength={200}
                    className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary"
                />
            </div>

            {/* Content field */}
            <div>
                <label
                    htmlFor={`edit-content-${review.id}`}
                    className="mb-1 block font-medium text-gray-700 text-xs"
                >
                    {messages.contentLabel}
                </label>
                <textarea
                    id={`edit-content-${review.id}`}
                    name="content"
                    value={form.content}
                    onChange={handleFieldChange}
                    required
                    rows={3}
                    maxLength={2000}
                    className="w-full resize-none rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary"
                />
            </div>

            {/* Form actions */}
            <div className="flex justify-end gap-2">
                <button
                    type="button"
                    onClick={onCancel}
                    disabled={isSaving}
                    className="flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 py-1.5 font-medium text-gray-700 text-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-1 disabled:opacity-50"
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
                    className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 font-medium text-sm text-white hover:bg-primary-dark focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1 disabled:opacity-50"
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
