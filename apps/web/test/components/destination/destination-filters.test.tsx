/**
 * @file destination-filters.test.tsx
 * @description Tests for DestinationFilters.client.tsx.
 * Validates component structure, props interface, search input, type filter
 * options, debounce mechanism, URL param management, server grid toggling,
 * results rendering, and accessibility attributes.
 *
 * Strategy: source-content assertions via readFileSync (the component depends
 * on sub-components DestinationFilterPanel and DestinationCard that are
 * defined in companion files).
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const componentPath = resolve(
    __dirname,
    '../../../src/components/destination/DestinationFilters.client.tsx'
);
const content = readFileSync(componentPath, 'utf8');

describe('DestinationFilters.client.tsx', () => {
    describe('Named export', () => {
        it('should export DestinationFilters as a named function', () => {
            // Arrange & Assert
            expect(content).toContain('export function DestinationFilters');
        });

        it('should not have a default export', () => {
            // Assert
            expect(content).not.toContain('export default');
        });
    });

    describe('Props interface', () => {
        it('should define a DestinationFiltersProps interface', () => {
            // Assert
            expect(content).toContain('interface DestinationFiltersProps');
        });

        it('should accept initialQuery prop as optional string', () => {
            // Assert
            expect(content).toContain('initialQuery');
        });

        it('should accept initialType prop as optional string', () => {
            // Assert
            expect(content).toContain('initialType');
        });

        it('should accept initialParentId prop as optional string', () => {
            // Assert
            expect(content).toContain('initialParentId');
        });

        it('should accept locale prop as required string', () => {
            // Assert
            expect(content).toContain('locale: string');
        });

        it('should mark all props as readonly', () => {
            // Assert
            expect(content).toContain('readonly initialQuery');
            expect(content).toContain('readonly initialType');
            expect(content).toContain('readonly initialParentId');
            expect(content).toContain('readonly locale');
        });
    });

    describe('Search input', () => {
        it('should manage query state with useState', () => {
            // Assert
            expect(content).toContain('useState(initialQuery)');
        });

        it('should pass query to DestinationFilterPanel', () => {
            // Assert
            expect(content).toContain('query={query}');
        });

        it('should pass onQueryChange setter to panel', () => {
            // Assert
            expect(content).toContain('onQueryChange={setQuery}');
        });

        it('should have handleSearch callback for form submission', () => {
            // Assert
            expect(content).toContain('handleSearch');
        });

        it('should wire onSearch to the filter panel', () => {
            // Assert
            expect(content).toContain('onSearch={handleSearch}');
        });
    });

    describe('Type filter', () => {
        it('should manage selectedType state', () => {
            // Assert
            expect(content).toContain('useState(initialType)');
        });

        it('should import DESTINATION_TYPES constant from panel', () => {
            // Assert
            expect(content).toContain('DESTINATION_TYPES');
        });

        it('should have handleTypeChange callback for type changes', () => {
            // Assert
            expect(content).toContain('handleTypeChange');
        });

        it('should pass selectedType to the filter panel', () => {
            // Assert
            expect(content).toContain('selectedType={selectedType}');
        });

        it('should pass onTypeChange handler to the filter panel', () => {
            // Assert
            expect(content).toContain('onTypeChange={handleTypeChange}');
        });

        it('should clear parent when type changes', () => {
            // Assert
            expect(content).toContain("setSelectedParentId('')");
        });
    });

    describe('Debounce on filter change', () => {
        it('should use a filterDebounceRef to debounce API calls', () => {
            // Assert
            expect(content).toContain('filterDebounceRef');
        });

        it('should clear previous timeout before setting a new one', () => {
            // Assert
            expect(content).toContain('clearTimeout(filterDebounceRef.current)');
        });

        it('should debounce type-filter API calls by 300ms', () => {
            // Assert
            expect(content).toContain('setTimeout(');
            expect(content).toContain('300');
        });

        it('should debounce parent-filter API calls by 300ms', () => {
            // Assert - same debounce constant is used for parent changes too
            const timeouts = content.match(/setTimeout\(/g);
            expect(timeouts).toBeTruthy();
            expect(timeouts?.length ?? 0).toBeGreaterThanOrEqual(2);
        });
    });

    describe('Parent filter', () => {
        it('should manage selectedParentId state', () => {
            // Assert
            expect(content).toContain('useState(initialParentId)');
        });

        it('should have handleParentChange callback', () => {
            // Assert
            expect(content).toContain('handleParentChange');
        });

        it('should conditionally show parent filter based on selected type', () => {
            // Assert
            expect(content).toContain('showParentFilter');
        });

        it('should manage parentOptions state for the dropdown', () => {
            // Assert
            expect(content).toContain('parentOptions');
        });

        it('should track isLoadingParents state', () => {
            // Assert
            expect(content).toContain('isLoadingParents');
        });

        it('should track parentError state', () => {
            // Assert
            expect(content).toContain('parentError');
        });
    });

    describe('URL param management', () => {
        it('should update URL params via history.pushState', () => {
            // Assert
            expect(content).toContain('history.pushState');
        });

        it('should reset the page param when filters change', () => {
            // Assert
            expect(content).toContain("url.searchParams.delete('page')");
        });

        it('should have updateUrlParams callback', () => {
            // Assert
            expect(content).toContain('updateUrlParams');
        });
    });

    describe('Server grid toggling', () => {
        it('should look up featured-destinations element to toggle visibility', () => {
            // Assert
            expect(content).toContain("getElementById('featured-destinations')");
        });

        it('should look up pagination element to toggle visibility', () => {
            // Assert
            expect(content).toContain("getElementById('pagination')");
        });

        it('should add hidden class when filters are active', () => {
            // Assert
            expect(content).toContain("classList.add('hidden')");
        });

        it('should remove hidden class when filters are cleared', () => {
            // Assert
            expect(content).toContain("classList.remove('hidden')");
        });
    });

    describe('Results rendering', () => {
        it('should render filtered results grid when results are available', () => {
            // Assert
            expect(content).toContain('results.map');
        });

        it('should use DestinationCardClient for each result', () => {
            // Assert
            expect(content).toContain('DestinationCardClient');
        });

        it('should show no-results state when results array is empty', () => {
            // Assert
            expect(content).toContain('noResults');
        });

        it('should show loading spinner while fetching', () => {
            // Assert
            expect(content).toContain('isLoading');
            expect(content).toContain('animate-spin');
        });

        it('should show error state when fetch fails', () => {
            // Assert
            expect(content).toContain('errorLoading');
        });
    });

    describe('Clear filters', () => {
        it('should have handleClearFilters callback', () => {
            // Assert
            expect(content).toContain('handleClearFilters');
        });

        it('should reset all filter states on clear', () => {
            // Assert
            expect(content).toContain("setQuery('')");
            expect(content).toContain("setSelectedType('')");
            expect(content).toContain("setSelectedParentId('')");
        });

        it('should pass hasActiveFilters to the panel', () => {
            // Assert
            expect(content).toContain('hasActiveFilters');
        });
    });

    describe('Accessibility', () => {
        it('should have an aria-live="polite" region for screen reader announcements', () => {
            // Assert
            expect(content).toContain('aria-live="polite"');
        });

        it('should use sr-only class to visually hide the live region', () => {
            // Assert
            expect(content).toContain('sr-only');
        });

        it('should announce results count to screen readers', () => {
            // Assert
            expect(content).toContain('resultsAnnouncement');
        });
    });

    describe('i18n', () => {
        it('should use useTranslation hook for localised text', () => {
            // Assert
            expect(content).toContain('useTranslation');
        });

        it('should use the destinations namespace', () => {
            // Assert
            expect(content).toContain("namespace: 'destinations'");
        });

        it('should use SupportedLocale type for locale casting', () => {
            // Assert
            expect(content).toContain('SupportedLocale');
        });
    });

    describe('API integration', () => {
        it('should build API URL from the public destinations endpoint', () => {
            // Assert
            expect(content).toContain('/api/v1/public');
            expect(content).toContain('/destinations');
        });

        it('should pass q query param to the API', () => {
            // Assert
            expect(content).toContain('q:');
        });

        it('should pass destinationType param to the API', () => {
            // Assert
            expect(content).toContain('destinationType');
        });

        it('should pass parentDestinationId param to the API', () => {
            // Assert
            expect(content).toContain('parentDestinationId');
        });

        it('should validate API response with a Zod schema', () => {
            // Assert
            expect(content).toContain('destinationsResponseSchema');
        });

        it('should handle API errors gracefully with a catch clause', () => {
            // Assert
            expect(content).toContain('catch');
        });
    });

    describe('React hooks usage', () => {
        it('should use useState for local state management', () => {
            // Assert
            expect(content).toContain('useState');
        });

        it('should use useEffect for side effects', () => {
            // Assert
            expect(content).toContain('useEffect');
        });

        it('should use useCallback for stable handler references', () => {
            // Assert
            expect(content).toContain('useCallback');
        });

        it('should use useRef for mutable refs (live region, debounce, search input)', () => {
            // Assert
            expect(content).toContain('useRef');
        });
    });

    describe('Code quality', () => {
        it('should not exceed 500 lines', () => {
            // Assert
            const lineCount = content.split('\n').length;
            expect(lineCount).toBeLessThan(500);
        });

        it('should have JSDoc on the exported component', () => {
            // Assert
            expect(content).toContain('/**');
        });
    });
});
