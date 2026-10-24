/**
 * @module test/layouts/marketing-layout-breadcrumbs
 * @description HOS-1766 item 01. The plans/pricing pages mounted `<Breadcrumbs>`
 * loose in the body of `MarketingLayout`, whose content slot has no container,
 * so the trail sat flush against the left edge. The layout now exposes a
 * `breadcrumbs` slot inside a centered container, and every page must route
 * its trail through it.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { baseValue, parseFile, readSrc } from '../helpers/css-contract';

const PLANES = resolve(__dirname, '../../src/pages/[lang]/planes');

/** Every `planes/<vertical>/index.astro` and `planes/<vertical>/precios/index.astro`. */
function planPages(): string[] {
    const files: string[] = [];
    for (const vertical of readdirSync(PLANES)) {
        files.push(join(PLANES, vertical, 'index.astro'));
        files.push(join(PLANES, vertical, 'precios', 'index.astro'));
    }
    return files;
}

describe('MarketingLayout breadcrumbs slot', () => {
    const layout = readSrc({ path: 'layouts/MarketingLayout.astro' });
    const rules = parseFile({ path: 'layouts/MarketingLayout.astro' });

    it('renders the named slot inside a wrapper element', () => {
        // Arrange / Act
        const match = layout.match(
            /<div class="marketing-breadcrumbs">\s*<slot name="breadcrumbs"\s*\/>\s*<\/div>/
        );

        // Assert
        expect(match).not.toBeNull();
    });

    it('gives the wrapper a centered, padded container', () => {
        // Arrange
        const selector = '.marketing-breadcrumbs';

        // Act
        const maxWidth = baseValue({ rules, selector, prop: 'max-width' });
        const marginInline = baseValue({ rules, selector, prop: 'margin-inline' });
        const paddingInline = baseValue({ rules, selector, prop: 'padding-inline' });

        // Assert
        expect(maxWidth).toBeTruthy();
        expect(marginInline).toBe('auto');
        expect(paddingInline).toBeTruthy();
        expect(paddingInline).not.toBe('0');
    });
});

describe('plans and pricing pages route breadcrumbs through the slot', () => {
    const pages = planPages();

    it('covers all eight pages', () => {
        expect(pages).toHaveLength(8);
    });

    it.each(
        pages.map((p) => [p.split('planes/')[1], p] as const)
    )('%s mounts <Breadcrumbs slot="breadcrumbs"> as a direct child', (_label, file) => {
        // Arrange
        const source = readFileSync(file, 'utf8');
        const tags = source.match(/<Breadcrumbs\b[^>]*>/g) ?? [];

        // Assert
        expect(tags).toHaveLength(1);
        expect(tags[0]).toContain('slot="breadcrumbs"');
        // A slot attribute inside an unnamed `<>` fragment is silently ignored.
        expect(source).not.toMatch(/<>\s*[\s\S]*<Breadcrumbs/);
    });
});
