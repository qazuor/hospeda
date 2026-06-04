/**
 * SPEC-185 Phase 2 — filter config smoke tests.
 *
 * Verifies that each entity config touched in T-005 and T-006 declares the
 * expected filterBarConfig entries with the correct type and paramKey(s).
 *
 * These are pure data tests (no component rendering) so they run fast and do
 * not require jsdom or a mock router.
 */

import { describe, expect, it } from 'vitest';
import type {
    FilterBarConfig,
    FilterControlConfig
} from '../../src/components/entity-list/filters/filter-types';
import { accommodationsConfig } from '../../src/features/accommodations/config/accommodations.config';
import { amenitiesConfig } from '../../src/features/amenities/config/amenities.config';
import { attractionsConfig } from '../../src/features/attractions/config/attractions.config';
import { destinationsConfig } from '../../src/features/destinations/config/destinations.config';
import { eventLocationsConfig } from '../../src/features/event-locations/config/event-locations.config';
import { eventOrganizersConfig } from '../../src/features/event-organizers/config/event-organizers.config';
import { eventsConfig } from '../../src/features/events/config/events.config';
import { featuresConfig } from '../../src/features/features/config/features.config';
import { sponsorsConfig } from '../../src/features/sponsors/config/sponsors.config';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Returns the filter with the given paramKey from a filterBarConfig, or throws.
 */
function findFilter(
    config: { filterBarConfig?: FilterBarConfig },
    paramKey: string
): FilterControlConfig {
    const filters = config.filterBarConfig?.filters ?? [];
    const match = filters.find((f) => f.paramKey === paramKey);
    if (!match) throw new Error(`Filter with paramKey '${paramKey}' not found`);
    return match;
}

// ---------------------------------------------------------------------------
// T-005 — range filters on accommodations, events, destinations
// ---------------------------------------------------------------------------

describe('T-005 — range filters on existing configs', () => {
    describe('accommodations — price number-range', () => {
        it('has a filterBarConfig', () => {
            expect(accommodationsConfig.filterBarConfig).toBeDefined();
        });

        it('includes a number-range filter for price', () => {
            const filter = findFilter(accommodationsConfig, 'price');
            expect(filter.type).toBe('number-range');
        });

        it('price range uses paramKeyMin=minPrice and paramKeyMax=maxPrice', () => {
            const filter = findFilter(accommodationsConfig, 'price') as {
                paramKeyMin: string;
                paramKeyMax: string;
            };
            expect(filter.paramKeyMin).toBe('minPrice');
            expect(filter.paramKeyMax).toBe('maxPrice');
        });

        it('price range declares unitLabelKey for centavo display', () => {
            const filter = findFilter(accommodationsConfig, 'price') as {
                unitLabelKey?: string;
            };
            expect(filter.unitLabelKey).toBe('admin-filters.unit.ars');
        });
    });

    describe('accommodations — createdAt date-range', () => {
        it('includes a date-range filter for createdAt', () => {
            const filter = findFilter(accommodationsConfig, 'createdAt');
            expect(filter.type).toBe('date-range');
        });

        it('createdAt range uses paramKeyFrom=createdAfter and paramKeyTo=createdBefore', () => {
            const filter = findFilter(accommodationsConfig, 'createdAt') as {
                paramKeyFrom: string;
                paramKeyTo: string;
            };
            expect(filter.paramKeyFrom).toBe('createdAfter');
            expect(filter.paramKeyTo).toBe('createdBefore');
        });
    });

    describe('events — startDate date-range', () => {
        it('has a filterBarConfig', () => {
            expect(eventsConfig.filterBarConfig).toBeDefined();
        });

        it('includes a date-range filter for startDate', () => {
            const filter = findFilter(eventsConfig, 'startDate');
            expect(filter.type).toBe('date-range');
        });

        it('startDate range uses paramKeyFrom=startDateAfter and paramKeyTo=startDateBefore', () => {
            const filter = findFilter(eventsConfig, 'startDate') as {
                paramKeyFrom: string;
                paramKeyTo: string;
            };
            expect(filter.paramKeyFrom).toBe('startDateAfter');
            expect(filter.paramKeyTo).toBe('startDateBefore');
        });
    });

    describe('events — endDate date-range', () => {
        it('includes a date-range filter for endDate', () => {
            const filter = findFilter(eventsConfig, 'endDate');
            expect(filter.type).toBe('date-range');
        });

        it('endDate range uses paramKeyFrom=endDateAfter and paramKeyTo=endDateBefore', () => {
            const filter = findFilter(eventsConfig, 'endDate') as {
                paramKeyFrom: string;
                paramKeyTo: string;
            };
            expect(filter.paramKeyFrom).toBe('endDateAfter');
            expect(filter.paramKeyTo).toBe('endDateBefore');
        });
    });

    describe('events — createdAt date-range', () => {
        it('includes a date-range filter for createdAt', () => {
            const filter = findFilter(eventsConfig, 'createdAt');
            expect(filter.type).toBe('date-range');
        });

        it('createdAt range uses paramKeyFrom=createdAfter and paramKeyTo=createdBefore', () => {
            const filter = findFilter(eventsConfig, 'createdAt') as {
                paramKeyFrom: string;
                paramKeyTo: string;
            };
            expect(filter.paramKeyFrom).toBe('createdAfter');
            expect(filter.paramKeyTo).toBe('createdBefore');
        });
    });

    describe('destinations — createdAt date-range', () => {
        it('has a filterBarConfig', () => {
            expect(destinationsConfig.filterBarConfig).toBeDefined();
        });

        it('includes a date-range filter for createdAt', () => {
            const filter = findFilter(destinationsConfig, 'createdAt');
            expect(filter.type).toBe('date-range');
        });

        it('createdAt range uses paramKeyFrom=createdAfter and paramKeyTo=createdBefore', () => {
            const filter = findFilter(destinationsConfig, 'createdAt') as {
                paramKeyFrom: string;
                paramKeyTo: string;
            };
            expect(filter.paramKeyFrom).toBe('createdAfter');
            expect(filter.paramKeyTo).toBe('createdBefore');
        });
    });
});

// ---------------------------------------------------------------------------
// T-006 — filter bars on previously-unfiltered lists
// ---------------------------------------------------------------------------

describe('T-006 — filter bars on previously-unfiltered entity lists', () => {
    describe('sponsors', () => {
        it('now has a filterBarConfig', () => {
            expect(sponsorsConfig.filterBarConfig).toBeDefined();
            expect(sponsorsConfig.filterBarConfig?.filters.length).toBeGreaterThan(0);
        });

        it('includes a select filter for type (ClientTypeEnum)', () => {
            const filter = findFilter(sponsorsConfig, 'type');
            expect(filter.type).toBe('select');
        });

        it('type select includes POST_SPONSOR, ADVERTISER and HOST options', () => {
            const filter = findFilter(sponsorsConfig, 'type') as {
                options: ReadonlyArray<{ value: string }>;
            };
            const values = filter.options.map((o) => o.value);
            expect(values).toContain('POST_SPONSOR');
            expect(values).toContain('ADVERTISER');
            expect(values).toContain('HOST');
        });

        it('includes a boolean filter for includeDeleted', () => {
            const filter = findFilter(sponsorsConfig, 'includeDeleted');
            expect(filter.type).toBe('boolean');
        });
    });

    describe('amenities', () => {
        it('now has a filterBarConfig', () => {
            expect(amenitiesConfig.filterBarConfig).toBeDefined();
            expect(amenitiesConfig.filterBarConfig?.filters.length).toBeGreaterThan(0);
        });

        it('includes a select filter for type (AmenitiesTypeEnum)', () => {
            const filter = findFilter(amenitiesConfig, 'type');
            expect(filter.type).toBe('select');
        });

        it('type select covers all 12 AmenitiesTypeEnum values', () => {
            const filter = findFilter(amenitiesConfig, 'type') as {
                options: ReadonlyArray<{ value: string }>;
            };
            const values = filter.options.map((o) => o.value);
            expect(values).toContain('CLIMATE_CONTROL');
            expect(values).toContain('CONNECTIVITY');
            expect(values).toContain('ENTERTAINMENT');
            expect(values).toContain('KITCHEN');
            expect(values).toContain('BED_AND_BATH');
            expect(values).toContain('OUTDOORS');
            expect(values).toContain('ACCESSIBILITY');
            expect(values).toContain('SERVICES');
            expect(values).toContain('SAFETY');
            expect(values).toContain('FAMILY_FRIENDLY');
            expect(values).toContain('WORK_FRIENDLY');
            expect(values).toContain('GENERAL_APPLIANCES');
        });

        it('includes a boolean filter for isBuiltin', () => {
            const filter = findFilter(amenitiesConfig, 'isBuiltin');
            expect(filter.type).toBe('boolean');
        });

        it('includes a boolean filter for includeDeleted', () => {
            const filter = findFilter(amenitiesConfig, 'includeDeleted');
            expect(filter.type).toBe('boolean');
        });
    });

    describe('attractions', () => {
        it('now has a filterBarConfig', () => {
            expect(attractionsConfig.filterBarConfig).toBeDefined();
            expect(attractionsConfig.filterBarConfig?.filters.length).toBeGreaterThan(0);
        });

        it('includes a boolean filter for isFeatured', () => {
            const filter = findFilter(attractionsConfig, 'isFeatured');
            expect(filter.type).toBe('boolean');
        });

        it('includes a boolean filter for includeDeleted', () => {
            const filter = findFilter(attractionsConfig, 'includeDeleted');
            expect(filter.type).toBe('boolean');
        });
    });

    describe('event-locations', () => {
        it('now has a filterBarConfig', () => {
            expect(eventLocationsConfig.filterBarConfig).toBeDefined();
            expect(eventLocationsConfig.filterBarConfig?.filters.length).toBeGreaterThan(0);
        });

        it('includes a boolean filter for includeDeleted', () => {
            const filter = findFilter(eventLocationsConfig, 'includeDeleted');
            expect(filter.type).toBe('boolean');
        });

        it('does NOT include a city filter (column does not exist on the table)', () => {
            const filters = eventLocationsConfig.filterBarConfig?.filters ?? [];
            const cityFilter = filters.find((f) => f.paramKey === 'city');
            expect(cityFilter).toBeUndefined();
        });
    });

    describe('event-organizers', () => {
        it('now has a filterBarConfig', () => {
            expect(eventOrganizersConfig.filterBarConfig).toBeDefined();
            expect(eventOrganizersConfig.filterBarConfig?.filters.length).toBeGreaterThan(0);
        });

        it('includes a boolean filter for includeDeleted', () => {
            const filter = findFilter(eventOrganizersConfig, 'includeDeleted');
            expect(filter.type).toBe('boolean');
        });
    });

    describe('features', () => {
        it('now has a filterBarConfig', () => {
            expect(featuresConfig.filterBarConfig).toBeDefined();
            expect(featuresConfig.filterBarConfig?.filters.length).toBeGreaterThan(0);
        });

        it('includes a boolean filter for isBuiltin', () => {
            const filter = findFilter(featuresConfig, 'isBuiltin');
            expect(filter.type).toBe('boolean');
        });

        it('includes a boolean filter for includeDeleted', () => {
            const filter = findFilter(featuresConfig, 'includeDeleted');
            expect(filter.type).toBe('boolean');
        });
    });
});

// ---------------------------------------------------------------------------
// Ghost filters — verify these are NOT added to the configs (safety assertion)
// ---------------------------------------------------------------------------

describe('ghost filters — verified absent per spec §T-006', () => {
    it('event-locations has no city filter (column does not exist)', () => {
        const filters = eventLocationsConfig.filterBarConfig?.filters ?? [];
        expect(filters.find((f) => f.paramKey === 'city')).toBeUndefined();
    });

    it('sponsors has no isFeatured filter (column does not exist)', () => {
        const filters = sponsorsConfig.filterBarConfig?.filters ?? [];
        expect(filters.find((f) => f.paramKey === 'isFeatured')).toBeUndefined();
    });

    it('attractions has no category filter (column does not exist)', () => {
        const filters = attractionsConfig.filterBarConfig?.filters ?? [];
        expect(filters.find((f) => f.paramKey === 'category')).toBeUndefined();
    });

    it('features has no category filter (column does not exist)', () => {
        const filters = featuresConfig.filterBarConfig?.filters ?? [];
        expect(filters.find((f) => f.paramKey === 'category')).toBeUndefined();
    });

    it('accommodations has no ratingMin/ratingMax filter (not in schema)', () => {
        const filters = accommodationsConfig.filterBarConfig?.filters ?? [];
        expect(filters.find((f) => f.paramKey === 'ratingMin')).toBeUndefined();
        expect(filters.find((f) => f.paramKey === 'ratingMax')).toBeUndefined();
    });
});
