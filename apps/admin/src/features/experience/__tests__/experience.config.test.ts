// @vitest-environment jsdom
/**
 * @file experience.config.test.ts
 * Unit tests for the experience entity list config (SPEC-240 T-031).
 *
 * Covers:
 *  - experienceListConfig has correct apiEndpoint, basePath, entityKey
 *  - createExperienceColumns factory is wired in
 *  - extraFilters include a type filter
 *  - ExperiencesRoute is a valid route object
 *  - ExperiencesPageComponent is a function
 *  - EXPERIENCE_VIEW_PERMISSION is the COMMERCE_VIEW_ALL permission
 */

import { PermissionEnum } from '@repo/schemas';
import { describe, expect, it } from 'vitest';
import {
    EXPERIENCE_VIEW_PERMISSION,
    ExperiencesPageComponent,
    ExperiencesRoute,
    experienceListConfig
} from '../config/experience.config';

describe('experienceListConfig', () => {
    it('should point to the correct admin API endpoint', () => {
        expect(experienceListConfig.apiEndpoint).toBe('/api/v1/admin/experiences');
    });

    it('should have basePath /experiences', () => {
        expect(experienceListConfig.basePath).toBe('/experiences');
    });

    it('should have entityKey experience', () => {
        expect(experienceListConfig.entityKey).toBe('experience');
    });

    it('should have a createColumns function', () => {
        expect(typeof experienceListConfig.createColumns).toBe('function');
    });

    it('should have a type filter in filterBarConfig.filters', () => {
        // extraFilters are merged into filterBarConfig.filters by createCommerceListConfig
        const filters = experienceListConfig.filterBarConfig?.filters ?? [];
        const typeFilter = filters.find((f) => f.paramKey === 'type');
        expect(typeFilter).toBeDefined();
        // Narrow to SelectFilterConfig to access .options (discriminated union)
        const opts = typeFilter?.type === 'select' ? typeFilter.options : [];
        expect(opts.length).toBeGreaterThan(0);
    });

    it('should have shared commerce filters (destinationId, ownerId, isFeatured, includeDeleted)', () => {
        const filters = experienceListConfig.filterBarConfig?.filters ?? [];
        const paramKeys = filters.map((f) => f.paramKey);
        expect(paramKeys).toContain('destinationId');
        expect(paramKeys).toContain('ownerId');
        expect(paramKeys).toContain('isFeatured');
        expect(paramKeys).toContain('includeDeleted');
    });

    it('should have pagination with defaultPageSize 20', () => {
        expect(experienceListConfig.paginationConfig?.defaultPageSize).toBe(20);
    });
});

describe('ExperiencesRoute', () => {
    it('should be defined', () => {
        expect(ExperiencesRoute).toBeDefined();
    });

    it('should be truthy', () => {
        expect(ExperiencesRoute).toBeTruthy();
    });
});

describe('ExperiencesPageComponent', () => {
    it('should be a function (React component)', () => {
        expect(typeof ExperiencesPageComponent).toBe('function');
    });
});

describe('EXPERIENCE_VIEW_PERMISSION', () => {
    it('should be COMMERCE_VIEW_ALL', () => {
        expect(EXPERIENCE_VIEW_PERMISSION).toBe(PermissionEnum.COMMERCE_VIEW_ALL);
    });
});
