/**
 * @file CapacitySection.client.tsx
 * @description Form section for accommodation capacity: maxGuests, bedrooms,
 * bathrooms. Uses native HTML number inputs.
 */

import type { AccommodationEditData } from '@/lib/api/types';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import styles from './CapacitySection.module.css';

/** Props for CapacitySection. */
export interface CapacitySectionProps {
    readonly locale: SupportedLocale;
    readonly data: AccommodationEditData;
    readonly errors: Readonly<{ maxGuests?: string; bedrooms?: string; bathrooms?: string }>;
    readonly onFieldChange: (field: keyof AccommodationEditData, value: number | null) => void;
}

/**
 * Capacity form section.
 * Renders maxGuests, bedrooms, and bathrooms number inputs.
 */
export function CapacitySection({ locale, data, errors, onFieldChange }: CapacitySectionProps) {
    const { t } = createTranslations(locale);

    return (
        <fieldset className={styles.section}>
            <legend className={styles.sectionTitle}>
                {t('host.properties.editor.section.capacity', 'Capacidad')}
            </legend>

            <div className={styles.row}>
                <div className={styles.field}>
                    <label
                        htmlFor="acc-maxGuests"
                        className={styles.fieldLabel}
                    >
                        {t('host.properties.editor.field.maxGuests', 'Huéspedes máx.')}
                    </label>
                    <input
                        id="acc-maxGuests"
                        type="number"
                        className={styles.fieldInput}
                        value={data.maxGuests ?? ''}
                        min={1}
                        max={200}
                        onChange={(e) =>
                            onFieldChange(
                                'maxGuests',
                                e.target.value === '' ? null : Number(e.target.value)
                            )
                        }
                        aria-invalid={Boolean(errors.maxGuests)}
                        aria-describedby={errors.maxGuests ? 'acc-maxGuests-error' : undefined}
                    />
                    {errors.maxGuests && (
                        <span
                            id="acc-maxGuests-error"
                            className={styles.fieldError}
                            role="alert"
                        >
                            {errors.maxGuests}
                        </span>
                    )}
                </div>

                <div className={styles.field}>
                    <label
                        htmlFor="acc-bedrooms"
                        className={styles.fieldLabel}
                    >
                        {t('host.properties.editor.field.bedrooms', 'Dormitorios')}
                    </label>
                    <input
                        id="acc-bedrooms"
                        type="number"
                        className={styles.fieldInput}
                        value={data.bedrooms ?? ''}
                        min={0}
                        max={100}
                        onChange={(e) =>
                            onFieldChange(
                                'bedrooms',
                                e.target.value === '' ? null : Number(e.target.value)
                            )
                        }
                        aria-invalid={Boolean(errors.bedrooms)}
                        aria-describedby={errors.bedrooms ? 'acc-bedrooms-error' : undefined}
                    />
                    {errors.bedrooms && (
                        <span
                            id="acc-bedrooms-error"
                            className={styles.fieldError}
                            role="alert"
                        >
                            {errors.bedrooms}
                        </span>
                    )}
                </div>

                <div className={styles.field}>
                    <label
                        htmlFor="acc-bathrooms"
                        className={styles.fieldLabel}
                    >
                        {t('host.properties.editor.field.bathrooms', 'Baños')}
                    </label>
                    <input
                        id="acc-bathrooms"
                        type="number"
                        className={styles.fieldInput}
                        value={data.bathrooms ?? ''}
                        min={1}
                        max={100}
                        onChange={(e) =>
                            onFieldChange(
                                'bathrooms',
                                e.target.value === '' ? null : Number(e.target.value)
                            )
                        }
                        aria-invalid={Boolean(errors.bathrooms)}
                        aria-describedby={errors.bathrooms ? 'acc-bathrooms-error' : undefined}
                    />
                    {errors.bathrooms && (
                        <span
                            id="acc-bathrooms-error"
                            className={styles.fieldError}
                            role="alert"
                        >
                            {errors.bathrooms}
                        </span>
                    )}
                </div>
            </div>
        </fieldset>
    );
}
