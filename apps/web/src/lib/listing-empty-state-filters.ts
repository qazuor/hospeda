/**
 * @file listing-empty-state-filters.ts
 * @description Pure helpers deciding whether a listing's zero-result state is
 * due to active filters or to a genuinely empty catalog.
 */

const hasNonEmptyText = (value: string | undefined): boolean =>
    typeof value === 'string' && value.trim().length > 0;

const hasNonEmptyCsv = (value: string | undefined): boolean =>
    (value?.split(',') ?? []).some((part) => part.trim().length > 0);

const hasFiniteNumber = (value: number | undefined): boolean =>
    typeof value === 'number' && Number.isFinite(value);

/** Parsed gastronomy filters relevant to the listing empty-state copy. */
export interface GastronomyListingEmptyStateFilters {
    readonly q: string | undefined;
    readonly destinationId: string | undefined;
    readonly type: string | undefined;
    readonly priceRange: string | undefined;
    readonly isFeatured: boolean | undefined;
    readonly minRating: number | undefined;
}

/** Parsed experience filters relevant to the listing empty-state copy. */
export interface ExperienceListingEmptyStateFilters {
    readonly q: string | undefined;
    readonly destinationId: string | undefined;
    readonly type: string | undefined;
    readonly isFeatured: boolean | undefined;
    readonly minRating: number | undefined;
}

/** Parsed accommodation filters relevant to the listing empty-state copy. */
export interface AccommodationListingEmptyStateFilters {
    readonly q: string | undefined;
    readonly types: ReadonlyArray<string>;
    readonly destinationIds: string | undefined;
    readonly minPrice: number | undefined;
    readonly maxPrice: number | undefined;
    readonly hasWifi: boolean | undefined;
    readonly hasPool: boolean | undefined;
    readonly hasParking: boolean | undefined;
    readonly allowsPets: boolean | undefined;
    readonly isFeatured: boolean | undefined;
    readonly minBedrooms: number | undefined;
    readonly minBathrooms: number | undefined;
    readonly minRating: number | undefined;
    readonly amenitiesParam: string | undefined;
    readonly featuresParam: string | undefined;
    readonly includeNoPrice: boolean | undefined;
    readonly includeNoReviews: boolean | undefined;
    readonly hasGeoRadius: boolean;
    readonly hasAvailabilityFilter: boolean;
    readonly adults: number | undefined;
    readonly childrenCount: number | undefined;
}

/**
 * Whether a zero-result gastronomy listing is empty because the visitor applied
 * one or more real result-narrowing filters.
 */
export function hasActiveGastronomyListingFilters({
    q,
    destinationId,
    type,
    priceRange,
    isFeatured,
    minRating
}: GastronomyListingEmptyStateFilters): boolean {
    return Boolean(
        hasNonEmptyText(q) ||
            hasNonEmptyText(destinationId) ||
            hasNonEmptyText(type) ||
            hasNonEmptyText(priceRange) ||
            isFeatured === true ||
            hasFiniteNumber(minRating)
    );
}

/**
 * Whether a zero-result experiences listing is empty because the visitor
 * applied one or more real result-narrowing filters.
 */
export function hasActiveExperienceListingFilters({
    q,
    destinationId,
    type,
    isFeatured,
    minRating
}: ExperienceListingEmptyStateFilters): boolean {
    return Boolean(
        hasNonEmptyText(q) ||
            hasNonEmptyText(destinationId) ||
            hasNonEmptyText(type) ||
            isFeatured === true ||
            hasFiniteNumber(minRating)
    );
}

/**
 * Whether a zero-result accommodations listing is empty because the visitor
 * applied one or more real result-narrowing filters.
 */
export function hasActiveAccommodationEmptyStateFilters({
    q,
    types,
    destinationIds,
    minPrice,
    maxPrice,
    hasWifi,
    hasPool,
    hasParking,
    allowsPets,
    isFeatured,
    minBedrooms,
    minBathrooms,
    minRating,
    amenitiesParam,
    featuresParam,
    includeNoPrice,
    includeNoReviews,
    hasGeoRadius,
    hasAvailabilityFilter,
    adults,
    childrenCount
}: AccommodationListingEmptyStateFilters): boolean {
    return Boolean(
        hasNonEmptyText(q) ||
            types.some((type) => type.trim().length > 0) ||
            hasNonEmptyCsv(destinationIds) ||
            hasFiniteNumber(minPrice) ||
            hasFiniteNumber(maxPrice) ||
            hasWifi === true ||
            hasPool === true ||
            hasParking === true ||
            allowsPets === true ||
            isFeatured === true ||
            hasFiniteNumber(minBedrooms) ||
            hasFiniteNumber(minBathrooms) ||
            hasFiniteNumber(minRating) ||
            hasNonEmptyCsv(amenitiesParam) ||
            hasNonEmptyCsv(featuresParam) ||
            typeof includeNoPrice === 'boolean' ||
            typeof includeNoReviews === 'boolean' ||
            hasGeoRadius ||
            hasAvailabilityFilter ||
            hasFiniteNumber(adults) ||
            (hasFiniteNumber(childrenCount) && (childrenCount ?? 0) > 0)
    );
}

/**
 * Normalizes the destination attraction filter so SSR and the inline client
 * script treat stale / invalid ids the same way.
 */
export function normalizeActiveDestinationAttractionIds({
    rawValue,
    validIds
}: {
    readonly rawValue: string;
    readonly validIds: ReadonlyArray<string>;
}): string[] {
    const validIdSet = new Set(validIds);
    const deduped: string[] = [];
    const seen = new Set<string>();

    for (const chunk of rawValue.split(',')) {
        const id = chunk.trim();
        if (id.length === 0 || !validIdSet.has(id) || seen.has(id)) continue;
        seen.add(id);
        deduped.push(id);
    }

    return deduped;
}
