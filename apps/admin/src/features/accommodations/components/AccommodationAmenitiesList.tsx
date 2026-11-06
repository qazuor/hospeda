import { defaultLocale, type TranslationKey, trans } from '@repo/i18n';
import { getAmenityTypeIcon } from '@repo/icons';
import { Badge } from '@/components/ui/badge';
import { useTranslations } from '@/hooks/use-translations';

/**
 * Amenity row as returned inside `amenities` by
 * `GET /api/v1/admin/accommodations/:id` (catalog row plus the HOS-2058
 * relation attributes). `null`/absent attribute means "not declared".
 */
export interface AccommodationAmenityRow {
    readonly id: string;
    readonly slug?: string | null;
    readonly type?: string | null;
    readonly scope?: 'private' | 'shared' | null;
    readonly availability?: 'year_round' | 'seasonal' | null;
}

/** Props for {@link AccommodationAmenitiesList}. */
export interface AccommodationAmenitiesListProps {
    readonly amenities: readonly AccommodationAmenityRow[];
}

/** Maps each amenity type to its i18n label key (same keys as `AmenityTypeBadge`). */
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
    PARKING: 'admin-entities.types.amenity.parking',
    LAUNDRY: 'admin-entities.types.amenity.laundry',
    WATER_ACTIVITIES: 'admin-entities.types.amenity.waterActivities',
    WELLNESS: 'admin-entities.types.amenity.wellness',
    DINING: 'admin-entities.types.amenity.dining',
    GENERAL_APPLIANCES: 'admin-entities.types.amenity.generalAppliances'
};

const SCOPE_KEYS = {
    private: 'accommodations.amenityAttributes.scope.private',
    shared: 'accommodations.amenityAttributes.scope.shared'
} as const satisfies Record<string, TranslationKey>;

const AVAILABILITY_KEYS = {
    year_round: 'accommodations.amenityAttributes.availability.yearRound',
    seasonal: 'accommodations.amenityAttributes.availability.seasonal'
} as const satisfies Record<string, TranslationKey>;

const UNTYPED_GROUP = 'OTHER';

/** Resolves the amenity label from `accommodations.amenityNames.<slug>`; falls back to the slug. */
function resolveAmenityLabel({ amenity }: { readonly amenity: AccommodationAmenityRow }): string {
    const slug = amenity.slug;
    if (!slug) return amenity.id;
    const translated =
        trans[defaultLocale as keyof typeof trans]?.[`accommodations.amenityNames.${slug}`];
    if (translated && !translated.startsWith('[MISSING:')) return translated;
    return slug;
}

/**
 * Amenities of one accommodation, grouped by amenity type. Shows a badge for
 * each declared relation attribute (scope, availability); undeclared shows nothing.
 */
export const AccommodationAmenitiesList = ({ amenities }: AccommodationAmenitiesListProps) => {
    const { t } = useTranslations();

    const groups = new Map<string, AccommodationAmenityRow[]>();
    for (const amenity of amenities) {
        const type = amenity.type ? amenity.type.toUpperCase() : UNTYPED_GROUP;
        const bucket = groups.get(type);
        if (bucket) bucket.push(amenity);
        else groups.set(type, [amenity]);
    }

    return (
        <div className="space-y-6">
            {[...groups.entries()].map(([type, rows]) => {
                const labelKey = TYPE_LABEL_KEYS[type];
                const Icon = type === UNTYPED_GROUP ? null : getAmenityTypeIcon({ type });
                return (
                    <section
                        key={type}
                        data-testid={`amenity-group-${type}`}
                    >
                        <h3 className="mb-2 flex items-center gap-2 font-medium text-sm">
                            {Icon && (
                                <Icon
                                    size={16}
                                    weight="duotone"
                                    aria-hidden="true"
                                />
                            )}
                            {labelKey ? t(labelKey) : type}
                        </h3>
                        <ul className="grid grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-3">
                            {rows.map((amenity) => (
                                <li
                                    key={amenity.id}
                                    className="flex flex-wrap items-center gap-2 rounded-md border px-3 py-2 text-sm"
                                >
                                    <span>{resolveAmenityLabel({ amenity })}</span>
                                    {amenity.scope && SCOPE_KEYS[amenity.scope] && (
                                        <Badge variant="secondary">
                                            {t(SCOPE_KEYS[amenity.scope])}
                                        </Badge>
                                    )}
                                    {amenity.availability &&
                                        AVAILABILITY_KEYS[amenity.availability] && (
                                            <Badge variant="outline">
                                                {t(AVAILABILITY_KEYS[amenity.availability])}
                                            </Badge>
                                        )}
                                </li>
                            ))}
                        </ul>
                    </section>
                );
            })}
        </div>
    );
};
