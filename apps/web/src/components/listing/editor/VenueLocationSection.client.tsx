/**
 * @file VenueLocationSection.client.tsx
 * @description Postal address section of the venue owner editor (HOS-2189).
 *
 * Mirrors the accommodation `location` model: street, number, floor,
 * apartment and optional coordinates. City, neighborhood and department are
 * NOT asked here; they come from the destination chosen in the basic-info
 * page. Unlike an accommodation, a venue is a business open to the public, so
 * the address entered here is the one the public page shows.
 *
 * The coordinates are plain inputs (like the experience meeting point) rather
 * than the accommodation map picker: that picker's copy talks about
 * accommodations and about an approximate public pin, both false for a venue.
 */

import type { JSX } from 'react';
import { TextField } from '@/components/ui/TextField';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import styles from './editor-fields.module.css';
import { LISTING_FIELD_PREFIX } from './field-ids';
import type { ListingEditData, ListingFieldChange, LocationValues } from './listing-edit-data';

/** Props of {@link VenueLocationSection}. */
export interface VenueLocationSectionProps {
    readonly locale: SupportedLocale;
    readonly data: ListingEditData;
    readonly errors: Readonly<Record<string, string | undefined>>;
    readonly onFieldChange: ListingFieldChange;
}

/**
 * Renders the venue address form.
 *
 * @param props - Locale, form state, field errors and the change callback.
 * @returns The section.
 */
export function VenueLocationSection({
    locale,
    data,
    errors,
    onFieldChange
}: VenueLocationSectionProps): JSX.Element {
    const { t } = createTranslations(locale);

    const setMember = ({
        key,
        value
    }: {
        readonly key: keyof LocationValues;
        readonly value: string;
    }) => {
        onFieldChange('location', { ...data.location, [key]: value });
    };

    return (
        <fieldset
            className={styles.section}
            id="editor-location"
        >
            <legend className={styles.label}>
                {t('listing.owner.editor.sections.location', 'Dirección')}
            </legend>
            <TextField
                prefix={LISTING_FIELD_PREFIX}
                name="location.street"
                label={t('listing.owner.editor.sections.locationStreet', 'Calle')}
                labelClassName={styles.label}
                className={styles.input}
                error={errors['location.street']}
                type="text"
                maxLength={50}
                value={data.location.street}
                onChange={(event) => setMember({ key: 'street', value: event.target.value })}
            />
            <TextField
                prefix={LISTING_FIELD_PREFIX}
                name="location.number"
                label={t('listing.owner.editor.sections.locationNumber', 'Número')}
                labelClassName={styles.label}
                className={styles.input}
                error={errors['location.number']}
                type="text"
                maxLength={10}
                value={data.location.number}
                onChange={(event) => setMember({ key: 'number', value: event.target.value })}
            />
            <TextField
                prefix={LISTING_FIELD_PREFIX}
                name="location.floor"
                label={t('listing.owner.editor.sections.locationFloor', 'Piso (opcional)')}
                labelClassName={styles.label}
                className={styles.input}
                error={errors['location.floor']}
                type="text"
                maxLength={10}
                value={data.location.floor}
                onChange={(event) => setMember({ key: 'floor', value: event.target.value })}
            />
            <TextField
                prefix={LISTING_FIELD_PREFIX}
                name="location.apartment"
                label={t(
                    'listing.owner.editor.sections.locationApartment',
                    'Departamento o local (opcional)'
                )}
                labelClassName={styles.label}
                className={styles.input}
                error={errors['location.apartment']}
                type="text"
                maxLength={10}
                value={data.location.apartment}
                onChange={(event) => setMember({ key: 'apartment', value: event.target.value })}
            />
            <p className={styles.hint}>
                {t(
                    'listing.owner.editor.sections.locationHint',
                    'La ciudad sale del destino que elegiste en Información básica. Esta dirección se muestra en tu ficha pública.'
                )}
            </p>
            <TextField
                prefix={LISTING_FIELD_PREFIX}
                name="location.coordinates.lat"
                label={t('listing.owner.editor.sections.locationLat', 'Latitud (opcional)')}
                labelClassName={styles.label}
                className={styles.input}
                error={errors['location.coordinates.lat']}
                type="text"
                inputMode="decimal"
                value={data.location.lat}
                placeholder="-32.4825"
                onChange={(event) => setMember({ key: 'lat', value: event.target.value })}
            />
            <TextField
                prefix={LISTING_FIELD_PREFIX}
                name="location.coordinates.long"
                label={t('listing.owner.editor.sections.locationLong', 'Longitud (opcional)')}
                labelClassName={styles.label}
                className={styles.input}
                error={errors['location.coordinates.long']}
                type="text"
                inputMode="decimal"
                value={data.location.long}
                placeholder="-58.2333"
                onChange={(event) => setMember({ key: 'long', value: event.target.value })}
            />
            <p className={styles.hint}>
                {t(
                    'listing.owner.editor.sections.locationCoordsHint',
                    'Si cargás las dos coordenadas, mostramos el local en un mapa. Podés dejarlas vacías.'
                )}
            </p>
        </fieldset>
    );
}
