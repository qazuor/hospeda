import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const componentPath = resolve(__dirname, '../../../src/components/search/HeroSearchBar.client.tsx');
const content = readFileSync(componentPath, 'utf8');

describe('HeroSearchBar.client.tsx', () => {
    describe('Props interface', () => {
        it('should define locale prop with supported locales', () => {
            expect(content).toContain("locale: 'es' | 'en' | 'pt'");
        });

        it('should define apiBaseUrl prop', () => {
            expect(content).toContain('apiBaseUrl: string');
        });

        it('should define baseAccommodationsPath prop', () => {
            expect(content).toContain('baseAccommodationsPath: string');
        });

        it('should define labels prop', () => {
            expect(content).toContain('labels:');
        });

        it('should define labels.typePlaceholder', () => {
            expect(content).toContain('typePlaceholder: string');
        });

        it('should define labels.destinationPlaceholder', () => {
            expect(content).toContain('destinationPlaceholder: string');
        });

        it('should define labels.checkInPlaceholder', () => {
            expect(content).toContain('checkInPlaceholder: string');
        });

        it('should define labels.checkOutPlaceholder', () => {
            expect(content).toContain('checkOutPlaceholder: string');
        });

        it('should define labels.ctaLabel', () => {
            expect(content).toContain('ctaLabel: string');
        });

        it('should define labels.loadingText', () => {
            expect(content).toContain('loadingText: string');
        });

        it('should define labels.searchAriaLabel', () => {
            expect(content).toContain('searchAriaLabel: string');
        });

        it('should export HeroSearchBarProps interface', () => {
            expect(content).toContain('export interface HeroSearchBarProps');
        });
    });

    describe('Named export', () => {
        it('should have named export HeroSearchBar', () => {
            expect(content).toContain('export function HeroSearchBar');
        });

        it('should not have a default export', () => {
            expect(content).not.toContain('export default');
        });
    });

    describe('Data fetching', () => {
        it('should use useEffect for API fetch on mount', () => {
            expect(content).toContain('useEffect');
        });

        it('should call fetchAccommodationTypes inside useEffect', () => {
            expect(content).toContain('fetchAccommodationTypes');
        });

        it('should call fetchDestinations inside useEffect', () => {
            expect(content).toContain('fetchDestinations');
        });

        it('should use Promise.all to fetch data in parallel', () => {
            expect(content).toContain('Promise.all');
        });

        it('should clean up with a cancelled flag on unmount', () => {
            expect(content).toContain('cancelled');
        });
    });

    describe('Form fields', () => {
        it('should have a select for accommodation type', () => {
            expect(content).toContain('name="type"');
            expect(content).toMatch(/<select[\s\S]*?name="type"/);
        });

        it('should have a select for destination', () => {
            expect(content).toContain('name="destination"');
            expect(content).toMatch(/<select[\s\S]*?name="destination"/);
        });

        it('should have an input[type="date"] for check-in', () => {
            expect(content).toContain('type="date"');
            expect(content).toContain('name="checkIn"');
        });

        it('should have an input[type="date"] for check-out', () => {
            expect(content).toContain('name="checkOut"');
        });

        it('should have exactly two date inputs', () => {
            const dateInputMatches = content.match(/type="date"/g);
            expect(dateInputMatches).not.toBeNull();
            expect(dateInputMatches?.length).toBe(2);
        });

        it('should have a submit button', () => {
            expect(content).toContain('type="submit"');
        });
    });

    describe('Accessibility', () => {
        it('should use sr-only class for visually hidden labels', () => {
            expect(content).toContain('sr-only');
        });

        it('should have aria-label on the form element', () => {
            expect(content).toContain('aria-label={labels.searchAriaLabel}');
        });

        it('should have aria-label on the submit button', () => {
            expect(content).toContain('type="submit"');
            expect(content).toContain('aria-label={labels.searchAriaLabel}');
        });

        it('should have htmlFor attributes on labels', () => {
            expect(content).toContain('htmlFor=');
        });

        it('should have focus-visible ring styles for keyboard navigation', () => {
            expect(content).toContain('focus-visible:ring-primary');
        });
    });

    describe('Styling', () => {
        it('should have bg-primary on the CTA button', () => {
            expect(content).toContain('bg-primary');
        });

        it('should have flex-col for vertical (mobile) layout', () => {
            expect(content).toContain('flex-col');
        });

        it('should have lg:flex-row for horizontal (desktop) layout', () => {
            expect(content).toContain('lg:flex-row');
        });

        it('should have rounded-xl for card styling', () => {
            expect(content).toContain('rounded-xl');
        });

        it('should have shadow-lg for card elevation', () => {
            expect(content).toContain('shadow-lg');
        });
    });

    describe('URL building and fallback logic', () => {
        it('should reference baseAccommodationsPath in URL building', () => {
            expect(content).toContain('baseAccommodationsPath');
        });

        it('should have a buildSearchUrl helper function', () => {
            expect(content).toContain('buildSearchUrl');
        });

        it('should fall back to baseAccommodationsPath when URL construction fails', () => {
            expect(content).toContain('url ?? baseAccommodationsPath');
        });

        it('should return null on URL construction error for fallback handling', () => {
            expect(content).toContain('return null');
        });

        it('should use window.location.href for navigation on submit', () => {
            expect(content).toContain('window.location.href');
        });
    });

    describe('File constraints', () => {
        it('should be under 500 lines', () => {
            const lineCount = content.split('\n').length;
            expect(lineCount).toBeLessThan(500);
        });

        it('should not have a default export', () => {
            expect(content).not.toContain('export default');
        });
    });
});
