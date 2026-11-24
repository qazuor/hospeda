/**
 * @file FaqEditorFields.client.tsx
 * @description The question/answer/channel-flags form shared by the add and
 * edit modes of the accommodation FAQ editor (HOS-393, HOS-794, HOS-2490).
 */

import type { JSX, ReactNode } from 'react';
import type { TranslationFn } from '@/lib/i18n';
import styles from './FaqSection.module.css';
import type { FaqEditor } from './faq-section-model';
import { clearFaqFieldError, type FaqFieldErrors } from './faq-validation';

/** Props of {@link FaqEditorFields}. */
export interface FaqEditorFieldsProps {
    /** DOM id of the question textarea (the answer id and error ids derive from the ids below). */
    readonly questionId: string;
    /** DOM id of the answer textarea. */
    readonly answerId: string;
    /** Current form values. */
    readonly values: FaqEditor;
    /** Per-field validation errors (HOS-794). */
    readonly errors: FaqFieldErrors;
    /** Translation function of the host editor. */
    readonly t: TranslationFn;
    /** Updates the values from a reducer. */
    readonly onValuesChange: (update: (previous: FaqEditor) => FaqEditor) => void;
    /** Updates the errors from a reducer. */
    readonly onErrorsChange: (update: (previous: FaqFieldErrors) => FaqFieldErrors) => void;
    /** Save handler. */
    readonly onSubmit: () => void;
    /** Cancel handler. */
    readonly onCancel: () => void;
    /** Disables the save button while any request is in flight. */
    readonly isBusy: boolean;
    /** Extra controls rendered under the answer textarea (AI draft, help). */
    readonly answerExtras?: ReactNode;
}

/**
 * Form of one FAQ (add or edit).
 *
 * @param props - See {@link FaqEditorFieldsProps}.
 * @returns The form with its save and cancel buttons.
 */
export function FaqEditorFields({
    questionId,
    answerId,
    values,
    errors,
    t,
    onValuesChange,
    onErrorsChange,
    onSubmit,
    onCancel,
    isBusy,
    answerExtras
}: FaqEditorFieldsProps): JSX.Element {
    const questionErrorId = `${questionId}-error`;
    const answerErrorId = `${answerId}-error`;

    return (
        <div className={styles.editForm}>
            <label
                className={styles.fieldLabel}
                htmlFor={questionId}
            >
                {t('host.properties.editor.faq.questionLabel', 'Pregunta')}
            </label>
            <textarea
                id={questionId}
                className={styles.textarea}
                rows={2}
                value={values.question}
                aria-invalid={errors.question !== undefined || undefined}
                aria-describedby={errors.question === undefined ? undefined : questionErrorId}
                placeholder={t(
                    'host.properties.editor.faq.questionPlaceholder',
                    'Escribí la pregunta...'
                )}
                onChange={(e) => {
                    const question = e.target.value;
                    onValuesChange((v) => ({ ...v, question }));
                    onErrorsChange((prev) => clearFaqFieldError(prev, 'question'));
                }}
            />
            {errors.question && (
                <p
                    id={questionErrorId}
                    className={styles.fieldError}
                >
                    {errors.question}
                </p>
            )}
            <label
                className={styles.fieldLabel}
                htmlFor={answerId}
            >
                {t('host.properties.editor.faq.answerLabel', 'Respuesta')}
            </label>
            <textarea
                id={answerId}
                className={styles.textarea}
                rows={4}
                value={values.answer}
                aria-invalid={errors.answer !== undefined || undefined}
                aria-describedby={errors.answer === undefined ? undefined : answerErrorId}
                placeholder={t(
                    'host.properties.editor.faq.answerPlaceholder',
                    'Escribí la respuesta...'
                )}
                onChange={(e) => {
                    const answer = e.target.value;
                    onValuesChange((v) => ({ ...v, answer }));
                    onErrorsChange((prev) => clearFaqFieldError(prev, 'answer'));
                }}
            />
            {answerExtras}
            {errors.answer && (
                <p
                    id={answerErrorId}
                    className={styles.fieldError}
                >
                    {errors.answer}
                </p>
            )}
            <div className={styles.channelCheckboxes}>
                <label className={styles.checkboxLabel}>
                    <input
                        type="checkbox"
                        checked={values.isVisibleOnListing}
                        onChange={(e) => {
                            const isVisibleOnListing = e.target.checked;
                            onValuesChange((v) => ({ ...v, isVisibleOnListing }));
                        }}
                    />
                    {t(
                        'host.properties.editor.faq.visibleOnListingLabel',
                        'Visible en la ficha pública'
                    )}
                </label>
                <label className={styles.checkboxLabel}>
                    <input
                        type="checkbox"
                        checked={values.isUsableByAi}
                        onChange={(e) => {
                            const isUsableByAi = e.target.checked;
                            onValuesChange((v) => ({ ...v, isUsableByAi }));
                        }}
                    />
                    {t('host.properties.editor.faq.usableByAiLabel', 'Usable por la IA')}
                </label>
            </div>
            <div className={styles.editActions}>
                <button
                    type="button"
                    className={styles.saveBtn}
                    disabled={isBusy}
                    onClick={onSubmit}
                >
                    {t('host.properties.editor.faq.saveButton', 'Guardar')}
                </button>
                <button
                    type="button"
                    className={styles.cancelBtn}
                    onClick={onCancel}
                >
                    {t('host.properties.editor.faq.cancelButton', 'Cancelar')}
                </button>
            </div>
        </div>
    );
}
