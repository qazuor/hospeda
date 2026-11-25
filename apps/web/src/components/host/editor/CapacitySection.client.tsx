/**
 * @file CapacitySection.client.tsx
 * @description Form section for accommodation capacity: maxGuests, bedrooms,
 * bathrooms, and the stay length — `policies.minNights` (HOS-2060) and, next to
 * it, `policies.maxNights` (moved here from the Policies panel, HOS-2121).
 * Kit `Section` + `Field` controls since HOS-2503; field ids are unchanged.
 *
 * Emptying either stay bound REMOVES its key (`onPolicyChange(key, undefined)`),
 * which the page's PATCH turns into `null` (HOS-910: a saved minimum must be
 * clearable; only publishing requires one).
 */

import type { JSX } from 'react';
import { Field } from '@/components/account/ui/Field';
import { Section } from '@/components/account/ui/Section';
import { TextInput } from '@/components/account/ui/TextInput';
import type { ListingPolicyChange } from '@/components/listing/editor/PoliciesPanel.client';
import type { AccommodationEditData } from '@/lib/api/types';
import { sectionHelpId } from '@/lib/help/section-help-id';
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

/** Parses a count input; `null` when empty. */
function readCount(raw: string): number | null {
    return raw === '' ? null : Number(raw);
}

/**
 * Capacity form section.
 * Renders maxGuests, bedrooms, bathrooms and the min/max nights inputs.
 *
 * @param props - See {@link CapacitySectionProps}.
 * @returns One kit Section.
 */
export function CapacitySection({
    locale,
    data,
    errors,
    onFieldChange,
    onPolicyChange
}: CapacitySectionProps): JSX.Element {
    const { t } = createTranslations(locale);
    const idOf = (name: string) => ({ prefix: ACCOMMODATION_FIELD_PREFIX, name });

    return (
        <Section
            id="editor-capacity"
            title={t('host.properties.editor.section.capacity', 'Capacidad')}
            helpId={sectionHelpId({ vertical: 'accommodation', slug: 'capacidad-precio' })}
        >
            <div className={styles.grid}>
                <Field
                    locale={locale}
                    idParts={idOf('maxGuests')}
                    label={t('host.properties.editor.field.maxGuests', 'Huéspedes máx.')}
                    error={errors.maxGuests}
                >
                    <TextInput
                        type="number"
                        inputMode="numeric"
                        value={data.maxGuests ?? ''}
                        min={1}
                        max={200}
                        onChange={(e) => onFieldChange('maxGuests', readCount(e.target.value))}
                    />
                </Field>

                <Field
                    locale={locale}
                    idParts={idOf('bedrooms')}
                    label={t('host.properties.editor.field.bedrooms', 'Dormitorios')}
                    error={errors.bedrooms}
                >
                    <TextInput
                        type="number"
                        inputMode="numeric"
                        value={data.bedrooms ?? ''}
                        min={0}
                        max={100}
                        onChange={(e) => onFieldChange('bedrooms', readCount(e.target.value))}
                    />
                </Field>

                <Field
                    locale={locale}
                    idParts={idOf('bathrooms')}
                    label={t('host.properties.editor.field.bathrooms', 'Baños')}
                    error={errors.bathrooms}
                >
                    <TextInput
                        type="number"
                        inputMode="numeric"
                        value={data.bathrooms ?? ''}
                        min={1}
                        max={100}
                        onChange={(e) => onFieldChange('bathrooms', readCount(e.target.value))}
                    />
                </Field>

                <div className={styles.stayBounds}>
                    <Field
                        locale={locale}
                        idParts={idOf('policies.minNights')}
                        label={t('host.properties.editor.field.minNights', 'Mínimo de noches')}
                        hint={t(
                            'host.properties.editor.field.minNightsHint',
                            'La cantidad mínima de noches que un huésped debe reservar. Se muestra en la ficha pública.'
                        )}
                        error={errors['policies.minNights']}
                    >
                        <TextInput
                            type="number"
                            inputMode="numeric"
                            value={data.policies.minNights ?? ''}
                            min={1}
                            max={365}
                            onChange={(e) =>
                                onPolicyChange('minNights', readNights(e.target.value))
                            }
                        />
                    </Field>

                    <Field
                        locale={locale}
                        idParts={idOf('policies.maxNights')}
                        label={t('host.properties.editor.field.maxNights', 'Máximo de noches')}
                        hint={t(
                            'host.properties.editor.field.maxNightsHint',
                            'Opcional. La cantidad máxima de noches por reserva; no puede ser menor que el mínimo.'
                        )}
                        error={errors['policies.maxNights']}
                    >
                        <TextInput
                            type="number"
                            inputMode="numeric"
                            value={data.policies.maxNights ?? ''}
                            min={data.policies.minNights ?? 1}
                            max={365}
                            step={1}
                            onChange={(e) =>
                                onPolicyChange('maxNights', readNights(e.target.value))
                            }
                        />
                    </Field>
                </div>
            </div>
        </Section>
    );
}
