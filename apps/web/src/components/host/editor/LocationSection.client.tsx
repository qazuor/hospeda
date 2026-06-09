/**
 * @file LocationSection.client.tsx
 * @description Form section for accommodation location: latitude and longitude
 * as simple number inputs (MVP — no Leaflet map yet).
 */

import type { AccommodationEditData } from '@/lib/api/types';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
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
                    <label
                        htmlFor="acc-latitude"
                        className={styles.fieldLabel}
                    >
                        {t('host.properties.editor.field.latitude', 'Latitud')}
                    </label>
                    <input
                        id="acc-latitude"
                        type="number"
                        className={styles.fieldInput}
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
                        aria-invalid={Boolean(errors.latitude)}
                        aria-describedby={errors.latitude ? 'acc-latitude-error' : undefined}
                    />
                    {errors.latitude && (
                        <span
                            id="acc-latitude-error"
                            className={styles.fieldError}
                            role="alert"
                        >
                            {errors.latitude}
                        </span>
                    )}
                </div>

                <div className={styles.field}>
                    <label
                        htmlFor="acc-longitude"
                        className={styles.fieldLabel}
                    >
                        {t('host.properties.editor.field.longitude', 'Longitud')}
                    </label>
                    <input
                        id="acc-longitude"
                        type="number"
                        className={styles.fieldInput}
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
                        aria-invalid={Boolean(errors.longitude)}
                        aria-describedby={errors.longitude ? 'acc-longitude-error' : undefined}
                    />
                    {errors.longitude && (
                        <span
                            id="acc-longitude-error"
                            className={styles.fieldError}
                            role="alert"
                        >
                            {errors.longitude}
                        </span>
                    )}
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
