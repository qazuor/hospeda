import type { TranslationKey } from '@repo/i18n';
import { getAmenityTypeColorScheme, getAmenityTypeIcon } from '@repo/icons';
import type { AmenitiesTypeEnum } from '@repo/schemas';
import { useTranslations } from '@/hooks/use-translations';
import type { Amenity } from '../schemas/amenities.schemas';

/**
 * Maps each `AmenitiesTypeEnum` value to its i18n label key. Exhaustive over the
 * enum: a new type fails to compile until it gets a label.
 */
export const TYPE_LABEL_KEYS: Readonly<Record<AmenitiesTypeEnum, TranslationKey>> = {
    CLIMATE_CONTROL: 'admin-entities.types.amenity.climateControl',
    CONNECTIVITY: 'admin-entities.types.amenity.connectivity',
    ENTERTAINMENT: 'admin-entities.types.amenity.entertainment',
    KITCHEN: 'admin-entities.types.amenity.kitchen',
    BED_AND_BATH: 'admin-entities.types.amenity.bedAndBath',
    OUTDOORS: 'admin-entities.types.amenity.outdoors',
    ACCESSIBILITY: 'admin-entities.types.amenity.accessibility',
    SERVICES: 'admin-entities.types.amenity.services',
    SAFETY: 'admin-entities.types.amenity.safety',
    FAMILY_FRIENDLY: 'admin-entities.types.amenity.familyFriendly',
    WORK_FRIENDLY: 'admin-entities.types.amenity.workFriendly',
    // HOS-2058
    PARKING: 'admin-entities.types.amenity.parking',
    LAUNDRY: 'admin-entities.types.amenity.laundry',
    WATER_ACTIVITIES: 'admin-entities.types.amenity.waterActivities',
    WELLNESS: 'admin-entities.types.amenity.wellness',
    DINING: 'admin-entities.types.amenity.dining',
    GENERAL_APPLIANCES: 'admin-entities.types.amenity.generalAppliances'
};

/**
 * Resolves the label key for a raw (possibly unknown/lowercase) type string.
 *
 * @returns The i18n key, or `undefined` when the type is not a known enum value.
 */
export const getAmenityTypeLabelKey = (type: string): TranslationKey | undefined =>
    (TYPE_LABEL_KEYS as Readonly<Record<string, TranslationKey | undefined>>)[type.toUpperCase()];

/**
 * Type cell for the amenities list: colored pill showing the amenity-type
 * icon + localized label. Icon and color tokens come from the cross-app SSOT
 * in `@repo/icons`, so a type renders identically in admin and web.
 */
export const AmenityTypeBadge = ({ row }: { readonly row: Amenity }) => {
    const { t } = useTranslations();
    const type = typeof row.type === 'string' ? row.type : '';

    if (!type) {
        return <span className="text-muted-foreground">—</span>;
    }

    const Icon = getAmenityTypeIcon({ type });
    const scheme = getAmenityTypeColorScheme({ type, variant: 'contrast' });
    const labelKey = getAmenityTypeLabelKey(type);
    const label = labelKey ? t(labelKey) : type;

    return (
        <span
            className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-medium text-xs"
            style={{
                backgroundColor: scheme.bg,
                color: scheme.text,
                borderColor: scheme.border
            }}
        >
            <Icon
                size={14}
                weight="duotone"
                duotoneColor="currentColor"
                aria-hidden="true"
            />
            {label}
        </span>
    );
};
