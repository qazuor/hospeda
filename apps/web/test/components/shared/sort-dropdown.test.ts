/**
 * @file sort-dropdown.test.ts
 * @description Tests for SortDropdown.astro component.
 *
 * Verifies props interface, sort option definitions, default values,
 * selected state rendering, JavaScript navigation behavior, accessibility,
 * and design token usage.
 * Astro components are tested by reading source content directly.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const componentPath = resolve(__dirname, '../../../src/components/shared/SortDropdown.astro');
const content = readFileSync(componentPath, 'utf8');

describe('SortDropdown.astro', () => {
    describe('Props interface', () => {
        it('should define Props interface with currentSort and locale', () => {
            expect(content).toContain('interface Props');
            expect(content).toContain('readonly currentSort?: string');
            expect(content).toContain('readonly locale?: string');
        });

        it('should default currentSort to "featured"', () => {
            expect(content).toContain("currentSort = 'featured'");
        });

        it('should default locale to "es"', () => {
            expect(content).toContain("locale = 'es'");
        });
    });

    describe('Sort options', () => {
        it('should define the featured sort option', () => {
            expect(content).toContain("value: 'featured'");
        });

        it('should define the price ascending sort option', () => {
            expect(content).toContain("value: 'price_asc'");
        });

        it('should define the price descending sort option', () => {
            expect(content).toContain("value: 'price_desc'");
        });

        it('should define the rating sort option', () => {
            expect(content).toContain("value: 'rating'");
        });

        it('should define the recent sort option', () => {
            expect(content).toContain("value: 'recent'");
        });

        it('should define the name sort option', () => {
            expect(content).toContain("value: 'name'");
        });

        it('should have exactly 6 sort options', () => {
            const valueMatches = content.match(/value: '/g);
            expect(valueMatches?.length).toBe(6);
        });
    });

    describe('Selected state', () => {
        it('should mark the matching option as selected using the selected attribute', () => {
            expect(content).toContain('selected={opt.value === currentSort}');
        });
    });

    describe('Localization', () => {
        it('should import createT from i18n lib', () => {
            expect(content).toContain(
                "import { createT, type SupportedLocale } from '../../lib/i18n'"
            );
        });

        it('should use createT to build a translation helper', () => {
            expect(content).toContain('const t = createT(locale as SupportedLocale)');
        });

        it('should use i18n keys for option labels', () => {
            expect(content).toContain("t('accommodations.sort.featured')");
            expect(content).toContain("t('accommodations.sort.price.asc')");
            expect(content).toContain("t('accommodations.sort.price.desc')");
            expect(content).toContain("t('accommodations.sort.rating')");
            expect(content).toContain("t('accommodations.sort.recent')");
            expect(content).toContain("t('accommodations.sort.name')");
        });

        it('should use i18n key for the label title', () => {
            expect(content).toContain("t('accommodations.sort.title')");
        });
    });

    describe('HTML structure', () => {
        it('should render a <label> associated with the select via for="sort-select"', () => {
            expect(content).toContain('for="sort-select"');
        });

        it('should render a <select> with id="sort-select"', () => {
            expect(content).toContain('id="sort-select"');
        });

        it('should render <option> elements for each sort entry', () => {
            expect(content).toContain('<option');
            expect(content).toContain('value={opt.value}');
        });

        it('should wrap everything in a flex container div', () => {
            expect(content).toContain('flex items-center gap-2');
        });
    });

    describe('Client-side navigation script', () => {
        it('should include an inline <script> block', () => {
            expect(content).toContain('<script>');
        });

        it('should look up the select element by id', () => {
            expect(content).toContain("document.getElementById('sort-select')");
        });

        it('should listen for the change event on the select', () => {
            expect(content).toContain("sortSelect.addEventListener('change'");
        });

        it('should set the sortBy query parameter on URL change', () => {
            expect(content).toContain("url.searchParams.set('sortBy', sortSelect.value)");
        });

        it('should delete the page query parameter to reset pagination', () => {
            expect(content).toContain("url.searchParams.delete('page')");
        });

        it('should navigate by assigning to window.location.href', () => {
            expect(content).toContain('window.location.href = url.toString()');
        });
    });

    describe('Design tokens', () => {
        it('should use bg-card for the select background', () => {
            expect(content).toContain('bg-card');
        });

        it('should use text-foreground for select text', () => {
            expect(content).toContain('text-foreground');
        });

        it('should use border-border for the select border', () => {
            expect(content).toContain('border-border');
        });

        it('should use text-muted-foreground for the label color', () => {
            expect(content).toContain('text-muted-foreground');
        });

        it('should use focus:border-primary and focus:ring-2 for focus styles', () => {
            expect(content).toContain('focus:border-primary');
            expect(content).toContain('focus:ring-2');
        });
    });
});
