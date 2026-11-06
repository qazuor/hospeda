/**
 * @file ServicesForm.client.tsx
 * @description Form island for `…/editar/servicios/` (HOS-318 T-023).
 *
 * Amenities and features. No new endpoint was needed: the accommodation service
 * already opens its own transaction when `amenityIds`/`featureIds` arrive
 * (SPEC-172), so giving them their own page aligns the UI with a boundary the
 * backend already draws.
 *
 * This is the ONLY editor page that requests the amenity/feature catalogs.
 * Before the split every screen paid for them.
 *
 * HOS-2058: each checked amenity can also declare scope (private/shared) and
 * availability (year-round/seasonal). Those travel as the write-only
 * `amenityAttributes` list, built by `buildAmenityAttributesPayload` through
 * `extendPayload` rather than through `OWN_FIELDS`: the form keeps a map keyed
 * by amenity id, and the wire wants a list of the CHECKED amenities only,
 * compared by value against the baseline.
 */

import type { AccommodationEditData, AmenityAttributeValue, AmenityData } from '@/lib/api/types';
import type { SupportedLocale } from '@/lib/i18n';
import { ActionBar } from '../ActionBar.client';
import { AmenitiesSection } from '../AmenitiesSection.client';
import { AccommodationServicesSchema } from '../accommodation-edit-form.schema';
import { buildAmenityAttributesPayload } from '../amenity-attributes-payload';
import { useAccommodationSectionForm } from '../use-accommodation-section-form';
import styles from './SectionForm.module.css';

/**
 * The fields this page owns. Nothing else can reach the PATCH body, except
 * `amenityAttributes`, which `extendAttributes` adds (see the file docblock).
 */
const OWN_FIELDS = ['amenityIds', 'featureIds'] as const;

/** Module-level so the hook's payload memo does not recompute on every render. */
function extendAttributes({
    values,
    baseline
}: {
    readonly values: AccommodationEditData;
    readonly baseline: AccommodationEditData;
}): Record<string, unknown> {
    return { ...buildAmenityAttributesPayload({ values, baseline }) };
}

/** An empty declaration, used when an amenity has none yet. */
const NO_ATTRIBUTES: AmenityAttributeValue = { scope: null, availability: null };

interface ServicesFormProps {
    readonly locale: SupportedLocale;
    readonly accommodationId: string;
    readonly initialData: AccommodationEditData;
    readonly amenities: readonly AmenityData[];
    readonly features: readonly AmenityData[];
}

/**
 * Amenities and features form for one accommodation.
 *
 * @param props - Locale, id, the loaded entity, and both catalogs.
 */
export function ServicesForm({
    locale,
    accommodationId,
    initialData,
    amenities,
    features
}: ServicesFormProps) {
    const form = useAccommodationSectionForm({
        locale,
        accommodationId,
        initialValues: initialData,
        ownFields: [...OWN_FIELDS],
        schema: AccommodationServicesSchema,
        extendPayload: extendAttributes
    });

    const setAttribute = <K extends keyof AmenityAttributeValue>(
        amenityId: string,
        field: K,
        value: AmenityAttributeValue[K]
    ) => {
        const current = form.values.amenityAttributes ?? {};
        const next: AmenityAttributeValue = {
            ...(current[amenityId] ?? NO_ATTRIBUTES),
            [field]: value
        };
        form.setValue('amenityAttributes', { ...current, [amenityId]: next });
    };

    const toggle = (field: 'amenityIds' | 'featureIds', id: string) => {
        const current = form.values[field];
        form.setValue(
            field,
            current.includes(id) ? current.filter((item) => item !== id) : [...current, id]
        );
    };

    return (
        <form
            className={styles.form}
            onSubmit={form.handleSubmit}
            noValidate
        >
            <div className={styles.card}>
                <AmenitiesSection
                    locale={locale}
                    data={form.values}
                    amenities={amenities}
                    features={features}
                    onToggleAmenity={(id) => toggle('amenityIds', id)}
                    onToggleFeature={(id) => toggle('featureIds', id)}
                    onChangeAmenityAttribute={setAttribute}
                />
            </div>

            {form.formError && (
                <div
                    className={styles.error}
                    role="alert"
                >
                    {form.formError}
                </div>
            )}

            <ActionBar
                locale={locale}
                isSaving={form.isSaving}
                onCancel={form.handleCancel}
            />
        </form>
    );
}
