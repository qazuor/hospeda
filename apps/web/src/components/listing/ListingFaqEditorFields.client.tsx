/**
 * The fields of one FAQ form (HOS-2490): question, answer, the two
 * channel-visibility checkboxes (HOS-400) and the save / cancel pair.
 *
 * Shared by the add form and the per-row edit form of `ListingFaqManager` so
 * both validate, mark and label their fields identically (HOS-811: a refused
 * submit is always visible and always names the field).
 *
 * @module components/listing/ListingFaqEditorFields.client
 */

import type { JSX, ReactNode } from 'react';
import { Button } from '@/components/account/ui/Button';
import type { TranslationFn } from '@/lib/i18n';
import styles from './ListingFaqManager.module.css';
import type { FaqEditor, FaqFieldErrors } from './listing-faq-helpers';

/** Props of {@link ListingFaqEditorFields}. */
export interface ListingFaqEditorFieldsProps {
    /** DOM id of the question textarea; its error is `<id>-error`. */
    readonly questionId: string;
    /** DOM id of the answer textarea; its error is `<id>-error`. */
    readonly answerId: string;
    readonly values: FaqEditor;
    readonly errors: FaqFieldErrors;
    /** Applies a partial change to the form values. */
    readonly onChange: (patch: Partial<FaqEditor>) => void;
    /** Rendered between the answer box and its error (the AI draft slot). */
    readonly answerExtra?: ReactNode;
    /** Whether the save button is disabled (a request is in flight). */
    readonly isBusy: boolean;
    readonly onSave: () => void;
    readonly onCancel: () => void;
    readonly t: TranslationFn;
}

/**
 * One FAQ form.
 *
 * @param props - See {@link ListingFaqEditorFieldsProps}.
 * @returns The form fields and its actions.
 */
export function ListingFaqEditorFields({
    questionId,
    answerId,
    values,
    errors,
    onChange,
    answerExtra,
    isBusy,
    onSave,
    onCancel,
    t
}: ListingFaqEditorFieldsProps): JSX.Element {
    return (
        <div className={styles.form}>
            <label
                className={styles.fieldLabel}
                htmlFor={questionId}
            >
                {t('listing.owner.editor.faqManager.questionLabel', 'Pregunta')}
            </label>
            <textarea
                id={questionId}
                className={styles.textarea}
                rows={2}
                value={values.question}
                aria-invalid={errors.question ? 'true' : undefined}
                aria-describedby={errors.question ? `${questionId}-error` : undefined}
                placeholder={t(
                    'listing.owner.editor.faqManager.questionPlaceholder',
                    'Escribí la pregunta...'
                )}
                onChange={(e) => onChange({ question: e.target.value })}
            />
            {errors.question && (
                <p
                    id={`${questionId}-error`}
                    className={styles.fieldError}
                    role="alert"
                >
                    {errors.question}
                </p>
            )}
            <label
                className={styles.fieldLabel}
                htmlFor={answerId}
            >
                {t('listing.owner.editor.faqManager.answerLabel', 'Respuesta')}
            </label>
            <textarea
                id={answerId}
                className={styles.textarea}
                rows={4}
                value={values.answer}
                aria-invalid={errors.answer ? 'true' : undefined}
                aria-describedby={errors.answer ? `${answerId}-error` : undefined}
                placeholder={t(
                    'listing.owner.editor.faqManager.answerPlaceholder',
                    'Escribí la respuesta...'
                )}
                onChange={(e) => onChange({ answer: e.target.value })}
            />
            {answerExtra}
            {errors.answer && (
                <p
                    id={`${answerId}-error`}
                    className={styles.fieldError}
                    role="alert"
                >
                    {errors.answer}
                </p>
            )}
            <div className={styles.channelCheckboxes}>
                <label className={styles.checkboxLabel}>
                    <input
                        type="checkbox"
                        checked={values.isVisibleOnListing}
                        onChange={(e) => onChange({ isVisibleOnListing: e.target.checked })}
                    />
                    {t(
                        'listing.owner.editor.faqManager.visibleOnListingLabel',
                        'Visible en la ficha pública'
                    )}
                </label>
                <label className={styles.checkboxLabel}>
                    <input
                        type="checkbox"
                        checked={values.isUsableByAi}
                        onChange={(e) => onChange({ isUsableByAi: e.target.checked })}
                    />
                    {t('listing.owner.editor.faqManager.usableByAiLabel', 'Usable por la IA')}
                </label>
            </div>
            <div className={styles.formActions}>
                <Button
                    variant="primary"
                    size="lg"
                    disabled={isBusy}
                    onClick={onSave}
                >
                    {t('listing.owner.editor.faqManager.saveButton', 'Guardar')}
                </Button>
                <Button
                    variant="secondary"
                    size="lg"
                    onClick={onCancel}
                >
                    {t('listing.owner.editor.faqManager.cancelButton', 'Cancelar')}
                </Button>
            </div>
        </div>
    );
}
