/**
 * Tests for Accommodation Type Pagination route.
 * Verifies page number validation, redirects, rewrite logic, and type validation.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const pagePath = resolve(
    __dirname,
    '../../src/pages/[lang]/alojamientos/tipo/[type]/page/[page].astro'
);
const content = readFileSync(pagePath, 'utf8');

describe('alojamientos/tipo/[type]/page/[page].astro', () => {
    describe('Imports', () => {
        it('should import getLocaleFromParams from page-helpers', () => {
            expect(content).toContain('getLocaleFromParams');
            expect(content).toContain("from '../../../../../../lib/page-helpers'");
        });
    });

    describe('Locale validation', () => {
        it('should extract type and page from params', () => {
            expect(content).toContain('const { type, page } = Astro.params');
        });

        it('should validate locale with getLocaleFromParams', () => {
            expect(content).toContain('getLocaleFromParams(Astro.params)');
            expect(content).toContain('if (!locale)');
        });

        it('should redirect to /es/ on invalid locale', () => {
            expect(content).toContain("return Astro.redirect('/es/')");
        });
    });

    describe('Type validation', () => {
        it('should define allowed accommodation types', () => {
            expect(content).toContain('const ALLOWED_TYPES');
            expect(content).toContain("'hotel'");
            expect(content).toContain("'hostel'");
            expect(content).toContain("'cabin'");
            expect(content).toContain("'apartment'");
            expect(content).toContain("'camping'");
            expect(content).toContain("'estancia'");
            expect(content).toContain("'posada'");
        });

        it('should validate type parameter', () => {
            expect(content).toContain('if (!type || !ALLOWED_TYPES.includes(type');
        });

        it('should redirect to alojamientos on invalid type', () => {
            expect(content).toContain('return Astro.redirect(`/${locale}/alojamientos/`)');
        });
    });

    describe('Page number validation', () => {
        it('should parse page number as integer', () => {
            expect(content).toContain("const pageNum = Number.parseInt(page || '1', 10)");
        });

        it('should redirect on invalid page number (NaN or < 1)', () => {
            expect(content).toContain('if (Number.isNaN(pageNum) || pageNum < 1)');
            expect(content).toContain(
                'return Astro.redirect(`/${locale}/alojamientos/tipo/${type}/`)'
            );
        });
    });

    describe('Page 1 canonical redirect', () => {
        it('should redirect page 1 to the canonical base URL', () => {
            expect(content).toContain('if (pageNum === 1)');
            expect(content).toContain(
                'return Astro.redirect(`/${locale}/alojamientos/tipo/${type}/`)'
            );
        });
    });

    describe('Rewrite to index with query param', () => {
        it('should rewrite to the type index page with page query parameter', () => {
            expect(content).toContain(
                'return Astro.rewrite(`/${locale}/alojamientos/tipo/${type}/?page=${pageNum}`)'
            );
        });
    });

    describe('JSDoc Documentation', () => {
        it('should have page documentation', () => {
            expect(content).toContain('/**');
            expect(content).toContain('* Paginated accommodation type listing route');
        });

        it('should document the route', () => {
            expect(content).toContain('* @route /[lang]/alojamientos/tipo/[type]/page/[page]/');
        });
    });

    describe('File Size', () => {
        it('should be under 500 lines', () => {
            const lines = content.split('\n').length;
            expect(lines).toBeLessThan(500);
        });
    });
});
