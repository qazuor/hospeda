/**
 * @file CategoryTiles.test.ts
 * @description Source-reading unit tests for CategoryTiles.astro.
 * Astro components cannot be rendered in Vitest/jsdom so we assert on the
 * source text to verify props, structure, accessibility, responsive grid,
 * and styling conventions.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const src = readFileSync(resolve(__dirname, '../../src/components/CategoryTiles.astro'), 'utf8');

describe('CategoryTiles.astro', () => {
    describe('file structure', () => {
        it('has a JSDoc file header', () => {
            expect(src).toContain('@file CategoryTiles.astro');
        });

        it('defines a TileItem interface', () => {
            expect(src).toContain('interface TileItem');
        });

        it('defines a Props interface', () => {
            expect(src).toContain('interface Props');
        });

        it('accepts tiles prop as ReadonlyArray<TileItem>', () => {
            expect(src).toContain('ReadonlyArray<TileItem>');
        });

        it('accepts sectionTitle prop', () => {
            expect(src).toContain('readonly sectionTitle: string');
        });

        it('accepts optional sectionTagline prop', () => {
            expect(src).toContain('readonly sectionTagline?: string');
        });
    });

    describe('TileItem interface', () => {
        it('defines readonly title property', () => {
            expect(src).toContain('readonly title: string');
        });

        it('defines readonly description property', () => {
            expect(src).toContain('readonly description: string');
        });

        it('defines readonly href property', () => {
            expect(src).toContain('readonly href: string');
        });

        it('defines optional icon property', () => {
            expect(src).toContain('readonly icon?:');
        });

        it('defines optional image property typed as Astro ImageMetadata', () => {
            expect(src).toContain('readonly image?: ImageMetadata');
        });
    });

    describe('section structure', () => {
        it('renders a <section> element', () => {
            expect(src).toContain('<section');
        });

        it('applies category-tiles and section classes', () => {
            expect(src).toContain('class="category-tiles section"');
        });

        it('renders sectionTitle as an <h2>', () => {
            expect(src).toContain('<h2');
            expect(src).toContain('{sectionTitle}');
        });

        it('conditionally renders sectionTagline', () => {
            expect(src).toContain('{sectionTagline && (');
        });

        it('renders the grid container', () => {
            expect(src).toContain('category-tiles__grid');
        });
    });

    describe('tile rendering', () => {
        it('maps over tiles array', () => {
            expect(src).toContain('tiles.map(');
        });

        it('renders each tile as an <a> anchor element', () => {
            expect(src).toContain('<a');
            expect(src).toContain('href={href}');
        });

        it('applies category-tiles__tile class', () => {
            expect(src).toContain('class="category-tiles__tile"');
        });

        it('renders tile title as an <h3>', () => {
            expect(src).toContain('<h3');
            expect(src).toContain('{title}');
        });

        it('renders tile description', () => {
            expect(src).toContain('{description}');
        });

        it('applies data-reveal="up" for scroll animations', () => {
            expect(src).toContain('data-reveal="up"');
        });

        it('applies staggered reveal via data-stagger attrs (no inline style=, SPEC-046)', () => {
            // SPEC-046 GAP-046-09a: the stagger delay is now driven by
            // data-stagger-index + data-stagger-step matched in
            // css-var-themes.css, replacing the prior inline
            // `style="transition-delay: Xms"` that triggered style-src-attr.
            expect(src).toContain('data-stagger-index=');
            expect(src).toContain('data-stagger-step="80"');
            expect(src).not.toContain('transition-delay:');
        });
    });

    describe('visual area (icon/image)', () => {
        it('renders image when image prop is provided', () => {
            expect(src).toContain('{image && (');
            expect(src).toContain('category-tiles__image');
        });

        it('sets aria-hidden on decorative images', () => {
            expect(src).toContain('aria-hidden="true"');
        });

        it('sets loading="lazy" on tile images', () => {
            expect(src).toContain('loading="lazy"');
        });

        it('renders icon wrapper when Icon is provided but no image', () => {
            expect(src).toContain('category-tiles__icon-wrapper');
        });

        it('renders placeholder when neither image nor icon is provided', () => {
            expect(src).toContain('category-tiles__icon-placeholder');
        });
    });

    describe('responsive layout', () => {
        it('uses flex-wrap so the last row centres instead of left-aligning', () => {
            expect(src).toMatch(/\.category-tiles__grid[\s\S]*?display:\s*flex/);
            expect(src).toMatch(/\.category-tiles__grid[\s\S]*?flex-wrap:\s*wrap/);
            expect(src).toMatch(/\.category-tiles__grid[\s\S]*?justify-content:\s*center/);
        });

        it('sets a flex-basis and max-width on each tile so they stay compact', () => {
            expect(src).toMatch(/\.category-tiles__tile[\s\S]*?flex:\s*1\s+1\s+\d+px/);
            expect(src).toMatch(/\.category-tiles__tile[\s\S]*?max-width:\s*\d+px/);
        });
    });

    describe('styles', () => {
        it('uses --surface-warm for section background', () => {
            expect(src).toContain('var(--surface-warm)');
        });

        it('uses --space-section for section padding', () => {
            expect(src).toContain('var(--space-section');
        });

        it('uses --radius-card for tile border-radius', () => {
            expect(src).toContain('var(--radius-card');
        });

        it('uses --font-heading for tile title', () => {
            expect(src).toContain('var(--font-heading)');
        });

        it('uses --font-sans for tile description', () => {
            expect(src).toContain('var(--font-sans)');
        });

        it('uses --shadow-card and --shadow-card-hover for elevation', () => {
            expect(src).toContain('var(--shadow-card)');
            expect(src).toContain('var(--shadow-card-hover)');
        });

        it('uses --accent for tagline colour', () => {
            expect(src).toContain('var(--brand-accent)');
        });

        it('includes focus-visible rule for keyboard navigation', () => {
            expect(src).toContain(':focus-visible');
        });

        it('includes hover transform for lift effect', () => {
            expect(src).toContain('translateY(-4px)');
        });

        it('uses --card for tile background', () => {
            expect(src).toContain('var(--core-card)');
        });
    });
});
