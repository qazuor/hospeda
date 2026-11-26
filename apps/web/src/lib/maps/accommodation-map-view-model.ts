import { AccommodationTypeEnum } from '@repo/schemas';
import type { FilterGroup } from '@/components/shared/filters/FilterSidebar.client';
import type { CatalogEntry } from '@/lib/accommodation-listing-summary';
import {
    buildAccommodationListingSummary,
    DEFAULT_TYPE_GRAMMAR
} from '@/lib/accommodation-listing-summary';
import type { toAccommodationCardProps } from '@/lib/api/transforms';
import { getAccommodationTypeLabel, getBadgeStatusColor } from '@/lib/colors';
import type { AccommodationFilterCatalog } from '@/lib/filters/accommodation-filter-catalog';
import { formatPrice } from '@/lib/format-utils';
import type { SupportedLocale } from '@/lib/i18n';
import { createTranslations } from '@/lib/i18n';
import { resolveI18nText } from '@/lib/resolve-i18n-text';
import { buildUrl } from '@/lib/urls';

type SummaryQuery = Readonly<{
    types?: string;
    q?: string;
    minPrice?: number;
    maxPrice?: number;
    includeNoPrice?: boolean;
    destinationIds?: string;
    minGuests?: number;
    amenities?: string;
    features?: string;
    minRating?: number;
    includeNoReviews?: boolean;
    minBedrooms?: number;
    minBathrooms?: number;
    isFeatured?: boolean;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
}>;

/** Builds the filter controls and localized results summary for the accommodation map. */
export function buildAccommodationMapFilters({
    locale,
    destinations,
    amenities,
    features,
    query,
    shown,
    total
}: {
    readonly locale: SupportedLocale;
    readonly destinations: readonly { readonly id: string; readonly name: string }[];
    readonly amenities: AccommodationFilterCatalog['amenities'];
    readonly features: AccommodationFilterCatalog['features'];
    readonly query: SummaryQuery;
    readonly shown: number;
    readonly total: number;
}) {
    const {
        types,
        q,
        minPrice,
        maxPrice,
        includeNoPrice,
        destinationIds,
        minGuests,
        amenities: amenitiesParam,
        features: featuresParam,
        minRating,
        includeNoReviews,
        minBedrooms,
        minBathrooms,
        isFeatured,
        sortBy,
        sortOrder
    } = query;
    const { t } = createTranslations(locale);
    const { t: tEs } = createTranslations('es');
    const { t: tEn } = createTranslations('en');
    const { t: tPt } = createTranslations('pt');
    // Filter summary
    const destinationCatalog: readonly CatalogEntry[] = destinations.map((d) => ({
        key: d.id,
        label: {
            es: resolveI18nText(d.name, 'es'),
            en: resolveI18nText(d.name, 'en'),
            pt: resolveI18nText(d.name, 'pt')
        }
    }));
    // SPEC-266: `name` was dropped from the amenities/features catalog. `slug` is
    // now the canonical identifier and is also the i18n key segment.
    // slug is nullish per schema; coerce null→undefined to satisfy the t() signature.
    const amenityCatalog: readonly CatalogEntry[] = amenities.map((a) => ({
        key: a.id,
        label: {
            es: tEs(`accommodations.amenityNames.${a.slug ?? ''}`, a.slug ?? undefined),
            en: tEn(`accommodations.amenityNames.${a.slug ?? ''}`, a.slug ?? undefined),
            pt: tPt(`accommodations.amenityNames.${a.slug ?? ''}`, a.slug ?? undefined)
        }
    }));
    const featureCatalog: readonly CatalogEntry[] = features.map((f) => ({
        key: f.id,
        label: {
            es: tEs(`accommodations.featureNames.${f.slug ?? ''}`, f.slug ?? undefined),
            en: tEn(`accommodations.featureNames.${f.slug ?? ''}`, f.slug ?? undefined),
            pt: tPt(`accommodations.featureNames.${f.slug ?? ''}`, f.slug ?? undefined)
        }
    }));

    const typesArray = types?.split(',').filter(Boolean) ?? [];
    const filterSummary = buildAccommodationListingSummary({
        locale,
        filters: {
            types: typesArray.length > 0 ? typesArray : undefined,
            text: q,
            price:
                minPrice !== undefined || maxPrice !== undefined || includeNoPrice
                    ? { min: minPrice, max: maxPrice, includeWithoutPrice: includeNoPrice }
                    : undefined,
            destinations: destinationIds?.split(',').filter(Boolean),
            guests: minGuests,
            amenities: amenitiesParam?.split(',').filter(Boolean),
            services: featuresParam?.split(',').filter(Boolean),
            minRating,
            includeWithoutRating: includeNoReviews,
            bedrooms: minBedrooms,
            bathrooms: minBathrooms,
            featured: isFeatured ?? null
        },
        counts: {
            shown,
            globalTotal: total,
            subjectTotal: typesArray.length > 0 ? total : undefined
        },
        sort: sortBy ? { key: sortBy, direction: sortOrder ?? 'asc' } : undefined,
        catalogs: {
            types: DEFAULT_TYPE_GRAMMAR,
            destinations: destinationCatalog,
            amenities: amenityCatalog,
            services: featureCatalog
        }
    });

    // Filter sidebar config (same as list view)
    const filterGroups: FilterGroup[] = [
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
            id: 'isFeatured',
            label: t('accommodations.sidebar.featured', 'Solo destacados'),
            type: 'toggle'
        },
        {
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
                {
                    value: 'APART_HOTEL',
                    label: getAccommodationTypeLabel({ type: 'APART_HOTEL', t })
                },
                { value: 'ESTANCIA', label: getAccommodationTypeLabel({ type: 'ESTANCIA', t }) },
                {
                    value: 'BED_AND_BREAKFAST',
                    label: getAccommodationTypeLabel({ type: 'BED_AND_BREAKFAST', t })
                }
            ]
        },
        {
            id: 'destinationIds',
            label: t('accommodations.sidebar.destination', 'Destino'),
            type: 'select-search',
            options: destinations.map((d) => ({ value: d.id, label: d.name })),
            maxVisible: 8
        },
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
            maxVisible: 10
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
            id: 'adults',
            label: t('accommodations.sidebar.adults', 'Adultos'),
            type: 'stepper',
            min: 1,
            // Display default 1 (not 2), matching the shared buildAccommodationsFilterGroups
            // config — BETA-161: never imply an unsolicited "2 adults" party size.
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
            label: t('accommodations.sidebar.rating', 'Calificación'),
            type: 'stars',
            includeNullLabel: t(
                'accommodations.sidebar.includeNoReviews',
                'Incluir sin calificación'
            ),
            includeNullParam: 'includeNoReviews',
            defaultIncludeNull: true
        }
    ];

    const sortOptions = [
        { value: 'relevance', label: t('accommodations.sort.relevance', 'Relevancia') },
        { value: 'price_asc', label: t('accommodations.sort.priceAsc', 'Precio: menor a mayor') },
        { value: 'price_desc', label: t('accommodations.sort.priceDesc', 'Precio: mayor a menor') },
        { value: 'rating', label: t('accommodations.sort.rating', 'Mejor valorados') },
        { value: 'recent', label: t('accommodations.sort.recent', 'Más recientes') },
        // SPEC-098 T-052 — orders by total active bookmarks (descending) via the
        // `mostSaved` synthetic sort field on the public accommodation list endpoint.
        { value: 'mostSaved', label: t('ui.sort.most_bookmarked', 'Más guardados') }
    ];

    return { filterGroups, sortOptions, filterSummary };
}

/** Builds the serializable localized labels for sidebar cards and marker popups. */
export function buildAccommodationMapLabels({
    locale,
    cards
}: {
    readonly locale: SupportedLocale;
    readonly cards: ReadonlyArray<ReturnType<typeof toAccommodationCardProps>>;
}) {
    const { t, tPlural } = createTranslations(locale);
    // Build per-id maps for popup enrichment. Resolved on the page so the island
    // stays i18n-agnostic and we don't need to serialize functions.
    // Derived from the canonical enum so popup labels exist for every type,
    // including the SPEC-213 additions (apart_hotel, estancia, bed_and_breakfast)
    // and motel, which the previous hardcoded list omitted (Bug B10 fix).
    const typeLabels: Record<string, string> = {};
    for (const key of Object.values(AccommodationTypeEnum)) {
        typeLabels[key] = getAccommodationTypeLabel({ type: key, t });
    }
    const detailHrefById: Record<string, string> = {};
    const reviewsLabelById: Record<string, string> = {};
    const photosLabelById: Record<string, string> = {};
    const priceLabelById: Record<string, string> = {};
    for (const card of cards) {
        detailHrefById[card.id] = buildUrl({ locale, path: `alojamientos/${card.slug}` });
        if (card.reviewsCount > 0) {
            reviewsLabelById[card.id] =
                `(${tPlural('review.list.totalReviews', card.reviewsCount, { count: card.reviewsCount })})`;
        }
        if ((card.photoCount ?? 0) > 0) {
            photosLabelById[card.id] = tPlural('common.photos', card.photoCount ?? 0, {
                count: card.photoCount ?? 0
            });
        }
        if (card.price?.amount != null && card.price?.currency) {
            priceLabelById[card.id] = formatPrice({
                amount: card.price.amount,
                currency: card.price.currency,
                locale
            });
        }
    }

    // Sidebar cards (mobile bottom sheet / desktop pane) mirror AccommodationCard
    // visually. The page resolves all the locale-aware copy + status colors once
    // here so the island can stay i18n-agnostic.
    const newColors = getBadgeStatusColor({ status: 'new' });
    return {
        typeLabels,
        detailHrefById,
        reviewsLabelById,
        photosLabelById,
        priceLabelById,
        newColors
    };
}
