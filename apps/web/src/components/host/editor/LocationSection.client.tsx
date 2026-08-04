/**
 * @file LocationSection.client.tsx
 * @description Form section for accommodation location: latitude and longitude
 * as simple number inputs (MVP — no Leaflet map yet).
 */

import { TextField } from '@/components/ui/TextField';
import type { AccommodationEditData } from '@/lib/api/types';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import { ACCOMMODATION_FIELD_PREFIX } from './field-ids';
import styles from './LocationSection.module.css';

/** Props for LocationSection. */
export interface LocationSectionProps {
    readonly locale: SupportedLocale;
    readonly data: AccommodationEditData;
    readonly errors: Readonly<{
        latitude?: string;
        longitude?: string;
    }>;
    readonly onFieldChange: (field: keyof AccommodationEditData, value: number | null) => void;
}

/**
 * Location form section.
 * Renders latitude and longitude number inputs.
 * Simplified MVP — no interactive map.
 */
export function LocationSection({ locale, data, errors, onFieldChange }: LocationSectionProps) {
    const { t } = createTranslations(locale);

    return (
        <fieldset className={styles.section}>
            <legend className={styles.sectionTitle}>
                {t('host.properties.editor.section.location', 'Ubicación')}
            </legend>

            <div className={styles.row}>
                <div className={styles.field}>
                    <TextField
                        prefix={ACCOMMODATION_FIELD_PREFIX}
                        name="latitude"
                        label={t('host.properties.editor.field.latitude', 'Latitud')}
                        labelClassName={styles.fieldLabel}
                        className={styles.fieldInput}
                        error={errors.latitude}
                        type="number"
                        value={data.latitude ?? ''}
                        min={-90}
                        max={90}
                        step="0.000001"
                        onChange={(e) =>
                            onFieldChange(
                                'latitude',
                                e.target.value === '' ? null : Number(e.target.value)
                            )
                        }
                    />
                </div>

                <div className={styles.field}>
                    <TextField
                        prefix={ACCOMMODATION_FIELD_PREFIX}
                        name="longitude"
                        label={t('host.properties.editor.field.longitude', 'Longitud')}
                        labelClassName={styles.fieldLabel}
                        className={styles.fieldInput}
                        error={errors.longitude}
                        type="number"
                        value={data.longitude ?? ''}
                        min={-180}
                        max={180}
                        step="0.000001"
                        onChange={(e) =>
                            onFieldChange(
                                'longitude',
                                e.target.value === '' ? null : Number(e.target.value)
                            )
                        }
                    />
                </div>
            </div>

            <p className={styles.hint}>
                {t(
                    'host.properties.editor.field.locationHint',
                    'Ingresá las coordenadas exactas de tu propiedad.'
                )}
            </p>
        </fieldset>
    );
}
