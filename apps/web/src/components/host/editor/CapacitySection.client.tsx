/**
 * @file CapacitySection.client.tsx
 * @description Form section for accommodation capacity: maxGuests, bedrooms,
 * bathrooms. Uses native HTML number inputs.
 */

import { TextField } from '@/components/ui/TextField';
import type { AccommodationEditData } from '@/lib/api/types';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import styles from './CapacitySection.module.css';
import { ACCOMMODATION_FIELD_PREFIX } from './field-ids';

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
                    <TextField
                        prefix={ACCOMMODATION_FIELD_PREFIX}
                        name="maxGuests"
                        label={t('host.properties.editor.field.maxGuests', 'Huéspedes máx.')}
                        labelClassName={styles.fieldLabel}
                        className={styles.fieldInput}
                        error={errors.maxGuests}
                        type="number"
                        value={data.maxGuests ?? ''}
                        min={1}
                        max={200}
                        onChange={(e) =>
                            onFieldChange(
                                'maxGuests',
                                e.target.value === '' ? null : Number(e.target.value)
                            )
                        }
                    />
                </div>

                <div className={styles.field}>
                    <TextField
                        prefix={ACCOMMODATION_FIELD_PREFIX}
                        name="bedrooms"
                        label={t('host.properties.editor.field.bedrooms', 'Dormitorios')}
                        labelClassName={styles.fieldLabel}
                        className={styles.fieldInput}
                        error={errors.bedrooms}
                        type="number"
                        value={data.bedrooms ?? ''}
                        min={0}
                        max={100}
                        onChange={(e) =>
                            onFieldChange(
                                'bedrooms',
                                e.target.value === '' ? null : Number(e.target.value)
                            )
                        }
                    />
                </div>

                <div className={styles.field}>
                    <TextField
                        prefix={ACCOMMODATION_FIELD_PREFIX}
                        name="bathrooms"
                        label={t('host.properties.editor.field.bathrooms', 'Baños')}
                        labelClassName={styles.fieldLabel}
                        className={styles.fieldInput}
                        error={errors.bathrooms}
                        type="number"
                        value={data.bathrooms ?? ''}
                        min={1}
                        max={100}
                        onChange={(e) =>
                            onFieldChange(
                                'bathrooms',
                                e.target.value === '' ? null : Number(e.target.value)
                            )
                        }
                    />
                </div>
            </div>
        </fieldset>
    );
}
