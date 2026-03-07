/**
 * @file filter-components.test.ts
 * @description Source-level tests for accommodation filter sub-components.
 *
 * Covers:
 *  - ActiveFilterChips.client.tsx
 *  - FilterChipsBar.client.tsx
 *  - FilterSection.client.tsx
 *  - PriceRangeFilter.client.tsx
 *  - filter-sidebar.types.ts  (constants + toSlug derivation)
 *  - _AccommodationListLayout.astro
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// ─── Resolve source paths ─────────────────────────────────────────────────────

const COMPONENTS_DIR = resolve(__dirname, '../../../src/components/accommodation');

const activeFilterChips = readFileSync(
    resolve(COMPONENTS_DIR, 'ActiveFilterChips.client.tsx'),
    'utf8'
);

const filterChipsBar = readFileSync(resolve(COMPONENTS_DIR, 'FilterChipsBar.client.tsx'), 'utf8');

const filterSection = readFileSync(resolve(COMPONENTS_DIR, 'FilterSection.client.tsx'), 'utf8');

const priceRangeFilter = readFileSync(
    resolve(COMPONENTS_DIR, 'PriceRangeFilter.client.tsx'),
    'utf8'
);

const filterSidebarTypes = readFileSync(resolve(COMPONENTS_DIR, 'filter-sidebar.types.ts'), 'utf8');

const accommodationListLayout = readFileSync(
    resolve(COMPONENTS_DIR, '_AccommodationListLayout.astro'),
    'utf8'
);

// ─── ActiveFilterChips ────────────────────────────────────────────────────────

describe('ActiveFilterChips.client.tsx', () => {
    describe('Exports', () => {
        it('should use named export for ActiveFilterChips', () => {
            expect(activeFilterChips).toContain('export function ActiveFilterChips');
        });

        it('should export the ActiveFilterChipsProps interface', () => {
            expect(activeFilterChips).toContain('export interface ActiveFilterChipsProps');
        });
    });

    describe('Props contract', () => {
        it('should define all required callback props as readonly', () => {
            expect(activeFilterChips).toContain('readonly onClearType');
            expect(activeFilterChips).toContain('readonly onClearPriceMin');
            expect(activeFilterChips).toContain('readonly onClearPriceMax');
            expect(activeFilterChips).toContain('readonly onClearDestination');
            expect(activeFilterChips).toContain('readonly onClearAmenity');
            expect(activeFilterChips).toContain('readonly onClearRating');
            expect(activeFilterChips).toContain('readonly onClearAll');
        });

        it('should accept a locale prop', () => {
            expect(activeFilterChips).toContain('readonly locale: string');
        });

        it('should accept a filters prop typed with AccommodationFilters', () => {
            expect(activeFilterChips).toContain('readonly filters: AccommodationFilters');
        });
    });

    describe('i18n', () => {
        it('should import useTranslation hook', () => {
            expect(activeFilterChips).toContain("from '../../hooks/useTranslation'");
        });

        it('should use the accommodations namespace for translations', () => {
            expect(activeFilterChips).toContain("namespace: 'accommodations'");
        });

        it('should use translation key for active filters label', () => {
            expect(activeFilterChips).toContain('sidebar.activeFilters');
        });

        it('should use translation key for clear-all button', () => {
            expect(activeFilterChips).toContain('sidebar.clearAll');
        });
    });

    describe('Semantic color tokens', () => {
        it('should use bg-muted for the container', () => {
            expect(activeFilterChips).toContain('bg-muted');
        });

        it('should use text-primary for chip text', () => {
            expect(activeFilterChips).toContain('text-primary');
        });

        it('should use text-muted-foreground for label text', () => {
            expect(activeFilterChips).toContain('text-muted-foreground');
        });

        it('should use border-border for chip borders', () => {
            expect(activeFilterChips).toContain('border-border');
        });

        it('should not contain hardcoded hex colors', () => {
            expect(activeFilterChips).not.toMatch(/#[0-9a-fA-F]{3,6}/);
        });
    });

    describe('Accessibility', () => {
        it('should use aria-label on remove chip buttons', () => {
            expect(activeFilterChips).toContain('aria-label={ariaLabel}');
        });

        it('should use type="button" on interactive buttons', () => {
            expect(activeFilterChips).toContain('type="button"');
        });

        it('should use aria-hidden on the close icon', () => {
            expect(activeFilterChips).toContain('aria-hidden="true"');
        });

        it('should use focus-visible outline for keyboard navigation', () => {
            expect(activeFilterChips).toContain('focus-visible:outline');
        });
    });

    describe('Logic guards', () => {
        it('should return null when activeFilterCount equals zero', () => {
            expect(activeFilterChips).toContain('if (activeFilterCount === 0) return null');
        });

        it('should include Chip helper component', () => {
            expect(activeFilterChips).toContain('function Chip(');
        });
    });
});

// ─── FilterChipsBar ───────────────────────────────────────────────────────────

describe('FilterChipsBar.client.tsx', () => {
    describe('Exports', () => {
        it('should use named export for FilterChipsBar', () => {
            expect(filterChipsBar).toContain('export function FilterChipsBar');
        });
    });

    describe('Props contract', () => {
        it('should define currentFilters as a readonly Record', () => {
            expect(filterChipsBar).toContain('readonly currentFilters: Record<string, string>');
        });

        it('should define locale as readonly string', () => {
            expect(filterChipsBar).toContain('readonly locale: string');
        });

        it('should define accommodationTypes as readonly array', () => {
            expect(filterChipsBar).toContain('readonly accommodationTypes:');
        });
    });

    describe('i18n', () => {
        it('should import useTranslation hook', () => {
            expect(filterChipsBar).toContain("from '../../hooks/useTranslation'");
        });

        it('should use the accommodations namespace', () => {
            expect(filterChipsBar).toContain("namespace: 'accommodations'");
        });

        it('should prefix chip labels with chips. namespace', () => {
            expect(filterChipsBar).toContain('chips.');
        });
    });

    describe('Toggle chips', () => {
        it('should render a wifi toggle chip', () => {
            expect(filterChipsBar).toContain("ct('wifi')");
        });

        it('should render a pool toggle chip', () => {
            expect(filterChipsBar).toContain("ct('pool')");
        });

        it('should render a pets toggle chip', () => {
            expect(filterChipsBar).toContain("ct('pets')");
        });

        it('should render a parking toggle chip', () => {
            expect(filterChipsBar).toContain("ct('parking')");
        });
    });

    describe('Dropdown chips', () => {
        it('should render a type dropdown chip', () => {
            expect(filterChipsBar).toContain("ct('type')");
        });

        it('should render a price dropdown chip', () => {
            expect(filterChipsBar).toContain("ct('price')");
        });

        it('should render a capacity dropdown chip', () => {
            expect(filterChipsBar).toContain("ct('capacity')");
        });

        it('should render a rating dropdown chip', () => {
            expect(filterChipsBar).toContain("ct('rating')");
        });
    });

    describe('Semantic color tokens', () => {
        it('should use bg-surface for chip backgrounds', () => {
            expect(filterChipsBar).toContain('bg-surface');
        });

        it('should use border-border for chip borders', () => {
            expect(filterChipsBar).toContain('border-border');
        });

        it('should use text-primary for active chip text', () => {
            expect(filterChipsBar).toContain('text-primary');
        });

        it('should not contain hardcoded hex colors', () => {
            expect(filterChipsBar).not.toMatch(/#[0-9a-fA-F]{3,6}/);
        });
    });

    describe('Accessibility', () => {
        it('should use aria-hidden on the divider element', () => {
            expect(filterChipsBar).toContain('aria-hidden="true"');
        });

        it('should use type="button" on toggle buttons', () => {
            expect(filterChipsBar).toContain('type="button"');
        });
    });

    describe('URL navigation', () => {
        it('should define navigateWithParams helper', () => {
            expect(filterChipsBar).toContain('function navigateWithParams(');
        });

        it('should reset the page param on navigation', () => {
            expect(filterChipsBar).toContain("url.searchParams.delete('page')");
        });

        it('should define toggleBoolParam helper', () => {
            expect(filterChipsBar).toContain('function toggleBoolParam(');
        });
    });
});

// ─── FilterSection ────────────────────────────────────────────────────────────

describe('FilterSection.client.tsx', () => {
    describe('Exports', () => {
        it('should use named export for FilterSection', () => {
            expect(filterSection).toContain('export function FilterSection');
        });

        it('should export the FilterSectionProps interface', () => {
            expect(filterSection).toContain('export interface FilterSectionProps');
        });
    });

    describe('Props contract', () => {
        it('should define title as readonly string', () => {
            expect(filterSection).toContain('readonly title: string');
        });

        it('should define isExpanded as readonly boolean', () => {
            expect(filterSection).toContain('readonly isExpanded: boolean');
        });

        it('should define onToggle as readonly callback', () => {
            expect(filterSection).toContain('readonly onToggle: () => void');
        });

        it('should define children prop', () => {
            expect(filterSection).toContain('readonly children: React.ReactNode');
        });

        it('should define optional withBorder prop defaulting to true', () => {
            expect(filterSection).toContain('readonly withBorder?: boolean');
            expect(filterSection).toContain('withBorder = true');
        });
    });

    describe('Accessibility', () => {
        it('should use aria-expanded on the toggle button', () => {
            expect(filterSection).toContain('aria-expanded={isExpanded}');
        });

        it('should use type="button" on the toggle button', () => {
            expect(filterSection).toContain('type="button"');
        });

        it('should render the chevron icon with aria-hidden', () => {
            expect(filterSection).toContain('aria-hidden="true"');
        });

        it('should provide focus-visible outline on the toggle button', () => {
            expect(filterSection).toContain('focus-visible:outline');
        });
    });

    describe('Semantic color tokens', () => {
        it('should use border-border for the separator', () => {
            expect(filterSection).toContain('border-border');
        });

        it('should use text-foreground for the title text', () => {
            expect(filterSection).toContain('text-foreground');
        });

        it('should not contain hardcoded hex colors', () => {
            expect(filterSection).not.toMatch(/#[0-9a-fA-F]{3,6}/);
        });
    });

    describe('Chevron rotation', () => {
        it('should rotate chevron icon when section is expanded', () => {
            expect(filterSection).toContain('rotate-180');
        });

        it('should conditionally apply rotation based on isExpanded', () => {
            expect(filterSection).toContain("isExpanded ? 'rotate-180'");
        });
    });

    describe('Conditional rendering', () => {
        it('should only render children when isExpanded is true', () => {
            expect(filterSection).toContain('{isExpanded && children}');
        });
    });
});

// ─── PriceRangeFilter ─────────────────────────────────────────────────────────

describe('PriceRangeFilter.client.tsx', () => {
    describe('Exports', () => {
        it('should use named export for PriceRangeFilter', () => {
            expect(priceRangeFilter).toContain('export function PriceRangeFilter');
        });

        it('should export the PriceRangeFilterProps interface', () => {
            expect(priceRangeFilter).toContain('export interface PriceRangeFilterProps');
        });
    });

    describe('Props contract', () => {
        it('should define priceMin as number | null', () => {
            expect(priceRangeFilter).toContain('readonly priceMin: number | null');
        });

        it('should define priceMax as number | null', () => {
            expect(priceRangeFilter).toContain('readonly priceMax: number | null');
        });

        it('should define isExpanded as readonly boolean', () => {
            expect(priceRangeFilter).toContain('readonly isExpanded: boolean');
        });

        it('should define onToggle callback', () => {
            expect(priceRangeFilter).toContain('readonly onToggle: () => void');
        });

        it('should define onPriceMinChange callback returning void', () => {
            expect(priceRangeFilter).toContain(
                'readonly onPriceMinChange: (value: number | null) => void'
            );
        });

        it('should define onPriceMaxChange callback returning void', () => {
            expect(priceRangeFilter).toContain(
                'readonly onPriceMaxChange: (value: number | null) => void'
            );
        });

        it('should accept a locale prop', () => {
            expect(priceRangeFilter).toContain('readonly locale: string');
        });
    });

    describe('i18n', () => {
        it('should import useTranslation hook', () => {
            expect(priceRangeFilter).toContain("from '../../hooks/useTranslation'");
        });

        it('should use the accommodations namespace', () => {
            expect(priceRangeFilter).toContain("namespace: 'accommodations'");
        });

        it('should use translation key for price range section title', () => {
            expect(priceRangeFilter).toContain('sidebar.priceRange');
        });

        it('should use translation key for min price label', () => {
            expect(priceRangeFilter).toContain('sidebar.priceMin');
        });

        it('should use translation key for max price label', () => {
            expect(priceRangeFilter).toContain('sidebar.priceMax');
        });
    });

    describe('Input elements', () => {
        it('should render a number input for min price', () => {
            expect(priceRangeFilter).toContain('id="price-min"');
            expect(priceRangeFilter).toContain('type="number"');
        });

        it('should render a number input for max price', () => {
            expect(priceRangeFilter).toContain('id="price-max"');
        });

        it('should associate labels with inputs via htmlFor', () => {
            expect(priceRangeFilter).toContain('htmlFor="price-min"');
            expect(priceRangeFilter).toContain('htmlFor="price-max"');
        });

        it('should set min="0" on both inputs to prevent negative values', () => {
            const minOccurrences = (priceRangeFilter.match(/min="0"/g) ?? []).length;
            expect(minOccurrences).toBeGreaterThanOrEqual(2);
        });
    });

    describe('Semantic color tokens', () => {
        it('should use border-border on inputs', () => {
            expect(priceRangeFilter).toContain('border-border');
        });

        it('should use bg-card for input backgrounds', () => {
            expect(priceRangeFilter).toContain('bg-card');
        });

        it('should use text-foreground for input text', () => {
            expect(priceRangeFilter).toContain('text-foreground');
        });

        it('should use focus:ring-primary for focus style', () => {
            expect(priceRangeFilter).toContain('focus:ring-primary');
        });

        it('should not contain hardcoded hex colors', () => {
            expect(priceRangeFilter).not.toMatch(/#[0-9a-fA-F]{3,6}/);
        });
    });

    describe('Integer parsing', () => {
        it('should parse input values with parseInt', () => {
            expect(priceRangeFilter).toContain('Number.parseInt(');
        });

        it('should pass null when input is empty', () => {
            expect(priceRangeFilter).toContain(': null');
        });
    });

    describe('FilterSection integration', () => {
        it('should import and use FilterSection component', () => {
            expect(priceRangeFilter).toContain("from './FilterSection.client'");
            expect(priceRangeFilter).toContain('<FilterSection');
        });
    });
});

// ─── filter-sidebar.types ─────────────────────────────────────────────────────

describe('filter-sidebar.types.ts', () => {
    describe('Interfaces', () => {
        it('should export AccommodationFilters interface', () => {
            expect(filterSidebarTypes).toContain('export interface AccommodationFilters');
        });

        it('should define types as readonly string array in AccommodationFilters', () => {
            expect(filterSidebarTypes).toContain('readonly types: readonly string[]');
        });

        it('should define amenities as readonly string array', () => {
            expect(filterSidebarTypes).toContain('readonly amenities: readonly string[]');
        });

        it('should define priceMin as number | null', () => {
            expect(filterSidebarTypes).toContain('readonly priceMin: number | null');
        });

        it('should define priceMax as number | null', () => {
            expect(filterSidebarTypes).toContain('readonly priceMax: number | null');
        });

        it('should define destination as string', () => {
            expect(filterSidebarTypes).toContain('readonly destination: string');
        });

        it('should define minRating as number | null', () => {
            expect(filterSidebarTypes).toContain('readonly minRating: number | null');
        });

        it('should export Destination interface with value and label', () => {
            expect(filterSidebarTypes).toContain('export interface Destination');
            expect(filterSidebarTypes).toContain('readonly value: string');
            expect(filterSidebarTypes).toContain('readonly label: string');
        });

        it('should export SectionState interface with all section keys', () => {
            expect(filterSidebarTypes).toContain('export interface SectionState');
            expect(filterSidebarTypes).toContain('readonly type: boolean');
            expect(filterSidebarTypes).toContain('readonly price: boolean');
            expect(filterSidebarTypes).toContain('readonly destination: boolean');
            expect(filterSidebarTypes).toContain('readonly amenities: boolean');
            expect(filterSidebarTypes).toContain('readonly rating: boolean');
        });
    });

    describe('Type aliases', () => {
        it('should export SectionKey union type', () => {
            expect(filterSidebarTypes).toContain(
                "export type SectionKey = 'type' | 'price' | 'destination' | 'amenities' | 'rating'"
            );
        });
    });

    describe('Constants', () => {
        it('should export ACCOMMODATION_TYPES as const array', () => {
            expect(filterSidebarTypes).toContain('export const ACCOMMODATION_TYPES');
            expect(filterSidebarTypes).toContain("'hotel'");
            expect(filterSidebarTypes).toContain("'cabin'");
            expect(filterSidebarTypes).toContain("'apartment'");
            expect(filterSidebarTypes).toContain("'rural'");
            expect(filterSidebarTypes).toContain("'hostel'");
            expect(filterSidebarTypes).toContain("'boutique'");
        });

        it('should export AMENITIES as const array', () => {
            expect(filterSidebarTypes).toContain('export const AMENITIES');
            expect(filterSidebarTypes).toContain("'wifi'");
            expect(filterSidebarTypes).toContain("'pool'");
            expect(filterSidebarTypes).toContain("'parking'");
            expect(filterSidebarTypes).toContain("'breakfast'");
            expect(filterSidebarTypes).toContain("'petFriendly'");
        });

        it('should export DESTINATIONS derived from DESTINATION_NAMES', () => {
            expect(filterSidebarTypes).toContain('export const DESTINATIONS');
            expect(filterSidebarTypes).toContain('DESTINATION_NAMES');
        });

        it('should derive destination slugs via toSlug function', () => {
            // toSlug lowercases, removes accents, replaces spaces with hyphens
            expect(filterSidebarTypes).toContain('.toLowerCase()');
            expect(filterSidebarTypes).toContain(".replace(/\\s+/g, '-')");
        });
    });
});

// ─── _AccommodationListLayout.astro ──────────────────────────────────────────

describe('_AccommodationListLayout.astro', () => {
    describe('Imports', () => {
        it('should import FilterSidebar component', () => {
            expect(accommodationListLayout).toContain("from './FilterSidebar.client'");
        });

        it('should import AccommodationFilters type', () => {
            expect(accommodationListLayout).toContain("from './filter-sidebar.types'");
        });

        it('should use createT for translations', () => {
            expect(accommodationListLayout).toContain('createT');
        });
    });

    describe('Props contract', () => {
        it('should define locale as SupportedLocale', () => {
            expect(accommodationListLayout).toContain('readonly locale: SupportedLocale');
        });

        it('should define title as readonly string', () => {
            expect(accommodationListLayout).toContain('readonly title: string');
        });

        it('should define cards as readonly array', () => {
            expect(accommodationListLayout).toContain('readonly cards:');
        });

        it('should define pagination as PaginationMeta | null', () => {
            expect(accommodationListLayout).toContain('readonly pagination: PaginationMeta | null');
        });

        it('should define apiError as boolean', () => {
            expect(accommodationListLayout).toContain('readonly apiError: boolean');
        });

        it('should define hasActiveFilters as boolean', () => {
            expect(accommodationListLayout).toContain('readonly hasActiveFilters: boolean');
        });

        it('should define initialFilters as Partial<AccommodationFilters>', () => {
            expect(accommodationListLayout).toContain(
                'readonly initialFilters: Partial<AccommodationFilters>'
            );
        });

        it('should define searchQuery as optional', () => {
            expect(accommodationListLayout).toContain('readonly searchQuery?: string');
        });
    });

    describe('Layout structure', () => {
        it('should render FilterSidebar island with client:visible directive', () => {
            expect(accommodationListLayout).toContain('FilterSidebar');
            expect(accommodationListLayout).toContain('client:visible');
        });

        it('should render an h1 heading with the page title', () => {
            expect(accommodationListLayout).toContain('<h1');
            expect(accommodationListLayout).toContain('{title}');
        });

        it('should render a search form with method=get', () => {
            expect(accommodationListLayout).toContain('method="get"');
        });

        it('should render a search input with aria-label', () => {
            expect(accommodationListLayout).toContain('aria-label=');
            expect(accommodationListLayout).toContain('name="q"');
        });

        it('should render Pagination component', () => {
            expect(accommodationListLayout).toContain('<Pagination');
        });

        it('should render Breadcrumb component', () => {
            expect(accommodationListLayout).toContain('<Breadcrumb');
        });
    });

    describe('Conditional rendering', () => {
        it('should show active filter indicator when hasActiveFilters is true', () => {
            expect(accommodationListLayout).toContain('{hasActiveFilters && (');
        });

        it('should render EmptyState for apiError condition', () => {
            expect(accommodationListLayout).toContain('apiError ?');
        });

        it('should render EmptyState when cards are empty', () => {
            expect(accommodationListLayout).toContain('cards.length > 0 ?');
        });
    });

    describe('Semantic color tokens', () => {
        it('should use text-foreground for headings', () => {
            expect(accommodationListLayout).toContain('text-foreground');
        });

        it('should use text-muted-foreground for secondary text', () => {
            expect(accommodationListLayout).toContain('text-muted-foreground');
        });

        it('should use bg-primary for submit button', () => {
            expect(accommodationListLayout).toContain('bg-primary');
        });

        it('should use border-border for input borders', () => {
            expect(accommodationListLayout).toContain('border-border');
        });

        it('should not contain hardcoded hex colors', () => {
            expect(accommodationListLayout).not.toMatch(/#[0-9a-fA-F]{3,6}/);
        });
    });

    describe('Accessibility', () => {
        it('should have aria-label on the section element', () => {
            expect(accommodationListLayout).toContain('aria-label={title}');
        });
    });
});
