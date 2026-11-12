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
 *
 * HOS-2061: the amenities/features are rendered by the shared `CatalogPicker`
 * (featured first, search, per-category accordions), the same component the
 * venue/experience editor uses.
 *
 * HOS-2060: the page also carries the house-rules panel, because the catalog
 * puts `policies` in the amenities section. Its keys travel as a `policies`
 * PATCH object through the same `extendPayload` — every key except
 * `minNights` and `maxNights`, which the capacity/pricing page owns (the
 * minimum is a publish requirement and its hub status points there; the
 * maximum moved next to it in HOS-2121).
 */

import { PoliciesPanel } from '@/components/listing/editor/PoliciesPanel.client';
import { CatalogPicker } from '@/components/shared/catalog-picker/CatalogPicker.client';
import type { AccommodationEditData, AmenityAttributeValue, AmenityData } from '@/lib/api/types';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import {
    buildListingPoliciesPatch,
    LISTING_BASE_POLICY_KEYS,
    type ListingPolicyKey,
    setListingPolicy
} from '@/lib/listing/listing-policies';
import { ActionBar } from '../ActionBar.client';
import { AccommodationServicesSchema } from '../accommodation-edit-form.schema';
import { buildAmenityAttributesPayload } from '../amenity-attributes-payload';
import { ACCOMMODATION_FIELD_PREFIX } from '../field-ids';
import { useAccommodationSectionForm } from '../use-accommodation-section-form';
import styles from './SectionForm.module.css';
import pickerSectionStyles from './ServicesForm.module.css';

/**
 * The fields this page owns. Nothing else can reach the PATCH body, except
 * `amenityAttributes`, which `extendAttributes` adds (see the file docblock).
 */
const OWN_FIELDS = ['amenityIds', 'featureIds'] as const;

/**
 * The house-rule keys this page's Policies panel owns (HOS-2060): the shared
 * base plus the accommodation's check-in/out, the private-events details
 * (HOS-2122, right after `eventsAllowed`, the base's last key, so they render
 * under it), the booking deposit and the spoken languages (HOS-2120).
 *
 * The stay length is NOT here: `minNights` and `maxNights` both live on the
 * capacity/pricing page (HOS-2121).
 */
const ACCOMMODATION_SERVICES_POLICY_KEYS: readonly ListingPolicyKey[] = [
    'checkIn',
    'checkOut',
    ...LISTING_BASE_POLICY_KEYS,
    'eventsDetails',
    'deposit',
    'spokenLanguages'
];

/** Module-level so the hook's payload memo does not recompute on every render. */
function extendAttributes({
    values,
    baseline
}: {
    readonly values: AccommodationEditData;
    readonly baseline: AccommodationEditData;
}): Record<string, unknown> {
    const policies = buildListingPoliciesPatch({
        current: values.policies,
        baseline: baseline.policies,
        keys: ACCOMMODATION_SERVICES_POLICY_KEYS
    });
    return {
        ...buildAmenityAttributesPayload({ values, baseline }),
        ...(policies ? { policies } : {})
    };
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
    const { t } = createTranslations(locale);
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
                <fieldset className={pickerSectionStyles.section}>
                    <legend className={pickerSectionStyles.sectionTitle}>
                        {t('host.properties.editor.section.amenities', 'Servicios y comodidades')}
                    </legend>
                    <CatalogPicker
                        locale={locale}
                        amenitiesTitle={t('host.properties.editor.field.amenities', 'Comodidades')}
                        featuresTitle={t(
                            'host.properties.editor.field.features',
                            'Características'
                        )}
                        amenities={amenities}
                        features={features}
                        selectedAmenityIds={new Set(form.values.amenityIds)}
                        selectedFeatureIds={new Set(form.values.featureIds)}
                        onToggleAmenity={(id) => toggle('amenityIds', id)}
                        onToggleFeature={(id) => toggle('featureIds', id)}
                        amenityAttributes={form.values.amenityAttributes}
                        onChangeAmenityAttribute={setAttribute}
                    />
                </fieldset>
            </div>

            <div className={styles.card}>
                <PoliciesPanel
                    locale={locale}
                    idPrefix={ACCOMMODATION_FIELD_PREFIX}
                    keys={ACCOMMODATION_SERVICES_POLICY_KEYS}
                    policies={form.values.policies}
                    errors={form.fieldErrors}
                    onChange={(key, value) =>
                        form.setValue(
                            'policies',
                            setListingPolicy({ policies: form.values.policies, key, value })
                        )
                    }
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
