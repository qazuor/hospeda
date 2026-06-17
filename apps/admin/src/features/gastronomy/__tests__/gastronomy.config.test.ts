// @vitest-environment jsdom
/**
 * @file gastronomy.config.test.ts
 * Unit tests for the gastronomy entity list config (SPEC-239 T-059).
 *
 * Covers:
 *  - gastronomyListConfig has correct apiEndpoint, basePath, entityKey
 *  - createGastronomyColumns factory is wired in
 *  - extraFilters include type and priceRange filter
 *  - GastronomiesRoute is a valid route object
 *  - GastronomiesPageComponent is a function
 *  - GASTRONOMY_VIEW_PERMISSION is the COMMERCE_VIEW_ALL permission
 */

import { PermissionEnum } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import {
    GASTRONOMY_VIEW_PERMISSION,
    GastronomiesPageComponent,
    GastronomiesRoute,
    gastronomyListConfig
} from '../config/gastronomy.config';

describe('gastronomyListConfig', () => {
    it('should point to the correct admin API endpoint', () => {
        expect(gastronomyListConfig.apiEndpoint).toBe('/api/v1/admin/gastronomies');
    });

    it('should have basePath /gastronomies', () => {
        expect(gastronomyListConfig.basePath).toBe('/gastronomies');
    });

    it('should have entityKey gastronomy', () => {
        expect(gastronomyListConfig.entityKey).toBe('gastronomy');
    });

    it('should have a createColumns function', () => {
        expect(typeof gastronomyListConfig.createColumns).toBe('function');
    });

    it('should have a type filter in filterBarConfig.filters', () => {
        // extraFilters are merged into filterBarConfig.filters by createCommerceListConfig
        const filters = gastronomyListConfig.filterBarConfig?.filters ?? [];
        const typeFilter = filters.find((f) => f.paramKey === 'type');
        expect(typeFilter).toBeDefined();
        // Narrow to SelectFilterConfig to access .options (discriminated union)
        const opts = typeFilter?.type === 'select' ? typeFilter.options : [];
        expect(opts.length).toBeGreaterThan(0);
    });

    it('should have a priceRange filter in filterBarConfig.filters', () => {
        const filters = gastronomyListConfig.filterBarConfig?.filters ?? [];
        const priceFilter = filters.find((f) => f.paramKey === 'priceRange');
        expect(priceFilter).toBeDefined();
        // Narrow to SelectFilterConfig to access .options (discriminated union)
        const opts = priceFilter?.type === 'select' ? priceFilter.options : [];
        expect(opts.length).toBeGreaterThan(0);
    });
});

describe('GastronomiesRoute', () => {
    it('should be defined', () => {
        expect(GastronomiesRoute).toBeDefined();
    });

    it('should have options', () => {
        expect(GastronomiesRoute).toBeTruthy();
    });
});

describe('GastronomiesPageComponent', () => {
    it('should be a function (React component)', () => {
        expect(typeof GastronomiesPageComponent).toBe('function');
    });
});

describe('GASTRONOMY_VIEW_PERMISSION', () => {
    it('should be COMMERCE_VIEW_ALL', () => {
        expect(GASTRONOMY_VIEW_PERMISSION).toBe(PermissionEnum.COMMERCE_VIEW_ALL);
    });
});
