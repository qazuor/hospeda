/** Shared FAQ fields; consumers own validation and persistence. */
import type { ReactNode } from 'react';
import { Button, Checkbox, Field, Textarea } from '@/components/account/ui';
import type { SupportedLocale, TranslationFn } from '@/lib/i18n';
import styles from './FaqEditor.module.css';

/** Editable FAQ presentation values (category remains consumer-owned). */
export interface FaqValues {
    readonly question: string;
    readonly answer: string;
    readonly isVisibleOnListing: boolean;
    readonly isUsableByAi: boolean;
}

/** Shared form contract, independent of each vertical's state model. */
export interface FaqEditorFieldsProps {
    readonly locale: SupportedLocale;
    readonly questionId: string;
    readonly answerId: string;
    readonly values: FaqValues;
    readonly errors: { readonly question?: string; readonly answer?: string };
    readonly t: TranslationFn;
    readonly namespace: string;
    readonly onChange: (patch: Partial<FaqValues>) => void;
    readonly onSave: () => void;
    readonly onCancel: () => void;
    readonly isBusy: boolean;
    readonly answerExtra?: ReactNode;
}

/** One add/edit form, keeping supplied IDs for validation focus. */
export function FaqEditorFields(props: FaqEditorFieldsProps) {
    const {
        locale,
        questionId,
        answerId,
        values,
        errors,
        t,
        namespace,
        onChange,
        onSave,
        onCancel,
        isBusy,
        answerExtra
    } = props;
    const label = (key: string, fallback: string) => t(`${namespace}.${key}`, fallback);
    return (
        <div className={styles.stack}>
            <Field
                locale={locale}
                id={questionId}
                label={label('questionLabel', 'Pregunta')}
                error={errors.question}
            >
                <Textarea
                    rows={2}
                    value={values.question}
                    placeholder={label('questionPlaceholder', 'Escribí la pregunta...')}
                    onChange={(event) => onChange({ question: event.target.value })}
                />
            </Field>
            <Field
                locale={locale}
                id={answerId}
                label={label('answerLabel', 'Respuesta')}
                error={errors.answer}
            >
                <Textarea
                    rows={4}
                    value={values.answer}
                    placeholder={label('answerPlaceholder', 'Escribí la respuesta...')}
                    onChange={(event) => onChange({ answer: event.target.value })}
                />
            </Field>
            {answerExtra}
            <Checkbox
                label={label('visibleOnListingLabel', 'Visible en la ficha pública')}
                checked={values.isVisibleOnListing}
                onChange={(event) => onChange({ isVisibleOnListing: event.target.checked })}
            />
            <Checkbox
                label={label('usableByAiLabel', 'Usable por la IA')}
                checked={values.isUsableByAi}
                onChange={(event) => onChange({ isUsableByAi: event.target.checked })}
            />
            <div className={styles.actions}>
                <Button
                    variant="primary"
                    size="lg"
                    disabled={isBusy}
                    onClick={onSave}
                >
                    {label('saveButton', 'Guardar')}
                </Button>
                <Button
                    variant="secondary"
                    size="lg"
                    onClick={onCancel}
                >
                    {label('cancelButton', 'Cancelar')}
                </Button>
            </div>
        </div>
    );
}
