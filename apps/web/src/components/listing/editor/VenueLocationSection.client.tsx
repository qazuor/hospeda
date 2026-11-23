/**
 * @file VenueLocationSection.client.tsx
 * @description Postal address section of the venue owner editor (HOS-2189),
 * on the kit with a map pin since HOS-2496.
 *
 * Mirrors the accommodation `location` model: street, number, floor,
 * apartment and optional coordinates. City, neighborhood and department are
 * NOT asked here; they come from the destination chosen in the basic-info
 * page. Unlike an accommodation, a venue is a business open to the public, so
 * the address entered here is the one the public page shows, and the pin is
 * exact.
 */

import type { JSX } from 'react';
import fieldStyles from '@/components/account/editor-fields/EditorFields.module.css';
import { EditorMapPin } from '@/components/account/editor-fields/EditorMapPin';
import { Field } from '@/components/account/ui/Field';
import { Section } from '@/components/account/ui/Section';
import { TextInput } from '@/components/account/ui/TextInput';
import { buildFieldId } from '@/lib/forms/build-field-id';
import { sectionHelpId } from '@/lib/help/section-help-id';
import { createT, type SupportedLocale } from '@/lib/i18n';
import { LISTING_FIELD_PREFIX } from './field-ids';
import type { ListingEditData, ListingFieldChange, LocationValues } from './listing-edit-data';

/** Props of {@link VenueLocationSection}. */
export interface VenueLocationSectionProps {
    readonly locale: SupportedLocale;
    readonly data: ListingEditData;
    readonly errors: Readonly<Record<string, string | undefined>>;
    readonly onFieldChange: ListingFieldChange;
}

/** One address input: its member, its i18n label key, its cap and whether it is optional. */
const ADDRESS_FIELDS = [
    { key: 'street', label: 'street', maxLength: 50, optional: false },
    { key: 'number', label: 'number', maxLength: 10, optional: false },
    { key: 'floor', label: 'floor', maxLength: 10, optional: true },
    { key: 'apartment', label: 'apartment', maxLength: 10, optional: true }
] as const satisfies ReadonlyArray<{
    readonly key: keyof LocationValues;
    readonly label: string;
    readonly maxLength: number;
    readonly optional: boolean;
}>;

/**
 * Renders the venue address and its map pin.
 *
 * @param props - Locale, form state, field errors and the change callback.
 * @returns A kit `Section`.
 */
export function VenueLocationSection({
    locale,
    data,
    errors,
    onFieldChange
}: VenueLocationSectionProps): JSX.Element {
    const t = createT(locale);
    const location = data.location;

    const setMembers = (patch: Partial<LocationValues>) => {
        onFieldChange('location', { ...location, ...patch });
    };

    return (
        <Section
            id="editor-location"
            title={t('account.editorFields.location.title')}
            description={t('account.editorFields.location.addressHint')}
            helpId={sectionHelpId({ vertical: 'venue', slug: 'ubicacion' })}
        >
            <div className={fieldStyles.stack}>
                <div className={fieldStyles.grid}>
                    {ADDRESS_FIELDS.map((field) => (
                        <Field
                            key={field.key}
                            locale={locale}
                            label={t(`account.editorFields.location.${field.label}`)}
                            id={buildFieldId({
                                prefix: LISTING_FIELD_PREFIX,
                                name: `location.${field.key}`
                            })}
                            error={errors[`location.${field.key}`]}
                            optional={field.optional}
                        >
                            <TextInput
                                type="text"
                                maxLength={field.maxLength}
                                value={location[field.key]}
                                onChange={(event) =>
                                    setMembers({ [field.key]: event.target.value })
                                }
                            />
                        </Field>
                    ))}
                </div>
                <EditorMapPin
                    locale={locale}
                    idPrefix={LISTING_FIELD_PREFIX}
                    mapLabel={t('account.editorFields.location.venueMapLabel')}
                    lat={{
                        name: 'location.coordinates.lat',
                        value: location.lat,
                        error: errors['location.coordinates.lat']
                    }}
                    long={{
                        name: 'location.coordinates.long',
                        value: location.long,
                        error: errors['location.coordinates.long']
                    }}
                    onChange={(next) => setMembers({ lat: next.lat, long: next.long })}
                />
            </div>
        </Section>
    );
}
