import type { TranslationKey } from '@repo/i18n';
import { getAmenityTypeIcon } from '@repo/icons';
import { translateAmenityName } from '@/components/entity-form/fields/entity-selects/utils/amenity-api.utils';
import { Badge } from '@/components/ui/badge';
import { useTranslations } from '@/hooks/use-translations';
import { getAmenityTypeLabelKey } from '../../amenities/components/AmenityTypeBadge';

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

const SCOPE_KEYS = {
    private: 'accommodations.amenityAttributes.scope.private',
    shared: 'accommodations.amenityAttributes.scope.shared'
} as const satisfies Record<string, TranslationKey>;

const AVAILABILITY_KEYS = {
    year_round: 'accommodations.amenityAttributes.availability.yearRound',
    seasonal: 'accommodations.amenityAttributes.availability.seasonal'
} as const satisfies Record<string, TranslationKey>;

const UNTYPED_GROUP = 'OTHER';

/** Name shown for an amenity: translated, else a humanized slug (never the id). */
function resolveAmenityLabel({ amenity }: { readonly amenity: AccommodationAmenityRow }): string {
    return translateAmenityName(amenity.slug ?? amenity.id);
}

/**
 * Pure selector for the amenities of an accommodation detail payload.
 * Reads ONLY the `amenities` relation; the legacy `tags.amenities` is ignored
 * (HOS-2058: reading it made the tab claim "no amenities" for a full listing).
 *
 * @param accommodation - The raw accommodation detail (may be undefined while loading).
 * @returns The amenity rows, or an empty array.
 */
export function selectAccommodationAmenities(
    accommodation: unknown
): readonly AccommodationAmenityRow[] {
    const raw = (accommodation as { amenities?: unknown } | null | undefined)?.amenities;
    return Array.isArray(raw) ? (raw as AccommodationAmenityRow[]) : [];
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

    const sortedGroups = [...groups.entries()]
        .map(([type, rows]) => {
            const labelKey = getAmenityTypeLabelKey(type);
            return {
                type,
                label: labelKey ? t(labelKey) : type,
                rows: rows
                    .map((amenity) => ({ amenity, name: resolveAmenityLabel({ amenity }) }))
                    .sort((x, y) => x.name.localeCompare(y.name))
            };
        })
        .sort((x, y) => x.label.localeCompare(y.label));

    return (
        <div className="space-y-6">
            {sortedGroups.map(({ type, label, rows }) => {
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
                            {label}
                        </h3>
                        <ul className="grid grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-3">
                            {rows.map(({ amenity, name }) => (
                                <li
                                    key={amenity.id}
                                    className="flex flex-wrap items-center gap-2 rounded-md border px-3 py-2 text-sm"
                                >
                                    <span>{name}</span>
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
