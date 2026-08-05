/**
 * @file ContentSection.client.tsx
 * @description The post body — a rich-text (Markdown-persisting) editor
 * (HOS-374 2C-2).
 *
 * Unlike the accommodation editor's description, this is NOT behind a
 * `PlanEntitlementGate`: `can_use_rich_description` gates a HOST's listing
 * description by subscription plan, and a post author is an editor, not a
 * subscriber. Formatted body text is the whole point of the field here.
 */

import { RichTextEditor } from '@/components/host/editor/RichTextEditor.client';
import { FieldError } from '@/components/ui/FieldError';
import { buildFieldErrorId } from '@/components/ui/TextField';
import { buildFieldId } from '@/lib/forms/build-field-id';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import { POST_FIELD_PREFIX } from './field-ids';
import styles from './post-editor-fields.module.css';

/**
 * Identity of the `content` field.
 *
 * The control is a contenteditable, not a form control, so the id is derived
 * once here and handed to BOTH the label's `htmlFor` and the editor's `id` —
 * the same contract `TextField` applies to the plain inputs.
 */
const CONTENT_FIELD = {
    prefix: POST_FIELD_PREFIX,
    name: 'content'
} as const;

const CONTENT_ID = buildFieldId(CONTENT_FIELD);

/** Props for {@link ContentSection}. */
export interface ContentSectionProps {
    readonly locale: SupportedLocale;
    readonly value: string;
    readonly error?: string;
    /** `true` when the moderation lock forbids editing (HOS-374 §7.6.3). */
    readonly disabled?: boolean;
    readonly onChange: (value: string) => void;
}

/**
 * Post body section.
 *
 * @param props - See {@link ContentSectionProps}.
 */
export function ContentSection({
    locale,
    value,
    error,
    disabled = false,
    onChange
}: ContentSectionProps) {
    const { t } = createTranslations(locale);

    const label = t('account.myContent.posts.editor.field.content', 'Contenido');

    return (
        <fieldset className={styles.section}>
            <legend className={styles.sectionTitle}>
                {t('account.myContent.posts.editor.section.content', 'Contenido')}
            </legend>

            <div className={styles.field}>
                <label
                    htmlFor={CONTENT_ID}
                    className={styles.fieldLabel}
                >
                    {`${label} *`}
                </label>
                {/*
                 * `disabled` is passed explicitly rather than relying on the
                 * wrapping <fieldset>: the editing surface is a
                 * contenteditable <div>, not a form control, so `fieldset
                 * [disabled]` does not reach it. Without this the moderation
                 * lock would disable every input on the page EXCEPT the body.
                 */}
                <RichTextEditor
                    id={CONTENT_ID}
                    ariaLabel={label}
                    value={value}
                    onChange={onChange}
                    disabled={disabled}
                    placeholder={t(
                        'account.myContent.posts.editor.placeholder.content',
                        'Escribí tu nota...'
                    )}
                    hasError={Boolean(error)}
                    errorMessage={error}
                />
                <FieldError
                    id={buildFieldErrorId(CONTENT_FIELD)}
                    message={error}
                    className={styles.fieldErrorSpacing}
                />
                <span className={styles.fieldHint}>
                    {t('account.myContent.posts.editor.hint.content', 'Mínimo 100 caracteres.')}
                </span>
            </div>
        </fieldset>
    );
}
