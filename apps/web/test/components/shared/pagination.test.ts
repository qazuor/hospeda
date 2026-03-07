/**
 * @file pagination.test.ts
 * @description Tests for Pagination.astro component.
 *
 * Verifies props, URL generation logic, page number algorithm,
 * accessibility attributes, query-param mode, and responsive behavior.
 * Astro components are tested by reading source content since there is
 * no DOM renderer available in Vitest.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const componentPath = resolve(__dirname, '../../../src/components/shared/Pagination.astro');
const content = readFileSync(componentPath, 'utf8');

describe('Pagination.astro', () => {
    describe('Props interface', () => {
        it('should require currentPage prop as number', () => {
            expect(content).toContain('readonly currentPage: number');
        });

        it('should require totalPages prop as number', () => {
            expect(content).toContain('readonly totalPages: number');
        });

        it('should require baseUrl prop as string', () => {
            expect(content).toContain('readonly baseUrl: string');
        });

        it('should accept optional locale prop with SupportedLocale type', () => {
            expect(content).toContain('readonly locale?: SupportedLocale');
        });

        it('should default locale to "es"', () => {
            expect(content).toContain("locale = 'es'");
        });

        it('should accept optional searchParams prop for query-param mode', () => {
            expect(content).toContain('readonly searchParams?: URLSearchParams');
        });

        it('should accept optional class prop for additional CSS', () => {
            expect(content).toContain('readonly class?: string');
        });
    });

    describe('URL generation - segment mode', () => {
        it('should define buildPageUrl function', () => {
            expect(content).toContain('function buildPageUrl(page: number): string');
        });

        it('should return base URL with trailing slash for page 1', () => {
            expect(content).toContain('if (page === 1)');
            expect(content).toContain('`${base}/`');
        });

        it('should return /page/N/ segment URL for page > 1', () => {
            expect(content).toContain('`${base}/page/${page}/`');
        });

        it('should normalize trailing slash from base URL', () => {
            expect(content).toContain("baseUrl.endsWith('/')");
            expect(content).toContain('baseUrl.slice(0, -1)');
        });
    });

    describe('URL generation - query-param mode', () => {
        it('should handle searchParams when provided', () => {
            expect(content).toContain('if (searchParams)');
        });

        it('should clone URLSearchParams to avoid mutation', () => {
            expect(content).toContain('new URLSearchParams(searchParams)');
        });

        it('should remove page param for page 1 in query-param mode', () => {
            expect(content).toContain("params.delete('page')");
        });

        it('should set page param for pages > 1 in query-param mode', () => {
            expect(content).toContain("params.set('page', String(page))");
        });

        it('should append query string only when params exist', () => {
            expect(content).toContain('qs ? `${base}/?${qs}` : `${base}/`');
        });
    });

    describe('Page number algorithm', () => {
        it('should define getPageNumbers function', () => {
            expect(content).toContain('function getPageNumbers(current: number, total: number)');
        });

        it('should return all pages when total is 5 or fewer (no ellipsis)', () => {
            expect(content).toContain('if (total <= 5)');
        });

        it('should use -1 as sentinel value for ellipsis', () => {
            expect(content).toContain('p === -1');
        });

        it('should handle near-start case when current <= 3', () => {
            expect(content).toContain('if (current <= 3)');
            expect(content).toContain('[1, 2, 3, 4, -1, total]');
        });

        it('should handle near-end case when current >= total - 2', () => {
            expect(content).toContain('if (current >= total - 2)');
            expect(content).toContain('[1, -1, total - 3, total - 2, total - 1, total]');
        });

        it('should handle middle case with current page centered', () => {
            expect(content).toContain('[1, -1, current - 1, current, current + 1, -1, total]');
        });
    });

    describe('Navigation buttons', () => {
        it('should render previous link with rel="prev" when hasPrevious', () => {
            expect(content).toContain('rel="prev"');
        });

        it('should render next link with rel="next" when hasNext', () => {
            expect(content).toContain('rel="next"');
        });

        it('should compute hasPrevious as currentPage > 1', () => {
            expect(content).toContain('currentPage > 1');
            expect(content).toContain('hasPrevious');
        });

        it('should compute hasNext as currentPage < totalPages', () => {
            expect(content).toContain('currentPage < totalPages');
            expect(content).toContain('hasNext');
        });

        it('should render disabled state with opacity-50 and cursor-not-allowed', () => {
            expect(content).toContain('opacity-50');
            expect(content).toContain('cursor-not-allowed');
        });

        it('should use aria-disabled="true" for disabled nav elements', () => {
            expect(content).toContain('aria-disabled="true"');
        });
    });

    describe('Accessibility', () => {
        it('should use <nav> element with role="navigation"', () => {
            expect(content).toContain('<nav');
            expect(content).toContain('role="navigation"');
        });

        it('should have aria-label on the nav element', () => {
            expect(content).toContain('aria-label=');
        });

        it('should have aria-current="page" on the active page item', () => {
            expect(content).toContain('aria-current="page"');
        });

        it('should have aria-label on page number links', () => {
            expect(content).toContain('aria-label={`${labels.page} ${p}`}');
        });

        it('should include sr-only text for mobile navigation arrows', () => {
            expect(content).toContain('sr-only');
        });

        it('should hide ellipsis from screen readers with aria-hidden', () => {
            expect(content).toContain('aria-hidden="true"');
        });

        it('should have aria-label on previous and next buttons', () => {
            expect(content).toContain('aria-label={labels.previous}');
            expect(content).toContain('aria-label={labels.next}');
        });
    });

    describe('Localization', () => {
        it('should import createT from i18n lib', () => {
            expect(content).toContain(
                "import { createT, type SupportedLocale } from '../../lib/i18n'"
            );
        });

        it('should use createT with locale to build translation helper', () => {
            expect(content).toContain('const t = createT(locale)');
        });

        it('should provide previous, next, page, and of labels', () => {
            expect(content).toContain("previous: t('ui.pagination.previous'");
            expect(content).toContain("next:     t('ui.pagination.next'");
            expect(content).toContain("page:     t('ui.pagination.page'");
            expect(content).toContain("of:       t('ui.pagination.of'");
        });

        it('should provide fallback strings for all labels', () => {
            expect(content).toContain("'Anterior'");
            expect(content).toContain("'Siguiente'");
        });
    });

    describe('Responsive behavior', () => {
        it('should hide non-adjacent pages on mobile using hidden sm:inline-flex', () => {
            expect(content).toContain('hidden sm:inline-flex');
        });

        it('should hide ellipsis on mobile using hidden ... sm:inline', () => {
            expect(content).toContain('hidden px-1 text-muted-foreground sm:inline');
        });

        it('should show full text on desktop and arrows on mobile', () => {
            expect(content).toContain('hidden sm:inline');
            expect(content).toContain('sm:hidden');
        });
    });

    describe('Conditional rendering', () => {
        it('should only render the nav when totalPages > 1', () => {
            expect(content).toContain('{totalPages > 1 && (');
        });

        it('should render current page as span (not link) with active styles', () => {
            expect(content).toContain('linkActive');
        });
    });

    describe('Design tokens', () => {
        it('should use semantic color tokens for idle links', () => {
            expect(content).toContain('text-muted-foreground');
        });

        it('should use primary token for active page', () => {
            expect(content).toContain('bg-primary');
            expect(content).toContain('text-primary-foreground');
        });

        it('should use border token for link borders', () => {
            expect(content).toContain('border-border');
        });
    });
});
