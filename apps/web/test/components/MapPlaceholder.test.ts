/**
 * @file MapPlaceholder.test.ts
 * @description Source-reading unit tests for MapPlaceholder.astro.
 * Astro components cannot be rendered in Vitest/jsdom so we assert on the
 * source text to verify structure, Google Maps URL generation, and styling.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const src = readFileSync(resolve(__dirname, '../../src/components/MapPlaceholder.astro'), 'utf8');

describe('MapPlaceholder.astro', () => {
    describe('file structure', () => {
        it('has a JSDoc file header', () => {
            expect(src).toContain('@file MapPlaceholder.astro');
        });

        it('defines a Props interface', () => {
            expect(src).toContain('interface Props');
        });
    });

    describe('props', () => {
        it('accepts a required address prop', () => {
            expect(src).toContain('readonly address: string');
        });

        it('accepts an optional title prop', () => {
            expect(src).toContain('readonly title?: string');
        });

        it('defaults title to "Ubicación"', () => {
            expect(src).toContain("= 'Ubicación'");
        });
    });

    describe('icon imports', () => {
        it('imports MapIcon from @repo/icons', () => {
            expect(src).toContain('MapIcon');
            expect(src).toContain("from '@repo/icons'");
        });

        it('imports LocationIcon from @repo/icons', () => {
            expect(src).toContain('LocationIcon');
        });

        it('marks both icons as aria-hidden', () => {
            // Both icon invocations should have aria-hidden="true"
            const matches = src.match(/aria-hidden="true"/g) ?? [];
            expect(matches.length).toBeGreaterThanOrEqual(2);
        });
    });

    describe('Google Maps URL', () => {
        it('constructs the maps URL using encodeURIComponent', () => {
            expect(src).toContain('encodeURIComponent(address)');
        });

        it('uses the https://maps.google.com/?q= base', () => {
            expect(src).toContain('https://maps.google.com/?q=');
        });

        it('links to the maps URL via href', () => {
            expect(src).toContain('href={mapsUrl}');
        });

        it('opens the link in a new tab', () => {
            expect(src).toContain('target="_blank"');
        });

        it('adds rel="noopener noreferrer" for security', () => {
            expect(src).toContain('rel="noopener noreferrer"');
        });
    });

    describe('CTA button', () => {
        it('labels the CTA "Ver en Google Maps"', () => {
            expect(src).toContain('Ver en Google Maps');
        });

        it('applies the map-placeholder__cta class', () => {
            expect(src).toContain('map-placeholder__cta');
        });

        it('includes an accessible aria-label', () => {
            expect(src).toContain('aria-label={`Ver ${address} en Google Maps`}');
        });
    });

    describe('card structure', () => {
        it('renders the title in an h3 element', () => {
            expect(src).toContain('<h3');
            expect(src).toContain('{title}');
        });

        it('renders the address in a paragraph', () => {
            expect(src).toContain('<p');
            expect(src).toContain('{address}');
        });

        it('includes a header row with icon and title', () => {
            expect(src).toContain('map-placeholder__header');
        });

        it('includes an address row with location icon and text', () => {
            expect(src).toContain('map-placeholder__address-row');
        });
    });

    describe('styles', () => {
        it('uses --radius-card for border-radius', () => {
            expect(src).toContain('var(--radius-card');
        });

        it('uses --shadow-card for card elevation', () => {
            expect(src).toContain('var(--shadow-card)');
        });

        it('uses --core-card for background colour', () => {
            expect(src).toContain('var(--core-card)');
        });

        it('uses --brand-primary for CTA button background', () => {
            expect(src).toContain('var(--brand-primary)');
        });

        it('uses --radius-button for the CTA border-radius', () => {
            expect(src).toContain('var(--radius-button');
        });

        it('uses --font-heading for the title', () => {
            expect(src).toContain('var(--font-heading)');
        });

        it('uses --core-muted-foreground for the address text', () => {
            expect(src).toContain('var(--core-muted-foreground)');
        });

        it('uses --font-sans for body text', () => {
            expect(src).toContain('var(--font-sans)');
        });

        it('respects prefers-reduced-motion', () => {
            expect(src).toContain('prefers-reduced-motion: reduce');
        });

        it('includes focus-visible rule for keyboard navigation', () => {
            expect(src).toContain(':focus-visible');
        });
    });
});
