/**
 * Tests for DestinationFilters client component.
 * Verifies component structure, props, filter options, and accessibility.
 *
 * The implementation is split across two files:
 * - DestinationFilters.client.tsx  - orchestrator with state and API logic
 * - DestinationFilterPanel.client.tsx - filter form UI sub-component
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const componentPath = resolve(
    __dirname,
    '../../../src/components/destination/DestinationFilters.client.tsx'
);
const content = readFileSync(componentPath, 'utf8');

const panelPath = resolve(
    __dirname,
    '../../../src/components/destination/DestinationFilterPanel.client.tsx'
);
const panelContent = readFileSync(panelPath, 'utf8');

const cardPath = resolve(
    __dirname,
    '../../../src/components/destination/DestinationCard.client.tsx'
);
const cardContent = readFileSync(cardPath, 'utf8');

describe('DestinationFilters.client.tsx', () => {
    describe('Component export', () => {
        it('should export named DestinationFilters function', () => {
            expect(content).toContain('export function DestinationFilters');
        });

        it('should not have default export', () => {
            expect(content).not.toContain('export default');
        });
    });

    describe('Props interface', () => {
        it('should accept initialQuery prop', () => {
            expect(content).toContain('initialQuery');
        });

        it('should accept initialType prop', () => {
            expect(content).toContain('initialType');
        });

        it('should accept initialParentId prop', () => {
            expect(content).toContain('initialParentId');
        });

        it('should accept locale prop', () => {
            expect(content).toContain('locale: string');
        });

        it('should use readonly props', () => {
            expect(content).toContain('readonly initialQuery');
            expect(content).toContain('readonly initialType');
            expect(content).toContain('readonly initialParentId');
            expect(content).toContain('readonly locale');
        });
    });

    describe('Search functionality', () => {
        it('should have a search input element', () => {
            // search input is rendered by DestinationFilterPanel
            expect(panelContent).toContain('type="text"');
            expect(panelContent).toContain('name="q"');
        });

        it('should have a search submit button', () => {
            expect(panelContent).toContain('type="submit"');
        });

        it('should use SearchIcon', () => {
            expect(panelContent).toContain('SearchIcon');
        });

        it('should handle form submission', () => {
            // onSearch handler is wired through DestinationFilterPanel
            expect(panelContent).toContain('onSubmit={onSearch}');
            expect(content).toContain('handleSearch');
        });

        it('should pre-populate search input from initial value', () => {
            expect(panelContent).toContain('value={query}');
        });

        it('should have onSubmit handler on the form', () => {
            expect(panelContent).toContain('onSubmit={onSearch}');
        });
    });

    describe('Type filter dropdown', () => {
        it('should have a type filter select element', () => {
            expect(panelContent).toContain('id="destination-type-filter"');
        });

        it('should include all DestinationTypeEnum values', () => {
            // DESTINATION_TYPES constant lives in DestinationFilterPanel
            expect(panelContent).toContain("'COUNTRY'");
            expect(panelContent).toContain("'REGION'");
            expect(panelContent).toContain("'PROVINCE'");
            expect(panelContent).toContain("'DEPARTMENT'");
            expect(panelContent).toContain("'CITY'");
            expect(panelContent).toContain("'TOWN'");
            expect(panelContent).toContain("'NEIGHBORHOOD'");
        });

        it('should have an "All types" default option', () => {
            expect(panelContent).toContain('allTypes');
        });

        it('should have a proper label for the type filter', () => {
            expect(panelContent).toContain('htmlFor="destination-type-filter"');
        });

        it('should handle type change', () => {
            // handler lives in orchestrator, prop passed to panel
            expect(content).toContain('handleTypeChange');
        });
    });

    describe('Parent filter dropdown', () => {
        it('should have a parent filter select element', () => {
            expect(panelContent).toContain('id="destination-parent-filter"');
        });

        it('should have a proper label for the parent filter', () => {
            expect(panelContent).toContain('htmlFor="destination-parent-filter"');
        });

        it('should show parent filter conditionally based on type', () => {
            expect(content).toContain('showParentFilter');
        });

        it('should handle parent change', () => {
            expect(content).toContain('handleParentChange');
        });

        it('should show loading state while fetching parents', () => {
            expect(content).toContain('isLoadingParents');
            expect(panelContent).toContain('loadingParents');
        });

        it('should handle parent fetch errors', () => {
            expect(content).toContain('parentError');
            expect(panelContent).toContain('noParentsAvailable');
        });

        it('should clear parent when type changes', () => {
            // handleTypeChange sets selectedParentId to ''
            expect(content).toContain("setSelectedParentId('')");
        });
    });

    describe('Clear filters button', () => {
        it('should have a clear filters button', () => {
            expect(panelContent).toContain('clearFilters');
        });

        it('should show clear button only when filters are active', () => {
            expect(content).toContain('hasActiveFilters');
        });

        it('should handle clear action', () => {
            expect(content).toContain('handleClearFilters');
        });
    });

    describe('Results rendering', () => {
        it('should render filtered results grid', () => {
            expect(content).toContain('results.map');
        });

        it('should show empty state when no results', () => {
            expect(content).toContain('noResults');
            expect(content).toContain('noResultsMessage');
        });

        it('should show loading state', () => {
            expect(content).toContain('isLoading');
            expect(content).toContain('animate-spin');
        });

        it('should show error state', () => {
            expect(content).toContain('errorLoading');
        });
    });

    describe('URL param management', () => {
        it('should update URL params on filter change', () => {
            expect(content).toContain('history.pushState');
        });

        it('should reset page param on filter change', () => {
            expect(content).toContain("url.searchParams.delete('page')");
        });
    });

    describe('Server grid toggling', () => {
        it('should toggle server-rendered grid visibility', () => {
            expect(content).toContain("getElementById('featured-destinations')");
            expect(content).toContain("getElementById('pagination')");
        });

        it('should hide server grid when filters are active', () => {
            expect(content).toContain("classList.add('hidden')");
        });

        it('should show server grid when filters are cleared', () => {
            expect(content).toContain("classList.remove('hidden')");
        });
    });

    describe('Accessibility', () => {
        it('should have aria-live region for screen reader announcements', () => {
            expect(content).toContain('aria-live="polite"');
        });

        it('should have screen-reader-only class on live region', () => {
            expect(content).toContain('sr-only');
        });

        it('should have label elements associated with controls', () => {
            expect(panelContent).toContain('htmlFor="destination-search"');
            expect(panelContent).toContain('htmlFor="destination-type-filter"');
            expect(panelContent).toContain('htmlFor="destination-parent-filter"');
        });

        it('should have aria-label on search button', () => {
            expect(panelContent).toContain("aria-label={t('search.button')}");
        });

        it('should have aria-hidden on decorative icons', () => {
            expect(panelContent).toContain('aria-hidden="true"');
        });

        it('should announce results count', () => {
            expect(content).toContain('resultsAnnouncement');
        });
    });

    describe('Localization', () => {
        it('should use useTranslation hook for i18n', () => {
            expect(content).toContain('useTranslation');
            expect(content).toContain("namespace: 'destinations'");
        });

        it('should use t function for search placeholder', () => {
            expect(panelContent).toContain("t('search.placeholder')");
        });

        it('should use t function for type labels', () => {
            expect(panelContent).toContain('t(`types.${type}`)');
        });

        it('should use t function for filter labels', () => {
            expect(panelContent).toContain("t('search.typeLabel')");
            expect(panelContent).toContain("t('search.allTypes')");
            expect(panelContent).toContain("t('search.clearFilters')");
        });

        it('should use SupportedLocale type', () => {
            expect(content).toContain('SupportedLocale');
        });
    });

    describe('API integration', () => {
        it('should fetch from the public destinations endpoint', () => {
            expect(content).toContain('/api/v1/public');
            expect(content).toContain('/destinations');
        });

        it('should pass q parameter to API', () => {
            expect(content).toContain('q:');
        });

        it('should pass destinationType parameter to API', () => {
            expect(content).toContain('destinationType');
        });

        it('should pass parentDestinationId parameter to API', () => {
            expect(content).toContain('parentDestinationId');
        });

        it('should handle API errors gracefully', () => {
            expect(content).toContain('catch');
            expect(content).toContain('throw new Error');
        });
    });

    describe('DestinationFilterPanel sub-component', () => {
        it('should import DestinationFilterPanel from separate file', () => {
            expect(content).toContain('DestinationFilterPanel');
            expect(content).toContain("'./DestinationFilterPanel.client'");
        });

        it('should export DestinationFilterPanel function', () => {
            expect(panelContent).toContain('export function DestinationFilterPanel');
        });

        it('should not have default export in panel', () => {
            expect(panelContent).not.toContain('export default');
        });

        it('should export DestinationFilterPanelProps interface', () => {
            expect(panelContent).toContain('export interface DestinationFilterPanelProps');
        });

        it('should export DESTINATION_TYPES constant', () => {
            expect(panelContent).toContain('export const DESTINATION_TYPES');
        });

        it('should be under 500 lines', () => {
            const lines = panelContent.split('\n').length;
            expect(lines).toBeLessThan(500);
        });
    });

    describe('Client-side destination card (DestinationCard.client.tsx)', () => {
        it('should import DestinationCardClient from separate file', () => {
            expect(content).toContain('import { DestinationCardClient');
            expect(content).toContain("from './DestinationCard.client'");
        });

        it('should export DestinationCardClient function', () => {
            expect(cardContent).toContain('export function DestinationCardClient');
        });

        it('should export DestinationItem type', () => {
            expect(cardContent).toContain('export interface DestinationItem');
        });

        it('should render destination name and link', () => {
            expect(cardContent).toContain('{destination.name}');
            expect(cardContent).toContain('href={detailUrl}');
        });

        it('should render featured badge', () => {
            expect(cardContent).toContain('isFeatured');
            expect(cardContent).toContain('labels.featured');
        });

        it('should render accommodation count', () => {
            expect(cardContent).toContain('accommodationsCount');
            expect(cardContent).toContain('countLabel');
        });

        it('should use lazy loading for images', () => {
            expect(cardContent).toContain('loading="lazy"');
        });
    });

    describe('Code quality', () => {
        it('should have comprehensive JSDoc documentation', () => {
            expect(content).toContain('/**');
            expect(content).toContain('Client-side destination search and filter island');
        });

        it('should use TypeScript interfaces with readonly', () => {
            expect(content).toContain('interface DestinationFiltersProps');
            expect(content).toContain('interface PaginationInfo');
            // DestinationItem is in DestinationCard.client.tsx
            expect(cardContent).toContain('interface DestinationItem');
        });

        it('should use React hooks', () => {
            expect(content).toContain('useState');
            expect(content).toContain('useEffect');
            expect(content).toContain('useCallback');
            expect(content).toContain('useRef');
        });

        it('should be under 500 lines', () => {
            const lines = content.split('\n').length;
            expect(lines).toBeLessThan(500);
        });
    });
});
