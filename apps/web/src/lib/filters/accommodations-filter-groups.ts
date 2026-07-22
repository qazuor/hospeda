/**
 * @file accommodations-filter-groups.ts
 * @description Shared `FilterGroup[]` config for the accommodations sidebar.
 * Used by both the main `/alojamientos/` listing and the per-type facet
 * landings (`/alojamientos/tipo/{type}/`, SPEC-306) so the two pages can
 * never drift apart on the available filters.
 */

import type { AmenityPublic, DestinationPublic, FeaturePublic } from '@repo/schemas';
import type { FilterGroup } from '@/components/shared/filters/FilterSidebar.client';
import { getAccommodationTypeLabel } from '@/lib/colors';
import type { TranslationFn } from '@/lib/i18n';

interface BuildAccommodationsFilterGroupsParams {
    /** Bound translation function for the active locale. */
    readonly t: TranslationFn;
    /** Destinations catalog (CITY type) used by the location + geo-radius groups. */
    readonly destinations: readonly DestinationPublic[];
    /** Amenities catalog used by the amenities icon-chips group. */
    readonly amenities: readonly AmenityPublic[];
    /** Features catalog used by the features icon-chips group. */
    readonly features: readonly FeaturePublic[];
    /**
     * When true, omits the `types` checkbox group (but keeps the rest of the
     * "Tipo y características" section — `isFeatured`, `amenities`,
     * `features` — since those are unrelated to the type facet). Used by the
     * per-type facet landings (`/alojamientos/tipo/{type}/`), where the type
     * is already fixed by the URL path rather than user-selectable.
     */
    readonly excludeType?: boolean;
}

/**
 * Builds the `filterGroups` config consumed by `FilterSidebar` on the
 * accommodations listing: search, location (destination + geo-radius), type
 * and characteristics (featured toggle, type checkbox, amenities, features),
 * dates, capacity, and price/quality.
 */
export function buildAccommodationsFilterGroups({
    t,
    destinations,
    amenities,
    features,
    excludeType = false
}: BuildAccommodationsFilterGroupsParams): FilterGroup[] {
    const typeGroup: FilterGroup = {
        id: 'types',
        label: t('accommodations.sidebar.type', 'Tipo de Alojamiento'),
        type: 'checkbox',
        options: [
            { value: 'APARTMENT', label: getAccommodationTypeLabel({ type: 'APARTMENT', t }) },
            { value: 'HOUSE', label: getAccommodationTypeLabel({ type: 'HOUSE', t }) },
            {
                value: 'COUNTRY_HOUSE',
                label: getAccommodationTypeLabel({ type: 'COUNTRY_HOUSE', t })
            },
            { value: 'CABIN', label: getAccommodationTypeLabel({ type: 'CABIN', t }) },
            { value: 'HOTEL', label: getAccommodationTypeLabel({ type: 'HOTEL', t }) },
            { value: 'HOSTEL', label: getAccommodationTypeLabel({ type: 'HOSTEL', t }) },
            { value: 'CAMPING', label: getAccommodationTypeLabel({ type: 'CAMPING', t }) },
            { value: 'ROOM', label: getAccommodationTypeLabel({ type: 'ROOM', t }) },
            { value: 'RESORT', label: getAccommodationTypeLabel({ type: 'RESORT', t }) },
            { value: 'APART_HOTEL', label: getAccommodationTypeLabel({ type: 'APART_HOTEL', t }) },
            { value: 'ESTANCIA', label: getAccommodationTypeLabel({ type: 'ESTANCIA', t }) },
            {
                value: 'BED_AND_BREAKFAST',
                label: getAccommodationTypeLabel({ type: 'BED_AND_BREAKFAST', t })
            }
        ]
    };

    return [
        // Free-text search lives at the very top, OUTSIDE any section, so it
        // reads as a global filter independent of the themed categories below.
        {
            id: 'q',
            label: t('accommodations.sidebar.search', 'Búsqueda por texto'),
            type: 'search',
            placeholder: t(
                'accommodations.sidebar.searchPlaceholder',
                'Buscar por nombre o descripción...'
            )
        },
        {
            id: 'section-location',
            type: 'section-header',
            label: t('accommodations.sidebar.section.location', 'Ubicación'),
            icon: 'MapIcon'
        },
        {
            id: 'destinationIds',
            label: t('accommodations.sidebar.destination', 'Destino'),
            type: 'select-search',
            options: destinations.map((d) => ({
                value: d.id,
                label: d.name,
                featured: Boolean(d.isFeatured)
            })),
            maxVisible: 8
        },
        {
            id: 'location',
            label: t('accommodations.sidebar.geoRadius', 'Cerca de'),
            type: 'geo-radius',
            // Build the anchor list from destinations that ship explicit lat/long
            // coordinates. Strings are parsed once here (the schema stores them
            // as strings) so the runtime payload is plain numbers.
            destinationOptions: destinations
                .map((d) => {
                    const coords = d.location?.coordinates;
                    const lat = coords ? Number.parseFloat(coords.lat) : Number.NaN;
                    const long = coords ? Number.parseFloat(coords.long) : Number.NaN;
                    if (!Number.isFinite(lat) || !Number.isFinite(long)) return null;
                    return {
                        value: d.id,
                        label: d.name,
                        lat,
                        long,
                        featured: Boolean(d.isFeatured)
                    };
                })
                .filter(
                    (
                        opt
                    ): opt is {
                        value: string;
                        label: string;
                        lat: number;
                        long: number;
                        featured: boolean;
                    } => opt !== null
                ),
            radiusPresets: [5, 10, 25, 50, 100],
            defaultCollapsed: true,
            destinationModeLabel: t(
                'accommodations.sidebar.geoRadius.destinationMode',
                'Un destino'
            ),
            browserModeLabel: t('accommodations.sidebar.geoRadius.browserMode', 'Mi ubicación'),
            destinationPlaceholder: t(
                'accommodations.sidebar.geoRadius.destinationPlaceholder',
                'Elegí un destino'
            ),
            browserCtaLabel: t('accommodations.sidebar.geoRadius.browserCta', 'Usar mi ubicación'),
            browserPendingLabel: t(
                'accommodations.sidebar.geoRadius.browserPending',
                'Detectando…'
            ),
            browserErrorLabel: t(
                'accommodations.sidebar.geoRadius.browserError',
                'No pudimos detectar tu ubicación. Revisá los permisos del navegador.'
            ),
            // HOS-142 G-6: third "near a landmark" mode, an autocomplete
            // against the public POI catalog (914 rows) rather than a
            // pre-fetched flat list — see `GeoRadiusFilter.tsx`.
            poiModeLabel: t('accommodations.sidebar.geoRadius.poiMode', 'Un lugar de interés'),
            poiPlaceholder: t(
                'accommodations.sidebar.geoRadius.poiPlaceholder',
                'Buscá una plaza, playa, monumento...'
            ),
            poiSearchingLabel: t('accommodations.sidebar.geoRadius.poiSearching', 'Buscando...'),
            poiNoResultsLabel: t(
                'accommodations.sidebar.geoRadius.poiNoResults',
                'No encontramos ningún lugar con ese nombre'
            ),
            radiusUnitLabel: t('accommodations.sidebar.geoRadius.radiusUnit', 'km')
        },
        {
            id: 'section-type',
            type: 'section-header',
            label: t('accommodations.sidebar.section.type', 'Tipo y características'),
            icon: 'AccommodationIcon'
        },
        {
            id: 'isFeatured',
            label: t('accommodations.sidebar.featured', 'Solo destacados'),
            type: 'toggle'
        },
        ...(excludeType ? [] : [typeGroup]),
        {
            id: 'amenities',
            label: t('accommodations.sidebar.amenities', 'Comodidades'),
            type: 'icon-chips',
            // SPEC-266: `name` dropped; use `slug` as the i18n key segment.
            options: amenities.map((a) => ({
                value: a.id,
                label: t(`accommodations.amenityNames.${a.slug ?? ''}`, a.slug ?? undefined),
                icon: a.icon ?? undefined
            })),
            maxVisible: 10,
            // Quick-filter shortcuts rendered ABOVE the regular amenity chips.
            // Each `value` is the URL boolean param name that the backend
            // resolves to canonical amenity IDs server-side (with slug
            // variants — e.g. `hasPool` matches both `pool` and `heated_pool`).
            priorityOptions: [
                {
                    value: 'hasWifi',
                    label: t('accommodations.quickAmenity.wifi', 'WiFi'),
                    icon: 'WifiIcon'
                },
                {
                    value: 'hasPool',
                    label: t('accommodations.quickAmenity.pool', 'Pileta'),
                    icon: 'PoolIcon'
                },
                {
                    value: 'hasParking',
                    label: t('accommodations.quickAmenity.parking', 'Estacionamiento'),
                    icon: 'CarIcon'
                },
                {
                    value: 'allowsPets',
                    label: t('accommodations.quickAmenity.pets', 'Acepta mascotas'),
                    icon: 'DogIcon'
                }
            ]
        },
        {
            id: 'features',
            label: t('accommodations.sidebar.features', 'Características'),
            type: 'icon-chips',
            // SPEC-266: `name` dropped; resolve label from i18n by slug.
            options: features.map((f) => ({
                value: f.id,
                label: t(`accommodations.featureNames.${f.slug ?? ''}`, f.slug ?? undefined),
                icon: f.icon ?? undefined
            })),
            maxVisible: 10
        },
        {
            id: 'section-dates',
            type: 'section-header',
            label: t('accommodations.sidebar.section.dates', 'Fechas'),
            icon: 'CalendarDotsIcon'
        },
        {
            id: 'dates',
            label: t('accommodations.sidebar.dates', 'Llegada y salida'),
            type: 'date-range',
            mode: 'bounds',
            checkInPlaceholder: t('accommodations.contextBar.checkIn', 'Llegada'),
            checkOutPlaceholder: t('accommodations.contextBar.checkOut', 'Salida'),
            description: t(
                'accommodations.sidebar.dates.helper',
                'Por ahora informativo: la disponibilidad en tiempo real está en desarrollo y todavía no afecta los resultados.'
            )
        },
        {
            id: 'section-capacity',
            type: 'section-header',
            label: t('accommodations.sidebar.section.capacity', 'Capacidad'),
            icon: 'UsersIcon'
        },
        {
            id: 'adults',
            label: t('accommodations.sidebar.adults', 'Adultos'),
            type: 'stepper',
            min: 1,
            max: 10,
            defaultValue: 1,
            emitWhenAtDefault: true
        },
        {
            id: 'children',
            label: t('accommodations.sidebar.children', 'Niños'),
            type: 'stepper',
            min: 0,
            max: 6,
            defaultValue: 0,
            emitWhenAtDefault: true,
            description: t('accommodations.sidebar.children.helper', '(menores de 5 años)')
        },
        {
            id: 'minBedrooms',
            label: t('accommodations.sidebar.bedrooms', 'Dormitorios'),
            type: 'stepper',
            min: 0,
            max: 10,
            defaultValue: 0
        },
        {
            id: 'minBathrooms',
            label: t('accommodations.sidebar.bathrooms', 'Baños'),
            type: 'stepper',
            min: 0,
            max: 10,
            defaultValue: 0
        },
        {
            id: 'section-price-quality',
            type: 'section-header',
            label: t('accommodations.sidebar.section.priceAndQuality', 'Precio y calidad'),
            icon: 'PriceIcon'
        },
        {
            id: 'price',
            label: t('accommodations.sidebar.priceRange', 'Precio por noche'),
            type: 'dual-range',
            min: 5000,
            max: 150000,
            step: 1000,
            format: 'currency',
            includeNullLabel: t('accommodations.sidebar.includeNoPrice', 'Incluir sin precio'),
            includeNullParam: 'includeNoPrice',
            defaultIncludeNull: true
        },
        {
            id: 'minRating',
            label: t('accommodations.sidebar.rating', 'Calificación mínima'),
            type: 'stars',
            includeNullLabel: t(
                'accommodations.sidebar.includeNoReviews',
                'Incluir sin calificación'
            ),
            includeNullParam: 'includeNoReviews',
            defaultIncludeNull: true
        }
    ];
}
