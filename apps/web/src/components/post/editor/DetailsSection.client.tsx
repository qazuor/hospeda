/**
 * @file DetailsSection.client.tsx
 * @description Secondary post metadata: estimated reading time and the related
 * destination (HOS-374 2C-2).
 *
 * The related accommodation and event are deliberately NOT here. Both are
 * accepted by the PATCH schema, but a usable control for either needs a
 * searchable picker over a catalog with no natural page-size ceiling — a
 * hundreds-of-rows `<select>` is not one. Destinations are a closed set of ~22
 * cities, so they fit a plain select today.
 */

import { TextField } from '@/components/ui/TextField';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import { POST_FIELD_PREFIX } from './field-ids';
import type { PostEditFormData } from './post-edit-data';
import styles from './post-editor-fields.module.css';

/**
 * One option of the related-destination select.
 *
 * Structural on purpose — the editor needs an id and a label and nothing else,
 * so `DestinationData` (id/name/path) satisfies it without this section
 * depending on that shape, and without borrowing the commerce vertical's
 * `DestinationOption`.
 */
export interface PostDestinationOption {
    readonly id: string;
    readonly name: string;
}

/** Props for {@link DetailsSection}. */
export interface DetailsSectionProps {
    readonly locale: SupportedLocale;
    readonly data: PostEditFormData;
    readonly destinations: readonly PostDestinationOption[];
    readonly errors: Readonly<Record<string, string>>;
    /** `true` when the moderation lock forbids editing (HOS-374 §7.6.3). */
    readonly disabled?: boolean;
    readonly onReadingTimeChange: (value: number | null) => void;
    readonly onDestinationChange: (value: string) => void;
}

/**
 * Post details section: reading time and related destination.
 *
 * @param props - See {@link DetailsSectionProps}.
 */
export function DetailsSection({
    locale,
    data,
    destinations,
    errors,
    disabled = false,
    onReadingTimeChange,
    onDestinationChange
}: DetailsSectionProps) {
    const { t } = createTranslations(locale);

    return (
        <fieldset
            className={styles.section}
            disabled={disabled}
        >
            <legend className={styles.sectionTitle}>
                {t('account.myContent.posts.editor.section.details', 'Detalles')}
            </legend>

            <div className={styles.field}>
                <TextField
                    prefix={POST_FIELD_PREFIX}
                    name="readingTimeMinutes"
                    label={t(
                        'account.myContent.posts.editor.field.readingTime',
                        'Tiempo de lectura (minutos)'
                    )}
                    labelClassName={styles.fieldLabel}
                    className={styles.fieldInput}
                    error={errors.readingTimeMinutes}
                    type="number"
                    value={data.readingTimeMinutes ?? ''}
                    min={1}
                    onChange={(e) =>
                        onReadingTimeChange(e.target.value === '' ? null : Number(e.target.value))
                    }
                />
                <span className={styles.fieldHint}>
                    {t(
                        'account.myContent.posts.editor.hint.readingTime',
                        'Dejalo vacío para mantener el valor actual.'
                    )}
                </span>
            </div>

            {/*
             * Hidden entirely when the catalog fetch failed or is empty. Unlike
             * the commerce editor's destination select, this field is OPTIONAL
             * (a post needs no destination to be complete), so an unavailable
             * catalog costs the author nothing — there is no state they are
             * locked out of reaching.
             */}
            {destinations.length > 0 && (
                <div className={styles.field}>
                    <TextField
                        as="select"
                        prefix={POST_FIELD_PREFIX}
                        name="destinationId"
                        label={t(
                            'account.myContent.posts.editor.field.destination',
                            'Destino relacionado'
                        )}
                        labelClassName={styles.fieldLabel}
                        className={styles.fieldInput}
                        error={errors.destinationId}
                        value={data.relatedDestinationId}
                        onChange={(e) => onDestinationChange(e.target.value)}
                    >
                        <option value="">
                            {t(
                                'account.myContent.posts.editor.field.destinationNone',
                                'Sin destino relacionado'
                            )}
                        </option>
                        {destinations.map((destination) => (
                            <option
                                key={destination.id}
                                value={destination.id}
                            >
                                {destination.name}
                            </option>
                        ))}
                    </TextField>
                </div>
            )}
        </fieldset>
    );
}
