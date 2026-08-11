/**
 * @file BasicInfoSection.client.tsx
 * @description Name and category of an event (HOS-374 2C-3).
 *
 * `slug`, `organizerId` and `locationId` are absent — see `event-edit-data.ts`
 * for the full list of fields this editor does not expose and why.
 */

import styles from '@/components/account/editor/content-editor-fields.module.css';
import { TextField } from '@/components/ui/TextField';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import type { EventEditFormData } from './event-edit-data';
import { EVENT_FIELD_PREFIX } from './field-ids';

/** Translation function shape used by the category map. */
type TranslateFn = (key: string, fallback?: string) => string;

/**
 * The nine `EventCategoryEnum` values with their labels.
 *
 * Written out key by key (not interpolated) so a missing translation is
 * visible to a static scan of the locale files. Unlike the public events
 * listing — which omits `OTHER` from its filter chips — every value is offered
 * here: an author must be able to pick the category their event actually has.
 */
const CATEGORY_OPTIONS = (t: TranslateFn): ReadonlyArray<{ value: string; label: string }> => [
    { value: 'MUSIC', label: t('events.categories.music', 'Música') },
    { value: 'CULTURE', label: t('events.categories.culture', 'Cultura') },
    { value: 'SPORTS', label: t('events.categories.sports', 'Deportes') },
    { value: 'GASTRONOMY', label: t('events.categories.gastronomy', 'Gastronomía') },
    { value: 'FESTIVAL', label: t('events.categories.festival', 'Festival') },
    { value: 'NATURE', label: t('events.categories.nature', 'Naturaleza') },
    { value: 'THEATER', label: t('events.categories.theater', 'Teatro') },
    { value: 'WORKSHOP', label: t('events.categories.workshop', 'Taller') },
    { value: 'OTHER', label: t('events.categories.other', 'Otro') }
];

/** Props for {@link BasicInfoSection}. */
export interface BasicInfoSectionProps {
    readonly locale: SupportedLocale;
    readonly data: EventEditFormData;
    readonly errors: Readonly<Record<string, string>>;
    /** `true` when the moderation lock forbids editing (HOS-374 §7.6.3). */
    readonly disabled?: boolean;
    readonly onFieldChange: (field: 'name' | 'category', value: string) => void;
}

/**
 * Basic information section: name and category.
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

    return (
        <fieldset
            className={styles.section}
            disabled={disabled}
        >
            <legend className={styles.sectionTitle}>
                {t('account.myContent.events.editor.section.basicInfo', 'Información básica')}
            </legend>

            <div className={styles.field}>
                <TextField
                    prefix={EVENT_FIELD_PREFIX}
                    name="name"
                    label={`${t('account.myContent.events.editor.field.name', 'Nombre')} *`}
                    labelClassName={styles.fieldLabel}
                    className={styles.fieldInput}
                    error={errors.name}
                    type="text"
                    value={data.name}
                    onChange={(e) => onFieldChange('name', e.target.value)}
                    required
                    minLength={5}
                    maxLength={200}
                />
            </div>

            <div className={styles.field}>
                <TextField
                    as="select"
                    prefix={EVENT_FIELD_PREFIX}
                    name="category"
                    label={`${t('account.myContent.events.editor.field.category', 'Categoría')} *`}
                    labelClassName={styles.fieldLabel}
                    className={styles.fieldInput}
                    error={errors.category}
                    value={data.category}
                    onChange={(e) => onFieldChange('category', e.target.value)}
                    required
                >
                    {CATEGORY_OPTIONS(t).map((option) => (
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
