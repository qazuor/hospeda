/**
 * @file AmenityAttributeControls.client.tsx
 * @description The collapsed "Detalles" disclosure a CHECKED amenity carries in
 * the catalog picker: two radio groups, scope (private / shared / not
 * specified) and availability (year-round / seasonal / not specified).
 *
 * Moved out of the accommodation editor's `AmenitiesSection` (HOS-2058) when
 * the three owner editors adopted one picker (HOS-2061). "Not specified" is
 * NULL on the relation row: the public page shows no badge for it and nothing
 * is inferred.
 */

import type { JSX } from 'react';
import type {
    AmenityAttributeValue,
    AmenityAvailabilityValue,
    AmenityScopeValue
} from '@/lib/api/types';
import styles from './CatalogPicker.module.css';

/** Translator shape used by the controls. */
type Translate = (key: string, fallback?: string) => string;

/** One radio option; `value: null` is "not specified". */
interface AttributeOption<V extends string> {
    readonly value: V | null;
    readonly i18nKey: string;
    readonly fallback: string;
}

const SCOPE_OPTIONS: readonly AttributeOption<AmenityScopeValue>[] = [
    { value: 'private', i18nKey: 'private', fallback: 'Privado' },
    { value: 'shared', i18nKey: 'shared', fallback: 'Compartido' },
    { value: null, i18nKey: 'unset', fallback: 'Sin indicar' }
];

const AVAILABILITY_OPTIONS: readonly AttributeOption<AmenityAvailabilityValue>[] = [
    { value: 'year_round', i18nKey: 'yearRound', fallback: 'Todo el año' },
    { value: 'seasonal', i18nKey: 'seasonal', fallback: 'De temporada' },
    { value: null, i18nKey: 'unset', fallback: 'Sin indicar' }
];

/** Every attribute undeclared. */
export const NO_AMENITY_ATTRIBUTES: AmenityAttributeValue = { scope: null, availability: null };

/** Setter for one declared attribute of one amenity; `null` = not specified. */
export type AmenityAttributeChange = <K extends keyof AmenityAttributeValue>(
    amenityId: string,
    field: K,
    value: AmenityAttributeValue[K]
) => void;

/**
 * A radio group for one attribute of one amenity. The radio `name` is scoped
 * to the picker and the amenity so groups never share state.
 */
function AttributeRadioGroup<V extends string>({
    name,
    legendKey,
    legendFallback,
    options,
    current,
    t,
    onChange
}: {
    readonly name: string;
    readonly legendKey: string;
    readonly legendFallback: string;
    readonly options: readonly AttributeOption<V>[];
    readonly current: V | null;
    readonly t: Translate;
    readonly onChange: (value: V | null) => void;
}): JSX.Element {
    return (
        <fieldset className={styles.attributeGroup}>
            <legend className={styles.attributeLegend}>
                {t(`accommodations.amenityAttributes.${legendKey}.label`, legendFallback)}
            </legend>
            {options.map((option) => (
                <label
                    key={option.i18nKey}
                    className={styles.attributeOption}
                >
                    <input
                        type="radio"
                        name={name}
                        checked={current === option.value}
                        onChange={() => onChange(option.value)}
                    />
                    <span>
                        {t(
                            `accommodations.amenityAttributes.${legendKey}.${option.i18nKey}`,
                            option.fallback
                        )}
                    </span>
                </label>
            ))}
        </fieldset>
    );
}

/** Props for {@link AmenityAttributeControls}. */
export interface AmenityAttributeControlsProps {
    /** Scopes the radio `name`s so two pickers on one page never collide. */
    readonly idPrefix: string;
    readonly amenityId: string;
    readonly declared: AmenityAttributeValue;
    readonly t: Translate;
    readonly onChange: AmenityAttributeChange;
}

/**
 * Collapsed scope/availability controls for one checked amenity.
 *
 * @param props - {@link AmenityAttributeControlsProps}
 * @returns The disclosure element
 */
export function AmenityAttributeControls({
    idPrefix,
    amenityId,
    declared,
    t,
    onChange
}: AmenityAttributeControlsProps): JSX.Element {
    return (
        <details className={styles.attributes}>
            <summary className={styles.attributesSummary}>
                {t('host.properties.editor.field.amenityDetails', 'Detalles')}
            </summary>
            <p className={styles.attributesHint}>
                {t(
                    'host.properties.editor.field.amenityDetailsHint',
                    'Indicá si es de uso privado o compartido y si está disponible todo el año.'
                )}
            </p>
            <AttributeRadioGroup
                name={`${idPrefix}-amenity-${amenityId}-scope`}
                legendKey="scope"
                legendFallback="Uso"
                options={SCOPE_OPTIONS}
                current={declared.scope}
                t={t}
                onChange={(value) => onChange(amenityId, 'scope', value)}
            />
            <AttributeRadioGroup
                name={`${idPrefix}-amenity-${amenityId}-availability`}
                legendKey="availability"
                legendFallback="Disponibilidad"
                options={AVAILABILITY_OPTIONS}
                current={declared.availability}
                t={t}
                onChange={(value) => onChange(amenityId, 'availability', value)}
            />
        </details>
    );
}
