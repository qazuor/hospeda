/**
 * @file CapacitySection.client.tsx
 * @description Form section for accommodation capacity: maxGuests, bedrooms,
 * bathrooms, and the minimum stay (`policies.minNights`, HOS-2060). Uses
 * native HTML number inputs.
 */

import type { ListingPolicyChange } from '@/components/listing/editor/PoliciesPanel.client';
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
    readonly errors: Readonly<{
        maxGuests?: string;
        bedrooms?: string;
        bathrooms?: string;
        'policies.minNights'?: string;
    }>;
    readonly onFieldChange: (field: keyof AccommodationEditData, value: number | null) => void;
    /**
     * Sets or removes a house-rule key (HOS-2060). This section edits only
     * `policies.minNights`, the minimum stay the publish gate requires.
     */
    readonly onPolicyChange: ListingPolicyChange;
}

/**
 * Capacity form section.
 * Renders maxGuests, bedrooms, and bathrooms number inputs.
 */
export function CapacitySection({
    locale,
    data,
    errors,
    onFieldChange,
    onPolicyChange
}: CapacitySectionProps) {
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

                <div className={styles.field}>
                    <TextField
                        prefix={ACCOMMODATION_FIELD_PREFIX}
                        name="policies.minNights"
                        label={t('host.properties.editor.field.minNights', 'Mínimo de noches')}
                        labelClassName={styles.fieldLabel}
                        className={styles.fieldInput}
                        error={errors['policies.minNights']}
                        type="number"
                        value={data.policies.minNights ?? ''}
                        min={1}
                        max={365}
                        onChange={(e) =>
                            onPolicyChange(
                                'minNights',
                                e.target.value === '' ? undefined : Number(e.target.value)
                            )
                        }
                    />
                    <p className={styles.fieldHint}>
                        {t(
                            'host.properties.editor.field.minNightsHint',
                            'La cantidad mínima de noches que un huésped debe reservar. Se muestra en la ficha pública.'
                        )}
                    </p>
                </div>
            </div>
        </fieldset>
    );
}
