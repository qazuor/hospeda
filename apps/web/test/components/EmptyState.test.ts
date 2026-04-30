/**
 * @file EmptyState.test.ts
 * @description Source-reading unit tests for EmptyState.astro.
 * Astro components cannot be rendered in Vitest/jsdom so we assert on the
 * source text to verify props, structure, and styling decisions.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const src = readFileSync(resolve(__dirname, '../../src/components/EmptyState.astro'), 'utf8');

describe('EmptyState.astro', () => {
    describe('file structure', () => {
        it('has a JSDoc file header', () => {
            expect(src).toContain('@file EmptyState.astro');
        });

        it('defines a Props interface', () => {
            expect(src).toContain('interface Props');
        });
    });

    describe('props', () => {
        it('accepts a required title prop', () => {
            expect(src).toContain('readonly title: string');
        });

        it('accepts a required description prop', () => {
            expect(src).toContain('readonly description: string');
        });

        it('accepts an optional icon prop', () => {
            expect(src).toContain('readonly icon?: IconComponent');
        });
    });

    describe('structure and accessibility', () => {
        it('wraps content in a div with role="status"', () => {
            expect(src).toContain('role="status"');
        });

        it('sets aria-live="polite" for non-disruptive announcement', () => {
            expect(src).toContain('aria-live="polite"');
        });

        it('renders the title as an h2 element', () => {
            expect(src).toContain('<h2');
            expect(src).toContain('{title}');
        });

        it('renders description in a paragraph element', () => {
            expect(src).toContain('<p');
            expect(src).toContain('{description}');
        });

        it('uses aria-hidden on the icon wrapper', () => {
            expect(src).toContain('aria-hidden="true"');
        });
    });

    describe('icon rendering', () => {
        it('conditionally renders the icon only when provided', () => {
            expect(src).toContain('{Icon && (');
        });

        it('wraps the icon in an icon-wrapper element', () => {
            expect(src).toContain('empty-state__icon-wrapper');
        });

        it('passes size={48} to the icon', () => {
            expect(src).toContain('size={48}');
        });

        it('passes weight="duotone" to the icon', () => {
            expect(src).toContain('weight="duotone"');
        });
    });

    describe('action slot', () => {
        it('checks if default slot has content', () => {
            expect(src).toContain("Astro.slots.has('default')");
        });

        it('renders the slot wrapper only when slot has content', () => {
            expect(src).toContain('{hasSlot && (');
        });

        it('renders the <slot /> element', () => {
            expect(src).toContain('<slot />');
        });

        it('wraps the slot in an action container', () => {
            expect(src).toContain('empty-state__action');
        });
    });

    describe('styles', () => {
        it('applies a max-width of 500px to centre-constrain the content', () => {
            expect(src).toContain('max-width: 500px');
        });

        it('centres content with margin-inline: auto', () => {
            expect(src).toContain('margin-inline: auto');
        });

        it('uses flex column layout', () => {
            expect(src).toContain('flex-direction: column');
        });

        it('aligns items to centre', () => {
            expect(src).toContain('align-items: center');
        });

        it('uses --font-heading for the title', () => {
            expect(src).toContain('var(--font-heading)');
        });

        it('uses --core-muted-foreground for the description colour', () => {
            expect(src).toContain('var(--core-muted-foreground)');
        });

        it('uses --brand-primary for icon wrapper background tint', () => {
            expect(src).toContain('var(--brand-primary)');
        });

        it('uses font-weight 700 (bold) for the title', () => {
            expect(src).toContain('font-weight: 700');
        });
    });
});
