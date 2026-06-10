import { useTranslations } from '@/hooks/use-translations';
import type { TranslationKey } from '@repo/i18n';
import { getAmenityTypeColorScheme, getAmenityTypeIcon } from '@repo/icons';
import type { Amenity } from '../schemas/amenities.schemas';

/**
 * Maps each uppercase `AmenitiesTypeEnum` value to its i18n label key.
 */
const TYPE_LABEL_KEYS: Readonly<Record<string, TranslationKey>> = {
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
    GENERAL_APPLIANCES: 'admin-entities.types.amenity.generalAppliances'
};

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
    const labelKey = TYPE_LABEL_KEYS[type.toUpperCase()];
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
