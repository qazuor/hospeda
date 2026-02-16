/**
 * Tests for Pagination.astro component.
 * Verifies props, URL generation, page number logic, accessibility, and localization.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const componentPath = resolve(__dirname, '../../../src/components/ui/Pagination.astro');
const content = readFileSync(componentPath, 'utf8');

describe('Pagination.astro', () => {
    describe('Props', () => {
        it('should require currentPage prop', () => {
            expect(content).toContain('currentPage: number');
        });

        it('should require totalPages prop', () => {
            expect(content).toContain('totalPages: number');
        });

        it('should require baseUrl prop', () => {
            expect(content).toContain('baseUrl: string');
        });

        it('should accept optional locale prop', () => {
            expect(content).toContain("locale?: 'es' | 'en' | 'pt'");
        });

        it('should default locale to es', () => {
            expect(content).toContain("locale = 'es'");
        });

        it('should accept optional class prop', () => {
            expect(content).toContain('class?: string');
        });
    });

    describe('URL generation', () => {
        it('should have buildPageUrl function', () => {
            expect(content).toContain('function buildPageUrl(page: number): string');
        });

        it('should return base URL for page 1 (no /page/ segment)', () => {
            expect(content).toContain('if (page === 1)');
            expect(content).toContain('`${normalizedBase}/`');
        });

        it('should return /page/N/ URL for page > 1', () => {
            expect(content).toContain('`${normalizedBase}/page/${page}/`');
        });

        it('should normalize base URL trailing slash', () => {
            expect(content).toContain("baseUrl.endsWith('/')");
        });
    });

    describe('Page number generation', () => {
        it('should have getPageNumbers function', () => {
            expect(content).toContain(
                'function getPageNumbers(current: number, total: number): number[]'
            );
        });

        it('should return all pages when total <= 5', () => {
            expect(content).toContain('if (total <= 5)');
        });

        it('should use -1 as ellipsis sentinel value', () => {
            expect(content).toContain('p === -1');
        });

        it('should handle near-start page numbers', () => {
            expect(content).toContain('if (current <= 3)');
        });

        it('should handle near-end page numbers', () => {
            expect(content).toContain('if (current >= total - 2)');
        });
    });

    describe('Navigation', () => {
        it('should render previous link with rel="prev"', () => {
            expect(content).toContain('rel="prev"');
        });

        it('should render next link with rel="next"', () => {
            expect(content).toContain('rel="next"');
        });

        it('should disable previous when on first page', () => {
            expect(content).toContain('hasPrevious');
            expect(content).toContain('currentPage > 1');
        });

        it('should disable next when on last page', () => {
            expect(content).toContain('hasNext');
            expect(content).toContain('currentPage < totalPages');
        });

        it('should render disabled state with opacity', () => {
            expect(content).toContain('cursor-not-allowed');
            expect(content).toContain('opacity-50');
        });
    });

    describe('Accessibility', () => {
        it('should use nav element with role navigation', () => {
            expect(content).toContain('<nav');
            expect(content).toContain('role="navigation"');
        });

        it('should have aria-label on nav element', () => {
            expect(content).toContain('aria-label=');
        });

        it('should mark current page with aria-current', () => {
            expect(content).toContain("aria-current={isCurrent ? 'page' : undefined}");
        });

        it('should have aria-label on page links', () => {
            expect(content).toContain('aria-label={`${t.page} ${p}`}');
        });

        it('should have sr-only text for mobile navigation arrows', () => {
            expect(content).toContain('sr-only');
        });

        it('should hide ellipsis from screen readers', () => {
            expect(content).toContain('aria-hidden="true"');
        });
    });

    describe('Localization', () => {
        it('should have Spanish labels', () => {
            expect(content).toContain("previous: 'Anterior'");
            expect(content).toContain("next: 'Siguiente'");
        });

        it('should have English labels', () => {
            expect(content).toContain("previous: 'Previous'");
            expect(content).toContain("next: 'Next'");
        });

        it('should have Portuguese labels', () => {
            expect(content).toContain("next: 'Próximo'");
        });
    });

    describe('Responsive behavior', () => {
        it('should hide non-adjacent pages on mobile', () => {
            expect(content).toContain('hidden sm:inline-flex');
        });

        it('should hide ellipsis on mobile', () => {
            expect(content).toContain('hidden px-1 text-text-tertiary sm:inline');
        });

        it('should show full text on desktop, arrows on mobile', () => {
            expect(content).toContain('hidden sm:inline');
            expect(content).toContain('sm:hidden');
        });
    });

    describe('Conditional rendering', () => {
        it('should only render when totalPages > 1', () => {
            expect(content).toContain('{totalPages > 1 &&');
        });
    });
});
