/**
 * @file TagChips.test.ts
 * @description Source-reading unit tests for TagChips.astro.
 * Astro components cannot be rendered in Vitest/jsdom so we assert on the
 * source text to verify props, structure, accessibility, and styling.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const src = readFileSync(resolve(__dirname, '../../src/components/TagChips.astro'), 'utf8');

describe('TagChips.astro', () => {
    describe('file structure', () => {
        it('has a JSDoc file header', () => {
            expect(src).toContain('@file TagChips.astro');
        });

        it('defines a ChipItem interface', () => {
            expect(src).toContain('interface ChipItem');
        });

        it('defines a Props interface', () => {
            expect(src).toContain('interface Props');
        });

        it('accepts chips prop as ReadonlyArray<ChipItem>', () => {
            expect(src).toContain('ReadonlyArray<ChipItem>');
        });

        it('accepts ariaLabel prop as string', () => {
            expect(src).toContain('readonly ariaLabel: string');
        });
    });

    describe('ChipItem interface', () => {
        it('defines readonly label property', () => {
            expect(src).toContain('readonly label: string');
        });

        it('defines readonly href property', () => {
            expect(src).toContain('readonly href: string');
        });
    });

    describe('accessible markup', () => {
        it('wraps chips in a <nav> element', () => {
            expect(src).toContain('<nav');
            expect(src).toContain('class="tag-chips"');
        });

        it('passes ariaLabel to the nav aria-label attribute', () => {
            expect(src).toContain('aria-label={ariaLabel}');
        });

        it('renders a <ul> list with role="list"', () => {
            expect(src).toContain('<ul');
            expect(src).toContain('role="list"');
        });

        it('renders <li> items inside the list', () => {
            expect(src).toContain('<li');
        });

        it('renders each chip as an <a> anchor element', () => {
            expect(src).toContain('<a href={href}');
        });
    });

    describe('chip rendering', () => {
        it('applies tag-chips__chip class to anchor elements', () => {
            expect(src).toContain('class="tag-chips__chip"');
        });

        it('applies tag-chips__item class to list items', () => {
            expect(src).toContain('class="tag-chips__item"');
        });

        it('applies tag-chips__list class to the ul', () => {
            expect(src).toContain('class="tag-chips__list"');
        });

        it('maps over chips array to render each chip', () => {
            expect(src).toContain('chips.map(');
        });

        it('renders the chip label inside the anchor', () => {
            expect(src).toContain('{label}');
        });
    });

    describe('horizontal scroll behaviour', () => {
        it('sets overflow-x: auto on the list', () => {
            expect(src).toContain('overflow-x: auto');
        });

        it('uses flex-wrap: nowrap to prevent line breaks', () => {
            expect(src).toContain('flex-wrap: nowrap');
        });

        it('uses flex-direction: row for horizontal layout', () => {
            expect(src).toContain('flex-direction: row');
        });

        it('sets flex-shrink: 0 on chips to prevent squishing', () => {
            expect(src).toContain('flex-shrink: 0');
        });

        it('hides the scrollbar with scrollbar-width: none', () => {
            expect(src).toContain('scrollbar-width: none');
        });
    });

    describe('styles', () => {
        it('uses --radius-pill for chip border-radius', () => {
            expect(src).toContain('var(--radius-pill');
        });

        it('uses --card for chip background', () => {
            expect(src).toContain('var(--core-card)');
        });

        it('uses --font-sans for chip text', () => {
            expect(src).toContain('var(--font-sans)');
        });

        it('uses --text-body-sm for chip font size', () => {
            expect(src).toContain('var(--text-body-sm)');
        });

        it('uses --accent for hover state', () => {
            expect(src).toContain('var(--brand-accent)');
        });

        it('uses --duration-normal for transitions', () => {
            expect(src).toContain('var(--duration-normal)');
        });

        it('includes focus-visible rule for keyboard navigation', () => {
            expect(src).toContain(':focus-visible');
        });
    });
});
