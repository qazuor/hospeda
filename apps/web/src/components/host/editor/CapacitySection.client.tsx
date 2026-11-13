/**
 * @file CapacitySection.client.tsx
 * @description Form section for accommodation capacity: maxGuests, bedrooms,
 * bathrooms, and the stay length — `policies.minNights` (HOS-2060) and, next to
 * it, `policies.maxNights` (moved here from the Policies panel, HOS-2121). Uses
 * native HTML number inputs.
 *
 * Emptying either stay bound REMOVES its key (`onPolicyChange(key, undefined)`),
 * which the page's PATCH turns into `null` (HOS-910: a saved minimum must be
 * clearable; only publishing requires one).
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
        'policies.maxNights'?: string;
    }>;
    readonly onFieldChange: (field: keyof AccommodationEditData, value: number | null) => void;
    /**
     * Sets or removes a house-rule key (HOS-2060). This section edits only
     * the stay length: `policies.minNights` (the minimum the publish gate
     * requires) and `policies.maxNights`.
     */
    readonly onPolicyChange: ListingPolicyChange;
}

/** Parses a nights input; `undefined` when empty or not an integer. */
function readNights(raw: string): number | undefined {
    const trimmed = raw.trim();
    if (trimmed === '') return undefined;
    const parsed = Number(trimmed);
    return Number.isInteger(parsed) ? parsed : undefined;
}

/**
 * Capacity form section.
 * Renders maxGuests, bedrooms, bathrooms and the min/max nights inputs.
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
                        onChange={(e) => onPolicyChange('minNights', readNights(e.target.value))}
                    />
                    <p className={styles.fieldHint}>
                        {t(
                            'host.properties.editor.field.minNightsHint',
                            'La cantidad mínima de noches que un huésped debe reservar. Se muestra en la ficha pública.'
                        )}
                    </p>
                </div>

                <div className={styles.field}>
                    <TextField
                        prefix={ACCOMMODATION_FIELD_PREFIX}
                        name="policies.maxNights"
                        label={t('host.properties.editor.field.maxNights', 'Máximo de noches')}
                        labelClassName={styles.fieldLabel}
                        className={styles.fieldInput}
                        error={errors['policies.maxNights']}
                        type="number"
                        value={data.policies.maxNights ?? ''}
                        min={data.policies.minNights ?? 1}
                        max={365}
                        step={1}
                        onChange={(e) => onPolicyChange('maxNights', readNights(e.target.value))}
                    />
                    <p className={styles.fieldHint}>
                        {t(
                            'host.properties.editor.field.maxNightsHint',
                            'Opcional. La cantidad máxima de noches por reserva; no puede ser menor que el mínimo.'
                        )}
                    </p>
                </div>
            </div>
        </fieldset>
    );
}
