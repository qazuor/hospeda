/**
 * @file NavMenu.test.ts
 * @description Unit tests for NavMenu.astro component.
 * Follows Astro testing pattern: read source file and assert on content.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const src = readFileSync(
    resolve(__dirname, '../../../src/components/shared/NavMenu.astro'),
    'utf8'
);

describe('NavMenu.astro', () => {
    describe('semantic structure', () => {
        it('should render a <nav> element', () => {
            expect(src).toContain('<nav');
        });

        it('should have aria-label "Main navigation"', () => {
            expect(src).toContain('aria-label="Main navigation"');
        });
    });

    describe('visibility', () => {
        it('should be hidden by default and visible on md breakpoint', () => {
            expect(src).toContain('hidden md:flex');
        });
    });

    describe('typography', () => {
        it('should use font-sans for nav text', () => {
            expect(src).toContain('font-sans');
        });

        it('should use --text-nav CSS variable for font size', () => {
            expect(src).toContain('var(--text-nav');
        });
    });

    describe('i18n integration', () => {
        it('should import createT from @/lib/i18n', () => {
            expect(src).toContain("from '@/lib/i18n'");
            expect(src).toContain('createT');
        });

        it('should import SupportedLocale type', () => {
            expect(src).toContain('SupportedLocale');
        });

        it('should use nav.home translation key', () => {
            expect(src).toContain("t('nav.home'");
        });

        it('should use nav.accommodations translation key', () => {
            expect(src).toContain("t('nav.accommodations'");
        });

        it('should use nav.destinations translation key', () => {
            expect(src).toContain("t('nav.destinations'");
        });

        it('should use nav.events translation key', () => {
            expect(src).toContain("t('nav.events'");
        });

        it('should use nav.blog translation key', () => {
            expect(src).toContain("t('nav.blog'");
        });

        it('should use nav.contact translation key', () => {
            expect(src).toContain("t('nav.contact'");
        });
    });

    describe('URL building', () => {
        it('should import buildUrl from @/lib/urls', () => {
            expect(src).toContain("from '@/lib/urls'");
            expect(src).toContain('buildUrl');
        });

        it('should build URL for home path', () => {
            expect(src).toContain("path: '/'");
        });

        it('should build URL for /alojamientos/', () => {
            expect(src).toContain("path: '/alojamientos/'");
        });

        it('should build URL for /destinos/', () => {
            expect(src).toContain("path: '/destinos/'");
        });

        it('should build URL for /eventos/', () => {
            expect(src).toContain("path: '/eventos/'");
        });

        it('should build URL for /publicaciones/', () => {
            expect(src).toContain("path: '/publicaciones/'");
        });

        it('should build URL for /contacto/', () => {
            expect(src).toContain("path: '/contacto/'");
        });

        it('should build URL for /busqueda/ (search)', () => {
            expect(src).toContain("path: '/busqueda/'");
        });
    });

    describe('active state', () => {
        it('should apply text-accent class for active items', () => {
            expect(src).toContain('text-accent');
        });

        it('should apply font-semibold class for active items', () => {
            expect(src).toContain('font-semibold');
        });

        it('should set aria-current="page" on active links', () => {
            expect(src).toContain('aria-current');
        });
    });

    describe('search icon', () => {
        it('should import SearchIcon from @repo/icons', () => {
            expect(src).toContain("from '@repo/icons'");
            expect(src).toContain('SearchIcon');
        });

        it('should render SearchIcon with aria-hidden', () => {
            expect(src).toContain('aria-hidden="true"');
        });

        it('should have aria-label on the search link', () => {
            expect(src).toContain("t('nav.search'");
        });
    });

    describe('props interface', () => {
        it('should define Props interface with locale and currentPath', () => {
            expect(src).toContain('locale: SupportedLocale');
            expect(src).toContain('currentPath');
        });

        it('should use readonly props', () => {
            expect(src).toContain('readonly locale');
            expect(src).toContain('readonly currentPath');
        });
    });

    describe('accessibility', () => {
        it('should use focus-visible for keyboard navigation styles', () => {
            expect(src).toContain('focus-visible:outline');
        });

        it('should use class:list for conditional classes', () => {
            expect(src).toContain('class:list');
        });
    });
});
