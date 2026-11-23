/**
 * @file LocationForm.client.tsx
 * @description Form island for `…/editar/ubicacion/` (HOS-318 T-022).
 *
 * Split into its own page precisely because it is a map: a full-screen
 * interaction, and the single worst thing to embed inside a long mobile scroll
 * (D-4).
 *
 * Latitude and longitude always leave together — enforced by the shared hook,
 * which this page must not work around.
 *
 * HOS-2496: the fields render through the ONE location section both editors
 * share (`ListingLocationSection`), with the accommodation's address search and
 * «use my location» switched on. The exact address is stored but never public:
 * visitors only see an approximate pin (SPEC-097 strips `location` from every
 * non-owner response), which is what the section description tells the host.
 */

import {
    type AddressMember,
    ListingLocationSection
} from '@/components/account/editor-fields/ListingLocationSection';
import { EditorSaveBar } from '@/components/account/editor-shell/EditorSaveBar';
import { LocationExceptionRequestTrigger } from '@/components/listing/LocationExceptionRequestTrigger.client';
import type { AccommodationEditData } from '@/lib/api/types';
import { createT, type SupportedLocale } from '@/lib/i18n';
import { buildLocationExceptionTarget } from '@/lib/listing/location-exception';
import { AccommodationLocationSchema } from '../accommodation-edit-form.schema';
import { ACCOMMODATION_FIELD_ID_SUFFIXES, ACCOMMODATION_FIELD_PREFIX } from '../field-ids';
import { useAccommodationSectionForm } from '../use-accommodation-section-form';
import styles from './SectionForm.module.css';

/** The fields this page owns. Nothing else can reach the PATCH body. */
const OWN_FIELDS = ['latitude', 'longitude', 'street', 'number', 'floor', 'apartment'] as const;

/** The four postal-address members and their label keys, in display order. */
const ADDRESS_FIELDS = [
    { key: 'street', label: 'host.properties.editor.field.street' },
    { key: 'number', label: 'host.properties.editor.field.number' },
    { key: 'floor', label: 'host.properties.editor.field.floor' },
    { key: 'apartment', label: 'host.properties.editor.field.apartment' }
] as const;

/**
 * Renders a stored coordinate as input text; `null` is an empty box, never `'0'`.
 *
 * @param params - The stored `value`.
 * @returns The input text.
 */
function coordinateText({ value }: { readonly value: number | null }): string {
    return value === null ? '' : String(value);
}

/**
 * Parses coordinate input text back to the form's `number | null`.
 *
 * @param params - The raw input `value`.
 * @returns The number, or `null` for an empty or unparseable box.
 */
function coordinateNumber({ value }: { readonly value: string }): number | null {
    const trimmed = value.trim();
    if (trimmed.length === 0) return null;
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : null;
}

interface LocationFormProps {
    readonly locale: SupportedLocale;
    readonly accommodationId: string;
    readonly initialData: AccommodationEditData;
}

/**
 * Location form for one accommodation.
 *
 * @param props - Locale, id, and the loaded entity.
 */
export function LocationForm({ locale, accommodationId, initialData }: LocationFormProps) {
    const form = useAccommodationSectionForm({
        locale,
        accommodationId,
        initialValues: initialData,
        ownFields: [...OWN_FIELDS],
        schema: AccommodationLocationSchema
    });

    const t = createT(locale);

    const address: readonly AddressMember[] = ADDRESS_FIELDS.map(({ key, label }) => ({
        name: key,
        label: t(label),
        value: form.values[key],
        onChange: (value: string) => form.setValue(key, value),
        error: form.fieldErrors[key]
    }));

    // HOS-2192: a refused move onto an occupied address offers an exception request for it.
    const refusedTarget = form.refusedLocation
        ? buildLocationExceptionTarget(form.refusedLocation)
        : null;

    return (
        <form
            className={styles.form}
            onSubmit={form.handleSubmit}
            noValidate
        >
            <ListingLocationSection
                locale={locale}
                idPrefix={ACCOMMODATION_FIELD_PREFIX}
                title={t('host.properties.editor.section.location')}
                description={t('host.properties.editor.location.addressHint')}
                helpId="section:accommodation.ubicacion"
                address={address}
                finder={{
                    onAddressFound: (found) => {
                        if (found.street) form.setValue('street', found.street);
                        if (found.number) form.setValue('number', found.number);
                    }
                }}
                pin={{
                    mapLabel: t('host.properties.editor.location.mapAriaLabel'),
                    lat: {
                        name: 'latitude',
                        value: coordinateText({ value: form.values.latitude }),
                        error: form.fieldErrors.latitude
                    },
                    long: {
                        name: 'longitude',
                        value: coordinateText({ value: form.values.longitude }),
                        error: form.fieldErrors.longitude
                    },
                    onChange: (next) => {
                        form.setValue('latitude', coordinateNumber({ value: next.lat }));
                        form.setValue('longitude', coordinateNumber({ value: next.long }));
                    }
                }}
            />

            {form.formError && (
                <div
                    className={styles.error}
                    role="alert"
                >
                    {form.formError}
                </div>
            )}

            {refusedTarget && (
                <LocationExceptionRequestTrigger
                    locale={locale}
                    vertical="accommodation"
                    listingId={accommodationId}
                    location={refusedTarget}
                />
            )}

            <EditorSaveBar
                locale={locale}
                isDirty={form.isDirty}
                onSave={form.save}
                onDiscard={form.discard}
                idPrefix={ACCOMMODATION_FIELD_PREFIX}
                suffixes={ACCOMMODATION_FIELD_ID_SUFFIXES}
            />
        </form>
    );
}
