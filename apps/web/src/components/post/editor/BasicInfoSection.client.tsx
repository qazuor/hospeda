/**
 * @file BasicInfoSection.client.tsx
 * @description Title, summary and category of a post (HOS-374 2C-2).
 *
 * `slug` is deliberately absent — it is server-derived at create time and
 * immutable here; the hosting page shows it read-only. See `post-edit-data.ts`
 * for the full list of fields this editor does not expose and why.
 */

import { PostCategoryEnum } from '@repo/schemas';
import styles from '@/components/account/editor/content-editor-fields.module.css';
import { TextField } from '@/components/ui/TextField';
import { getPostCategoryLabel } from '@/lib/colors';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import { POST_FIELD_PREFIX } from './field-ids';
import type { PostEditFormData } from './post-edit-data';

/** Props for {@link BasicInfoSection}. */
export interface BasicInfoSectionProps {
    readonly locale: SupportedLocale;
    readonly data: PostEditFormData;
    readonly errors: Readonly<Record<string, string>>;
    /** `true` when the moderation lock forbids editing (HOS-374 §7.6.3). */
    readonly disabled?: boolean;
    readonly onFieldChange: (field: 'title' | 'summary' | 'category', value: string) => void;
}

/**
 * Basic information section: title, summary, category.
 *
 * The category options are derived from `PostCategoryEnum` and labelled by the
 * shared `getPostCategoryLabel` — NOT re-listed by hand. A hand-written list
 * (as the public listing page carries) silently loses any category added to the
 * enum afterwards, which here would mean an author cannot pick it.
 *
 * @param props - See {@link BasicInfoSectionProps}.
 */
export function BasicInfoSection({
    locale,
    data,
    errors,
    disabled = false,
    onFieldChange
}: BasicInfoSectionProps) {
    const { t } = createTranslations(locale);

    const categoryOptions = Object.values(PostCategoryEnum)
        .map((value) => ({ value, label: getPostCategoryLabel({ category: value, t }) }))
        .sort((a, b) => a.label.localeCompare(b.label, locale));

    return (
        <fieldset
            className={styles.section}
            disabled={disabled}
        >
            <legend className={styles.sectionTitle}>
                {t('account.myContent.posts.editor.section.basicInfo', 'Información básica')}
            </legend>

            <div className={styles.field}>
                <TextField
                    prefix={POST_FIELD_PREFIX}
                    name="title"
                    label={`${t('account.myContent.posts.editor.field.title', 'Título')} *`}
                    labelClassName={styles.fieldLabel}
                    className={styles.fieldInput}
                    error={errors.title}
                    type="text"
                    value={data.title}
                    onChange={(e) => onFieldChange('title', e.target.value)}
                    required
                    minLength={5}
                    maxLength={150}
                />
            </div>

            <div className={styles.field}>
                <TextField
                    as="textarea"
                    prefix={POST_FIELD_PREFIX}
                    name="summary"
                    label={`${t('account.myContent.posts.editor.field.summary', 'Resumen')} *`}
                    labelClassName={styles.fieldLabel}
                    className={styles.fieldInput}
                    error={errors.summary}
                    value={data.summary}
                    onChange={(e) => onFieldChange('summary', e.target.value)}
                    required
                    minLength={10}
                    maxLength={300}
                    rows={3}
                />
                <span className={styles.fieldHint}>
                    {t(
                        'account.myContent.posts.editor.hint.summary',
                        'Entre 10 y 300 caracteres. Se muestra en el listado del blog.'
                    )}
                </span>
            </div>

            <div className={styles.field}>
                <TextField
                    as="select"
                    prefix={POST_FIELD_PREFIX}
                    name="category"
                    label={`${t('account.myContent.posts.editor.field.category', 'Categoría')} *`}
                    labelClassName={styles.fieldLabel}
                    className={styles.fieldInput}
                    error={errors.category}
                    value={data.category}
                    onChange={(e) => onFieldChange('category', e.target.value)}
                    required
                >
                    {categoryOptions.map((option) => (
                        <option
                            key={option.value}
                            value={option.value}
                        >
                            {option.label}
                        </option>
                    ))}
                </TextField>
            </div>
        </fieldset>
    );
}
