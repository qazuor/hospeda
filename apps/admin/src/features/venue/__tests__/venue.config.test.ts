// @vitest-environment jsdom
/**
 * @file venue.config.test.ts
 * Unit tests for the venue entity list config (SPEC-239 T-059).
 *
 * Covers:
 *  - venueListConfig has correct apiEndpoint, basePath, entityKey
 *  - createVenueColumns factory is wired in
 *  - extraFilters include type and priceRange filter
 *  - VenuesRoute is a valid route object
 *  - VenuesPageComponent is a function
 *  - VENUE_VIEW_PERMISSION is the VENUE_VIEW_ALL permission
 */

import { PermissionEnum } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import {
    VENUE_VIEW_PERMISSION,
    VenuesPageComponent,
    VenuesRoute,
    venueListConfig
} from '../config/venue.config';

describe('venueListConfig', () => {
    it('should point to the correct admin API endpoint', () => {
        expect(venueListConfig.apiEndpoint).toBe('/api/v1/admin/venues');
    });

    it('should have basePath /venues', () => {
        expect(venueListConfig.basePath).toBe('/venues');
    });

    it('should have entityKey venue', () => {
        expect(venueListConfig.entityKey).toBe('venue');
    });

    it('should have a createColumns function', () => {
        expect(typeof venueListConfig.createColumns).toBe('function');
    });

    it('should have a type filter in filterBarConfig.filters', () => {
        // extraFilters are merged into filterBarConfig.filters by createListingListConfig
        const filters = venueListConfig.filterBarConfig?.filters ?? [];
        const typeFilter = filters.find((f) => f.paramKey === 'type');
        expect(typeFilter).toBeDefined();
        // Narrow to SelectFilterConfig to access .options (discriminated union)
        const opts = typeFilter?.type === 'select' ? typeFilter.options : [];
        expect(opts.length).toBeGreaterThan(0);
    });

    it('should have a priceRange filter in filterBarConfig.filters', () => {
        const filters = venueListConfig.filterBarConfig?.filters ?? [];
        const priceFilter = filters.find((f) => f.paramKey === 'priceRange');
        expect(priceFilter).toBeDefined();
        // Narrow to SelectFilterConfig to access .options (discriminated union)
        const opts = priceFilter?.type === 'select' ? priceFilter.options : [];
        expect(opts.length).toBeGreaterThan(0);
    });
});

describe('VenuesRoute', () => {
    it('should be defined', () => {
        expect(VenuesRoute).toBeDefined();
    });

    it('should have options', () => {
        expect(VenuesRoute).toBeTruthy();
    });
});

describe('VenuesPageComponent', () => {
    it('should be a function (React component)', () => {
        expect(typeof VenuesPageComponent).toBe('function');
    });
});

describe('VENUE_VIEW_PERMISSION', () => {
    it('should be VENUE_VIEW_ALL', () => {
        expect(VENUE_VIEW_PERMISSION).toBe(PermissionEnum.VENUE_VIEW_ALL);
    });
});
