/**
 * @file DescriptionSection.client.tsx
 * @description The event description — a rich-text (Markdown-persisting) editor
 * (HOS-374 2C-3).
 *
 * `description` doubles as the source of `summary`: `httpToDomainEventUpdate`
 * derives the summary from its first 300 characters, so there is no separate
 * summary field to edit (and adding one would be a field the server ignores).
 */

import styles from '@/components/account/editor/content-editor-fields.module.css';
import { RichTextEditor } from '@/components/host/editor/RichTextEditor.client';
import { FieldError } from '@/components/ui/FieldError';
import { buildFieldErrorId } from '@/components/ui/TextField';
import { buildFieldId } from '@/lib/forms/build-field-id';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import { EVENT_FIELD_PREFIX } from './field-ids';

/**
 * Identity of the `description` field.
 *
 * The control is a contenteditable, not a form control, so the id is derived
 * once here and handed to BOTH the label's `htmlFor` and the editor's `id`.
 */
const DESCRIPTION_FIELD = {
    prefix: EVENT_FIELD_PREFIX,
    name: 'description'
} as const;

const DESCRIPTION_ID = buildFieldId(DESCRIPTION_FIELD);

/** Props for {@link DescriptionSection}. */
export interface DescriptionSectionProps {
    readonly locale: SupportedLocale;
    readonly value: string;
    readonly error?: string;
    /** `true` when the moderation lock forbids editing (HOS-374 §7.6.3). */
    readonly disabled?: boolean;
    readonly onChange: (value: string) => void;
}

/**
 * Event description section.
 *
 * @param props - See {@link DescriptionSectionProps}.
 */
export function DescriptionSection({
    locale,
    value,
    error,
    disabled = false,
    onChange
}: DescriptionSectionProps) {
    const { t } = createTranslations(locale);

    const label = t('account.myContent.events.editor.field.description', 'Descripción');

    return (
        <fieldset className={styles.section}>
            <legend className={styles.sectionTitle}>
                {t('account.myContent.events.editor.section.description', 'Descripción')}
            </legend>

            <div className={styles.field}>
                <label
                    htmlFor={DESCRIPTION_ID}
                    className={styles.fieldLabel}
                >
                    {`${label} *`}
                </label>
                {/*
                 * `disabled` is passed explicitly rather than relying on the
                 * wrapping <fieldset>: the editing surface is a contenteditable
                 * <div>, not a form control, so `fieldset[disabled]` does not
                 * reach it.
                 */}
                <RichTextEditor
                    id={DESCRIPTION_ID}
                    ariaLabel={label}
                    value={value}
                    onChange={onChange}
                    disabled={disabled}
                    placeholder={t(
                        'account.myContent.events.editor.placeholder.description',
                        'Contá de qué se trata el evento...'
                    )}
                    hasError={Boolean(error)}
                    errorMessage={error}
                />
                <FieldError
                    id={buildFieldErrorId(DESCRIPTION_FIELD)}
                    message={error}
                    className={styles.fieldErrorSpacing}
                />
                <span className={styles.fieldHint}>
                    {t(
                        'account.myContent.events.editor.hint.description',
                        'Entre 50 y 2000 caracteres. El resumen del listado sale de acá.'
                    )}
                </span>
            </div>
        </fieldset>
    );
}
